<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['facture_id', 'produit_id', 'designation', 'prix_unitaire', 'quantite', 'total_ligne'])]
class FactureLigne extends Model
{
    public $timestamps = false;

    protected function casts(): array
    {
        return ['quantite' => 'decimal:4'];
    }

    public function facture(): BelongsTo
    {
        return $this->belongsTo(Facture::class);
    }
}
