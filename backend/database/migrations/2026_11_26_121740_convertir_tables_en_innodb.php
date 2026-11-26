<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Tables MySQL créées en MyISAM (moteur par défaut de certains serveurs,
     * dont WAMP) : aucune transaction ni verrou. Une validation de commande
     * qui échoue à mi-chemin laisse alors une facture orpheline, et deux
     * ventes simultanées peuvent vendre le même stock. Conversion en InnoDB ;
     * sans effet sur une base déjà en InnoDB ou hors MySQL/MariaDB.
     */
    public function up(): void
    {
        if (! in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            return;
        }

        $tables = DB::select("SELECT TABLE_NAME AS nom FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND ENGINE = 'MyISAM' AND TABLE_TYPE = 'BASE TABLE'");

        foreach ($tables as $table) {
            DB::statement('ALTER TABLE `'.str_replace('`', '``', $table->nom).'` ENGINE = InnoDB');
        }
    }

    /** Pas de retour en MyISAM. */
    public function down(): void {}
};
