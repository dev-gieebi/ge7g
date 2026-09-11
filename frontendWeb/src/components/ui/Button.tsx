import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "purple" | "dark";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-gradient-to-r from-ge7-bronze via-ge7-gold to-ge7-gold-light text-ge7-black shadow-gold hover:brightness-105",
  purple:
    "bg-gradient-to-r from-ge7-purple to-ge7-purple-light text-white shadow-purple hover:brightness-105",
  dark: "bg-ge7-black text-ge7-gold-light hover:bg-ge7-charcoal",
  secondary:
    "border border-ge7-black/10 bg-white text-ge7-black hover:border-ge7-gold hover:bg-ge7-gold-soft/40",
  ghost: "text-ge7-black/70 hover:bg-ge7-black/5",
  danger: "bg-rose-600 text-white hover:bg-rose-700",
};

const sizes: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs rounded-lg",
  md: "px-4 py-2.5 text-sm rounded-xl",
  lg: "px-5 py-3 text-base rounded-2xl",
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  className = "",
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  );
}
