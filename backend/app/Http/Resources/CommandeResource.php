<?php

namespace App\Http\Resources;

use App\Models\Commande;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Vue back-office d'une commande : client, adresse complète, lignes aux prix
 * figés, stock disponible par ligne, documents liés et historique.
 *
 * @mixin Commande
 */
class CommandeResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'numero' => $this->numero,
            'statut' => $this->statut->value,
            'statut_libelle' => $this->statut->libelle(),
            'motif' => $this->motif,
            'cree_le' => $this->created_at?->toIso8601String(),
            'client' => [
                'nom' => $this->nom_livraison,
                'telephone' => $this->telephone_livraison,
            ],
            'adresse' => [
                'ville' => $this->ville,
                'quartier' => $this->quartier,
                'point_repere' => $this->point_repere,
            ],
            'note' => $this->note,
            'total' => (int) $this->total,
            'lignes' => $this->lignes->map(fn ($l) => [
                'id' => $l->id,
                'produit_id' => $l->produit_id,
                'designation' => $l->designation,
                'prix_unitaire' => (int) $l->prix_unitaire,
                'quantite' => (float) $l->quantite,
                'total_ligne' => (int) $l->total_ligne,
                'unite' => $l->produit?->unit?->symbol,
                'stock_disponible' => $l->produit ? (float) $l->produit->stock_quantity - (float) $l->produit->reserved_quantity : 0,
            ]),
            'valideur' => $this->valideur?->name,
            'validee_le' => $this->validee_le?->toIso8601String(),
            'chauffeur' => $this->chauffeur ? ['id' => $this->chauffeur->id, 'nom' => $this->chauffeur->name] : null,
            'facture' => $this->whenLoaded('facture', fn () => $this->facture ? [
                'id' => $this->facture->id,
                'numero' => $this->facture->numero,
                'statut_paiement' => $this->facture->statut_paiement,
                'montant_total' => (int) $this->facture->montant_total,
                'encaisse' => (int) $this->facture->paiements->sum('montant'),
                'avoir' => $this->facture->avoir ? ['numero' => $this->facture->avoir->numero, 'montant' => (int) $this->facture->avoir->montant] : null,
            ] : null),
            'livraison' => $this->livraison ? [
                'depart_le' => $this->livraison->depart_le?->toIso8601String(),
                'livree_le' => $this->livraison->livree_le?->toIso8601String(),
                'receptionnaire' => $this->livraison->receptionnaire,
                // Chemin storage public → URL complète affichable dans <img> (même convention que les images produits).
                'signature' => $this->livraison->signature ? url('storage/'.$this->livraison->signature) : null,
                'latitude' => $this->livraison->latitude !== null ? (float) $this->livraison->latitude : null,
                'longitude' => $this->livraison->longitude !== null ? (float) $this->livraison->longitude : null,
                'position_le' => $this->livraison->position_le?->toIso8601String(),
            ] : null,
            'historique' => $this->historique->map(fn ($h) => [
                'ancien_statut' => $h->ancien_statut?->value,
                'nouveau_statut' => $h->nouveau_statut->value,
                'nouveau_statut_libelle' => $h->nouveau_statut->libelle(),
                'user' => $h->user?->name ?? 'Client',
                'commentaire' => $h->commentaire,
                'created_at' => $h->created_at?->toIso8601String(),
            ]),
        ];
    }
}
