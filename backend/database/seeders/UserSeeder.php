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
                'code' => '41234567',
                'name' => 'Super Admin G7',
                'email' => 'super-admin@g7energy.com',
                'password' => 'password123',
                'role' => 'SUPERADMIN',
                'is_admin' => true,
            ],
        ];

        foreach ($users as $user) {
            User::updateOrCreate(
                ['email' => $user['email']],
                array_merge($user, ['permissions' => []])
            );
        }
    }
}
