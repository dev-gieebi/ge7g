<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable(['name', 'contact_name', 'email', 'phone', 'address', 'is_active'])]
class Supplier extends Model
{
    /** @use HasFactory<\Database\Factories\SupplierFactory> */
    use HasFactory, SoftDeletes;

    protected $appends = ['status', 'purchases_count'];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    protected function status(): Attribute
    {
        return Attribute::make(
            get: fn () => $this->is_active ? 'ACTIF' : 'INACTIF',
        );
    }

    protected function purchasesCount(): Attribute
    {
        return Attribute::make(
            get: fn () => 0,
        );
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeInactive($query)
    {
        return $query->where('is_active', false);
    }

    public function canReceiveOrders(): bool
    {
        return $this->is_active;
    }
}
