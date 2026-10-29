<?php

namespace App\Http\Controllers;

use App\Models\PosSale;
use App\Models\PosSaleItem;
use App\Models\Price;
use App\Models\Product;
use App\Models\Purchase;
use App\Models\Quote;
use App\Models\StockMovement;
use App\Models\User;
use App\Support\Xlsx;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class ReportController extends Controller
{
    /** Rapports de suivi : Direction et CDG_ADMIN (LG_ADMIN n'y a pas accès). */
    private const VIEW_ROLES = ['CDG_ADMIN', 'DG_ADMIN', 'SUPERADMIN'];

    private function authorizeUser(Request $request): User
    {
        /** @var User $user */
        $user = $request->user();

        if (! in_array($user->role, self::VIEW_ROLES, true)) {
            abort(403, 'Accès réservé.');
        }

        return $user;
    }

    /**
     * Synthèse des ventes facturées sur une période (from/to optionnels —
     * sans borne : cumul depuis le démarrage de l'activité).
     */
    public function sales(Request $request): JsonResponse
    {
        $this->authorizeUser($request);

        return response()->json(['data' => $this->buildReport($request)]);
    }

    /**
     * Export Excel (.xlsx) du rapport : indicateurs de performance,
     * ventes par client, par produit, par vendeur et reliquats.
     */
    public function exportSales(Request $request): BinaryFileResponse
    {
        $this->authorizeUser($request);

        $r = $this->buildReport($request);

        $k = $r['kpis'];
        $merges = [];
        $pad = fn (int $n, array $cells) => array_merge($cells, array_fill(0, max(0, $n - count($cells)), [null, 3]));
        $blank = array_fill(0, 7, [null, 0]);
        $rows = [];

        // Les lignes fusionnées (titre + sections) sont numérotées au fil de l'eau.
        $wide = function (string $text, int $style) use (&$rows, &$merges) {
            $rows[] = array_merge([[$text, $style]], array_fill(0, 6, [null, $style]));
            $i = count($rows);
            $merges[] = "A{$i}:G{$i}";
        };

        $wide($r['from'] && $r['to'] ? "RAPPORT COMMERCIAL — du {$r['from']} au {$r['to']}" : 'RAPPORT COMMERCIAL — cumul depuis le démarrage', 1);
        $rows[] = $blank;
        $wide('INDICATEURS DE PERFORMANCE', 2);
        $rows[] = $pad(7, [['Factures émises', 3], [(int) $k['sales_count'], 4], ['Chiffre d\'affaires', 3], [$k['total'], 4]]);
        $rows[] = $pad(7, [['Panier moyen', 3], [$k['avg_basket'], 4], ['Clients actifs', 3], [(int) $k['customers_count'], 4]]);
        $rows[] = $pad(7, [['Valeur livrée', 3], [$k['delivered_value'], 4], ['Taux de livraison', 3], [$k['delivery_rate'].' %', 4]]);
        $rows[] = $pad(7, [['Reliquat à livrer', 3], [$k['remaining_value'], 4], ['Proformas émises / validées', 3], ["{$k['quotes_count']} / {$k['quotes_validated']}", 4]]);

        $rows[] = $blank;
        $wide('VENTES PAR CLIENT', 2);
        $rows[] = $pad(7, array_map(fn ($h) => [$h, 2], ['Client', 'Factures', 'Montant']));
        foreach ($r['by_customer'] as $c) {
            $rows[] = $pad(7, [[$c['customer'], 3], [(int) $c['sales_count'], 4], [$c['total'], 4]]);
        }

        $rows[] = $blank;
        $wide('VENTES PAR VENDEUR', 2);
        $rows[] = $pad(7, array_map(fn ($h) => [$h, 2], ['Vendeur', 'Factures', 'Montant']));
        foreach ($r['by_cashier'] as $v) {
            $rows[] = $pad(7, [[$v['cashier'], 3], [(int) $v['sales_count'], 4], [$v['total'], 4]]);
        }

        $rows[] = $blank;
        $wide('VENTES PAR PRODUIT', 2);
        $rows[] = $pad(7, array_map(fn ($h) => [$h, 2], ['Produit', 'Unité', 'Facturé', 'Livré', 'Montant']));
        foreach ($r['by_product'] as $p) {
            $rows[] = $pad(7, [
                [$p['name'].($p['type'] ? ' · '.$p['type'] : ''), 3],
                [$p['unit'] ?? '', 3],
                [$p['quantity'], 4],
                [$p['delivered_quantity'], 4],
                [$p['total'], 4],
            ]);
        }

        $rows[] = $blank;
        $wide('RELIQUATS À LIVRER', 2);
        $rows[] = array_map(fn ($h) => [$h, 2], ['Facture', 'Client', 'Produit', 'Facturé', 'Livré', 'Reste', 'Valeur']);
        foreach ($r['reliquats'] as $l) {
            $rows[] = [
                [$l['number'], 3],
                [$l['customer'], 3],
                [$l['product'], 3],
                [$l['ordered'], 4],
                [$l['delivered'], 4],
                [$l['remaining'], 4],
                [$l['remaining_value'], 4],
            ];
        }

        $filename = 'rapport-commercial'.($r['from'] && $r['to'] ? "-{$r['from']}_{$r['to']}" : '-cumul').'.xlsx';

        return Xlsx::download([[
            'name' => 'Rapport',
            'rows' => $rows,
            'merges' => $merges,
        ]], $filename);
    }

    /**
     * Tableau de bord pilotage du magasin : indicateurs clés et état du
     * stock détaillé par article (reprend le classeur de suivi papier).
     */
    public function pilotage(Request $request): JsonResponse
    {
        $this->authorizeUser($request);

        return response()->json(['data' => $this->buildPilotage()]);
    }

    /**
     * Export Excel (.xlsx) de l'état du stock du pilotage : mêmes colonnes
     * que le tableau affiché dans Approvisionnement → État du stock.
     */
    public function exportPilotage(Request $request): BinaryFileResponse
    {
        $this->authorizeUser($request);

        $data = $this->buildPilotage();
        $i = $data['indicateurs'];

        $rows = [];
        $merges = [];
        $wide = function (string $text, int $style) use (&$rows, &$merges) {
            $rows[] = array_merge([[$text, $style]], array_fill(0, 14, [null, $style]));
            $merges[] = 'A'.count($rows).':O'.count($rows);
        };

        $wide('ETAT DU STOCK — '.now()->format('d/m/Y'), 1);
        $wide("CA facturé : {$i['ca_facture']} FCFA · Valeur stock : {$i['valeur_stock']} FCFA · Achats : {$i['achats']} FCFA · Marge livrée : {$i['marge_livree']} FCFA", 2);
        $rows[] = array_fill(0, 15, [null, 0]);
        $rows[] = array_map(fn ($h) => [$h, 2], [
            'Code article', 'Désignation', 'Unité', 'Stock initial', 'Entrées cumulées',
            'Sorties livrées', 'Mouvements nets', 'Stock théorique', 'Stock minimum',
            'Alerte', 'Prix de vente (FCFA)', 'Prix par ville', 'Valeur stock estimée (FCFA)',
            'Stock physique saisi', 'Écart physique - théorique',
        ]);

        foreach ($data['etat_stock'] as $l) {
            $rows[] = [
                [$l['reference'], 3],
                [$l['designation'], 3],
                [$l['unit'] ?? '', 3],
                [$l['stock_initial'], 4],
                [$l['entrees'], 4],
                [$l['sorties'], 4],
                [$l['mouvements_nets'], 4],
                [$l['stock_theorique'], 4],
                [$l['stock_minimum'], 4],
                [$l['alerte'], 3],
                [$l['prix_vente'], 4],
                [collect($l['prix_zones'])->map(fn ($z) => "{$z['zone']} : {$z['amount']}")->implode(' · '), 3],
                [$l['valeur_stock'], 4],
                [$l['stock_physique'] ?? '', 4],
                [$l['ecart'] ?? '', 4],
            ];
        }

        return Xlsx::download([[
            'name' => 'État du stock',
            'rows' => $rows,
            'merges' => $merges,
        ]], 'etat-stock-'.now()->format('Y-m-d').'.xlsx');
    }

    /**
     * Calcul du tableau de bord pilotage : indicateurs clés + état du
     * stock détaillé par article (reprend le classeur de suivi papier).
     *
     * @return array{indicateurs: array<string, mixed>, etat_stock: Collection<int, array<string, mixed>>}
     */
    private function buildPilotage(): array
    {
        $products = Product::query()->with(['unit', 'prices.zone'])->orderBy('reference')->get();

        // Mouvements de stock agrégés par produit et par type.
        $mouvements = StockMovement::query()
            ->selectRaw('product_id, type, SUM(quantity) as total')
            ->groupBy('product_id', 'type')
            ->get()
            ->groupBy('product_id');

        $etatStock = $products->map(function (Product $p) use ($mouvements) {
            $mvmts = $mouvements->get($p->id, collect());
            $parType = $mvmts->keyBy('type');
            $entrees = round((float) ($parType->get('ENTREE')?->total ?? 0), 2);
            // Les sorties sont stockées en quantité négative dans les mouvements.
            $sorties = round(abs((float) ($parType->get('VENTE')?->total ?? 0)
                + (float) ($parType->get('SORTIE_VENTE')?->total ?? 0)), 2);
            $mouvementsNets = round((float) ($parType->get('RETOUR_ANNULATION')?->total ?? 0), 2);
            $theorique = round((float) $p->stock_quantity, 2);
            $physique = $p->physical_stock !== null ? round((float) $p->physical_stock, 2) : null;
            // Prix de vente : barème caisse (for_pos) sinon « Toutes villes »
            // sinon le prix de base du produit.
            $prixVente = round((float) (
                $p->prices->firstWhere('for_pos', true)?->amount
                ?? $p->prices->first(fn (Price $pr) => ! $pr->for_pos && $pr->zone_id === null)?->amount
                ?? $p->sale_price
            ), 0);

            return [
                'product_id' => $p->id,
                'reference' => $p->reference,
                'designation' => $p->name.($p->type ? ' · '.$p->type : ''),
                'unit' => $p->unit?->symbol,
                'stock_initial' => round($theorique - $entrees + $sorties - $mouvementsNets, 2),
                'entrees' => $entrees,
                'sorties' => $sorties,
                'mouvements_nets' => $mouvementsNets,
                'stock_theorique' => $theorique,
                'stock_minimum' => round((float) $p->min_stock, 2),
                'alerte' => $theorique < 0
                    ? 'STOCK NÉGATIF'
                    : ($theorique <= (float) $p->min_stock ? 'À RÉAPPROVISIONNER' : 'OK'),
                'cout_unitaire' => round((float) $p->purchase_price, 0),
                // Valeur du stock au prix de vente (prix de vente × stock théorique).
                'valeur_stock' => round($theorique * $prixVente, 0),
                'prix_vente' => $prixVente,
                'prix_zones' => $p->prices
                    ->filter(fn (Price $pr) => ! $pr->for_pos)
                    ->map(fn (Price $pr) => [
                        'zone' => $pr->zone?->name ?? 'Toutes villes',
                        'amount' => (int) round((float) $pr->amount),
                    ])
                    ->values(),
                'stock_physique' => $physique,
                'physical_stock_at' => $p->physical_stock_at?->toIso8601String(),
                'ecart' => $physique !== null ? round($physique - $theorique, 2) : null,
            ];
        })->values();

        // Marge estimée sur les quantités réellement livrées (prix facturé - coût d'achat).
        $margeLivree = PosSaleItem::query()
            ->with('product:id,purchase_price')
            ->whereHas('posSale', fn ($q) => $q->where('annulee', false))
            ->get()
            ->sum(fn (PosSaleItem $i) => (float) $i->delivered_quantity
                * ((float) $i->unit_price - (float) ($i->product?->purchase_price ?? 0)));

        $restantALivrer = PosSaleItem::query()
            ->whereHas('posSale', fn ($q) => $q->where('annulee', false))
            ->selectRaw('SUM(quantity - delivered_quantity) as restant')
            ->value('restant');

        return [
            'indicateurs' => [
                'ca_facture' => round((float) PosSale::query()->where('annulee', false)->sum('total'), 0),
                'valeur_stock' => round($etatStock->sum('valeur_stock'), 0),
                'achats' => round((float) Purchase::query()->sum('total'), 0),
                'marge_livree' => round($margeLivree, 0),
                'restant_a_livrer' => round((float) ($restantALivrer ?? 0), 2),
                'articles_alerte' => $etatStock->filter(fn ($l) => $l['alerte'] !== 'OK')->count(),
                'ecarts_physiques' => $etatStock->filter(fn ($l) => $l['ecart'] !== null && $l['ecart'] != 0)->count(),
            ],
            'etat_stock' => $etatStock,
        ];
    }

    /**
     * Enregistre les comptages physiques saisis après inventaire
     * (colonne « Stock physique saisi » de l'état du stock).
     */
    public function saveInventaire(Request $request): JsonResponse
    {
        $this->authorizeUser($request);

        $data = $request->validate([
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|integer|exists:products,id',
            'items.*.physical_stock' => 'required|numeric|min:0',
        ]);

        foreach ($data['items'] as $item) {
            Product::query()->whereKey($item['product_id'])->update([
                'physical_stock' => $item['physical_stock'],
                'physical_stock_at' => now(),
            ]);
        }

        return response()->json(['data' => ['saved' => count($data['items'])]]);
    }

    /**
     * Synthèse des ventes facturées sur une période (from/to optionnels —
     * sans borne : cumul depuis le démarrage de l'activité).
     *
     * @return array<string, mixed>
     */
    private function buildReport(Request $request): array
    {
        $request->validate([
            'from' => 'nullable|date',
            'to' => 'nullable|date',
        ]);

        $query = PosSale::query()->with(['items.product.unit', 'zone', 'cashier'])->where('annulee', false);

        if ($from = $request->input('from')) {
            $query->whereDate('created_at', '>=', $from);
        }

        if ($to = $request->input('to')) {
            $query->whereDate('created_at', '<=', $to);
        }

        $sales = $query->orderBy('created_at')->get();

        // Répartition par client (les ventes comptoir sans nom vont dans « Comptoir »).
        $byCustomer = $sales
            ->groupBy(fn (PosSale $s) => $s->customer_name ?: 'Comptoir')
            ->map(fn ($group, $customer) => [
                'customer' => $customer,
                'sales_count' => $group->count(),
                'total' => round($group->sum(fn (PosSale $s) => (float) $s->total), 0),
            ])
            ->sortByDesc('total')
            ->values();

        // Répartition par produit : quantités facturées et livrées.
        $byProduct = $sales
            ->flatMap(fn (PosSale $s) => $s->items)
            ->groupBy('product_id')
            ->map(function ($items) {
                $first = $items->first();

                return [
                    'product_id' => $first->product_id,
                    'name' => $first->product?->name ?? 'Produit supprimé',
                    'type' => $first->product?->type,
                    'unit' => $first->product?->unit?->symbol,
                    'quantity' => round($items->sum(fn ($i) => (float) $i->quantity), 2),
                    'delivered_quantity' => round($items->sum(fn ($i) => (float) $i->delivered_quantity), 2),
                    'total' => round($items->sum(fn ($i) => (float) $i->total), 0),
                ];
            })
            ->sortByDesc('total')
            ->values();

        // Reliquats à livrer : quantités facturées non encore livrées, par vente et par produit.
        $reliquats = $sales
            ->flatMap(fn (PosSale $s) => $s->items
                ->filter(fn ($i) => (float) $i->quantity - (float) $i->delivered_quantity > 0)
                ->map(fn ($i) => [
                    'sale_id' => $s->id,
                    'number' => $s->number,
                    'customer' => $s->customer_name ?: 'Comptoir',
                    'product' => ($i->product?->name ?? 'Produit supprimé').($i->product?->type ? ' · '.$i->product->type : ''),
                    'unit' => $i->product?->unit?->symbol,
                    'ordered' => round((float) $i->quantity, 2),
                    'delivered' => round((float) $i->delivered_quantity, 2),
                    'remaining' => round((float) $i->quantity - (float) $i->delivered_quantity, 2),
                    'remaining_value' => round(((float) $i->quantity - (float) $i->delivered_quantity) * (float) $i->unit_price, 0),
                ]))
            ->values();

        // Performance par vendeur : nombre de factures et chiffre d'affaires.
        $byCashier = $sales
            ->groupBy(fn (PosSale $s) => $s->cashier?->name ?? '')
            ->map(fn ($group, $cashier) => [
                'cashier' => $cashier,
                'sales_count' => $group->count(),
                'total' => round($group->sum(fn (PosSale $s) => (float) $s->total), 0),
            ])
            ->sortByDesc('total')
            ->values();

        // Proformas émises sur la même période (et validées) — taux de conversion commercial.
        $quotes = Quote::query();
        if ($from) {
            $quotes->whereDate('created_at', '>=', $from);
        }
        if ($to) {
            $quotes->whereDate('created_at', '<=', $to);
        }
        $quotesCount = (clone $quotes)->count();
        $quotesValidated = (clone $quotes)->where('status', 'VALIDE')->count();

        $items = $sales->flatMap(fn (PosSale $s) => $s->items);
        $deliveredValue = round($items->sum(fn ($i) => (float) $i->delivered_quantity * (float) $i->unit_price), 0);
        $remainingValue = round($reliquats->sum('remaining_value'), 0);
        $total = round($sales->sum(fn (PosSale $s) => (float) $s->total), 0);

        return [
            'from' => $from,
            'to' => $to,
            'sales_count' => $sales->count(),
            'total' => $total,
            'subtotal' => round($sales->sum(fn (PosSale $s) => (float) $s->subtotal), 0),
            'delivered_value' => $deliveredValue,
            'remaining_value' => $remainingValue,
            'by_customer' => $byCustomer,
            'by_product' => $byProduct,
            'by_cashier' => $byCashier,
            'reliquats' => $reliquats,
            'kpis' => [
                'sales_count' => $sales->count(),
                'total' => $total,
                'avg_basket' => $sales->count() ? round($total / $sales->count(), 0) : 0,
                'customers_count' => $byCustomer->count(),
                'delivered_value' => $deliveredValue,
                'remaining_value' => $remainingValue,
                'delivery_rate' => $deliveredValue + $remainingValue > 0
                    ? round($deliveredValue / ($deliveredValue + $remainingValue) * 100, 1)
                    : 0,
                'quotes_count' => $quotesCount,
                'quotes_validated' => $quotesValidated,
            ],
        ];
    }
}
