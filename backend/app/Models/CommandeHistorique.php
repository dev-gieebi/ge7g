<?php

namespace App\Models;

use App\Enums\StatutCommande;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['commande_id', 'ancien_statut', 'nouveau_statut', 'user_id', 'commentaire'])]
class CommandeHistorique extends Model
{
    public $timestamps = false;

    protected $table = 'commande_historique';

    protected function casts(): array
    {
        return [
            'ancien_statut' => StatutCommande::class,
            'nouveau_statut' => StatutCommande::class,
            'created_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
