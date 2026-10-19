<?php

namespace App\Http\Controllers;

use App\Models\Facture;
use App\Models\User;
use App\Support\SimplePdf;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class FactureController extends Controller
{
    private const VIEW_ROLES = ['LG_ADMIN', 'DG_ADMIN', 'CDG_ADMIN', 'SUPERADMIN', 'CHAUFFEUR'];

    /**
     * PDF de la facture : en-tête G-ENERGIE 7 GROUPE, numéro, date, client,
     * lignes aux prix figés, total et statut de paiement.
     */
    public function pdf(Request $request, Facture $facture): Response
    {
        /** @var User $user */
        $user = $request->user();
        if (! in_array($user->role, self::VIEW_ROLES, true)) {
            abort(403, 'Accès réservé.');
        }

        $facture->load(['lignes', 'commande', 'client', 'paiements', 'avoir']);

        $pdf = new SimplePdf;
        $w = 595;
        $m = 50; // marge

        $enTete = function () use ($pdf, $facture, $m, $w) {
            $pdf->text($m, 800, 'G-ENERGIE 7 GROUPE', 16, true);
            $pdf->text($m, 785, 'www.g-energie7groupe.com', 9);
            $pdf->text($w - $m - 180, 800, 'FACTURE '.$facture->numero, 13, true);
            $pdf->text($w - $m - 180, 786, 'Date : '.$facture->emise_le->format('d/m/Y'), 9);
            $pdf->line($m, 775, $w - $m, 775, 1);
        };

        $enTete();

        $commande = $facture->commande;
        $y = 750;
        $pdf->text($m, $y, 'Client : '.($commande?->nom_livraison ?? $facture->client?->nom ?? ''), 10, true);
        $pdf->text($m, $y - 14, 'Téléphone : '.($commande?->telephone_livraison ?? $facture->client?->telephone ?? ''));
        if ($commande) {
            $pdf->text($m, $y - 28, 'Adresse : '.$commande->ville.' '.$commande->quartier.', '.$commande->point_repere);
        }
        if ($commande?->numero) {
            $pdf->text($w - $m - 180, $y, 'Commande : '.$commande->numero, 9);
            // Distinction visuelle : la facture provient de la boutique en ligne.
            $pdf->text($w - $m - 180, $y - 12, 'COMMANDE EN LIGNE', 9, true);
        }
        $y -= 52;

        // En-tête du tableau des lignes.
        $pdf->rect($m, $y - 6, $w - 2 * $m, 18, 0.92);
        $pdf->text($m + 4, $y, 'Désignation', 9, true);
        $pdf->text($m + 300, $y, 'Qté', 9, true);
        $pdf->text($m + 360, $y, 'P.U FCFA', 9, true);
        $pdf->text($m + 440, $y, 'Total FCFA', 9, true);
        $y -= 22;

        foreach ($facture->lignes as $ligne) {
            if ($y < 140) {
                $pdf->addPage();
                $enTete();
                $y = 750;
            }
            $pdf->text($m + 4, $y, mb_strimwidth($ligne->designation, 0, 60, '…'));
            $pdf->text($m + 300, $y, rtrim(rtrim(number_format((float) $ligne->quantite, 2, ',', ' '), '0'), ','));
            $pdf->text($m + 360, $y, number_format($ligne->prix_unitaire, 0, ',', ' '));
            $pdf->text($m + 440, $y, number_format($ligne->total_ligne, 0, ',', ' '));
            $y -= 15;
        }

        $y -= 10;
        $pdf->line($m, $y, $w - $m, $y, 1);
        $y -= 18;
        $pdf->text($m + 360, $y, 'TOTAL', 11, true);
        $pdf->text($m + 440, $y, number_format($facture->montant_total, 0, ',', ' ').' FCFA', 11, true);

        $encaisse = (int) $facture->paiements->sum('montant');
        $y -= 16;
        $statut = match ($facture->statut_paiement) {
            'payee' => 'PAYÉE',
            'partiellement_payee' => 'PARTIELLEMENT PAYÉE reste '.number_format($facture->montant_total - $encaisse, 0, ',', ' ').' FCFA',
            'annulee' => 'ANNULÉE'.($facture->avoir ? ' (avoir '.$facture->avoir->numero.')' : ''),
            default => 'NON PAYÉE paiement à la livraison',
        };
        $pdf->text($m + 360, $y, $statut, 9, true);

        $pdf->text($m, 60, 'Merci de votre confiance G-ENERGIE 7 GROUPE', 8);
        $pdf->text($m, 48, 'Facture générée le '.now()->format('d/m/Y à H:i'), 8);

        return $pdf->stream('facture-'.$facture->numero.'.pdf');
    }
}
