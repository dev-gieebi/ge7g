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
        Schema::table('pos_sales', function (Blueprint $table) {
            $table->json('extras')->nullable()->after('total');
        });

        Schema::table('commandes', function (Blueprint $table) {
            $table->json('extras')->nullable()->after('total');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('pos_sales', function (Blueprint $table) {
            $table->dropColumn('extras');
        });

        Schema::table('commandes', function (Blueprint $table) {
            $table->dropColumn('extras');
        });
    }
};
