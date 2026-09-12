<?php

namespace App\Http\Controllers;

use App\Models\Zone;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;

class ZoneController extends Controller
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

        $query = Zone::query();

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
            'code' => 'required|string|max:50|unique:zones,code',
        ]);

        $zone = Zone::create($validated);

        return response()->json(['data' => $zone], 201);
    }

    public function show(Request $request, Zone $zone): JsonResponse
    {
        $this->authorizeUser($request);

        return response()->json(['data' => $zone]);
    }

    public function update(Request $request, Zone $zone): JsonResponse
    {
        $this->authorizeUser($request);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'code' => ['required', 'string', 'max:50', Rule::unique('zones', 'code')->ignore($zone->id)],
        ]);

        $zone->update($validated);

        return response()->json(['data' => $zone]);
    }

    public function destroy(Request $request, Zone $zone): Response
    {
        $this->authorizeUser($request);

        $zone->delete();

        return response()->noContent();
    }
}
