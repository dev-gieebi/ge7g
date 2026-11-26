<?php

namespace App\Http\Controllers;

use App\Models\Inventaire;
use App\Models\InventaireLigne;
use App\Models\Product;
use App\Models\User;
use App\Services\NumerotationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Inventaires physiques du magasin : on saisit les quantités comptées
 * (brouillon modifiable), puis la validation fige, pour chaque article, le
 * stock théorique du moment et l'écart constaté. Le dernier comptage validé
 * alimente « Stock réel » et « Écart » dans l'état du stock.
 * Direction, Super admin et approvisionneur.
 */
class InventaireController extends Controller
{
    private const MANAGE_ROLES = [...DashboardController::FINANCE_ROLES, 'CDG_ADMIN'];

    public function __construct(private NumerotationService $numerotation) {}

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

        $query = Inventaire::query()
            ->with(['user:id,name', 'validePar:id,name'])
            ->withCount([
                'lignes',
                'lignes as ecarts_count' => fn ($q) => $q->whereNotNull('ecart')->where('ecart', '!=', 0),
            ])
            ->latest('id');

        if ($statut = $request->input('statut')) {
            $query->where('statut', $statut);
        }

        if ($search = $request->input('search')) {
            $query->where(fn ($q) => $q->where('numero', 'like', "%{$search}%")->orWhere('notes', 'like', "%{$search}%"));
        }

        $paginator = $query->paginate((int) $request->input('per_page', 20));

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

    public function show(Request $request, Inventaire $inventaire): JsonResponse
    {
        $this->authorizeUser($request);

        return response()->json(['data' => $this->detail($inventaire)]);
    }

    /** Nouvel inventaire en brouillon, avec les premiers comptages éventuels. */
    public function store(Request $request): JsonResponse
    {
        $user = $this->authorizeUser($request);
        $data = $this->validateLignes($request);

        $inventaire = DB::transaction(function () use ($data, $user) {
            $inventaire = Inventaire::create([
                'numero' => $this->numerotation->next('INV'),
                'statut' => Inventaire::BROUILLON,
                'notes' => $data['notes'] ?? null,
                'user_id' => $user->id,
            ]);
            $this->remplacerLignes($inventaire, $data['lignes']);

            return $inventaire;
        });

        return response()->json(['data' => $this->detail($inventaire)], 201);
    }

    /** Mise à jour des comptages d'un inventaire encore en brouillon. */
    public function update(Request $request, Inventaire $inventaire): JsonResponse
    {
        $this->authorizeUser($request);
        $this->exigerBrouillon($inventaire);
        $data = $this->validateLignes($request);

        DB::transaction(function () use ($inventaire, $data) {
            $inventaire->update(['notes' => $data['notes'] ?? null]);
            $this->remplacerLignes($inventaire, $data['lignes']);
        });

        return response()->json(['data' => $this->detail($inventaire)]);
    }

    /**
     * Validation : fige le stock théorique et l'écart de chaque ligne, et
     * enregistre le comptage sur l'article (stock réel de l'état du stock).
     * Le stock théorique n'est pas modifié.
     */
    public function valider(Request $request, Inventaire $inventaire): JsonResponse
    {
        $user = $this->authorizeUser($request);
        $this->exigerBrouillon($inventaire);

        if (! $inventaire->lignes()->exists()) {
            abort(422, 'Saisissez au moins un comptage avant de valider l\'inventaire.');
        }

        DB::transaction(function () use ($inventaire, $user) {
            $lignes = $inventaire->lignes()->get();
            $produits = Product::query()->whereKey($lignes->pluck('product_id'))->lockForUpdate()->get()->keyBy('id');
            $maintenant = now();

            foreach ($lignes as $ligne) {
                $produit = $produits->get($ligne->product_id);
                $theorique = round((float) $produit->stock_quantity, 4);
                $compte = round((float) $ligne->stock_compte, 4);

                $ligne->update(['stock_theorique' => $theorique, 'ecart' => round($compte - $theorique, 4)]);
                $produit->update(['physical_stock' => $compte, 'physical_stock_at' => $maintenant]);
            }

            $inventaire->update([
                'statut' => Inventaire::VALIDE,
                'valide_par' => $user->id,
                'valide_le' => $maintenant,
            ]);
        });

        return response()->json(['data' => $this->detail($inventaire->refresh())]);
    }

    public function destroy(Request $request, Inventaire $inventaire): JsonResponse
    {
        $this->authorizeUser($request);
        $this->exigerBrouillon($inventaire);

        $inventaire->delete();

        return response()->json(null, 204);
    }

    private function exigerBrouillon(Inventaire $inventaire): void
    {
        if (! $inventaire->estBrouillon()) {
            abort(422, 'Cet inventaire est validé : il ne peut plus être modifié.');
        }
    }

    /**
     * @return array{notes?: string|null, lignes: list<array{product_id: int, stock_compte: numeric}>}
     */
    private function validateLignes(Request $request): array
    {
        return $request->validate([
            'notes' => 'nullable|string|max:2000',
            'lignes' => 'present|array',
            'lignes.*.product_id' => 'required|integer|distinct|exists:products,id',
            'lignes.*.stock_compte' => 'required|numeric|min:0',
        ], [
            'lignes.*.stock_compte.min' => 'La quantité comptée ne peut pas être négative.',
        ]);
    }

    /** @param  list<array{product_id: int, stock_compte: numeric}>  $lignes */
    private function remplacerLignes(Inventaire $inventaire, array $lignes): void
    {
        $inventaire->lignes()->delete();

        foreach ($lignes as $ligne) {
            InventaireLigne::create([
                'inventaire_id' => $inventaire->id,
                'product_id' => $ligne['product_id'],
                'stock_compte' => $ligne['stock_compte'],
            ]);
        }
    }

    /**
     * Inventaire et ses lignes : en brouillon, le stock théorique affiché est
     * le stock actuel de l'article ; une fois validé, celui figé au comptage.
     *
     * @return array<string, mixed>
     */
    private function detail(Inventaire $inventaire): array
    {
        $inventaire->load(['user:id,name', 'validePar:id,name', 'lignes.product.unit']);

        $lignes = $inventaire->lignes
            ->map(function (InventaireLigne $l) use ($inventaire) {
                $p = $l->product;
                $compte = round((float) $l->stock_compte, 2);
                $theorique = $inventaire->estBrouillon()
                    ? round((float) $p->stock_quantity, 2)
                    : round((float) $l->stock_theorique, 2);

                return [
                    'product_id' => $l->product_id,
                    'reference' => $p->reference,
                    'designation' => $p->name.($p->type ? ' · '.$p->type : ''),
                    'unit' => $p->unit?->symbol,
                    'stock_compte' => $compte,
                    'stock_theorique' => $theorique,
                    'ecart' => round($compte - $theorique, 2),
                ];
            })
            ->sortBy('reference')
            ->values();

        return [
            'id' => $inventaire->id,
            'numero' => $inventaire->numero,
            'statut' => $inventaire->statut,
            'notes' => $inventaire->notes,
            'user' => $inventaire->user,
            'valide_par' => $inventaire->validePar,
            'valide_le' => $inventaire->valide_le?->toIso8601String(),
            'created_at' => $inventaire->created_at?->toIso8601String(),
            'updated_at' => $inventaire->updated_at?->toIso8601String(),
            'lignes' => $lignes,
        ];
    }
}
