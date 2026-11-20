<?php

namespace Tests\Feature;

use App\Models\Category;
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
}
