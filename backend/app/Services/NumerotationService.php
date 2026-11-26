<?php

namespace App\Services;

use App\Models\Compteur;
use Illuminate\Support\Facades\DB;

/**
 * Numérotation annuelle des documents : CMD-00045-2026, FAC-00123-2026,
 * AV-00003-2026. Une séquence par type et par année, incrémentée sous
 * verrou (à appeler à l'intérieur d'une transaction), aucun numéro ne peut
 * être attribué deux fois, même en cas de commandes simultanées. Chaque
 * nouvelle année, la séquence de chaque type repart à 1.
 */
class NumerotationService
{
    private const FORMATS = ['CMD' => 5, 'FAC' => 5, 'AV' => 5, 'BL' => 5];

    /**
     * Table et colonne où chaque type de numéro est enregistré : un numéro
     * déjà présent (compteur en retard, données importées ou restaurées) est
     * sauté, au lieu de provoquer une erreur de doublon.
     *
     * @var array<string, array{0: string, 1: string}>
     */
    private const DOCUMENTS = [
        'VNT' => ['pos_sales', 'number'],
        'ACH' => ['purchases', 'number'],
        'DEV' => ['quotes', 'number'],
        'CMD' => ['commandes', 'numero'],
        'FAC' => ['factures', 'numero'],
        'AV' => ['avoirs', 'numero'],
        'BL' => ['bons_livraison', 'numero'],
    ];

    /** Prochaine valeur de la séquence annuelle du type (1 au premier document de l'année). */
    public function sequence(string $type, ?int $annee = null): int
    {
        $annee ??= (int) now()->format('Y');

        $compteur = Compteur::where('type', $type)->where('annee', $annee)->lockForUpdate()->first()
            ?? Compteur::create(['type' => $type, 'annee' => $annee, 'valeur' => 0]);

        $compteur->valeur++;
        $compteur->save();

        return (int) $compteur->valeur;
    }

    /** Génère le prochain numéro du type demandé pour l'année courante (CMD-00045-2026). */
    public function next(string $type, ?int $annee = null): string
    {
        $annee ??= (int) now()->format('Y');
        $longueur = self::FORMATS[$type] ?? 6;

        return $this->libre($type, fn (int $n) => $type.'-'.str_pad((string) $n, $longueur, '0', STR_PAD_LEFT).'-'.$annee, $annee);
    }

    /** Premier numéro de la séquence qui n'est pas déjà utilisé par un document. */
    private function libre(string $type, \Closure $format, int $annee): string
    {
        [$table, $colonne] = self::DOCUMENTS[$type] ?? [null, null];

        for ($essai = 0; $essai < 10000; $essai++) {
            $numero = $format($this->sequence($type, $annee));
            if ($table && DB::table($table)->where($colonne, $numero)->exists()) {
                continue;
            }
            // Ventes : la facture porte le même n° (VNT-2026-00012 → FAC-00012-2026),
            // série commune caisse / commandes en ligne : ce n° de facture doit être libre.
            if ($type === 'VNT' && DB::table('factures')->where('numero', self::affichage($numero, ['VNT' => 'FAC']))->exists()) {
                continue;
            }

            return $numero;
        }

        throw new \RuntimeException("Aucun numéro libre trouvé pour le type {$type}.");
    }

    /**
     * N° affiché comme sur les documents : « VNT-2026-00028 » → « VNT-00028-2026 ».
     * `$prefixes` remplace le type (ex. VNT → FAC, ACH → BC). Un n° déjà au bon
     * format est laissé tel quel.
     *
     * @param  array<string, string>  $prefixes
     */
    public static function affichage(?string $numero, array $prefixes = []): string
    {
        if ($numero === null || ! preg_match('/^([A-Z]+)-(\d{4})-(\d+)$/', $numero, $m)) {
            return (string) $numero;
        }

        return ($prefixes[$m[1]] ?? $m[1]).'-'.$m[3].'-'.$m[2];
    }

    /**
     * Numéro des ventes, proformas et bons d'achat, enregistré « année d'abord »
     * (VNT-2026-00028) et affiché VNT-00028-2026. Repart à 1 chaque année.
     */
    /**
     * N° de vente et n° de facture d'une commande en ligne, pris dans la même
     * série que les factures de la caisse : après la vente VNT-2026-00011
     * (facture FAC-00011-2026), la commande validée reçoit FAC-00012-2026.
     *
     * @return array{vente: string, facture: string}
     */
    public function venteEtFacture(?int $annee = null): array
    {
        $vente = $this->nextAnneeDabord('VNT', $annee);

        return ['vente' => $vente, 'facture' => self::affichage($vente, ['VNT' => 'FAC'])];
    }

    public function nextAnneeDabord(string $type, ?int $annee = null): string
    {
        $annee ??= (int) now()->format('Y');

        return $this->libre($type, fn (int $n) => $type.'-'.$annee.'-'.str_pad((string) $n, 5, '0', STR_PAD_LEFT), $annee);
    }
}
