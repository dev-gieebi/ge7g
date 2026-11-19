import { useEffect, useState, type InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: number;
  /** Appelé uniquement avec une valeur acceptée par `valide`. */
  onValue: (n: number) => void;
  /** Valeur retenue ? Par défaut : strictement positive. */
  valide?: (n: number) => boolean;
};

/**
 * Champ numérique qui peut rester vide le temps de la saisie : effacer le
 * chiffre pour en taper un autre ne remet pas la valeur à 0 (ce qui
 * supprimait la ligne). Seule une valeur valide est transmise ; en quittant
 * le champ vide ou invalide, la dernière valeur retenue réapparaît.
 */
export function NumberField({ value, onValue, valide = (n) => n > 0, onBlur, ...props }: Props) {
  const [saisie, setSaisie] = useState(String(value));

  // Valeur changée ailleurs (boutons + / −) : on l'affiche, sans écraser une saisie équivalente (« 1. »).
  useEffect(() => {
    setSaisie((s) => (s !== "" && Number(s.replace(",", ".")) === value ? s : String(value)));
  }, [value]);

  return (
    <input
      {...props}
      type="number"
      inputMode="decimal"
      value={saisie}
      onChange={(e) => {
        setSaisie(e.target.value);
        const n = Number(e.target.value.replace(",", "."));
        if (e.target.value.trim() !== "" && Number.isFinite(n) && valide(n)) onValue(n);
      }}
      onBlur={(e) => {
        setSaisie(String(value));
        onBlur?.(e);
      }}
    />
  );
}
