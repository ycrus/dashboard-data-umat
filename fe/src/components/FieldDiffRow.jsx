import { ArrowRight } from "lucide-react";

export default function FieldDiffRow({ field, before, after, itemsAdded, itemsRemoved }) {
  const hasItemDiff = (itemsAdded && itemsAdded.length > 0) || (itemsRemoved && itemsRemoved.length > 0);
  return (
    <div className="text-xs py-1 border-t border-[#384062] first:border-t-0">
      <div className="flex items-start gap-2">
        <span className="mdu-mono w-40 shrink-0" style={{ color: "var(--slate)" }}>{field}</span>
        <span className="line-through" style={{ color: "var(--rust)" }}>
          {before || <em style={{ color: "var(--paper-dim)" }}>kosong</em>}
        </span>
        <ArrowRight size={12} className="mt-0.5 shrink-0" style={{ color: "var(--paper-dim)" }} />
        <span style={{ color: "var(--sage)" }}>
          {after || <em style={{ color: "var(--paper-dim)" }}>kosong</em>}
        </span>
      </div>
      {hasItemDiff && (
        <div className="flex flex-wrap items-center gap-1.5 mt-1 pl-[168px]">
          {itemsRemoved.map((item) => (
            <span
              key={`rm-${item}`}
              className="mdu-mono text-[10px] px-1.5 py-0.5 rounded"
              style={{ color: "var(--rust)", border: "1px solid var(--rust-dim)" }}
            >
              − {item}
            </span>
          ))}
          {itemsAdded.map((item) => (
            <span
              key={`add-${item}`}
              className="mdu-mono text-[10px] px-1.5 py-0.5 rounded"
              style={{ color: "var(--sage)", border: "1px solid var(--sage-dim)" }}
            >
              + {item}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}