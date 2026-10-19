<?php

namespace App\Services;

use App\Models\Avoir;
use App\Models\Commande;
use App\Models\Facture;
use App\Models\User;

/**
 * Création des factures boutique (FAC-xxxxxx-AAAA) à la validation d'une
 * commande, et des avoirs (AV-xxxxx-AAAA) lors d'une annulation.
 */
class FactureService
{
    public function __construct(private readonly NumerotationService $numerotation) {}

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
