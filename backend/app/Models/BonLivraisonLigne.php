<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['bon_livraison_id', 'produit_id', 'designation', 'prix_unitaire', 'quantite', 'total_ligne'])]
class BonLivraisonLigne extends Model
{
    public $timestamps = false;
}
