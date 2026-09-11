export function Logo({
  size = 40,
  withText = true,
  light = false,
  className = "",
}: {
  size?: number;
  withText?: boolean;
  light?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <img src="/logo-ge7g.png" alt="G-E7G" width={size} height={size} className="shrink-0 rounded-xl" />
      {withText && (
        <div className="leading-none">
          <p className={`font-display text-lg font-extrabold tracking-tight ${light ? "text-white" : "text-ge7-black"}`}>
            G<span className="text-ge7-gold">-</span>E<span className="text-ge7-purple-light">7</span>G
          </p>
          <p className={`mt-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] ${light ? "text-ge7-gold-light/80" : "text-ge7-bronze"}`}>
            G-ENERGY 7 GROUPE
          </p>
        </div>
      )}
    </div>
  );
}
