<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Price;
use App\Models\Product;
use App\Models\Supplier;
use App\Models\Unit;
use App\Models\User;
use App\Models\Zone;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Suppression des catégories, unités, produits et fournisseurs : Super admin uniquement, jamais un élément encore utilisé. */
class SuppressionReferentielTest extends TestCase
{
    use RefreshDatabase;

    private function produit(Category $categorie, Unit $unite): Product
    {
        return Product::create([
            'reference' => 'TEST-'.fake()->unique()->numberBetween(100, 999),
            'name' => 'Produit test',
            'category_id' => $categorie->id,
            'unit_id' => $unite->id,
            'sale_price' => 1000,
            'stock_quantity' => 10,
            'reserved_quantity' => 0,
            'min_stock' => 0,
        ]);
    }

    public function test_seul_le_super_admin_peut_supprimer(): void
    {
        $admin = User::factory()->create(['role' => 'DG_ADMIN']);
        $categorie = Category::create(['name' => 'Ciment', 'slug' => 'ciment']);
        $unite = Unit::create(['name' => 'Sac', 'symbol' => 'sac']);
        $fournisseur = Supplier::create(['name' => 'Fournisseur']);
        $produit = $this->produit($categorie, $unite);

        $this->actingAs($admin, 'api')->deleteJson("/api/products/{$produit->id}")->assertForbidden();
        $this->actingAs($admin, 'api')->deleteJson("/api/categories/{$categorie->id}")->assertForbidden();
        $this->actingAs($admin, 'api')->deleteJson("/api/units/{$unite->id}")->assertForbidden();
        $this->actingAs($admin, 'api')->deleteJson("/api/suppliers/{$fournisseur->id}")->assertForbidden();
    }

    public function test_categorie_et_unite_liees_a_un_produit_ne_sont_pas_supprimees(): void
    {
        $superAdmin = User::factory()->create(['role' => 'SUPERADMIN']);
        $categorie = Category::create(['name' => 'Ciment', 'slug' => 'ciment']);
        $unite = Unit::create(['name' => 'Sac', 'symbol' => 'sac']);
        $produit = $this->produit($categorie, $unite);

        $this->actingAs($superAdmin, 'api')->deleteJson("/api/categories/{$categorie->id}")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('category');
        $this->actingAs($superAdmin, 'api')->deleteJson("/api/units/{$unite->id}")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('unit');

        $produit->delete();

        $this->actingAs($superAdmin, 'api')->deleteJson("/api/categories/{$categorie->id}")->assertNoContent();
        $this->actingAs($superAdmin, 'api')->deleteJson("/api/units/{$unite->id}")->assertNoContent();
        $this->assertSoftDeleted($categorie);
        $this->assertSoftDeleted($unite);
    }

    public function test_produit_utilise_dans_une_proforma_n_est_pas_supprime(): void
    {
        $superAdmin = User::factory()->create(['role' => 'SUPERADMIN']);
        $produit = $this->produit(Category::create(['name' => 'Fer', 'slug' => 'fer']), Unit::create(['name' => 'Pièce', 'symbol' => 'pc']));
        $zone = Zone::create(['name' => 'Libreville', 'code' => 'LBV']);

        $this->actingAs($superAdmin, 'api')->postJson('/api/quotes', [
            'zone_id' => $zone->id,
            'customer_name' => 'Client',
            'items' => [['product_id' => $produit->id, 'quantity' => 1]],
        ])->assertCreated();

        $this->actingAs($superAdmin, 'api')->deleteJson("/api/products/{$produit->id}")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('product');
        $this->assertModelExists($produit);
    }

    public function test_produit_sans_historique_est_supprime_avec_ses_prix(): void
    {
        $superAdmin = User::factory()->create(['role' => 'SUPERADMIN']);
        $produit = $this->produit(Category::create(['name' => 'Fer', 'slug' => 'fer']), Unit::create(['name' => 'Pièce', 'symbol' => 'pc']));
        Price::create(['product_id' => $produit->id, 'amount' => 1000, 'for_pos' => true]);

        $this->actingAs($superAdmin, 'api')->deleteJson("/api/products/{$produit->id}")->assertNoContent();

        $this->assertModelMissing($produit);
        $this->assertSame(0, Price::withTrashed()->where('product_id', $produit->id)->count());
    }
}
