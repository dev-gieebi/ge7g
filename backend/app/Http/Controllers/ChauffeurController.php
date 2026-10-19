<?php

namespace App\Http\Controllers;

use App\Enums\StatutCommande;
use App\Models\Commande;
use App\Models\Driver;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

/**
 * Gestion des chauffeurs : la fiche métier (permis, disponibilité) est
 * liée à un compte utilisateur au rôle CHAUFFEUR — créé automatiquement à
 * l'enregistrement pour que le chauffeur se connecte sur la plateforme
 * et suive ses livraisons.
 */
class ChauffeurController extends Controller
{
    /** Consultation des fiches et des listes d'affectation. */
    private const VIEW_ROLES = ['LG_ADMIN', 'DG_ADMIN', 'CDG_ADMIN', 'SUPERADMIN'];

    /** Création et modification des chauffeurs. */
    private const MANAGE_ROLES = ['LG_ADMIN', 'DG_ADMIN', 'SUPERADMIN'];

    private function authorizeUser(Request $request, array $roles): User
    {
        /** @var User $user */
        $user = $request->user();

        if (! in_array($user->role, $roles, true)) {
            abort(403, 'Accès réservé.');
        }

        return $user;
    }

    public function index(Request $request): JsonResponse
    {
        $this->authorizeUser($request, self::VIEW_ROLES);

        $query = Driver::query()->with('user:id,code,role')->orderBy('name');

        if ($search = $request->input('search')) {
            $query->where(fn ($q) => $q
                ->where('name', 'like', "%{$search}%")
                ->orWhere('phone', 'like', "%{$search}%")
                ->orWhere('license_number', 'like', "%{$search}%"));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        $paginator = $query->paginate(min((int) $request->input('per_page', 20), 500));

        return response()->json([
            'data' => collect($paginator->items())->map(fn (Driver $d) => $this->present($d)),
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

    public function show(Request $request, Driver $driver): JsonResponse
    {
        $this->authorizeUser($request, self::VIEW_ROLES);

        return response()->json(['data' => $this->present($driver->load('user:id,code,role'))]);
    }

    /**
     * Enregistre le chauffeur ET son compte plateforme (rôle CHAUFFEUR)
     * dans une seule transaction — le code de connexion à 8 chiffres est
     * renvoyé dans `compte` pour être communiqué au chauffeur.
     */
    public function store(Request $request): JsonResponse
    {
        $this->authorizeUser($request, self::MANAGE_ROLES);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'phone' => 'required|string|max:30',
            'license_number' => 'nullable|string|max:50',
            'status' => 'nullable|in:'.implode(',', Driver::STATUTS),
            'password' => 'required|string|min:8',
        ]);

        [$driver, $user] = DB::transaction(function () use ($validated) {
            $driver = Driver::create([
                'name' => $validated['name'],
                'phone' => $validated['phone'],
                'license_number' => $validated['license_number'] ?? null,
                'status' => $validated['status'] ?? 'DISPONIBLE',
            ]);

            $user = User::create([
                'name' => $validated['name'],
                'phone' => $validated['phone'],
                'code' => $this->generateUniqueCode(),
                'role' => 'CHAUFFEUR',
                'permissions' => [],
                'password' => $validated['password'],
                'is_admin' => false,
                'driver_id' => $driver->id,
            ]);

            $driver->user_id = $user->id;
            $driver->save();

            return [$driver, $user];
        });

        return response()->json([
            'data' => $this->present($driver->load('user:id,code,role')),
            'compte' => ['code' => $user->code],
        ], 201);
    }

    /**
     * Met à jour la fiche (et le compte lié : nom, téléphone, mot de passe
     * si fourni). Aucun doublon de compte n'est créé.
     */
    public function update(Request $request, Driver $driver): JsonResponse
    {
        $this->authorizeUser($request, self::MANAGE_ROLES);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'phone' => 'required|string|max:30',
            'license_number' => 'nullable|string|max:50',
            'status' => 'required|in:'.implode(',', Driver::STATUTS),
            'password' => 'nullable|string|min:8',
        ]);

        DB::transaction(function () use ($driver, $validated) {
            $driver->update([
                'name' => $validated['name'],
                'phone' => $validated['phone'],
                'license_number' => $validated['license_number'] ?? null,
                'status' => $validated['status'],
            ]);

            if ($user = $driver->user) {
                $user->name = $validated['name'];
                $user->phone = $validated['phone'];
                if (! empty($validated['password'])) {
                    $user->password = $validated['password'];
                }
                $user->save();
            }
        });

        return response()->json(['data' => $this->present($driver->load('user:id,code,role'))]);
    }

    /**
     * Supprime la fiche et le compte plateforme lié. Les commandes déjà
     * affectées conservent l'historique (chauffeur_id passe à null via la
     * contrainte nullOnDelete) ; une livraison en cours bloque la
     * suppression.
     */
    public function destroy(Request $request, Driver $driver): Response
    {
        $this->authorizeUser($request, self::MANAGE_ROLES);

        if ($driver->user_id) {
            $livraisonEnCours = Commande::where('chauffeur_id', $driver->user_id)
                ->where('statut', StatutCommande::EnLivraison)
                ->exists();

            if ($livraisonEnCours) {
                abort(422, 'Ce chauffeur a une livraison en cours — terminez-la ou réaffectez-la avant de le supprimer.');
            }
        }

        DB::transaction(function () use ($driver) {
            $driver->user?->delete();
            $driver->delete();
        });

        return response()->noContent();
    }

    /** @return array<string, mixed> */
    private function present(Driver $driver): array
    {
        return [
            'id' => $driver->id,
            'user_id' => $driver->user_id,
            'name' => $driver->name,
            'phone' => $driver->phone,
            'license_number' => $driver->license_number,
            'status' => $driver->status,
            'code' => $driver->user?->code,
        ];
    }

    private function generateUniqueCode(): string
    {
        do {
            $code = (string) random_int(10000000, 99999999);
        } while (User::where('code', $code)->exists());

        return $code;
    }
}
