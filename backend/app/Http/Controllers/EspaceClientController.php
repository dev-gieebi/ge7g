<?php

namespace App\Http\Controllers;

use App\Enums\StatutCommande;
use App\Http\Requests\StoreCommandeClientRequest;
use App\Http\Resources\ClientCommandeResource;
use App\Models\Commande;
use App\Models\User;
use App\Models\Zone;
use App\Services\CommandeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Espace client connecté (rôle CLIENT) : commande sans voir le stock, suivi
 * de ses propres commandes, annotations, demande de remise et bon de
 * livraison. Un client n'accède qu'à ses commandes et, s'il est rattaché à
 * une ville, ne commande que pour cette ville.
 */
class EspaceClientController extends Controller
{
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
        $terminees = [StatutCommande::Livree, StatutCommande::Refusee, StatutCommande::Annulee];
        if ($request->input('etat') === 'en_cours') {
            $query->whereNotIn('statut', $terminees);
        } elseif ($request->input('etat') === 'terminees') {
            $query->whereIn('statut', $terminees);
        }

        $paginator = $query->orderByDesc('created_at')->paginate(min((int) $request->input('per_page', 20), 50));

        return response()->json([
            'data' => collect($paginator->items())->map(fn (Commande $c) => [
                'id' => $c->id,
                'numero' => $c->numero,
                'statut' => $c->statut->value,
                'statut_libelle' => $c->statut->libelle(),
                'ville' => $c->ville,
                'total' => (int) $c->total,
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

    public function remise(Request $request, Commande $commande): ClientCommandeResource
    {
        $user = $this->authorizeClient($request);
        $this->authorizeCommande($user, $commande);

        $validated = $request->validate([
            'remise_taux' => 'required|numeric|min:0.5|max:100',
            'remise_motif' => 'nullable|string|max:500',
        ]);

        $this->service->demanderRemise($commande, (float) $validated['remise_taux'], $validated['remise_motif'] ?? null, $user);

        return new ClientCommandeResource($this->charger($commande));
    }

    private function charger(Commande $commande): Commande
    {
        return $commande->refresh()->load(['lignes.produit.unit', 'historique', 'annotations', 'chauffeur', 'livraison', 'facture.paiements', 'extras', 'bonLivraison']);
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
