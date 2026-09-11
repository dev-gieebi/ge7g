<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pos_sales', function (Blueprint $table) {
            $table->id();
            $table->string('number', 50)->unique();
            $table->foreignId('user_id')->constrained('users');
            $table->string('customer_name', 120)->nullable();
            $table->decimal('subtotal', 15, 4)->default(0);
            $table->string('tax_type', 30)->default('AUCUNE');
            $table->decimal('tax_rate', 8, 4)->default(0);
            $table->decimal('tax_amount', 15, 4)->default(0);
            $table->decimal('total', 15, 4)->default(0);
            $table->string('payment_method', 30);
            $table->decimal('amount_received', 15, 4)->nullable();
            $table->string('status', 30)->default('PAYEE');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pos_sales');
    }
};
