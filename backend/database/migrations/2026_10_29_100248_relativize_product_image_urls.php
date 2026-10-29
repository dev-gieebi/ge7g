<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Les `image_url` anciennes contiennent l'URL absolue du domaine au moment
 * de l'upload (https://api-ge7g.com/storage/products/…). On les convertit
 * en chemin relatif (`products/…`) : l'URL absolue est désormais générée
 * par l'accessor Product::imageUrl selon l'environnement qui sert l'API.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('products')->whereNotNull('image_url')->get()->each(function ($row) {
            if (Str::contains($row->image_url, '/storage/')) {
                DB::table('products')->where('id', $row->id)
                    ->update(['image_url' => Str::after($row->image_url, '/storage/')]);
            }
        });
    }

    public function down(): void
    {
        // Irréversible : l'URL absolue reste fonctionnelle via l'accessor.
    }
};
