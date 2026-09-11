<?php

namespace App\Http\Controllers;

use App\Models\Price;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\ValidationException;

class PriceController extends Controller
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

    public function index(Request $request): JsonResponse
    {
        $this->authorizeUser($request);

        $query = Price::query()->with(['product', 'zone']);

        if ($request->boolean('with_trashed')) {
            $query->withTrashed();
        }

        if ($request->has('product_id') && $request->input('product_id') !== '') {
            $query->where('product_id', (int) $request->input('product_id'));
        }

        if ($request->has('zone_id') && $request->input('zone_id') !== '') {
            $query->where('zone_id', $request->input('zone_id') ? (int) $request->input('zone_id') : null);
        }

        if ($request->has('for_pos') && $request->input('for_pos') !== '') {
            $query->where('for_pos', $request->boolean('for_pos'));
        }

        if ($search = $request->input('search')) {
            $query->whereHas('product', function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('reference', 'like', "%{$search}%");
            });
        }

        if ($sort = $request->input('sort')) {
            $direction = $request->input('dir') === 'desc' ? 'desc' : 'asc';
            $query->orderBy($sort, $direction);
        } else {
            $query->orderBy('id');
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
            'product_id' => 'required|integer|exists:products,id',
            'zone_id' => 'nullable|integer|exists:zones,id',
            'competitor_price' => 'sometimes|numeric|min:0',
            'amount' => 'sometimes|numeric|min:0',
            'factory_price' => 'sometimes|numeric|min:0',
            'for_pos' => 'sometimes|boolean',
        ]);

        if ($this->duplicateForZoneExists((int) $validated['product_id'], $validated['zone_id'] ?? null)) {
            throw ValidationException::withMessages(['zone_id' => 'Un barème existe déjà pour ce produit et cette ville. Modifiez-le au lieu d\'en créer un nouveau.']);
        }

        $forPos = (bool) ($validated['for_pos'] ?? false);
        if ($forPos && $this->duplicateForPosExists((int) $validated['product_id'])) {
            throw ValidationException::withMessages(['for_pos' => 'Un barème caisse existe déjà pour ce produit. Modifiez-le au lieu d\'en créer un nouveau.']);
        }

        $price = Price::create([
            'product_id' => $validated['product_id'],
            'zone_id' => $validated['zone_id'] ?? null,
            'competitor_price' => (float) ($validated['competitor_price'] ?? 0),
            'amount' => (float) ($validated['amount'] ?? 0),
            'factory_price' => (float) ($validated['factory_price'] ?? 0),
            'for_pos' => (bool) ($validated['for_pos'] ?? false),
        ]);

        $price->load(['product', 'zone']);

        return response()->json(['data' => $price], 201);
    }

    public function show(Request $request, Price $price): JsonResponse
    {
        $this->authorizeUser($request);

        $price->load(['product', 'zone']);

        return response()->json(['data' => $price]);
    }

    public function update(Request $request, Price $price): JsonResponse
    {
        $this->authorizeUser($request);

        $validated = $request->validate([
            'product_id' => 'sometimes|integer|exists:products,id',
            'zone_id' => 'sometimes|integer|exists:zones,id|nullable',
            'competitor_price' => 'sometimes|numeric|min:0',
            'amount' => 'sometimes|numeric|min:0',
            'factory_price' => 'sometimes|numeric|min:0',
            'for_pos' => 'sometimes|boolean',
        ]);

        $newProductId = $validated['product_id'] ?? $price->product_id;
        $newZoneId = array_key_exists('zone_id', $validated) ? $validated['zone_id'] : $price->zone_id;
        $newForPos = array_key_exists('for_pos', $validated) ? (bool) $validated['for_pos'] : $price->for_pos;

        if ($newProductId != $price->product_id || $newZoneId !== $price->zone_id) {
            if ($this->duplicateForZoneExists((int) $newProductId, $newZoneId, $price->id)) {
                throw ValidationException::withMessages(['zone_id' => 'Un barème existe déjà pour ce produit et cette ville. Modifiez-le au lieu d\'en créer un nouveau.']);
            }
        }

        if ($newForPos && ($newProductId != $price->product_id || ! $price->for_pos)) {
            if ($this->duplicateForPosExists((int) $newProductId, $price->id)) {
                throw ValidationException::withMessages(['for_pos' => 'Un barème caisse existe déjà pour ce produit. Modifiez-le au lieu d\'en créer un nouveau.']);
            }
        }

        $price->update([
            'product_id' => $validated['product_id'] ?? $price->product_id,
            'zone_id' => array_key_exists('zone_id', $validated) ? $validated['zone_id'] : $price->zone_id,
            'competitor_price' => (float) ($validated['competitor_price'] ?? $price->competitor_price),
            'amount' => (float) ($validated['amount'] ?? $price->amount),
            'factory_price' => (float) ($validated['factory_price'] ?? $price->factory_price),
            'for_pos' => array_key_exists('for_pos', $validated) ? (bool) $validated['for_pos'] : $price->for_pos,
        ]);

        $price->load(['product', 'zone']);

        return response()->json(['data' => $price]);
    }

    public function destroy(Request $request, Price $price): Response
    {
        $this->authorizeUser($request);

        $price->delete();

        return response()->noContent();
    }

    private function duplicateForZoneExists(int $productId, ?int $zoneId, ?int $exclude = null): bool
    {
        $query = Price::where('product_id', $productId)
            ->when($zoneId, fn ($q) => $q->where('zone_id', $zoneId), fn ($q) => $q->whereNull('zone_id'));

        if ($exclude) {
            $query->where('id', '!=', $exclude);
        }

        return $query->exists();
    }

    private function duplicateForPosExists(int $productId, ?int $exclude = null): bool
    {
        $query = Price::where('product_id', $productId)->where('for_pos', true);

        if ($exclude) {
            $query->where('id', '!=', $exclude);
        }

        return $query->exists();
    }
}
