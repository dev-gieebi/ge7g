<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Convert tax_rate stored as a percentage (>1) to a decimal rate.
        DB::statement('UPDATE pos_sales SET tax_rate = tax_rate / 100 WHERE tax_rate > 1');

        // Recompute tax_amount and total based on the corrected decimal rate.
        DB::statement('UPDATE pos_sales SET tax_amount = ROUND(subtotal * tax_rate), total = subtotal + ROUND(subtotal * tax_rate)');
    }

    public function down(): void
    {
        // Reverse is not exact; this is a data correction migration.
        DB::statement('UPDATE pos_sales SET tax_rate = tax_rate * 100 WHERE tax_rate < 1');
        DB::statement('UPDATE pos_sales SET tax_amount = ROUND(subtotal * tax_rate), total = subtotal + ROUND(subtotal * tax_rate)');
    }
};
