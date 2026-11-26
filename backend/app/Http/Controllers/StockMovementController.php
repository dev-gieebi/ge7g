<?php

namespace App\Http\Controllers;

use App\Models\BonLivraison;
use App\Models\Commande;
use App\Models\PosSale;
use App\Models\Purchase;
use App\Models\StockMovement;
use App\Models\User;
use App\Services\NumerotationService;
use App\Support\Xlsx;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
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
            // Le plus récent en premier.
            $query->orderByDesc('created_at')->orderByDesc('id');
        }

        $perPage = (int) $request->input('per_page', 25);
        $paginator = $query->paginate($perPage);
        $items = collect($paginator->items());
        $this->enrich($items);

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
     * Export Excel (.xlsx) des mouvements de la période choisie (tous sans
     * période), le plus récent en premier : BASE DE DONNÉES / ENTRÉES /
     * SORTIES / N°, avec cellules fusionnées et bordures.
     */
    public function export(Request $request): BinaryFileResponse
    {
        $this->authorizeUser($request);

        $query = $this->filteredQuery($request);
        $movements = $query->orderByDesc('created_at')->orderByDesc('id')->get();
        $this->enrich($movements);

        $du = $request->input('from');
        $au = $request->input('to');
        $titre = 'SUIVI STOCK'.($du || $au ? ' DU '.($du ? Carbon::parse($du)->format('d/m/Y') : '…').' AU '.($au ? Carbon::parse($au)->format('d/m/Y') : '…') : '');

        $rows = [];
        // Une seule colonne « N° » (bon de commande, facture ou bon de livraison) ;
        // le client figure dans la partie Sorties.
        $rows[] = array_merge([[$titre, 1]], array_fill(0, 12, [null, 1]));
        $rows[] = array_merge(
            [['BASE DE DONNÉES', 2]], array_fill(0, 6, [null, 2]),
            [['ENTRÉES', 2]], [[null, 2]],
            [['SORTIES', 2]], [[null, 2]], [[null, 2]],
            [['N°', 2]],
        );
        $rows[] = array_map(fn ($h) => [$h, 2], [
            'REF', 'DATE', 'DÉSIGNATION', 'FOURNISSEUR', 'INITIATEUR', 'UNITÉ', 'P.U',
            'QUANTITÉ', 'MONTANT', 'QUANTITÉ', 'MONTANT', 'CLIENT', '',
        ]);

        foreach ($movements as $m) {
            $isIn = (float) $m->quantity >= 0;
            $isPurchase = $m->reference_type === 'Purchase';

            $rows[] = [
                [$m->product?->reference, 3],
                [$m->created_at?->format('d/m/Y') ?? '', 3],
                [$m->product ? $m->product->name.($m->product->type ? ' · '.$m->product->type : '') : '', 3],
                [$isPurchase ? $m->party_name : '', 3],
                [$m->user?->name ?? 'Système', 3],
                [$m->product?->unit?->symbol ?? '', 3],
                [$m->unit_price !== null ? (float) $m->unit_price : null, 4],
                [$isIn ? (float) $m->quantity : null, 4],
                [$isIn && $m->amount !== null ? (float) $m->amount : null, 4],
                [! $isIn ? abs((float) $m->quantity) : null, 4],
                [! $isIn && $m->amount !== null ? (float) $m->amount : null, 4],
                [! $isIn ? $m->party_name ?? '' : '', 3],
                [NumerotationService::affichage($m->bl_number, ['VNT' => 'FAC', 'ACH' => 'BC']), 3],
            ];
        }

        $valide = fn ($d) => is_string($d) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $d);
        $filename = 'suivi-stock'.($valide($du) ? '-du-'.$du : '').($valide($au) ? '-au-'.$au : '').'.xlsx';

        return Xlsx::download([[
            'name' => 'Suivi',
            'rows' => $rows,
            'merges' => ['A1:M1', 'A2:G2', 'H2:I2', 'J2:L2', 'M2:M3'],
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

        // Période (du … au …, dates AAAA-MM-JJ, bornes incluses) ; sans période : tout.
        if (($du = $request->input('from')) && preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) $du)) {
            $query->whereDate('created_at', '>=', $du);
        }
        if (($au = $request->input('to')) && preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) $au)) {
            $query->whereDate('created_at', '<=', $au);
        }

        // Ancien filtre par mois (YYYY-MM), conservé pour les liens existants.
        if (($month = $request->input('month')) && preg_match('/^\d{4}-\d{2}$/', (string) $month)) {
            $query->whereYear('created_at', (int) substr($month, 0, 4))
                ->whereMonth('created_at', (int) substr($month, 5, 2));
        }

        return $query;
    }

    /**
     * Totaux (quantités et montants) des entrées et des sorties de la période
     * filtrée (toute la base sans période).
     *
     * @return array{totals: array{entries: array{quantity: float, amount: float}, exits: array{quantity: float, amount: float}}}
     */
    private function periodTotals(Builder $query): array
    {
        $movements = $query->get();
        $this->enrich($movements);

        $totals = [
            'entries' => ['quantity' => 0.0, 'amount' => 0.0],
            'exits' => ['quantity' => 0.0, 'amount' => 0.0],
        ];

        foreach ($movements as $m) {
            $qty = (float) $m->quantity;
            $cle = $qty >= 0 ? 'entries' : 'exits';
            $totals[$cle]['quantity'] += abs($qty);
            $totals[$cle]['amount'] += (float) ($m->amount ?? 0);
        }

        return ['totals' => $totals];
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

        // Commandes en ligne : envoi rattaché à son bon de livraison, ou (anciens
        // mouvements, retours d'annulation) rattaché à la commande.
        $bonIds = $movements->where('reference_type', 'BonLivraison')->pluck('reference_id')->filter()->unique();
        $commandeIds = $movements->where('reference_type', 'Commande')->pluck('reference_id')->filter()->unique();
        $bons = $bonIds->isEmpty()
            ? collect()
            : BonLivraison::with(['lignes', 'commande', 'facture.vente'])->whereIn('id', $bonIds)->get()->keyBy('id');
        $commandes = $commandeIds->isEmpty()
            ? collect()
            : Commande::with(['lignes', 'facture.vente', 'bonsLivraison'])->whereIn('id', $commandeIds)->get()->keyBy('id');

        foreach ($movements as $m) {
            $m->party_name = null;
            $m->unit_price = null;
            $m->invoice_number = null;
            $m->bl_number = null;

            if ($m->reference_type === 'BonLivraison' && ($bon = $bons->get($m->reference_id))) {
                $m->party_name = $bon->commande?->nom_livraison;
                $m->bl_number = $bon->numero;
                $m->invoice_number = $bon->facture?->numeroAffiche();
                $m->unit_price = $bon->lignes->firstWhere('produit_id', $m->product_id)?->prix_unitaire;
            } elseif ($m->reference_type === 'Commande' && ($commande = $commandes->get($m->reference_id))) {
                $m->party_name = $commande->nom_livraison;
                $m->invoice_number = $commande->facture?->numeroAffiche();
                $m->bl_number = $commande->bonsLivraison->isNotEmpty()
                    ? $commande->bonsLivraison->pluck('numero')->implode(', ')
                    : ($m->invoice_number ?? $commande->numero);
                $m->unit_price = $commande->lignes->firstWhere('produit_id', $m->product_id)?->prix_unitaire;
            } elseif ($m->reference_type === 'Purchase' && ($purchase = $purchases->get($m->reference_id))) {
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
