<?php

namespace App\Services;

use App\Models\Avoir;
use App\Models\BonLivraison;
use App\Models\Commande;
use App\Models\Facture;
use App\Models\Livraison;
use App\Models\User;

/**
 * Création des factures boutique (FAC-xxxxxx-AAAA) à la validation d'une
 * commande, des bons de livraison (BL-xxxxx-AAAA) à la confirmation de la
 * livraison, et des avoirs (AV-xxxxx-AAAA) lors d'une annulation.
 */
class FactureService
{
    public function __construct(private readonly NumerotationService $numerotation) {}

    /**
     * Crée le bon de livraison de la commande livrée : lignes aux prix figés
     * (comme la facture), réceptionnaire et signature recueillis par le
     * chauffeur. À appeler dans la transaction de livraison.
     */
    /**
     * Bon de livraison d'un envoi : seulement les quantités envoyées
     * (`$quantites` : id de ligne => quantité). Sans `$quantites`, toutes les
     * lignes de la commande (livraison en une fois).
     *
     * @param  array<int, float>|null  $quantites
     */
    public function creerBonLivraison(Commande $commande, Livraison $livraison, User $user, ?array $quantites = null): BonLivraison
    {
        $commande->loadMissing(['lignes', 'facture']);

        $lignes = $commande->lignes
            ->map(fn ($l) => ['ligne' => $l, 'quantite' => $quantites === null ? (float) $l->quantite : (float) ($quantites[$l->id] ?? 0)])
            ->filter(fn ($x) => $x['quantite'] > 0);

        $bon = BonLivraison::create([
            'numero' => $this->numerotation->next('BL'),
            'commande_id' => $commande->id,
            'facture_id' => $commande->facture?->id,
            'client_id' => $commande->client_id,
            'livraison_id' => $livraison->id,
            'montant_total' => $quantites === null
                ? ($commande->facture?->montant_total ?? $commande->total)
                : (int) round($lignes->sum(fn ($x) => $x['quantite'] * (int) $x['ligne']->prix_unitaire)),
            'receptionnaire' => $livraison->receptionnaire,
            'signature' => $livraison->signature,
            'user_id' => $user->id,
            'livre_le' => $livraison->livree_le ?? now(),
        ]);

        foreach ($lignes as $x) {
            $bon->lignes()->create([
                'produit_id' => $x['ligne']->produit_id,
                'designation' => $x['ligne']->designation,
                'prix_unitaire' => $x['ligne']->prix_unitaire,
                'quantite' => $x['quantite'],
                'total_ligne' => (int) round($x['quantite'] * (int) $x['ligne']->prix_unitaire),
            ]);
        }

        return $bon;
    }

    /**
     * Crée la facture de la commande : lignes aux prix figés, montant total,
     * statut `non_payee`. À appeler dans la transaction de validation.
     * `$numero` : n° de la série commune caisse / en ligne (FAC-00012-2026).
     */
    public function creerDepuisCommande(Commande $commande, User $admin, ?string $numero = null): Facture
    {
        $facture = Facture::create([
            'numero' => $numero ?? $this->numerotation->next('FAC'),
            'commande_id' => $commande->id,
            'client_id' => $commande->client_id,
            'montant_total' => $commande->total,
            'statut_paiement' => 'non_payee',
            'user_id' => $admin->id,
            'emise_le' => now(),
        ]);

        foreach ($commande->lignes as $ligne) {
            $facture->lignes()->create([
                'produit_id' => $ligne->produit_id,
                'designation' => $ligne->designation,
                'prix_unitaire' => $ligne->prix_unitaire,
                'quantite' => $ligne->quantite,
                'total_ligne' => $ligne->total_ligne,
            ]);
        }

        return $facture;
    }

    /**
     * Crée l'avoir d'annulation d'une facture (obligation comptable : la
     * facture n'est jamais supprimée, elle est contre-passée par un avoir).
     */
    public function creerAvoir(Facture $facture, string $motif, User $admin): Avoir
    {
        $avoir = Avoir::create([
            'numero' => $this->numerotation->next('AV'),
            'facture_id' => $facture->id,
            'montant' => $facture->montant_total,
            'motif' => $motif,
            'user_id' => $admin->id,
        ]);

        $facture->statut_paiement = 'annulee';
        $facture->save();

        return $avoir;
    }
}
