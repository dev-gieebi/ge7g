<?php

namespace App\Services;

use App\Models\Commande;
use App\Models\Product;
use App\Models\StockMovement;
use App\Models\User;
use Illuminate\Validation\ValidationException;

/**
 * Mouvements de stock de la boutique : déduction à la validation d'une
 * commande et remise en stock à l'annulation. Le produit est verrouillé
 * (`lockForUpdate`) dans la transaction appelante.
 */
class StockService
{
    /** Déduit le stock d'une ligne de commande validée. */
    public function deduire(int $produitId, float $quantite, Commande $commande, ?User $user): void
    {
        $produit = Product::lockForUpdate()->findOrFail($produitId);

        $disponible = (float) $produit->stock_quantity - (float) $produit->reserved_quantity;
        if ($disponible < $quantite) {
            throw ValidationException::withMessages([
                'stock' => "Stock insuffisant pour « {$produit->name} » : {$disponible} disponible(s), {$quantite} demandée(s).",
            ]);
        }

        $produit->stock_quantity = (float) $produit->stock_quantity - $quantite;
        $produit->save();

        StockMovement::create([
            'product_id' => $produit->id,
            'type' => 'SORTIE_VENTE',
            'quantity' => -$quantite,
            'balance_after' => $produit->stock_quantity,
            'reference_type' => 'Commande',
            'reference_id' => $commande->id,
            'reference_number' => $commande->numero,
            'note' => 'Vente boutique en ligne '.$commande->numero,
            'user_id' => $user?->id,
        ]);
    }

    /** Remet en stock les quantités d'une commande annulée après validation. */
    public function remettre(int $produitId, float $quantite, Commande $commande, ?User $user): void
    {
        $produit = Product::lockForUpdate()->findOrFail($produitId);
        $produit->stock_quantity = (float) $produit->stock_quantity + $quantite;
        $produit->save();

        StockMovement::create([
            'product_id' => $produit->id,
            'type' => 'RETOUR_ANNULATION',
            'quantity' => $quantite,
            'balance_after' => $produit->stock_quantity,
            'reference_type' => 'Commande',
            'reference_id' => $commande->id,
            'reference_number' => $commande->numero,
            'note' => 'Retour annulation commande '.$commande->numero,
            'user_id' => $user?->id,
        ]);
    }
}
