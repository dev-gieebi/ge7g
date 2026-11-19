<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Product;
use App\Models\Unit;
use App\Models\User;
use App\Models\Zone;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Ajout de produits : proforma non validée, vente déjà enregistrée. */
class AjoutProduitsTest extends TestCase
{
    use RefreshDatabase;

    private function produit(array $attrs = []): Product
    {
        $categorie = Category::firstOrCreate(['slug' => 'tests'], ['name' => 'Tests']);
        $unite = Unit::firstOrCreate(['symbol' => 'pc'], ['name' => 'Pièce']);

        return Product::create(array_merge([
            'reference' => 'TEST-'.fake()->unique()->numberBetween(100, 999),
            'name' => 'Produit test',
            'category_id' => $categorie->id,
            'unit_id' => $unite->id,
            'sale_price' => 1000,
            'stock_quantity' => 10,
            'reserved_quantity' => 0,
            'min_stock' => 0,
        ], $attrs));
    }

    public function test_produits_ajoutes_a_une_proforma_non_validee(): void
    {
        $admin = User::factory()->create(['role' => 'LG_ADMIN']);
        $zone = Zone::create(['name' => 'Libreville', 'code' => 'LBV']);
        $a = $this->produit();
        $b = $this->produit(['name' => 'Autre', 'sale_price' => 500]);

        $id = $this->actingAs($admin, 'api')->postJson('/api/quotes', [
            'zone_id' => $zone->id,
            'customer_name' => 'Client',
            'items' => [['product_id' => $a->id, 'quantity' => 2]],
        ])->assertCreated()->json('data.id');

        $this->actingAs($admin, 'api')->postJson("/api/quotes/{$id}/items", [
            'items' => [['product_id' => $a->id, 'quantity' => 1], ['product_id' => $b->id, 'quantity' => 4]],
        ])->assertOk()
            ->assertJsonCount(2, 'data.items')
            ->assertJsonPath('data.total', fn ($t) => (float) $t === 5000.0);

        // Validée : plus d'ajout possible.
        $this->actingAs($admin, 'api')->postJson("/api/quotes/{$id}/status", ['status' => 'VALIDE'])->assertOk();
        $this->actingAs($admin, 'api')->postJson("/api/quotes/{$id}/items", [
            'items' => [['product_id' => $b->id, 'quantity' => 1]],
        ])->assertStatus(422);
    }

    public function test_produits_ajoutes_a_une_vente_par_la_logistique_pas_la_caissiere(): void
    {
        $admin = User::factory()->create(['role' => 'LG_ADMIN']);
        $caissiere = User::factory()->create(['role' => 'CAISSIER']);
        $zone = Zone::create(['name' => 'Libreville', 'code' => 'LBV']);
        $a = $this->produit();
        $b = $this->produit(['name' => 'Autre', 'sale_price' => 500, 'stock_quantity' => 3]);

        $id = $this->actingAs($admin, 'api')->postJson('/api/pos/sales', [
            'zone_id' => $zone->id,
            'customer_name' => 'Client',
            'customer_phone' => '+24107000000',
            'customer_address' => 'Glass',
            'payment_method' => 'AUTRE',
            'items' => [['product_id' => $a->id, 'quantity' => 2]],
        ])->assertCreated()->json('data.id');

        $this->actingAs($caissiere, 'api')->postJson("/api/pos/sales/{$id}/items", [
            'items' => [['product_id' => $b->id, 'quantity' => 1]],
        ])->assertForbidden();

        // 5 demandés, 3 en stock : refusé, rien n'est ajouté ni sorti du stock.
        $this->actingAs($admin, 'api')->postJson("/api/pos/sales/{$id}/items", [
            'items' => [['product_id' => $b->id, 'quantity' => 5]],
        ])->assertUnprocessable()->assertJsonValidationErrors('items');
        $this->assertEquals(3, (float) $b->fresh()->stock_quantity);

        // Dans la limite du stock : ajouté et livré.
        $this->actingAs($admin, 'api')->postJson("/api/pos/sales/{$id}/items", [
            'items' => [['product_id' => $b->id, 'quantity' => 3]],
        ])->assertOk()
            ->assertJsonCount(2, 'data.items')
            ->assertJsonPath('data.total', fn ($t) => (float) $t === 3500.0);

        $this->assertEquals(0, (float) $b->fresh()->stock_quantity);
        $this->assertEquals(8, (float) $a->fresh()->stock_quantity);

        // Soldée : enregistrée (reste après rechargement), retirée seulement sur demande.
        $this->actingAs($admin, 'api')->postJson("/api/pos/sales/{$id}/solde", ['soldee' => true])
            ->assertOk()->assertJsonPath('data.status', 'PAYEE');
        $this->assertNotNull($this->actingAs($admin, 'api')->getJson("/api/pos/sales/{$id}")->json('data.soldee_le'));
        // Soldée : plus d'ajout de produits.
        $this->actingAs($admin, 'api')->postJson("/api/pos/sales/{$id}/items", [
            'items' => [['product_id' => $a->id, 'quantity' => 1]],
        ])->assertStatus(422);
        $this->actingAs($caissiere, 'api')->postJson("/api/pos/sales/{$id}/solde", ['soldee' => false])->assertForbidden();
        $this->actingAs($admin, 'api')->postJson("/api/pos/sales/{$id}/solde", ['soldee' => false])->assertOk()->assertJsonPath('data.soldee_le', null);

        // Rupture : impossible d'ajouter.
        $this->actingAs($admin, 'api')->postJson("/api/pos/sales/{$id}/items", [
            'items' => [['product_id' => $b->id, 'quantity' => 1]],
        ])->assertUnprocessable();
    }
}
