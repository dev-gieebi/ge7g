<?php

namespace Tests\Feature;

use App\Events\DonneesModifiees;
use App\Models\Category;
use App\Models\Unit;
use App\Models\User;
use App\Services\TempsReel;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

/** Un enregistrement prévient les écrans ouverts (websocket), une fois par requête. */
class TempsReelTest extends TestCase
{
    use RefreshDatabase;

    public function test_creation_de_produit_diffuse_un_seul_signal(): void
    {
        $admin = User::factory()->create(['role' => 'DG_ADMIN']);
        $categorie = Category::firstOrCreate(['slug' => 'tests'], ['name' => 'Tests']);
        $unite = Unit::firstOrCreate(['symbol' => 'pc'], ['name' => 'Pièce']);
        app(TempsReel::class)->diffuser();

        Event::fake([DonneesModifiees::class]);

        $this->actingAs($admin, 'api')->postJson('/api/products', [
            'name' => 'Disjoncteur 63 A',
            'category_id' => $categorie->id,
            'unit_id' => $unite->id,
        ])->assertCreated();

        // Diffusion après la réponse (fin de requête).
        app(TempsReel::class)->diffuser();

        Event::assertDispatchedTimes(DonneesModifiees::class, 1);
        Event::assertDispatched(DonneesModifiees::class, fn (DonneesModifiees $e) => in_array('products', $e->ressources, true)
            && $e->broadcastAs() === 'donnees.modifiees');
    }
}
