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
    public function creerBonLivraison(Commande $commande, Livraison $livraison, User $user): BonLivraison
    {
        $commande->loadMissing(['lignes', 'facture']);

        $bon = BonLivraison::create([
            'numero' => $this->numerotation->next('BL'),
            'commande_id' => $commande->id,
            'facture_id' => $commande->facture?->id,
            'client_id' => $commande->client_id,
            'livraison_id' => $livraison->id,
            'montant_total' => $commande->facture?->montant_total ?? $commande->total,
            'receptionnaire' => $livraison->receptionnaire,
            'signature' => $livraison->signature,
            'user_id' => $user->id,
            'livre_le' => $livraison->livree_le ?? now(),
        ]);

        foreach ($commande->lignes as $ligne) {
            $bon->lignes()->create([
                'produit_id' => $ligne->produit_id,
                'designation' => $ligne->designation,
                'prix_unitaire' => $ligne->prix_unitaire,
                'quantite' => $ligne->quantite,
                'total_ligne' => $ligne->total_ligne,
            ]);
        }

        return $bon;
    }

    /**
     * Crée la facture de la commande : lignes aux prix figés, montant total,
     * statut `non_payee`. À appeler dans la transaction de validation.
     */
    public function creerDepuisCommande(Commande $commande, User $admin): Facture
    {
        $facture = Facture::create([
            'numero' => $this->numerotation->next('FAC'),
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
