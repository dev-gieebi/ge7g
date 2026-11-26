<?php

namespace App\Http\Controllers;

use App\Enums\StatutCommande;
use App\Http\Requests\StoreCommandeClientRequest;
use App\Http\Resources\ClientCommandeResource;
use App\Models\Commande;
use App\Models\Product;
use App\Models\User;
use App\Models\Zone;
use App\Services\CommandeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Espace client connecté (rôle CLIENT) : commande sans voir ni le stock ni
 * les prix (tout le catalogue + produits inconnus), suivi de ses propres
 * commandes, annotations, facture et bon de livraison. Un client n'accède qu'à ses commandes et, s'il est rattaché à
 * une ville, ne commande que pour cette ville.
 */
class EspaceClientController extends Controller
{
    /** Commandes terminées : livrées, refusées ou annulées. */
    private const TERMINEES = [StatutCommande::Livree, StatutCommande::Refusee, StatutCommande::Annulee];

    public function __construct(private readonly CommandeService $service) {}

    private function authorizeClient(Request $request): User
    {
        /** @var User $user */
        $user = $request->user();

        if ($user->role !== 'CLIENT') {
            abort(403, 'Accès réservé aux clients.');
        }

        return $user;
    }

    private function authorizeCommande(User $user, Commande $commande): void
    {
        if ($commande->user_id !== $user->id) {
            abort(404);
        }
    }

    /** Profil : ville d'accès (null = toutes les villes) et coordonnées pré-remplies. */
    public function profil(Request $request): JsonResponse
    {
        $user = $this->authorizeClient($request)->load('zone');

        return response()->json(['data' => [
            'nom' => $user->name,
            'telephone' => $user->phone,
            'zone' => $user->zone ? ['id' => $user->zone->id, 'name' => $user->zone->name] : null,
            'non_lues' => $this->nonLues($user)->count(),
            // Commandes pas encore arrivées chez le client (hors livrées, refusées, annulées).
            'en_cours' => Commande::where('user_id', $user->id)->whereNotIn('statut', self::TERMINEES)->count(),
        ]]);
    }

    public function index(Request $request): JsonResponse
    {
        $user = $this->authorizeClient($request);
        $nonLues = $this->nonLues($user)->pluck('id')->all();

        $query = Commande::where('user_id', $user->id);

        if ($request->filled('statut')) {
            $query->where('statut', $request->input('statut'));
        }

        // Historique : commandes en cours ou terminées (livrées, refusées, annulées).
        if ($request->input('etat') === 'en_cours') {
            $query->whereNotIn('statut', self::TERMINEES);
        } elseif ($request->input('etat') === 'terminees') {
            $query->whereIn('statut', self::TERMINEES);
        }

        $paginator = $query->with('facture')->orderByDesc('created_at')->paginate(min((int) $request->input('per_page', 20), 50));

        return response()->json([
            'data' => collect($paginator->items())->map(fn (Commande $c) => [
                'id' => $c->id,
                'cle' => $c->cle,
                'numero' => $c->numero,
                'statut' => $c->statut->value,
                'statut_libelle' => $c->statut->libelle(),
                'ville' => $c->ville,
                // Prix masqués au client tant qu'aucune facture n'est émise.
                'total' => $c->facture ? (int) $c->total : null,
                'remise_statut' => $c->remise_statut,
                'non_lu' => in_array($c->id, $nonLues, true),
                'cree_le' => $c->created_at?->toIso8601String(),
            ]),
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

    /**
     * Archive des documents du client : une entrée par commande facturée,
     * avec sa facture et, une fois livrée, son bon de livraison.
     */
    public function documents(Request $request): JsonResponse
    {
        $user = $this->authorizeClient($request);

        $paginator = Commande::where('user_id', $user->id)
            ->whereHas('facture')
            ->with(['facture.vente', 'bonLivraison'])
            ->orderByDesc('created_at')
            ->paginate(min((int) $request->input('per_page', 20), 50));

        return response()->json([
            'data' => collect($paginator->items())->map(fn (Commande $c) => [
                'commande_id' => $c->id,
                'cle' => $c->cle,
                'commande' => $c->numero,
                'statut_libelle' => $c->statut->libelle(),
                'facture' => [
                    'numero' => $c->facture->numeroAffiche(),
                    'emise_le' => $c->facture->emise_le?->toIso8601String(),
                    'montant_total' => (int) $c->facture->montant_total,
                    'soldee_le' => $c->facture->soldee_le?->toIso8601String(),
                ],
                'bon_livraison' => $c->bonLivraison ? [
                    'numero' => $c->bonLivraison->numero,
                    'livre_le' => $c->bonLivraison->livre_le?->toIso8601String(),
                ] : null,
            ]),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    /**
     * Catalogue complet pour le client : tous les produits en base, sans prix
     * ni stock (ni filtre de ville).
     */
    public function produits(Request $request): JsonResponse
    {
        $this->authorizeClient($request);

        $query = Product::query()->with(['category', 'unit']);

        if ($request->filled('categorie')) {
            $query->where('category_id', (int) $request->input('categorie'));
        }

        if ($search = $request->input('search')) {
            $query->where(fn ($q) => $q->where('name', 'like', "%{$search}%")->orWhere('reference', 'like', "%{$search}%"));
        }

        $paginator = $query->orderByDesc('mis_en_avant')->orderBy('name')->paginate(min((int) $request->input('per_page', 24), 48));

        return response()->json([
            'data' => collect($paginator->items())->map(fn (Product $p) => [
                'id' => $p->id,
                'reference' => $p->reference,
                'designation' => $p->name.($p->type ? ' · '.$p->type : ''),
                'description' => $p->description_publique,
                'categorie' => $p->category?->name,
                'unite' => $p->unit?->symbol,
                'image' => $p->image_url,
            ]),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    /**
     * Commande depuis l'espace client. Client rattaché à une ville : la ville
     * et le barème sont imposés par le compte, quoi qu'envoie le navigateur.
     */
    public function store(StoreCommandeClientRequest $request): JsonResponse
    {
        $user = $this->authorizeClient($request);
        $data = $request->validated();

        if ($user->zone_id) {
            $zone = Zone::findOrFail($user->zone_id);
            $data['zone_id'] = $zone->id;
            $data['ville'] = $zone->name;
        }

        $commande = $this->service->creer($data, $user);

        return response()->json([
            'data' => [
                'id' => $commande->id,
                'cle' => $commande->cle,
                'numero' => $commande->numero,
                'total' => (int) $commande->total,
                'statut' => $commande->statut->value,
            ],
        ], 201);
    }

    /** Détail + marquage « vu » (les nouveautés de l'équipe ne sont plus signalées). */
    public function show(Request $request, Commande $commande): ClientCommandeResource
    {
        $user = $this->authorizeClient($request);
        $this->authorizeCommande($user, $commande);

        $commande->forceFill(['client_vu_le' => now()])->saveQuietly();

        return new ClientCommandeResource($this->charger($commande));
    }

    public function annoter(Request $request, Commande $commande): ClientCommandeResource
    {
        $user = $this->authorizeClient($request);
        $this->authorizeCommande($user, $commande);

        $validated = $request->validate(['contenu' => 'required|string|max:1000']);
        $this->service->annoter($commande, $user, $validated['contenu']);

        return new ClientCommandeResource($this->charger($commande));
    }

    /** Produits ajoutés à une commande encore en attente de validation. */
    public function ajouterLignes(Request $request, Commande $commande): ClientCommandeResource
    {
        $user = $this->authorizeClient($request);
        $this->authorizeCommande($user, $commande);

        $validated = $request->validate(StoreCommandeClientRequest::reglesLignes());
        $this->service->ajouterLignes($commande, $validated['lignes'], $user);

        return new ClientCommandeResource($this->charger($commande));
    }

    private function charger(Commande $commande): Commande
    {
        return $commande->refresh()->load(['lignes.produit.unit', 'historique', 'annotations', 'chauffeur', 'livraison', 'facture.paiements', 'facture.vente', 'extras', 'bonLivraison', 'bonsLivraison.lignes']);
    }

    /**
     * Commandes du client ayant du nouveau depuis sa dernière consultation :
     * changement de statut ou décision faits par l'équipe, ou annotation de
     * l'équipe.
     */
    private function nonLues(User $user)
    {
        return Commande::where('user_id', $user->id)
            ->where(fn ($q) => $q
                ->whereHas('historique', fn ($h) => $h
                    ->where(fn ($x) => $x->whereNull('user_id')->orWhere('user_id', '!=', $user->id))
                    ->whereColumn('commande_historique.created_at', '>', 'commandes.client_vu_le'))
                ->orWhereHas('annotations', fn ($a) => $a
                    ->where('auteur', 'equipe')
                    ->whereColumn('commande_annotations.created_at', '>', 'commandes.client_vu_le')));
    }
}
