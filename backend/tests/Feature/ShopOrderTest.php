<?php

namespace Tests\Feature;

use App\Models\Avoir;
use App\Models\Category;
use App\Models\Client;
use App\Models\Commande;
use App\Models\Facture;
use App\Models\PosSale;
use App\Models\Price;
use App\Models\Product;
use App\Models\StockMovement;
use App\Models\Unit;
use App\Models\User;
use App\Models\Zone;
use App\Services\NumerotationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ShopOrderTest extends TestCase
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
            'sale_price' => 10000,
            'stock_quantity' => 50,
            'reserved_quantity' => 0,
            'min_stock' => 0,
            'visible_boutique' => true,
        ], $attrs));
    }

    private function commandePayload(Product $p, float $quantite = 2, string $tel = '066112233'): array
    {
        return [
            'nom' => 'Jean Mba',
            'telephone' => $tel,
            'ville' => 'Libreville',
            'quartier' => 'Glass',
            'point_repere' => 'Face à la pharmacie',
            'lignes' => [['produit_id' => $p->id, 'quantite' => $quantite]],
        ];
    }

    private function admin(): User
    {
        return User::factory()->create(['role' => 'LG_ADMIN']);
    }

    public function test_commande_sans_compte_cree_le_client_par_telephone(): void
    {
        $p = $this->produit();

        $res = $this->postJson('/api/public/commandes', $this->commandePayload($p));
        $res->assertCreated();
        $numero = $res->json('data.numero');
        $this->assertMatchesRegularExpression('/^CMD-\d{5}-'.date('Y').'$/', $numero);

        $commande = Commande::where('numero', $numero)->firstOrFail();
        $this->assertEquals('en_attente', $commande->statut->value);
        $this->assertEquals(20000, (int) $commande->total); // 2 × 10 000 (prix serveur)
        $this->assertEquals('+241066112233', $commande->telephone_livraison);
        $this->assertDatabaseHas('clients', ['telephone' => '+241066112233', 'source' => 'boutique_en_ligne']);

        // Seconde commande du même téléphone : même fiche client, nom mis à jour.
        $res2 = $this->postJson('/api/public/commandes', array_merge($this->commandePayload($p, 1, '+241 06 61 12 233'), ['nom' => 'J. Mba']));
        $res2->assertCreated();
        $this->assertSame(1, Client::where('telephone', '+241066112233')->count());
        $this->assertDatabaseHas('clients', ['telephone' => '+241066112233', 'nom' => 'J. Mba']);

        // Aucune facture, aucune vente, aucun mouvement à ce stade.
        $this->assertEquals(0, Facture::count());
        $this->assertEquals(0, PosSale::count());
        $this->assertEquals(0, StockMovement::count());
    }

    public function test_commande_possible_meme_en_rupture_de_stock(): void
    {
        $p = $this->produit(['stock_quantity' => 0]);

        $res = $this->postJson('/api/public/commandes', $this->commandePayload($p));
        $res->assertCreated();
        $this->assertDatabaseHas('commandes', ['statut' => 'en_attente', 'total' => 20000]);
    }

    public function test_catalogue_public_prix_selon_la_ville_choisie(): void
    {
        $zone = Zone::create(['name' => 'Port-Gentil', 'code' => 'POG']);
        $p = $this->produit(['sale_price' => 10000]);
        Price::create(['product_id' => $p->id, 'zone_id' => $zone->id, 'amount' => 12000]);
        Price::create(['product_id' => $p->id, 'zone_id' => null, 'amount' => 11000, 'for_pos' => true]);

        // Ville choisie : prix de la zone.
        $res = $this->getJson('/api/public/produits?zone='.$zone->id);
        $res->assertOk();
        $this->assertEquals(12000, $res->json('data.0.prix'));

        // Sans ville : prix POS / toutes villes.
        $res = $this->getJson('/api/public/produits');
        $this->assertEquals(11000, $res->json('data.0.prix'));

        // Un produit sans prix « toutes villes » n'apparaît pas.
        $this->produit(['name' => 'Sans prix toutes villes']);
        $res = $this->getJson('/api/public/produits');
        $this->assertCount(1, $res->json('data'));

        // Il n'apparaît pas non plus pour une ville où il n'a pas de prix.
        $res = $this->getJson('/api/public/produits?zone='.$zone->id);
        $this->assertCount(1, $res->json('data'));
    }

    public function test_prix_falsifies_cote_navigateur_sont_ignores(): void
    {
        $p = $this->produit(['sale_price' => 25000]);
        $payload = $this->commandePayload($p);
        // Le navigateur tente d'imposer un prix falsifié.
        $payload['lignes'][0]['prix_unitaire'] = 1;
        $payload['total'] = 1;

        $res = $this->postJson('/api/public/commandes', $payload);
        $res->assertCreated();
        $this->assertEquals(50000, (int) $res->json('data.total'));
        $this->assertDatabaseHas('commande_lignes', ['produit_id' => $p->id, 'prix_unitaire' => 25000]);
    }

    public function test_validation_cree_facture_vente_et_sortie_de_stock(): void
    {
        $p = $this->produit(['stock_quantity' => 10]);
        $this->postJson('/api/public/commandes', $this->commandePayload($p, 3));
        $commande = Commande::firstOrFail();
        $admin = $this->admin();

        $res = $this->actingAs($admin, 'api')->postJson("/api/commandes/{$commande->id}/valider");
        $res->assertOk();

        $commande->refresh();
        $this->assertEquals('validee', $commande->statut->value);
        $this->assertEquals($admin->id, $commande->validee_par);

        $facture = Facture::firstOrFail();
        $this->assertMatchesRegularExpression('/^FAC-\d{6}-'.date('Y').'$/', $facture->numero);
        $this->assertEquals('non_payee', $facture->statut_paiement);
        $this->assertEquals(30000, (int) $facture->montant_total);
        $this->assertCount(1, $facture->lignes);

        $vente = PosSale::firstOrFail();
        $this->assertEquals('boutique_en_ligne', $vente->source);
        $this->assertEquals($facture->id, $vente->facture_id);

        $p->refresh();
        $this->assertEquals(7.0, (float) $p->stock_quantity);
        $this->assertDatabaseHas('stock_movements', ['reference_type' => 'Commande', 'reference_id' => $commande->id, 'type' => 'SORTIE_VENTE']);
    }

    public function test_validation_stock_insuffisant_ne_cree_rien(): void
    {
        $p = $this->produit(['stock_quantity' => 5]);
        // Le stock suffisait à la commande (2), puis chute avant la validation.
        $this->postJson('/api/public/commandes', $this->commandePayload($p, 2));
        $commande = Commande::firstOrFail();
        $p->update(['stock_quantity' => 1]);

        $res = $this->actingAs($this->admin(), 'api')->postJson("/api/commandes/{$commande->id}/valider");
        $res->assertUnprocessable();

        $commande->refresh();
        $this->assertEquals('en_attente', $commande->statut->value);
        $this->assertEquals(0, Facture::count());
        $this->assertEquals(0, PosSale::count());
        $this->assertEquals(0, StockMovement::count());
        $this->assertEquals(1.0, (float) $p->fresh()->stock_quantity);
    }

    public function test_double_validation_impossible(): void
    {
        $p = $this->produit();
        $this->postJson('/api/public/commandes', $this->commandePayload($p));
        $commande = Commande::firstOrFail();
        $admin = $this->admin();

        $this->actingAs($admin, 'api')->postJson("/api/commandes/{$commande->id}/valider")->assertOk();
        $this->actingAs($admin, 'api')->postJson("/api/commandes/{$commande->id}/valider")->assertUnprocessable();
        $this->assertEquals(1, Facture::count());
        $this->assertEquals(1, PosSale::count());
    }

    public function test_transition_interdite_rejetee(): void
    {
        $p = $this->produit();
        $this->postJson('/api/public/commandes', $this->commandePayload($p));
        $commande = Commande::firstOrFail();
        $admin = $this->admin();

        // en_attente → livree est interdit par le schéma.
        $this->actingAs($admin, 'api')->postJson("/api/commandes/{$commande->id}/livrer", [
            'receptionnaire' => 'X', 'montant' => 20000, 'mode' => 'ESPECES',
        ])->assertUnprocessable();

        // Une commande livrée ne peut plus être annulée ni modifiée.
        $this->actingAs($admin, 'api')->postJson("/api/commandes/{$commande->id}/valider")->assertOk();
        $this->actingAs($admin, 'api')->postJson("/api/commandes/{$commande->id}/preparer")->assertOk();
        $chauffeur = User::factory()->create(['role' => 'CHAUFFEUR']);
        $this->actingAs($admin, 'api')->postJson("/api/commandes/{$commande->id}/expedier", ['chauffeur_id' => $chauffeur->id])->assertOk();
        $this->actingAs($chauffeur, 'api')->postJson("/api/commandes/{$commande->id}/livrer", [
            'receptionnaire' => 'Jean Mba', 'montant' => 20000, 'mode' => 'ESPECES',
        ])->assertOk();
        $this->actingAs($admin, 'api')->postJson("/api/commandes/{$commande->id}/annuler", ['motif' => 'test'])->assertUnprocessable();
        $this->assertEquals('livree', $commande->fresh()->statut->value);
        $this->assertEquals('payee', $commande->fresh()->facture->statut_paiement);
    }

    public function test_annulation_cree_avoir_remet_stock_et_conserve_facture(): void
    {
        $p = $this->produit(['stock_quantity' => 10]);
        $this->postJson('/api/public/commandes', $this->commandePayload($p, 4));
        $commande = Commande::firstOrFail();
        $admin = $this->admin();
        $this->actingAs($admin, 'api')->postJson("/api/commandes/{$commande->id}/valider")->assertOk();
        $this->assertEquals(6.0, (float) $p->fresh()->stock_quantity);

        $res = $this->actingAs($admin, 'api')->postJson("/api/commandes/{$commande->id}/annuler", ['motif' => 'Client injoignable']);
        $res->assertOk();

        $commande->refresh();
        $this->assertEquals('annulee', $commande->statut->value);

        $avoir = Avoir::firstOrFail();
        $this->assertMatchesRegularExpression('/^AV-\d{5}-'.date('Y').'$/', $avoir->numero);
        $this->assertEquals(40000, (int) $avoir->montant);

        $facture = Facture::firstOrFail(); // jamais supprimée
        $this->assertEquals('annulee', $facture->statut_paiement);
        $this->assertTrue((bool) PosSale::firstOrFail()->annulee);

        $this->assertEquals(10.0, (float) $p->fresh()->stock_quantity);
        $this->assertDatabaseHas('stock_movements', ['reference_type' => 'Commande', 'type' => 'RETOUR_ANNULATION']);
    }

    public function test_livraison_partielle_facture_partiellement_payee(): void
    {
        Storage::fake('public');
        $p = $this->produit();
        $this->postJson('/api/public/commandes', $this->commandePayload($p, 2));
        $commande = Commande::firstOrFail();
        $admin = $this->admin();
        $chauffeur = User::factory()->create(['role' => 'CHAUFFEUR']);

        $this->actingAs($admin, 'api')->postJson("/api/commandes/{$commande->id}/valider")->assertOk();
        $this->actingAs($admin, 'api')->postJson("/api/commandes/{$commande->id}/preparer")->assertOk();
        $this->actingAs($admin, 'api')->postJson("/api/commandes/{$commande->id}/expedier", ['chauffeur_id' => $chauffeur->id])->assertOk();
        $this->assertEquals('en_livraison', $commande->fresh()->statut->value);

        $signature = 'data:image/png;base64,'.base64_encode('fakepng');
        $this->actingAs($chauffeur, 'api')->postJson("/api/commandes/{$commande->id}/livrer", [
            'receptionnaire' => 'Mme Mba', 'montant' => 5000, 'mode' => 'AIRTEL_MONEY', 'signature' => $signature,
        ])->assertOk();

        $commande->refresh();
        $this->assertEquals('livree', $commande->statut->value);
        $this->assertEquals('partiellement_payee', $commande->facture->statut_paiement);
        $this->assertEquals(5000, (int) $commande->facture->paiements->sum('montant'));
        $this->assertNotNull($commande->livraison->signature);
    }

    public function test_numerotation_annuelle_unique_et_remise_a_zero(): void
    {
        $service = app(NumerotationService::class);

        DB::transaction(function () use ($service) {
            $this->assertEquals('CMD-00001-'.date('Y'), $service->next('CMD'));
            $this->assertEquals('CMD-00002-'.date('Y'), $service->next('CMD'));
            $this->assertMatchesRegularExpression('/^FAC-\d{6}-/', $service->next('FAC'));
        });

        // Nouvelle année : la séquence repart à 1.
        Carbon::setTestNow('2027-01-05 10:00:00');
        DB::transaction(function () use ($service) {
            $this->assertEquals('CMD-00001-2027', $service->next('CMD'));
        });
    }

    public function test_suivi_exige_numero_et_telephone_correspondants(): void
    {
        $p = $this->produit();
        $res = $this->postJson('/api/public/commandes', $this->commandePayload($p));
        $numero = $res->json('data.numero');

        // Bon numéro, mauvais téléphone : message générique, pas d'indice.
        $this->postJson('/api/public/suivi', ['numero' => $numero, 'telephone' => '077000000'])
            ->assertNotFound()
            ->assertJson(['message' => 'Commande introuvable.']);

        $ok = $this->postJson('/api/public/suivi', ['numero' => strtolower($numero), 'telephone' => '066112233']);
        $ok->assertOk();
        $this->assertEquals($numero, $ok->json('data.numero'));
        $this->assertEquals('en_attente', $ok->json('data.statut'));
        $this->assertCount(5, $ok->json('data.etapes'));
    }
}
