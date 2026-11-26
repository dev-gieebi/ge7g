import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Archive, ChevronRight, FileText, Printer, Receipt } from "lucide-react";
import { date, money } from "@/lib/format";
import { ErrorState, Loading } from "@/components/ui";
import { Facture } from "@/features/pos/Facture";
import { clientApi } from "./espaceClient";
import { documentBon, documentCommande } from "./ClientOrderDetailPage";

/** Archive du client : une entrée par commande facturée, facture et bon de livraison rangés ensemble. */
export function ClientDocumentsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ["client", "documents", page],
    queryFn: () => clientApi.documents(page),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold"><Archive size={22} className="text-ge7-bronze" /> Mes documents</h1>
      <p className="mt-1 text-sm text-ge7-black/60">Factures et bons de livraison de vos commandes, rangés par commande.</p>

      {isLoading ? (
        <Loading />
      ) : !data || data.data.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-ge7-black/15 bg-white/60 px-6 py-12 text-center text-sm text-ge7-black/50">
          Aucun document pour le moment. La facture apparaît ici dès la validation d'une commande, le bon de livraison après la livraison.
        </p>
      ) : (
        <>
          <ul className="mt-6 space-y-2.5">
            {data.data.map((d) => (
              <li key={d.commande_id}>
                <Link
                  to={`/mon-compte/documents/${d.cle ?? d.commande_id}`}
                  className="flex items-center gap-3 rounded-2xl border border-ge7-black/10 bg-white px-4 py-3.5 transition hover:border-ge7-gold/60 hover:shadow-soft"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-ge7-black/50">Commande <span className="font-mono font-bold text-ge7-black">{d.commande}</span> · {d.statut_libelle}</p>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-ge7-gold-soft/60 px-3 py-1 text-xs font-bold">
                        <Receipt size={13} className="text-ge7-bronze" /> Facture {d.facture.numero}
                        {d.facture.soldee_le && <span className="rounded-full bg-rose-100 px-1.5 text-[10px] uppercase text-rose-700">Soldée</span>}
                      </span>
                      {d.bon_livraison ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
                          <FileText size={13} /> {d.bon_livraison.numero}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-ge7-black/[0.04] px-3 py-1 text-xs text-ge7-black/45">Bon de livraison après la livraison</span>
                      )}
                    </div>
                    {d.facture.emise_le && <p className="mt-1 text-xs text-ge7-black/45">Facturée le {date(d.facture.emise_le)}</p>}
                  </div>
                  <span className="shrink-0 font-extrabold text-ge7-bronze">{money(d.facture.montant_total)}</span>
                  <ChevronRight size={18} className="shrink-0 text-ge7-black/30" />
                </Link>
              </li>
            ))}
          </ul>
          {data.meta.last_page > 1 && (
            <div className="mt-6 flex items-center justify-center gap-3">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-full border border-ge7-black/15 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-40">Précédent</button>
              <span className="text-sm text-ge7-black/60">Page {data.meta.current_page} / {data.meta.last_page}</span>
              <button disabled={page >= data.meta.last_page} onClick={() => setPage((p) => p + 1)} className="rounded-full border border-ge7-black/15 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-40">Suivant</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Documents d'une commande : boutons à gauche (facture d'abord, puis bon de livraison), document à droite. */
export function ClientDocumentViewerPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  // Facture, ou bon de livraison d'un envoi (n° du bon) : un bon par livraison partielle.
  const [doc, setDoc] = useState<string>("facture");
  const { data: c, isLoading, isError } = useQuery({
    queryKey: ["client", "commande", id],
    queryFn: () => clientApi.commande(id!),
    enabled: !!id,
  });

  if (isLoading) return <Loading />;
  if (isError || !c || !c.facture) return <ErrorState message="Document introuvable." />;

  const bons = c.bons_livraison ?? [];
  const bonChoisi = bons.find((b) => b.numero === doc);
  const estBl = !!bonChoisi;
  const bouton = (actif: boolean) =>
    `flex w-full items-center gap-2.5 rounded-xl px-3.5 py-3 text-left text-sm font-bold transition ${actif ? "bg-ge7-black text-ge7-gold-light" : "bg-white text-ge7-black/75 hover:bg-ge7-gold-soft/50"}`;

  return (
    <div>
      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        <button onClick={() => navigate("/mon-compte/documents")} className="inline-flex items-center gap-1.5 rounded-full border border-ge7-black/15 bg-white px-4 py-2 text-sm font-semibold"><ArrowLeft size={15} /> Mes documents</button>
        <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-full bg-ge7-gold px-4 py-2 text-sm font-bold text-ge7-black"><Printer size={15} /> Imprimer / PDF</button>
        <Link to={`/mon-compte/commandes/${c.cle ?? c.id}`} className="text-sm font-semibold text-ge7-purple hover:underline">Suivi de la commande {c.numero}</Link>
      </div>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <nav className="no-print flex shrink-0 gap-2 lg:sticky lg:top-24 lg:w-56 lg:flex-col">
          <button onClick={() => setDoc("facture")} className={bouton(doc === "facture")}>
            <Receipt size={17} />
            <span className="min-w-0">
              Facture
              <span className="block truncate text-[11px] font-semibold opacity-70">{c.facture.numero}{c.facture.soldee_le ? " · soldée" : ""}</span>
            </span>
          </button>
          {/* Un bon de livraison par envoi, avec les seules quantités de cet envoi. */}
          {bons.length > 0 ? (
            bons.map((b) => (
              <button key={b.numero} onClick={() => setDoc(b.numero)} className={bouton(doc === b.numero)}>
                <FileText size={17} />
                <span className="min-w-0">
                  Bon de livraison
                  <span className="block truncate text-[11px] font-semibold opacity-70">{b.numero}{b.livre_le ? ` · ${date(b.livre_le)}` : ""}</span>
                </span>
              </button>
            ))
          ) : (
            <button disabled className={`${bouton(false)} cursor-not-allowed opacity-45`}>
              <FileText size={17} />
              <span className="min-w-0">
                Bon de livraison
                <span className="block truncate text-[11px] font-semibold opacity-70">Après la livraison</span>
              </span>
            </button>
          )}
        </nav>

        <div className="min-w-0 flex-1">
          <Facture
            sale={bonChoisi ? documentBon(c, bonChoisi) : documentCommande(c, false)}
            originLabel={`Commande : ${c.numero}`}
            docTitle={estBl ? "BON DE LIVRAISON" : "FACTURE"}
            solde={!estBl && !!c.facture.soldee_le}
            extras={c.extras}
          />
        </div>
      </div>
    </div>
  );
}
