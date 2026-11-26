<?php

namespace App\Http\Controllers;

use App\Enums\StatutCommande;
use App\Http\Resources\CommandeResource;
use App\Models\Commande;
use App\Models\CommandeLigne;
use App\Models\Driver;
use App\Models\User;
use App\Services\CommandeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Back-office : suivi et traitement des commandes de la boutique en ligne.
 * Le chauffeur ne voit et ne livre que les commandes qui lui sont affectées.
 */
class CommandeController extends Controller
{
    /** Consultation : admins + chauffeur (restreint à ses livraisons). */
    private const VIEW_ROLES = ['LG_ADMIN', 'DG_ADMIN', 'CDG_ADMIN', 'SUPERADMIN', 'CHAUFFEUR'];

    /** Validation, refus, préparation, expédition et annulation. */
    private const MANAGE_ROLES = ['LG_ADMIN', 'DG_ADMIN', 'SUPERADMIN'];

    /** Décision sur une remise demandée par le client : la direction générale. */
    private const REMISE_ROLES = ['DG_ADMIN', 'SUPERADMIN'];

    /** Affectation d'un chauffeur : gestionnaires + approvisionneur. */
    private const ASSIGN_ROLES = ['LG_ADMIN', 'DG_ADMIN', 'CDG_ADMIN', 'SUPERADMIN'];

    /** Livraison et échec : chauffeur affecté ou gestionnaires. */
    private const DELIVER_ROLES = ['LG_ADMIN', 'DG_ADMIN', 'SUPERADMIN', 'CHAUFFEUR'];

    /** Relations de la fiche commande complète (détail, frais, annotations). */
    private const DETAIL = ['lignes.produit.unit', 'historique.user', 'chauffeur', 'valideur', 'facture.paiements', 'facture.avoir', 'livraison', 'extras', 'annotations.user', 'compte', 'bonLivraison', 'bonsLivraison.lignes'];

    public function __construct(private readonly CommandeService $service) {}

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
        $user = $this->authorizeUser($request, self::VIEW_ROLES);

        $query = Commande::query()->with(['chauffeur', 'lignes'])->withCount('annotations');

        // Le chauffeur ne voit que les commandes qui lui sont affectées.
        if ($user->role === 'CHAUFFEUR') {
            $query->where('chauffeur_id', $user->id);
        }

        if ($request->filled('statut')) {
            $query->where('statut', $request->input('statut'));
        }

        if ($search = $request->input('search')) {
            $query->where(fn ($q) => $q
                ->where('numero', 'like', "%{$search}%")
                ->orWhere('nom_livraison', 'like', "%{$search}%")
                ->orWhere('telephone_livraison', 'like', '%'.CommandeService::normaliserTelephone($search).'%'));
        }

        if ($from = $request->input('from')) {
            $query->whereDate('created_at', '>=', $from);
        }

        if ($to = $request->input('to')) {
            $query->whereDate('created_at', '<=', $to);
        }

        $paginator = $query->orderByDesc('created_at')->paginate(min((int) $request->input('per_page', 20), 100));

        return response()->json([
            'data' => collect($paginator->items())->map(fn (Commande $c) => [
                'id' => $c->id,
                'numero' => $c->numero,
                'statut' => $c->statut->value,
                'statut_libelle' => $c->statut->libelle(),
                'client' => $c->nom_livraison,
                'telephone' => $c->telephone_livraison,
                'quartier' => $c->quartier,
                'ville' => $c->ville,
                'total' => (int) $c->total,
                'chauffeur' => $c->chauffeur?->name,
                'espace_client' => $c->user_id !== null,
                'remise_statut' => $c->remise_statut,
                'annotations' => (int) $c->annotations_count,
                'a_referencer' => $c->lignes->whereNull('produit_id')->count(),
                'cree_le' => $c->created_at?->toIso8601String(),
            ]),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
                'en_attente' => Commande::where('statut', StatutCommande::EnAttente)->count(),
            ],
        ]);
    }

    public function show(Request $request, Commande $commande): CommandeResource
    {
        $user = $this->authorizeUser($request, self::VIEW_ROLES);
        $this->authorizeChauffeur($user, $commande);

        $commande->load(self::DETAIL);

        return new CommandeResource($commande);
    }

    public function valider(Request $request, Commande $commande): CommandeResource
    {
        $this->authorizeUser($request, self::MANAGE_ROLES);
        $commande = $this->service->valider($commande, $request->user());
        $commande->load(['lignes.produit.unit', 'historique.user', 'chauffeur', 'facture.paiements', 'facture.avoir', 'livraison']);

        return new CommandeResource($commande);
    }

    /**
     * Frais annexes (manutention, livraison…) affichés sur la facture imprimée
     * de la commande : libellé + montant, ajoutés au TOTAL TTC du document.
     */
    public function saveExtras(Request $request, Commande $commande): CommandeResource
    {
        $this->authorizeUser($request, self::ASSIGN_ROLES);

        $validated = $request->validate([
            'extras' => 'present|array|max:20',
            'extras.*.label' => 'required|string|max:80',
            'extras.*.amount' => 'required|numeric|min:0|max:999999999',
        ]);

        $rows = collect($validated['extras'])
            ->map(fn (array $x) => ['label' => trim($x['label']), 'amount' => (float) $x['amount']])
            ->filter(fn (array $x) => $x['label'] !== '' && $x['amount'] > 0)
            ->values()
            ->all();

        $commande->extras()->delete();
        $commande->extras()->createMany($rows);

        $commande->load(self::DETAIL);

        return new CommandeResource($commande);
    }

    /** Annotation de l'équipe (réponse au client, consigne interne…). */
    public function annoter(Request $request, Commande $commande): CommandeResource
    {
        $user = $this->authorizeUser($request, self::VIEW_ROLES);
        $this->authorizeChauffeur($user, $commande);

        $validated = $request->validate(['contenu' => 'required|string|max:1000']);
        $this->service->annoter($commande, $user, $validated['contenu']);

        return new CommandeResource($commande->load(self::DETAIL));
    }

    /** Décision sur la remise demandée par le client, avant validation. */
    public function remise(Request $request, Commande $commande): CommandeResource
    {
        $this->authorizeUser($request, self::REMISE_ROLES);

        $validated = $request->validate([
            'decision' => 'required|in:accorder,refuser',
            'taux' => 'nullable|numeric|min:0.5|max:100',
        ]);

        $commande = $this->service->deciderRemise(
            $commande,
            $validated['decision'] === 'accorder',
            isset($validated['taux']) ? (float) $validated['taux'] : null,
            $request->user(),
        );

        return new CommandeResource($commande->load(self::DETAIL));
    }

    /**
     * Ligne à référencer avant validation : produit inconnu associé à un
     * produit du catalogue et/ou prix unitaire ajusté.
     */
    public function modifierLigne(Request $request, Commande $commande, CommandeLigne $ligne): CommandeResource
    {
        $this->authorizeUser($request, self::MANAGE_ROLES);
        abort_unless($ligne->commande_id === $commande->id, 404);

        $validated = $request->validate([
            'produit_id' => 'nullable|required_without:prix_unitaire|integer|exists:products,id',
            'prix_unitaire' => 'nullable|required_without:produit_id|integer|min:0|max:999999999',
        ]);

        $this->service->modifierLigne(
            $commande,
            $ligne,
            isset($validated['produit_id']) ? (int) $validated['produit_id'] : null,
            isset($validated['prix_unitaire']) ? (int) $validated['prix_unitaire'] : null,
            $request->user(),
        );

        return new CommandeResource($commande->refresh()->load(self::DETAIL));
    }

    /** Facture soldée : définitif, visible aussi par le client. */
    public function solder(Request $request, Commande $commande): CommandeResource
    {
        $this->authorizeUser($request, self::MANAGE_ROLES);
        $this->service->solder($commande, $request->user());

        return new CommandeResource($commande->refresh()->load(self::DETAIL));
    }

    public function refuser(Request $request, Commande $commande): CommandeResource
    {
        $this->authorizeUser($request, self::MANAGE_ROLES);
        $validated = $request->validate(['motif' => 'required|string|max:500']);
        $commande = $this->service->refuser($commande, $validated['motif'], $request->user());

        return new CommandeResource($commande->load('historique.user'));
    }

    public function preparer(Request $request, Commande $commande): CommandeResource
    {
        $this->authorizeUser($request, self::MANAGE_ROLES);

        return new CommandeResource($this->service->preparer($commande, $request->user())->load('historique.user'));
    }

    /**
     * Livraison partielle d'une commande en préparation : quantité envoyée
     * par ligne, déduite du stock réel (refusée si le stock manque).
     */
    public function livrerPartiel(Request $request, Commande $commande): CommandeResource
    {
        $this->authorizeUser($request, self::MANAGE_ROLES);

        $validated = $request->validate([
            'lignes' => 'required|array|min:1|max:100',
            'lignes.*.id' => 'required|integer',
            'lignes.*.quantite' => 'required|numeric|min:0',
        ]);

        $quantites = collect($validated['lignes'])->mapWithKeys(fn (array $l) => [(int) $l['id'] => (float) $l['quantite']])->all();

        $commande = $this->service->livrerPartiel($commande, $quantites, $request->user());

        return new CommandeResource($commande->refresh()->load(self::DETAIL));
    }

    /** Affectation d'un chauffeur, uniquement après validation de la commande. */
    public function affecter(Request $request, Commande $commande): CommandeResource
    {
        $this->authorizeUser($request, self::ASSIGN_ROLES);
        $validated = $request->validate(['chauffeur_id' => 'required|integer|exists:users,id']);

        return new CommandeResource(
            $this->service->affecter($commande, (int) $validated['chauffeur_id'], $request->user())
                ->load(['historique.user', 'chauffeur', 'livraison'])
        );
    }

    /** Départ de la mission : chauffeur affecté, position GPS réelle. */
    public function demarrer(Request $request, Commande $commande): CommandeResource
    {
        $user = $this->authorizeUser($request, self::DELIVER_ROLES);
        $this->authorizeChauffeur($user, $commande);

        $validated = $request->validate([
            'latitude' => 'nullable|numeric|between:-90,90',
            'longitude' => 'nullable|numeric|between:-180,180',
        ]);

        return new CommandeResource(
            $this->service->demarrer(
                $commande,
                $user,
                isset($validated['latitude']) ? (float) $validated['latitude'] : null,
                isset($validated['longitude']) ? (float) $validated['longitude'] : null,
            )->load(['historique.user', 'chauffeur', 'livraison'])
        );
    }

    /** Position GPS en cours de livraison (chauffeur affecté ou gestionnaire). */
    public function position(Request $request, Commande $commande): JsonResponse
    {
        $user = $this->authorizeUser($request, self::DELIVER_ROLES);
        $this->authorizeChauffeur($user, $commande);

        $validated = $request->validate([
            'latitude' => 'required|numeric|between:-90,90',
            'longitude' => 'required|numeric|between:-180,180',
        ]);

        $this->service->position($commande, (float) $validated['latitude'], (float) $validated['longitude']);

        return response()->json(['data' => ['ok' => true]]);
    }

    public function expedier(Request $request, Commande $commande): CommandeResource
    {
        $this->authorizeUser($request, self::ASSIGN_ROLES);
        $validated = $request->validate(['chauffeur_id' => 'required|integer|exists:users,id']);

        return new CommandeResource($this->service->expedier($commande, (int) $validated['chauffeur_id'], $request->user())->load(['historique.user', 'chauffeur', 'livraison']));
    }

    public function livrer(Request $request, Commande $commande): CommandeResource
    {
        $user = $this->authorizeUser($request, self::DELIVER_ROLES);
        $this->authorizeChauffeur($user, $commande);

        // [CHAUFFEUR] Sans chauffeur, un simple clic « Livrée » suffit :
        // réceptionnaire, encaissement et signature deviennent facultatifs.
        $validated = $request->validate([
            'receptionnaire' => 'nullable|string|min:2|max:100',
            'signature' => 'nullable|string|max:500000',
            'montant' => 'nullable|integer|min:0',
            'mode' => 'nullable|required_with:montant|in:ESPECES,AIRTEL_MONEY,MOOV_MONEY',
        ]);

        return new CommandeResource($this->service->livrer($commande, $validated, $user)->load(['historique.user', 'facture.paiements', 'livraison']));
    }

    public function echec(Request $request, Commande $commande): CommandeResource
    {
        $user = $this->authorizeUser($request, self::DELIVER_ROLES);
        $this->authorizeChauffeur($user, $commande);
        $validated = $request->validate(['motif' => 'required|string|max:500']);

        return new CommandeResource($this->service->echec($commande, $validated['motif'], $user)->load('historique.user'));
    }

    public function annuler(Request $request, Commande $commande): CommandeResource
    {
        $this->authorizeUser($request, self::MANAGE_ROLES);
        $validated = $request->validate(['motif' => 'required|string|max:500']);

        return new CommandeResource($this->service->annuler($commande, $validated['motif'], $request->user())->load(['historique.user', 'facture.avoir']));
    }

    /** Indicateurs du tableau de bord boutique. */
    public function stats(Request $request): JsonResponse
    {
        $user = $this->authorizeUser($request, self::VIEW_ROLES);
        // CA boutique : Direction et Super admin uniquement.
        $finances = in_array($user->role, DashboardController::FINANCE_ROLES, true);

        $base = Commande::query()->whereNotIn('statut', [StatutCommande::Refusee, StatutCommande::Annulee]);

        return response()->json(['data' => [
            'en_attente' => Commande::where('statut', StatutCommande::EnAttente)->count(),
            'commandes_jour' => (clone $base)->whereDate('created_at', today())->count(),
            'ca_boutique_jour' => $finances ? (int) (clone $base)->whereDate('created_at', today())->sum('total') : null,
            'ca_boutique_mois' => $finances ? (int) (clone $base)->whereYear('created_at', now()->year)->whereMonth('created_at', now()->month)->sum('total') : null,
            'taux_livrees' => Commande::whereIn('statut', [StatutCommande::Livree, StatutCommande::EnLivraison, StatutCommande::EchecLivraison])->count() > 0
                ? round(Commande::where('statut', StatutCommande::Livree)->count() / Commande::whereIn('statut', [StatutCommande::Livree, StatutCommande::EnLivraison, StatutCommande::EchecLivraison])->count() * 100, 1)
                : 0,
            // Pilotage logistique.
            'a_affecter' => Commande::whereIn('statut', [StatutCommande::Validee, StatutCommande::EnPreparation])->whereNull('chauffeur_id')->count(),
            'en_livraison' => Commande::where('statut', StatutCommande::EnLivraison)->count(),
            'livrees_jour' => Commande::where('statut', StatutCommande::Livree)->whereDate('updated_at', today())->count(),
            'livrees_total' => Commande::where('statut', StatutCommande::Livree)->count(),
            'chauffeurs' => Driver::count(),
            'chauffeurs_en_mission' => Driver::where('status', 'EN_MISSION')->count(),
        ]]);
    }

    /** Un chauffeur n'agit que sur les commandes qui lui sont affectées. */
    private function authorizeChauffeur(User $user, Commande $commande): void
    {
        if ($user->role === 'CHAUFFEUR' && $commande->chauffeur_id !== $user->id) {
            abort(403, 'Commande non affectée à ce chauffeur.');
        }
    }
}
