<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\Commande;
use App\Models\Compteur;
use App\Models\PosSale;
use App\Models\Purchase;
use App\Models\Supplier;
use App\Models\User;
use App\Services\NumerotationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/** Chaque type de document repart à 00001 au 1er janvier, séquence par type. */
class NumerotationAnnuelleTest extends TestCase
{
    use RefreshDatabase;

    public function test_ventes_proformas_et_achats_repartent_a_un_chaque_annee(): void
    {
        $service = app(NumerotationService::class);

        Carbon::setTestNow('2026-12-31 18:00:00');
        $this->assertSame('VNT-2026-00001', $service->nextAnneeDabord('VNT'));
        $this->assertSame('VNT-2026-00002', $service->nextAnneeDabord('VNT'));
        $this->assertSame('DEV-2026-00001', $service->nextAnneeDabord('DEV'));
        $this->assertSame('ACH-2026-00001', $service->nextAnneeDabord('ACH'));
        $this->assertSame('FAC-00001-2026', $service->next('FAC'));

        Carbon::setTestNow('2027-01-01 08:00:00');
        $this->assertSame('VNT-2027-00001', $service->nextAnneeDabord('VNT'));
        $this->assertSame('DEV-2027-00001', $service->nextAnneeDabord('DEV'));
        $this->assertSame('ACH-2027-00001', $service->nextAnneeDabord('ACH'));
        $this->assertSame('FAC-00001-2027', $service->next('FAC'));
        $this->assertSame('CMD-00001-2027', $service->next('CMD'));

        Carbon::setTestNow();
    }

    public function test_factures_en_ligne_existantes_prennent_le_numero_de_leur_vente(): void
    {
        $client = Client::create(['nom' => 'Client', 'telephone' => '+241066000000', 'source' => 'boutique_en_ligne']);
        $admin = User::factory()->create(['role' => 'LG_ADMIN']);
        $facture = function (string $numero, ?string $vente) use ($client, $admin): int {
            $commande = Commande::create(['numero' => 'CMD-'.fake()->unique()->numberBetween(10000, 99999).'-2026', 'client_id' => $client->id, 'nom_livraison' => 'X', 'telephone_livraison' => 'X', 'ville' => 'X', 'quartier' => 'X', 'point_repere' => 'X', 'total' => 0, 'statut' => 'validee']);
            $id = DB::table('factures')->insertGetId(['numero' => $numero, 'commande_id' => $commande->id, 'client_id' => $client->id, 'montant_total' => 0, 'statut_paiement' => 'non_payee', 'emise_le' => now(), 'created_at' => now(), 'updated_at' => now()]);
            if ($vente) {
                PosSale::create(['number' => $vente, 'user_id' => $admin->id, 'facture_id' => $id, 'subtotal' => 0, 'tax_amount' => 0, 'total' => 0, 'payment_method' => 'LIVRAISON', 'status' => 'EMISE', 'source' => 'boutique_en_ligne']);
            }

            return $id;
        };

        // Ancien compteur séparé : FAC-00001 pour la vente n° 12 ; FAC-00002 pour
        // la vente n° 1 (échange de numéros : la contrainte d'unicité doit tenir).
        $a = $facture('FAC-00001-2026', 'VNT-2026-00012');
        $b = $facture('FAC-00002-2026', 'VNT-2026-00001');

        (require database_path('migrations/2026_11_26_103930_aligner_numeros_factures_en_ligne.php'))->up();

        $this->assertSame('FAC-00012-2026', DB::table('factures')->where('id', $a)->value('numero'));
        $this->assertSame('FAC-00001-2026', DB::table('factures')->where('id', $b)->value('numero'));
    }

    public function test_un_numero_deja_utilise_est_saute_quand_le_compteur_est_en_retard(): void
    {
        Carbon::setTestNow('2026-11-26 10:00:00');
        $fournisseur = Supplier::create(['name' => 'Fournisseur']);

        // Compteur à 12 alors que l'achat n° 13 existe déjà (données restaurées).
        Compteur::create(['type' => 'ACH', 'annee' => 2026, 'valeur' => 12]);
        Purchase::create(['number' => 'ACH-2026-00013', 'supplier_id' => $fournisseur->id, 'date' => '2026-11-20', 'status' => 'COMMANDE', 'total' => 0]);

        $this->assertSame('ACH-2026-00014', app(NumerotationService::class)->nextAnneeDabord('ACH'));
        $this->assertSame(14, (int) Compteur::where('type', 'ACH')->where('annee', 2026)->value('valeur'));

        Carbon::setTestNow();
    }
}
