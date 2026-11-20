<?php

namespace App\Services;

use App\Events\DonneesModifiees;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Regroupe les changements d'une requête et les diffuse une seule fois,
 * après l'envoi de la réponse. Une panne du serveur temps réel (Pusher) ne
 * bloque jamais un enregistrement : l'erreur est seulement journalisée.
 */
class TempsReel
{
    /** @var array<string, true> */
    private array $ressources = [];

    private bool $planifie = false;

    public function signaler(string $ressource): void
    {
        $this->ressources[$ressource] = true;

        if (! $this->planifie) {
            $this->planifie = true;
            app()->terminating(fn () => $this->diffuser());
        }
    }

    public function diffuser(): void
    {
        if ($this->ressources === []) {
            return;
        }

        $ressources = array_keys($this->ressources);
        $this->ressources = [];
        $this->planifie = false;

        try {
            event(new DonneesModifiees($ressources));
        } catch (Throwable $e) {
            Log::warning('Diffusion temps réel impossible : '.$e->getMessage());
        }
    }
}
