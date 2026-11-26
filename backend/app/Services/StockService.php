<?php

namespace App\Services;

use App\Models\BonLivraison;
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
    /**
     * Déduit le stock d'une ligne de commande livrée (stock réel obligatoire).
     * `$bon` : bon de livraison de l'envoi, référencé sur le mouvement (suivi du stock).
     */
    public function deduire(int $produitId, float $quantite, Commande $commande, ?User $user, ?string $note = null, ?BonLivraison $bon = null): void
    {
        $produit = Product::lockForUpdate()->findOrFail($produitId);

        $disponible = (float) $produit->stock_quantity - (float) $produit->reserved_quantity;
        if ($disponible + 0.0001 < $quantite) {
            throw ValidationException::withMessages([
                'stock' => 'Stock insuffisant pour « '.$produit->name.' » : '.self::nombre(max(0, $disponible)).' en stock, '.self::nombre($quantite).' demandé(s).',
            ]);
        }

        $produit->stock_quantity = (float) $produit->stock_quantity - $quantite;
        $produit->save();

        StockMovement::create([
            'product_id' => $produit->id,
            'type' => 'SORTIE_VENTE',
            'quantity' => -$quantite,
            'balance_after' => $produit->stock_quantity,
            'reference_type' => $bon ? 'BonLivraison' : 'Commande',
            'reference_id' => $bon?->id ?? $commande->id,
            'reference_number' => $bon?->numero ?? $commande->numero,
            'note' => $note ?? 'Vente boutique en ligne '.$commande->numero,
            'user_id' => $user?->id,
        ]);
    }

    /** Vérifie, sans rien déduire, que le stock disponible couvre la quantité. */
    public function verifier(int $produitId, float $quantite): void
    {
        $produit = Product::findOrFail($produitId);
        $disponible = (float) $produit->stock_quantity - (float) $produit->reserved_quantity;

        if ($disponible + 0.0001 < $quantite) {
            throw ValidationException::withMessages([
                'stock' => 'Stock insuffisant pour « '.$produit->name.' » : '.self::nombre(max(0, $disponible)).' en stock, '.self::nombre($quantite).' commandé(s).',
            ]);
        }
    }

    /** 12.5 → « 12,5 », 3 → « 3 ». */
    public static function nombre(float $n): string
    {
        return rtrim(rtrim(number_format($n, 2, ',', ' '), '0'), ',');
    }

    /** Remet en stock les quantités sorties d'une commande annulée. */
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
