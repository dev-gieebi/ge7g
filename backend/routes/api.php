<?php

use App\Http\Controllers\AuditLogController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\ChauffeurController;
use App\Http\Controllers\CommandeController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\FactureController;
use App\Http\Controllers\PosController;
use App\Http\Controllers\PriceController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\PurchaseController;
use App\Http\Controllers\PusherTestController;
use App\Http\Controllers\QuoteController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\ShopController;
use App\Http\Controllers\StockController;
use App\Http\Controllers\StockMovementController;
use App\Http\Controllers\SupplierController;
use App\Http\Controllers\TaxController;
use App\Http\Controllers\UnitController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\ZoneController;
use Illuminate\Support\Facades\Route;

Route::post('pusher/trigger', [PusherTestController::class, 'trigger']);

Route::post('register', [AuthController::class, 'register']);
Route::post('login', [AuthController::class, 'login']);

// Boutique publique — sans authentification, débit limité contre l'abus.
Route::prefix('public')->group(function () {
    Route::get('categories', [ShopController::class, 'categories']);
    Route::get('zones', [ShopController::class, 'zones']);
    Route::get('produits', [ShopController::class, 'produits']);
    Route::get('produits/{id}', [ShopController::class, 'produit']);
    // 5 commandes par heure et par IP + 3 en attente par téléphone (service).
    Route::post('commandes', [ShopController::class, 'commander'])->middleware('throttle:5,60');
    Route::post('suivi', [ShopController::class, 'suivi'])->middleware('throttle:10,1');
});

Route::middleware('auth:api')->group(function () {
    Route::get('me', [AuthController::class, 'me']);
    Route::post('logout', [AuthController::class, 'logout']);
    Route::post('refresh', [AuthController::class, 'refresh']);

    Route::patch('users/{user}/password', [UserController::class, 'updatePassword']);
    Route::apiResource('users', UserController::class);
    // Chauffeurs : fiche métier + compte plateforme créé à l'enregistrement.
    Route::apiResource('drivers', ChauffeurController::class)->only(['index', 'show', 'store', 'update', 'destroy']);
    Route::apiResource('zones', ZoneController::class);
    Route::apiResource('taxes', TaxController::class);
    Route::get('audit-logs', [AuditLogController::class, 'index']);

    Route::apiResource('units', UnitController::class);
    Route::apiResource('categories', CategoryController::class);
    Route::apiResource('products', ProductController::class);
    Route::apiResource('prices', PriceController::class);

    Route::post('purchases/{purchase}/receive', [PurchaseController::class, 'receive']);
    Route::apiResource('purchases', PurchaseController::class);

    Route::get('stocks', [StockController::class, 'index']);
    Route::get('stock-movements/export', [StockMovementController::class, 'export']);
    Route::apiResource('stock-movements', StockMovementController::class);

    Route::get('pos/products', [PosController::class, 'products']);
    Route::get('pos/sales', [PosController::class, 'index']);
    Route::post('pos/sales', [PosController::class, 'store']);
    Route::get('pos/sales/{sale}', [PosController::class, 'show']);
    Route::post('pos/sales/{sale}/discount', [PosController::class, 'applyDiscount']);
    Route::post('pos/sales/{sale}/deliver', [PosController::class, 'deliver']);

    Route::post('quotes/{quote}/status', [QuoteController::class, 'updateStatus']);
    Route::apiResource('quotes', QuoteController::class);

    Route::get('reports/sales/export', [ReportController::class, 'exportSales']);
    Route::get('reports/sales', [ReportController::class, 'sales']);
    Route::get('reports/pilotage/export', [ReportController::class, 'exportPilotage']);
    Route::get('reports/pilotage', [ReportController::class, 'pilotage']);
    Route::post('reports/inventaire', [ReportController::class, 'saveInventaire']);

    // Commandes de la boutique en ligne (validation → facture + vente + stock).
    Route::get('commandes/stats', [CommandeController::class, 'stats']);
    Route::get('commandes', [CommandeController::class, 'index']);
    Route::get('commandes/{commande}', [CommandeController::class, 'show']);
    Route::post('commandes/{commande}/valider', [CommandeController::class, 'valider']);
    Route::post('commandes/{commande}/refuser', [CommandeController::class, 'refuser']);
    Route::post('commandes/{commande}/preparer', [CommandeController::class, 'preparer']);
    Route::post('commandes/{commande}/affecter', [CommandeController::class, 'affecter']);
    Route::post('commandes/{commande}/demarrer', [CommandeController::class, 'demarrer']);
    Route::post('commandes/{commande}/position', [CommandeController::class, 'position']);
    Route::post('commandes/{commande}/expedier', [CommandeController::class, 'expedier']);
    Route::post('commandes/{commande}/livrer', [CommandeController::class, 'livrer']);
    Route::post('commandes/{commande}/echec', [CommandeController::class, 'echec']);
    Route::post('commandes/{commande}/annuler', [CommandeController::class, 'annuler']);
    Route::get('factures/{facture}/pdf', [FactureController::class, 'pdf']);

    Route::get('dashboard', [DashboardController::class, 'index']);
    Route::get('dashboard/sales-series', [DashboardController::class, 'salesSeries']);

    Route::patch('suppliers/{supplier}/toggle', [SupplierController::class, 'toggle']);
    Route::patch('suppliers/{id}/restore', [SupplierController::class, 'restore']);
    Route::apiResource('suppliers', SupplierController::class);
});
