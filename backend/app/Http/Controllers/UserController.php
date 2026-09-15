<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
class UserController extends Controller
{
    private const MANAGE_ROLES = ['SUPERADMIN'];

    private function authorizeUser(Request $request): User
    {
        /** @var User $user */
        $user = $request->user();

        if (! in_array($user->role, self::MANAGE_ROLES, true)) {
            abort(403, 'Accès réservé.');
        }

        return $user;
    }

    public function index(Request $request): JsonResponse
    {
        $this->authorizeUser($request);

        $query = User::query();

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('code', 'like', "%{$search}%");
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
            'role' => 'required|string|in:AG_LOGISTIQUE,CAISSIER,DIRECTION,SUPERADMIN',
        ]);

        $code = $this->generateUniqueCode();

        $user = User::create([
            'name' => $validated['name'],
            'code' => $code,
            'role' => $validated['role'],
            'password' => 'Password123',
            'permissions' => [],
            'is_admin' => in_array($validated['role'], ['AG_LOGISTIQUE', 'SUPERADMIN'], true),
        ]);

        return response()->json(['data' => $user], 201);
    }

    public function show(Request $request, User $user): JsonResponse
    {
        $this->authorizeUser($request);

        return response()->json(['data' => $user]);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $this->authorizeUser($request);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'role' => 'required|string|in:AG_LOGISTIQUE,CAISSIER,DIRECTION,SUPERADMIN',
            'permissions' => 'sometimes|array',
        ]);

        $user->update([
            'name' => $validated['name'],
            'role' => $validated['role'],
            'permissions' => $validated['permissions'] ?? $user->permissions,
            'is_admin' => in_array($validated['role'], ['AG_LOGISTIQUE', 'SUPERADMIN'], true),
        ]);

        return response()->json(['data' => $user]);
    }

    public function updatePassword(Request $request, User $user): JsonResponse
    {
        $this->authorizeUser($request);

        $validated = $request->validate([
            'password' => 'required|string|min:6',
        ]);

        $user->password = $validated['password'];
        $user->save();

        return response()->json(['message' => 'Mot de passe mis à jour.']);
    }

    public function destroy(Request $request, User $user): Response
    {
        $this->authorizeUser($request);

        $user->delete();

        return response()->noContent();
    }

    private function generateUniqueCode(): string
    {
        do {
            $code = (string) random_int(10000000, 99999999);
        } while (User::where('code', $code)->exists());

        return $code;
    }
}
