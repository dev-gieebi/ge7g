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

    /** @var list<string> */
    protected $appends = ['delivery_status'];

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

    /**
     * LIVREE / PARTIELLEMENT_LIVREE / A_LIVRER selon les quantités livrées.
     * Nécessite la relation `items` (chargée en eager loading par le contrôleur).
     */
    public function getDeliveryStatusAttribute(): string
    {
        $ordered = (float) $this->items->sum('quantity');
        $delivered = (float) $this->items->sum('delivered_quantity');

        if ($ordered <= 0 || $delivered >= $ordered) {
            return 'LIVREE';
        }

        return $delivered > 0 ? 'PARTIELLEMENT_LIVREE' : 'A_LIVRER';
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
