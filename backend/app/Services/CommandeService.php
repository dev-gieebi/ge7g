<?php

namespace App\Services;

use App\Enums\StatutCommande;
use App\Models\BonLivraison;
use App\Models\Client;
use App\Models\Commande;
use App\Models\CommandeAnnotation;
use App\Models\CommandeLigne;
use App\Models\Driver;
use App\Models\Facture;
use App\Models\Livraison;
use App\Models\Paiement;
use App\Models\PosSale;
use App\Models\Product;
use App\Models\User;
use App\Models\Zone;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Circuit complet des commandes de la boutique en ligne : création publique,
 * validation (facture + vente + sortie de stock dans une seule transaction),
 * préparation, expédition, livraison avec encaissement, échec et annulation
 * avec avoir. Toutes les transitions passent par `StatutCommande::peutPasserA`.
 */
class CommandeService
{
    public function __construct(
        private readonly NumerotationService $numerotation,
        private readonly StockService $stock,
        private readonly FactureService $factures,
        private readonly NotificationService $notifications,
    ) {}

    /**
     * Normalise un numéro gabonais au format international +241XXXXXXXXX.
     */
    public static function normaliserTelephone(string $telephone): string
    {
        $digits = preg_replace('/\D/', '', $telephone) ?? '';
        $digits = preg_replace('/^(00241|241)/', '', $digits) ?? $digits;

        return '+241'.$digits;
    }

    /**
     * Crée une commande publique. Les prix sont recalculés côté serveur à
     * partir du barème (jamais ceux envoyés par le navigateur) et figés dans
     * les lignes. Aucune facture, vente ni mouvement de stock à ce stade.
     *
     * `$compte` : compte CLIENT connecté (espace client), la commande lui est
     * rattachée, l'annotation éventuelle est enregistrée, et la limite anti-abus des commandes publiques ne
     * s'applique pas.
     *
     * @param  array{nom: string, telephone: string, ville: string, quartier: string, point_repere: string, note?: ?string, zone_id?: ?int, lignes: list<array{produit_id: int, quantite: mixed}>, annotation?: ?string}  $data
     */
    public function creer(array $data, ?User $compte = null): Commande
    {
        $telephone = self::normaliserTelephone($data['telephone']);

        // Anti-abus : 3 commandes en attente maximum par téléphone.
        $enAttente = Commande::where('telephone_livraison', $telephone)->where('statut', StatutCommande::EnAttente)->count();
        if (! $compte && $enAttente >= 3) {
            throw ValidationException::withMessages([
                'telephone' => 'Trop de commandes en attente sur ce numéro. Contactez-nous directement.',
            ]);
        }

        $zone = isset($data['zone_id']) ? Zone::find($data['zone_id']) : null;

        return DB::transaction(function () use ($data, $telephone, $zone, $compte) {
            // Compte client : sa fiche liée ; sinon reconnaissance par téléphone normalisé.
            $client = ($compte?->client_id ? Client::find($compte->client_id) : null) ?? Client::firstOrNew(['telephone' => $telephone]);
            $client->nom = $data['nom'];
            $client->adresse = trim($data['ville'].', '.$data['quartier'].', '.$data['point_repere']);
            $client->source = $client->source ?? 'boutique_en_ligne';
            $client->save();

            $commande = new Commande([
                'client_id' => $client->id,
                'user_id' => $compte?->id,
                'client_vu_le' => $compte ? now() : null,
                'zone_id' => $zone?->id,
                'nom_livraison' => $data['nom'],
                'telephone_livraison' => $telephone,
                'ville' => $data['ville'],
                'quartier' => $data['quartier'],
                'point_repere' => $data['point_repere'],
                'note' => $data['note'] ?? null,
                'statut' => StatutCommande::EnAttente,
            ]);
            $commande->numero = $this->numerotation->next('CMD');
            $commande->save();

            foreach ($data['lignes'] as $ligne) {
                $this->creerLigne($commande, $ligne, $zone?->id, (bool) $compte);
            }

            $this->recalculer($commande);

            $this->historiser($commande, null, StatutCommande::EnAttente, $compte, 'Commande reçue');

            if ($compte && ! empty($data['annotation'])) {
                $this->annoter($commande, $compte, $data['annotation']);
            }

            return $commande->load('lignes');
        });
    }

    /**
     * Ligne de commande au prix figé du barème. Un compte CLIENT peut aussi
     * demander un produit absent du catalogue (`designation` sans
     * `produit_id`) : ligne à 0, référencée ensuite par l'équipe.
     *
     * @param  array{produit_id?: ?int, designation?: ?string, precision?: ?string, quantite: mixed}  $ligne
     */
    private function creerLigne(Commande $commande, array $ligne, ?int $zoneId, bool $produitInconnuPermis): CommandeLigne
    {
        $quantite = (float) $ligne['quantite'];
        $precision = isset($ligne['precision']) ? trim((string) $ligne['precision']) : null;

        if (empty($ligne['produit_id'])) {
            $designation = trim((string) ($ligne['designation'] ?? ''));
            if (! $produitInconnuPermis || $designation === '') {
                throw ValidationException::withMessages(['lignes' => 'Un produit de la commande est introuvable.']);
            }
            if ($quantite <= 0) {
                throw ValidationException::withMessages(['lignes' => 'Quantité invalide pour « '.$designation.' ».']);
            }

            // Même produit hors catalogue déjà demandé (même nom) : quantités cumulées.
            $existante = $commande->lignes()->whereNull('produit_id')->get()
                ->first(fn (CommandeLigne $l) => mb_strtolower(trim($l->designation)) === mb_strtolower($designation));
            if ($existante) {
                return $this->cumuler($existante, $quantite, $precision);
            }

            return $commande->lignes()->create([
                'produit_id' => null,
                'designation' => $designation,
                'precision' => isset($ligne['precision']) ? trim((string) $ligne['precision']) : null,
                'prix_unitaire' => 0,
                'quantite' => $quantite,
                'total_ligne' => 0,
            ]);
        }

        $produit = Product::lockForUpdate()->find($ligne['produit_id']);
        if (! $produit) {
            throw ValidationException::withMessages(['lignes' => 'Un produit de la commande est introuvable.']);
        }
        if ($quantite <= 0) {
            throw ValidationException::withMessages(['lignes' => 'Quantité invalide pour « '.$produit->name.' ».']);
        }

        // Produit déjà dans la commande : une seule ligne, quantités cumulées
        // (1 barre + 25 barres = 26 barres), au prix déjà figé de la ligne.
        $existante = $commande->lignes()->where('produit_id', $produit->id)->first();
        if ($existante) {
            return $this->cumuler($existante, $quantite, $precision);
        }

        // Pas de blocage sur le stock à la commande : le client peut
        // commander même en rupture (réapprovisionnement). Le stock est
        // vérifié et déduit à la validation par l'admin.

        // Prix figé au barème de la ville de livraison. Compte client sans
        // ville tarifaire (toutes les villes, autre ville) : prix laissé vide,
        // saisi par l'équipe. Boutique publique : prix de base.
        $prixUnitaire = $produitInconnuPermis && $zoneId === null ? 0 : $produit->prixBoutique($zoneId);

        return $commande->lignes()->create([
            'produit_id' => $produit->id,
            'designation' => $produit->name.($produit->type ? ' · '.$produit->type : ''),
            'precision' => isset($ligne['precision']) ? trim((string) $ligne['precision']) : null,
            'prix_unitaire' => $prixUnitaire,
            'quantite' => $quantite,
            'total_ligne' => (int) round($prixUnitaire * $quantite),
        ]);
    }

    /** Ajoute une quantité à une ligne existante (précision ajoutée si nouvelle). */
    private function cumuler(CommandeLigne $ligne, float $quantite, ?string $precision): CommandeLigne
    {
        $ligne->quantite = (float) $ligne->quantite + $quantite;
        $ligne->total_ligne = (int) round((int) $ligne->prix_unitaire * (float) $ligne->quantite);

        if ($precision !== null && $precision !== '' && ! str_contains((string) $ligne->precision, $precision)) {
            $ligne->precision = $ligne->precision ? $ligne->precision.' · '.$precision : $precision;
        }

        $ligne->save();

        return $ligne;
    }

    /** Total de la commande depuis ses lignes, remise accordée réappliquée. */
    private function recalculer(Commande $commande): void
    {
        $sousTotal = (int) $commande->lignes()->sum('total_ligne');

        $commande->remise_montant = $commande->remise_statut === 'accordee'
            ? (int) round($sousTotal * (float) $commande->remise_taux / 100)
            : 0;
        $commande->total = $sousTotal - $commande->remise_montant;
        $commande->save();
    }

    /**
     * Produits ajoutés par le client à sa commande, tant qu'elle est en
     * attente de validation (catalogue ou produits inconnus).
     *
     * @param  list<array{produit_id?: ?int, designation?: ?string, precision?: ?string, quantite: mixed}>  $lignes
     */
    public function ajouterLignes(Commande $commande, array $lignes, User $user): Commande
    {
        return DB::transaction(function () use ($commande, $lignes, $user) {
            $commande = Commande::lockForUpdate()->findOrFail($commande->id);

            if ($commande->statut !== StatutCommande::EnAttente) {
                throw ValidationException::withMessages(['lignes' => 'Des produits ne peuvent être ajoutés que sur une commande en attente de validation.']);
            }

            // Historique : la quantité ajoutée et, si le produit était déjà là, le nouveau total.
            $ajouts = [];
            foreach ($lignes as $ligne) {
                $avant = (float) ($commande->lignes()->when(
                    ! empty($ligne['produit_id']),
                    fn ($q) => $q->where('produit_id', $ligne['produit_id']),
                    fn ($q) => $q->whereNull('produit_id')->whereRaw('LOWER(TRIM(designation)) = ?', [mb_strtolower(trim((string) ($ligne['designation'] ?? '')))]),
                )->value('quantite') ?? 0);
                $resultat = $this->creerLigne($commande, $ligne, $commande->zone_id, true);
                $ajouts[] = StockService::nombre((float) $ligne['quantite']).' × '.$resultat->designation
                    .($avant > 0 ? ' (total '.StockService::nombre((float) $resultat->quantite).')' : '');
            }

            $this->recalculer($commande);

            $this->historiser($commande, null, $commande->statut, $user, 'Produits ajoutés : '.implode(', ', $ajouts));

            return $commande;
        });
    }

    /**
     * Référencement d'une ligne par l'équipe avant validation : produit du
     * catalogue associé (produit demandé inconnu) et/ou prix unitaire ajusté.
     */
    public function modifierLigne(Commande $commande, CommandeLigne $ligne, ?int $produitId, ?int $prixUnitaire, User $admin): Commande
    {
        return DB::transaction(function () use ($commande, $ligne, $produitId, $prixUnitaire, $admin) {
            $commande = Commande::lockForUpdate()->findOrFail($commande->id);

            if ($commande->statut !== StatutCommande::EnAttente) {
                throw ValidationException::withMessages(['ligne' => 'Les lignes se modifient avant la validation de la commande.']);
            }

            $avant = $ligne->designation;

            // Produit choisi par le client dans le catalogue : figé, seul le prix change.
            if ($produitId !== null && $ligne->produit_id !== null && $produitId !== (int) $ligne->produit_id) {
                throw ValidationException::withMessages(['produit_id' => 'Ce produit vient du catalogue : il ne peut pas être remplacé, seul son prix peut être modifié.']);
            }

            if ($produitId !== null) {
                $produit = Product::findOrFail($produitId);

                // Produit déjà présent sur une autre ligne : la demande hors catalogue
                // y est ajoutée (une seule ligne par produit), puis supprimée.
                $existante = $ligne->produit_id === null
                    ? $commande->lignes()->where('produit_id', $produit->id)->where('id', '!=', $ligne->id)->first()
                    : null;
                if ($existante) {
                    if ($prixUnitaire !== null) {
                        $existante->prix_unitaire = $prixUnitaire;
                    }
                    $this->cumuler($existante, (float) $ligne->quantite, $ligne->precision);
                    $ligne->delete();
                    $this->recalculer($commande);
                    $this->historiser($commande, null, $commande->statut, $admin, 'Produit référencé : « '.$avant.' » ajouté à '.$existante->designation.' (total '.StockService::nombre((float) $existante->quantite).')');

                    return $commande;
                }

                $ligne->produit_id = $produit->id;
                $ligne->designation = $produit->name.($produit->type ? ' · '.$produit->type : '');
                $ligne->prix_unitaire = $prixUnitaire ?? ($commande->user_id && ! $commande->zone_id ? 0 : $produit->prixBoutique($commande->zone_id));
            } elseif ($prixUnitaire !== null) {
                $ligne->prix_unitaire = $prixUnitaire;
            }

            $ligne->total_ligne = (int) round($ligne->prix_unitaire * (float) $ligne->quantite);
            $ligne->save();

            $this->recalculer($commande);

            $this->historiser($commande, null, $commande->statut, $admin, $produitId !== null && $avant !== $ligne->designation
                ? 'Produit référencé : « '.$avant.' » → '.$ligne->designation
                : 'Prix ajusté : '.$ligne->designation);

            return $commande;
        });
    }

    /**
     * Facture soldée : marque définitive, visible côté équipe et côté
     * client. Une facture soldée ne peut plus être « désoldée ».
     */
    public function solder(Commande $commande, User $admin): Commande
    {
        return DB::transaction(function () use ($commande, $admin) {
            $facture = Facture::where('commande_id', $commande->id)->lockForUpdate()->first();

            if (! $facture) {
                throw ValidationException::withMessages(['facture' => "Cette commande n'a pas encore de facture."]);
            }

            if (! $facture->soldee_le) {
                $facture->soldee_le = now();
                $facture->soldee_par = $admin->id;
                $facture->save();

                $this->historiser($commande, null, $commande->statut, $admin, 'Facture '.$facture->numeroAffiche().' soldée');
            }

            return $commande;
        });
    }

    /**
     * Annotation libre sur la commande (signalement, précision, réponse).
     * L'auteur est « client » pour un compte CLIENT, « equipe » sinon.
     */
    public function annoter(Commande $commande, User $user, string $contenu): CommandeAnnotation
    {
        return $commande->annotations()->create([
            'user_id' => $user->id,
            'auteur' => $user->role === 'CLIENT' ? 'client' : 'equipe',
            'contenu' => trim($contenu),
        ]);
    }

    /**
     * Décision de l'équipe sur la remise, avant validation : accordée (taux
     * demandé ou ajusté, appliqué au total) ou refusée.
     */
    public function deciderRemise(Commande $commande, bool $accorder, ?float $taux, User $admin): Commande
    {
        return DB::transaction(function () use ($commande, $accorder, $taux, $admin) {
            $commande = Commande::lockForUpdate()->findOrFail($commande->id);

            if ($commande->statut !== StatutCommande::EnAttente) {
                throw ValidationException::withMessages(['remise' => 'La remise se décide avant la validation de la commande.']);
            }

            // Une décision par demande : après refus, le client peut redemander.
            if ($commande->remise_statut !== 'demandee') {
                throw ValidationException::withMessages(['remise' => 'Aucune demande de remise en attente de décision.']);
            }

            $sousTotal = $commande->sousTotal();

            if ($accorder) {
                $taux ??= $commande->remise_taux_demande;
                if (! $taux || $taux <= 0 || $taux > 100) {
                    throw ValidationException::withMessages(['taux' => 'Taux de remise invalide.']);
                }

                $commande->remise_taux = $taux;
                $commande->remise_montant = (int) round($sousTotal * $taux / 100);
                $commande->remise_statut = 'accordee';
                $commentaire = 'Remise accordée : '.$this->pourcentage($taux);
            } else {
                $commande->remise_taux = 0;
                $commande->remise_montant = 0;
                $commande->remise_statut = 'refusee';
                $commentaire = 'Remise refusée';
            }

            $commande->total = $sousTotal - $commande->remise_montant;
            $commande->save();

            $this->historiser($commande, null, $commande->statut, $admin, $commentaire);

            return $commande;
        });
    }

    private function pourcentage(float $taux): string
    {
        return rtrim(rtrim(number_format($taux, 2, ',', ''), '0'), ',').' %';
    }

    /**
     * Validation admin : dans UNE transaction, vérification du statut,
     * déduction du stock avec verrous, création de la facture et de la vente
     * (source boutique_en_ligne), passage en `validee`. Tout ou rien.
     */
    public function valider(Commande $commande, User $admin): Commande
    {
        return DB::transaction(function () use ($commande, $admin) {
            $commande = Commande::lockForUpdate()->with('lignes')->findOrFail($commande->id);

            // La remise demandée doit d'abord être tranchée par le DG.
            if ($commande->remise_statut === 'demandee') {
                throw ValidationException::withMessages(['remise' => 'Une remise est en attente de décision du DG : la commande ne peut pas encore être validée.']);
            }

            // Produits demandés hors catalogue : à référencer avant validation.
            if ($commande->lignes->contains(fn (CommandeLigne $l) => $l->produit_id === null)) {
                throw ValidationException::withMessages(['lignes' => 'Des produits demandés par le client ne sont pas encore référencés : associez-les à un produit du catalogue avant de valider.']);
            }

            // Prix laissés vides (commande sans ville tarifaire) : à saisir avant validation.
            if ($commande->lignes->contains(fn (CommandeLigne $l) => (int) $l->prix_unitaire <= 0)) {
                throw ValidationException::withMessages(['lignes' => 'Des prix restent à saisir : renseignez le prix de chaque ligne avant de valider.']);
            }

            $this->transition($commande, StatutCommande::Validee, $admin, null, false);

            // Le stock doit exister, mais il ne sort qu'à la livraison (envoi
            // par envoi) : la validation ne déduit rien.
            foreach ($commande->lignes as $ligne) {
                $this->stock->verifier($ligne->produit_id, (float) $ligne->quantite);
            }
            $commande->stock_a_la_livraison = true;

            // Facture et vente dans la série commune avec la caisse.
            $numeros = $this->numerotation->venteEtFacture();
            $facture = $this->factures->creerDepuisCommande($commande, $admin, $numeros['facture']);

            // Vente rattachée à la facture, source boutique, non payée,
            // encaissée à la livraison. Rien n'est encore livré : les
            // quantités livrées suivent les envois.
            $vente = PosSale::create([
                'number' => $numeros['vente'],
                'user_id' => $admin->id,
                'zone_id' => $commande->zone_id,
                'customer_name' => $commande->nom_livraison,
                'customer_phone' => $commande->telephone_livraison,
                'customer_address' => trim($commande->ville.', '.$commande->quartier.', '.$commande->point_repere),
                'subtotal' => $commande->sousTotal(),
                'discount_rate' => $commande->remise_taux,
                'tax_type' => 'AUCUNE',
                'tax_rate' => 0,
                'tax_amount' => 0,
                'total' => $commande->total,
                'status' => 'EMISE',
                'payment_method' => 'LIVRAISON',
                'source' => 'boutique_en_ligne',
                'facture_id' => $facture->id,
            ]);

            foreach ($commande->lignes as $ligne) {
                $vente->items()->create([
                    'product_id' => $ligne->produit_id,
                    'quantity' => $ligne->quantite,
                    'delivered_quantity' => 0,
                    'unit_price' => $ligne->prix_unitaire,
                    'total' => $ligne->total_ligne,
                ]);
            }

            $commande->validee_par = $admin->id;
            $commande->validee_le = now();
            $commande->save();

            $this->notifications->statutCommande($commande);

            return $commande;
        });
    }

    /** Refus d'une commande en attente (motif obligatoire). */
    public function refuser(Commande $commande, string $motif, User $admin): Commande
    {
        return $this->changer($commande, StatutCommande::Refusee, $admin, $motif);
    }

    /** Passage en préparation : commande validée → en_preparation. */
    public function preparer(Commande $commande, User $admin): Commande
    {
        return $this->changer($commande, StatutCommande::EnPreparation, $admin, null);
    }

    /**
     * Mise en livraison (commande en préparation) : quantités envoyées par
     * ligne (`$quantites` : id de ligne => quantité). Chaque quantité est
     * bornée au reste à livrer et sort du stock réel, refusée si le stock
     * n'existe pas. Un bon de livraison est créé pour l'envoi et la commande
     * passe « en cours de livraison » ; `livrer()` confirme l'arrivée.
     *
     * @param  array<int, float>  $quantites
     */
    public function livrerPartiel(Commande $commande, array $quantites, User $user): Commande
    {
        return DB::transaction(function () use ($commande, $quantites, $user) {
            $commande = Commande::lockForUpdate()->with('lignes', 'facture')->findOrFail($commande->id);

            if ($commande->statut !== StatutCommande::EnPreparation) {
                throw ValidationException::withMessages([
                    'statut' => "La livraison se fait une fois la commande en préparation (statut : {$commande->statut->libelle()}).",
                ]);
            }

            $quantites = array_filter(array_map('floatval', $quantites), fn (float $q) => $q > 0);
            if ($quantites === []) {
                throw ValidationException::withMessages(['lignes' => 'Indiquez au moins une quantité à livrer.']);
            }

            foreach ($quantites as $ligneId => $quantite) {
                $ligne = $commande->lignes->firstWhere('id', (int) $ligneId);
                if (! $ligne) {
                    throw ValidationException::withMessages(['lignes' => 'Ligne de commande inconnue.']);
                }
                if ($quantite > $ligne->reste() + 0.0001) {
                    throw ValidationException::withMessages([
                        'lignes' => '« '.$ligne->designation.' » : '.StockService::nombre($quantite).' demandé(s), il ne reste que '.StockService::nombre($ligne->reste()).' à livrer.',
                    ]);
                }
            }

            // L'envoi part : commande « en cours de livraison » jusqu'à ce que
            // l'équipe confirme son arrivée chez le client (bouton « Livrée »).
            $this->transition($commande, StatutCommande::EnLivraison, $user, null, false);
            $commande->save();

            $livraison = $commande->livraisons()->create([
                'chauffeur_id' => $commande->chauffeur_id,
                'depart_le' => now(),
            ]);

            $this->enregistrerEnvoi($commande, $quantites, $livraison, $user);

            $this->notifications->statutCommande($commande);

            return $commande;
        });
    }

    /**
     * Enregistre un envoi : sortie du stock (commandes dont le stock sort à
     * la livraison), quantités livrées sur les lignes et la vente, bon de
     * livraison de l'envoi et ligne d'historique visible par le client.
     *
     * @param  array<int, float>  $quantites  id de ligne => quantité envoyée
     */
    private function enregistrerEnvoi(Commande $commande, array $quantites, Livraison $livraison, User $user): void
    {
        $vente = $commande->facture?->vente;
        $details = [];

        // Bon de l'envoi créé d'abord : chaque sortie de stock y est rattachée
        // (N° du bon dans le suivi du stock). En cas de stock insuffisant, tout
        // est annulé par la transaction appelante.
        $bon = $this->factures->creerBonLivraison($commande, $livraison, $user, $quantites);

        foreach ($commande->lignes as $ligne) {
            $quantite = (float) ($quantites[$ligne->id] ?? 0);
            if ($quantite <= 0) {
                continue;
            }

            if ($commande->stock_a_la_livraison && $ligne->produit_id) {
                $this->stock->deduire($ligne->produit_id, $quantite, $commande, $user, 'Livraison '.$bon->numero.' (commande '.$commande->numero.')', $bon);
            }

            $ligne->quantite_livree = (float) $ligne->quantite_livree + $quantite;
            $ligne->save();

            if ($vente && $ligne->produit_id) {
                $item = $vente->items()->where('product_id', $ligne->produit_id)->first();
                if ($item) {
                    $item->delivered_quantity = min((float) $item->quantity, (float) $item->delivered_quantity + $quantite);
                    $item->save();
                }
            }

            $unite = $ligne->produit?->unit?->symbol;
            $details[] = StockService::nombre($quantite).($unite ? ' '.$unite : '').' de '.$ligne->designation.' (reste '.StockService::nombre($ligne->reste()).')';
        }

        $this->historiser($commande, null, $commande->statut, $user, 'Livraison '.$bon->numero.' : '.implode(', ', $details).'.');
    }

    /**
     * Affectation d'un chauffeur, possible uniquement une fois la commande
     * validée (validee, en_preparation, réaffectation en_livraison ou
     * replanification après échec). Ne change pas le statut : le chauffeur
     * voit la commande dans son espace et démarre la mission lui-même.
     */
    public function affecter(Commande $commande, int $chauffeurId, User $admin): Commande
    {
        $chauffeur = User::where('id', $chauffeurId)->where('role', 'CHAUFFEUR')->first();
        if (! $chauffeur) {
            throw ValidationException::withMessages(['chauffeur_id' => 'Chauffeur inconnu.']);
        }

        return DB::transaction(function () use ($commande, $chauffeur, $admin) {
            $commande = Commande::lockForUpdate()->findOrFail($commande->id);

            if (! in_array($commande->statut, [StatutCommande::Validee, StatutCommande::EnPreparation, StatutCommande::EnLivraison, StatutCommande::EchecLivraison], true)) {
                throw ValidationException::withMessages([
                    'chauffeur_id' => "La commande doit être validée avant d'affecter un chauffeur (statut : {$commande->statut->libelle()}).",
                ]);
            }

            $commande->chauffeur_id = $chauffeur->id;
            $commande->save();

            // Réaffectation en cours de route : la livraison ouverte suit.
            if ($commande->statut === StatutCommande::EnLivraison) {
                $commande->livraisons()->whereNull('livree_le')->latest('id')->first()?->update(['chauffeur_id' => $chauffeur->id]);
            }

            $this->historiser($commande, null, $commande->statut, $admin, 'Chauffeur affecté : '.$chauffeur->name);

            return $commande;
        });
    }

    /**
     * Départ de la mission par le chauffeur affecté (ou un gestionnaire) :
     * passage en livraison et enregistrement de la position GPS réelle.
     */
    public function demarrer(Commande $commande, User $user, ?float $latitude, ?float $longitude): Commande
    {
        // [CHAUFFEUR] Affectation du chauffeur mise en pause : un gestionnaire
        // met la commande en livraison sans chauffeur. À réactiver avec la
        // partie chauffeur (voir CHAUFFEUR.md).
        // if (! $commande->chauffeur_id) {
        //     throw ValidationException::withMessages(['chauffeur_id' => 'Aucun chauffeur affecté à cette commande.']);
        // }

        return DB::transaction(function () use ($commande, $user, $latitude, $longitude) {
            $commande = Commande::lockForUpdate()->findOrFail($commande->id);
            $this->transition($commande, StatutCommande::EnLivraison, $user, null, false);
            $commande->save();

            $livraison = $commande->livraisons()->create([
                'chauffeur_id' => $commande->chauffeur_id,
                'depart_le' => now(),
                'latitude' => $latitude,
                'longitude' => $longitude,
                'position_le' => $latitude !== null ? now() : null,
            ]);

            $this->marquerStatutChauffeur($livraison->chauffeur_id, 'EN_MISSION');
            $this->notifications->statutCommande($commande);

            return $commande;
        });
    }

    /** Position GPS en cours de route (suivi temps réel client et admin). */
    public function position(Commande $commande, float $latitude, float $longitude): void
    {
        if ($commande->statut !== StatutCommande::EnLivraison) {
            throw ValidationException::withMessages(['position' => "La commande n'est pas en cours de livraison."]);
        }

        $livraison = $commande->livraisons()->whereNull('livree_le')->latest('id')->first();
        if (! $livraison) {
            throw ValidationException::withMessages(['position' => 'Aucune livraison en cours pour cette commande.']);
        }

        $livraison->update([
            'latitude' => $latitude,
            'longitude' => $longitude,
            'position_le' => now(),
        ]);
    }

    /** Affectation du chauffeur et départ en livraison (gestionnaire). */
    public function expedier(Commande $commande, int $chauffeurId, User $admin): Commande
    {
        $chauffeur = User::where('id', $chauffeurId)->where('role', 'CHAUFFEUR')->first();
        if (! $chauffeur) {
            throw ValidationException::withMessages(['chauffeur_id' => 'Chauffeur inconnu.']);
        }

        return DB::transaction(function () use ($commande, $chauffeur, $admin) {
            $commande = Commande::lockForUpdate()->findOrFail($commande->id);
            // Replaniification après échec : en_livraison reste la cible.
            $this->transition($commande, StatutCommande::EnLivraison, $admin, null, false);

            $commande->chauffeur_id = $chauffeur->id;
            $commande->save();

            $commande->livraisons()->create([
                'chauffeur_id' => $chauffeur->id,
                'depart_le' => now(),
            ]);

            $this->marquerStatutChauffeur($chauffeur->id, 'EN_MISSION');
            $this->notifications->statutCommande($commande);

            return $commande;
        });
    }

    /**
     * Envoi arrivé chez le client (bouton « Livrée ») : signature, nom du
     * réceptionnaire et encaissement éventuels. S'il reste des produits à
     * livrer, la commande revient « en préparation » pour l'envoi suivant ;
     * sinon elle passe « livrée ». La facture passe en `payee` ou
     * `partiellement_payee` selon l'encaissement.
     */
    public function livrer(Commande $commande, array $data, User $user): Commande
    {
        return DB::transaction(function () use ($commande, $data, $user) {
            $commande = Commande::lockForUpdate()->with('lignes', 'facture')->findOrFail($commande->id);
            if ($commande->statut !== StatutCommande::EnLivraison) {
                throw ValidationException::withMessages([
                    'statut' => "Transition impossible : {$commande->statut->libelle()} → ".StatutCommande::Livree->libelle()." (commande {$commande->numero}).",
                ]);
            }

            $livraison = $commande->livraisons()->latest('id')->first() ?? new Livraison(['commande_id' => $commande->id]);
            $livraison->chauffeur_id = $livraison->chauffeur_id ?? $commande->chauffeur_id;
            $livraison->livree_le = now();
            $livraison->receptionnaire = $data['receptionnaire'] ?? null;
            if (! empty($data['signature'])) {
                $livraison->signature = $this->stockerSignature($data['signature'], $commande->numero);
            }
            $livraison->save();

            // Bon de l'envoi (créé au départ) : réceptionnaire, signature et date d'arrivée.
            BonLivraison::where('livraison_id', $livraison->id)->update([
                'receptionnaire' => $livraison->receptionnaire,
                'signature' => $livraison->signature,
                'livre_le' => $livraison->livree_le,
            ]);

            // Envoi sans quantités choisies (ancien circuit, remise en livraison
            // après un échec) : tout le reste part avec cette livraison.
            if (! BonLivraison::where('livraison_id', $livraison->id)->exists()) {
                $restes = $commande->lignes
                    ->mapWithKeys(fn (CommandeLigne $l) => [$l->id => $l->reste()])
                    ->filter(fn (float $q) => $q > 0)
                    ->all();
                if ($restes !== []) {
                    $this->enregistrerEnvoi($commande, $restes, $livraison, $user);
                }
            }

            // Tout est-il livré ? Sinon, retour en préparation pour l'envoi suivant.
            $commande->load('lignes');
            $reste = $commande->lignes->sum(fn (CommandeLigne $l) => $l->reste());
            if ($reste > 0.0001) {
                $this->transition($commande, StatutCommande::EnPreparation, $user, 'Envoi livré. Reste à livrer : '.$commande->lignes
                    ->filter(fn (CommandeLigne $l) => $l->reste() > 0.0001)
                    ->map(fn (CommandeLigne $l) => StockService::nombre($l->reste()).' × '.$l->designation)
                    ->implode(', ').'.', false);
            } else {
                $this->transition($commande, StatutCommande::Livree, $user, null, false);
            }
            $commande->save();

            $facture = $commande->facture;
            if ($facture && isset($data['montant'])) {
                Paiement::create([
                    'facture_id' => $facture->id,
                    'montant' => (int) $data['montant'],
                    'mode' => $data['mode'] ?? 'ESPECES',
                    'encaisse_par' => $commande->chauffeur_id ?? $user->id,
                    'encaisse_le' => now(),
                ]);

                $encaisse = (int) $facture->paiements()->sum('montant');
                $facture->statut_paiement = $encaisse >= $facture->montant_total ? 'payee' : 'partiellement_payee';
                $facture->save();

                if ($facture->statut_paiement === 'payee' && ($vente = $facture->vente)) {
                    $vente->status = 'PAYEE';
                    $vente->save();
                }
            }

            $this->marquerStatutChauffeur($livraison->chauffeur_id, 'DISPONIBLE');
            $this->notifications->statutCommande($commande);

            return $commande;
        });
    }

    /** Échec de livraison (motif obligatoire), replanifiable ou annulable. */
    public function echec(Commande $commande, string $motif, User $user): Commande
    {
        $commande = $this->changer($commande, StatutCommande::EchecLivraison, $user, $motif);
        $this->marquerStatutChauffeur($commande->chauffeur_id, 'DISPONIBLE');

        return $commande;
    }

    /**
     * Annulation : avoir + vente marquée annulée + remise en stock. La facture
     * n'est jamais supprimée (obligation comptable).
     */
    public function annuler(Commande $commande, string $motif, User $admin): Commande
    {
        return DB::transaction(function () use ($commande, $motif, $admin) {
            $commande = Commande::lockForUpdate()->with('lignes', 'facture')->findOrFail($commande->id);
            $this->transition($commande, StatutCommande::Annulee, $admin, $motif, false);

            if ($facture = $commande->facture) {
                $this->factures->creerAvoir($facture, $motif, $admin);

                if ($vente = $facture->vente) {
                    $vente->annulee = true;
                    $vente->save();
                }

                // Seul ce qui est sorti du stock y revient : les quantités livrées
                // (ou toute la commande pour les anciennes, déduites à la validation).
                foreach ($commande->lignes as $ligne) {
                    $sorti = $commande->stock_a_la_livraison ? (float) $ligne->quantite_livree : (float) $ligne->quantite;
                    if ($sorti > 0) {
                        $this->stock->remettre($ligne->produit_id, $sorti, $commande, $admin);
                    }
                }
            }

            $commande->motif = $motif;
            $commande->save();

            $this->notifications->statutCommande($commande);

            return $commande;
        });
    }

    /** Transition simple validée par l'enum (refuser, préparer, échec). */
    private function changer(Commande $commande, StatutCommande $cible, User $user, ?string $commentaire): Commande
    {
        return DB::transaction(function () use ($commande, $cible, $user, $commentaire) {
            $commande = Commande::lockForUpdate()->findOrFail($commande->id);
            $this->transition($commande, $cible, $user, $commentaire, false);

            if ($commentaire !== null && in_array($cible, [StatutCommande::Refusee, StatutCommande::Annulee, StatutCommande::EchecLivraison], true)) {
                $commande->motif = $commentaire;
            }
            $commande->save();

            $this->notifications->statutCommande($commande);

            return $commande;
        });
    }

    /**
     * Applique une transition : vérifie `peutPasserA`, met à jour le statut
     * et historise. Rejette toute transition non prévue par le schéma (422).
     */
    private function transition(Commande $commande, StatutCommande $cible, ?User $user, ?string $commentaire, bool $save = true): void
    {
        $actuel = $commande->statut;
        if (! $actuel->peutPasserA($cible)) {
            throw ValidationException::withMessages([
                'statut' => "Transition impossible : {$actuel->libelle()} → {$cible->libelle()} (commande {$commande->numero}).",
            ]);
        }

        $commande->statut = $cible;
        if ($save) {
            $commande->save();
        }
        $this->historiser($commande, $actuel, $cible, $user, $commentaire);
    }

    /** Synchronise la disponibilité de la fiche chauffeur avec ses missions. */
    private function marquerStatutChauffeur(?int $userId, string $statut): void
    {
        if ($userId) {
            Driver::where('user_id', $userId)->update(['status' => $statut]);
        }
    }

    private function historiser(Commande $commande, ?StatutCommande $ancien, StatutCommande $nouveau, ?User $user, ?string $commentaire): void
    {
        $commande->historique()->create([
            'ancien_statut' => $ancien?->value,
            'nouveau_statut' => $nouveau->value,
            'user_id' => $user?->id,
            'commentaire' => $commentaire,
            // Horloge de l'application (et non celle du serveur SQL) : comparée
            // à `client_vu_le` pour signaler les nouveautés au client.
            'created_at' => now(),
        ]);
    }

    private function stockerSignature(string $dataUrl, string $numero): ?string
    {
        if (! preg_match('/^data:image\/(png|jpe?g);base64,(.+)$/', $dataUrl, $m)) {
            return null;
        }

        $path = 'signatures/'.$numero.'-'.Str::random(8).'.'.$m[1];
        Storage::disk('public')->put($path, base64_decode($m[2]));

        return $path;
    }
}
