import { useState, useEffect, useCallback } from "react";

import "./theme.css";
import { fetchJSON } from "./lib/fetchJSON.js";
import { generateReportPdf } from "./lib/generateReportPdf.js";
import { generateReportExcel } from "./lib/generateReportExcel.js";
import AppHeader from "./layout/AppHeader.jsx";
import TabBar from "./layout/TabBar.jsx";
import BatchSelector from "./layout/BatchSelector.jsx";
import LingkunganTable from "./components/LingkunganTable.jsx";
import PerubahanDataPanel from "./components/PerubahanDataPanel.jsx";

const DEFAULT_API_BASE = "http://localhost:4000/api";

export default function MonitoringDataUmat() {
  const [apiBase, setApiBase] = useState(DEFAULT_API_BASE);

  const [batches, setBatches] = useState([]);
  const [batchesState, setBatchesState] = useState("idle"); // idle | loading | error | ready
  const [batchesError, setBatchesError] = useState(null);

  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);

  const [diffData, setDiffData] = useState(null);
  const [diffState, setDiffState] = useState("idle");
  const [diffError, setDiffError] = useState(null);

  const [trendData, setTrendData] = useState([]);

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
    try {
      const data = await fetchJSON(`${base}/trend`);
      setTrendData(data.trend || []);
    } catch {
      // Grafik tren bersifat pelengkap — kegagalan di sini tidak perlu
      // memblokir sisa dashboard, cukup diabaikan.
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

  const handleDownloadReportPdf = () => {
    generateReportPdf({ diffData, summaryData, fromDate, toDate });
  };

  const handleDownloadReportExcel = () => {
    generateReportExcel({ diffData, summaryData, fromDate, toDate });
  };

  return (
    <div className="mdu-root">
      <div className="max-w-6xl mx-auto px-5 py-8">
        <AppHeader />

        {batchesState === "error" && (
          <div className="mdu-card p-4 mb-6 text-sm" style={{ borderColor: "var(--rust)", color: "var(--rust)" }}>
            <div>Gagal terhubung ke API: {batchesError}</div>
            <div className="text-xs mt-1" style={{ color: "var(--paper-dim)" }}>
              Pastikan server backend berjalan (npm start di folder backend), dan CORS_ORIGIN di .env
              mengizinkan origin halaman ini.
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
            <TabBar activeTab={activeTab} onChange={setActiveTab} />

            <BatchSelector
              batches={batches}
              fromDate={fromDate}
              toDate={toDate}
              onFromChange={setFromDate}
              onToChange={setToDate}
              loading={diffState === "loading"}
            />

            {activeTab === "perubahan" && diffState === "error" && (
              <div className="mdu-card p-4 mb-6 text-sm" style={{ borderColor: "var(--rust)", color: "var(--rust)" }}>
                {diffError}
              </div>
            )}

            {activeTab === "perubahan" && diffState === "ready" && (
              <PerubahanDataPanel
                diffData={diffData}
                trendData={trendData}
                fromDate={fromDate}
                toDate={toDate}
                onDownloadPdf={handleDownloadReportPdf}
                onDownloadExcel={handleDownloadReportExcel}
              />
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