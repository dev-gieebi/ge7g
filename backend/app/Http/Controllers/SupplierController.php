<?php

namespace App\Http\Controllers;

use App\Models\Supplier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class SupplierController extends Controller
{
    private const MANAGE_ROLES = ['AG_LOGISTIQUE', 'DIRECTION', 'SUPERADMIN'];

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

        $query = Supplier::query();

        if ($request->boolean('with_trashed')) {
            $query->withTrashed();
        }

        if ($request->has('status')) {
            $query->where('is_active', $request->input('status') === 'ACTIF');
        } elseif ($request->has('active')) {
            $query->where('is_active', (bool) $request->input('active'));
        }

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('contact_name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
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
            'name' => 'required|string|max:255',
            'contact_name' => 'nullable|string|max:255',
            'email' => 'nullable|string|email|max:255',
            'phone' => 'nullable|string|max:50',
            'address' => 'nullable|string|max:1000',
            'status' => 'sometimes|string|in:ACTIF,INACTIF',
        ]);

        $supplier = Supplier::create([
            ...$validated,
            'is_active' => ($validated['status'] ?? 'ACTIF') === 'ACTIF',
        ]);

        return response()->json(['data' => $supplier], 201);
    }

    public function show(Request $request, Supplier $supplier): JsonResponse
    {
        $this->authorizeUser($request);

        return response()->json(['data' => $supplier]);
    }

    public function update(Request $request, Supplier $supplier): JsonResponse
    {
        $this->authorizeUser($request);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'contact_name' => 'nullable|string|max:255',
            'email' => 'nullable|string|email|max:255',
            'phone' => 'nullable|string|max:50',
            'address' => 'nullable|string|max:1000',
            'status' => 'sometimes|string|in:ACTIF,INACTIF',
        ]);

        $supplier->update([
            ...$validated,
            'is_active' => ($validated['status'] ?? ($supplier->is_active ? 'ACTIF' : 'INACTIF')) === 'ACTIF',
        ]);

        return response()->json(['data' => $supplier]);
    }

    public function destroy(Request $request, Supplier $supplier): Response
    {
        $this->authorizeUser($request);

        $supplier->delete();

        return response()->noContent();
    }

    public function restore(Request $request, int $id): JsonResponse
    {
        $this->authorizeUser($request);

        $supplier = Supplier::withTrashed()->findOrFail($id);

        if (! $supplier->trashed()) {
            return response()->json(['message' => 'Le fournisseur est déjà actif.'], 422);
        }

        $supplier->restore();

        return response()->json(['data' => $supplier]);
    }

    public function toggle(Request $request, Supplier $supplier): JsonResponse
    {
        $this->authorizeUser($request);

        $supplier->update(['is_active' => ! $supplier->is_active]);

        return response()->json(['data' => $supplier]);
    }
}
