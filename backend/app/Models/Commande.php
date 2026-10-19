<?php

namespace App\Models;

use App\Enums\StatutCommande;
use Database\Factories\CommandeFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

#[Fillable(['numero', 'client_id', 'zone_id', 'nom_livraison', 'telephone_livraison', 'ville', 'quartier', 'point_repere', 'note', 'total', 'statut', 'motif', 'validee_par', 'validee_le', 'chauffeur_id'])]
class Commande extends Model
{
    /** @use HasFactory<CommandeFactory> */
    use HasFactory;

    protected function casts(): array
    {
        return [
            'statut' => StatutCommande::class,
            'validee_le' => 'datetime',
        ];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function zone(): BelongsTo
    {
        return $this->belongsTo(Zone::class);
    }

    public function lignes(): HasMany
    {
        return $this->hasMany(CommandeLigne::class);
    }

    public function historique(): HasMany
    {
        return $this->hasMany(CommandeHistorique::class)->orderBy('created_at');
    }

    public function facture(): HasOne
    {
        return $this->hasOne(Facture::class);
    }

    public function livraison(): HasOne
    {
        return $this->hasOne(Livraison::class)->latestOfMany();
    }

    /** Toutes les livraisons (plusieurs en cas d'échec replanifié). */
    public function livraisons(): HasMany
    {
        return $this->hasMany(Livraison::class);
    }

    public function valideur(): BelongsTo
    {
        return $this->belongsTo(User::class, 'validee_par');
    }

    public function chauffeur(): BelongsTo
    {
        return $this->belongsTo(User::class, 'chauffeur_id');
    }
}
