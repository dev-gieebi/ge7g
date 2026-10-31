<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/** Frais annexe (manutention, livraison…) rattaché à une vente ou une commande. */
#[Fillable(['label', 'amount'])]
class Extra extends Model
{
    /** Champs techniques masqués : l'API n'expose que label + amount. */
    protected $hidden = ['id', 'extraable_type', 'extraable_id', 'created_at', 'updated_at'];

    protected function casts(): array
    {
        return ['amount' => 'float'];
    }

    public function extraable(): MorphTo
    {
        return $this->morphTo();
    }
}
