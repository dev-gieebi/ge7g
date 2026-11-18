<?php

namespace Tests\Feature;

use App\Models\BonLivraison;
use App\Models\Category;
use App\Models\Commande;
use App\Models\Facture;
use App\Models\PosSale;
use App\Models\Product;
use App\Models\Unit;
use App\Models\User;
use App\Models\Zone;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class EspaceClientTest extends TestCase
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

    private function creerCompteClient(?Zone $zone = null): User
    {
        $superadmin = User::factory()->create(['role' => 'SUPERADMIN']);

        $res = $this->actingAs($superadmin, 'api')->postJson('/api/users', [
            'name' => 'Quincaillerie Mba',
            'role' => 'CLIENT',
            'phone' => '066112233',
            'zone_id' => $zone?->id,
        ]);
        $res->assertCreated();

        return User::findOrFail($res->json('data.id'));
    }

    private function payload(Product $p, array $extra = []): array
    {
        return array_merge([
            'nom' => 'Quincaillerie Mba',
            'telephone' => '066112233',
            'ville' => 'Libreville',
            'quartier' => 'Glass',
            'point_repere' => 'Face à la pharmacie',
            'lignes' => [['produit_id' => $p->id, 'quantite' => 2]],
        ], $extra);
    }

    public function test_superadmin_cree_un_compte_client_lie_a_une_ville(): void
    {
        $zone = Zone::create(['name' => 'Franceville', 'code' => 'FCV']);
        $compte = $this->creerCompteClient($zone);

        $this->assertSame('CLIENT', $compte->role);
        $this->assertSame($zone->id, $compte->zone_id);
        $this->assertSame('+241066112233', $compte->phone);
        $this->assertNotNull($compte->client_id);
        $this->assertDatabaseHas('clients', ['id' => $compte->client_id, 'telephone' => '+241066112233']);
    }

    public function test_client_commande_meme_en_rupture_avec_annotation_et_remise(): void
    {
        $compte = $this->creerCompteClient();
        $p = $this->produit(['stock_quantity' => 0]);

        $res = $this->actingAs($compte, 'api')->postJson('/api/client/commandes', $this->payload($p, [
            'annotation' => 'Livrer avant 10 h svp',
            'remise_taux' => 10,
            'remise_motif' => 'Client fidèle',
        ]));
        $res->assertCreated();

        $commande = Commande::findOrFail($res->json('data.id'));
        $this->assertSame($compte->id, $commande->user_id);
        $this->assertSame($compte->client_id, $commande->client_id);
        $this->assertSame('demandee', $commande->remise_statut);
        $this->assertEquals(10, $commande->remise_taux_demande);
        $this->assertEquals(20000, (int) $commande->total);
        $this->assertDatabaseHas('commande_annotations', ['commande_id' => $commande->id, 'auteur' => 'client', 'contenu' => 'Livrer avant 10 h svp']);

        // Le détail client n'expose jamais le stock.
        $detail = $this->actingAs($compte, 'api')->getJson("/api/client/commandes/{$commande->id}");
        $detail->assertOk()->assertJsonPath('data.remise.statut', 'demandee');
        $this->assertArrayNotHasKey('stock_disponible', $detail->json('data.lignes.0'));
    }

    public function test_ville_imposee_par_le_compte(): void
    {
        $franceville = Zone::create(['name' => 'Franceville', 'code' => 'FCV']);
        $libreville = Zone::create(['name' => 'Libreville', 'code' => 'LBV']);
        $compte = $this->creerCompteClient($franceville);
        $p = $this->produit();

        $res = $this->actingAs($compte, 'api')->postJson('/api/client/commandes', $this->payload($p, ['zone_id' => $libreville->id, 'ville' => 'Libreville']));
        $res->assertCreated();

        $commande = Commande::findOrFail($res->json('data.id'));
        $this->assertSame($franceville->id, $commande->zone_id);
        $this->assertSame('Franceville', $commande->ville);
    }

    public function test_remise_accordee_puis_validation_facture_le_net(): void
    {
        $compte = $this->creerCompteClient();
        $admin = User::factory()->create(['role' => 'LG_ADMIN']);
        $dg = User::factory()->create(['role' => 'DG_ADMIN']);
        $p = $this->produit();

        $id = $this->actingAs($compte, 'api')->postJson('/api/client/commandes', $this->payload($p, ['remise_taux' => 10]))->json('data.id');

        // Remise en attente : seul le DG décide, la validation attend sa décision.
        $this->actingAs($admin, 'api')->postJson("/api/commandes/{$id}/remise", ['decision' => 'accorder'])->assertForbidden();
        $this->actingAs($admin, 'api')->postJson("/api/commandes/{$id}/valider")->assertUnprocessable();

        $this->actingAs($dg, 'api')->postJson("/api/commandes/{$id}/remise", ['decision' => 'accorder', 'taux' => 5])
            ->assertOk()
            ->assertJsonPath('data.remise.statut', 'accordee')
            ->assertJsonPath('data.remise.montant', 1000)
            ->assertJsonPath('data.total', 19000)
            ->assertJsonPath('data.sous_total', 20000);

        // Décision prise : plus de seconde décision, ni de nouvelle demande.
        $this->actingAs($dg, 'api')->postJson("/api/commandes/{$id}/remise", ['decision' => 'refuser'])->assertUnprocessable();
        $this->actingAs($compte, 'api')->postJson("/api/client/commandes/{$id}/remise", ['remise_taux' => 20])->assertUnprocessable();

        $this->actingAs($admin, 'api')->postJson("/api/commandes/{$id}/valider")->assertOk();

        $this->assertEquals(19000, (int) Facture::where('commande_id', $id)->value('montant_total'));
        $vente = PosSale::where('source', 'boutique_en_ligne')->firstOrFail();
        $this->assertEquals(20000, (int) $vente->subtotal);
        $this->assertEquals(5, (float) $vente->discount_rate);
        $this->assertEquals(19000, (int) $vente->total);

        // Plus de remise possible une fois validée.
        $this->actingAs($compte, 'api')->postJson("/api/client/commandes/{$id}/remise", ['remise_taux' => 20])->assertUnprocessable();
    }

    public function test_remise_refusee_peut_etre_redemandee_tant_que_en_attente(): void
    {
        $compte = $this->creerCompteClient();
        $dg = User::factory()->create(['role' => 'DG_ADMIN']);
        $p = $this->produit();

        $id = $this->actingAs($compte, 'api')->postJson('/api/client/commandes', $this->payload($p, ['remise_taux' => 10]))->json('data.id');

        $this->actingAs($dg, 'api')->postJson("/api/commandes/{$id}/remise", ['decision' => 'refuser'])
            ->assertOk()
            ->assertJsonPath('data.remise.statut', 'refusee')
            ->assertJsonPath('data.total', 20000);

        $this->actingAs($compte, 'api')->postJson("/api/client/commandes/{$id}/remise", ['remise_taux' => 5])
            ->assertOk()
            ->assertJsonPath('data.remise.statut', 'demandee');

        $this->actingAs($dg, 'api')->postJson("/api/commandes/{$id}/remise", ['decision' => 'accorder'])
            ->assertOk()
            ->assertJsonPath('data.remise.montant', 1000);
    }

    public function test_client_signale_les_nouveautes_et_les_annotations_de_l_equipe(): void
    {
        $compte = $this->creerCompteClient();
        $admin = User::factory()->create(['role' => 'LG_ADMIN']);
        $p = $this->produit();

        $id = $this->actingAs($compte, 'api')->postJson('/api/client/commandes', $this->payload($p))->json('data.id');
        $this->actingAs($compte, 'api')->getJson('/api/client/profil')->assertJsonPath('data.non_lues', 0);

        Carbon::setTestNow(now()->addMinute());
        $this->actingAs($admin, 'api')->postJson("/api/commandes/{$id}/valider")->assertOk();
        $this->actingAs($admin, 'api')->postJson("/api/commandes/{$id}/annotations", ['contenu' => 'Produits disponibles, préparation demain.'])
            ->assertOk()
            ->assertJsonPath('data.annotations.0.auteur', 'equipe');

        $this->actingAs($compte, 'api')->getJson('/api/client/profil')->assertJsonPath('data.non_lues', 1);
        $this->actingAs($compte, 'api')->getJson('/api/client/commandes')->assertJsonPath('data.0.non_lu', true);

        Carbon::setTestNow(now()->addMinute());
        $this->actingAs($compte, 'api')->getJson("/api/client/commandes/{$id}")
            ->assertOk()
            ->assertJsonPath('data.statut', 'validee')
            ->assertJsonPath('data.annotations.0.nom', 'G-ENERGIE 7');
        $this->actingAs($compte, 'api')->getJson('/api/client/profil')->assertJsonPath('data.non_lues', 0);
    }

    public function test_client_commande_sans_ressaisir_nom_ni_telephone(): void
    {
        $compte = $this->creerCompteClient();
        $p = $this->produit();

        $payload = $this->payload($p);
        unset($payload['nom'], $payload['telephone']);

        $id = $this->actingAs($compte, 'api')->postJson('/api/client/commandes', $payload)->assertCreated()->json('data.id');

        $commande = Commande::findOrFail($id);
        $this->assertSame('Quincaillerie Mba', $commande->nom_livraison);
        $this->assertSame('+241066112233', $commande->telephone_livraison);
    }

    public function test_livraison_cree_le_bon_de_livraison_garde_dans_l_historique_client(): void
    {
        $compte = $this->creerCompteClient();
        $admin = User::factory()->create(['role' => 'LG_ADMIN']);
        $chauffeur = User::factory()->create(['role' => 'CHAUFFEUR']);
        $p = $this->produit();

        $id = $this->actingAs($compte, 'api')->postJson('/api/client/commandes', $this->payload($p))->json('data.id');
        $this->actingAs($admin, 'api')->postJson("/api/commandes/{$id}/valider")->assertOk();
        $this->actingAs($admin, 'api')->postJson("/api/commandes/{$id}/expedier", ['chauffeur_id' => $chauffeur->id])->assertOk();
        $this->actingAs($chauffeur, 'api')->postJson("/api/commandes/{$id}/livrer", [
            'receptionnaire' => 'Paul Mba',
            'montant' => 20000,
            'mode' => 'ESPECES',
        ])->assertOk();

        $bon = BonLivraison::where('commande_id', $id)->firstOrFail();
        $this->assertMatchesRegularExpression('/^BL-\d{5}-'.date('Y').'$/', $bon->numero);
        $this->assertSame('Paul Mba', $bon->receptionnaire);
        $this->assertEquals(20000, (int) $bon->montant_total);
        $this->assertSame(1, $bon->lignes()->count());

        $this->actingAs($compte, 'api')->getJson("/api/client/commandes/{$id}")
            ->assertOk()
            ->assertJsonPath('data.bon_livraison.numero', $bon->numero)
            // La signature reste réservée aux agents G-ENERGIE 7.
            ->assertJsonMissingPath('data.bon_livraison.signature')
            ->assertJsonMissingPath('data.livraison.signature');

        // Commande terminée : toujours dans l'historique, filtre « terminées ».
        $this->actingAs($compte, 'api')->getJson('/api/client/commandes?etat=terminees')->assertJsonPath('data.0.id', $id);
        $this->actingAs($compte, 'api')->getJson('/api/client/commandes?etat=en_cours')->assertJsonCount(0, 'data');
    }

    public function test_client_isole_de_ses_commandes_et_du_back_office(): void
    {
        $compte = $this->creerCompteClient();
        $autre = User::factory()->create(['role' => 'CLIENT']);
        $p = $this->produit();

        $id = $this->actingAs($compte, 'api')->postJson('/api/client/commandes', $this->payload($p))->json('data.id');

        $this->actingAs($autre, 'api')->getJson("/api/client/commandes/{$id}")->assertNotFound();
        $this->actingAs($compte, 'api')->getJson('/api/stocks')->assertForbidden();
        $this->actingAs($compte, 'api')->getJson("/api/commandes/{$id}")->assertForbidden();
        $this->actingAs($compte, 'api')->postJson("/api/commandes/{$id}/remise", ['decision' => 'accorder', 'taux' => 50])->assertForbidden();
    }
}
