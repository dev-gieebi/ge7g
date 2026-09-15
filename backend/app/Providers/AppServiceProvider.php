<?php

namespace App\Providers;

use App\Models\AuditLog;
use App\Models\Category;
use App\Models\PosSale;
use App\Models\PosSaleItem;
use App\Models\Price;
use App\Models\Product;
use App\Models\Purchase;
use App\Models\PurchaseItem;
use App\Models\StockMovement;
use App\Models\Supplier;
use App\Models\Tax;
use App\Models\Unit;
use App\Models\User;
use App\Models\Zone;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Schema::defaultStringLength(191);
        $this->bootAuditLogs();
    }

    private function bootAuditLogs(): void
    {
        $auditable = [
            User::class,
            Zone::class,
            Tax::class,
            Supplier::class,
            Unit::class,
            Category::class,
            Product::class,
            Price::class,
            Purchase::class,
            PurchaseItem::class,
            StockMovement::class,
            PosSale::class,
            PosSaleItem::class,
        ];

        $oldValues = [];

        foreach ($auditable as $class) {
            $class::created(function (Model $model) {
                AuditLog::create([
                    'user_id' => auth()->id(),
                    'action' => 'CREE',
                    'subject_type' => class_basename($model),
                    'subject_id' => $model->getKey(),
                    'subject_label' => $this->auditSubjectLabel($model),
                    'ip' => request()?->ip(),
                    'old_values' => null,
                    'new_values' => $model->getAttributes(),
                ]);
            });

            $class::updating(function (Model $model) use (&$oldValues) {
                $oldValues[spl_object_id($model)] = $model->getOriginal();
            });

            $class::updated(function (Model $model) use (&$oldValues) {
                $newValues = $model->getChanges();
                $old = [];

                if (isset($oldValues[spl_object_id($model)])) {
                    $old = array_intersect_key($oldValues[spl_object_id($model)], $newValues);
                    unset($oldValues[spl_object_id($model)]);
                }

                AuditLog::create([
                    'user_id' => auth()->id(),
                    'action' => 'MODIFIE',
                    'subject_type' => class_basename($model),
                    'subject_id' => $model->getKey(),
                    'subject_label' => $this->auditSubjectLabel($model),
                    'ip' => request()?->ip(),
                    'old_values' => $old ?: null,
                    'new_values' => $newValues ?: null,
                ]);
            });

            $class::deleting(function (Model $model) {
                AuditLog::create([
                    'user_id' => auth()->id(),
                    'action' => 'SUPPRIME',
                    'subject_type' => class_basename($model),
                    'subject_id' => $model->getKey(),
                    'subject_label' => $this->auditSubjectLabel($model),
                    'ip' => request()?->ip(),
                    'old_values' => $model->getAttributes(),
                    'new_values' => null,
                ]);
            });
        }
    }

    private function auditSubjectLabel(Model $model): ?string
    {
        return $model->name ?? $model->reference ?? $model->code ?? null;
    }
}
