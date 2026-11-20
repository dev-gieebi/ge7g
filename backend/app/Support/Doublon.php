<?php

namespace App\Support;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Validation\ValidationException;

/**
 * Anti-doublon par nom : « Ciment », « ciment » et «  Ciment  » sont le même
 * nom (casse et espaces en trop ignorés). Refuse l'enregistrement si un
 * autre enregistrement porte déjà ce nom.
 */
class Doublon
{
    public static function normaliser(?string $valeur): string
    {
        return mb_strtolower(trim((string) preg_replace('/\s+/u', ' ', (string) $valeur)));
    }

    /**
     * @param  class-string<Model>  $modele
     */
    public static function refuser(string $modele, string $champ, string $valeur, ?int $ignorer, string $quoi): void
    {
        $cible = self::normaliser($valeur);

        $existant = $modele::query()
            ->when($ignorer, fn ($q) => $q->whereKeyNot($ignorer))
            ->select(['id', $champ])
            ->cursor()
            ->first(fn (Model $m) => self::normaliser($m->{$champ}) === $cible);

        if ($existant) {
            throw ValidationException::withMessages([
                $champ => $quoi.' « '.$existant->{$champ}.' » existe déjà.',
            ]);
        }
    }
}
