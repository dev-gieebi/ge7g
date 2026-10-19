<?php

namespace App\Models;

use Database\Factories\ProductFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['reference', 'name', 'category_id', 'unit_id', 'sale_price', 'purchase_price', 'margin', 'margin_percent', 'stock_quantity', 'reserved_quantity', 'min_stock', 'physical_stock', 'physical_stock_at', 'image_url', 'visible_boutique', 'description_publique', 'mis_en_avant'])]
class Product extends Model
{
    /** @use HasFactory<ProductFactory> */
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
            'physical_stock' => 'decimal:4',
            'physical_stock_at' => 'datetime',
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

    public function prices(): HasMany
    {
        return $this->hasMany(Price::class);
    }

    /**
     * Prix de vente boutique : avec une ville, le prix de la zone en priorité
     * puis « toutes villes » ; sans ville, le prix POS puis « toutes villes ».
     * Retombe sur `sale_price` si aucune ligne de barème n'existe.
     */
    public function prixBoutique(?int $zoneId = null): int
    {
        $prices = $this->relationLoaded('prices') ? $this->prices : $this->prices()->get();

        $prix = $zoneId
            ? $prices
                ->filter(fn (Price $p) => $p->zone_id === null || (int) $p->zone_id === $zoneId)
                ->sortByDesc(fn (Price $p) => (int) $p->zone_id === $zoneId ? 1 : 0)
                ->first()?->amount
            : $prices
                ->filter(fn (Price $p) => $p->zone_id === null || $p->for_pos)
                ->sortByDesc(fn (Price $p) => (int) $p->for_pos)
                ->first()?->amount;

        return (int) round((float) ($prix ?? $this->sale_price));
    }
}
