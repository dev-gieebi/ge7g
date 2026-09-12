<?php

namespace App\Http\Controllers;

use App\Models\PosSale;
use App\Models\PosSaleItem;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! in_array($user->role, ['AG_LOGISTIQUE', 'DIRECTION', 'SUPERADMIN', 'CAISSIER'], true)) {
            abort(403, 'Accès réservé.');
        }

        $cacheKey = 'dashboard.stats';

        $data = Cache::remember($cacheKey, 120, function () {
            $productsCount = Product::count();

            $today = now()->startOfDay();
            $productsSoldToday = PosSaleItem::whereHas('posSale', function ($q) use ($today) {
                $q->whereDate('created_at', $today);
            })->sum('quantity');

            $lowStock = Product::where('stock_quantity', '>', 0)
                ->whereColumn('stock_quantity', '<', 'min_stock')
                ->count();

            $outOfStock = Product::where('stock_quantity', '<=', 0)->count();

            $posSalesTotal = PosSale::sum('total');

            return [
                'revenue' => 0,
                'revenue_trend' => 0,
                'orders_count' => 0,
                'pending_orders' => 0,
                'deliveries_in_progress' => 0,
                'deliveries_completed' => 0,
                'low_stock' => $lowStock,
                'out_of_stock' => $outOfStock,
                'products_count' => $productsCount,
                'products_sold_today' => (float) $productsSoldToday,
                'online_sales' => 0,
                'pos_sales' => (float) $posSalesTotal,
                'purchases' => 0,
                'expenses' => 0,
                'alerts' => [],
                'recent_activity' => [],
                'sales_series' => [],
                'top_products' => [],
            ];
        });

        return response()->json(['data' => $data]);
    }

    public function salesSeries(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! in_array($user->role, ['AG_LOGISTIQUE', 'DIRECTION', 'SUPERADMIN', 'CAISSIER'], true)) {
            abort(403, 'Accès réservé.');
        }

        $validated = $request->validate([
            'year' => 'sometimes|integer',
            'month' => 'sometimes|integer|between:1,12',
        ]);

        $year = $validated['year'] ?? now()->year;
        $month = $validated['month'] ?? now()->month;

        $daysInMonth = now()->setDate($year, $month, 1)->daysInMonth;

        $series = [];
        for ($day = 1; $day <= $daysInMonth; $day++) {
            $date = now()->setDate($year, $month, $day)->startOfDay();
            $total = PosSale::whereDate('created_at', $date)->sum('total');
            $count = PosSale::whereDate('created_at', $date)->count();

            $series[] = [
                'label' => sprintf('%02d/%02d', $day, $month),
                'revenue' => (float) $total,
                'orders' => $count,
            ];
        }

        return response()->json(['data' => $series]);
    }
}
