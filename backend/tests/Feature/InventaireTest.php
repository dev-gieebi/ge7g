<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Inventaire;
use App\Models\Product;
use App\Models\StockMovement;
use App\Models\Unit;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Inventaires physiques : comptage en brouillon, validation des écarts et
 * remontée du stock réel / de l'écart dans l'état du stock.
 */
class InventaireTest extends TestCase
{
    use RefreshDatabase;

    private function produit(float $stock): Product
    {
        $categorie = Category::firstOrCreate(['slug' => 'tests'], ['name' => 'Tests']);
        $unite = Unit::firstOrCreate(['symbol' => 'pc'], ['name' => 'Pièce']);

        return Product::create([
            'reference' => 'INV-'.fake()->unique()->numberBetween(100, 999),
            'name' => 'Produit test',
            'category_id' => $categorie->id,
            'unit_id' => $unite->id,
            'sale_price' => 10000,
            'purchase_price' => 6000,
            'stock_quantity' => $stock,
            'reserved_quantity' => 0,
            'min_stock' => 0,
        ]);
    }

    private function ligneEtat(User $user, Product $produit): array
    {
        return collect($this->actingAs($user, 'api')->getJson('/api/reports/pilotage')->assertOk()->json('data.etat_stock'))
            ->firstWhere('product_id', $produit->id);
    }

    public function test_brouillon_puis_validation_fige_les_ecarts(): void
    {
        $cdg = User::factory()->create(['role' => 'CDG_ADMIN']);
        $manquant = $this->produit(50);
        $surplus = $this->produit(10);

        $id = $this->actingAs($cdg, 'api')->postJson('/api/inventaires', [
            'notes' => 'Inventaire de fin de mois',
            'lignes' => [['product_id' => $manquant->id, 'stock_compte' => 45]],
        ])->assertCreated()
            ->assertJsonPath('data.statut', 'BROUILLON')
            ->assertJsonPath('data.numero', 'INV-00001-'.now()->format('Y'))
            ->json('data.id');

        // Le brouillon n'affecte pas encore l'état du stock.
        $this->assertNull($this->ligneEtat($cdg, $manquant)['stock_reel']);

        $this->actingAs($cdg, 'api')->putJson("/api/inventaires/{$id}", [
            'lignes' => [
                ['product_id' => $manquant->id, 'stock_compte' => 45],
                ['product_id' => $surplus->id, 'stock_compte' => 12],
            ],
        ])->assertOk()->assertJsonCount(2, 'data.lignes');

        $this->actingAs($cdg, 'api')->postJson("/api/inventaires/{$id}/valider")
            ->assertOk()
            ->assertJsonPath('data.statut', 'VALIDE');

        $ligne = $this->ligneEtat($cdg, $manquant);
        $this->assertEquals(50, $ligne['stock_theorique']);
        $this->assertEquals(45, $ligne['stock_reel']);
        $this->assertEquals(-5, $ligne['ecart']);
        $this->assertEquals(2, $this->ligneEtat($cdg, $surplus)['ecart']);

        // Le stock théorique n'est pas modifié par l'inventaire.
        $this->assertEquals(50, (float) $manquant->refresh()->stock_quantity);

        // Validé : plus modifiable ni supprimable.
        $this->actingAs($cdg, 'api')->putJson("/api/inventaires/{$id}", ['lignes' => []])->assertStatus(422);
        $this->actingAs($cdg, 'api')->deleteJson("/api/inventaires/{$id}")->assertStatus(422);
    }

    public function test_les_mouvements_apres_comptage_suivent_le_stock_reel(): void
    {
        $dg = User::factory()->create(['role' => 'DG_ADMIN']);
        $produit = $this->produit(50);

        $inventaire = $this->actingAs($dg, 'api')->postJson('/api/inventaires', [
            'lignes' => [['product_id' => $produit->id, 'stock_compte' => 45]],
        ])->json('data.id');
        $this->actingAs($dg, 'api')->postJson("/api/inventaires/{$inventaire}/valider")->assertOk();

        // Vente de 10 après le comptage.
        $this->travel(1)->minutes();
        $produit->update(['stock_quantity' => 40]);
        StockMovement::create([
            'product_id' => $produit->id, 'type' => 'VENTE', 'quantity' => -10,
            'balance_after' => 40, 'reference_type' => 'PosSale', 'reference_id' => 1,
        ]);

        $ligne = $this->ligneEtat($dg, $produit);
        $this->assertEquals(40, $ligne['stock_theorique']);
        $this->assertEquals(35, $ligne['stock_reel']);
        // L'écart constaté au comptage reste le même.
        $this->assertEquals(-5, $ligne['ecart']);
    }

    public function test_etat_du_stock_par_periode(): void
    {
        $dg = User::factory()->create(['role' => 'DG_ADMIN']);
        // Historique : 0 → +100 (01/03) → −30 (10/03) → inventaire 68 (15/03) → +20 (05/04) → −5 (10/04) = 85.
        $produit = $this->produit(85);
        $mouvement = function (string $jour, string $type, float $quantite) use ($produit) {
            $this->travelTo($jour);
            StockMovement::create([
                'product_id' => $produit->id, 'type' => $type, 'quantity' => $quantite,
                'balance_after' => 0, 'reference_type' => 'Test', 'reference_id' => 1,
            ]);
        };
        $mouvement('2026-03-01 10:00', 'ENTREE', 100);
        $mouvement('2026-03-10 10:00', 'VENTE', -30);

        $this->travelTo('2026-03-15 18:00');
        $produit->update(['stock_quantity' => 70]);
        $id = $this->actingAs($dg, 'api')->postJson('/api/inventaires', [
            'lignes' => [['product_id' => $produit->id, 'stock_compte' => 68]],
        ])->json('data.id');
        $this->actingAs($dg, 'api')->postJson("/api/inventaires/{$id}/valider")->assertOk();

        $mouvement('2026-04-05 10:00', 'ENTREE', 20);
        $mouvement('2026-04-10 10:00', 'VENTE', -5);
        $produit->update(['stock_quantity' => 85]);
        $this->travelBack();

        $ligne = fn (array $periode) => collect(
            $this->actingAs($dg, 'api')->getJson('/api/reports/pilotage?'.http_build_query($periode))->assertOk()->json('data.etat_stock')
        )->firstWhere('product_id', $produit->id);

        // Mars : 0 + 100 − 30 = 70, inventaire du 15/03 : 68 (écart −2).
        $mars = $ligne(['from' => '2026-03-01', 'to' => '2026-03-31']);
        $this->assertEquals([0, 100, 30, 70, 68, -2], [$mars['stock_initial'], $mars['entrees'], $mars['sorties'], $mars['stock_theorique'], $mars['stock_reel'], $mars['ecart']]);

        // Avril : 70 + 20 − 5 = 85 ; stock réel 68 + 20 − 5 = 83.
        $avril = $ligne(['from' => '2026-04-01', 'to' => '2026-04-30']);
        $this->assertEquals([70, 20, 5, 85, 83, -2], [$avril['stock_initial'], $avril['entrees'], $avril['sorties'], $avril['stock_theorique'], $avril['stock_reel'], $avril['ecart']]);

        // Avant l'inventaire : pas encore de stock réel.
        $debutMars = $ligne(['to' => '2026-03-12']);
        $this->assertEquals(70, $debutMars['stock_theorique']);
        $this->assertNull($debutMars['stock_reel']);

        // Fin avant début : refusé.
        $this->actingAs($dg, 'api')->getJson('/api/reports/pilotage?from=2026-04-10&to=2026-04-01')->assertUnprocessable();
    }

    public function test_validation_exige_au_moins_un_comptage(): void
    {
        $dg = User::factory()->create(['role' => 'DG_ADMIN']);
        $id = $this->actingAs($dg, 'api')->postJson('/api/inventaires', ['lignes' => []])->assertCreated()->json('data.id');

        $this->actingAs($dg, 'api')->postJson("/api/inventaires/{$id}/valider")->assertStatus(422);
        $this->assertSame(Inventaire::BROUILLON, Inventaire::find($id)->statut);
    }

    public function test_quantite_negative_refusee(): void
    {
        $dg = User::factory()->create(['role' => 'DG_ADMIN']);
        $produit = $this->produit(5);

        $this->actingAs($dg, 'api')->postJson('/api/inventaires', [
            'lignes' => [['product_id' => $produit->id, 'stock_compte' => -1]],
        ])->assertUnprocessable()->assertJsonValidationErrors('lignes.0.stock_compte');
    }

    public function test_inventaires_interdits_aux_autres_roles(): void
    {
        foreach (['LG_ADMIN', 'CAISSIER'] as $role) {
            $user = User::factory()->create(['role' => $role]);
            $this->actingAs($user, 'api')->getJson('/api/inventaires')->assertForbidden();
            $this->actingAs($user, 'api')->postJson('/api/inventaires', ['lignes' => []])->assertForbidden();
        }
    }
}
