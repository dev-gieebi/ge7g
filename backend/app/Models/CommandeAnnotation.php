<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Annotation libre sur une commande, écrite par le client ou par l'équipe. */
#[Fillable(['commande_id', 'user_id', 'auteur', 'contenu'])]
class CommandeAnnotation extends Model
{
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
