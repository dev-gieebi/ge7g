import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";

type Tone = "gold" | "purple" | "dark" | "green" | "red";

const tones: Record<Tone, string> = {
  gold: "from-ge7-gold/20 to-ge7-gold-light/10 text-ge7-bronze",
  purple: "from-ge7-purple/15 to-ge7-purple-light/10 text-ge7-purple",
  dark: "from-ge7-black/10 to-ge7-charcoal/5 text-ge7-black",
  green: "from-emerald-500/15 to-emerald-400/5 text-emerald-700",
  red: "from-rose-500/15 to-rose-400/5 text-rose-700",
};

export function KpiCard({
  label,
  value,
  hint,
  trend,
  icon: Icon,
  tone = "gold",
  to,
}: {
  label: string;
  value: string | number;
  hint?: string;
  trend?: number;
  icon: LucideIcon;
  tone?: Tone;
  to?: string;
}) {
  const body = (
    <div className="flex h-full items-start justify-between gap-3 rounded-3xl border border-ge7-black/5 bg-white p-5 shadow-soft transition hover:-translate-y-0.5 hover:border-ge7-gold/50">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-ge7-black/50">{label}</p>
        <p className="mt-2 truncate font-display text-2xl font-extrabold text-ge7-black">{value}</p>
        {(hint || trend !== undefined) && (
          <p className="mt-1 flex items-center gap-1 text-xs text-ge7-black/55">
            {trend !== undefined && (
              <span
                className={`inline-flex items-center gap-0.5 font-semibold ${trend >= 0 ? "text-emerald-600" : "text-rose-600"}`}
              >
                {trend >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                {Math.abs(trend).toFixed(1)} %
              </span>
            )}
            {hint}
          </p>
        )}
      </div>
      <div className={`grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${tones[tone]}`}>
        <Icon size={20} />
      </div>
    </div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}
