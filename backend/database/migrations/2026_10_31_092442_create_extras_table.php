<?php

use App\Models\Commande;
use App\Models\PosSale;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('extras', function (Blueprint $table) {
            $table->id();
            $table->morphs('extraable');
            $table->string('label', 80);
            $table->decimal('amount', 14, 2);
            $table->timestamps();
        });

        // Reprend les frais enregistrés dans la colonne JSON avant sa suppression.
        foreach (['pos_sales' => PosSale::class, 'commandes' => Commande::class] as $tableName => $model) {
            DB::table($tableName)->whereNotNull('extras')->get()->each(function (object $row) use ($model) {
                foreach (json_decode($row->extras, true) ?: [] as $extra) {
                    if (empty($extra['label']) || (float) ($extra['amount'] ?? 0) <= 0) {
                        continue;
                    }
                    DB::table('extras')->insert([
                        'extraable_type' => $model,
                        'extraable_id' => $row->id,
                        'label' => $extra['label'],
                        'amount' => $extra['amount'],
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
            });

            Schema::table($tableName, function (Blueprint $table) {
                $table->dropColumn('extras');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('extras');

        Schema::table('pos_sales', function (Blueprint $table) {
            $table->json('extras')->nullable()->after('total');
        });

        Schema::table('commandes', function (Blueprint $table) {
            $table->json('extras')->nullable()->after('total');
        });
    }
};
