import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Printer, Send, CheckCircle2, XCircle } from "lucide-react";
import type { Quote, QuoteStatus } from "@/types";
import { useAction, useOne } from "@/lib/hooks";
import { useAuth } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { Button, ErrorState, Loading, PageHeader, StatusBadge } from "@/components/ui";
import { Devis } from "./Devis";

export function QuoteDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const quote = useOne<Quote>("quote", id ? `/quotes/${id}` : null);
  // Validation / annulation : décision interne (procédure §8).
  const canChangeStatus = hasRole(user, "LG_ADMIN", "DG_ADMIN");

  const setStatus = useAction<{ status: QuoteStatus }, Quote>(
    () => `/quotes/${id}/status`,
    { keys: ["quote", "quotes"], success: "Statut mis à jour", body: (v) => v },
  );

  if (quote.isLoading) return <Loading />;
  if (!quote.data) return <ErrorState message="Devis introuvable" />;
  const q = quote.data;

  return (
    <>
      <div className="no-print">
        <PageHeader
          breadcrumb={
            <Link to="/devis" className="inline-flex items-center gap-1 hover:underline">
              <ArrowLeft size={12} /> Devis
            </Link>
          }
          title={q.number}
          subtitle={<StatusBadge status={q.status} />}
          action={
            <>
              {canChangeStatus && q.status === "BROUILLON" && (
                <Button variant="purple" loading={setStatus.isPending} onClick={() => setStatus.mutate({ status: "ENVOYE" })}>
                  <Send size={15} /> Marquer envoyé
                </Button>
              )}
              {canChangeStatus && (q.status === "BROUILLON" || q.status === "ENVOYE") && (
                <>
                  <Button variant="dark" loading={setStatus.isPending} onClick={() => setStatus.mutate({ status: "VALIDE" })}>
                    <CheckCircle2 size={15} /> Valider
                  </Button>
                  <Button variant="secondary" loading={setStatus.isPending} onClick={() => setStatus.mutate({ status: "ANNULE" })}>
                    <XCircle size={15} /> Annuler
                  </Button>
                </>
              )}
              <Button onClick={() => window.print()}><Printer size={15} /> Imprimer</Button>
            </>
          }
        />
      </div>
      <Devis quote={q} />
      <div className="no-print mt-6 text-center"><Link to="/devis"><Button variant="purple">Retour aux devis</Button></Link></div>
    </>
  );
}
