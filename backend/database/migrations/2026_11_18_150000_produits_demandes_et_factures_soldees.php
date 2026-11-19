<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Espace client :
     * - une ligne de commande peut viser un produit absent du catalogue
     *   (`produit_id` vide) : l'équipe le référence avant la validation ;
     * - une facture soldée le reste définitivement (`soldee_le`).
     */
    public function up(): void
    {
        Schema::table('commande_lignes', function (Blueprint $table) {
            $table->unsignedBigInteger('produit_id')->nullable()->change();
            $table->string('precision', 300)->nullable()->after('designation');
        });

        Schema::table('factures', function (Blueprint $table) {
            $table->timestamp('soldee_le')->nullable();
            $table->foreignId('soldee_par')->nullable()->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('factures', function (Blueprint $table) {
            $table->dropConstrainedForeignId('soldee_par');
            $table->dropColumn('soldee_le');
        });

        Schema::table('commande_lignes', function (Blueprint $table) {
            $table->dropColumn('precision');
        });
    }
};
