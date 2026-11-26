<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['commande_id', 'produit_id', 'designation', 'precision', 'prix_unitaire', 'quantite', 'quantite_livree', 'total_ligne'])]
class CommandeLigne extends Model
{
    public $timestamps = false;

    protected function casts(): array
    {
        return ['quantite' => 'decimal:4', 'quantite_livree' => 'decimal:4'];
    }

    /** Quantité restant à livrer. */
    public function reste(): float
    {
        return max(0.0, (float) $this->quantite - (float) $this->quantite_livree);
    }

    public function commande(): BelongsTo
    {
        return $this->belongsTo(Commande::class);
    }

    public function produit(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'produit_id');
    }
}
