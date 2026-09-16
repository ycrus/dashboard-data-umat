import { useState, useMemo, useEffect } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
} from "recharts";
import { Search, ArrowRight, Plus, Minus, PenLine, Stamp, Filter, Download, FileSpreadsheet } from "lucide-react";
import StampBadge from "./StampBadge.jsx";
import FieldDiffRow from "./FieldDiffRow.jsx";
import { computeFieldChangeCounts } from "../lib/fieldChangeCounts.js";
import { generateChangesExcel } from "../lib/generateChangesExcel.js";

export default function PerubahanDataPanel({ diffData, trendData, fromDate, toDate, onDownloadPdf, onDownloadExcel }) {
  const [filterType, setFilterType] = useState("semua");
  const [search, setSearch] = useState("");
  const [wilayahFilter, setWilayahFilter] = useState("semua");
  const [lingkunganFilter, setLingkunganFilter] = useState("semua");

  // Reset filter setiap kali data perbandingan baru datang (ganti tanggal),
  // supaya tidak nyangkut nunjukin kosong.
  useEffect(() => {
    setWilayahFilter("semua");
    setLingkunganFilter("semua");
  }, [diffData]);

  const fieldChangeCounts = useMemo(() => computeFieldChangeCounts(diffData), [diffData]);

  const allRows = useMemo(() => {
    if (!diffData) return [];
    return [...diffData.added, ...diffData.removed, ...diffData.modified.map((m) => m.row)];
  }, [diffData]);

  const wilayahOptions = useMemo(
    () => Array.from(new Set(allRows.map((r) => r.wilayah).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [allRows]
  );

  const lingkunganOptions = useMemo(() => {
    const rows = wilayahFilter === "semua" ? allRows : allRows.filter((r) => r.wilayah === wilayahFilter);
    return Array.from(new Set(rows.map((r) => r.lingkungan).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [allRows, wilayahFilter]);

  const filteredList = useMemo(() => {
    if (!diffData) return [];
    let list = [];
    if (filterType === "semua" || filterType === "baru") {
      list = list.concat(diffData.added.map((row) => ({ type: "baru", row })));
    }
    if (filterType === "semua" || filterType === "diubah") {
      list = list.concat(diffData.modified.map((m) => ({ type: "diubah", ...m })));
    }
    if (filterType === "semua" || filterType === "dihapus") {
      list = list.concat(diffData.removed.map((row) => ({ type: "dihapus", row })));
    }
    if (wilayahFilter !== "semua") {
      list = list.filter((item) => item.row?.wilayah === wilayahFilter);
    }
    if (lingkunganFilter !== "semua") {
      list = list.filter((item) => item.row?.lingkungan === lingkunganFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (item) =>
          (item.row?.nama || "").toLowerCase().includes(q) ||
          (item.row?.["No. KK"] || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [diffData, filterType, search, wilayahFilter, lingkunganFilter]);

  const filteredModifiedForExport = useMemo(() => {
    if (!diffData) return [];
    let list = diffData.modified;
    if (wilayahFilter !== "semua") {
      list = list.filter((m) => m.row?.wilayah === wilayahFilter);
    }
    if (lingkunganFilter !== "semua") {
      list = list.filter((m) => m.row?.lingkungan === lingkunganFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (m) =>
          (m.row?.nama || "").toLowerCase().includes(q) ||
          (m.row?.["No. KK"] || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [diffData, wilayahFilter, lingkunganFilter, search]);

  const handleDownloadChangesExcel = () => {
    generateChangesExcel({
      modifiedList: filteredModifiedForExport,
      fromDate,
      toDate,
      wilayahFilter,
      lingkunganFilter,
    });
  };

  if (!diffData) return null;

  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="mdu-mono text-[11px] tracking-widest uppercase" style={{ color: "var(--paper-dim)" }}>
          Ringkasan Perubahan
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onDownloadPdf}
            className="mdu-card flex items-center gap-2 px-3 py-1.5 text-xs hover:border-[var(--gold)]"
            style={{ color: "var(--paper-dim)" }}
            title="Unduh ringkasan, kolom paling banyak diubah, tabel KK, dan tabel Umat per lingkungan sebagai satu PDF"
          >
            <Download size={12} />
            Unduh PDF
          </button>
          <button
            onClick={onDownloadExcel}
            className="mdu-card flex items-center gap-2 px-3 py-1.5 text-xs hover:border-[var(--gold)]"
            style={{ color: "var(--paper-dim)" }}
            title="Unduh data yang sama dalam beberapa sheet Excel"
          >
            <FileSpreadsheet size={12} />
            Unduh Excel
          </button>
        </div>
      </div>

      {/* Summary stamps */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StampBadge label="Total (tujuan)" count={diffData.summary.total} color="var(--slate)" Icon={Stamp} />
        <StampBadge label="Baru" count={diffData.summary.baru} color="var(--sage)" Icon={Plus} />
        <StampBadge label="Diubah" count={diffData.summary.diubah} color="var(--gold)" Icon={PenLine} />
        <StampBadge label="Dihapus" count={diffData.summary.dihapus} color="var(--rust)" Icon={Minus} />
      </div>

      {/* Trend chart */}
      {trendData.length > 0 && (
        <div className="mdu-card p-4 mb-6">
          <div className="mdu-mono text-[11px] tracking-widest uppercase mb-3" style={{ color: "var(--paper-dim)" }}>
            Tren Jumlah Data per Tanggal Import
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={trendData} margin={{ left: -10, right: 10, top: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#384062" />
              <XAxis dataKey="date" tick={{ fill: "#B7B2A0", fontSize: 11 }} axisLine={{ stroke: "#40496A" }} tickLine={false} />
              <YAxis tick={{ fill: "#B7B2A0", fontSize: 11 }} axisLine={{ stroke: "#40496A" }} tickLine={false} />
              <RTooltip contentStyle={{ background: "#2B3450", border: "1px solid #40496A", borderRadius: 4, fontSize: 12 }} labelStyle={{ color: "#EDE7D6" }} />
              <Bar dataKey="baru" stackId="chg" fill="#7DA187" radius={[2, 2, 0, 0]} name="Baru" />
              <Bar dataKey="diubah" stackId="chg" fill="#C9A24B" name="Diubah" />
              <Bar dataKey="dihapus" stackId="chg" fill="#C06B4C" name="Dihapus" />
              <Line type="monotone" dataKey="total" stroke="#EDE7D6" strokeWidth={2} dot={{ r: 3, fill: "#EDE7D6" }} name="Total" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Kolom paling sering diubah */}
      {fieldChangeCounts.length > 0 && (
        <div className="mdu-card p-4 mb-6">
          <div className="mdu-mono text-[11px] tracking-widest uppercase mb-3" style={{ color: "var(--paper-dim)" }}>
            Kolom Paling Banyak Diubah
          </div>
          <ResponsiveContainer width="100%" height={Math.max(160, fieldChangeCounts.slice(0, 10).length * 34)}>
            <BarChart
              data={fieldChangeCounts.slice(0, 10)}
              layout="vertical"
              margin={{ left: 10, right: 20, top: 5, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#384062" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fill: "#B7B2A0", fontSize: 11 }} axisLine={{ stroke: "#40496A" }} tickLine={false} />
              <YAxis
                type="category"
                dataKey="field"
                width={140}
                tick={{ fill: "#EDE7D6", fontSize: 11 }}
                axisLine={{ stroke: "#40496A" }}
                tickLine={false}
              />
              <RTooltip
                contentStyle={{ background: "#2B3450", border: "1px solid #40496A", borderRadius: 4, fontSize: 12 }}
                labelStyle={{ color: "#EDE7D6" }}
                formatter={(value) => [value, "Jumlah diubah"]}
              />
              <Bar dataKey="count" fill="#C9A24B" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
          {fieldChangeCounts.length > 10 && (
            <div className="text-xs mt-2" style={{ color: "var(--paper-dim)" }}>
              Menampilkan 10 kolom teratas dari {fieldChangeCounts.length} kolom yang pernah berubah.
            </div>
          )}
        </div>
      )}

      {/* Filter tabs + search */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-5 text-sm mdu-display">
          {[
            ["semua", "Semua"],
            ["baru", `Baru (${diffData.summary.baru})`],
            ["diubah", `Diubah (${diffData.summary.diubah})`],
            ["dihapus", `Dihapus (${diffData.summary.dihapus})`],
          ].map(([key, label]) => (
            <div key={key} className="mdu-tab pb-1" data-active={filterType === key} onClick={() => setFilterType(key)}>
              {label}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="mdu-card flex items-center gap-2 px-3 py-1.5">
            <Filter size={12} style={{ color: "var(--paper-dim)" }} />
            <select
              className="bg-transparent outline-none text-xs mdu-mono"
              style={{ color: "var(--paper)" }}
              value={wilayahFilter}
              onChange={(e) => {
                setWilayahFilter(e.target.value);
                setLingkunganFilter("semua");
              }}
            >
              <option value="semua" style={{ color: "#111" }}>Semua Wilayah</option>
              {wilayahOptions.map((w) => (
                <option key={w} value={w} style={{ color: "#111" }}>{w}</option>
              ))}
            </select>
          </div>
          <div className="mdu-card flex items-center gap-2 px-3 py-1.5">
            <Filter size={12} style={{ color: "var(--paper-dim)" }} />
            <select
              className="bg-transparent outline-none text-xs mdu-mono"
              style={{ color: "var(--paper)" }}
              value={lingkunganFilter}
              onChange={(e) => setLingkunganFilter(e.target.value)}
            >
              <option value="semua" style={{ color: "#111" }}>Semua Lingkungan</option>
              {lingkunganOptions.map((l) => (
                <option key={l} value={l} style={{ color: "#111" }}>{l}</option>
              ))}
            </select>
          </div>
          <div className="mdu-card flex items-center gap-2 px-3 py-1.5">
            <Search size={13} style={{ color: "var(--paper-dim)" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama atau No. KK"
              className="bg-transparent outline-none text-xs w-44"
              style={{ color: "var(--paper)" }}
            />
          </div>
          <button
            onClick={handleDownloadChangesExcel}
            disabled={filteredModifiedForExport.length === 0}
            className="mdu-card flex items-center gap-2 px-3 py-1.5 text-xs hover:border-[var(--gold)] disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ color: "var(--paper-dim)" }}
            title="Unduh daftar Diubah (nama, kolom, sebelum, sesudah) sesuai filter Wilayah/Lingkungan di atas — Excel"
          >
            <FileSpreadsheet size={12} />
            Unduh Perubahan
          </button>
        </div>
      </div>

      {/* Change list */}
      <div className="mdu-card divide-y divide-[#384062] max-h-[520px] overflow-y-auto mdu-scrollbar">
        {filteredList.length === 0 && (
          <div className="p-6 text-sm text-center" style={{ color: "var(--paper-dim)" }}>
            Tidak ada perubahan pada kategori ini.
          </div>
        )}
        {filteredList.map((item, idx) => {
          if (item.type === "baru") {
            return (
              <div key={idx} className="mdu-row-added p-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">{item.row.nama}</div>
                  <div className="mdu-mono text-[11px]" style={{ color: "var(--paper-dim)" }}>
                    KK {item.row["No. KK"]} · {item.row.lingkungan} · {item.row.wilayah}
                  </div>
                </div>
                <span className="mdu-mono text-[10px] px-2 py-1 rounded-full" style={{ color: "var(--sage)", border: "1px solid var(--sage-dim)" }}>
                  BARU
                </span>
              </div>
            );
          }
          if (item.type === "dihapus") {
            return (
              <div key={idx} className="mdu-row-removed p-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium" style={{ color: "var(--paper-dim)" }}>{item.row.nama}</div>
                  <div className="mdu-mono text-[11px]" style={{ color: "var(--paper-dim)" }}>
                    KK {item.row["No. KK"]} · {item.row.lingkungan} · {item.row.wilayah}
                  </div>
                </div>
                <span className="mdu-mono text-[10px] px-2 py-1 rounded-full" style={{ color: "var(--rust)", border: "1px solid var(--rust-dim)" }}>
                  DIHAPUS
                </span>
              </div>
            );
          }
          return (
            <div key={idx} className="mdu-row-modified p-4">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div>
                  <div className="text-sm font-medium">{item.row.nama}</div>
                  <div className="mdu-mono text-[11px]" style={{ color: "var(--paper-dim)" }}>
                    KK {item.row["No. KK"]} · {item.changes.length} kolom berubah · {item.row.lingkungan} · {item.row.wilayah}
                  </div>
                </div>
                <span className="mdu-mono text-[10px] px-2 py-1 rounded-full" style={{ color: "var(--gold)", border: "1px solid var(--gold-dim)" }}>
                  DIUBAH
                </span>
              </div>
              <div>
                {item.changes.map((c) => (
                  <FieldDiffRow
                    key={c.field}
                    field={c.field}
                    before={c.before}
                    after={c.after}
                    itemsAdded={c.itemsAdded}
                    itemsRemoved={c.itemsRemoved}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}