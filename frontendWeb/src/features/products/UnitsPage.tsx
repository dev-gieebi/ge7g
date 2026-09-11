import type { Unit } from "@/types";
import { ModuleTabs } from "@/components/ui";
import { CATALOGUE_TABS } from "@/app/moduleTabs";
import { PageHeader } from "@/components/ui";
import { SimpleCrud } from "@/features/settings/SimpleCrud";

export function UnitsPage() {
  return (
    <>
      <ModuleTabs tabs={CATALOGUE_TABS} />
      <PageHeader
        title="Unités de mesure"
        subtitle="Unités utilisées pour les quantités de produits (sac, tonne, m³…)."
        breadcrumb="Produits"
      />
      <SimpleCrud<Unit>
        queryKey="units"
        url="/units"
        title="Unités"
        columns={[
          { key: "name", header: "Unité", render: (u) => <span className="font-semibold">{u.name}</span> },
          { key: "symbol", header: "Symbole", render: (u) => u.symbol },
        ]}
        fields={[
          { name: "name", label: "Nom", required: true },
          { name: "symbol", label: "Symbole", required: true },
        ]}
        empty={{ name: "", symbol: "" }}
      />
    </>
  );
}
