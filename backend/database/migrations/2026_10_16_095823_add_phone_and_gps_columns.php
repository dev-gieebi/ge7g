<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Téléphone des utilisateurs (chauffeurs) et position GPS temps réel de
     * la livraison en cours — saisie par le chauffeur, affichée sur la
     * carte de suivi client.
     */
    public function up(): void
    {
        // La colonne existe déjà sur certaines bases (ajout manuel) — garde-fou.
        if (! Schema::hasColumn('users', 'phone')) {
            Schema::table('users', function (Blueprint $table) {
                $table->string('phone', 30)->nullable()->after('name');
            });
        }

        Schema::table('livraisons', function (Blueprint $table) {
            $table->decimal('latitude', 10, 7)->nullable()->after('signature');
            $table->decimal('longitude', 10, 7)->nullable()->after('latitude');
            $table->timestamp('position_le')->nullable()->after('longitude');
        });
    }

    public function down(): void
    {
        Schema::table('livraisons', function (Blueprint $table) {
            $table->dropColumn(['latitude', 'longitude', 'position_le']);
        });
    }
};
