<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('quotes', function (Blueprint $table) {
            $table->id();
            $table->string('number')->unique();
            $table->foreignId('user_id')->constrained();
            $table->string('customer_name');
            $table->string('customer_phone')->nullable();
            $table->string('customer_address')->nullable();
            $table->decimal('subtotal', 14, 4)->default(0);
            $table->decimal('discount_rate', 8, 4)->default(0);
            $table->string('tax_type')->default('AUCUNE');
            $table->decimal('tax_rate', 8, 4)->default(0);
            $table->decimal('tax_amount', 14, 4)->default(0);
            $table->json('tax_details')->nullable();
            $table->decimal('total', 14, 4)->default(0);
            $table->string('status')->default('BROUILLON');
            $table->date('valid_until')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('quotes');
    }
};
