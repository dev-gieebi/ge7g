<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Chiffres financiers (ventes caisse, CA du jour et du mois, courbe du CA) :
 * visibles uniquement par la Direction et le Super admin.
 */
class ChiffresFinanciersTest extends TestCase
{
    use RefreshDatabase;

    public function test_direction_et_super_admin_voient_les_chiffres_financiers(): void
    {
        foreach (['DG_ADMIN', 'SUPERADMIN'] as $role) {
            $user = User::factory()->create(['role' => $role]);

            $this->actingAs($user, 'api')->getJson('/api/dashboard')->assertOk()->assertJsonPath('data.pos_sales', 0);
            $this->actingAs($user, 'api')->getJson('/api/dashboard/sales-series')->assertOk();
            $this->actingAs($user, 'api')->getJson('/api/commandes/stats')->assertOk()->assertJsonPath('data.ca_boutique_jour', 0);
        }
    }

    public function test_prix_bareme_reserve_a_la_direction_et_au_super_admin(): void
    {
        foreach (['DG_ADMIN', 'SUPERADMIN'] as $role) {
            $this->actingAs(User::factory()->create(['role' => $role]), 'api')->getJson('/api/prices')->assertOk();
        }

        foreach (['LG_ADMIN', 'CDG_ADMIN', 'CAISSIER'] as $role) {
            $this->actingAs(User::factory()->create(['role' => $role]), 'api')->getJson('/api/prices')->assertForbidden();
        }
    }

    public function test_les_autres_roles_ne_voient_pas_les_chiffres_financiers(): void
    {
        foreach (['LG_ADMIN', 'CDG_ADMIN', 'CAISSIER'] as $role) {
            $user = User::factory()->create(['role' => $role]);

            $this->actingAs($user, 'api')->getJson('/api/dashboard')->assertOk()->assertJsonPath('data.pos_sales', null);
            $this->actingAs($user, 'api')->getJson('/api/dashboard/sales-series')->assertForbidden();
        }

        foreach (['LG_ADMIN', 'CDG_ADMIN'] as $role) {
            $this->actingAs(User::factory()->create(['role' => $role]), 'api')->getJson('/api/commandes/stats')
                ->assertOk()
                ->assertJsonPath('data.ca_boutique_jour', null)
                ->assertJsonPath('data.ca_boutique_mois', null);
        }
    }
}
