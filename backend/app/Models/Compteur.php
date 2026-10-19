<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['type', 'annee', 'valeur'])]
class Compteur extends Model
{
    public $timestamps = false;
}
