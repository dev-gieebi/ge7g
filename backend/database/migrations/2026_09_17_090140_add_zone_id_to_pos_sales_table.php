<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('pos_sales', 'zone_id')) {
            Schema::table('pos_sales', function (Blueprint $table) {
                $table->foreignId('zone_id')->nullable()->after('user_id')->constrained('zones')->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('pos_sales', 'zone_id')) {
            Schema::table('pos_sales', function (Blueprint $table) {
                $table->dropConstrainedForeignId('zone_id');
            });
        }
    }
};
