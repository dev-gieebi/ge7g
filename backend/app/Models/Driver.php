<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['user_id', 'name', 'phone', 'license_number', 'status'])]
class Driver extends Model
{
    /** Statuts : DISPONIBLE, EN_MISSION, INDISPONIBLE. */
    public const STATUTS = ['DISPONIBLE', 'EN_MISSION', 'INDISPONIBLE'];

    /** Compte plateforme (rôle CHAUFFEUR) créé avec la fiche. */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
