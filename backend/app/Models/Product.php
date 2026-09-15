<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['reference', 'name', 'category_id', 'unit_id', 'sale_price', 'purchase_price', 'margin', 'margin_percent', 'stock_quantity', 'reserved_quantity', 'min_stock', 'image_url'])]
class Product extends Model
{
    /** @use HasFactory<\Database\Factories\ProductFactory> */
    use HasFactory;

    protected $appends = ['available_quantity'];

    protected function casts(): array
    {
        return [
            'sale_price' => 'decimal:4',
            'purchase_price' => 'decimal:4',
            'margin' => 'decimal:4',
            'margin_percent' => 'decimal:4',
            'stock_quantity' => 'decimal:4',
            'reserved_quantity' => 'decimal:4',
            'min_stock' => 'decimal:4',
        ];
    }

    protected function availableQuantity(): Attribute
    {
        return Attribute::make(
            get: fn () => $this->stock_quantity - $this->reserved_quantity,
        );
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }
}
