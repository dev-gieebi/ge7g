import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

/**
 * Fenêtre de confirmation commune (suppression, désactivation…), à la place
 * du `confirm()` du navigateur :
 *   const confirmer = useConfirmer();
 *   if (await confirmer({ titre: "Supprimer ?", message: "…", bouton: "Supprimer" })) …
 */
export interface DemandeConfirmation {
  titre: string;
  message: ReactNode;
  /** Libellé du bouton de validation (par défaut « Confirmer »). */
  bouton?: string;
  /** Bouton rouge : action destructive (par défaut oui). */
  danger?: boolean;
  /** Simple information (ex. « Impossible de supprimer ») : un seul bouton « OK ». */
  seulementOk?: boolean;
}

type Confirmer = (d: DemandeConfirmation) => Promise<boolean>;

const ConfirmationContext = createContext<Confirmer | null>(null);

export function ConfirmationProvider({ children }: { children: ReactNode }) {
  const [demande, setDemande] = useState<DemandeConfirmation | null>(null);
  const resoudre = useRef<((ok: boolean) => void) | null>(null);

  const confirmer = useCallback<Confirmer>((d) => {
    resoudre.current?.(false);
    setDemande(d);
    return new Promise<boolean>((r) => { resoudre.current = r; });
  }, []);

  const fermer = (ok: boolean) => {
    resoudre.current?.(ok);
    resoudre.current = null;
    setDemande(null);
  };

  return (
    <ConfirmationContext.Provider value={confirmer}>
      {children}
      {demande && (
        <Modal
          title={demande.titre}
          size="sm"
          onClose={() => fermer(false)}
          footer={
            demande.seulementOk ? (
              <Button onClick={() => fermer(false)} autoFocus>OK</Button>
            ) : (
              <>
                <Button variant="secondary" onClick={() => fermer(false)}>Annuler</Button>
                <Button variant={demande.danger === false ? "primary" : "danger"} onClick={() => fermer(true)} autoFocus>{demande.bouton ?? "Confirmer"}</Button>
              </>
            )
          }
        >
          <div className="flex gap-3">
            <AlertTriangle size={20} className={`mt-0.5 shrink-0 ${demande.danger === false ? "text-ge7-bronze" : "text-rose-600"}`} />
            <div className="text-sm text-ge7-black/75">{demande.message}</div>
          </div>
        </Modal>
      )}
    </ConfirmationContext.Provider>
  );
}

export function useConfirmer(): Confirmer {
  const ctx = useContext(ConfirmationContext);
  if (!ctx) throw new Error("useConfirmer doit être utilisé dans ConfirmationProvider");
  return ctx;
}
