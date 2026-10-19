<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['facture_id', 'montant', 'mode', 'encaisse_par', 'encaisse_le'])]
class Paiement extends Model
{
    protected function casts(): array
    {
        return ['encaisse_le' => 'datetime'];
    }

    public function facture(): BelongsTo
    {
        return $this->belongsTo(Facture::class);
    }

    public function encaisseur(): BelongsTo
    {
        return $this->belongsTo(User::class, 'encaisse_par');
    }
}
