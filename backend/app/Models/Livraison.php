<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['commande_id', 'chauffeur_id', 'depart_le', 'livree_le', 'receptionnaire', 'signature', 'latitude', 'longitude', 'position_le'])]
class Livraison extends Model
{
    protected function casts(): array
    {
        return [
            'depart_le' => 'datetime',
            'livree_le' => 'datetime',
            'position_le' => 'datetime',
            'latitude' => 'decimal:7',
            'longitude' => 'decimal:7',
        ];
    }

    public function commande(): BelongsTo
    {
        return $this->belongsTo(Commande::class);
    }

    public function chauffeur(): BelongsTo
    {
        return $this->belongsTo(User::class, 'chauffeur_id');
    }
}
