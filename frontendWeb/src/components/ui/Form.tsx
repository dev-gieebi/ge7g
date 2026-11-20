import { Children, Fragment, isValidElement, useMemo, useRef, useState } from "react";
import type { ChangeEvent, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, X } from "lucide-react";

function Wrap({
  label,
  error,
  hint,
  children,
  className = "",
}: {
  label?: string;
  error?: string | string[];
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  const err = Array.isArray(error) ? error[0] : error;
  return (
    <div className={className}>
      {label && <label className="ge7-label">{label}</label>}
      {children}
      {err ? (
        <p className="mt-1 text-xs font-medium text-rose-600">{err}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-ge7-black/50">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({
  label,
  error,
  hint,
  className = "",
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string | string[]; hint?: string }) {
  return (
    <Wrap label={label} error={error} hint={hint} className={className}>
      <input className={`ge7-input ${error ? "border-rose-400" : ""}`} {...rest} />
    </Wrap>
  );
}

/**
 * Liste déroulante : au clic, les choix s'ouvrent au centre de l'écran,
 * triés par ordre alphabétique, avec une recherche. Même utilisation qu'un
 * <select> (value, onChange(e) avec e.target.value, enfants <option>). Un
 * <select> natif masqué garde le comportement des formulaires (required).
 * `trier={false}` conserve l'ordre d'origine (statuts, étapes…).
 */
export function Select({
  label,
  error,
  hint,
  className = "",
  children,
  trier = true,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string | string[]; hint?: string; trier?: boolean }) {
  const [ouvert, setOuvert] = useState(false);
  const [recherche, setRecherche] = useState("");
  const natif = useRef<HTMLSelectElement>(null);

  const options = useMemo(() => {
    const liste = extraireOptions(children);
    if (!trier) return liste;
    // Le choix vide (« Tous », « Choisir… ») reste en tête ; le reste par ordre alphabétique.
    const vides = liste.filter((o) => o.value === "");
    const autres = liste
      .filter((o) => o.value !== "")
      .sort((a, b) => a.label.localeCompare(b.label, "fr", { sensitivity: "base", numeric: true }));
    return [...vides, ...autres];
  }, [children, trier]);

  const valeur = rest.value !== undefined ? String(rest.value) : natif.current?.value ?? "";
  const choisi = options.find((o) => o.value === valeur);
  const visibles = options.filter((o) => !o.hidden && (!recherche.trim() || o.label.toLowerCase().includes(recherche.trim().toLowerCase())));

  const choisir = (v: string) => {
    if (natif.current) natif.current.value = v;
    rest.onChange?.({ target: { value: v, name: rest.name }, currentTarget: { value: v, name: rest.name } } as unknown as ChangeEvent<HTMLSelectElement>);
    setOuvert(false);
    setRecherche("");
  };

  return (
    <Wrap label={label} error={error} hint={hint} className={className}>
      <div className="relative">
        <button
          type="button"
          disabled={rest.disabled}
          onClick={() => setOuvert(true)}
          className={`ge7-input flex items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-60 ${error ? "border-rose-400" : ""}`}
        >
          <span className={`truncate ${choisi && choisi.value !== "" ? "" : "text-ge7-black/40"}`}>{choisi?.label || "Choisir…"}</span>
          <ChevronDown size={16} className="shrink-0 text-ge7-black/40" />
        </button>
        {/* Select natif masqué : validation « required » et valeur du formulaire. */}
        <select
          ref={natif}
          {...rest}
          onChange={() => {}}
          tabIndex={-1}
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px w-full opacity-0"
        >
          {children}
        </select>
      </div>

      {ouvert &&
        createPortal(
          <div className="fixed inset-0 z-[70] grid place-items-center bg-ge7-black/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && setOuvert(false)}>
            <div
              role="listbox"
              className="flex max-h-[75vh] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white shadow-soft"
              onKeyDown={(e) => {
                if (e.key === "Escape") setOuvert(false);
                if (e.key === "Enter" && visibles[0] && !visibles[0].disabled) {
                  e.preventDefault();
                  choisir(visibles[0].value);
                }
              }}
            >
              <div className="flex items-center justify-between gap-2 border-b border-ge7-black/5 px-4 py-3">
                <p className="truncate text-sm font-bold">{label || "Choisir"}</p>
                <button type="button" onClick={() => setOuvert(false)} className="rounded-full p-1 text-ge7-black/50 hover:bg-ge7-black/5" aria-label="Fermer">
                  <X size={16} />
                </button>
              </div>
              <div className="relative border-b border-ge7-black/5 p-3">
                <Search size={15} className="absolute left-6 top-1/2 -translate-y-1/2 text-ge7-black/40" />
                <input autoFocus value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher…" className="ge7-input pl-9" />
              </div>
              <ul className="overflow-y-auto p-2">
                {visibles.map((o) => (
                  <li key={`${o.value}-${o.label}`}>
                    <button
                      type="button"
                      disabled={o.disabled}
                      onClick={() => choisir(o.value)}
                      className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition disabled:opacity-40 ${o.value === valeur ? "bg-ge7-black font-semibold text-ge7-gold-light" : "hover:bg-ge7-gold-soft/50"}`}
                    >
                      <span className={o.value === "" ? "italic text-current opacity-70" : ""}>{o.label || "Aucun"}</span>
                      {o.value === valeur && <Check size={15} className="shrink-0" />}
                    </button>
                  </li>
                ))}
                {visibles.length === 0 && <li className="px-3 py-6 text-center text-sm text-ge7-black/50">Aucun résultat</li>}
              </ul>
            </div>
          </div>,
          document.body,
        )}
    </Wrap>
  );
}

interface OptionSelect {
  value: string;
  label: string;
  disabled?: boolean;
  hidden?: boolean;
}

/** Texte brut d'un contenu React (libellé d'une option). */
function texte(n: ReactNode): string {
  if (n === null || n === undefined || typeof n === "boolean") return "";
  if (typeof n === "string" || typeof n === "number") return String(n);
  if (Array.isArray(n)) return n.map(texte).join("");
  if (isValidElement<{ children?: ReactNode }>(n)) return texte(n.props.children);
  return "";
}

/** Options (<option>, y compris dans des fragments ou des tableaux) d'un <select>. */
function extraireOptions(children: ReactNode): OptionSelect[] {
  const liste: OptionSelect[] = [];
  Children.forEach(children, (c) => {
    if (!isValidElement<{ value?: string | number; children?: ReactNode; disabled?: boolean; hidden?: boolean }>(c)) return;
    if (c.type === Fragment) {
      liste.push(...extraireOptions(c.props.children));
      return;
    }
    if (c.type !== "option") return;
    const lib = texte(c.props.children);
    liste.push({ value: c.props.value !== undefined ? String(c.props.value) : lib, label: lib, disabled: c.props.disabled, hidden: c.props.hidden });
  });
  return liste;
}

export function Textarea({
  label,
  error,
  hint,
  className = "",
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string | string[]; hint?: string }) {
  return (
    <Wrap label={label} error={error} hint={hint} className={className}>
      <textarea rows={3} className={`ge7-input ${error ? "border-rose-400" : ""}`} {...rest} />
    </Wrap>
  );
}

export function FormGrid({ children, cols = 2 }: { children: ReactNode; cols?: 1 | 2 | 3 }) {
  const map = { 1: "grid-cols-1", 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3" };
  return <div className={`grid gap-4 ${map[cols]}`}>{children}</div>;
}
