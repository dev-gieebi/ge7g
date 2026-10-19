<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Boutique en ligne : clients, commandes et leur historique, factures,
     * avoirs, paiements, livraisons, compteurs de numérotation, et extension
     * des ventes (source boutique) et des produits (vitrine).
     */
    public function up(): void
    {
        // Numérotation annuelle des documents (CMD, FAC, AV) avec verrou.
        Schema::create('compteurs', function (Blueprint $table) {
            $table->id();
            $table->string('type', 10);
            $table->unsignedSmallInteger('annee');
            $table->unsignedBigInteger('valeur')->default(0);
            $table->unique(['type', 'annee']);
        });

        Schema::create('clients', function (Blueprint $table) {
            $table->id();
            $table->string('nom');
            $table->string('telephone')->unique();
            $table->string('adresse')->nullable();
            $table->string('source', 30)->default('boutique_en_ligne');
            $table->timestamps();
        });

        Schema::create('commandes', function (Blueprint $table) {
            $table->id();
            $table->string('numero', 20)->unique();
            $table->foreignId('client_id')->constrained('clients');
            $table->foreignId('zone_id')->nullable()->constrained('zones')->nullOnDelete();
            $table->string('nom_livraison');
            $table->string('telephone_livraison');
            $table->string('ville');
            $table->string('quartier');
            $table->string('point_repere');
            $table->string('note', 500)->nullable();
            $table->unsignedBigInteger('total')->default(0);
            $table->string('statut', 20)->default('en_attente');
            $table->string('motif', 500)->nullable();
            $table->foreignId('validee_par')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('validee_le')->nullable();
            $table->foreignId('chauffeur_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['statut', 'created_at']);
        });

        Schema::create('commande_lignes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('commande_id')->constrained('commandes')->cascadeOnDelete();
            $table->foreignId('produit_id')->constrained('products');
            $table->string('designation');
            $table->unsignedBigInteger('prix_unitaire');
            $table->decimal('quantite', 15, 4);
            $table->unsignedBigInteger('total_ligne');
        });

        Schema::create('commande_historique', function (Blueprint $table) {
            $table->id();
            $table->foreignId('commande_id')->constrained('commandes')->cascadeOnDelete();
            $table->string('ancien_statut', 20)->nullable();
            $table->string('nouveau_statut', 20);
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('commentaire', 500)->nullable();
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('factures', function (Blueprint $table) {
            $table->id();
            $table->string('numero', 20)->unique();
            $table->foreignId('commande_id')->unique()->constrained('commandes');
            $table->foreignId('client_id')->constrained('clients');
            $table->unsignedBigInteger('montant_total');
            $table->string('statut_paiement', 25)->default('non_payee');
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('emise_le')->useCurrent();
            $table->timestamps();
        });

        Schema::create('facture_lignes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('facture_id')->constrained('factures')->cascadeOnDelete();
            $table->foreignId('produit_id')->nullable()->constrained('products')->nullOnDelete();
            $table->string('designation');
            $table->unsignedBigInteger('prix_unitaire');
            $table->decimal('quantite', 15, 4);
            $table->unsignedBigInteger('total_ligne');
        });

        Schema::create('avoirs', function (Blueprint $table) {
            $table->id();
            $table->string('numero', 20)->unique();
            $table->foreignId('facture_id')->constrained('factures');
            $table->unsignedBigInteger('montant');
            $table->string('motif', 500);
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('paiements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('facture_id')->constrained('factures');
            $table->unsignedBigInteger('montant');
            $table->string('mode', 30);
            $table->foreignId('encaisse_par')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('encaisse_le')->useCurrent();
            $table->timestamps();
        });

        Schema::create('livraisons', function (Blueprint $table) {
            $table->id();
            $table->foreignId('commande_id')->constrained('commandes');
            $table->foreignId('chauffeur_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('depart_le')->nullable();
            $table->timestamp('livree_le')->nullable();
            $table->string('receptionnaire')->nullable();
            $table->string('signature')->nullable();
            $table->timestamps();
        });

        Schema::table('pos_sales', function (Blueprint $table) {
            $table->string('source', 20)->default('caisse')->after('status');
            $table->boolean('annulee')->default(false)->after('source');
            $table->foreignId('facture_id')->nullable()->after('annulee')->constrained('factures')->nullOnDelete();
        });

        Schema::table('products', function (Blueprint $table) {
            $table->boolean('visible_boutique')->default(false)->after('image_url');
            $table->text('description_publique')->nullable()->after('visible_boutique');
            $table->boolean('mis_en_avant')->default(false)->after('description_publique');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn(['visible_boutique', 'description_publique', 'mis_en_avant']);
        });

        Schema::table('pos_sales', function (Blueprint $table) {
            $table->dropConstrainedForeignId('facture_id');
            $table->dropColumn(['source', 'annulee']);
        });

        Schema::dropIfExists('livraisons');
        Schema::dropIfExists('paiements');
        Schema::dropIfExists('avoirs');
        Schema::dropIfExists('facture_lignes');
        Schema::dropIfExists('factures');
        Schema::dropIfExists('commande_historique');
        Schema::dropIfExists('commande_lignes');
        Schema::dropIfExists('commandes');
        Schema::dropIfExists('clients');
        Schema::dropIfExists('compteurs');
    }
};
