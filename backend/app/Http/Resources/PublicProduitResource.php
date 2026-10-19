<?php

namespace App\Http\Resources;

use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Vue publique d'un produit boutique. Jamais exposés : prix d'achat, marges,
 * stock exact — seulement la disponibilité en trois états.
 *
 * @mixin Product
 */
class PublicProduitResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $disponible = (float) $this->stock_quantity - (float) $this->reserved_quantity;

        return [
            'id' => $this->id,
            'reference' => $this->reference,
            'designation' => $this->name.($this->type ? ' · '.$this->type : ''),
            'description' => $this->description_publique,
            'categorie' => $this->category?->name,
            'prix' => $this->prixBoutique(is_numeric($request->input('zone')) ? (int) $request->input('zone') : null),
            'unite' => $this->unit?->symbol,
            'image' => $this->image_url,
            'mis_en_avant' => (bool) $this->mis_en_avant,
            'disponibilite' => $disponible <= 0 ? 'rupture' : ($disponible <= (float) $this->min_stock ? 'stock_limite' : 'disponible'),
        ];
    }
}
