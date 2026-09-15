<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::hasColumn('users', 'email')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn('email');
            });
        }

        if (Schema::hasColumn('users', 'email_verified_at')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn('email_verified_at');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (! Schema::hasColumn('users', 'email')) {
            Schema::table('users', function (Blueprint $table) {
                $table->string('email')->nullable()->unique()->after('name');
            });
        }

        if (! Schema::hasColumn('users', 'email_verified_at')) {
            Schema::table('users', function (Blueprint $table) {
                $table->timestamp('email_verified_at')->nullable()->after('email');
            });
        }
    }
};
