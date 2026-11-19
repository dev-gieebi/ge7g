import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { PackagePlus, PackageSearch, Plus, Search, Trash2, X } from "lucide-react";
import { Loading } from "@/components/ui";
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
  return image ? (
    <img src={image} alt="" loading="lazy" className="size-14 shrink-0 rounded-xl object-cover" />
  ) : (
    <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-ge7-black/[0.04] font-display text-sm font-extrabold text-ge7-black/25">
      {designation.slice(0, 2).toUpperCase()}
    </span>
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

/** Formulaire « produit introuvable » : désignation libre, précision et quantité. */
export function ProduitInconnuForm({ onAjouter, onFermer }: { onAjouter: (l: LigneLocale) => void; onFermer: () => void }) {
  const [form, setForm] = useState({ designation: "", precision: "", quantite: "1" });
  const quantite = Number(form.quantite.replace(",", "."));
  const valide = form.designation.trim().length >= 2 && quantite > 0;

  return (
    <div className="rounded-2xl border border-ge7-gold/50 bg-ge7-gold-soft/30 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-bold"><PackageSearch size={16} className="text-ge7-bronze" /> Demander un produit hors catalogue</p>
        <button type="button" onClick={onFermer} className="text-ge7-black/40 hover:text-ge7-black" aria-label="Fermer"><X size={16} /></button>
      </div>
      <p className="mt-1 text-xs text-ge7-black/60">Décrivez le produit recherché : notre équipe le trouve et l'ajoute au catalogue avant de valider la commande.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_7rem]">
        <div>
          <label className={etiquette}>Produit *</label>
          <input maxLength={150} className={champ} value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} placeholder="Ex. Disjoncteur 63 A tétrapolaire" />
        </div>
        <div>
          <label className={etiquette}>Quantité *</label>
          <input type="number" min={0.01} step="any" inputMode="decimal" className={champ} value={form.quantite} onChange={(e) => setForm({ ...form, quantite: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <label className={etiquette}>Précisions (facultatif)</label>
          <input maxLength={300} className={champ} value={form.precision} onChange={(e) => setForm({ ...form, precision: e.target.value })} placeholder="Marque, dimensions, référence fabricant…" />
        </div>
      </div>
      <button
        type="button"
        disabled={!valide}
        onClick={() => {
          onAjouter({ cle: `i${Date.now()}`, designation: form.designation.trim(), precision: form.precision.trim() || undefined, quantite });
          setForm({ designation: "", precision: "", quantite: "1" });
          onFermer();
        }}
        className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-ge7-black px-4 py-2 text-sm font-bold text-ge7-gold-light disabled:opacity-40"
      >
        <PackagePlus size={15} /> Ajouter à ma demande
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
  const [inconnu, setInconnu] = useState(false);

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
        {inconnu ? (
          <ProduitInconnuForm onAjouter={onAjouter} onFermer={() => setInconnu(false)} />
        ) : (
          <button type="button" onClick={() => setInconnu(true)} className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-ge7-bronze/60 px-4 py-2 text-sm font-semibold text-ge7-bronze hover:bg-ge7-gold-soft/40">
            <PackageSearch size={15} /> Produit introuvable ? Demander un produit
          </button>
        )}
      </div>

      {isLoading ? (
        <Loading />
      ) : !data || data.data.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-ge7-black/15 bg-white/60 px-6 py-10 text-center text-sm text-ge7-black/50">
          Aucun produit trouvé. Utilisez « Demander un produit » pour nous signaler ce que vous cherchez.
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
