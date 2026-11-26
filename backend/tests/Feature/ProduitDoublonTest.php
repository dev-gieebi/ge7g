<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Product;
use App\Models\Unit;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Un produit de même désignation (et même type) ne peut pas être enregistré deux fois. */
class ProduitDoublonTest extends TestCase
{
    use RefreshDatabase;

    public function test_doublon_refuse_a_la_creation_et_a_la_modification(): void
    {
        $admin = User::factory()->create(['role' => 'DG_ADMIN']);
        $categorie = Category::firstOrCreate(['slug' => 'tests'], ['name' => 'Tests']);
        $unite = Unit::firstOrCreate(['symbol' => 'pc'], ['name' => 'Pièce']);
        $base = ['category_id' => $categorie->id, 'unit_id' => $unite->id];

        $this->actingAs($admin, 'api')->postJson('/api/products', [...$base, 'name' => 'Ciment CPJ 45'])->assertCreated();

        // Même désignation, casse et espaces différents : refusé.
        $this->actingAs($admin, 'api')->postJson('/api/products', [...$base, 'name' => '  ciment   cpj 45 '])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('name');

        // Un autre produit renommé comme l'existant : refusé aussi.
        $autre = $this->actingAs($admin, 'api')->postJson('/api/products', [...$base, 'name' => 'Fer à béton 12'])->assertCreated()->json('data.id');
        $this->actingAs($admin, 'api')->putJson("/api/products/{$autre}", [...$base, 'name' => 'CIMENT CPJ 45'])->assertUnprocessable();

        // Modifier un produit sans changer son nom reste possible.
        $this->actingAs($admin, 'api')->putJson("/api/products/{$autre}", [...$base, 'name' => 'Fer à béton 12', 'min_stock' => 5])->assertOk();
    }

    public function test_nouveau_produit_publie_sur_la_boutique_sans_toucher_aux_existants(): void
    {
        $admin = User::factory()->create(['role' => 'DG_ADMIN']);
        $base = [
            'category_id' => Category::firstOrCreate(['slug' => 'tests'], ['name' => 'Tests'])->id,
            'unit_id' => Unit::firstOrCreate(['symbol' => 'pc'], ['name' => 'Pièce'])->id,
        ];

        // Nouveau produit, sans réglage boutique envoyé : publié automatiquement, pas mis en avant.
        $id = $this->actingAs($admin, 'api')->postJson('/api/products', [...$base, 'name' => 'Câble 2,5 mm²'])->assertCreated()->json('data.id');
        $this->assertDatabaseHas('products', ['id' => $id, 'visible_boutique' => true, 'mis_en_avant' => false]);

        // Produit existant masqué de la boutique : une modification ne change pas son réglage.
        $masque = Product::create([...$base, 'reference' => 'TESTS-0099', 'name' => 'Ancien produit', 'sale_price' => 0, 'stock_quantity' => 0, 'reserved_quantity' => 0, 'min_stock' => 0, 'visible_boutique' => false, 'mis_en_avant' => true]);
        $this->actingAs($admin, 'api')->putJson("/api/products/{$masque->id}", [...$base, 'name' => 'Ancien produit', 'min_stock' => 3])->assertOk();
        $this->assertDatabaseHas('products', ['id' => $masque->id, 'visible_boutique' => false, 'mis_en_avant' => true]);
    }
}
