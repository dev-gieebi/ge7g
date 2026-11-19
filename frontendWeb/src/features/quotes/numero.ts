/**
 * N° de proforma affiché : « DEV-2026-00004 » (enregistré) → « PF-00004-2026 »,
 * même présentation que les factures.
 */
export const numeroProforma = (n: string) => {
  const parts = n.split("-");
  return parts.length === 3 ? `PF-${parts[2]}-${parts[1]}` : n;
};
