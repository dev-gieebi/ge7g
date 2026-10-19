<?php

namespace App\Services;

use App\Models\Commande;
use Illuminate\Support\Facades\Log;

/** Implémentation par défaut : journalise les notifications à envoyer. */
class LogNotificationService implements NotificationService
{
    public function statutCommande(Commande $commande): void
    {
        Log::info('Notification commande', [
            'numero' => $commande->numero,
            'telephone' => $commande->telephone_livraison,
            'statut' => $commande->statut->value,
        ]);
    }
}
