<?php

use App\Services\NumerotationService;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Factures des commandes en ligne émises avant la série commune : elles
     * avaient leur propre compteur (FAC-00001-2026) alors que la vente
     * associée, visible dans la liste des ventes, porte le n° VNT-2026-00012
     * (facture FAC-00012-2026). Chaque facture prend le n° de sa vente, pour
     * que le client voie le même numéro que l'équipe.
     *
     * Deux passes (n° provisoire puis définitif) : un ancien n° peut être
     * celui qu'une autre facture doit recevoir (contrainte d'unicité).
     */
    public function up(): void
    {
        $cibles = DB::table('factures')
            ->join('pos_sales', 'pos_sales.facture_id', '=', 'factures.id')
            ->select('factures.id', 'factures.numero', 'pos_sales.number as vente')
            ->get()
            ->map(fn ($f) => ['id' => $f->id, 'ancien' => $f->numero, 'nouveau' => NumerotationService::affichage($f->vente, ['VNT' => 'FAC'])])
            ->filter(fn (array $f) => $f['nouveau'] !== $f['ancien'] && str_starts_with($f['nouveau'], 'FAC-'));

        if ($cibles->isEmpty()) {
            return;
        }

        // Un n° cible déjà porté par une facture qui ne change pas : on la laisse
        // telle quelle (aucun doublon possible).
        $fixes = DB::table('factures')->whereNotIn('id', $cibles->pluck('id'))->pluck('numero')->all();
        $cibles = $cibles->reject(fn (array $f) => in_array($f['nouveau'], $fixes, true));

        DB::transaction(function () use ($cibles) {
            foreach ($cibles as $f) {
                DB::table('factures')->where('id', $f['id'])->update(['numero' => 'TMP-'.$f['id']]);
            }
            foreach ($cibles as $f) {
                DB::table('factures')->where('id', $f['id'])->update(['numero' => $f['nouveau']]);
            }
        });
    }

    /** Renumérotation définitive : pas de retour arrière. */
    public function down(): void {}
};
