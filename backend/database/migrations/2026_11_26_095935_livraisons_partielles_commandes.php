<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Livraisons partielles des commandes en ligne : le stock sort à chaque
     * livraison (et non plus à la validation), quantité livrée suivie par
     * ligne, plusieurs bons de livraison par commande.
     *
     * Les commandes déjà validées avant ce changement ont vu leur stock
     * déduit en totalité à la validation : `stock_a_la_livraison` = false
     * pour elles, afin de ne jamais déduire deux fois.
     */
    public function up(): void
    {
        Schema::table('commande_lignes', function (Blueprint $table) {
            $table->decimal('quantite_livree', 15, 4)->default(0)->after('quantite');
        });

        Schema::table('commandes', function (Blueprint $table) {
            $table->boolean('stock_a_la_livraison')->default(true)->after('statut');
        });

        DB::table('commandes')
            ->whereIn('statut', ['validee', 'en_preparation', 'en_livraison', 'livree', 'echec_livraison', 'annulee'])
            ->update(['stock_a_la_livraison' => false]);

        // Commandes déjà livrées : tout est livré.
        $livrees = DB::table('commandes')->where('statut', 'livree')->pluck('id');
        if ($livrees->isNotEmpty()) {
            DB::table('commande_lignes')->whereIn('commande_id', $livrees)->update(['quantite_livree' => DB::raw('quantite')]);
        }

        // Plusieurs bons de livraison par commande (un par envoi).
        Schema::table('bons_livraison', function (Blueprint $table) {
            $table->dropForeign(['commande_id']);
            $table->dropUnique(['commande_id']);
        });
        Schema::table('bons_livraison', function (Blueprint $table) {
            $table->foreign('commande_id')->references('id')->on('commandes');
        });
    }

    public function down(): void
    {
        Schema::table('bons_livraison', function (Blueprint $table) {
            $table->dropForeign(['commande_id']);
            $table->unique('commande_id');
            $table->foreign('commande_id')->references('id')->on('commandes');
        });

        Schema::table('commandes', function (Blueprint $table) {
            $table->dropColumn('stock_a_la_livraison');
        });

        Schema::table('commande_lignes', function (Blueprint $table) {
            $table->dropColumn('quantite_livree');
        });
    }
};
