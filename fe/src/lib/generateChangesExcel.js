import * as XLSX from "xlsx";

/**
 * Mengunduh daftar perubahan (kategori "Diubah") sebagai Excel — satu baris
 * per KOLOM yang berubah, jadi satu orang dengan 3 kolom berubah akan jadi
 * 3 baris. Mengikuti filter Wilayah/Lingkungan yang sedang aktif di layar.
 */
export function generateChangesExcel({ modifiedList, fromDate, toDate, wilayahFilter, lingkunganFilter }) {
  if (!modifiedList || modifiedList.length === 0) return;

  const rows = [];
  modifiedList.forEach((m) => {
    m.changes.forEach((c) => {
      rows.push({
        Nama: m.row.nama,
        "No. KK": m.row["No. KK"],
        Wilayah: m.row.wilayah,
        Lingkungan: m.row.lingkungan,
        Kolom: c.field,
        Sebelum: c.before,
        Sesudah: c.after,
      });
    });
  });

  const wb = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, sheet, "Perubahan Data");

  const wilayahPart = wilayahFilter && wilayahFilter !== "semua" ? `_${wilayahFilter}` : "";
  const lingkunganPart = lingkunganFilter && lingkunganFilter !== "semua" ? `_${lingkunganFilter}` : "";
  const fileName = `perubahan-data-umat${wilayahPart}${lingkunganPart}_${fromDate}_${toDate}.xlsx`.replace(/\s+/g, "-");

  XLSX.writeFile(wb, fileName);
}