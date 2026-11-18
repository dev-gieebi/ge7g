<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Bon de livraison d'une commande livrée (même structure que la facture). */
#[Fillable(['numero', 'commande_id', 'facture_id', 'client_id', 'livraison_id', 'montant_total', 'receptionnaire', 'signature', 'user_id', 'livre_le'])]
class BonLivraison extends Model
{
    protected $table = 'bons_livraison';

    protected function casts(): array
    {
        return ['livre_le' => 'datetime'];
    }

    public function commande(): BelongsTo
    {
        return $this->belongsTo(Commande::class);
    }

    public function facture(): BelongsTo
    {
        return $this->belongsTo(Facture::class);
    }

    public function lignes(): HasMany
    {
        return $this->hasMany(BonLivraisonLigne::class);
    }
}
