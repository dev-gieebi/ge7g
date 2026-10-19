<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Le type des mouvements devient une chaîne libre (30) : permet les types de
 * la boutique en ligne (SORTIE_VENTE, RETOUR_ANNULATION) sans modifier
 * l'enum à chaque nouveau cas.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stock_movements', function (Blueprint $table) {
            $table->string('type', 30)->change();
        });
    }

    public function down(): void
    {
        Schema::table('stock_movements', function (Blueprint $table) {
            $table->enum('type', ['ENTREE', 'SORTIE', 'AJUSTEMENT', 'RESERVATION', 'LIVRAISON', 'TRANSFERT', 'VENTE'])->change();
        });
    }
};
