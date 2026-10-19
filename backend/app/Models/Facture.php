<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

#[Fillable(['numero', 'commande_id', 'client_id', 'montant_total', 'statut_paiement', 'user_id', 'emise_le'])]
class Facture extends Model
{
    protected function casts(): array
    {
        return ['emise_le' => 'datetime'];
    }

    public function commande(): BelongsTo
    {
        return $this->belongsTo(Commande::class);
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function lignes(): HasMany
    {
        return $this->hasMany(FactureLigne::class);
    }

    public function paiements(): HasMany
    {
        return $this->hasMany(Paiement::class);
    }

    public function avoir(): HasOne
    {
        return $this->hasOne(Avoir::class);
    }

    public function vente(): HasOne
    {
        return $this->hasOne(PosSale::class, 'facture_id');
    }
}
