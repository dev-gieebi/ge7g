<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\PosController;
use App\Http\Controllers\PriceController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\PurchaseController;
use App\Http\Controllers\StockController;
use App\Http\Controllers\StockMovementController;
use App\Http\Controllers\SupplierController;
use App\Http\Controllers\TaxController;
use App\Http\Controllers\UnitController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\ZoneController;
use Illuminate\Support\Facades\Route;

Route::post('register', [AuthController::class, 'register']);
Route::post('login', [AuthController::class, 'login']);

Route::middleware('auth:api')->group(function () {
    Route::get('me', [AuthController::class, 'me']);
    Route::post('logout', [AuthController::class, 'logout']);
    Route::post('refresh', [AuthController::class, 'refresh']);

    Route::apiResource('users', UserController::class);
    Route::apiResource('zones', ZoneController::class);
    Route::apiResource('taxes', TaxController::class);

    Route::apiResource('units', UnitController::class);
    Route::apiResource('categories', CategoryController::class);
    Route::apiResource('products', ProductController::class);
    Route::apiResource('prices', PriceController::class);

    Route::post('purchases/{purchase}/receive', [PurchaseController::class, 'receive']);
    Route::apiResource('purchases', PurchaseController::class);

    Route::get('stocks', [StockController::class, 'index']);
    Route::apiResource('stock-movements', StockMovementController::class);

    Route::get('pos/products', [PosController::class, 'products']);
    Route::get('pos/sales', [PosController::class, 'index']);
    Route::post('pos/sales', [PosController::class, 'store']);
    Route::get('pos/sales/{sale}', [PosController::class, 'show']);

    Route::get('dashboard', [DashboardController::class, 'index']);
    Route::get('dashboard/sales-series', [DashboardController::class, 'salesSeries']);

    Route::patch('suppliers/{supplier}/toggle', [SupplierController::class, 'toggle']);
    Route::patch('suppliers/{id}/restore', [SupplierController::class, 'restore']);
    Route::apiResource('suppliers', SupplierController::class);
});
