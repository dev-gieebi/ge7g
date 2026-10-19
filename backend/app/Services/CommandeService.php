<?php

namespace App\Services;

use App\Enums\StatutCommande;
use App\Models\Client;
use App\Models\Commande;
use App\Models\Driver;
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
     * @param  array{nom: string, telephone: string, ville: string, quartier: string, point_repere: string, note?: ?string, zone_id?: ?int, lignes: list<array{produit_id: int, quantite: mixed}>}  $data
     */
    public function creer(array $data): Commande
    {
        $telephone = self::normaliserTelephone($data['telephone']);

        // Anti-abus : 3 commandes en attente maximum par téléphone.
        $enAttente = Commande::where('telephone_livraison', $telephone)->where('statut', StatutCommande::EnAttente)->count();
        if ($enAttente >= 3) {
            throw ValidationException::withMessages([
                'telephone' => 'Trop de commandes en attente sur ce numéro. Contactez-nous directement.',
            ]);
        }

        $zone = isset($data['zone_id']) ? Zone::find($data['zone_id']) : null;

        return DB::transaction(function () use ($data, $telephone, $zone) {
            // Reconnaissance du client par téléphone normalisé.
            $client = Client::firstOrNew(['telephone' => $telephone]);
            $client->nom = $data['nom'];
            $client->adresse = trim($data['ville'].' — '.$data['quartier'].', '.$data['point_repere']);
            $client->source = $client->source ?? 'boutique_en_ligne';
            $client->save();

            $commande = new Commande([
                'client_id' => $client->id,
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

            $total = 0;
            foreach ($data['lignes'] as $ligne) {
                $produit = Product::lockForUpdate()->find($ligne['produit_id']);

                if (! $produit) {
                    throw ValidationException::withMessages(['lignes' => 'Un produit de la commande est introuvable.']);
                }

                $quantite = (float) $ligne['quantite'];
                if ($quantite <= 0) {
                    throw ValidationException::withMessages(['lignes' => 'Quantité invalide pour « '.$produit->name.' ».']);
                }

                // Pas de blocage sur le stock à la commande : le client peut
                // commander même en rupture (réapprovisionnement). Le stock
                // est vérifié et déduit à la validation par l'admin.

                // Prix figé au barème : prix de la ville si connue, sinon prix de base.
                $prixUnitaire = $produit->prixBoutique($zone?->id);
                $totalLigne = (int) round($prixUnitaire * $quantite);
                $total += $totalLigne;

                $commande->lignes()->create([
                    'produit_id' => $produit->id,
                    'designation' => $produit->name.($produit->type ? ' · '.$produit->type : ''),
                    'prix_unitaire' => $prixUnitaire,
                    'quantite' => $quantite,
                    'total_ligne' => $totalLigne,
                ]);
            }

            $commande->total = $total;
            $commande->save();

            $this->historiser($commande, null, StatutCommande::EnAttente, null, 'Commande reçue');

            return $commande->load('lignes');
        });
    }

    /**
     * Validation admin : dans UNE transaction — vérification du statut,
     * déduction du stock avec verrous, création de la facture et de la vente
     * (source boutique_en_ligne), passage en `validee`. Tout ou rien.
     */
    public function valider(Commande $commande, User $admin): Commande
    {
        return DB::transaction(function () use ($commande, $admin) {
            $commande = Commande::lockForUpdate()->with('lignes')->findOrFail($commande->id);
            $this->transition($commande, StatutCommande::Validee, $admin, null, false);

            foreach ($commande->lignes as $ligne) {
                $this->stock->deduire($ligne->produit_id, (float) $ligne->quantite, $commande, $admin);
            }

            $facture = $this->factures->creerDepuisCommande($commande, $admin);

            // Vente rattachée à la facture, source boutique — non payée,
            // encaissée à la livraison. Le stock est déjà sorti : les lignes
            // sont marquées livrées pour ne pas fausser le suivi des reliquats.
            $vente = PosSale::create([
                'number' => (string) Str::uuid(),
                'user_id' => $admin->id,
                'zone_id' => $commande->zone_id,
                'customer_name' => $commande->nom_livraison,
                'customer_phone' => $commande->telephone_livraison,
                'customer_address' => trim($commande->ville.' — '.$commande->quartier.', '.$commande->point_repere),
                'subtotal' => $commande->total,
                'discount_rate' => 0,
                'tax_type' => 'AUCUNE',
                'tax_rate' => 0,
                'tax_amount' => 0,
                'total' => $commande->total,
                'status' => 'EMISE',
                'payment_method' => 'LIVRAISON',
                'source' => 'boutique_en_ligne',
                'facture_id' => $facture->id,
            ]);
            $vente->number = 'VNT-'.now()->format('Y').'-'.str_pad((string) $vente->id, 5, '0', STR_PAD_LEFT);
            $vente->save();

            foreach ($commande->lignes as $ligne) {
                $vente->items()->create([
                    'product_id' => $ligne->produit_id,
                    'quantity' => $ligne->quantite,
                    'delivered_quantity' => $ligne->quantite,
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
        if (! $commande->chauffeur_id) {
            throw ValidationException::withMessages(['chauffeur_id' => 'Aucun chauffeur affecté à cette commande.']);
        }

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
     * Livraison réussie : signature, nom du réceptionnaire et encaissement
     * (montant + mode). La facture passe en `payee` ou `partiellement_payee`.
     */
    public function livrer(Commande $commande, array $data, User $user): Commande
    {
        return DB::transaction(function () use ($commande, $data, $user) {
            $commande = Commande::lockForUpdate()->findOrFail($commande->id);
            $this->transition($commande, StatutCommande::Livree, $user, null, false);
            $commande->save();

            $livraison = $commande->livraisons()->latest('id')->first() ?? new Livraison(['commande_id' => $commande->id]);
            $livraison->chauffeur_id = $livraison->chauffeur_id ?? $commande->chauffeur_id;
            $livraison->livree_le = now();
            $livraison->receptionnaire = $data['receptionnaire'] ?? null;

            if (! empty($data['signature'])) {
                $livraison->signature = $this->stockerSignature($data['signature'], $commande->numero);
            }
            $livraison->save();

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

    /** Échec de livraison (motif obligatoire) — replanifiable ou annulable. */
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

                foreach ($commande->lignes as $ligne) {
                    $this->stock->remettre($ligne->produit_id, (float) $ligne->quantite, $commande, $admin);
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
