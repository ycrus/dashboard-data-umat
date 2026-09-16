const express = require("express");
const pool = require("../db");
const { diffBatches, normalizeItem } = require("../diff");

const router = express.Router();

const TABLE = process.env.TABLE_NAME || "umat";
const DATE_COL = process.env.IMPORT_DATE_COLUMN || "import_date";

// Nama kolom yang dipakai tab Dashboard (snapshot satu tanggal). Bisa
// disesuaikan lewat .env kalau nama kolom asli di tabel Anda berbeda.
const GENDER_COL = process.env.GENDER_COLUMN || "L/P";
const MARITAL_COL = process.env.MARITAL_COLUMN || "Status Nikah";
const RELATION_COL = process.env.RELATION_COLUMN || "Status Rumah Tangga";
const AGE_COL = process.env.AGE_COLUMN || "umur";
const WILAYAH_COL = process.env.WILAYAH_COLUMN || "wilayah";
const LINGKUNGAN_COL = process.env.LINGKUNGAN_COLUMN || "lingkungan";

// Kriteria OMK (Orang Muda Katolik): rentang umur DAN status nikah tertentu.
// Kosongkan OMK_MARITAL_VALUE kalau mau hitung berdasarkan umur saja.
const OMK_AGE_MIN = Number(process.env.OMK_AGE_MIN || 15);
const OMK_AGE_MAX = Number(process.env.OMK_AGE_MAX || 35);
const OMK_MARITAL_VALUE = process.env.OMK_MARITAL_VALUE ?? "Lajang";

// Kolom-kolom yang tidak perlu dibandingkan isinya:
// - kolom tanggal import itu sendiri
// - "umur" dikecualikan karena bertambah otomatis tiap tahun (ulang tahun),
//   bukan perubahan data yang perlu dilaporkan
// Bisa ditambah lewat EXCLUDE_COLUMNS di .env, dipisah koma.
const extraExcluded = (process.env.EXCLUDE_COLUMNS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const EXCLUDED_FROM_COMPARE = new Set([DATE_COL, "umur", ...extraExcluded]);

let columnsCache = null;

async function getColumns() {
  if (columnsCache) return columnsCache;
  const { rows } = await pool.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = $1 ORDER BY ordinal_position`,
    [TABLE]
  );
  if (rows.length === 0) {
    throw new Error(
      `Tabel "${TABLE}" tidak ditemukan atau tidak punya kolom. Cek TABLE_NAME di .env.`
    );
  }
  columnsCache = rows.map((r) => r.column_name);
  return columnsCache;
}

async function getBatchDates() {
  const { rows } = await pool.query(
    `SELECT "${DATE_COL}" AS date, COUNT(*) AS total
     FROM "${TABLE}"
     GROUP BY "${DATE_COL}"
     ORDER BY "${DATE_COL}" ASC`
  );
  return rows.map((r) => ({ date: r.date, total: Number(r.total) }));
}

async function getRowsForDate(date) {
  const { rows } = await pool.query(
    `SELECT * FROM "${TABLE}" WHERE "${DATE_COL}" = $1::date`,
    [date]
  );
  return rows;
}

// GET /api/batches -> daftar tanggal import + jumlah data tiap tanggal
router.get("/batches", async (req, res, next) => {
  try {
    const batches = await getBatchDates();
    res.json({ batches });
  } catch (err) {
    next(err);
  }
});

// GET /api/diff?from=2026-06-01&to=2026-07-01
router.get("/diff", async (req, res, next) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) {
      return res.status(400).json({ error: "Parameter 'from' dan 'to' wajib diisi." });
    }

    const [columns, prevRows, currRows] = await Promise.all([
      getColumns(),
      getRowsForDate(from),
      getRowsForDate(to),
    ]);

    if (prevRows.length === 0 || currRows.length === 0) {
      return res.status(404).json({
        error: "Tidak ada data untuk salah satu tanggal import yang diminta.",
      });
    }

    const compareColumns = columns.filter((c) => !EXCLUDED_FROM_COMPARE.has(c));
    const result = diffBatches(prevRows, currRows, compareColumns);

    res.json({
      from,
      to,
      summary: {
        total: currRows.length,
        baru: result.added.length,
        diubah: result.modified.length,
        dihapus: result.removed.length,
        tidak_berubah: result.unchanged.length,
      },
      added: result.added,
      removed: result.removed,
      modified: result.modified,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/trend -> ringkasan perubahan untuk setiap pasangan tanggal berurutan
router.get("/trend", async (req, res, next) => {
  try {
    const [columns, batches] = await Promise.all([getColumns(), getBatchDates()]);
    const compareColumns = columns.filter((c) => !EXCLUDED_FROM_COMPARE.has(c));

    const rowsByDate = {};
    for (const b of batches) {
      rowsByDate[b.date] = await getRowsForDate(b.date);
    }

    const trend = batches.map((b, i) => {
      if (i === 0) {
        return { date: b.date, total: b.total, baru: 0, diubah: 0, dihapus: 0 };
      }
      const prevDate = batches[i - 1].date;
      const d = diffBatches(rowsByDate[prevDate], rowsByDate[b.date], compareColumns);
      return {
        date: b.date,
        total: b.total,
        baru: d.added.length,
        diubah: d.modified.length,
        dihapus: d.removed.length,
      };
    });

    res.json({ trend });
  } catch (err) {
    next(err);
  }
});

// GET /api/lingkungan-summary?from=...&to=...
// Mengembalikan dua ringkasan per lingkungan sekaligus:
// - kk: per Kepala Keluarga. Satu KK dihitung "diedit" kalau SEMUA anggota
//   keluarganya masuk kategori baru atau diubah — kalau ada satu saja
//   anggota yang tidak berubah, KK itu tidak dihitung.
// - umat: per orang. Setiap baris dihitung sendiri-sendiri (baru/diubah),
//   tidak digabung per keluarga.
router.get("/lingkungan-summary", async (req, res, next) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) {
      return res.status(400).json({ error: "Parameter 'from' dan 'to' wajib diisi." });
    }

    const [columns, prevRows, currRows] = await Promise.all([
      getColumns(),
      getRowsForDate(from),
      getRowsForDate(to),
    ]);

    if (prevRows.length === 0 || currRows.length === 0) {
      return res.status(404).json({
        error: "Tidak ada data untuk salah satu tanggal import yang diminta.",
      });
    }

    const compareColumns = columns.filter((c) => !EXCLUDED_FROM_COMPARE.has(c));
    const { added, modified, unchanged } = diffBatches(prevRows, currRows, compareColumns);

    // Tandai status tiap baris (per anggota) di batch tujuan: 'baru', 'diubah', atau 'sama'.
    const statusByRowRef = new Map();
    added.forEach((row) => statusByRowRef.set(row, "baru"));
    modified.forEach((m) => statusByRowRef.set(m.row, "diubah"));
    unchanged.forEach((row) => statusByRowRef.set(row, "sama"));

    const UNKNOWN = "(Tanpa Lingkungan)";
    const UNKNOWN_WILAYAH = "(Tanpa Wilayah)";

    // Kelompokkan baris per KK (dan lingkungan/wilayah KK tersebut).
    const familiesByKk = new Map(); // kk -> { lingkungan, wilayah, rows: [] }
    currRows.forEach((row) => {
      const kk = row["No. KK"];
      if (!kk) return;
      if (!familiesByKk.has(kk)) {
        familiesByKk.set(kk, {
          lingkungan: row.lingkungan || UNKNOWN,
          wilayah: row.wilayah || UNKNOWN_WILAYAH,
          rows: [],
        });
      }
      familiesByKk.get(kk).rows.push(row);
    });

    const lingkunganAgg = new Map(); // lingkungan -> { wilayah, jumlah_kk, kk_diedit }
    familiesByKk.forEach(({ lingkungan: l, wilayah: w, rows }) => {
      if (!lingkunganAgg.has(l)) lingkunganAgg.set(l, { wilayah: w, jumlah_kk: 0, kk_diedit: 0 });
      const agg = lingkunganAgg.get(l);
      agg.jumlah_kk += 1;

      // Semua anggota keluarga ini harus berstatus 'baru' atau 'diubah'.
      const semuaBerubah = rows.every((row) => {
        const status = statusByRowRef.get(row);
        return status === "baru" || status === "diubah";
      });
      if (semuaBerubah) agg.kk_diedit += 1;
    });

    const lingkunganKk = Array.from(lingkunganAgg.entries())
      .map(([nama, agg]) => ({
        lingkungan: nama,
        wilayah: agg.wilayah,
        jumlah_kk: agg.jumlah_kk,
        kk_diedit: agg.kk_diedit,
        persentase: agg.jumlah_kk > 0 ? Math.round((agg.kk_diedit / agg.jumlah_kk) * 1000) / 10 : 0,
      }))
      .sort((a, b) => a.lingkungan.localeCompare(b.lingkungan));

    // Ringkasan KK untuk seluruh paroki (jumlah semua KK, terlepas dari lingkungan/wilayah).
    const totalKk = lingkunganKk.reduce((sum, l) => sum + l.jumlah_kk, 0);
    const totalKkDiedit = lingkunganKk.reduce((sum, l) => sum + l.kk_diedit, 0);
    const parokiKk = {
      jumlah_kk: totalKk,
      kk_diedit: totalKkDiedit,
      persentase: totalKk > 0 ? Math.round((totalKkDiedit / totalKk) * 1000) / 10 : 0,
    };

    // Ringkasan per-orang: setiap baris umat dihitung sendiri (baru/diubah),
    // tidak digabung per KK seperti di atas.
    const umatAgg = new Map(); // lingkungan -> { wilayah, jumlah_umat, umat_diedit }
    currRows.forEach((row) => {
      const l = row.lingkungan || UNKNOWN;
      const w = row.wilayah || UNKNOWN_WILAYAH;
      if (!umatAgg.has(l)) umatAgg.set(l, { wilayah: w, jumlah_umat: 0, umat_diedit: 0 });
      const agg = umatAgg.get(l);
      agg.jumlah_umat += 1;
      const status = statusByRowRef.get(row);
      if (status === "baru" || status === "diubah") agg.umat_diedit += 1;
    });

    const lingkunganUmat = Array.from(umatAgg.entries())
      .map(([nama, agg]) => ({
        lingkungan: nama,
        wilayah: agg.wilayah,
        jumlah_umat: agg.jumlah_umat,
        umat_diedit: agg.umat_diedit,
        persentase: agg.jumlah_umat > 0 ? Math.round((agg.umat_diedit / agg.jumlah_umat) * 1000) / 10 : 0,
      }))
      .sort((a, b) => a.lingkungan.localeCompare(b.lingkungan));

    const totalUmat = lingkunganUmat.reduce((sum, l) => sum + l.jumlah_umat, 0);
    const totalUmatDiedit = lingkunganUmat.reduce((sum, l) => sum + l.umat_diedit, 0);
    const parokiUmat = {
      jumlah_umat: totalUmat,
      umat_diedit: totalUmatDiedit,
      persentase: totalUmat > 0 ? Math.round((totalUmatDiedit / totalUmat) * 1000) / 10 : 0,
    };

    res.json({
      from,
      to,
      kk: { paroki: parokiKk, lingkungan: lingkunganKk },
      umat: { paroki: parokiUmat, lingkungan: lingkunganUmat },
    });
  } catch (err) {
    next(err);
  }
});

// Mengelompokkan umur jadi rentang 5 tahunan (pola piramida penduduk umum):
// 0-4, 5-9, ..., 70-74, 75+. Umur kosong/tidak valid masuk "Tidak diketahui".
function ageBucket(rawAge) {
  const n = Number(rawAge);
  if (!Number.isFinite(n) || n < 0) return "Tidak diketahui";
  if (n >= 75) return "75+";
  const start = Math.floor(n / 5) * 5;
  return `${start}-${start + 4}`;
}

const AGE_BUCKET_ORDER = [];
for (let i = 0; i < 75; i += 5) AGE_BUCKET_ORDER.push(`${i}-${i + 4}`);
AGE_BUCKET_ORDER.push("75+", "Tidak diketahui");

// GET /api/dashboard-summary?date=...&wilayah=...&lingkungan=...
// Snapshot demografi umat pada SATU tanggal import (bukan perbandingan dua
// tanggal seperti endpoint lain): total per L/P, sebaran status nikah,
// sebaran hubungan keluarga, sebaran umur per rentang 5 tahun, dan jumlah
// OMK per L/P. wilayah & lingkungan opsional untuk menyaring.
router.get("/dashboard-summary", async (req, res, next) => {
  try {
    const { date, wilayah, lingkungan } = req.query;
    if (!date) {
      return res.status(400).json({ error: "Parameter 'date' wajib diisi." });
    }

    const allRows = await getRowsForDate(date);
    if (allRows.length === 0) {
      return res.status(404).json({ error: "Tidak ada data untuk tanggal import ini." });
    }

    // Opsi filter selalu dihitung dari SELURUH data tanggal ini (bukan hasil
    // yang sudah difilter), supaya dropdown tidak ikut menyempit sendiri
    // begitu satu filter dipilih.
    const wilayahSet = new Set();
    const lingkunganByWilayah = {};
    allRows.forEach((r) => {
      const w = r[WILAYAH_COL] || "(Tanpa Wilayah)";
      const l = r[LINGKUNGAN_COL] || "(Tanpa Lingkungan)";
      wilayahSet.add(w);
      if (!lingkunganByWilayah[w]) lingkunganByWilayah[w] = new Set();
      lingkunganByWilayah[w].add(l);
    });
    const filterOptions = {
      wilayah: Array.from(wilayahSet).sort((a, b) => a.localeCompare(b)),
      lingkunganByWilayah: Object.fromEntries(
        Object.entries(lingkunganByWilayah).map(([w, set]) => [
          w,
          Array.from(set).sort((a, b) => a.localeCompare(b)),
        ])
      ),
    };

    let rows = allRows;
    if (wilayah) rows = rows.filter((r) => (r[WILAYAH_COL] || "(Tanpa Wilayah)") === wilayah);
    if (lingkungan) rows = rows.filter((r) => (r[LINGKUNGAN_COL] || "(Tanpa Lingkungan)") === lingkungan);

    const total = rows.length;

    const byGender = { L: 0, P: 0, lainnya: 0 };
    rows.forEach((r) => {
      const g = String(r[GENDER_COL] || "").trim().toUpperCase();
      if (g === "L") byGender.L += 1;
      else if (g === "P") byGender.P += 1;
      else byGender.lainnya += 1;
    });

    const countBy = (col) => {
      const map = new Map();
      rows.forEach((r) => {
        const v = String(r[col] ?? "").trim() || "(Kosong)";
        map.set(v, (map.get(v) || 0) + 1);
      });
      return Array.from(map.entries())
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count);
    };
    const byStatusNikah = countBy(MARITAL_COL);
    const byHubunganKeluarga = countBy(RELATION_COL);

    const ageBucketMap = new Map();
    rows.forEach((r) => {
      const bucket = ageBucket(r[AGE_COL]);
      ageBucketMap.set(bucket, (ageBucketMap.get(bucket) || 0) + 1);
    });
    const byAgeRange = AGE_BUCKET_ORDER.filter((b) => ageBucketMap.has(b)).map((range) => ({
      range,
      count: ageBucketMap.get(range),
    }));

    const omkMaritalNorm = OMK_MARITAL_VALUE ? normalizeItem(OMK_MARITAL_VALUE) : null;
    const omk = { L: 0, P: 0, total: 0 };
    rows.forEach((r) => {
      const age = Number(r[AGE_COL]);
      if (!Number.isFinite(age) || age < OMK_AGE_MIN || age > OMK_AGE_MAX) return;
      if (omkMaritalNorm && normalizeItem(r[MARITAL_COL]) !== omkMaritalNorm) return;
      const g = String(r[GENDER_COL] || "").trim().toUpperCase();
      if (g === "L") omk.L += 1;
      else if (g === "P") omk.P += 1;
      omk.total += 1;
    });

    res.json({
      date,
      wilayah: wilayah || null,
      lingkungan: lingkungan || null,
      total,
      byGender,
      byStatusNikah,
      byHubunganKeluarga,
      byAgeRange,
      omk: {
        ...omk,
        ageMin: OMK_AGE_MIN,
        ageMax: OMK_AGE_MAX,
        maritalValue: OMK_MARITAL_VALUE || null,
      },
      filterOptions,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;