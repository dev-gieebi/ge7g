<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Pas deux catégories ni deux unités du même nom (casse et espaces ignorés). */
class CategorieUniteDoublonTest extends TestCase
{
    use RefreshDatabase;

    public function test_categorie_en_double_refusee(): void
    {
        $admin = User::factory()->create(['role' => 'DG_ADMIN']);

        $this->actingAs($admin, 'api')->postJson('/api/categories', ['name' => 'Ciment'])->assertCreated();
        $this->actingAs($admin, 'api')->postJson('/api/categories', ['name' => '  ciment '])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('name');

        $fer = $this->actingAs($admin, 'api')->postJson('/api/categories', ['name' => 'Fer'])->assertCreated()->json('data.id');
        $this->actingAs($admin, 'api')->putJson("/api/categories/{$fer}", ['name' => 'CIMENT'])->assertUnprocessable();
        $this->actingAs($admin, 'api')->putJson("/api/categories/{$fer}", ['name' => 'Fer'])->assertOk();
    }

    public function test_unite_en_double_refusee(): void
    {
        $admin = User::factory()->create(['role' => 'DG_ADMIN']);

        $this->actingAs($admin, 'api')->postJson('/api/units', ['name' => 'Sac', 'symbol' => 'sac'])->assertCreated();
        $this->actingAs($admin, 'api')->postJson('/api/units', ['name' => 'SAC', 'symbol' => 'sc'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('name');
        $this->actingAs($admin, 'api')->postJson('/api/units', ['name' => 'Sachet', 'symbol' => 'SAC'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('symbol');
    }
}
