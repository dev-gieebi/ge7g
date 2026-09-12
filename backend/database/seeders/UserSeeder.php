<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class UserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $users = [
            [
                'code' => '10000001',
                'name' => 'Agent Logistique',
                'email' => 'ag_logistique@g7energy.com',
                'password' => 'aglogistique123',
                'role' => 'AG_LOGISTIQUE',
                'is_admin' => true,
            ],
            [
                'code' => '20000002',
                'name' => 'Caissier G7',
                'email' => 'caisse@g7energy.com',
                'password' => 'caisse123',
                'role' => 'CAISSIER',
                'is_admin' => false,
            ],
            [
                'code' => '30000003',
                'name' => 'Direction G7',
                'email' => 'direction@g7energy.com',
                'password' => 'direction123',
                'role' => 'DIRECTION',
                'is_admin' => false,
            ],
            [
                'code' => '40000004',
                'name' => 'Super Admin G7',
                'email' => 'super-admin@g7energy.com',
                'password' => 'superadmin123',
                'role' => 'SUPERADMIN',
                'is_admin' => true,
            ],
        ];

        foreach ($users as $user) {
            User::updateOrCreate(
                ['code' => $user['code']],
                array_merge($user, ['permissions' => []])
            );
        }
    }
}
