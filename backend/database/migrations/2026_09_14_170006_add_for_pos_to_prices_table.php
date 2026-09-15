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
        if (! Schema::hasColumn('prices', 'for_pos')) {
            Schema::table('prices', function (Blueprint $table) {
                $table->boolean('for_pos')->default(false)->after('factory_price');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasColumn('prices', 'for_pos')) {
            Schema::table('prices', function (Blueprint $table) {
                $table->dropColumn('for_pos');
            });
        }
    }
};
