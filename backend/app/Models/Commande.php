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
use Illuminate\Database\Eloquent\Relations\MorphMany;

#[Fillable(['numero', 'client_id', 'user_id', 'zone_id', 'nom_livraison', 'telephone_livraison', 'ville', 'quartier', 'point_repere', 'note', 'total', 'statut', 'stock_a_la_livraison', 'motif', 'validee_par', 'validee_le', 'chauffeur_id', 'remise_taux_demande', 'remise_motif', 'remise_statut', 'remise_taux', 'remise_montant', 'client_vu_le'])]
class Commande extends Model
{
    /** @use HasFactory<CommandeFactory> */
    use HasFactory;

    protected function casts(): array
    {
        return [
            'statut' => StatutCommande::class,
            'stock_a_la_livraison' => 'boolean',
            'validee_le' => 'datetime',
            'client_vu_le' => 'datetime',
            'remise_taux_demande' => 'float',
            'remise_taux' => 'float',
        ];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    /** Compte CLIENT ayant passé la commande depuis son espace (null = boutique publique). */
    public function compte(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /** Annotations échangées entre le client et l'équipe, dans l'ordre d'écriture. */
    public function annotations(): HasMany
    {
        return $this->hasMany(CommandeAnnotation::class)->orderBy('created_at')->orderBy('id');
    }

    /** Montant des lignes avant remise. */
    public function sousTotal(): int
    {
        return (int) $this->total + (int) $this->remise_montant;
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

    /** Dernier bon de livraison émis (un par envoi). */
    public function bonLivraison(): HasOne
    {
        return $this->hasOne(BonLivraison::class)->latestOfMany();
    }

    /** Tous les bons de livraison, un par envoi (livraisons partielles). */
    public function bonsLivraison(): HasMany
    {
        return $this->hasMany(BonLivraison::class)->orderBy('id');
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

    /** Frais annexes (manutention, livraison…) imprimés sur la facture. */
    public function extras(): MorphMany
    {
        return $this->morphMany(Extra::class, 'extraable');
    }
}
