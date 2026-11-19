<?php

namespace Tests\Feature;

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
}
