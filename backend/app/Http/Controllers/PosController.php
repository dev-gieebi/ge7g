<?php

namespace App\Http\Controllers;

use App\Models\PosSale;
use App\Models\PosSaleItem;
use App\Models\Price;
use App\Models\Product;
use App\Models\StockMovement;
use App\Models\Tax;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PosController extends Controller
{
    private const POS_ROLES = ['AG_LOGISTIQUE', 'DIRECTION', 'SUPERADMIN', 'CAISSIER'];

    private function authorizeUser(Request $request): \App\Models\User
    {
        /** @var \App\Models\User $user */
        $user = $request->user();

        if (! in_array($user->role, self::POS_ROLES, true)) {
            abort(403, 'Accès réservé.');
        }

        return $user;
    }

    public function products(Request $request): JsonResponse
    {
        $this->authorizeUser($request);

        $query = Product::query()
            ->with(['category', 'unit'])
            ->join('prices', function ($join) {
                $join->on('prices.product_id', '=', 'products.id')
                    ->where('prices.for_pos', '=', true)
                    ->whereNull('prices.deleted_at');
            })
            ->select('products.*')
            ->addSelect(DB::raw('prices.amount as pos_price'));

        if ($request->has('category_id') && $request->input('category_id') !== '') {
            $query->where('products.category_id', (int) $request->input('category_id'));
        }

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('products.name', 'like', "%{$search}%")
                    ->orWhere('products.reference', 'like', "%{$search}%");
            });
        }

        $perPage = (int) $request->input('per_page', 200);
        $paginator = $query->paginate($perPage);

        $items = $paginator->items();

        foreach ($items as $item) {
            if ($item->pos_price !== null) {
                $item->sale_price = (float) $item->pos_price;
            }
        }

        return response()->json([
            'data' => $items,
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

    public function index(Request $request): JsonResponse
    {
        $this->authorizeUser($request);

        $query = PosSale::query()->with(['cashier', 'items.product.unit']);

        if ($request->has('payment_method') && $request->input('payment_method') !== '') {
            $query->where('payment_method', $request->input('payment_method'));
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

    public function store(Request $request): JsonResponse
    {
        $user = $this->authorizeUser($request);

        $validated = $request->validate([
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|integer|exists:products,id',
            'items.*.quantity' => 'required|numeric|min:0.01',
            'tax_ids' => 'nullable|array',
            'tax_ids.*' => 'integer|exists:taxes,id',
            'payment_method' => 'required|in:ESPECES,CARTE,VIREMENT,MOBILE_MONEY,AUTRE',
            'customer_name' => 'nullable|string|max:120',
            'amount_received' => 'nullable|numeric|min:0',
        ]);

        $taxIds = ! empty($validated['tax_ids']) ? $validated['tax_ids'] : [];
        $taxes = $taxIds ? Tax::whereIn('id', $taxIds)->get() : Tax::where('is_default', true)->get();
        if ($taxes->isEmpty()) {
            $taxes = collect([new Tax(['type' => 'AUCUNE', 'rate' => 0])]);
        }

        $taxRate = (float) $taxes->sum('rate');
        $taxType = $taxRate > 0 ? $taxes->pluck('type')->implode(' + ') : 'AUCUNE';

        $productIds = array_column($validated['items'], 'product_id');
        $prices = $this->g7gPrices($productIds);

        $sale = DB::transaction(function () use ($validated, $user, $taxes, $taxRate, $taxType, $prices) {
            $sale = PosSale::create([
                'number' => (string) Str::uuid(),
                'user_id' => $user->id,
                'customer_name' => $validated['customer_name'] ?? null,
                'subtotal' => 0,
                'tax_type' => $taxType,
                'tax_rate' => $taxRate / 100,
                'tax_amount' => 0,
                'total' => 0,
                'payment_method' => $validated['payment_method'],
                'amount_received' => $validated['amount_received'] ?? null,
                'status' => 'PAYEE',
            ]);

            $subtotal = 0.0;

            foreach ($validated['items'] as $input) {
                $product = Product::lockForUpdate()->findOrFail($input['product_id']);
                $qty = (float) $input['quantity'];
                $available = (float) $product->stock_quantity - (float) $product->reserved_quantity;

                if ($qty > $available) {
                    throw new \InvalidArgumentException('Stock insuffisant pour ' . $product->name . '.');
                }

                $g7gPrice = $prices->get($product->id);
                $unitPrice = $g7gPrice && (float) $g7gPrice->amount > 0 ? (float) $g7gPrice->amount : (float) $product->sale_price;
                $lineTotal = round($qty * $unitPrice, 4);

                PosSaleItem::create([
                    'pos_sale_id' => $sale->id,
                    'product_id' => $product->id,
                    'quantity' => $qty,
                    'unit_price' => $unitPrice,
                    'total' => $lineTotal,
                ]);

                $newStock = (float) $product->stock_quantity - $qty;
                $product->stock_quantity = $newStock;
                $product->save();

                StockMovement::create([
                    'product_id' => $product->id,
                    'type' => 'VENTE',
                    'quantity' => -$qty,
                    'balance_after' => $newStock,
                    'reference_type' => 'PosSale',
                    'reference_id' => $sale->id,
                    'reference_number' => $sale->number,
                    'note' => 'Vente comptoir',
                    'user_id' => $user->id,
                ]);

                $subtotal += $lineTotal;
            }

            $taxAmount = $taxRate > 0 ? round($subtotal * ($taxRate / 100)) : 0;
            $total = $subtotal + $taxAmount;

            $sale->subtotal = $subtotal;
            $sale->tax_amount = $taxAmount;
            $sale->total = $total;
            $sale->number = 'VNT-' . now()->format('Y') . '-' . str_pad((string) $sale->id, 5, '0', STR_PAD_LEFT);
            $sale->save();

            return $sale;
        });

        $sale->load(['cashier', 'items.product.unit']);

        return response()->json(['data' => $sale], 201);
    }

    public function show(Request $request, PosSale $sale): JsonResponse
    {
        $this->authorizeUser($request);

        $sale->load(['cashier', 'items.product.unit']);

        return response()->json(['data' => $sale]);
    }

    private function g7gPrices(array|\Illuminate\Support\Collection $productIds): \Illuminate\Support\Collection
    {
        return Price::whereIn('product_id', $productIds)
            ->where(fn ($q) => $q->where('for_pos', true)->orWhereNull('zone_id'))
            ->get()
            ->sortByDesc(fn ($p) => (int) $p->for_pos)
            ->unique('product_id')
            ->keyBy('product_id');
    }
}
