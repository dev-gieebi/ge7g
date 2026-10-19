<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreCommandeRequest;
use App\Http\Resources\PublicProduitResource;
use App\Http\Resources\SuiviCommandeResource;
use App\Models\Category;
use App\Models\Commande;
use App\Models\Product;
use App\Models\Zone;
use App\Services\CommandeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * API publique de la boutique — aucune authentification. Ne renvoie jamais
 * les prix d'achat, les marges, le stock exact ni les données d'autres
 * clients (voir les ressources dédiées).
 */
class ShopController extends Controller
{
    public function __construct(private readonly CommandeService $commandes) {}

    public function categories(): JsonResponse
    {
        $categories = Category::whereHas('products')
            ->orderBy('name')
            ->get(['id', 'name']);

        return response()->json(['data' => $categories]);
    }

    /** Villes de livraison = zones tarifaires publiques. */
    public function zones(): JsonResponse
    {
        return response()->json(['data' => Zone::orderBy('name')->get(['id', 'name'])]);
    }

    /**
     * Catalogue public : la ville détermine les produits affichés.
     * `zone=toutes` (ou absente) → uniquement les produits ayant un prix
     * « toutes villes » ; `zone={id}` → prix de la zone ou toutes villes.
     */
    public function produits(Request $request): AnonymousResourceCollection
    {
        $zoneParam = $request->input('zone');
        $zoneId = is_numeric($zoneParam) ? (int) $zoneParam : null;

        $query = Product::query()->with(['category', 'unit', 'prices' => fn ($q) => $zoneId
            ? $q->where(fn ($x) => $x->where('zone_id', $zoneId)->orWhereNull('zone_id'))
            : $q->where(fn ($x) => $x->where('for_pos', true)->orWhereNull('zone_id')),
        ]);

        // Un produit n'est affiché que s'il possède un prix dans le scope choisi.
        if ($zoneId) {
            $query->whereHas('prices', fn ($q) => $q->where('zone_id', $zoneId)->orWhereNull('zone_id'));
        } else {
            $query->whereHas('prices', fn ($q) => $q->whereNull('zone_id')->orWhere('for_pos', true));
        }

        if ($request->filled('categorie')) {
            $query->where('category_id', (int) $request->input('categorie'));
        }

        if ($request->boolean('mis_en_avant')) {
            $query->where('mis_en_avant', true);
        }

        if ($search = $request->input('search')) {
            $query->where(fn ($q) => $q->where('name', 'like', "%{$search}%")->orWhere('reference', 'like', "%{$search}%"));
        }

        return PublicProduitResource::collection(
            $query->orderByDesc('mis_en_avant')->orderBy('name')->paginate(min((int) $request->input('per_page', 24), 48))
        );
    }

    public function produit(Request $request, int $id): PublicProduitResource
    {
        $zoneParam = $request->input('zone');
        $zoneId = is_numeric($zoneParam) ? (int) $zoneParam : null;

        $query = Product::with(['category', 'unit', 'prices' => fn ($q) => $zoneId
            ? $q->where(fn ($x) => $x->where('zone_id', $zoneId)->orWhereNull('zone_id'))
            : $q->where(fn ($x) => $x->where('for_pos', true)->orWhereNull('zone_id')),
        ]);

        if ($zoneId) {
            $query->whereHas('prices', fn ($q) => $q->where('zone_id', $zoneId)->orWhereNull('zone_id'));
        } else {
            $query->whereHas('prices', fn ($q) => $q->whereNull('zone_id')->orWhere('for_pos', true));
        }

        return new PublicProduitResource($query->findOrFail($id));
    }

    /**
     * Commande sans compte : le client est identifié par son téléphone
     * normalisé ; prix recalculés et figés côté serveur.
     */
    public function commander(StoreCommandeRequest $request): JsonResponse
    {
        $commande = $this->commandes->creer($request->validated());

        return response()->json([
            'data' => [
                'numero' => $commande->numero,
                'total' => (int) $commande->total,
                'statut' => $commande->statut->value,
            ],
        ], 201);
    }

    /**
     * Suivi : numéro ET téléphone doivent correspondre — message générique
     * sinon (anti-énumération).
     */
    public function suivi(Request $request): SuiviCommandeResource|JsonResponse
    {
        $request->validate([
            'numero' => 'required|string|max:20',
            'telephone' => 'required|string|max:20',
        ]);

        $commande = Commande::with(['lignes', 'historique', 'chauffeur', 'livraison'])
            ->where('numero', strtoupper(trim((string) $request->input('numero'))))
            ->where('telephone_livraison', CommandeService::normaliserTelephone((string) $request->input('telephone')))
            ->first();

        if (! $commande) {
            return response()->json(['message' => 'Commande introuvable.'], 404);
        }

        return new SuiviCommandeResource($commande);
    }
}
