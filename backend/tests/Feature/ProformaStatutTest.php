<?php

namespace Tests\Feature;

use App\Models\Quote;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Proforma : d'abord validée, ensuite envoyée ; annulée, elle est figée. */
class ProformaStatutTest extends TestCase
{
    use RefreshDatabase;

    private function proforma(User $auteur): Quote
    {
        return Quote::create([
            'number' => 'DEV-2026-'.fake()->unique()->numberBetween(10000, 99999),
            'user_id' => $auteur->id,
            'customer_name' => 'Client test',
            'status' => 'BROUILLON',
        ]);
    }

    public function test_envoi_seulement_apres_validation(): void
    {
        $admin = User::factory()->create(['role' => 'LG_ADMIN']);
        $q = $this->proforma($admin);

        // Brouillon : impossible d'envoyer avant de valider.
        $this->actingAs($admin, 'api')->postJson("/api/quotes/{$q->id}/status", ['status' => 'ENVOYE'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('status');

        $this->actingAs($admin, 'api')->postJson("/api/quotes/{$q->id}/status", ['status' => 'VALIDE'])->assertOk()->assertJsonPath('data.status', 'VALIDE');
        $this->actingAs($admin, 'api')->postJson("/api/quotes/{$q->id}/status", ['status' => 'ENVOYE'])->assertOk()->assertJsonPath('data.status', 'ENVOYE');

        // Envoyée : plus de retour en arrière, plus d'annulation, frais annexes figés.
        $this->actingAs($admin, 'api')->postJson("/api/quotes/{$q->id}/status", ['status' => 'VALIDE'])->assertUnprocessable();
        $this->actingAs($admin, 'api')->postJson("/api/quotes/{$q->id}/status", ['status' => 'ANNULE'])->assertUnprocessable();
        $this->actingAs($admin, 'api')->postJson("/api/quotes/{$q->id}/extras", ['extras' => []])->assertUnprocessable();
    }

    public function test_proforma_validee_ne_s_annule_plus(): void
    {
        $admin = User::factory()->create(['role' => 'LG_ADMIN']);
        $q = $this->proforma($admin);

        $this->actingAs($admin, 'api')->postJson("/api/quotes/{$q->id}/status", ['status' => 'VALIDE'])->assertOk();
        $this->actingAs($admin, 'api')->postJson("/api/quotes/{$q->id}/status", ['status' => 'ANNULE'])->assertUnprocessable();
    }

    public function test_proforma_annulee_ne_change_plus(): void
    {
        $admin = User::factory()->create(['role' => 'DG_ADMIN']);
        $q = $this->proforma($admin);

        $this->actingAs($admin, 'api')->postJson("/api/quotes/{$q->id}/status", ['status' => 'ANNULE'])->assertOk();
        $this->actingAs($admin, 'api')->postJson("/api/quotes/{$q->id}/status", ['status' => 'VALIDE'])->assertUnprocessable();
    }
}
