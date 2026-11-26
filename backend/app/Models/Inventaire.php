<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Inventaire physique : comptage des articles en magasin (BROUILLON tant
 * qu'il est en cours, VALIDE une fois les écarts figés).
 */
#[Fillable(['numero', 'statut', 'notes', 'user_id', 'valide_par', 'valide_le'])]
class Inventaire extends Model
{
    public const BROUILLON = 'BROUILLON';

    public const VALIDE = 'VALIDE';

    protected function casts(): array
    {
        return ['valide_le' => 'datetime'];
    }

    public function lignes(): HasMany
    {
        return $this->hasMany(InventaireLigne::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function validePar(): BelongsTo
    {
        return $this->belongsTo(User::class, 'valide_par');
    }

    public function estBrouillon(): bool
    {
        return $this->statut === self::BROUILLON;
    }
}
