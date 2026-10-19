<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Commande;
use App\Models\Driver;
use App\Models\Product;
use App\Models\Unit;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Logistique boutique : fiches chauffeurs + compte plateforme, affectation
 * après validation, espace chauffeur et position GPS de la livraison.
 */
class LogistiqueTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['role' => 'LG_ADMIN']);
    }

    private function commandeValidee(User $admin): Commande
    {
        $categorie = Category::firstOrCreate(['slug' => 'tests'], ['name' => 'Tests']);
        $unite = Unit::firstOrCreate(['symbol' => 'pc'], ['name' => 'Pièce']);
        $produit = Product::create([
            'reference' => 'TEST-'.fake()->unique()->numberBetween(100, 999),
            'name' => 'Produit test',
            'category_id' => $categorie->id,
            'unit_id' => $unite->id,
            'sale_price' => 10000,
            'stock_quantity' => 50,
            'reserved_quantity' => 0,
            'min_stock' => 0,
        ]);

        $this->postJson('/api/public/commandes', [
            'nom' => 'Jean Mba',
            'telephone' => '066112233',
            'ville' => 'Libreville',
            'quartier' => 'Glass',
            'point_repere' => 'Face à la pharmacie',
            'lignes' => [['produit_id' => $produit->id, 'quantite' => 1]],
        ])->assertCreated();

        $commande = Commande::firstOrFail();
        $this->actingAs($admin, 'api')->postJson("/api/commandes/{$commande->id}/valider")->assertOk();

        return $commande->fresh();
    }

    public function test_creation_chauffeur_cree_son_compte_plateforme(): void
    {
        $admin = $this->admin();

        $res = $this->actingAs($admin, 'api')->postJson('/api/drivers', [
            'name' => 'Franck Nzue',
            'phone' => '066998877',
            'license_number' => 'LBV-12345',
            'password' => 'Motdepasse1',
        ]);

        $res->assertCreated();
        $code = $res->json('compte.code');
        $this->assertMatchesRegularExpression('/^\d{8}$/', $code);

        $driver = Driver::firstOrFail();
        $user = User::where('role', 'CHAUFFEUR')->firstOrFail();
        // La fiche et le compte sont liés dans les deux sens.
        $this->assertEquals($user->id, $driver->user_id);
        $this->assertEquals($driver->id, $user->driver_id);
        $this->assertFalse((bool) $user->is_admin);

        // Le chauffeur peut se connecter avec le code renvoyé + mot de passe.
        $this->postJson('/api/login', ['code' => $code, 'password' => 'Motdepasse1'])
            ->assertOk()
            ->assertJsonPath('user.role', 'CHAUFFEUR');
    }

    public function test_role_chauffeur_interdit_dans_la_gestion_des_utilisateurs(): void
    {
        $superadmin = User::factory()->create(['role' => 'SUPERADMIN']);
        $chauffeur = User::factory()->create(['role' => 'CHAUFFEUR']);

        // Pas de création de compte chauffeur via /users : ça se fait dans
        // Logistique → Chauffeurs (fiche + compte lié).
        $this->actingAs($superadmin, 'api')
            ->postJson('/api/users', ['name' => 'Chauffeur Test', 'role' => 'CHAUFFEUR'])
            ->assertUnprocessable();

        // Pas de passage d'un utilisateur existant au rôle CHAUFFEUR.
        $autre = User::factory()->create(['role' => 'CAISSIER']);
        $this->actingAs($superadmin, 'api')
            ->putJson("/api/users/{$autre->id}", ['name' => $autre->name, 'role' => 'CHAUFFEUR'])
            ->assertUnprocessable();

        // Pas de suppression d'un compte chauffeur depuis les paramètres.
        $this->actingAs($superadmin, 'api')
            ->deleteJson("/api/users/{$chauffeur->id}")
            ->assertUnprocessable();
    }

    public function test_suppression_chauffeur_supprime_fiche_et_compte(): void
    {
        $admin = $this->admin();

        $this->actingAs($admin, 'api')->postJson('/api/drivers', [
            'name' => 'Franck Nzue',
            'phone' => '066998877',
            'password' => 'Motdepasse1',
        ])->assertCreated();

        $driver = Driver::firstOrFail();
        $user = User::where('role', 'CHAUFFEUR')->firstOrFail();

        $this->actingAs($admin, 'api')->deleteJson("/api/drivers/{$driver->id}")->assertNoContent();
        $this->assertDatabaseMissing('drivers', ['id' => $driver->id]);
        $this->assertDatabaseMissing('users', ['id' => $user->id]);
    }

    public function test_suppression_chauffeur_bloquee_pendant_une_livraison(): void
    {
        $admin = $this->admin();

        $this->actingAs($admin, 'api')->postJson('/api/drivers', [
            'name' => 'Franck Nzue',
            'phone' => '066998877',
            'password' => 'Motdepasse1',
        ])->assertCreated();

        $driver = Driver::firstOrFail();
        $user = User::where('role', 'CHAUFFEUR')->firstOrFail();

        $commande = $this->commandeValidee($admin);
        $this->actingAs($admin, 'api')
            ->postJson("/api/commandes/{$commande->id}/affecter", ['chauffeur_id' => $user->id])
            ->assertOk();
        $this->actingAs($user, 'api')
            ->postJson("/api/commandes/{$commande->id}/demarrer", ['latitude' => 0.39, 'longitude' => 9.45])
            ->assertOk();

        $this->actingAs($admin, 'api')->deleteJson("/api/drivers/{$driver->id}")->assertUnprocessable();
        $this->assertDatabaseHas('drivers', ['id' => $driver->id]);
        $this->assertDatabaseHas('users', ['id' => $user->id]);
    }

    public function test_affectation_refusee_avant_validation(): void
    {
        $admin = $this->admin();
        $chauffeur = User::factory()->create(['role' => 'CHAUFFEUR']);

        $categorie = Category::firstOrCreate(['slug' => 'tests'], ['name' => 'Tests']);
        $unite = Unit::firstOrCreate(['symbol' => 'pc'], ['name' => 'Pièce']);
        $produit = Product::create([
            'reference' => 'TEST-1', 'name' => 'P', 'category_id' => $categorie->id,
            'unit_id' => $unite->id, 'sale_price' => 10000, 'stock_quantity' => 50,
            'reserved_quantity' => 0, 'min_stock' => 0,
        ]);
        $this->postJson('/api/public/commandes', [
            'nom' => 'Jean Mba', 'telephone' => '066112233', 'ville' => 'Libreville',
            'quartier' => 'Glass', 'point_repere' => 'Repère',
            'lignes' => [['produit_id' => $produit->id, 'quantite' => 1]],
        ])->assertCreated();
        $commande = Commande::firstOrFail();

        // en_attente : pas d'affectation possible.
        $this->actingAs($admin, 'api')
            ->postJson("/api/commandes/{$commande->id}/affecter", ['chauffeur_id' => $chauffeur->id])
            ->assertUnprocessable();
        $this->assertNull($commande->fresh()->chauffeur_id);

        // Un non-chauffeur ne peut pas être affecté.
        $this->actingAs($admin, 'api')->postJson("/api/commandes/{$commande->id}/valider")->assertOk();
        $this->actingAs($admin, 'api')
            ->postJson("/api/commandes/{$commande->id}/affecter", ['chauffeur_id' => $admin->id])
            ->assertUnprocessable();

        // Après validation, l'affectation fonctionne sans changer le statut.
        $this->actingAs($admin, 'api')
            ->postJson("/api/commandes/{$commande->id}/affecter", ['chauffeur_id' => $chauffeur->id])
            ->assertOk()
            ->assertJsonPath('data.chauffeur.id', $chauffeur->id);
        $this->assertEquals('validee', $commande->fresh()->statut->value);
    }

    public function test_chauffeur_ne_voit_que_ses_commandes(): void
    {
        $admin = $this->admin();
        $c1 = $this->commandeValidee($admin);
        $chauffeurA = User::factory()->create(['role' => 'CHAUFFEUR']);
        $chauffeurB = User::factory()->create(['role' => 'CHAUFFEUR']);

        $this->actingAs($admin, 'api')
            ->postJson("/api/commandes/{$c1->id}/affecter", ['chauffeur_id' => $chauffeurA->id])
            ->assertOk();

        // Le chauffeur A voit sa commande, le B ne voit rien.
        $liste = $this->actingAs($chauffeurA, 'api')->getJson('/api/commandes');
        $liste->assertOk();
        $this->assertCount(1, $liste->json('data'));
        $this->assertCount(0, $this->actingAs($chauffeurB, 'api')->getJson('/api/commandes')->json('data'));

        // La commande d'un autre chauffeur est inaccessible (403).
        $this->actingAs($chauffeurB, 'api')->getJson("/api/commandes/{$c1->id}")->assertForbidden();
        $this->actingAs($chauffeurB, 'api')->postJson("/api/commandes/{$c1->id}/demarrer", [])->assertForbidden();
    }

    public function test_demarrer_mission_gps_et_position_suivie_publiquement(): void
    {
        $admin = $this->admin();
        $commande = $this->commandeValidee($admin);
        $chauffeurUser = User::factory()->create(['role' => 'CHAUFFEUR']);
        $driver = Driver::create(['user_id' => $chauffeurUser->id, 'name' => 'Franck', 'phone' => '066998877', 'status' => 'DISPONIBLE']);

        $this->actingAs($admin, 'api')
            ->postJson("/api/commandes/{$commande->id}/affecter", ['chauffeur_id' => $chauffeurUser->id])
            ->assertOk();

        // Départ mission : GPS réel enregistré, statut en_livraison.
        $this->actingAs($chauffeurUser, 'api')
            ->postJson("/api/commandes/{$commande->id}/demarrer", ['latitude' => 0.3901, 'longitude' => 9.4544])
            ->assertOk()
            ->assertJsonPath('data.statut', 'en_livraison')
            ->assertJsonPath('data.livraison.latitude', 0.3901);

        $this->assertEquals('EN_MISSION', $driver->fresh()->status);

        // La position évolue pendant la route.
        $this->actingAs($chauffeurUser, 'api')
            ->postJson("/api/commandes/{$commande->id}/position", ['latitude' => 0.41, 'longitude' => 9.46])
            ->assertOk();

        // Le suivi public (n° + téléphone) expose la position du chauffeur.
        $suivi = $this->postJson('/api/public/suivi', [
            'numero' => $commande->numero, 'telephone' => '066112233',
        ])->assertOk();
        $this->assertEquals(0.41, $suivi->json('data.position.latitude'));
        $this->assertEquals(9.46, $suivi->json('data.position.longitude'));

        // Après livraison, plus de position exposée et chauffeur disponible.
        $this->actingAs($chauffeurUser, 'api')->postJson("/api/commandes/{$commande->id}/livrer", [
            'receptionnaire' => 'Jean Mba', 'montant' => 10000, 'mode' => 'ESPECES',
        ])->assertOk();

        $suivi = $this->postJson('/api/public/suivi', [
            'numero' => $commande->numero, 'telephone' => '066112233',
        ])->assertOk();
        $this->assertNull($suivi->json('data.position'));
        $this->assertEquals('DISPONIBLE', $driver->fresh()->status);
    }

    public function test_position_rejetee_hors_livraison(): void
    {
        $admin = $this->admin();
        $commande = $this->commandeValidee($admin);
        $chauffeur = User::factory()->create(['role' => 'CHAUFFEUR']);

        $this->actingAs($admin, 'api')
            ->postJson("/api/commandes/{$commande->id}/affecter", ['chauffeur_id' => $chauffeur->id])
            ->assertOk();

        // Pas encore en livraison : la position est refusée.
        $this->actingAs($chauffeur, 'api')
            ->postJson("/api/commandes/{$commande->id}/position", ['latitude' => 0.39, 'longitude' => 9.45])
            ->assertUnprocessable();
    }
}
