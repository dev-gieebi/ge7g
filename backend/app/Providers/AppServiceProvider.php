<?php

namespace App\Providers;

use App\Models\AuditLog;
use App\Models\BonLivraison;
use App\Models\Category;
use App\Models\Client;
use App\Models\Commande;
use App\Models\CommandeAnnotation;
use App\Models\Facture;
use App\Models\PosSale;
use App\Models\PosSaleItem;
use App\Models\Price;
use App\Models\Product;
use App\Models\Purchase;
use App\Models\PurchaseItem;
use App\Models\Quote;
use App\Models\StockMovement;
use App\Models\Supplier;
use App\Models\Tax;
use App\Models\Unit;
use App\Models\User;
use App\Models\Zone;
use App\Services\LogNotificationService;
use App\Services\NotificationService;
use App\Services\TempsReel;
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
        // Notifications boutique : journalisation par défaut, un fournisseur
        // SMS/WhatsApp se branche ici en remplaçant l'implémentation.
        $this->app->bind(NotificationService::class, LogNotificationService::class);
        $this->app->singleton(TempsReel::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Schema::defaultStringLength(191);
        $this->bootAuditLogs();
        $this->bootTempsReel();
    }

    /**
     * Temps réel : toute création, modification ou suppression de ces données
     * prévient les écrans ouverts (websocket), qui rechargent aussitôt.
     */
    private function bootTempsReel(): void
    {
        $ressources = [
            Product::class => 'products',
            Category::class => 'categories',
            Unit::class => 'units',
            Price::class => 'prices',
            Zone::class => 'zones',
            Tax::class => 'taxes',
            Supplier::class => 'suppliers',
            Purchase::class => 'purchases',
            PosSale::class => 'pos-sales',
            StockMovement::class => 'stock',
            User::class => 'users',
            Commande::class => 'commandes',
            CommandeAnnotation::class => 'commandes',
            Facture::class => 'factures',
            BonLivraison::class => 'commandes',
            Quote::class => 'quotes',
            Client::class => 'clients',
        ];

        foreach ($ressources as $class => $ressource) {
            $signaler = fn () => app(TempsReel::class)->signaler($ressource);
            $class::saved($signaler);
            $class::deleted($signaler);
        }
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
