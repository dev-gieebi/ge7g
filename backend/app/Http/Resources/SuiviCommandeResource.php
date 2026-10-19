<?php

namespace App\Http\Resources;

use App\Enums\StatutCommande;
use App\Models\Commande;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Vue publique de suivi : frise des étapes, récapitulatif et motif en cas
 * de refus/échec/annulation. Jamais exposés : données d'autres clients,
 * numéro personnel du chauffeur (prénom uniquement).
 *
 * @mixin Commande
 */
class SuiviCommandeResource extends JsonResource
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

        return [
            'numero' => $this->numero,
            'statut' => $this->statut->value,
            'statut_libelle' => $this->statut->libelle(),
            'motif' => in_array($this->statut, [StatutCommande::Refusee, StatutCommande::EchecLivraison, StatutCommande::Annulee], true) ? $this->motif : null,
            'cree_le' => $this->created_at?->toIso8601String(),
            'etapes' => $etapes,
            'lignes' => $this->lignes->map(fn ($l) => [
                'designation' => $l->designation,
                'prix_unitaire' => (int) $l->prix_unitaire,
                'quantite' => (float) $l->quantite,
                'total_ligne' => (int) $l->total_ligne,
            ]),
            'total' => (int) $this->total,
            'ville' => $this->ville,
            'quartier' => $this->quartier,
            // Prénom du chauffeur uniquement, une fois en livraison.
            'chauffeur' => $this->statut === StatutCommande::EnLivraison || $this->statut === StatutCommande::Livree
                ? ($this->chauffeur ? explode(' ', trim($this->chauffeur->name))[0] : null)
                : null,
            // Position du chauffeur, uniquement pendant la livraison.
            'position' => $this->statut === StatutCommande::EnLivraison && $this->livraison?->latitude !== null
                ? [
                    'latitude' => (float) $this->livraison->latitude,
                    'longitude' => (float) $this->livraison->longitude,
                    'maj_le' => $this->livraison->position_le?->toIso8601String(),
                ]
                : null,
        ];
    }
}
