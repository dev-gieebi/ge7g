<?php

namespace App\Models;

use Database\Factories\PosSaleFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['number', 'user_id', 'zone_id', 'customer_name', 'subtotal', 'tax_type', 'tax_rate', 'tax_amount', 'total', 'payment_method', 'amount_received', 'status'])]
class PosSale extends Model
{
    /** @use HasFactory<PosSaleFactory> */
    use HasFactory;

    protected function casts(): array
    {
        return [
            'subtotal' => 'decimal:4',
            'tax_rate' => 'decimal:4',
            'tax_amount' => 'decimal:4',
            'total' => 'decimal:4',
            'amount_received' => 'decimal:4',
        ];
    }

    public function cashier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function zone(): BelongsTo
    {
        return $this->belongsTo(Zone::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(PosSaleItem::class);
    }
}
