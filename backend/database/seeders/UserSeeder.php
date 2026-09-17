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
                'code' => '73456812',
                'name' => 'Super Admin G7',
                'password' => 'password123',
                'role' => 'SUPERADMIN',
                'is_admin' => true,
            ],
            [
                'code' => '41234567',
                'name' => 'Agent Logistique',
                'password' => 'password123',
                'role' => 'AG_LOGISTIQUE',
                'is_admin' => true,
            ],
            [
                'code' => '30000003',
                'name' => 'Direction G7',
                'password' => 'direction123',
                'role' => 'DIRECTION',
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
