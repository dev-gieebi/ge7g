<?php

namespace App\Services;

use App\Models\Commande;

/**
 * Point d'extension notifications client (SMS / WhatsApp) à chaque changement
 * de statut. Implémentation actuelle : simple journalisation — un fournisseur
 * réel se branche en remplaçant le binding dans AppServiceProvider.
 */
interface NotificationService
{
    public function statutCommande(Commande $commande): void;
}
