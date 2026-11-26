<?php

namespace App\Models\Concerns;

use App\Support\CleUrl;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;

/**
 * Modèle affiché dans une adresse (URL) : expose `cle` (clé opaque) et
 * accepte cette clé dans les routes ({commande}, {sale}, {quote}).
 * L'identifiant numérique reste accepté pour les liens déjà existants.
 *
 * @mixin Model
 */
trait AUneCleUrl
{
    protected function cle(): Attribute
    {
        return Attribute::get(fn () => $this->getKey() ? CleUrl::encoder(static::class, (int) $this->getKey()) : null);
    }

    public function resolveRouteBinding($value, $field = null)
    {
        $value = (string) $value;
        $id = CleUrl::decoder(static::class, $value) ?? (ctype_digit($value) ? (int) $value : null);

        return $id ? $this->newQuery()->whereKey($id)->first() : null;
    }
}
