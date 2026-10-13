<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Renommage des rôles : DIRECTION → DG_ADMIN, AG_LOGISTIQUE → LG_ADMIN.
     * is_admin : LG_ADMIN, CDG_ADMIN et SUPERADMIN sont administrateurs.
     */
    public function up(): void
    {
        DB::table('users')->where('role', 'DIRECTION')->update(['role' => 'DG_ADMIN']);
        DB::table('users')->where('role', 'AG_LOGISTIQUE')->update(['role' => 'LG_ADMIN']);

        DB::table('users')->update([
            'is_admin' => DB::raw("role IN ('LG_ADMIN', 'DG_ADMIN', 'CDG_ADMIN', 'SUPERADMIN')"),
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('users')->where('role', 'DG_ADMIN')->update(['role' => 'DIRECTION']);
        DB::table('users')->where('role', 'LG_ADMIN')->update(['role' => 'AG_LOGISTIQUE']);
        DB::table('users')->update([
            'is_admin' => DB::raw("role IN ('AG_LOGISTIQUE', 'SUPERADMIN')"),
        ]);
    }
};
