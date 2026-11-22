import type { ReactNode } from "react";
import { AlertCircle, ChevronLeft, ChevronRight, Inbox, Loader2 } from "lucide-react";
import type { Paginated } from "@/types";
import { Button } from "./Button";
import { ImageOuInitiales } from "./ImageOuInitiales";

/** Contenu d'une carte : image (ou première lettre), titre, détails, valeur et actions. */
export interface CarteContenu {
  /** Image affichée en haut de la carte. Sans image : la première lettre de `initiale`. */
  image?: string | null;
  /** Mot dont la première lettre remplace l'image (par défaut le titre). */
  initiale?: string;
  /** Pastille en haut à droite de l'image (état, statut…). */
  badge?: ReactNode;
  titre: ReactNode;
  sousTitre?: ReactNode;
  /** Lignes « libellé : valeur » sous le titre. */
  details?: { label: string; valeur: ReactNode }[];
  /** Pastilles en bas à gauche (catégorie, zone…). */
  pied?: ReactNode;
  /** Valeur mise en avant en bas à droite (prix, quantité…). */
  valeur?: ReactNode;
  /** Boutons de la carte : ils passent à la ligne plutôt que de déborder. */
  actions?: ReactNode;
}

interface Props<T> {
  data?: Paginated<T> | T[];
  isLoading?: boolean;
  error?: string | null;
  rowKey: (row: T) => string | number;
  carte: (row: T) => CarteContenu;
  onCardClick?: (row: T) => void;
  /** Cartes sans zone d'image en haut (données qui n'ont pas besoin d'image). */
  sansImage?: boolean;
  page?: number;
  onPageChange?: (page: number) => void;
  emptyTitle?: string;
  emptyHint?: ReactNode;
}

/** Pagination placée au-dessus des listes : pas besoin de défiler pour changer de page. */
export function Pagination({ meta, page, onPageChange }: { meta?: Paginated<unknown>["meta"]; page?: number; onPageChange?: (page: number) => void }) {
  if (!meta || meta.total === 0) return null;
  const courante = page ?? meta.current_page;

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ge7-black/5 bg-white px-4 py-2.5 text-sm text-ge7-black/60 shadow-soft">
      <span>
        {meta.from ?? 0}–{meta.to ?? 0} sur <strong className="text-ge7-black">{meta.total}</strong>
      </span>
      {meta.last_page > 1 && onPageChange && (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" disabled={courante <= 1} onClick={() => onPageChange(courante - 1)}>
            <ChevronLeft size={14} /> <span className="hidden sm:inline">Précédent</span>
          </Button>
          <span className="px-1 font-semibold text-ge7-black">
            {meta.current_page} / {meta.last_page}
          </span>
          <Button size="sm" variant="secondary" disabled={courante >= meta.last_page} onClick={() => onPageChange(courante + 1)}>
            <span className="hidden sm:inline">Suivant</span> <ChevronRight size={14} />
          </Button>
        </div>
      )}
    </div>
  );
}

function Carte({ contenu, onClick, sansImage }: { contenu: CarteContenu; onClick?: () => void; sansImage?: boolean }) {
  const lettre = String(contenu.initiale ?? (typeof contenu.titre === "string" ? contenu.titre : "?")).trim().charAt(0).toUpperCase() || "?";

  return (
    <article
      onClick={onClick}
      className={`group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-ge7-black/5 bg-white shadow-soft transition hover:-translate-y-0.5 hover:border-ge7-gold/50 ${onClick ? "cursor-pointer" : ""}`}
    >
      {!sansImage && (
        <div className="relative h-36 w-full shrink-0 overflow-hidden bg-gradient-to-br from-ge7-cream to-ge7-gold-soft/60">
          <ImageOuInitiales
            src={contenu.image}
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
            fallback={<span className="grid h-full place-items-center font-display text-5xl font-extrabold text-ge7-bronze/50">{lettre}</span>}
          />
          {contenu.badge && <div className="absolute right-2.5 top-2.5">{contenu.badge}</div>}
        </div>
      )}

      <div className="flex flex-1 flex-col p-3.5">
        {/* Sans image : la pastille se place à droite du titre. */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 truncate text-sm font-bold text-ge7-black">{contenu.titre}</h3>
          {sansImage && contenu.badge && <div className="shrink-0">{contenu.badge}</div>}
        </div>
        {contenu.sousTitre && <p className="mt-0.5 truncate text-xs text-ge7-black/50">{contenu.sousTitre}</p>}

        {contenu.details && contenu.details.length > 0 && (
          <dl className="mt-2.5 space-y-1 text-xs">
            {contenu.details.map((d) => (
              <div key={d.label} className="flex items-baseline justify-between gap-2">
                <dt className="shrink-0 text-ge7-black/50">{d.label}</dt>
                <dd className="min-w-0 truncate text-right font-semibold text-ge7-black/80">{d.valeur}</dd>
              </div>
            ))}
          </dl>
        )}

        {(contenu.pied || contenu.valeur !== undefined) && (
          <div className="mt-auto flex flex-wrap items-end justify-between gap-2 pt-3">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">{contenu.pied}</div>
            {contenu.valeur !== undefined && <div className="shrink-0 text-right text-sm font-extrabold text-ge7-black">{contenu.valeur}</div>}
          </div>
        )}
      </div>

      {contenu.actions && (
        <div className="flex flex-wrap items-center justify-end gap-1.5 border-t border-ge7-black/5 px-2.5 py-2" onClick={(e) => e.stopPropagation()}>
          {contenu.actions}
        </div>
      )}
    </article>
  );
}

/** Liste en cartes responsive (1 à 4 colonnes), pagination au-dessus. */
export function CardGrid<T>({ data, isLoading, error, rowKey, carte, onCardClick, sansImage, page, onPageChange, emptyTitle = "Aucun résultat", emptyHint }: Props<T>) {
  const rows = Array.isArray(data) ? data : (data?.data ?? []);
  const meta = Array.isArray(data) ? undefined : data?.meta;

  return (
    <div>
      <Pagination meta={meta} page={page} onPageChange={onPageChange} />
      {isLoading ? (
        <div className="rounded-3xl border border-ge7-black/5 bg-white px-4 py-14 text-center text-sm text-ge7-black/50 shadow-soft">
          <Loader2 className="mx-auto mb-2 animate-spin text-ge7-gold" />
          Chargement…
        </div>
      ) : error ? (
        <div className="rounded-3xl border border-ge7-black/5 bg-white px-4 py-14 text-center text-sm text-rose-600 shadow-soft">
          <AlertCircle className="mx-auto mb-2" />
          {error}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-3xl border border-ge7-black/5 bg-white px-4 py-14 text-center text-sm text-ge7-black/50 shadow-soft">
          <Inbox className="mx-auto mb-2 text-ge7-gold" />
          <p className="font-semibold text-ge7-black/70">{emptyTitle}</p>
          {emptyHint && <div className="mt-1 text-xs">{emptyHint}</div>}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rows.map((row) => (
            <Carte key={rowKey(row)} contenu={carte(row)} sansImage={sansImage} onClick={onCardClick ? () => onCardClick(row) : undefined} />
          ))}
        </div>
      )}
    </div>
  );
}
