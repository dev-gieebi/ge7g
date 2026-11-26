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
            // Ville tarifaire : prix du barème (sinon prix à saisir par l'équipe).
            'zone_id' => Zone::firstOrCreate(['code' => 'LBV'], ['name' => 'Libreville'])->id,
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

    public function test_client_commande_meme_en_rupture_avec_annotation_sans_remise(): void
    {
        $compte = $this->creerCompteClient();
        $p = $this->produit(['stock_quantity' => 0]);

        // Une remise envoyée par le navigateur est ignorée : le client n'en demande pas.
        $res = $this->actingAs($compte, 'api')->postJson('/api/client/commandes', $this->payload($p, [
            'annotation' => 'Livrer avant 10 h svp',
            'remise_taux' => 10,
        ]));
        $res->assertCreated();

        $commande = Commande::findOrFail($res->json('data.id'));
        $this->assertSame($compte->id, $commande->user_id);
        $this->assertSame($compte->client_id, $commande->client_id);
        $this->assertNull($commande->remise_statut);
        $this->assertEquals(20000, (int) $commande->total);
        $this->assertDatabaseHas('commande_annotations', ['commande_id' => $commande->id, 'auteur' => 'client', 'contenu' => 'Livrer avant 10 h svp']);

        // Le détail client n'expose jamais le stock.
        $detail = $this->actingAs($compte, 'api')->getJson("/api/client/commandes/{$commande->id}");
        $detail->assertOk();
        $this->assertArrayNotHasKey('stock_disponible', $detail->json('data.lignes.0'));

        $this->actingAs($compte, 'api')->postJson("/api/client/commandes/{$commande->id}/remise", ['remise_taux' => 10])->assertNotFound();
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

        $id = $this->actingAs($compte, 'api')->postJson('/api/client/commandes', $this->payload($p))->json('data.id');
        // Demande de remise enregistrée avant le retrait de l'option côté client.
        Commande::whereKey($id)->update(['remise_statut' => 'demandee', 'remise_taux_demande' => 10]);

        // Remise en attente : seul le DG décide, la validation attend sa décision.
        $this->actingAs($admin, 'api')->postJson("/api/commandes/{$id}/remise", ['decision' => 'accorder'])->assertForbidden();
        $this->actingAs($admin, 'api')->postJson("/api/commandes/{$id}/valider")->assertUnprocessable();

        $this->actingAs($dg, 'api')->postJson("/api/commandes/{$id}/remise", ['decision' => 'accorder', 'taux' => 5])
            ->assertOk()
            ->assertJsonPath('data.remise.statut', 'accordee')
            ->assertJsonPath('data.remise.montant', 1000)
            ->assertJsonPath('data.total', 19000)
            ->assertJsonPath('data.sous_total', 20000);

        // Décision prise : plus de seconde décision.
        $this->actingAs($dg, 'api')->postJson("/api/commandes/{$id}/remise", ['decision' => 'refuser'])->assertUnprocessable();

        $this->actingAs($admin, 'api')->postJson("/api/commandes/{$id}/valider")->assertOk();

        $this->assertEquals(19000, (int) Facture::where('commande_id', $id)->value('montant_total'));
        $vente = PosSale::where('source', 'boutique_en_ligne')->firstOrFail();
        $this->assertEquals(20000, (int) $vente->subtotal);
        $this->assertEquals(5, (float) $vente->discount_rate);
        $this->assertEquals(19000, (int) $vente->total);
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

    public function test_catalogue_client_complet_sans_prix_ni_stock(): void
    {
        $compte = $this->creerCompteClient();
        // Produit sans aucun barème : absent de la boutique publique, visible du client.
        $p = $this->produit(['name' => 'Câble 16 mm²']);

        $res = $this->actingAs($compte, 'api')->getJson('/api/client/produits?search=Câble')->assertOk();

        $res->assertJsonPath('data.0.id', $p->id)
            ->assertJsonMissingPath('data.0.prix')
            ->assertJsonMissingPath('data.0.disponibilite');

        $this->actingAs(User::factory()->create(['role' => 'LG_ADMIN']), 'api')->getJson('/api/client/produits')->assertForbidden();
    }

    public function test_produit_inconnu_reference_par_l_equipe_avant_validation(): void
    {
        $compte = $this->creerCompteClient();
        $admin = User::factory()->create(['role' => 'LG_ADMIN']);
        $p = $this->produit();

        $id = $this->actingAs($compte, 'api')->postJson('/api/client/commandes', $this->payload($p, [
            'lignes' => [
                ['produit_id' => $p->id, 'quantite' => 2],
                ['designation' => 'Disjoncteur 63 A', 'precision' => 'Marque Schneider', 'quantite' => 3],
            ],
        ]))->assertCreated()->json('data.id');

        // Le client ne voit aucun prix avant la facture.
        $this->actingAs($compte, 'api')->getJson("/api/client/commandes/{$id}")
            ->assertJsonPath('data.total', null)
            ->assertJsonPath('data.lignes.0.prix_unitaire', null)
            ->assertJsonPath('data.lignes.1.inconnu', true)
            ->assertJsonPath('data.lignes.1.precision', 'Marque Schneider');
        $this->actingAs($compte, 'api')->getJson('/api/client/commandes')->assertJsonPath('data.0.total', null);

        // Validation bloquée tant que le produit demandé n'est pas référencé.
        $this->actingAs($admin, 'api')->getJson('/api/commandes')->assertJsonPath('data.0.a_referencer', 1);
        $this->actingAs($admin, 'api')->postJson("/api/commandes/{$id}/valider")->assertUnprocessable();

        $nouveau = $this->produit(['name' => 'Disjoncteur 63 A', 'sale_price' => 5000]);
        $ligne = Commande::findOrFail($id)->lignes()->whereNull('produit_id')->firstOrFail();
        $this->actingAs($admin, 'api')->postJson("/api/commandes/{$id}/lignes/{$ligne->id}", ['produit_id' => $nouveau->id])
            ->assertOk()
            ->assertJsonPath('data.total', 35000);

        $this->actingAs($admin, 'api')->postJson("/api/commandes/{$id}/valider")->assertOk();

        // Facture émise : les prix deviennent visibles pour le client.
        $this->actingAs($compte, 'api')->getJson("/api/client/commandes/{$id}")
            ->assertJsonPath('data.total', 35000)
            ->assertJsonPath('data.lignes.1.inconnu', false);
    }

    public function test_prix_selon_la_ville_ou_a_saisir_sans_ville(): void
    {
        $zone = Zone::firstOrCreate(['code' => 'LBV'], ['name' => 'Libreville']);
        $compte = $this->creerCompteClient();
        $admin = User::factory()->create(['role' => 'LG_ADMIN']);
        $p = $this->produit();
        $p->prices()->create(['zone_id' => $zone->id, 'amount' => 12000]);

        // Ville tarifaire choisie : prix du barème de la ville.
        $avecVille = $this->actingAs($compte, 'api')->postJson('/api/client/commandes', $this->payload($p, ['zone_id' => $zone->id]))->json('data.id');
        $this->assertEquals(24000, (int) Commande::findOrFail($avecVille)->total);

        // Sans ville tarifaire : prix vide, à saisir par l'équipe avant validation.
        $sansVille = $this->actingAs($compte, 'api')->postJson('/api/client/commandes', $this->payload($p, ['ville' => 'Mouila', 'zone_id' => null]))->json('data.id');
        $ligne = Commande::findOrFail($sansVille)->lignes()->firstOrFail();
        $this->assertEquals(0, (int) $ligne->prix_unitaire);
        $this->actingAs($admin, 'api')->postJson("/api/commandes/{$sansVille}/valider")->assertUnprocessable();

        // Produit choisi dans le catalogue : il ne peut pas être remplacé par un autre.
        $autre = $this->produit(['name' => 'Autre produit']);
        $this->actingAs($admin, 'api')->postJson("/api/commandes/{$sansVille}/lignes/{$ligne->id}", ['produit_id' => $autre->id])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('produit_id');

        $this->actingAs($admin, 'api')->postJson("/api/commandes/{$sansVille}/lignes/{$ligne->id}", ['prix_unitaire' => 9000])
            ->assertOk()
            ->assertJsonPath('data.total', 18000);
        $this->actingAs($admin, 'api')->postJson("/api/commandes/{$sansVille}/valider")->assertOk();
    }

    public function test_client_ajoute_des_produits_tant_que_en_attente(): void
    {
        $compte = $this->creerCompteClient();
        $admin = User::factory()->create(['role' => 'LG_ADMIN']);
        $p = $this->produit();

        $id = $this->actingAs($compte, 'api')->postJson('/api/client/commandes', $this->payload($p))->json('data.id');

        // Même produit ajouté : une seule ligne, quantités cumulées (2 + 1 = 3).
        $this->actingAs($compte, 'api')->postJson("/api/client/commandes/{$id}/lignes", [
            'lignes' => [['produit_id' => $p->id, 'quantite' => 1], ['designation' => 'Gaine ICTA 20', 'quantite' => 5]],
        ])->assertOk()
            ->assertJsonCount(2, 'data.lignes')
            ->assertJsonPath('data.lignes.0.quantite', 3);
        $this->assertEquals(30000, (int) Commande::findOrFail($id)->total);

        // Même produit hors catalogue redemandé (casse différente) : cumulé aussi.
        $this->actingAs($compte, 'api')->postJson("/api/client/commandes/{$id}/lignes", [
            'lignes' => [['designation' => 'gaine icta 20', 'quantite' => 2]],
        ])->assertOk()->assertJsonCount(2, 'data.lignes')->assertJsonPath('data.lignes.1.quantite', 7);

        // L'équipe référence la gaine vers un produit déjà dans la commande : fusion des lignes.
        $ligne = Commande::findOrFail($id)->lignes()->whereNull('produit_id')->firstOrFail();
        $this->actingAs($admin, 'api')->postJson("/api/commandes/{$id}/lignes/{$ligne->id}", ['produit_id' => $p->id, 'prix_unitaire' => 300])
            ->assertOk()
            ->assertJsonCount(1, 'data.lignes')
            ->assertJsonPath('data.lignes.0.quantite', 10)
            ->assertJsonPath('data.total', 3000);
        $this->actingAs($admin, 'api')->postJson("/api/commandes/{$id}/valider")->assertOk();

        $this->actingAs($compte, 'api')->postJson("/api/client/commandes/{$id}/lignes", [
            'lignes' => [['produit_id' => $p->id, 'quantite' => 1]],
        ])->assertUnprocessable();
    }

    public function test_lignes_en_double_deja_enregistrees_sont_regroupees(): void
    {
        $compte = $this->creerCompteClient();
        $admin = User::factory()->create(['role' => 'LG_ADMIN']);
        $fer = $this->produit(['name' => 'Fer A de 12', 'sale_price' => 1000]);

        $id = $this->actingAs($compte, 'api')->postJson('/api/client/commandes', $this->payload($fer, ['lignes' => [['produit_id' => $fer->id, 'quantite' => 1]]]))->json('data.id');
        $this->actingAs($admin, 'api')->postJson("/api/commandes/{$id}/valider")->assertOk();

        // Ancienne commande : même produit sur deux lignes (1 barre + 25 barres), en double aussi dans la vente.
        $commande = Commande::findOrFail($id);
        $ligne = $commande->lignes()->firstOrFail();
        $commande->lignes()->create(['produit_id' => $fer->id, 'designation' => $ligne->designation, 'prix_unitaire' => 1000, 'quantite' => 25, 'total_ligne' => 25000]);
        $vente = $commande->facture->vente;
        $vente->items()->create(['product_id' => $fer->id, 'quantity' => 25, 'delivered_quantity' => 0, 'unit_price' => 1000, 'total' => 25000]);

        (require database_path('migrations/2026_11_26_123659_fusionner_lignes_en_double_des_commandes.php'))->up();

        $this->actingAs($compte, 'api')->getJson("/api/client/commandes/{$id}")
            ->assertJsonCount(1, 'data.lignes')
            ->assertJsonPath('data.lignes.0.quantite', 26)
            ->assertJsonPath('data.lignes.0.total_ligne', 26000);
        $this->actingAs($admin, 'api')->getJson("/api/commandes/{$id}")->assertJsonCount(1, 'data.lignes');
        $this->assertSame(1, $vente->items()->count());
        $this->assertEquals(26, (float) $vente->items()->value('quantity'));
    }

    public function test_adresse_de_la_commande_par_cle_opaque(): void
    {
        $compte = $this->creerCompteClient();
        $p = $this->produit();

        $cree = $this->actingAs($compte, 'api')->postJson('/api/client/commandes', $this->payload($p))->assertCreated();
        $id = $cree->json('data.id');
        $cle = $cree->json('data.cle');

        // La clé ne contient pas l'identifiant en clair et ouvre la commande.
        $this->assertMatchesRegularExpression('/^[0-9A-Za-z]{16}_[0-9a-z]+$/', $cle);
        $this->actingAs($compte, 'api')->getJson("/api/client/commandes/{$cle}")->assertOk()->assertJsonPath('data.id', $id);
        $this->actingAs($compte, 'api')->getJson('/api/client/commandes')->assertJsonPath('data.0.cle', $cle);

        // Clé modifiée ou fabriquée pour un autre numéro : introuvable.
        $falsifiee = 'AAAAAAAAAAAAAAAA_'.base_convert((string) $id, 10, 36);
        $this->actingAs($compte, 'api')->getJson("/api/client/commandes/{$falsifiee}")->assertNotFound();

        // Clé valide d'une commande d'un autre client : toujours refusée.
        $autre = Commande::create(['numero' => 'CMD-99999-2026', 'client_id' => $compte->client_id, 'nom_livraison' => 'X', 'telephone_livraison' => 'X', 'ville' => 'X', 'quartier' => 'X', 'point_repere' => 'X', 'total' => 0, 'statut' => 'en_attente']);
        $this->actingAs($compte, 'api')->getJson("/api/client/commandes/{$autre->cle}")->assertNotFound();
    }

    public function test_facture_soldee_definitivement_et_visible_du_client(): void
    {
        $compte = $this->creerCompteClient();
        $admin = User::factory()->create(['role' => 'LG_ADMIN']);
        $p = $this->produit();

        $id = $this->actingAs($compte, 'api')->postJson('/api/client/commandes', $this->payload($p))->json('data.id');
        $this->actingAs($admin, 'api')->postJson("/api/commandes/{$id}/solder")->assertUnprocessable();
        $this->actingAs($admin, 'api')->postJson("/api/commandes/{$id}/valider")->assertOk();

        $soldee = $this->actingAs($admin, 'api')->postJson("/api/commandes/{$id}/solder")->assertOk()->json('data.facture.soldee_le');
        $this->assertNotNull($soldee);

        // Un second appel ne change rien : soldée reste soldée.
        $this->actingAs($admin, 'api')->postJson("/api/commandes/{$id}/solder")->assertOk()->assertJsonPath('data.facture.soldee_le', $soldee);

        $this->actingAs($compte, 'api')->getJson("/api/client/commandes/{$id}")->assertJsonPath('data.facture.soldee_le', $soldee);
        $this->actingAs($compte, 'api')->postJson("/api/commandes/{$id}/solder")->assertForbidden();
    }

    public function test_mise_en_livraison_sans_chauffeur(): void
    {
        $compte = $this->creerCompteClient();
        $admin = User::factory()->create(['role' => 'LG_ADMIN']);
        $p = $this->produit();

        $id = $this->actingAs($compte, 'api')->postJson('/api/client/commandes', $this->payload($p))->json('data.id');
        $this->actingAs($admin, 'api')->postJson("/api/commandes/{$id}/valider")->assertOk();
        $this->actingAs($admin, 'api')->postJson("/api/commandes/{$id}/demarrer")->assertOk()->assertJsonPath('data.statut', 'en_livraison');
        $this->actingAs($compte, 'api')->getJson('/api/client/profil')->assertJsonPath('data.en_cours', 1);

        // Un simple clic « Livrée » : ni réceptionnaire, ni encaissement, ni signature.
        $this->actingAs($admin, 'api')->postJson("/api/commandes/{$id}/livrer")->assertOk()->assertJsonPath('data.statut', 'livree');

        $this->assertNotNull(BonLivraison::where('commande_id', $id)->first());
        $this->actingAs($compte, 'api')->getJson('/api/client/profil')->assertJsonPath('data.en_cours', 0);

        // Archive : la facture et le bon de livraison de la commande, rangés ensemble.
        $this->actingAs($compte, 'api')->getJson('/api/client/documents')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.commande_id', $id)
            ->assertJsonPath('data.0.bon_livraison.numero', BonLivraison::where('commande_id', $id)->value('numero'));
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
