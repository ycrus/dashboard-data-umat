const express = require("express");
const pool = require("../db");
const { diffBatches } = require("../diff");

const router = express.Router();

const TABLE = process.env.TABLE_NAME || "umat";
const DATE_COL = process.env.IMPORT_DATE_COLUMN || "import_date";

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

module.exports = router;