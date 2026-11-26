<?php

namespace Tests\Feature;

use App\Models\Compteur;
use App\Models\Purchase;
use App\Models\Supplier;
use App\Services\NumerotationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
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
