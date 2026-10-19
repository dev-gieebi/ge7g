<?php

namespace App\Services;

use App\Models\Compteur;

/**
 * Numérotation annuelle des documents : CMD-00045-2026, FAC-000123-2026,
 * AV-00003-2026. Une séquence par type et par année, incrémentée sous
 * verrou (à appeler à l'intérieur d'une transaction) — aucun numéro ne peut
 * être attribué deux fois, même en cas de commandes simultanées.
 */
class NumerotationService
{
    private const FORMATS = ['CMD' => 5, 'FAC' => 6, 'AV' => 5];

    /** Génère le prochain numéro du type demandé pour l'année courante. */
    public function next(string $type, ?int $annee = null): string
    {
        $annee ??= (int) now()->format('Y');
        $longueur = self::FORMATS[$type] ?? 6;

        $compteur = Compteur::where('type', $type)->where('annee', $annee)->lockForUpdate()->first()
            ?? Compteur::create(['type' => $type, 'annee' => $annee, 'valeur' => 0]);

        $compteur->valeur++;
        $compteur->save();

        return $type.'-'.str_pad((string) $compteur->valeur, $longueur, '0', STR_PAD_LEFT).'-'.$annee;
    }
}
