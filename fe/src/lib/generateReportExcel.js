import * as XLSX from "xlsx";
import { computeFieldChangeCounts } from "./fieldChangeCounts.js";

/**
 * Membuat dan mengunduh satu file Excel (.xlsx) dengan sheet terpisah untuk:
 * Ringkasan, Kolom Paling Banyak Diubah, KK per Lingkungan, dan Umat per
 * Lingkungan — isinya sama persis dengan generateReportPdf, cuma bentuknya
 * spreadsheet.
 */
export function generateReportExcel({ diffData, summaryData, fromDate, toDate }) {
  if (!diffData) return;

  const wb = XLSX.utils.book_new();

  // Sheet: Ringkasan
  const ringkasanSheet = XLSX.utils.json_to_sheet([
    {
      Rentang: `${fromDate} - ${toDate}`,
      "Total (tujuan)": diffData.summary.total,
      Baru: diffData.summary.baru,
      Diubah: diffData.summary.diubah,
      Dihapus: diffData.summary.dihapus,
    },
  ]);
  XLSX.utils.book_append_sheet(wb, ringkasanSheet, "Ringkasan");

  // Sheet: Kolom Paling Banyak Diubah
  const fieldChangeCounts = computeFieldChangeCounts(diffData);
  if (fieldChangeCounts.length > 0) {
    const fieldSheet = XLSX.utils.json_to_sheet(
      fieldChangeCounts.map((f) => ({ Kolom: f.field, "Jumlah Diubah": f.count }))
    );
    XLSX.utils.book_append_sheet(wb, fieldSheet, "Kolom Paling Diubah");
  }

  // Sheet: KK per Lingkungan
  if (summaryData?.kk) {
    const kkParoki = summaryData.kk.paroki;
    const kkRows = summaryData.kk.lingkungan.map((l) => ({
      Lingkungan: l.lingkungan,
      Wilayah: l.wilayah,
      "Jumlah KK": l.jumlah_kk,
      "KK Di Update": l.kk_diedit,
      "Persentase (%)": l.persentase,
    }));
    kkRows.push({
      Lingkungan: "TOTAL PAROKI",
      Wilayah: "",
      "Jumlah KK": kkParoki.jumlah_kk,
      "KK Di Update": kkParoki.kk_diedit,
      "Persentase (%)": kkParoki.persentase,
    });
    const kkSheet = XLSX.utils.json_to_sheet(kkRows);
    XLSX.utils.book_append_sheet(wb, kkSheet, "KK per Lingkungan");
  }

  // Sheet: Umat per Lingkungan
  if (summaryData?.umat) {
    const umatParoki = summaryData.umat.paroki;
    const umatRows = summaryData.umat.lingkungan.map((l) => ({
      Lingkungan: l.lingkungan,
      Wilayah: l.wilayah,
      "Jumlah Umat": l.jumlah_umat,
      "Umat Di Update": l.umat_diedit,
      "Persentase (%)": l.persentase,
    }));
    umatRows.push({
      Lingkungan: "TOTAL PAROKI",
      Wilayah: "",
      "Jumlah Umat": umatParoki.jumlah_umat,
      "Umat Di Update": umatParoki.umat_diedit,
      "Persentase (%)": umatParoki.persentase,
    });
    const umatSheet = XLSX.utils.json_to_sheet(umatRows);
    XLSX.utils.book_append_sheet(wb, umatSheet, "Umat per Lingkungan");
  }

  XLSX.writeFile(wb, `laporan-perubahan-data-umat_${fromDate}_${toDate}.xlsx`);
}