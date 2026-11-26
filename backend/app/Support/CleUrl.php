<?php

namespace App\Support;

/**
 * Clé opaque des adresses (URL) : remplace l'identifiant en clair
 * (/mon-compte/commandes/11 → /mon-compte/commandes/k7Qm2xLp9VtR4bNa_b).
 *
 * La clé = signature HMAC (APP_KEY) du type et de l'identifiant, suivie de
 * l'identifiant en base 36. Sans la clé secrète du serveur, impossible de
 * fabriquer la clé d'un autre document : les adresses ne se devinent plus
 * en changeant un chiffre. Les droits d'accès restent vérifiés comme avant.
 */
class CleUrl
{
    private const LONGUEUR_SIGNATURE = 16;

    private const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

    public static function encoder(string $type, int $id): string
    {
        return self::signature($type, $id).'_'.base_convert((string) $id, 10, 36);
    }

    /** Identifiant d'une clé valide pour ce type ; null si la clé est fausse ou falsifiée. */
    public static function decoder(string $type, string $cle): ?int
    {
        if (! preg_match('/^([0-9A-Za-z]{'.self::LONGUEUR_SIGNATURE.'})_([0-9a-z]{1,13})$/', $cle, $m)) {
            return null;
        }

        $id = (int) base_convert($m[2], 36, 10);

        return $id > 0 && hash_equals(self::signature($type, $id), $m[1]) ? $id : null;
    }

    private static function signature(string $type, int $id): string
    {
        $octets = hash_hmac('sha256', $type.':'.$id, (string) config('app.key'), true);

        $sortie = '';
        for ($i = 0; $i < self::LONGUEUR_SIGNATURE; $i++) {
            $sortie .= self::ALPHABET[ord($octets[$i]) % 62];
        }

        return $sortie;
    }
}
