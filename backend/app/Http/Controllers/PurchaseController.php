<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\Purchase;
use App\Models\PurchaseItem;
use App\Models\StockMovement;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PurchaseController extends Controller
{
    private const MANAGE_ROLES = ['ADMIN', 'DIRECTION', 'SUPERADMIN'];

    private function authorizeUser(Request $request): \App\Models\User
    {
        /** @var \App\Models\User $user */
        $user = $request->user();

        if (! in_array($user->role, self::MANAGE_ROLES, true)) {
            abort(403, 'Accès réservé.');
        }

        return $user;
    }

    private const VALID_STATUSES = ['BROUILLON', 'COMMANDE', 'RECU_PARTIEL', 'RECU', 'ANNULE'];

    private function allowedStatus(?string $status): string
    {
        return in_array($status, self::VALID_STATUSES, true) ? $status : 'COMMANDE';
    }

    public function index(Request $request): JsonResponse
    {
        $this->authorizeUser($request);

        $query = Purchase::query()->with(['supplier', 'items.product.unit']);

        if ($request->has('supplier_id') && $request->input('supplier_id') !== '') {
            $query->where('supplier_id', (int) $request->input('supplier_id'));
        }

        if ($request->has('status') && $request->input('status') !== '') {
            $query->where('status', $request->input('status'));
        }

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('number', 'like', "%{$search}%")
                    ->orWhereHas('supplier', function ($sq) use ($search) {
                        $sq->where('name', 'like', "%{$search}%");
                    });
            });
        }

        if ($sort = $request->input('sort')) {
            $direction = $request->input('dir') === 'desc' ? 'desc' : 'asc';
            $query->orderBy($sort, $direction);
        } else {
            $query->orderByDesc('id');
        }

        $perPage = (int) $request->input('per_page', 20);
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
        $this->authorizeUser($request);

        $validated = $request->validate([
            'supplier_id' => 'required|integer|exists:suppliers,id',
            'date' => 'required|date',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|integer|exists:products,id',
            'items.*.quantity' => 'required|numeric|min:0.01',
            'items.*.unit_price' => 'required|numeric|min:0',
        ]);

        $purchase = DB::transaction(function () use ($validated) {
            $purchase = Purchase::create([
                'number' => (string) Str::uuid(),
                'supplier_id' => $validated['supplier_id'],
                'date' => $validated['date'],
                'status' => 'COMMANDE',
                'total' => 0,
            ]);

            $total = $this->syncItems($purchase, $validated['items']);
            $purchase->total = $total;
            $purchase->number = 'ACH-' . now()->format('Y') . '-' . str_pad((string) $purchase->id, 5, '0', STR_PAD_LEFT);
            $purchase->save();

            return $purchase;
        });

        $purchase->load(['supplier', 'items.product.unit']);

        return response()->json(['data' => $purchase], 201);
    }

    public function show(Request $request, Purchase $purchase): JsonResponse
    {
        $this->authorizeUser($request);

        $purchase->load(['supplier', 'items.product.unit']);

        return response()->json(['data' => $purchase]);
    }

    public function update(Request $request, Purchase $purchase): JsonResponse
    {
        $this->authorizeUser($request);

        if (! in_array($purchase->status, ['BROUILLON', 'COMMANDE'], true)) {
            return response()->json(['message' => 'Modification impossible une fois la réception commencée.'], 422);
        }

        $validated = $request->validate([
            'supplier_id' => 'sometimes|integer|exists:suppliers,id',
            'date' => 'sometimes|date',
            'items' => 'sometimes|array|min:1',
            'items.*.product_id' => 'required_with:items|integer|exists:products,id',
            'items.*.quantity' => 'required_with:items|numeric|min:0.01',
            'items.*.unit_price' => 'required_with:items|numeric|min:0',
        ]);

        $purchase = DB::transaction(function () use ($purchase, $validated) {
            if (isset($validated['supplier_id'])) {
                $purchase->supplier_id = $validated['supplier_id'];
            }
            if (isset($validated['date'])) {
                $purchase->date = $validated['date'];
            }

            if (! empty($validated['items'])) {
                $purchase->items()->delete();
                $purchase->total = $this->syncItems($purchase, $validated['items']);
            }

            $purchase->save();

            return $purchase;
        });

        $purchase->load(['supplier', 'items.product.unit']);

        return response()->json(['data' => $purchase]);
    }

    public function destroy(Request $request, Purchase $purchase): Response
    {
        $this->authorizeUser($request);

        $purchase->delete();

        return response()->noContent();
    }

    public function receive(Request $request, Purchase $purchase): JsonResponse
    {
        $user = $this->authorizeUser($request);

        if (! in_array($purchase->status, ['COMMANDE', 'RECU_PARTIEL'], true)) {
            return response()->json(['message' => 'Ce bon d\'achat ne peut plus être réceptionné.'], 422);
        }

        $validated = $request->validate([
            'items' => 'required|array|min:1',
            'items.*.item_id' => 'required|integer|exists:purchase_items,id',
            'items.*.quantity' => 'required|numeric|min:0.01',
        ]);

        $purchase = DB::transaction(function () use ($purchase, $validated, $user) {
            $itemIds = array_column($validated['items'], 'item_id');
            $purchase->items()->whereIn('id', $itemIds)->lockForUpdate()->get();

            foreach ($validated['items'] as $input) {
                $item = $purchase->items()->where('id', $input['item_id'])->firstOrFail();
                $remaining = (float) $item->quantity - (float) $item->received_quantity;
                $qty = (float) $input['quantity'];

                if ($qty > $remaining) {
                    throw new \InvalidArgumentException('La quantité reçue dépasse le reste à réceptionner pour ' . $item->product->name . '.');
                }

                $item->received_quantity = (float) $item->received_quantity + $qty;
                $item->save();

                $product = Product::lockForUpdate()->findOrFail($item->product_id);
                $newStock = (float) $product->stock_quantity + $qty;
                $product->stock_quantity = $newStock;
                $product->save();

                StockMovement::create([
                    'product_id' => $product->id,
                    'type' => 'ENTREE',
                    'quantity' => $qty,
                    'balance_after' => $newStock,
                    'reference_type' => 'Purchase',
                    'reference_id' => $purchase->id,
                    'reference_number' => $purchase->number,
                    'note' => 'Réception achat',
                    'user_id' => $user->id,
                ]);
            }

            $allReceived = $purchase->items()->get()->every(function (PurchaseItem $item) {
                return (float) $item->received_quantity >= (float) $item->quantity;
            });

            $anyReceived = $purchase->items()->get()->some(function (PurchaseItem $item) {
                return (float) $item->received_quantity > 0;
            });

            if ($allReceived) {
                $purchase->status = 'RECU';
            } elseif ($anyReceived) {
                $purchase->status = 'RECU_PARTIEL';
            } else {
                $purchase->status = 'COMMANDE';
            }

            $purchase->save();

            return $purchase;
        });

        $purchase->load(['supplier', 'items.product.unit']);

        return response()->json(['data' => $purchase]);
    }

    private function syncItems(Purchase $purchase, array $items): float
    {
        $total = 0.0;

        foreach ($items as $input) {
            $qty = (float) $input['quantity'];
            $price = (float) $input['unit_price'];
            $lineTotal = round($qty * $price, 4);

            PurchaseItem::create([
                'purchase_id' => $purchase->id,
                'product_id' => $input['product_id'],
                'quantity' => $qty,
                'received_quantity' => 0,
                'unit_price' => $price,
                'total' => $lineTotal,
            ]);

            $total += $lineTotal;
        }

        return $total;
    }
}
