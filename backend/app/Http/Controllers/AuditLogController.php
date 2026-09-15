<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    private const ROLES = ['ADMIN', 'DIRECTION', 'SUPERADMIN'];

    private function authorizeUser(Request $request): \App\Models\User
    {
        /** @var \App\Models\User $user */
        $user = $request->user();

        if (! in_array($user->role, self::ROLES, true)) {
            abort(403, 'Accès réservé.');
        }

        return $user;
    }

    public function index(Request $request): JsonResponse
    {
        $this->authorizeUser($request);

        $query = AuditLog::query()->with(['user:id,name']);

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('action', 'like', "%{$search}%")
                    ->orWhere('subject_type', 'like', "%{$search}%")
                    ->orWhere('subject_label', 'like', "%{$search}%")
                    ->orWhereHas('user', function ($uq) use ($search) {
                        $uq->where('name', 'like', "%{$search}%");
                    });
            });
        }

        if ($request->has('action') && $request->input('action') !== '') {
            $query->where('action', $request->input('action'));
        }

        if ($request->has('subject_type') && $request->input('subject_type') !== '') {
            $query->where('subject_type', $request->input('subject_type'));
        }

        if ($request->has('user_id') && $request->input('user_id') !== '') {
            $query->where('user_id', (int) $request->input('user_id'));
        }

        $sort = $request->input('sort') ?? 'created_at';
        $direction = $request->input('dir') === 'asc' ? 'asc' : 'desc';
        $query->orderBy($sort, $direction);

        $perPage = (int) $request->input('per_page', 30);
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
}
