<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    private const MANAGE_ROLES = ['ADMIN', 'DIRECTION', 'SUPERADMIN'];

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
                    ->orWhere('email', 'like', "%{$search}%")
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
            'email' => 'required|string|email|max:255|unique:users,email',
            'role' => 'required|string|in:ADMIN,CAISSIER,DIRECTION,SUPERADMIN',
        ]);

        $code = $this->generateUniqueCode();

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'code' => $code,
            'role' => $validated['role'],
            'password' => 'Password123',
            'permissions' => [],
            'is_admin' => in_array($validated['role'], ['ADMIN', 'SUPERADMIN'], true),
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
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'role' => 'required|string|in:ADMIN,CAISSIER,DIRECTION,SUPERADMIN',
            'permissions' => 'sometimes|array',
        ]);

        $user->update([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'role' => $validated['role'],
            'permissions' => $validated['permissions'] ?? $user->permissions,
            'is_admin' => in_array($validated['role'], ['ADMIN', 'SUPERADMIN'], true),
        ]);

        return response()->json(['data' => $user]);
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
