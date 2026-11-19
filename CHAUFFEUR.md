# Partie chauffeur : en pause

La partie chauffeur (affectation d'un chauffeur à une commande, espace « Mes livraisons », départ de mission depuis la tablette, page Chauffeurs) est **mise en commentaire** pour le moment.

En attendant, un gestionnaire (LG_ADMIN, DG_ADMIN) fait tout depuis la fiche commande du back-office :

1. **Valider** la commande.
2. **Mettre en livraison** : ce bouton remplace l'affectation du chauffeur.
3. **Livrée** : un simple clic (confirmation), sans réceptionnaire, encaissement ni signature. Le bon de livraison est créé automatiquement.

Chaque endroit modifié est marqué `[CHAUFFEUR]`. Pour tout retrouver :

```bash
grep -rn "\[CHAUFFEUR\]" backend/app frontendWeb/src
```

Côté serveur, les routes chauffeur restent actives (`affecter`, `expedier`, `demarrer`, `position`, `livrer`, `chauffeurs`). Il n'y a rien à rétablir dans `routes/api.php`.

## Pour réactiver la partie chauffeur

Dans chaque fichier ci-dessous, décommente les lignes marquées `[CHAUFFEUR]` et supprime ce qui a été ajouté en remplacement.

### Backend

| Fichier | Ce qu'il faut faire |
| --- | --- |
| `backend/app/Services/CommandeService.php`, méthode `demarrer()` | Décommenter le contrôle `if (! $commande->chauffeur_id) { … }`. La mise en livraison exigera de nouveau un chauffeur affecté. |
| `backend/app/Http/Controllers/CommandeController.php`, méthode `livrer()` | Remettre `required` sur `receptionnaire`, `montant` et `mode` (ils sont facultatifs pour le clic « Livrée »). |

### Frontend

| Fichier | Ce qu'il faut faire |
| --- | --- |
| `frontendWeb/src/lib/rbac.ts` | Remettre `"CHAUFFEUR"` dans `WEB_ROLES` : décommenter l'ancienne ligne et supprimer la nouvelle. Sans cela, un chauffeur ne peut pas se connecter au Web. |
| `frontendWeb/src/app/router.tsx` | Décommenter les imports `DriversPage` et `DriverHomePage`, la route `/admin/chauffeurs` et le bloc des routes `/admin/mes-livraisons`. |
| `frontendWeb/src/app/navigation.ts` | Décommenter le groupe de menu « Livraisons » (« Mes livraisons »). |
| `frontendWeb/src/app/moduleTabs.ts` | Décommenter l'onglet « Chauffeurs » de la Logistique. |
| `frontendWeb/src/features/logistics/LogisticsDashboardPage.tsx` | Décommenter les deux indicateurs « Chauffeurs en mission » et « Chauffeurs », puis remettre `Users` dans l'import `lucide-react`. |
| `frontendWeb/src/features/orders/OrderDetailPage.tsx` | Voir le détail ci-dessous. |

Dans `OrderDetailPage.tsx` :

- **Imports** : décommenter `MapPin` et `RotateCcw` (icônes `lucide-react`), `import { useChauffeurs } …` et `import { SignaturePad … }`. Remettre `useRef` dans l'import `react` et `FormGrid` dans l'import `@/components/ui`.
- **État et actions** : décommenter `peutAffecter`, la requête `useChauffeurs`, l'état `expedier`, l'action `doAffecter`, l'état `livrer` et la référence `signature`. Remettre l'ancienne action `doLivrer` (avec réceptionnaire, montant, mode et signature).
- **Fonction `confirmerLivraison`** : retirer le `/* … */` qui l'entoure.
- **Fonction `demarrerMission`** : retirer le `/* … */` qui l'entoure.
- **Boutons de l'en-tête** :
  - décommenter « Affecter un chauffeur / Réaffecter » et « Démarrer la mission » ;
  - **supprimer** le bouton provisoire « Mettre en livraison » (bloc commenté « En attendant la partie chauffeur »).
- **Fenêtre « Affecter un chauffeur »** : retirer le `{/* … */}` qui l'entoure.
- **Livraison** : remettre le bouton « Confirmer la livraison » (commenté) à la place du bouton « Livrée », et retirer le `{/* … */}` autour de la fenêtre « Confirmer la livraison » (réceptionnaire, encaissement, signature).

Après ces changements, lance `npm run typecheck` dans `frontendWeb/`. TypeScript signale tout import ou variable oublié.
