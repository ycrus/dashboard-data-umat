import { useState, useMemo } from "react";
import { Stamp, PenLine, MapPin, Filter, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import StampBadge from "./StampBadge.jsx";

export default function LingkunganTable({ data, paroki, totalKey, editedKey, totalLabel, editedLabel, title, description }) {
  const [wilayahFilter, setWilayahFilter] = useState("semua");
  const [sortKey, setSortKey] = useState("lingkungan");
  const [sortDir, setSortDir] = useState("asc");

  const wilayahOptions = useMemo(
    () => Array.from(new Set((data || []).map((l) => l.wilayah))).sort((a, b) => a.localeCompare(b)),
    [data]
  );

  const sortedData = useMemo(() => {
    let list = data || [];
    if (wilayahFilter !== "semua") list = list.filter((l) => l.wilayah === wilayahFilter);
    const dir = sortDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "string") return av.localeCompare(bv) * dir;
      return (av - bv) * dir;
    });
  }, [data, wilayahFilter, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const columns = [
    ["lingkungan", "Lingkungan", "text-left"],
    ["wilayah", "Wilayah", "text-left"],
    [totalKey, totalLabel, "text-right"],
    [editedKey, editedLabel, "text-right"],
    ["persentase", "Persentase", "text-left"],
  ];

  return (
    <>
      {paroki && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <StampBadge label={`Total ${totalLabel}`} count={paroki[totalKey]} color="var(--slate)" Icon={Stamp} />
          <StampBadge label={`${editedLabel} (Paroki)`} count={paroki[editedKey]} color="var(--gold)" Icon={PenLine} />
          <StampBadge label="Persentase Paroki" count={`${paroki.persentase}%`} color="var(--sage)" Icon={MapPin} />
        </div>
      )}

      <div className="mdu-card overflow-hidden">
        <div className="p-4 border-b border-[#384062] flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mdu-mono text-[11px] tracking-widest uppercase" style={{ color: "var(--paper-dim)" }}>
              {title}
            </div>
            <div className="text-xs mt-1" style={{ color: "var(--paper-dim)" }}>
              {description}
            </div>
          </div>
          <div className="mdu-card flex items-center gap-2 px-3 py-1.5 shrink-0">
            <Filter size={12} style={{ color: "var(--paper-dim)" }} />
            <select
              className="bg-transparent outline-none text-xs mdu-mono"
              style={{ color: "var(--paper)" }}
              value={wilayahFilter}
              onChange={(e) => setWilayahFilter(e.target.value)}
            >
              <option value="semua" style={{ color: "#111" }}>Semua Wilayah</option>
              {wilayahOptions.map((w) => (
                <option key={w} value={w} style={{ color: "#111" }}>{w}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="max-h-[560px] overflow-y-auto mdu-scrollbar">
          <table className="w-full text-sm">
            <thead>
              <tr className="mdu-mono text-[11px] uppercase tracking-wider" style={{ color: "var(--paper-dim)" }}>
                {columns.map(([key, label, align]) => (
                  <th
                    key={key}
                    className={`${align} font-normal px-4 py-2 cursor-pointer select-none hover:text-[var(--paper)]`}
                    onClick={() => toggleSort(key)}
                  >
                    <span className={`inline-flex items-center gap-1 ${align === "text-right" ? "flex-row-reverse" : ""}`}>
                      {label}
                      {sortKey === key ? (
                        sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                      ) : (
                        <ChevronsUpDown size={12} style={{ opacity: 0.4 }} />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedData.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center" style={{ color: "var(--paper-dim)" }}>
                    Tidak ada data lingkungan untuk filter ini.
                  </td>
                </tr>
              )}
              {sortedData.map((l) => {
                const barColor =
                  l.persentase >= 66 ? "var(--rust)" : l.persentase >= 33 ? "var(--gold)" : "var(--sage)";
                return (
                  <tr key={l.lingkungan} className="border-t border-[#384062]">
                    <td className="px-4 py-3 font-medium">{l.lingkungan}</td>
                    <td className="px-4 py-3 mdu-mono text-xs" style={{ color: "var(--slate)" }}>{l.wilayah}</td>
                    <td className="px-4 py-3 text-right mdu-mono">{l[totalKey]}</td>
                    <td className="px-4 py-3 text-right mdu-mono">{l[editedKey]}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="mdu-bar-track flex-1">
                          <div
                            className="mdu-bar-fill"
                            style={{ width: `${Math.min(100, l.persentase)}%`, background: barColor }}
                          />
                        </div>
                        <span className="mdu-mono text-xs w-12 text-right" style={{ color: "var(--paper-dim)" }}>
                          {l.persentase}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}