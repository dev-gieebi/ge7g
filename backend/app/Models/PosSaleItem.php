<?php

namespace App\Models;

use Database\Factories\PosSaleItemFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['pos_sale_id', 'product_id', 'quantity', 'delivered_quantity', 'unit_price', 'total'])]
class PosSaleItem extends Model
{
    /** @use HasFactory<PosSaleItemFactory> */
    use HasFactory;

    /** @var list<string> */
    protected $appends = ['remaining_quantity'];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:4',
            'delivered_quantity' => 'decimal:4',
            'unit_price' => 'decimal:4',
            'total' => 'decimal:4',
        ];
    }

    public function getRemainingQuantityAttribute(): float
    {
        return max(0.0, (float) $this->quantity - (float) $this->delivered_quantity);
    }

    public function posSale(): BelongsTo
    {
        return $this->belongsTo(PosSale::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
