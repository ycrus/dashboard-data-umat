import React, { useState, useMemo, useEffect, useCallback } from "react";
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
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Search,
  ArrowRight,
  Plus,
  Minus,
  PenLine,
  Stamp,
  BookOpen,
  AlertTriangle,
  MapPin,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Filter,
  Download,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* API helper                                                          */
/* ------------------------------------------------------------------ */

async function fetchJSON(url) {
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || `Gagal memuat ${url} (status ${res.status})`);
  }
  return body;
}

/* ------------------------------------------------------------------ */
/* UI bits                                                             */
/* ------------------------------------------------------------------ */

const STYLE = `
  .mdu-root {
    --ink-900:#1C2333; --ink-800:#242C40; --panel:#242C40; --panel-2:#2B3450;
    --paper:#EDE7D6; --paper-dim:#B7B2A0;
    --gold:#C9A24B; --gold-dim:#8A7238;
    --sage:#7DA187; --sage-dim:#3E5445;
    --rust:#C06B4C; --rust-dim:#5A3428;
    --slate:#7E9BB8;
    font-family: 'IBM Plex Sans', sans-serif;
    background: var(--ink-900);
    color: var(--paper);
    min-height: 100%;
  }
  .mdu-display { font-family: 'Fraunces', serif; }
  .mdu-mono { font-family: 'IBM Plex Mono', monospace; }
  .mdu-card { background: var(--panel); border: 1px solid #384062; border-radius: 4px; }
  .mdu-stamp {
    border: 2px solid currentColor; border-radius: 999px; transform: rotate(-4deg);
    letter-spacing: 0.08em; font-family: 'IBM Plex Mono', monospace;
  }
  .mdu-tab { border-bottom: 2px solid transparent; cursor: pointer; transition: border-color .15s ease, color .15s ease; }
  .mdu-tab[data-active="true"] { border-bottom-color: var(--gold); color: var(--paper); }
  .mdu-tab[data-active="false"] { color: var(--paper-dim); }
  .mdu-tab:hover { color: var(--paper); }
  .mdu-row-added { border-left: 3px solid var(--sage); }
  .mdu-row-removed { border-left: 3px solid var(--rust); }
  .mdu-row-modified { border-left: 3px solid var(--gold); }
  .mdu-select { background: var(--panel-2); border: 1px solid #40496A; color: var(--paper); border-radius: 4px; font-family: 'IBM Plex Mono', monospace; }
  .mdu-input { background: var(--panel-2); border: 1px solid #40496A; color: var(--paper); border-radius: 4px; }
  .mdu-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
  .mdu-scrollbar::-webkit-scrollbar-thumb { background: #40496A; border-radius: 4px; }
  .mdu-scrollbar::-webkit-scrollbar-track { background: transparent; }
  .mdu-spin { animation: mdu-spin 1s linear infinite; }
  @keyframes mdu-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  .mdu-bar-track { background: #1C2333; border-radius: 999px; overflow: hidden; height: 6px; }
  .mdu-bar-fill { height: 100%; border-radius: 999px; }
  .mdu-toplevel-tab {
    cursor: pointer; padding: 8px 14px; border-radius: 4px 4px 0 0;
    border: 1px solid #384062; border-bottom: none;
    font-family: 'IBM Plex Mono', monospace; font-size: 12px; letter-spacing: 0.04em;
  }
  .mdu-toplevel-tab[data-active="true"] { background: var(--panel); color: var(--paper); }
  .mdu-toplevel-tab[data-active="false"] { background: transparent; color: var(--paper-dim); }
`;

function StampBadge({ label, count, color, Icon }) {
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

function FieldDiffRow({ field, before, after, itemsAdded, itemsRemoved }) {
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

function LingkunganTable({ data, paroki, totalKey, editedKey, totalLabel, editedLabel, title, description }) {
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

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

const DEFAULT_API_BASE = "http://localhost:4000/api";

export default function MonitoringDataUmat() {
  const [apiBase, setApiBase] = useState(DEFAULT_API_BASE);
  const [apiBaseInput, setApiBaseInput] = useState(DEFAULT_API_BASE);

  const [batches, setBatches] = useState([]);
  const [batchesState, setBatchesState] = useState("idle"); // idle | loading | error | ready
  const [batchesError, setBatchesError] = useState(null);

  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);

  const [diffData, setDiffData] = useState(null);
  const [diffState, setDiffState] = useState("idle");
  const [diffError, setDiffError] = useState(null);

  const [trendData, setTrendData] = useState([]);
  const [trendState, setTrendState] = useState("idle");

  const [filterType, setFilterType] = useState("semua");
  const [search, setSearch] = useState("");
  const [wilayahFilterPerubahan, setWilayahFilterPerubahan] = useState("semua");
  const [lingkunganFilterPerubahan, setLingkunganFilterPerubahan] = useState("semua");

  const [activeTab, setActiveTab] = useState("perubahan"); // perubahan | kk | umat

  const [summaryData, setSummaryData] = useState(null); // { kk: {paroki, lingkungan}, umat: {paroki, lingkungan} }
  const [summaryState, setSummaryState] = useState("idle");
  const [summaryError, setSummaryError] = useState(null);

  const loadBatches = useCallback(async (base) => {
    setBatchesState("loading");
    setBatchesError(null);
    try {
      const data = await fetchJSON(`${base}/batches`);
      const list = data.batches || [];
      setBatches(list);
      if (list.length >= 2) {
        setFromDate(list[list.length - 2].date);
        setToDate(list[list.length - 1].date);
      }
      setBatchesState("ready");
    } catch (err) {
      setBatchesError(err.message);
      setBatchesState("error");
    }
  }, []);

  const loadTrend = useCallback(async (base) => {
    setTrendState("loading");
    try {
      const data = await fetchJSON(`${base}/trend`);
      setTrendData(data.trend || []);
      setTrendState("ready");
    } catch (err) {
      setTrendState("error");
    }
  }, []);

  useEffect(() => {
    loadBatches(apiBase);
    loadTrend(apiBase);
  }, [apiBase, loadBatches, loadTrend]);

  useEffect(() => {
    if (!fromDate || !toDate) return;
    let cancelled = false;
    setDiffState("loading");
    setDiffError(null);
    fetchJSON(`${apiBase}/diff?from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}`)
      .then((data) => {
        if (cancelled) return;
        setDiffData(data);
        setDiffState("ready");
        setWilayahFilterPerubahan("semua");
        setLingkunganFilterPerubahan("semua");
      })
      .catch((err) => {
        if (cancelled) return;
        setDiffError(err.message);
        setDiffState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [apiBase, fromDate, toDate]);

  useEffect(() => {
    if (!fromDate || !toDate) return;
    let cancelled = false;
    setSummaryState("loading");
    setSummaryError(null);
    fetchJSON(`${apiBase}/lingkungan-summary?from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}`)
      .then((data) => {
        if (cancelled) return;
        setSummaryData(data);
        setSummaryState("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setSummaryError(err.message);
        setSummaryState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [apiBase, fromDate, toDate]);

  const fieldChangeCounts = useMemo(() => {
    if (!diffData) return [];
    const counts = new Map();
    diffData.modified.forEach((m) => {
      m.changes.forEach((c) => {
        counts.set(c.field, (counts.get(c.field) || 0) + 1);
      });
    });
    return Array.from(counts.entries())
      .map(([field, count]) => ({ field, count }))
      .sort((a, b) => b.count - a.count);
  }, [diffData]);

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
    if (wilayahFilterPerubahan !== "semua") {
      list = list.filter((item) => item.row?.wilayah === wilayahFilterPerubahan);
    }
    if (lingkunganFilterPerubahan !== "semua") {
      list = list.filter((item) => item.row?.lingkungan === lingkunganFilterPerubahan);
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
  }, [diffData, filterType, search, wilayahFilterPerubahan, lingkunganFilterPerubahan]);

  const allPerubahanRows = useMemo(() => {
    if (!diffData) return [];
    return [
      ...diffData.added,
      ...diffData.removed,
      ...diffData.modified.map((m) => m.row),
    ];
  }, [diffData]);

  const wilayahOptionsPerubahan = useMemo(
    () => Array.from(new Set(allPerubahanRows.map((r) => r.wilayah).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [allPerubahanRows]
  );

  const lingkunganOptionsPerubahan = useMemo(() => {
    const rows =
      wilayahFilterPerubahan === "semua"
        ? allPerubahanRows
        : allPerubahanRows.filter((r) => r.wilayah === wilayahFilterPerubahan);
    return Array.from(new Set(rows.map((r) => r.lingkungan).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [allPerubahanRows, wilayahFilterPerubahan]);

  const reconnect = () => setApiBase(apiBaseInput.trim());

  const handleDownloadReportPdf = () => {
    if (!diffData) return;
    const doc = new jsPDF();
    const clean = (s) => String(s).replace(/→/g, "-").replace(/·/g, "-");

    doc.setFontSize(14);
    doc.text("Laporan Perubahan Data Umat", 14, 16);
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text(clean(`Rentang: ${fromDate} - ${toDate}`), 14, 22);
    doc.setTextColor(0);

    // Ringkasan perubahan
    autoTable(doc, {
      startY: 28,
      head: [["Total (tujuan)", "Baru", "Diubah", "Dihapus"]],
      body: [[
        diffData.summary.total,
        diffData.summary.baru,
        diffData.summary.diubah,
        diffData.summary.dihapus,
      ]],
      styles: { fontSize: 10, halign: "center" },
      headStyles: { fillColor: [28, 35, 51] },
    });

    let nextY = doc.lastAutoTable.finalY + 10;

    // Tabel KK per Lingkungan
    if (summaryData?.kk) {
      doc.setFontSize(11);
      doc.text("KK Di Update per Lingkungan", 14, nextY);
      nextY += 4;
      doc.setFontSize(8);
      doc.setTextColor(110);
      const kkParoki = summaryData.kk.paroki;
      doc.text(
        clean(`Total KK: ${kkParoki.jumlah_kk}  -  KK Di Update: ${kkParoki.kk_diedit}  -  Persentase: ${kkParoki.persentase}%`),
        14,
        nextY
      );
      doc.setTextColor(0);
      nextY += 4;

      autoTable(doc, {
        startY: nextY,
        head: [["Lingkungan", "Wilayah", "Jumlah KK", "KK Di Update", "Persentase"]],
        body: summaryData.kk.lingkungan.map((l) => [
          l.lingkungan,
          l.wilayah,
          l.jumlah_kk,
          l.kk_diedit,
          `${l.persentase}%`,
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [28, 35, 51] },
      });

      nextY = doc.lastAutoTable.finalY + 10;
    }

    // Tabel Umat per Lingkungan
    if (summaryData?.umat) {
      if (nextY > 250) {
        doc.addPage();
        nextY = 16;
      }
      doc.setFontSize(11);
      doc.text("Umat Di Update per Lingkungan", 14, nextY);
      nextY += 4;
      doc.setFontSize(8);
      doc.setTextColor(110);
      const umatParoki = summaryData.umat.paroki;
      doc.text(
        clean(`Total Umat: ${umatParoki.jumlah_umat}  -  Umat Di Update: ${umatParoki.umat_diedit}  -  Persentase: ${umatParoki.persentase}%`),
        14,
        nextY
      );
      doc.setTextColor(0);
      nextY += 4;

      autoTable(doc, {
        startY: nextY,
        head: [["Lingkungan", "Wilayah", "Jumlah Umat", "Umat Di Update", "Persentase"]],
        body: summaryData.umat.lingkungan.map((l) => [
          l.lingkungan,
          l.wilayah,
          l.jumlah_umat,
          l.umat_diedit,
          `${l.persentase}%`,
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [28, 35, 51] },
      });
    }

    doc.save(`laporan-perubahan-data-umat_${fromDate}_${toDate}.pdf`);
  };

  return (
    <div className="mdu-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
        ${STYLE}
      `}</style>

      <div className="max-w-6xl mx-auto px-5 py-8">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="mdu-stamp w-12 h-12 flex items-center justify-center shrink-0 mt-1" style={{ color: "var(--gold)" }}>
              <BookOpen size={20} />
            </div>
            <div>
              <h1 className="mdu-display text-2xl font-semibold" style={{ color: "var(--paper)" }}>
                Sistem Monitoring Perubahan Data Umat
              </h1>
            </div>
          </div>
        </div>

        {batchesState === "error" && (
          <div className="mdu-card p-4 mb-6 text-sm flex items-start gap-2" style={{ borderColor: "var(--rust)", color: "var(--rust)" }}>
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <div>
              <div>Gagal terhubung ke API: {batchesError}</div>
              <div className="text-xs mt-1" style={{ color: "var(--paper-dim)" }}>
                Pastikan server backend berjalan (npm start di folder backend), dan CORS_ORIGIN di .env
                mengizinkan origin halaman ini.
              </div>
            </div>
          </div>
        )}

        {batchesState === "ready" && batches.length < 2 && (
          <div className="mdu-card p-6 text-sm" style={{ color: "var(--paper-dim)" }}>
            API terhubung, tapi baru ada {batches.length} tanggal import di tabel. Perlu minimal dua
            tanggal berbeda untuk membandingkan perubahan.
          </div>
        )}

        {batchesState === "ready" && batches.length >= 2 && (
          <>
            {/* Top-level tabs */}
            <div className="flex items-end gap-1 -mb-px relative z-10">
              <div
                className="mdu-toplevel-tab flex items-center gap-1.5"
                data-active={activeTab === "perubahan"}
                onClick={() => setActiveTab("perubahan")}
              >
                <BookOpen size={12} /> Perubahan Data
              </div>
              <div
                className="mdu-toplevel-tab flex items-center gap-1.5"
                data-active={activeTab === "kk"}
                onClick={() => setActiveTab("kk")}
              >
                <MapPin size={12} /> Monitoring KK Lingkungan
              </div>
              <div
                className="mdu-toplevel-tab flex items-center gap-1.5"
                data-active={activeTab === "umat"}
                onClick={() => setActiveTab("umat")}
              >
                <MapPin size={12} /> Monitoring Umat Lingkungan
              </div>
            </div>

            {/* Batch selector */}
            <div className="mdu-card p-4 mb-6 flex flex-wrap items-center gap-4">
              <div className="text-xs mdu-mono" style={{ color: "var(--paper-dim)" }}>BANDINGKAN</div>
              <div className="flex items-center gap-2">
                <select
                  className="mdu-select px-3 py-2 text-sm"
                  value={fromDate || ""}
                  onChange={(e) => setFromDate(e.target.value)}
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
                  onChange={(e) => setToDate(e.target.value)}
                >
                  {batches.map((b) => (
                    <option key={b.date} value={b.date} disabled={b.date === fromDate}>
                      {b.date} ({b.total} data)
                    </option>
                  ))}
                </select>
              </div>
              {diffState === "loading" && (
                <span className="mdu-mono text-[11px]" style={{ color: "var(--paper-dim)" }}>
                  Memuat perbandingan…
                </span>
              )}
            </div>

            {activeTab === "perubahan" && diffState === "error" && (
              <div className="mdu-card p-4 mb-6 text-sm" style={{ borderColor: "var(--rust)", color: "var(--rust)" }}>
                {diffError}
              </div>
            )}

            {activeTab === "perubahan" && diffData && diffState === "ready" && (
              <>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="mdu-mono text-[11px] tracking-widest uppercase" style={{ color: "var(--paper-dim)" }}>
                    Ringkasan Perubahan
                  </div>
                  <button
                    onClick={handleDownloadReportPdf}
                    className="mdu-card flex items-center gap-2 px-3 py-1.5 text-xs hover:border-[var(--gold)]"
                    style={{ color: "var(--paper-dim)" }}
                    title="Unduh ringkasan, tabel KK, dan tabel Umat per lingkungan sebagai satu PDF"
                  >
                    <Download size={12} />
                    Unduh Laporan PDF
                  </button>
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
                        value={wilayahFilterPerubahan}
                        onChange={(e) => {
                          setWilayahFilterPerubahan(e.target.value);
                          setLingkunganFilterPerubahan("semua");
                        }}
                      >
                        <option value="semua" style={{ color: "#111" }}>Semua Wilayah</option>
                        {wilayahOptionsPerubahan.map((w) => (
                          <option key={w} value={w} style={{ color: "#111" }}>{w}</option>
                        ))}
                      </select>
                    </div>
                    <div className="mdu-card flex items-center gap-2 px-3 py-1.5">
                      <Filter size={12} style={{ color: "var(--paper-dim)" }} />
                      <select
                        className="bg-transparent outline-none text-xs mdu-mono"
                        style={{ color: "var(--paper)" }}
                        value={lingkunganFilterPerubahan}
                        onChange={(e) => setLingkunganFilterPerubahan(e.target.value)}
                      >
                        <option value="semua" style={{ color: "#111" }}>Semua Lingkungan</option>
                        {lingkunganOptionsPerubahan.map((l) => (
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
            )}

            {(activeTab === "kk" || activeTab === "umat") && summaryState === "error" && (
              <div className="mdu-card p-4 mb-6 text-sm" style={{ borderColor: "var(--rust)", color: "var(--rust)" }}>
                {summaryError}
              </div>
            )}

            {(activeTab === "kk" || activeTab === "umat") && summaryState === "loading" && (
              <div className="mdu-card p-6 text-sm" style={{ color: "var(--paper-dim)" }}>
                Memuat ringkasan lingkungan…
              </div>
            )}

            {activeTab === "kk" && summaryData && summaryState === "ready" && (
              <LingkunganTable
                data={summaryData.kk.lingkungan}
                paroki={summaryData.kk.paroki}
                totalKey="jumlah_kk"
                editedKey="kk_diedit"
                totalLabel="KK"
                editedLabel="KK Di Update"
                title={`KK Di Update per Lingkungan · ${fromDate} → ${toDate}`}
                description={
                  <>
                    Satu KK dihitung "di update" jika <strong>semua</strong> anggota keluarganya baru
                    ditambahkan atau datanya berubah pada rentang tanggal ini — kalau ada satu saja
                    anggota yang tidak berubah, KK tersebut tidak dihitung.
                  </>
                }
              />
            )}

            {activeTab === "umat" && summaryData && summaryState === "ready" && (
              <LingkunganTable
                data={summaryData.umat.lingkungan}
                paroki={summaryData.umat.paroki}
                totalKey="jumlah_umat"
                editedKey="umat_diedit"
                totalLabel="Umat"
                editedLabel="Umat Di Update"
                title={`Umat Di Update per Lingkungan · ${fromDate} → ${toDate}`}
                description={
                  <>
                    Dihitung per orang: setiap umat yang datanya baru ditambahkan atau berubah pada
                    rentang tanggal ini dihitung sendiri-sendiri, tidak digabung per KK.
                  </>
                }
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}