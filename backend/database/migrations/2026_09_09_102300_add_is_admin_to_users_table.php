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
        Schema::table('users', function (Blueprint $table) {
            $table->string('code', 8)->unique()->after('id');
            $table->string('role')->default('CLIENT')->after('email');
            $table->json('permissions')->nullable()->after('role');
            $table->boolean('is_admin')->default(false)->after('password');
            $table->unsignedBigInteger('client_id')->nullable()->after('is_admin');
            $table->unsignedBigInteger('driver_id')->nullable()->after('client_id');
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['code', 'role', 'permissions', 'is_admin', 'client_id', 'driver_id']);
        });
    }
};
