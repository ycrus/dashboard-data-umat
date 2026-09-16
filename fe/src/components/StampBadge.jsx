export default function StampBadge({ label, count, color, Icon }) {
  return (
    <div className="mdu-card p-4 flex items-center gap-4">
      <div className="mdu-stamp w-16 h-16 shrink-0 flex flex-col items-center justify-center" style={{ color }}>
        <Icon size={16} />
        <span className="mdu-mono text-lg font-semibold leading-none mt-1">
          {count ?? "–"}
        </span>
      </div>
      <div className="mdu-mono text-[11px] tracking-widest uppercase" style={{ color: "var(--paper-dim)" }}>
        {label}
      </div>
    </div>
  );
}