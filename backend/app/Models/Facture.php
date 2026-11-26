<?php

namespace App\Models;

use App\Services\NumerotationService;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

#[Fillable(['numero', 'commande_id', 'client_id', 'montant_total', 'statut_paiement', 'user_id', 'emise_le', 'soldee_le', 'soldee_par'])]
class Facture extends Model
{
    protected function casts(): array
    {
        return ['emise_le' => 'datetime', 'soldee_le' => 'datetime'];
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

    /**
     * N° de facture affiché partout (équipe, client, PDF) : celui de la vente
     * liée, comme dans la liste des ventes (VNT-2026-00011 → FAC-00011-2026).
     * Sans vente : le n° enregistré.
     */
    public function numeroAffiche(): string
    {
        return $this->vente?->number
            ? NumerotationService::affichage($this->vente->number, ['VNT' => 'FAC'])
            : (string) $this->numero;
    }
}
