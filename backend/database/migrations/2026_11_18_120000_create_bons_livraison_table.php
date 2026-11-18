<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Bon de livraison : document créé automatiquement à la confirmation de
     * la livraison (tablette du chauffeur), sur le même modèle que la
     * facture, numéro annuel BL-xxxxx-AAAA, lignes figées, réceptionnaire
     * et signature. Il reste consultable par le client dans son historique.
     */
    public function up(): void
    {
        Schema::create('bons_livraison', function (Blueprint $table) {
            $table->id();
            $table->string('numero', 20)->unique();
            $table->foreignId('commande_id')->unique()->constrained('commandes');
            $table->foreignId('facture_id')->nullable()->constrained('factures')->nullOnDelete();
            $table->foreignId('client_id')->constrained('clients');
            $table->foreignId('livraison_id')->nullable()->constrained('livraisons')->nullOnDelete();
            $table->unsignedBigInteger('montant_total');
            $table->string('receptionnaire')->nullable();
            $table->string('signature')->nullable();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('livre_le')->useCurrent();
            $table->timestamps();
        });

        Schema::create('bon_livraison_lignes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bon_livraison_id')->constrained('bons_livraison')->cascadeOnDelete();
            $table->foreignId('produit_id')->nullable()->constrained('products')->nullOnDelete();
            $table->string('designation');
            $table->unsignedBigInteger('prix_unitaire');
            $table->decimal('quantite', 15, 4);
            $table->unsignedBigInteger('total_ligne');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bon_livraison_lignes');
        Schema::dropIfExists('bons_livraison');
    }
};
