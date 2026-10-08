<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $taxes = DB::table('taxes')->get()->keyBy('type');

        DB::table('pos_sales')->whereNull('tax_details')->orderBy('id')->each(function ($sale) use ($taxes) {
            $types = array_filter(array_map('trim', explode('+', (string) $sale->tax_type)));
            $discountAmount = round((float) $sale->subtotal * (float) $sale->discount_rate / 100);
            $netSubtotal = (float) $sale->subtotal - $discountAmount;

            $details = [];
            $taxAmount = 0;
            foreach ($types as $type) {
                $tax = $taxes->get($type);
                if (! $tax) {
                    continue;
                }
                $signedRate = $type === 'TPS' ? -(float) $tax->rate : (float) $tax->rate;
                $amount = (int) round($netSubtotal * $signedRate / 100);
                $taxAmount += $amount;
                $details[] = ['type' => $tax->type, 'name' => $tax->name, 'rate' => (float) $tax->rate, 'amount' => $amount];
            }

            if ($details) {
                DB::table('pos_sales')->where('id', $sale->id)->update([
                    'tax_details' => json_encode($details),
                    'tax_amount' => $taxAmount,
                    'total' => $netSubtotal + $taxAmount,
                ]);
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        //
    }
};
