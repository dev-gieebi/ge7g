<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Inventaires physiques du magasin : comptage des articles (brouillon
     * modifiable), puis validation qui fige le stock théorique de chaque
     * article au moment du comptage et l'écart constaté. Le dernier comptage
     * validé alimente les colonnes « Stock réel » et « Écart » de l'état du stock.
     */
    public function up(): void
    {
        Schema::create('inventaires', function (Blueprint $table) {
            $table->id();
            $table->string('numero', 20)->unique();
            $table->string('statut', 20)->default('BROUILLON');
            $table->text('notes')->nullable();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('valide_par')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('valide_le')->nullable();
            $table->timestamps();
        });

        Schema::create('inventaire_lignes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inventaire_id')->constrained('inventaires')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->decimal('stock_compte', 15, 4);
            $table->decimal('stock_theorique', 15, 4)->nullable();
            $table->decimal('ecart', 15, 4)->nullable();
            $table->unique(['inventaire_id', 'product_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventaire_lignes');
        Schema::dropIfExists('inventaires');
    }
};
