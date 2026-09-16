/**
 * Logika pembanding dua batch data umat berdasarkan import_date.
 * Kolom pembentuk "identitas" satu orang bisa diatur lewat KEY_COLUMNS di .env
 * (default: "No. KK" + "Tempat/Tanggal Lahir"). "nama" sengaja TIDAK dipakai
 * sebagai kunci karena nama bisa dibetulkan/diedit petugas antar import — kalau
 * nama ikut jadi kunci, orang yang sama akan salah terbaca sebagai "dihapus"
 * lalu "baru" hanya karena namanya dirapikan.
 *
 * Catatan: kombinasi ini masih bisa "tabrakan" kalau dua anggota dalam satu KK
 * kebetulan punya tanggal lahir yang sama persis (mis. kembar). Kalau tabel
 * Anda punya kolom ID unik per orang (NIK, id_umat, dsb), sebaiknya pakai itu
 * lewat KEY_COLUMNS — jauh lebih akurat daripada kombinasi apa pun di atas.
 */

const KEY_COLUMNS = (process.env.KEY_COLUMNS || "No. KK,Tempat/Tanggal Lahir")
  .split(",")
  .map((s) => s.trim());

function makeKey(row) {
  return KEY_COLUMNS.map((col) => String(row[col] ?? "").trim().toLowerCase()).join("|");
}

// Kolom yang isinya bisa berupa beberapa nilai digabung koma (mis. kolom
// "pekerjaan" berisi "LAIN-LAIN, PETANI / PEKEBUN", dan jumlah nilainya bisa
// lebih dari 2, tidak selalu tetap). Untuk kolom ini, perbandingan dilakukan
// per-item dan mengabaikan urutan — "A, B" dianggap SAMA dengan "B, A" — dan
// hasil diff-nya menunjukkan item mana yang ditambah/dihapus dari daftar,
// bukan cuma "seluruh isi kolom berubah". Atur lewat MULTI_VALUE_COLUMNS di
// .env, dipisah koma, PERSIS sama dengan nama kolom di database (case-sensitive).
// Contoh: MULTI_VALUE_COLUMNS=pekerjaan
const MULTI_VALUE_COLUMNS = new Set(
  (process.env.MULTI_VALUE_COLUMNS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);

// Untuk transisi format lama→baru: kalau suatu kolom lama (mis. "profesi")
// sekarang isinya sudah digabung ke kolom lain (mis. "pekerjaan"), item yang
// cuma "pindah rumah" itu seharusnya TIDAK dihitung sebagai perubahan baru.
// MERGE_COLUMNS memberitahu sistem: saat membandingkan kolom target, gabungkan
// juga isi kolom sumbernya (dari kedua sisi, before & after) sebelum dicek —
// jadi kalau isi gabungannya sama saja, tidak dianggap "Diubah".
// Format: target:sumber1|sumber2, dipisah koma untuk beberapa target.
// Contoh: MERGE_COLUMNS=pekerjaan:profesi
// Catatan: kolom target HARUS juga didaftarkan di MULTI_VALUE_COLUMNS, dan
// kolom sumbernya sebaiknya didaftarkan di EXCLUDE_COLUMNS supaya tidak
// dihitung dobel sebagai kolom sendiri.
const MERGE_COLUMNS = {};
(process.env.MERGE_COLUMNS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
  .forEach((pair) => {
    const [target, sources] = pair.split(":");
    if (!target || !sources) return;
    MERGE_COLUMNS[target.trim()] = sources
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean);
  });

function parseMultiValue(raw) {
  return String(raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Menyamakan variasi penulisan yang maksudnya sama persis, supaya tidak
// dihitung sebagai "perubahan" hanya karena beda spasi/strip/garis miring
// (mis. "LAIN LAIN" vs "LAIN-LAIN" vs "Lain Lain" semuanya dianggap sama).
// Ini HANYA dipakai untuk menentukan sama-tidaknya, bukan untuk menampilkan
// teksnya — before/after yang ditampilkan tetap teks asli apa adanya.
function normalizeItem(v) {
  return String(v ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

// Menghapus item duplikat (berdasarkan bentuk yang sudah dinormalisasi) —
// penting terutama untuk MERGE_COLUMNS: kalau "pekerjaan" dan "profesi"
// kebetulan berisi nilai yang sama ("LAIN-LAIN" & "LAIN-LAIN"), setelah
// digabung seharusnya dihitung SATU item, bukan dua. Tanpa ini, begitu salah
// satu sisi sumbernya kosong (mis. profesi jadi NULL), jumlah item berubah
// dari 2 jadi 1 walau isinya sebenarnya sama saja — dan salah terbaca sebagai
// "Diubah".
function dedupeByNormalized(items) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const norm = normalizeItem(item);
    if (!seen.has(norm)) {
      seen.add(norm);
      result.push(item);
    }
  }
  return result;
}

// Nilai efektif satu kolom pada satu baris: isi kolom itu sendiri, digabung
// dengan isi kolom-kolom sumber yang terdaftar di MERGE_COLUMNS (kalau ada),
// lalu dihapus duplikatnya.
function effectiveMultiValues(field, row) {
  let items = parseMultiValue(row[field]);
  const sourceCols = MERGE_COLUMNS[field] || [];
  sourceCols.forEach((col) => {
    items = items.concat(parseMultiValue(row[col]));
  });
  return dedupeByNormalized(items);
}

// Isi ASLI kolom target itu sendiri saja (tidak termasuk sumbangan dari
// MERGE_COLUMNS). Dipakai khusus untuk menentukan "item apa yang benar-benar
// hilang" — supaya kehilangan yang cuma disebabkan kolom SUMBER (mis.
// "profesi") mengosong tidak ikut dihitung sebagai perubahan pada kolom
// target (mis. "pekerjaan"), padahal kolom target itu sendiri sama sekali
// tidak berubah.
function nativeTargetItems(field, row) {
  return dedupeByNormalized(parseMultiValue(row[field]));
}

function fieldsEqual(field, prevRow, currRow) {
  if (MULTI_VALUE_COLUMNS.has(field)) {
    const prevEffectiveNorm = effectiveMultiValues(field, prevRow).map(normalizeItem);
    const currEffectiveNorm = effectiveMultiValues(field, currRow).map(normalizeItem);
    const prevNativeNorm = nativeTargetItems(field, prevRow).map(normalizeItem);

    const hasAdded = currEffectiveNorm.some((v) => !prevEffectiveNorm.includes(v));
    const hasRemoved = prevNativeNorm.some((v) => !currEffectiveNorm.includes(v));
    return !hasAdded && !hasRemoved;
  }
  return String(prevRow[field] ?? "").trim() === String(currRow[field] ?? "").trim();
}

function describeChange(field, prevRow, currRow) {
  if (MULTI_VALUE_COLUMNS.has(field)) {
    const effectivePrevRaw = effectiveMultiValues(field, prevRow);
    const effectiveCurrRaw = effectiveMultiValues(field, currRow);
    const nativePrevRaw = nativeTargetItems(field, prevRow);

    const effectivePrevNorm = effectivePrevRaw.map(normalizeItem);
    const effectiveCurrNorm = effectiveCurrRaw.map(normalizeItem);

    return {
      field,
      before: prevRow[field],
      after: currRow[field],
      // baru: item yang belum pernah ada di sisi manapun sebelumnya
      // (baik di kolom target maupun kolom sumber MERGE_COLUMNS)
      itemsAdded: effectiveCurrRaw.filter((v, i) => !effectivePrevNorm.includes(effectiveCurrNorm[i])),
      // hilang: HANYA item yang aslinya ada di kolom target itu sendiri —
      // item yang aslinya cuma nebeng dari kolom sumber (mis. profesi) dan
      // sumbernya kini kosong TIDAK dihitung hilang di sini
      itemsRemoved: nativePrevRaw.filter((v) => !effectiveCurrNorm.includes(normalizeItem(v))),
    };
  }
  return { field, before: prevRow[field], after: currRow[field] };
}

function diffBatches(prevRows, currRows, compareColumns) {
  const prevMap = new Map(prevRows.map((r) => [makeKey(r), r]));
  const currMap = new Map(currRows.map((r) => [makeKey(r), r]));

  const added = [];
  const modified = [];
  const unchanged = [];

  for (const [key, row] of currMap) {
    if (!prevMap.has(key)) {
      added.push(row);
      continue;
    }
    const prev = prevMap.get(key);
    const changedFields = compareColumns.filter(
      (col) => !fieldsEqual(col, prev, row)
    );
    if (changedFields.length > 0) {
      modified.push({
        key,
        row,
        changes: changedFields.map((field) => describeChange(field, prev, row)),
      });
    } else {
      unchanged.push(row);
    }
  }

  const removed = [];
  for (const [key, row] of prevMap) {
    if (!currMap.has(key)) removed.push(row);
  }

  return { added, removed, modified, unchanged };
}

module.exports = { diffBatches, makeKey, KEY_COLUMNS, normalizeItem };