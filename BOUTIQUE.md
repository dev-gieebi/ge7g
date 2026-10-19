# Boutique en ligne publique — G-ENERGIE 7 GROUPE

Récapitulatif des changements livrés : boutique publique sur `/`, back-office déplacé sous `/admin`, circuit commande → validation → facture → livraison.

## Routes frontend

### Boutique publique (sans compte)

| Route | Rôle |
|---|---|
| `/` | Accueil : catégories, produits mis en avant, recherche |
| `/produits` | Catalogue public (recherche, filtre catégorie, pagination) |
| `/produits/:id` | Fiche produit, quantité, ajout panier |
| `/panier` | Panier (localStorage, survit au rechargement) |
| `/commande` | Formulaire de commande sans compte + honeypot |
| `/commande/confirmation/:numero` | Numéro `CMD-xxxxx-AAAA` + lien suivi |
| `/suivi`, `/suivi/resultat` | Suivi par numéro + téléphone |

### Espace personnel

- `/login` : page de connexion (inchangée), atteinte via le bouton « Connexion » de la boutique.
- Tout le back-office vit sous `/admin/*` (`/admin/dashboard`, `/admin/commandes`, `/admin/caisse`, `/admin/produits`, `/admin/devis`, `/admin/rapports`, …), protégé par `RequireAuth` + `RequireRole`.
- Après connexion : redirection vers `/admin/dashboard` (ou `/admin/caisse` pour `CAISSIER`).
- **Redirections de compatibilité** : les anciens chemins (`/dashboard`, `/commandes`, `/caisse`, `/devis`, `/stock`, `/achats`, `/factures`, `/clients`, `/prix`, `/categories`, `/unites`, `/fournisseurs`, `/missions`, `/livraisons`, `/logistique`, `/preparation`, `/chauffeurs`, `/vehicules`, `/parametres`, `/audit`, `/notifications`, `/rapports`) redirigent vers `/admin/…` — les favoris du personnel continuent de fonctionner.
- **Conflit résolu** : `/produits` appartient désormais au catalogue public ; l'ancien catalogue admin est sur `/admin/produits`.

## API

### Publique (`/api/public/*`, sans authentification)

- `GET /categories`, `GET /zones`
- `GET /produits` (`search`, `categorie`, `mis_en_avant`, pagination), `GET /produits/{id}`
- `POST /commandes` — throttle 5/h/IP, max 3 commandes en attente par téléphone, honeypot `site_web`
- `POST /suivi` — numéro + téléphone requis, réponse générique « Commande introuvable », throttle 10/min
- Jamais exposés : prix d'achat, marges, stock exact (seulement `disponible` / `stock_limite` / `rupture`), données d'autres clients.

### Admin (authentifiée, `/api/*`)

- `GET /commandes` (+ `statut`, `search`, `from`, `to`), `GET /commandes/{id}`, `GET /commandes/stats`
- `POST /commandes/{id}/valider|refuser|preparer|expedier|livrer|echec|replanifier|annuler`
- `GET /factures/{id}/pdf`
- `GET /pos/sales?source=boutique_en_ligne|caisse`, `GET /users?role=CHAUFFEUR`

## Cycle de vie commande

`en_attente` → `validee` → `en_preparation` → `en_livraison` → `livree` ; branches `refusee`, `echec_livraison` (→ replanification ou annulation), `annulee`. Transitions strictes (`StatutCommande::peutPasserA()`), historisées dans `commande_historique`.

- **Validation** (une seule transaction) : verrou produits, déduction stock (`SORTIE_VENTE`), facture `FAC-xxxxxx-AAAA`, vente `source = boutique_en_ligne`, `payment_method = LIVRAISON`.
- **Annulation après validation** : avoir `AV-xxxxx-AAAA`, vente marquée annulée, retour stock (`RETOUR_ANNULATION`), facture conservée.
- **Livraison** : réceptionnaire, signature (image), montant encaissé + mode (espèces / Airtel Money / Moov Money) → facture `payee` ou `partiellement_payee`.
- Numérotation : table `compteurs` (`type`, `annee`, `valeur`) avec `lockForUpdate`, remise à 1 chaque 1er janvier.

## Migrations à lancer

```sh
php artisan migrate
```

Nouvelles tables : `compteurs`, `clients`, `commandes`, `commande_lignes`, `commande_historique`, `factures`, `facture_lignes`, `avoirs`, `paiements`, `livraisons`. Colonnes ajoutées : `pos_sales` (`source`, `annulee`, `invoice_id`…), `products` (`visible_boutique`, `description_publique`, `mis_en_avant`), `stock_movements.type` élargi en string, rôle `CHAUFFEUR`.

## Variables d'environnement

Aucune nouvelle variable requise. `VITE_API_URL` (frontend) et la config DB/mail existantes suffisent. Le `NotificationService` journalise les changements de statut — branchable plus tard sur SMS/WhatsApp.

## Déploiement

```sh
# Backend
cd backend
php artisan migrate
php artisan optimize:clear   # si caches de config/routes en prod

# Frontend
cd frontendWeb
npm run build                # puis publier dist/ derrière le SPA fallback
```

Attention serveur : le fallback SPA (toutes les routes non-`/api` vers `index.html`) doit rester en place — `/`, `/produits`, `/admin/*` sont des routes React.

## Vérifications

- `php artisan test --compact` : 12 tests, 75 assertions (dont `ShopOrderTest` : commande sans compte, prix falsifiés, validation atomique, stock insuffisant, double validation, transition interdite, annulation/avoir, numérotation, suivi téléphone).
- `npm run typecheck` et `vendor/bin/pint --dirty` : OK.
