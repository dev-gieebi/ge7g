<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Signal temps réel : des données ont changé (produits, catégories,
 * commandes, ventes…). Seul le nom des ressources est diffusé, jamais leur
 * contenu ; les écrans ouverts rechargent alors leurs listes.
 */
class DonneesModifiees implements ShouldBroadcastNow
{
    use Dispatchable;

    /** @param  list<string>  $ressources */
    public function __construct(public array $ressources) {}

    /** @return array<int, Channel> */
    public function broadcastOn(): array
    {
        return [new Channel('ge7')];
    }

    public function broadcastAs(): string
    {
        return 'donnees.modifiees';
    }

    /** @return array<string, mixed> */
    public function broadcastWith(): array
    {
        return ['ressources' => $this->ressources];
    }
}
