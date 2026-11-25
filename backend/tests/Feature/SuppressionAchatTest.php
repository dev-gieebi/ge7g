<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Product;
use App\Models\Supplier;
use App\Models\Unit;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Suppression d'un achat : le stock réapprovisionné est retiré, s'il existe encore. */
class SuppressionAchatTest extends TestCase
{
    use RefreshDatabase;

    private function produit(float $stock): Product
    {
        return Product::create([
            'reference' => 'TEST-'.fake()->unique()->numberBetween(100, 999),
            'name' => 'Ciment',
            'category_id' => Category::firstOrCreate(['slug' => 'tests'], ['name' => 'Tests'])->id,
            'unit_id' => Unit::firstOrCreate(['symbol' => 'sac'], ['name' => 'Sac'])->id,
            'sale_price' => 1000,
            'stock_quantity' => $stock,
            'reserved_quantity' => 0,
            'min_stock' => 0,
        ]);
    }

    /** Achat de 10 unités, entièrement réceptionné. */
    private function achatRecu(User $admin, Product $produit): int
    {
        $achat = $this->actingAs($admin, 'api')->postJson('/api/purchases', [
            'supplier_id' => Supplier::create(['name' => 'Fournisseur'])->id,
            'date' => '2026-11-25',
            'items' => [['product_id' => $produit->id, 'quantity' => 10, 'unit_price' => 500]],
        ])->assertCreated()->json('data');

        $this->actingAs($admin, 'api')->postJson("/api/purchases/{$achat['id']}/receive", [
            'items' => [['item_id' => $achat['items'][0]['id'], 'quantity' => 10]],
        ])->assertOk();

        return $achat['id'];
    }

    public function test_achat_supprime_retire_le_stock_reapprovisionne(): void
    {
        $superAdmin = User::factory()->create(['role' => 'SUPERADMIN']);
        $produit = $this->produit(5);
        $id = $this->achatRecu($superAdmin, $produit);
        $this->assertEquals(15, (float) $produit->fresh()->stock_quantity);

        $this->actingAs(User::factory()->create(['role' => 'DG_ADMIN']), 'api')->deleteJson("/api/purchases/{$id}")->assertForbidden();

        // L'approvisionneur peut supprimer un achat.
        $approvisionneur = User::factory()->create(['role' => 'CDG_ADMIN']);
        $this->actingAs($approvisionneur, 'api')->deleteJson("/api/purchases/{$id}")->assertNoContent();

        $this->assertEquals(5, (float) $produit->fresh()->stock_quantity);
        $this->assertDatabaseMissing('purchases', ['id' => $id]);
        $this->assertDatabaseHas('stock_movements', ['product_id' => $produit->id, 'type' => 'SORTIE', 'reference_id' => $id]);
    }

    public function test_achat_non_supprime_si_le_stock_n_existe_plus(): void
    {
        $superAdmin = User::factory()->create(['role' => 'SUPERADMIN']);
        $produit = $this->produit(0);
        $id = $this->achatRecu($superAdmin, $produit);

        // 4 des 10 sacs reçus ont été vendus depuis.
        $produit->update(['stock_quantity' => 6]);

        $this->actingAs($superAdmin, 'api')->deleteJson("/api/purchases/{$id}")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('purchase');

        $this->assertEquals(6, (float) $produit->fresh()->stock_quantity);
        $this->assertDatabaseHas('purchases', ['id' => $id]);
    }
}
