<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Espace client connecté : ville d'accès du compte CLIENT (null = toutes
     * les villes), rattachement des commandes au compte, demande de remise,
     * annotations échangées entre le client et l'équipe, et date de dernière
     * consultation (pour signaler au client les nouveautés de sa commande).
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('zone_id')->nullable()->after('driver_id')->constrained('zones')->nullOnDelete();
        });

        Schema::table('commandes', function (Blueprint $table) {
            $table->foreignId('user_id')->nullable()->after('client_id')->constrained('users')->nullOnDelete();
            $table->decimal('remise_taux_demande', 5, 2)->nullable()->after('total');
            $table->string('remise_motif', 500)->nullable()->after('remise_taux_demande');
            $table->string('remise_statut', 15)->nullable()->after('remise_motif');
            $table->decimal('remise_taux', 5, 2)->default(0)->after('remise_statut');
            $table->unsignedBigInteger('remise_montant')->default(0)->after('remise_taux');
            $table->timestamp('client_vu_le')->nullable()->after('chauffeur_id');
        });

        Schema::create('commande_annotations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('commande_id')->constrained('commandes')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            // « client » ou « equipe » : qui a écrit l'annotation.
            $table->string('auteur', 10);
            $table->string('contenu', 1000);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('commande_annotations');

        Schema::table('commandes', function (Blueprint $table) {
            $table->dropConstrainedForeignId('user_id');
            $table->dropColumn(['remise_taux_demande', 'remise_motif', 'remise_statut', 'remise_taux', 'remise_montant', 'client_vu_le']);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('zone_id');
        });
    }
};
