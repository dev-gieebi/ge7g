<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Article compté lors d'un inventaire. `stock_theorique` et `ecart` sont
 * figés à la validation (écart = compté − théorique).
 */
#[Fillable(['inventaire_id', 'product_id', 'stock_compte', 'stock_theorique', 'ecart'])]
class InventaireLigne extends Model
{
    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'stock_compte' => 'decimal:4',
            'stock_theorique' => 'decimal:4',
            'ecart' => 'decimal:4',
        ];
    }

    public function inventaire(): BelongsTo
    {
        return $this->belongsTo(Inventaire::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
