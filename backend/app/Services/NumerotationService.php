<?php

namespace App\Services;

use App\Models\Compteur;

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

        return $type.'-'.str_pad((string) $this->sequence($type, $annee), $longueur, '0', STR_PAD_LEFT).'-'.$annee;
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
    public function nextAnneeDabord(string $type, ?int $annee = null): string
    {
        $annee ??= (int) now()->format('Y');

        return $type.'-'.$annee.'-'.str_pad((string) $this->sequence($type, $annee), 5, '0', STR_PAD_LEFT);
    }
}
