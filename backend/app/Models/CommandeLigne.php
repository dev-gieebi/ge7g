<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['commande_id', 'produit_id', 'designation', 'prix_unitaire', 'quantite', 'total_ligne'])]
class CommandeLigne extends Model
{
    public $timestamps = false;

    protected function casts(): array
    {
        return ['quantite' => 'decimal:4'];
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
