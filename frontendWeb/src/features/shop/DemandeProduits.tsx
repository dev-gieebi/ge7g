import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Plus, Search, Trash2 } from "lucide-react";
import { Loading } from "@/components/ui";
import { ImageOuInitiales, initiales } from "@/components/ui/ImageOuInitiales";
import { shopApi } from "./api";
import { clientApi, type LigneDemandee, type ProduitClient } from "./espaceClient";

/**
 * Briques de la demande de produits du client connecté : catalogue complet
 * sans prix ni stock, quantité saisie librement, et produits inconnus
 * (hors catalogue) que l'équipe référencera ensuite.
 */

export const champ = "w-full rounded-xl border border-ge7-black/15 bg-white px-3.5 py-2.5 text-sm focus:border-ge7-gold focus:outline-none";
export const etiquette = "mb-1 block text-xs font-bold uppercase tracking-wide text-ge7-black/60";

/** Ligne de la demande en cours, côté navigateur. */
export interface LigneLocale extends LigneDemandee {
  cle: string;
  designation: string;
  unite?: string | null;
  image?: string | null;
}

export const versPayload = (lignes: LigneLocale[]): LigneDemandee[] =>
  lignes.map((l) => (l.produit_id
    ? { produit_id: l.produit_id, quantite: l.quantite, precision: l.precision }
    : { designation: l.designation, quantite: l.quantite, precision: l.precision }));

/** Ajoute une ligne : un produit du catalogue déjà présent voit sa quantité cumulée. */
export function fusionner(lignes: LigneLocale[], ajout: LigneLocale): LigneLocale[] {
  const existante = ajout.produit_id ? lignes.find((l) => l.produit_id === ajout.produit_id) : undefined;
  return existante
    ? lignes.map((l) => (l === existante ? { ...l, quantite: l.quantite + ajout.quantite } : l))
    : [...lignes, ajout];
}

function Vignette({ image, designation }: { image?: string | null; designation: string }) {
  return (
    <ImageOuInitiales
      src={image}
      loading="lazy"
      className="size-14 shrink-0 rounded-xl object-cover"
      fallback={<span className="grid size-14 shrink-0 place-items-center rounded-xl bg-ge7-black/[0.04] font-display text-sm font-extrabold text-ge7-black/25">{initiales(designation)}</span>}
    />
  );
}

function CarteProduit({ p, onAjouter }: { p: ProduitClient; onAjouter: (l: LigneLocale) => void }) {
  const [quantite, setQuantite] = useState("1");
  const valeur = Number(quantite.replace(",", "."));

  return (
    <li className="flex items-center gap-3 rounded-2xl border border-ge7-black/10 bg-white p-3">
      <Vignette image={p.image} designation={p.designation} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">{p.designation}</p>
        <p className="truncate text-xs text-ge7-black/50">{[p.reference, p.categorie].filter(Boolean).join(" · ")}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <input
          type="number"
          min={0.01}
          step="any"
          inputMode="decimal"
          aria-label={`Quantité de ${p.designation}`}
          className="w-20 rounded-xl border border-ge7-black/15 px-2.5 py-2 text-right text-sm focus:border-ge7-gold focus:outline-none"
          value={quantite}
          onChange={(e) => setQuantite(e.target.value)}
        />
        {p.unite && <span className="w-6 text-xs text-ge7-black/50">{p.unite}</span>}
        <button
          type="button"
          disabled={!(valeur > 0)}
          onClick={() => {
            onAjouter({ cle: `p${p.id}`, produit_id: p.id, designation: p.designation, quantite: valeur, unite: p.unite, image: p.image });
            setQuantite("1");
          }}
          className="grid size-9 place-items-center rounded-full bg-ge7-gold text-ge7-black transition hover:brightness-110 disabled:opacity-40"
          title="Ajouter à ma demande"
        >
          <Plus size={17} />
        </button>
      </div>
    </li>
  );
}

/** Produit absent du catalogue : une ligne nom + quantité, ajoutée d'un clic sur « + ». */
function AjoutProduitLibre({ onAjouter }: { onAjouter: (l: LigneLocale) => void }) {
  const [designation, setDesignation] = useState("");
  const [quantite, setQuantite] = useState("1");
  const valeur = Number(quantite.replace(",", "."));
  const valide = designation.trim().length >= 2 && valeur > 0;

  const ajouter = () => {
    if (!valide) return;
    onAjouter({ cle: `i${Date.now()}`, designation: designation.trim(), quantite: valeur });
    setDesignation("");
    setQuantite("1");
  };

  return (
    <div className="flex items-center gap-2 rounded-2xl border border-dashed border-ge7-bronze/50 bg-white p-3">
      <input
        maxLength={150}
        className={`${champ} min-w-0 flex-1`}
        value={designation}
        onChange={(e) => setDesignation(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); ajouter(); } }}
        placeholder="Produit absent du catalogue : nom du produit"
        aria-label="Nom du produit"
      />
      <input
        type="number"
        min={0.01}
        step="any"
        inputMode="decimal"
        aria-label="Quantité"
        className="w-20 shrink-0 rounded-xl border border-ge7-black/15 px-2.5 py-2.5 text-right text-sm focus:border-ge7-gold focus:outline-none"
        value={quantite}
        onChange={(e) => setQuantite(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); ajouter(); } }}
      />
      <button
        type="button"
        disabled={!valide}
        onClick={ajouter}
        className="grid size-9 shrink-0 place-items-center rounded-full bg-ge7-gold text-ge7-black transition hover:brightness-110 disabled:opacity-40"
        title="Ajouter ce produit"
      >
        <Plus size={17} />
      </button>
    </div>
  );
}

/** Catalogue complet du client : tous les produits en base, sans prix ni stock. */
export function CatalogueClient({ onAjouter }: { onAjouter: (l: LigneLocale) => void }) {
  const [saisie, setSaisie] = useState("");
  const [search, setSearch] = useState("");
  const [categorie, setCategorie] = useState<number | undefined>();
  const [page, setPage] = useState(1);

  // Recherche lancée après une courte pause de frappe.
  useEffect(() => {
    const t = setTimeout(() => { setSearch(saisie.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [saisie]);

  const { data: categories } = useQuery({ queryKey: ["shop", "categories"], queryFn: shopApi.categories, staleTime: 5 * 60_000 });
  const { data, isLoading } = useQuery({
    queryKey: ["client", "produits", page, search, categorie],
    queryFn: () => clientApi.produits({ page, search: search || undefined, categorie }),
    placeholderData: keepPreviousData,
  });

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-0 flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ge7-black/40" />
          <input className={`${champ} pl-10`} value={saisie} onChange={(e) => setSaisie(e.target.value)} placeholder="Rechercher un produit ou une référence…" />
        </div>
        <select className={`${champ} w-auto`} value={categorie ?? ""} onChange={(e) => { setCategorie(e.target.value ? Number(e.target.value) : undefined); setPage(1); }}>
          <option value="">Toutes catégories</option>
          {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className="mt-3">
        <AjoutProduitLibre onAjouter={onAjouter} />
      </div>

      {isLoading ? (
        <Loading />
      ) : !data || data.data.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-ge7-black/15 bg-white/60 px-6 py-10 text-center text-sm text-ge7-black/50">
          Aucun produit trouvé. Ajoutez-le avec son nom et sa quantité dans la ligne ci-dessus.
        </p>
      ) : (
        <>
          <ul className="mt-4 space-y-2">
            {data.data.map((p) => <CarteProduit key={p.id} p={p} onAjouter={onAjouter} />)}
          </ul>
          {data.meta.last_page > 1 && (
            <div className="mt-4 flex items-center justify-center gap-3">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-full border border-ge7-black/15 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-40">Précédent</button>
              <span className="text-sm text-ge7-black/60">Page {data.meta.current_page} / {data.meta.last_page}</span>
              <button type="button" disabled={page >= data.meta.last_page} onClick={() => setPage((p) => p + 1)} className="rounded-full border border-ge7-black/15 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-40">Suivant</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Quantité saisie librement : la saisie en cours peut être vide, seule une valeur > 0 est retenue. */
function QuantiteLigne({ valeur, libelle, onChange }: { valeur: number; libelle: string; onChange: (q: number) => void }) {
  const [saisie, setSaisie] = useState(String(valeur));
  useEffect(() => setSaisie(String(valeur)), [valeur]);

  return (
    <input
      type="number"
      min={0.01}
      step="any"
      inputMode="decimal"
      aria-label={`Quantité de ${libelle}`}
      className="w-20 rounded-lg border border-ge7-black/15 px-2 py-1.5 text-right text-sm focus:border-ge7-gold focus:outline-none"
      value={saisie}
      onChange={(e) => {
        setSaisie(e.target.value);
        const q = Number(e.target.value);
        if (q > 0) onChange(q);
      }}
      onBlur={() => setSaisie(String(valeur))}
    />
  );
}

/** Liste de la demande en cours : quantités modifiables, sans prix. */
export function ListeDemande({ lignes, onQuantite, onRetirer }: { lignes: LigneLocale[]; onQuantite: (cle: string, q: number) => void; onRetirer: (cle: string) => void }) {
  if (lignes.length === 0) {
    return <p className="rounded-xl bg-ge7-black/[0.03] px-4 py-6 text-center text-sm text-ge7-black/50">Aucun produit pour le moment. Ajoutez des produits depuis le catalogue.</p>;
  }

  return (
    <ul className="divide-y divide-ge7-black/5">
      {lignes.map((l) => (
        <li key={l.cle} className="flex items-center gap-2 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{l.designation}</p>
            {!l.produit_id && <p className="text-[11px] font-bold uppercase tracking-wide text-ge7-bronze">Hors catalogue</p>}
            {l.precision && <p className="truncate text-xs text-ge7-black/50">{l.precision}</p>}
          </div>
          <QuantiteLigne valeur={l.quantite} libelle={l.designation} onChange={(q) => onQuantite(l.cle, q)} />
          {l.unite && <span className="w-6 text-xs text-ge7-black/50">{l.unite}</span>}
          <button type="button" onClick={() => onRetirer(l.cle)} className="text-ge7-black/35 hover:text-rose-600" aria-label={`Retirer ${l.designation}`}><Trash2 size={16} /></button>
        </li>
      ))}
    </ul>
  );
}
