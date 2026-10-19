import { useQuery } from "@tanstack/react-query";
import { api, toApiError } from "@/lib/api";
import type { PilotageReport } from "@/types";
import { money, qty } from "@/lib/format";
import { Card, CardHeader, ErrorState, Loading } from "@/components/ui";

/** Questions de contrôle hebdomadaires (reprise du classeur de suivi). */
const POINTS_CONTROLE = [
  "Les factures correspondent-elles aux quantités réellement livrées ?",
  "Les écarts d'inventaire sont-ils expliqués et validés ?",
  "Les prix d'achat et de vente sont-ils renseignés et cohérents ?",
  "Les stocks sous le seuil minimum font-ils l'objet d'une décision ?",
  "Les marges estimées intègrent-elles les coûts directement attribuables ?",
  "Les règlements clients et les créances sont-ils suivis dans un état séparé fiable ?",
];

function Indicateur({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-ge7-black/10 bg-ge7-cream/40 px-4 py-3">
      <p className="text-xs font-semibold text-ge7-black/60">{label}</p>
      <p className="mt-0.5 text-right text-lg font-extrabold">{value}</p>
    </div>
  );
}

export function PilotageSection() {
  const pilotage = useQuery({
    queryKey: ["report-pilotage"],
    queryFn: async () => (await api.get<{ data: PilotageReport }>("/reports/pilotage")).data.data,
  });

  if (pilotage.isLoading) {
    return <Loading />;
  }
  if (pilotage.error || !pilotage.data) {
    return <ErrorState message={toApiError(pilotage.error).message} onRetry={() => void pilotage.refetch()} />;
  }

  const i = pilotage.data.indicateurs;

  return (
    <>
      <Card>
        <CardHeader
          title="Tableau de bord pilotage du magasin"
          subtitle="Indicateurs calculés sur les achats, ventes et mouvements de stock. Vérifier la qualité des données avant diffusion."
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Indicateur label="Chiffre d'affaires facturé (FCFA)" value={money(i.ca_facture)} />
          <Indicateur label="Valeur estimée du stock (FCFA)" value={money(i.valeur_stock)} />
          <Indicateur label="Achats enregistrés (FCFA)" value={money(i.achats)} />
          <Indicateur label="Marge estimée sur quantités livrées (FCFA)" value={money(i.marge_livree)} />
          <Indicateur label="Quantités restant à livrer (unités cumulées)" value={qty(i.restant_a_livrer)} />
          <Indicateur label="Articles à réapprovisionner / en anomalie" value={String(i.articles_alerte)} />
          <Indicateur label="Écarts physiques non nuls (articles)" value={String(i.ecarts_physiques)} />
        </div>
      </Card>

      <Card className="mt-6">
        <CardHeader title="Points de contrôle à examiner chaque lundi" />
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-ge7-black/80">
          {POINTS_CONTROLE.map((p) => <li key={p}>{p}</li>)}
        </ol>
      </Card>
    </>
  );
}
