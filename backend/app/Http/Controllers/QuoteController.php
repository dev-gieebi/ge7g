<?php

namespace App\Http\Controllers;

use App\Models\Price;
use App\Models\Product;
use App\Models\Quote;
use App\Models\QuoteItem;
use App\Models\Tax;
use App\Models\User;
use App\Services\NumerotationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class QuoteController extends Controller
{
    /** Consultation des proformas : circuit commercial. */
    private const VIEW_ROLES = ['CDG_ADMIN', 'LG_ADMIN', 'DG_ADMIN', 'SUPERADMIN'];

    /** Émission et modification des proformas. */
    private const MANAGE_ROLES = ['CDG_ADMIN', 'LG_ADMIN', 'DG_ADMIN', 'SUPERADMIN'];

    /** Validation / annulation d'une proforma : décision interne encadrée. */
    private const STATUS_ROLES = ['LG_ADMIN', 'DG_ADMIN', 'SUPERADMIN'];

    private function authorizeUser(Request $request, array $roles): User
    {
        /** @var User $user */
        $user = $request->user();

        if (! in_array($user->role, $roles, true)) {
            abort(403, 'Accès réservé.');
        }

        return $user;
    }

    public function index(Request $request): JsonResponse
    {
        $this->authorizeUser($request, self::VIEW_ROLES);

        $query = Quote::query()->with(['creator', 'zone', 'items.product.unit']);

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($from = $request->input('from')) {
            $query->whereDate('created_at', '>=', $from);
        }

        if ($to = $request->input('to')) {
            $query->whereDate('created_at', '<=', $to);
        }

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('number', 'like', "%{$search}%")
                    ->orWhere('customer_name', 'like', "%{$search}%");
            });
        }

        if ($sort = $request->input('sort')) {
            $direction = $request->input('dir') === 'desc' ? 'desc' : 'asc';
            $query->orderBy($sort, $direction);
        } else {
            $query->orderByDesc('id');
        }

        $perPage = (int) $request->input('per_page', 25);
        $paginator = $query->paginate($perPage);

        return response()->json([
            'data' => $paginator->items(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
            ],
        ]);
    }

    public function show(Request $request, Quote $quote): JsonResponse
    {
        $this->authorizeUser($request, self::VIEW_ROLES);

        $quote->load(['creator', 'zone', 'items.product.unit', 'extras']);

        return response()->json(['data' => $quote]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $this->authorizeUser($request, self::MANAGE_ROLES);

        $validated = $request->validate($this->rules());

        $quote = DB::transaction(function () use ($validated, $user) {
            $quote = Quote::create([
                // N° annuel : la première proforma de chaque année repart à 00001.
                'number' => app(NumerotationService::class)->nextAnneeDabord('DEV'),
                'user_id' => $user->id,
                'zone_id' => $validated['zone_id'],
                'customer_name' => $validated['customer_name'],
                'customer_phone' => $validated['customer_phone'] ?? null,
                'customer_address' => $validated['customer_address'] ?? null,
                'discount_rate' => (float) ($validated['discount_rate'] ?? 0),
                'status' => 'BROUILLON',
                'valid_until' => $validated['valid_until'] ?? null,
                'notes' => $validated['notes'] ?? null,
            ]);

            $this->fillTotals($quote, $validated['items'], $validated['tax_ids'] ?? [], (int) $validated['zone_id']);
            $quote->save();
            $this->syncExtras($quote, $validated['extras'] ?? []);

            return $quote;
        });

        $quote->load(['creator', 'zone', 'items.product.unit', 'extras']);

        return response()->json(['data' => $quote], 201);
    }

    public function update(Request $request, Quote $quote): JsonResponse
    {
        $this->authorizeUser($request, self::MANAGE_ROLES);

        if (in_array($quote->status, ['VALIDE', 'ENVOYE', 'ANNULE'], true)) {
            abort(422, 'Une proforma validée, envoyée ou annulée ne peut plus être modifiée.');
        }

        $validated = $request->validate($this->rules());

        DB::transaction(function () use ($quote, $validated) {
            $quote->zone_id = $validated['zone_id'];
            $quote->customer_name = $validated['customer_name'];
            $quote->customer_phone = $validated['customer_phone'] ?? null;
            $quote->customer_address = $validated['customer_address'] ?? null;
            $quote->discount_rate = (float) ($validated['discount_rate'] ?? 0);
            $quote->valid_until = $validated['valid_until'] ?? null;
            $quote->notes = $validated['notes'] ?? null;

            $quote->items()->delete();
            $this->fillTotals($quote, $validated['items'], $validated['tax_ids'] ?? [], (int) $validated['zone_id']);
            $quote->save();
            $this->syncExtras($quote, $validated['extras'] ?? []);
        });

        $quote->load(['creator', 'zone', 'items.product.unit', 'extras']);

        return response()->json(['data' => $quote]);
    }

    /**
     * Frais annexes (manutention, livraison…) affichés sur la proforma :
     * libellé + montant, ajoutés au TOTAL TTC du document.
     */
    public function saveExtras(Request $request, Quote $quote): JsonResponse
    {
        $this->authorizeUser($request, self::MANAGE_ROLES);

        $validated = $request->validate([
            'extras' => 'present|array|max:20',
            'extras.*.label' => 'required|string|max:80',
            'extras.*.amount' => 'required|numeric|min:0|max:999999999',
        ]);

        // Frais annexes figés dès que la proforma est validée, envoyée ou annulée.
        if ($quote->status !== 'BROUILLON') {
            abort(422, 'Les frais annexes ne se modifient que sur une proforma en brouillon.');
        }

        $this->syncExtras($quote, $validated['extras']);

        $quote->load(['creator', 'zone', 'items.product.unit', 'extras']);

        return response()->json(['data' => $quote]);
    }

    public function destroy(Request $request, Quote $quote): JsonResponse
    {
        $this->authorizeUser($request, self::MANAGE_ROLES);

        if (in_array($quote->status, ['VALIDE', 'ENVOYE'], true)) {
            abort(422, 'Une proforma validée ou envoyée ne peut pas être supprimée.');
        }

        $quote->delete();

        return response()->json(['data' => true]);
    }

    /**
     * Produits ajoutés à une proforma tant qu'elle n'est pas validée. Un
     * produit déjà présent voit sa quantité augmenter (prix de la ligne
     * conservé) ; les totaux sont recalculés avec les taxes de la proforma.
     */
    public function addItems(Request $request, Quote $quote): JsonResponse
    {
        $this->authorizeUser($request, self::MANAGE_ROLES);

        if ($quote->status !== 'BROUILLON') {
            abort(422, 'Des produits ne peuvent être ajoutés qu\'à une proforma non validée.');
        }

        $validated = $request->validate([
            'items' => 'required|array|min:1|max:50',
            'items.*.product_id' => 'required|integer|exists:products,id',
            'items.*.quantity' => 'required|numeric|min:0.01',
            'items.*.unit_price' => 'nullable|numeric|min:0',
        ]);

        DB::transaction(function () use ($quote, $validated) {
            $products = Product::whereIn('id', array_column($validated['items'], 'product_id'))->get()->keyBy('id');
            $floors = $this->floorPrices($products->keys()->all(), $quote->zone_id);

            foreach ($validated['items'] as $input) {
                /** @var Product $product */
                $product = $products->get($input['product_id']);
                $qty = (float) $input['quantity'];
                $existing = $quote->items()->where('product_id', $product->id)->first();

                if ($existing) {
                    $existing->quantity = (float) $existing->quantity + $qty;
                    $existing->total = round((float) $existing->quantity * (float) $existing->unit_price, 4);
                    $existing->save();

                    continue;
                }

                $floorPrice = $floors->get($product->id);
                $floor = $floorPrice && (float) $floorPrice->amount > 0 ? (float) $floorPrice->amount : (float) $product->sale_price;
                $unitPrice = isset($input['unit_price']) ? (float) $input['unit_price'] : $floor;

                if ($unitPrice < $floor - 0.0001) {
                    throw ValidationException::withMessages([
                        'items' => 'Le prix de « '.$product->name.' » ne peut pas être inférieur au barème de la ville ('.number_format($floor, 0, ',', ' ').' FCFA).',
                    ]);
                }

                QuoteItem::create([
                    'quote_id' => $quote->id,
                    'product_id' => $product->id,
                    'quantity' => $qty,
                    'unit_price' => $unitPrice,
                    'total' => round($qty * $unitPrice, 4),
                ]);
            }

            $this->recalculerTotaux($quote);
        });

        $quote->load(['creator', 'zone', 'items.product.unit', 'extras']);

        return response()->json(['data' => $quote]);
    }

    /** Totaux depuis les lignes, avec la remise et les taux de taxe figés de la proforma. */
    private function recalculerTotaux(Quote $quote): void
    {
        $subtotal = (float) $quote->items()->sum('total');
        $netSubtotal = $subtotal - round($subtotal * (float) $quote->discount_rate / 100);

        $taxAmount = 0;
        $details = is_array($quote->tax_details) ? $quote->tax_details : [];
        $quote->tax_details = array_map(function (array $t) use ($netSubtotal, &$taxAmount) {
            $signed = $t['type'] === 'TPS' ? -(float) $t['rate'] : (float) $t['rate'];
            $t['amount'] = (int) round($netSubtotal * $signed / 100);
            $taxAmount += $t['amount'];

            return $t;
        }, $details);

        $quote->subtotal = $subtotal;
        $quote->tax_amount = $taxAmount;
        $quote->total = $netSubtotal + $taxAmount;
        $quote->save();
    }

    public function updateStatus(Request $request, Quote $quote): JsonResponse
    {
        $this->authorizeUser($request, self::STATUS_ROLES);

        $validated = $request->validate([
            'status' => 'required|in:BROUILLON,ENVOYE,VALIDE,ANNULE',
        ]);

        // Ordre imposé : une proforma est d'abord validée, puis envoyée.
        $transitions = [
            'BROUILLON' => ['VALIDE', 'ANNULE'],
            'VALIDE' => ['ENVOYE'],
            'ENVOYE' => [],
            'ANNULE' => [],
        ];

        if (! in_array($validated['status'], $transitions[$quote->status] ?? [], true)) {
            throw ValidationException::withMessages([
                'status' => $quote->status === 'BROUILLON' && $validated['status'] === 'ENVOYE'
                    ? 'La proforma doit être validée avant d\'être envoyée.'
                    : 'Changement de statut impossible pour cette proforma.',
            ]);
        }

        $quote->status = $validated['status'];
        $quote->save();

        $quote->load(['creator', 'zone', 'items.product.unit', 'extras']);

        return response()->json(['data' => $quote]);
    }

    /** @return array<string, mixed> */
    private function rules(): array
    {
        return [
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|integer|exists:products,id',
            'items.*.quantity' => 'required|numeric|min:0.01',
            'items.*.unit_price' => 'nullable|numeric|min:0',
            'zone_id' => 'required|integer|exists:zones,id',
            'tax_ids' => 'nullable|array',
            'tax_ids.*' => 'integer|exists:taxes,id',
            'customer_name' => 'required|string|max:120',
            'customer_phone' => 'nullable|string|max:40',
            'customer_address' => 'nullable|string|max:255',
            'discount_rate' => 'nullable|numeric|min:0|max:100',
            'valid_until' => 'nullable|date',
            'notes' => 'nullable|string|max:2000',
            'extras' => 'nullable|array|max:20',
            'extras.*.label' => 'required|string|max:80',
            'extras.*.amount' => 'required|numeric|min:0|max:999999999',
        ];
    }

    /** @param  list<array{label: string, amount: float}>  $rows */
    private function syncExtras(Quote $quote, array $rows): void
    {
        $quote->extras()->delete();
        $quote->extras()->createMany(
            collect($rows)
                ->map(fn (array $x) => ['label' => trim($x['label']), 'amount' => (float) $x['amount']])
                ->filter(fn (array $x) => $x['label'] !== '' && $x['amount'] > 0)
                ->values()
                ->all()
        );
    }

    /**
     * Crée les lignes et fige les totaux (remise puis taxes sur le HT net),
     * comme pour les ventes POS, sans toucher au stock.
     *
     * @param  list<array{product_id: int, quantity: float, unit_price?: float|null}>  $items
     * @param  list<int>  $taxIds
     */
    private function fillTotals(Quote $quote, array $items, array $taxIds, ?int $zoneId = null): void
    {
        $taxes = $taxIds ? Tax::whereIn('id', $taxIds)->get() : collect();
        if ($taxes->isEmpty()) {
            $taxes = collect([new Tax(['type' => 'AUCUNE', 'rate' => 0])]);
        }

        $products = Product::whereIn('id', array_column($items, 'product_id'))->get()->keyBy('id');
        $floors = $this->floorPrices($products->keys()->all(), $zoneId);

        $subtotal = 0.0;
        foreach ($items as $input) {
            /** @var Product $product */
            $product = $products->get($input['product_id']);
            $qty = (float) $input['quantity'];

            // Prix plancher : barème de la ville (ou « Toutes les villes » / prix POS en repli).
            $floorPrice = $floors->get($product->id);
            $floor = $floorPrice && (float) $floorPrice->amount > 0 ? (float) $floorPrice->amount : (float) $product->sale_price;
            $unitPrice = isset($input['unit_price']) ? (float) $input['unit_price'] : $floor;

            if ($unitPrice < $floor - 0.0001) {
                throw ValidationException::withMessages([
                    'items' => 'Le prix de « '.$product->name.' » ne peut pas être inférieur au barème de la ville ('.number_format($floor, 0, ',', ' ').' FCFA).',
                ]);
            }

            $lineTotal = round($qty * $unitPrice, 4);

            QuoteItem::create([
                'quote_id' => $quote->id,
                'product_id' => $product->id,
                'quantity' => $qty,
                'unit_price' => $unitPrice,
                'total' => $lineTotal,
            ]);

            $subtotal += $lineTotal;
        }

        $discountAmount = round($subtotal * (float) $quote->discount_rate / 100);
        $netSubtotal = $subtotal - $discountAmount;

        $taxDetails = [];
        $taxAmount = 0;
        foreach ($taxes as $tax) {
            $signedRate = $tax->type === 'TPS' ? -(float) $tax->rate : (float) $tax->rate;
            $amount = (int) round($netSubtotal * $signedRate / 100);
            $taxAmount += $amount;
            $taxDetails[] = ['type' => $tax->type, 'name' => $tax->name, 'rate' => (float) $tax->rate, 'amount' => $amount];
        }

        $quote->subtotal = $subtotal;
        $quote->tax_type = $taxes->pluck('type')->implode(' + ');
        $quote->tax_rate = (float) $taxes->sum(fn ($t) => $t->type === 'TPS' ? -$t->rate : $t->rate) / 100;
        $quote->tax_amount = $taxAmount;
        $quote->tax_details = $taxDetails;
        $quote->total = $netSubtotal + $taxAmount;
    }

    /**
     * Prix planchers par produit : prix de la ville en priorité, sinon
     * prix « Toutes les villes » ; sans ville, prix POS / global.
     *
     * @param  list<int>  $productIds
     * @return Collection<int, Price>
     */
    private function floorPrices(array $productIds, ?int $zoneId): Collection
    {
        if ($zoneId) {
            return Price::whereIn('product_id', $productIds)
                ->where(fn ($q) => $q->where('zone_id', $zoneId)->orWhereNull('zone_id'))
                ->get()
                ->sortByDesc(fn ($p) => (int) $p->zone_id === $zoneId ? 1 : 0)
                ->unique('product_id')
                ->keyBy('product_id');
        }

        return Price::whereIn('product_id', $productIds)
            ->where(fn ($q) => $q->where('for_pos', true)->orWhereNull('zone_id'))
            ->get()
            ->sortByDesc(fn ($p) => (int) $p->for_pos)
            ->unique('product_id')
            ->keyBy('product_id');
    }
}
