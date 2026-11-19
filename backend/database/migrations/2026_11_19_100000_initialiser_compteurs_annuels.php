<?php

use App\Models\Compteur;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Ventes (VNT), proformas (DEV) et bons d'achat (ACH) passent sur la
     * numérotation annuelle (repart à 1 chaque année). Les compteurs de
     * chaque année déjà utilisée reprennent au plus grand n° existant, pour
     * ne jamais réattribuer un n° déjà émis.
     */
    public function up(): void
    {
        foreach (['VNT' => 'pos_sales', 'DEV' => 'quotes', 'ACH' => 'purchases'] as $type => $table) {
            $maxParAnnee = [];

            foreach (DB::table($table)->where('number', 'like', $type.'-%')->pluck('number') as $numero) {
                if (preg_match('/^'.$type.'-(\d{4})-(\d+)$/', $numero, $m)) {
                    $maxParAnnee[(int) $m[1]] = max($maxParAnnee[(int) $m[1]] ?? 0, (int) $m[2]);
                }
            }

            foreach ($maxParAnnee as $annee => $max) {
                $compteur = Compteur::firstOrNew(['type' => $type, 'annee' => $annee]);
                $compteur->valeur = max((int) $compteur->valeur, $max);
                $compteur->save();
            }
        }
    }

    public function down(): void
    {
        Compteur::whereIn('type', ['VNT', 'DEV', 'ACH'])->delete();
    }
};
