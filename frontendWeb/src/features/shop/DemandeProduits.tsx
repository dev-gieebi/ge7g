import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Check, Minus, Plus, Search, Trash2 } from "lucide-react";
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

/**
 * Carte produit du catalogue client (comme à la caisse) : un clic ajoute
 * 1 à la demande ; la quantité se règle ensuite dans « Ma demande ».
 */
function CarteProduit({ p, onAjouter }: { p: ProduitClient; onAjouter: (l: LigneLocale) => void }) {
  const [ajoute, setAjoute] = useState(false);
  useEffect(() => {
    if (!ajoute) return;
    const t = setTimeout(() => setAjoute(false), 1200);
    return () => clearTimeout(t);
  }, [ajoute]);

  return (
    <li className="min-w-0">
      <button
        type="button"
        onClick={() => {
          onAjouter({ cle: `p${p.id}`, produit_id: p.id, designation: p.designation, quantite: 1, unite: p.unite, image: p.image });
          setAjoute(true);
        }}
        title="Ajouter à ma demande"
        className="flex h-full w-full flex-col rounded-3xl border border-ge7-black/5 bg-white p-3 text-left shadow-soft transition hover:-translate-y-0.5 hover:border-ge7-gold"
      >
      <div className="relative mb-3 grid h-28 w-full place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-ge7-gold-soft to-ge7-pearl">
        <ImageOuInitiales
          src={p.image}
          alt={p.designation}
          loading="lazy"
          className="h-full w-full object-cover"
          fallback={<span className="font-display text-3xl font-extrabold text-ge7-bronze/60">{initiales(p.designation)}</span>}
        />
        {ajoute && (
          <span className="absolute inset-0 grid place-items-center bg-ge7-black/45 text-sm font-bold text-white">
            <span className="flex items-center gap-1.5"><Check size={16} /> Ajouté</span>
          </span>
        )}
      </div>
      <p className="font-bold leading-tight">{p.designation}</p>
      {p.reference && <p className="font-mono text-[11px] font-semibold text-ge7-black/40">{p.reference}</p>}
      {p.categorie && <p className="text-xs text-ge7-black/50">{p.categorie}</p>}
      </button>
    </li>
  );
}

/** Pagination du catalogue client (Précédent · Page x / y · Suivant). */
function Pagination({ page, derniere, onPage }: { page: number; derniere: number; onPage: (p: number) => void }) {
  if (derniere <= 1) return null;
  const bouton = "rounded-full border border-ge7-black/15 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-40";
  return (
    <div className="flex items-center justify-center gap-3">
      <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className={bouton}>Précédent</button>
      <span className="text-sm text-ge7-black/60">Page {page} / {derniere}</span>
      <button type="button" disabled={page >= derniere} onClick={() => onPage(page + 1)} className={bouton}>Suivant</button>
    </div>
  );
}

/** Produit absent du catalogue : une ligne nom + quantité, ajoutée d'un clic sur « + ». */
function AjoutProduitLibre({ onAjouter }: { onAjouter: (l: LigneLocale) => void }) {
  const [designation, setDesignation] = useState("");
  const [quantite, setQuantite] = useState("");
  const valeur = Number(quantite.replace(",", "."));
  const valide = designation.trim().length >= 2 && valeur > 0;

  const ajouter = () => {
    if (!valide) return;
    onAjouter({ cle: `i${Date.now()}`, designation: designation.trim(), quantite: valeur });
    setDesignation("");
    setQuantite("");
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
        <div className="mt-4 space-y-4">
          <Pagination page={data.meta.current_page} derniere={data.meta.last_page} onPage={setPage} />
          <ul className="grid grid-cols-2 gap-3">
            {data.data.map((p) => <CarteProduit key={p.id} p={p} onAjouter={onAjouter} />)}
          </ul>
        </div>
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
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" disabled={l.quantite <= 1} onClick={() => onQuantite(l.cle, l.quantite - 1)} className="grid size-7 place-items-center rounded-full border border-ge7-black/15 bg-white disabled:opacity-40" aria-label={`Diminuer ${l.designation}`}><Minus size={14} /></button>
            <QuantiteLigne valeur={l.quantite} libelle={l.designation} onChange={(q) => onQuantite(l.cle, q)} />
            <button type="button" onClick={() => onQuantite(l.cle, l.quantite + 1)} className="grid size-7 place-items-center rounded-full bg-ge7-gold text-ge7-black" aria-label={`Augmenter ${l.designation}`}><Plus size={14} /></button>
          </div>
          {l.unite && <span className="w-6 text-xs text-ge7-black/50">{l.unite}</span>}
          <button type="button" onClick={() => onRetirer(l.cle)} className="text-ge7-black/35 hover:text-rose-600" aria-label={`Retirer ${l.designation}`}><Trash2 size={16} /></button>
        </li>
      ))}
    </ul>
  );
}
