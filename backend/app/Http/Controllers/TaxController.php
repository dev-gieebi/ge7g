<?php

namespace App\Http\Controllers;

use App\Models\Tax;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class TaxController extends Controller
{
    private const MANAGE_ROLES = ['ADMIN', 'DIRECTION', 'SUPERADMIN'];
    private const VIEW_ROLES = ['ADMIN', 'DIRECTION', 'SUPERADMIN', 'CAISSIER'];

    private function authorizeUser(Request $request, array $roles = self::MANAGE_ROLES): \App\Models\User
    {
        /** @var \App\Models\User $user */
        $user = $request->user();

        if (! in_array($user->role, $roles, true)) {
            abort(403, 'Accès réservé.');
        }

        return $user;
    }

    public function index(Request $request): JsonResponse
    {
        $this->authorizeUser($request, self::VIEW_ROLES);

        $query = Tax::query();

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('type', 'like', "%{$search}%");
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
            'name' => 'nullable|string|max:255',
            'type' => 'required|string|in:TVA,CSS,TPS',
            'rate' => 'required|numeric|min:0',
            'is_default' => 'sometimes|boolean',
        ]);

        $isDefault = $validated['is_default'] ?? false;

        if ($isDefault) {
            Tax::query()->update(['is_default' => false]);
        }

        $name = ($validated['name'] ?? '') ?: $this->generateTaxName($validated['type'], $validated['rate']);

        $tax = Tax::create([
            'name' => $name,
            'type' => $validated['type'],
            'rate' => $validated['rate'],
            'is_default' => $isDefault,
        ]);

        return response()->json(['data' => $tax], 201);
    }

    public function show(Request $request, Tax $tax): JsonResponse
    {
        $this->authorizeUser($request);

        return response()->json(['data' => $tax]);
    }

    public function update(Request $request, Tax $tax): JsonResponse
    {
        $this->authorizeUser($request);

        $validated = $request->validate([
            'name' => 'nullable|string|max:255',
            'type' => 'required|string|in:TVA,CSS,TPS',
            'rate' => 'required|numeric|min:0',
            'is_default' => 'sometimes|boolean',
        ]);

        $isDefault = $validated['is_default'] ?? $tax->is_default;

        if ($isDefault && ! $tax->is_default) {
            Tax::query()->update(['is_default' => false]);
        }

        $name = ($validated['name'] ?? '') ?: $this->generateTaxName($validated['type'], $validated['rate']);

        $tax->update([
            'name' => $name,
            'type' => $validated['type'],
            'rate' => $validated['rate'],
            'is_default' => $isDefault,
        ]);

        return response()->json(['data' => $tax]);
    }

    public function destroy(Request $request, Tax $tax): Response
    {
        $this->authorizeUser($request);

        $tax->delete();

        return response()->noContent();
    }

    private function generateTaxName(string $type, float $rate): string
    {
        return $type;
    }
}
