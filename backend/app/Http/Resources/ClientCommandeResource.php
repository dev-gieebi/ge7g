<?php

namespace App\Http\Resources;

use App\Enums\StatutCommande;
use App\Models\Commande;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Vue d'une commande dans l'espace client : frise de suivi, lignes aux prix
 * figés, remise, annotations, journal et, une fois livrée, les données du
 * bon de livraison. Jamais exposés : le stock, les noms du personnel, les
 * données d'autres clients.
 *
 * @mixin Commande
 */
class ClientCommandeResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $etapes = [];
        foreach (StatutCommande::frise() as $statut) {
            $h = $this->historique->firstWhere('nouveau_statut', $statut);
            $etapes[] = [
                'statut' => $statut->value,
                'libelle' => $statut->libelle(),
                'franchie_le' => $h?->created_at?->toIso8601String(),
            ];
        }

        $livree = $this->statut === StatutCommande::Livree;

        return [
            'id' => $this->id,
            'numero' => $this->numero,
            'statut' => $this->statut->value,
            'statut_libelle' => $this->statut->libelle(),
            'motif' => in_array($this->statut, [StatutCommande::Refusee, StatutCommande::EchecLivraison, StatutCommande::Annulee], true) ? $this->motif : null,
            'cree_le' => $this->created_at?->toIso8601String(),
            'validee_le' => $this->validee_le?->toIso8601String(),
            'etapes' => $etapes,
            'client' => ['nom' => $this->nom_livraison, 'telephone' => $this->telephone_livraison],
            'adresse' => ['ville' => $this->ville, 'quartier' => $this->quartier, 'point_repere' => $this->point_repere],
            'note' => $this->note,
            'lignes' => $this->lignes->map(fn ($l) => [
                'id' => $l->id,
                'designation' => $l->designation,
                'prix_unitaire' => (int) $l->prix_unitaire,
                'quantite' => (float) $l->quantite,
                'total_ligne' => (int) $l->total_ligne,
                'unite' => $l->produit?->unit?->symbol,
            ]),
            'sous_total' => $this->sousTotal(),
            'remise' => [
                'statut' => $this->remise_statut,
                'taux_demande' => $this->remise_taux_demande,
                'motif' => $this->remise_motif,
                'taux' => (float) $this->remise_taux,
                'montant' => (int) $this->remise_montant,
            ],
            'total' => (int) $this->total,
            'extras' => $this->extras->map(fn ($e) => ['label' => $e->label, 'amount' => (float) $e->amount])->values(),
            'facture' => $this->facture ? [
                'numero' => $this->facture->numero,
                'statut_paiement' => $this->facture->statut_paiement,
                'montant_total' => (int) $this->facture->montant_total,
                'encaisse' => (int) $this->facture->paiements->sum('montant'),
            ] : null,
            // Prénom du chauffeur uniquement, une fois en livraison.
            'chauffeur' => in_array($this->statut, [StatutCommande::EnLivraison, StatutCommande::Livree], true) && $this->chauffeur
                ? explode(' ', trim($this->chauffeur->name))[0]
                : null,
            'position' => $this->statut === StatutCommande::EnLivraison && $this->livraison?->latitude !== null
                ? [
                    'latitude' => (float) $this->livraison->latitude,
                    'longitude' => (float) $this->livraison->longitude,
                    'maj_le' => $this->livraison->position_le?->toIso8601String(),
                ]
                : null,
            // Bon de livraison : disponible une fois la livraison confirmée. La
            // signature du réceptionnaire reste interne (agents G-ENERGIE 7).
            'livraison' => $livree && $this->livraison ? [
                'livree_le' => $this->livraison->livree_le?->toIso8601String(),
                'receptionnaire' => $this->livraison->receptionnaire,
            ] : null,
            // Document généré à la livraison, conservé dans l'historique du client.
            'bon_livraison' => $this->bonLivraison ? [
                'numero' => $this->bonLivraison->numero,
                'livre_le' => $this->bonLivraison->livre_le?->toIso8601String(),
                'receptionnaire' => $this->bonLivraison->receptionnaire,
            ] : null,
            'annotations' => $this->annotations->map(fn ($a) => [
                'id' => $a->id,
                'auteur' => $a->auteur,
                'nom' => $a->auteur === 'client' ? 'Vous' : 'G-ENERGIE 7',
                'contenu' => $a->contenu,
                'created_at' => $a->created_at?->toIso8601String(),
            ]),
            'journal' => $this->historique->map(fn ($h) => [
                'libelle' => $h->nouveau_statut->libelle(),
                // Le nom complet du chauffeur reste interne.
                'commentaire' => str_starts_with((string) $h->commentaire, 'Chauffeur affecté') ? 'Chauffeur affecté' : $h->commentaire,
                'created_at' => $h->created_at?->toIso8601String(),
            ]),
        ];
    }
}
