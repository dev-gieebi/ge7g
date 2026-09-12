<?php

namespace App\Http\Controllers;

use App\Models\Unit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class UnitController extends Controller
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

        $query = Unit::query();

        if ($request->boolean('with_trashed')) {
            $query->withTrashed();
        }

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('symbol', 'like', "%{$search}%");
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
            'symbol' => 'required|string|max:50|unique:units,symbol',
        ]);

        $unit = Unit::create($validated);

        return response()->json(['data' => $unit], 201);
    }

    public function show(Request $request, Unit $unit): JsonResponse
    {
        $this->authorizeUser($request);

        return response()->json(['data' => $unit]);
    }

    public function update(Request $request, Unit $unit): JsonResponse
    {
        $this->authorizeUser($request);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'symbol' => ['required', 'string', 'max:50', Rule::unique('units', 'symbol')->ignore($unit->id)],
        ]);

        $unit->update($validated);

        return response()->json(['data' => $unit]);
    }

    public function destroy(Request $request, Unit $unit): Response
    {
        $this->authorizeUser($request);

        $unit->delete();

        return response()->noContent();
    }
}
