<?php

namespace App\Http\Controllers;

use App\Models\Price;
use App\Models\Product;
use App\Models\Quote;
use App\Models\QuoteItem;
use App\Models\Tax;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class QuoteController extends Controller
{
    /** Consultation des devis : circuit commercial. */
    private const VIEW_ROLES = ['CDG_ADMIN', 'LG_ADMIN', 'DG_ADMIN', 'SUPERADMIN'];

    /** Émission et modification des devis. */
    private const MANAGE_ROLES = ['CDG_ADMIN', 'LG_ADMIN', 'DG_ADMIN', 'SUPERADMIN'];

    /** Validation / annulation d'un devis : décision interne encadrée. */
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

        $quote->load(['creator', 'zone', 'items.product.unit']);

        return response()->json(['data' => $quote]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $this->authorizeUser($request, self::MANAGE_ROLES);

        $validated = $request->validate($this->rules());

        $quote = DB::transaction(function () use ($validated, $user) {
            $quote = Quote::create([
                'number' => (string) Str::uuid(),
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
            $quote->number = 'DEV-'.now()->format('Y').'-'.str_pad((string) $quote->id, 5, '0', STR_PAD_LEFT);
            $quote->save();

            return $quote;
        });

        $quote->load(['creator', 'zone', 'items.product.unit']);

        return response()->json(['data' => $quote], 201);
    }

    public function update(Request $request, Quote $quote): JsonResponse
    {
        $this->authorizeUser($request, self::MANAGE_ROLES);

        if (in_array($quote->status, ['VALIDE', 'ANNULE'], true)) {
            abort(422, 'Un devis validé ou annulé ne peut plus être modifié.');
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
        });

        $quote->load(['creator', 'zone', 'items.product.unit']);

        return response()->json(['data' => $quote]);
    }

    public function destroy(Request $request, Quote $quote): JsonResponse
    {
        $this->authorizeUser($request, self::MANAGE_ROLES);

        if ($quote->status === 'VALIDE') {
            abort(422, 'Un devis validé ne peut pas être supprimé.');
        }

        $quote->delete();

        return response()->json(['data' => true]);
    }

    public function updateStatus(Request $request, Quote $quote): JsonResponse
    {
        $this->authorizeUser($request, self::STATUS_ROLES);

        $validated = $request->validate([
            'status' => 'required|in:BROUILLON,ENVOYE,VALIDE,ANNULE',
        ]);

        $quote->status = $validated['status'];
        $quote->save();

        $quote->load(['creator', 'zone', 'items.product.unit']);

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
        ];
    }

    /**
     * Crée les lignes et fige les totaux (remise puis taxes sur le HT net),
     * comme pour les ventes POS — sans toucher au stock.
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
