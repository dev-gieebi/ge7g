<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Un produit = une seule ligne par commande en ligne. Les commandes
     * enregistrées avant le cumul automatique peuvent contenir le même
     * produit sur plusieurs lignes (Fer A de 12 : 1 barre, puis 25 barres) :
     * elles sont regroupées en une ligne (26 barres).
     *
     * - quantités commandées et livrées additionnées ;
     * - montant = somme des montants (le total de la commande ne bouge pas),
     *   prix unitaire = montant / quantité ;
     * - même regroupement pour les lignes des ventes boutique liées, pour que
     *   le suivi des livraisons reste juste.
     */
    public function up(): void
    {
        DB::transaction(function () {
            $this->fusionnerLignesCommandes();
            $this->fusionnerLignesVentesBoutique();
        });
    }

    private function fusionnerLignesCommandes(): void
    {
        $groupes = DB::table('commande_lignes')->orderBy('id')->get()
            // Produit du catalogue : même produit ; hors catalogue : même nom.
            ->groupBy(fn ($l) => $l->commande_id.'|'.($l->produit_id ?? 'nom:'.mb_strtolower(trim($l->designation))))
            ->filter(fn ($lignes) => $lignes->count() > 1);

        foreach ($groupes as $lignes) {
            $garde = $lignes->first();
            $quantite = (float) $lignes->sum('quantite');
            $total = (int) $lignes->sum('total_ligne');
            $precisions = $lignes->pluck('precision')->filter()->unique()->implode(' · ');

            DB::table('commande_lignes')->where('id', $garde->id)->update([
                'quantite' => $quantite,
                'quantite_livree' => (float) $lignes->sum('quantite_livree'),
                'total_ligne' => $total,
                'prix_unitaire' => $quantite > 0 ? (int) round($total / $quantite) : (int) $garde->prix_unitaire,
                'precision' => $precisions !== '' ? mb_substr($precisions, 0, 255) : null,
            ]);
            DB::table('commande_lignes')->whereIn('id', $lignes->pluck('id')->slice(1))->delete();
        }
    }

    private function fusionnerLignesVentesBoutique(): void
    {
        $ventes = DB::table('pos_sales')->where('source', 'boutique_en_ligne')->pluck('id');

        $groupes = DB::table('pos_sale_items')->whereIn('pos_sale_id', $ventes)->orderBy('id')->get()
            ->groupBy(fn ($i) => $i->pos_sale_id.'|'.$i->product_id)
            ->filter(fn ($items) => $items->count() > 1);

        foreach ($groupes as $items) {
            $garde = $items->first();
            $quantite = (float) $items->sum('quantity');
            $total = (float) $items->sum('total');

            DB::table('pos_sale_items')->where('id', $garde->id)->update([
                'quantity' => $quantite,
                'delivered_quantity' => (float) $items->sum('delivered_quantity'),
                'total' => $total,
                'unit_price' => $quantite > 0 ? round($total / $quantite, 4) : $garde->unit_price,
            ]);
            DB::table('pos_sale_items')->whereIn('id', $items->pluck('id')->slice(1))->delete();
        }
    }

    /** Regroupement définitif : pas de retour arrière. */
    public function down(): void {}
};
