<?php

namespace App\Enums;

/**
 * Cycle de vie d'une commande boutique. Les transitions autorisées sont
 * strictement celles du schéma de la procédure (voir `peutPasserA`) — toute
 * autre transition est rejetée par le backend (erreur 422).
 */
enum StatutCommande: string
{
    case EnAttente = 'en_attente';
    case Validee = 'validee';
    case Refusee = 'refusee';
    case EnPreparation = 'en_preparation';
    case EnLivraison = 'en_livraison';
    case Livree = 'livree';
    case EchecLivraison = 'echec_livraison';
    case Annulee = 'annulee';

    /** Libellé affiché au client sur la page de suivi. */
    public function libelle(): string
    {
        return match ($this) {
            self::EnAttente => 'Commande reçue',
            self::Validee => 'Commande validée',
            self::Refusee => 'Commande refusée',
            self::EnPreparation => 'En préparation',
            self::EnLivraison => 'En cours de livraison',
            self::Livree => 'Livrée',
            self::EchecLivraison => 'Livraison non aboutie',
            self::Annulee => 'Annulée',
        };
    }

    public function peutPasserA(self $cible): bool
    {
        return match ($this) {
            self::EnAttente => in_array($cible, [self::Validee, self::Refusee], true),
            self::Validee => in_array($cible, [self::EnPreparation, self::EnLivraison, self::Annulee], true),
            self::EnPreparation => in_array($cible, [self::EnLivraison, self::Annulee], true),
            self::EnLivraison => in_array($cible, [self::Livree, self::EchecLivraison], true),
            self::EchecLivraison => in_array($cible, [self::EnLivraison, self::Annulee], true),
            self::Refusee, self::Livree, self::Annulee => false,
        };
    }

    /** Étapes de la frise de suivi client, dans l'ordre. */
    public static function frise(): array
    {
        return [self::EnAttente, self::Validee, self::EnPreparation, self::EnLivraison, self::Livree];
    }
}
