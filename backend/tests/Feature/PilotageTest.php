<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\PosSale;
use App\Models\PosSaleItem;
use App\Models\Price;
use App\Models\Product;
use App\Models\StockMovement;
use App\Models\Unit;
use App\Models\User;
use App\Models\Zone;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Tableau de bord pilotage du magasin : indicateurs clés, état du stock
 * par article et saisie des comptages physiques (Direction + CDG).
 */
class PilotageTest extends TestCase
{
    use RefreshDatabase;

    private function produit(array $overrides = []): Product
    {
        $categorie = Category::firstOrCreate(['slug' => 'tests'], ['name' => 'Tests']);
        $unite = Unit::firstOrCreate(['symbol' => 'pc'], ['name' => 'Pièce']);

        return Product::create(array_merge([
            'reference' => 'TEST-'.fake()->unique()->numberBetween(100, 999),
            'name' => 'Produit test',
            'category_id' => $categorie->id,
            'unit_id' => $unite->id,
            'sale_price' => 10000,
            'purchase_price' => 6000,
            'stock_quantity' => 50,
            'reserved_quantity' => 0,
            'min_stock' => 0,
        ], $overrides));
    }

    public function test_pilotage_renvoie_indicateurs_et_etat_du_stock(): void
    {
        $cdg = User::factory()->create(['role' => 'CDG_ADMIN']);
        $produit = $this->produit(['stock_quantity' => 8, 'min_stock' => 10]);

        // Un achat reçu et une vente livrée pour alimenter les mouvements.
        StockMovement::create([
            'product_id' => $produit->id, 'type' => 'ENTREE', 'quantity' => 20,
            'balance_after' => 20, 'reference_type' => 'Purchase', 'reference_id' => 1,
        ]);
        StockMovement::create([
            'product_id' => $produit->id, 'type' => 'VENTE', 'quantity' => -12,
            'balance_after' => 8, 'reference_type' => 'PosSale', 'reference_id' => 1,
        ]);

        $res = $this->actingAs($cdg, 'api')->getJson('/api/reports/pilotage')->assertOk();

        $ligne = collect($res->json('data.etat_stock'))->firstWhere('product_id', $produit->id);
        $this->assertEquals(20, $ligne['entrees']);
        $this->assertEquals(12, $ligne['sorties']);
        $this->assertEquals(8, $ligne['stock_theorique']);
        // Stock initial = théorique - entrées + sorties.
        $this->assertEquals(0, $ligne['stock_initial']);
        $this->assertEquals('À RÉAPPROVISIONNER', $ligne['alerte']);
        $this->assertEquals(6000, $ligne['cout_unitaire']);
        // Valeur stock = prix de vente (10 000) × stock théorique (8).
        $this->assertEquals(80000, $ligne['valeur_stock']);
        $this->assertNull($ligne['ecart']);

        $this->assertEquals(1, $res->json('data.indicateurs.articles_alerte'));
        $this->assertEquals(80000, $res->json('data.indicateurs.valeur_stock'));

        // Sans barème : le prix de vente retombe sur le prix de base.
        $this->assertEquals(10000, $ligne['prix_vente']);
        $this->assertSame([], $ligne['prix_zones']);
    }

    public function test_pilotage_renvoie_les_prix_par_ville(): void
    {
        $cdg = User::factory()->create(['role' => 'CDG_ADMIN']);
        $produit = $this->produit();
        $libreville = Zone::create(['name' => 'Libreville', 'code' => 'LBV']);
        Price::create([
            'product_id' => $produit->id, 'zone_id' => $libreville->id, 'amount' => 12000,
        ]);
        Price::create([
            'product_id' => $produit->id, 'zone_id' => null, 'amount' => 11000,
        ]);
        Price::create([
            'product_id' => $produit->id, 'zone_id' => null, 'amount' => 10500, 'for_pos' => true,
        ]);

        $ligne = collect(
            $this->actingAs($cdg, 'api')->getJson('/api/reports/pilotage')->assertOk()->json('data.etat_stock')
        )->firstWhere('product_id', $produit->id);

        // Barème caisse = prix de vente affiché ; villes listées dans prix_zones.
        $this->assertEquals(10500, $ligne['prix_vente']);
        $this->assertEquals(
            [['zone' => 'Libreville', 'amount' => 12000], ['zone' => 'Toutes villes', 'amount' => 11000]],
            $ligne['prix_zones'],
        );
    }

    public function test_prix_vente_replie_sur_toutes_villes_sans_bareme_caisse(): void
    {
        $cdg = User::factory()->create(['role' => 'CDG_ADMIN']);
        // Produit sans prix de base ni barème caisse : le prix « Toutes villes » s'applique.
        $produit = $this->produit(['sale_price' => 0, 'stock_quantity' => 4]);
        Price::create(['product_id' => $produit->id, 'zone_id' => null, 'amount' => 50000]);

        $ligne = collect(
            $this->actingAs($cdg, 'api')->getJson('/api/reports/pilotage')->assertOk()->json('data.etat_stock')
        )->firstWhere('product_id', $produit->id);

        $this->assertEquals(50000, $ligne['prix_vente']);
        // Valeur du stock : 50 000 × 4.
        $this->assertEquals(200000, $ligne['valeur_stock']);
    }

    public function test_pilotage_calcule_ca_et_marge_sur_quantites_livrees(): void
    {
        $cdg = User::factory()->create(['role' => 'CDG_ADMIN']);
        $caissier = User::factory()->create(['role' => 'CAISSIER']);
        $produit = $this->produit(['purchase_price' => 6000]);

        $vente = PosSale::create([
            'number' => 'VNT-TEST-1', 'user_id' => $caissier->id,
            'customer_name' => 'Client', 'subtotal' => 20000, 'taxes_total' => 0,
            'total' => 20000, 'status' => 'PAYEE', 'payment_method' => 'ESPECES',
        ]);
        PosSaleItem::create([
            'pos_sale_id' => $vente->id, 'product_id' => $produit->id,
            'quantity' => 5, 'delivered_quantity' => 2,
            'unit_price' => 10000, 'total' => 50000,
        ]);

        $res = $this->actingAs($cdg, 'api')->getJson('/api/reports/pilotage')->assertOk();

        $this->assertEquals(20000, $res->json('data.indicateurs.ca_facture'));
        // Marge livrée : 2 × (10 000 - 6 000).
        $this->assertEquals(8000, $res->json('data.indicateurs.marge_livree'));
        // Restant à livrer : 5 - 2.
        $this->assertEquals(3, $res->json('data.indicateurs.restant_a_livrer'));
    }

    public function test_inventaire_enregistre_les_comptages_physiques(): void
    {
        $cdg = User::factory()->create(['role' => 'CDG_ADMIN']);
        $produit = $this->produit(['stock_quantity' => 50]);

        $this->actingAs($cdg, 'api')->postJson('/api/reports/inventaire', [
            'items' => [['product_id' => $produit->id, 'physical_stock' => 45]],
        ])->assertOk()->assertJsonPath('data.saved', 1);

        $produit->refresh();
        $this->assertEquals(45, (float) $produit->physical_stock);
        $this->assertNotNull($produit->physical_stock_at);

        // L'écart physique - théorique remonte dans le pilotage.
        $res = $this->actingAs($cdg, 'api')->getJson('/api/reports/pilotage')->assertOk();
        $ligne = collect($res->json('data.etat_stock'))->firstWhere('product_id', $produit->id);
        $this->assertEquals(45, $ligne['stock_physique']);
        $this->assertEquals(-5, $ligne['ecart']);
        $this->assertEquals(1, $res->json('data.indicateurs.ecarts_physiques'));
    }

    public function test_pilotage_reserve_a_la_direction_et_au_cdg(): void
    {
        $logistique = User::factory()->create(['role' => 'LG_ADMIN']);
        $this->actingAs($logistique, 'api')->getJson('/api/reports/pilotage')->assertForbidden();
        $this->actingAs($logistique, 'api')->postJson('/api/reports/inventaire', [
            'items' => [['product_id' => 1, 'physical_stock' => 1]],
        ])->assertForbidden();
    }
}
