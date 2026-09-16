import { ArrowRight } from "lucide-react";

export default function BatchSelector({ batches, fromDate, toDate, onFromChange, onToChange, loading }) {
  return (
    <div className="mdu-card p-4 mb-6 flex flex-wrap items-center gap-4">
      <div className="text-xs mdu-mono" style={{ color: "var(--paper-dim)" }}>BANDINGKAN</div>
      <div className="flex items-center gap-2">
        <select
          className="mdu-select px-3 py-2 text-sm"
          value={fromDate || ""}
          onChange={(e) => onFromChange(e.target.value)}
        >
          {batches.map((b) => (
            <option key={b.date} value={b.date} disabled={b.date === toDate}>
              {b.date} ({b.total} data)
            </option>
          ))}
        </select>
        <ArrowRight size={14} style={{ color: "var(--gold)" }} />
        <select
          className="mdu-select px-3 py-2 text-sm"
          value={toDate || ""}
          onChange={(e) => onToChange(e.target.value)}
        >
          {batches.map((b) => (
            <option key={b.date} value={b.date} disabled={b.date === fromDate}>
              {b.date} ({b.total} data)
            </option>
          ))}
        </select>
      </div>
      {loading && (
        <span className="mdu-mono text-[11px]" style={{ color: "var(--paper-dim)" }}>
          Memuat perbandingan…
        </span>
      )}
    </div>
  );
}