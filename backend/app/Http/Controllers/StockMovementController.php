<?php

namespace App\Http\Controllers;

use App\Models\PosSale;
use App\Models\Purchase;
use App\Models\StockMovement;
use App\Models\User;
use App\Support\Xlsx;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class StockMovementController extends Controller
{
    /** Suivi des mouvements (entrées/sorties, factures, BL) : Direction et CDG. */
    private const MANAGE_ROLES = ['DG_ADMIN', 'CDG_ADMIN', 'SUPERADMIN'];

    private function authorizeUser(Request $request): User
    {
        /** @var User $user */
        $user = $request->user();

        if (! in_array($user->role, self::MANAGE_ROLES, true)) {
            abort(403, 'Accès réservé.');
        }

        return $user;
    }

    public function index(Request $request): JsonResponse
    {
        $this->authorizeUser($request);

        $query = $this->filteredQuery($request);
        $period = $this->periodTotals(clone $query);

        if ($sort = $request->input('sort')) {
            $direction = $request->input('dir') === 'desc' ? 'desc' : 'asc';
            $query->orderBy($sort, $direction);
        } else {
            $query->orderByDesc('id');
        }

        $perPage = (int) $request->input('per_page', 25);
        $paginator = $query->paginate($perPage);
        $items = collect($paginator->items());
        $this->enrich($items);
        $this->attachMonthTotals($items, $period['byProductMonth']);

        return response()->json([
            'data' => $items->all(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
                'totals' => $period['totals'],
            ],
        ]);
    }

    /**
     * Export Excel (.xlsx) des mouvements filtrés : même mise en page que le
     * fichier de suivi — BASE DE DONNÉES / ENTRÉES / SORTIES / N° BL /
     * Entrées Mois / Sorties Mois, avec cellules fusionnées et bordures.
     */
    public function export(Request $request): BinaryFileResponse
    {
        $this->authorizeUser($request);

        $query = $this->filteredQuery($request);
        $movements = $query->orderBy('created_at')->get();
        $this->enrich($movements);
        $period = $this->aggregate($movements);
        $this->attachMonthTotals($movements, $period['byProductMonth']);

        $rows = [];
        $rows[] = array_merge([['SUIVI STOCK', 1]], array_fill(0, 18, [null, 1]));
        $rows[] = array_merge(
            [['BASE DE DONNÉES', 2]], array_fill(0, 8, [null, 2]),
            [['ENTRÉES', 2]], [[null, 2]],
            [['SORTIES', 2]], [[null, 2]], [[null, 2]],
            [['N° BL', 2]],
            [['Entrées Mois', 2]], [[null, 2]],
            [['Sorties Mois', 2]], [[null, 2]],
        );
        $rows[] = array_map(fn ($h) => [$h, 2], [
            'REF', 'DATE', 'DÉSIGNATION', 'FOURNISSEUR', 'INITIATEUR', 'CLIENT', 'N° FACTURE', 'UNITÉ', 'P.U',
            'QUANTITÉ', 'MONTANT', 'QUANTITÉ', 'MONTANT', 'CLIENT', '', 'QUANTITÉ', 'MONTANT', 'QUANTITÉ', 'MONTANT',
        ]);

        foreach ($movements as $m) {
            $isIn = (float) $m->quantity >= 0;
            $isPurchase = $m->reference_type === 'Purchase';
            $isSale = $m->reference_type === 'PosSale';

            $rows[] = [
                [$m->product?->reference, 3],
                [$m->created_at?->format('d/m/Y') ?? '', 3],
                [$m->product ? $m->product->name.($m->product->type ? ' · '.$m->product->type : '') : '', 3],
                [$isPurchase ? $m->party_name : '', 3],
                [$m->user?->name ?? 'Système', 3],
                [$isSale ? $m->party_name : '', 3],
                [$m->invoice_number ?? '', 3],
                [$m->product?->unit?->symbol ?? '', 3],
                [$m->unit_price !== null ? (float) $m->unit_price : null, 4],
                [$isIn ? (float) $m->quantity : null, 4],
                [$isIn && $m->amount !== null ? (float) $m->amount : null, 4],
                [! $isIn ? abs((float) $m->quantity) : null, 4],
                [! $isIn && $m->amount !== null ? (float) $m->amount : null, 4],
                [! $isIn ? $m->party_name ?? '' : '', 3],
                [$m->bl_number ?? '', 3],
                [(float) $m->month_entries_quantity, 4],
                [(float) $m->month_entries_amount, 4],
                [(float) $m->month_exits_quantity, 4],
                [(float) $m->month_exits_amount, 4],
            ];
        }

        $month = $request->input('month');
        $filename = 'suivi-stock'.(preg_match('/^\d{4}-\d{2}$/', (string) $month) ? '-'.$month : '').'.xlsx';

        return Xlsx::download([[
            'name' => 'Suivi',
            'rows' => $rows,
            'merges' => ['A1:S1', 'A2:I2', 'J2:K2', 'L2:N2', 'O2:O3', 'P2:Q2', 'R2:S2'],
        ]], $filename);
    }

    private function filteredQuery(Request $request): Builder
    {
        $query = StockMovement::query()->with(['product.unit', 'user']);

        if ($request->has('product_id') && $request->input('product_id') !== '') {
            $query->where('product_id', (int) $request->input('product_id'));
        }

        if ($request->has('type') && $request->input('type') !== '') {
            $query->where('type', $request->input('type'));
        }

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('reference_number', 'like', "%{$search}%")
                    ->orWhereHas('product', function ($pq) use ($search) {
                        $pq->where('name', 'like', "%{$search}%")
                            ->orWhere('reference', 'like', "%{$search}%");
                    });
            });
        }

        // Recherche par mois : paramètre « month » au format YYYY-MM.
        if (($month = $request->input('month')) && preg_match('/^\d{4}-\d{2}$/', (string) $month)) {
            $query->whereYear('created_at', (int) substr($month, 0, 4))
                ->whereMonth('created_at', (int) substr($month, 5, 2));
        }

        return $query;
    }

    /**
     * Totaux de la période filtrée : globaux + détaillés par produit et par
     * mois (colonnes « Entrées Mois » / « Sorties Mois » du fichier de suivi).
     *
     * @return array{totals: array{entries: array{quantity: float, amount: float}, exits: array{quantity: float, amount: float}}, byProductMonth: array<string, array{entries_quantity: float, entries_amount: float, exits_quantity: float, exits_amount: float}>}
     */
    private function periodTotals(Builder $query): array
    {
        $movements = $query->get();
        $this->enrich($movements);

        return $this->aggregate($movements);
    }

    /**
     * @param  Collection<int, StockMovement>  $movements
     * @return array{totals: array{entries: array{quantity: float, amount: float}, exits: array{quantity: float, amount: float}}, byProductMonth: array<string, array{entries_quantity: float, entries_amount: float, exits_quantity: float, exits_amount: float}>}
     */
    private function aggregate(Collection $movements): array
    {
        $totals = [
            'entries' => ['quantity' => 0.0, 'amount' => 0.0],
            'exits' => ['quantity' => 0.0, 'amount' => 0.0],
        ];
        $byProductMonth = [];

        foreach ($movements as $m) {
            $qty = (float) $m->quantity;
            $amount = (float) ($m->amount ?? 0);
            $key = $m->product_id.'|'.($m->created_at ? $m->created_at->format('Y-m') : '');

            if (! isset($byProductMonth[$key])) {
                $byProductMonth[$key] = ['entries_quantity' => 0.0, 'entries_amount' => 0.0, 'exits_quantity' => 0.0, 'exits_amount' => 0.0];
            }

            if ($qty >= 0) {
                $totals['entries']['quantity'] += $qty;
                $totals['entries']['amount'] += $amount;
                $byProductMonth[$key]['entries_quantity'] += $qty;
                $byProductMonth[$key]['entries_amount'] += $amount;
            } else {
                $totals['exits']['quantity'] += abs($qty);
                $totals['exits']['amount'] += $amount;
                $byProductMonth[$key]['exits_quantity'] += abs($qty);
                $byProductMonth[$key]['exits_amount'] += $amount;
            }
        }

        return ['totals' => $totals, 'byProductMonth' => $byProductMonth];
    }

    /**
     * Renseigne sur chaque mouvement les totaux du mois de sa propre date
     * pour son produit (colonnes « Entrées Mois » / « Sorties Mois »).
     *
     * @param  Collection<int, StockMovement>  $movements
     * @param  array<string, array{entries_quantity: float, entries_amount: float, exits_quantity: float, exits_amount: float}>  $byProductMonth
     */
    private function attachMonthTotals(Collection $movements, array $byProductMonth): void
    {
        foreach ($movements as $m) {
            $key = $m->product_id.'|'.($m->created_at ? $m->created_at->format('Y-m') : '');
            $agg = $byProductMonth[$key] ?? null;

            $m->month_entries_quantity = $agg['entries_quantity'] ?? 0;
            $m->month_entries_amount = $agg['entries_amount'] ?? 0;
            $m->month_exits_quantity = $agg['exits_quantity'] ?? 0;
            $m->month_exits_amount = $agg['exits_amount'] ?? 0;
        }
    }

    /**
     * Complète chaque mouvement avec les données de son document d'origine :
     * partenaire (fournisseur ou client), prix unitaire, montant, N° de
     * facture (vente) et N° de BL (réception d'achat ou livraison de vente).
     *
     * @param  Collection<int, StockMovement>  $movements
     */
    private function enrich(Collection $movements): void
    {
        $purchaseIds = $movements->where('reference_type', 'Purchase')->pluck('reference_id')->filter()->unique();
        $saleIds = $movements->where('reference_type', 'PosSale')->pluck('reference_id')->filter()->unique();

        $purchases = $purchaseIds->isEmpty()
            ? collect()
            : Purchase::with(['supplier', 'items'])->whereIn('id', $purchaseIds)->get()->keyBy('id');
        $sales = $saleIds->isEmpty()
            ? collect()
            : PosSale::with('items')->whereIn('id', $saleIds)->get()->keyBy('id');

        foreach ($movements as $m) {
            $m->party_name = null;
            $m->unit_price = null;
            $m->invoice_number = null;
            $m->bl_number = null;

            if ($m->reference_type === 'Purchase' && ($purchase = $purchases->get($m->reference_id))) {
                $m->party_name = $purchase->supplier?->name;
                $m->bl_number = $purchase->number;
                $m->unit_price = $purchase->items->firstWhere('product_id', $m->product_id)?->unit_price;
            } elseif ($m->reference_type === 'PosSale' && ($sale = $sales->get($m->reference_id))) {
                $m->party_name = $sale->customer_name;
                $m->invoice_number = $sale->number;
                $m->bl_number = $sale->number;
                $m->unit_price = $sale->items->firstWhere('product_id', $m->product_id)?->unit_price;
            }

            $m->amount = $m->unit_price !== null ? round(abs((float) $m->quantity) * (float) $m->unit_price, 2) : null;
        }
    }
}
