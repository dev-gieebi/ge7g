<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Vente soldée : enregistrée (tampon « Soldé » sur la facture), ne disparaît plus au rechargement. */
    public function up(): void
    {
        Schema::table('pos_sales', function (Blueprint $table) {
            $table->timestamp('soldee_le')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('pos_sales', function (Blueprint $table) {
            $table->dropColumn('soldee_le');
        });
    }
};
