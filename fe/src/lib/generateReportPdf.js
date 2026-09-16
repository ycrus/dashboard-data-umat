import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { computeFieldChangeCounts } from "./fieldChangeCounts.js";

const clean = (s) => String(s).replace(/→/g, "-").replace(/·/g, "-");

/**
 * Membuat dan mengunduh satu PDF berisi: ringkasan perubahan, kolom paling
 * banyak diubah, tabel KK per Lingkungan, dan tabel Umat per Lingkungan.
 */
export function generateReportPdf({ diffData, summaryData, fromDate, toDate }) {
  if (!diffData) return;
  const doc = new jsPDF();

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

  // Kolom paling banyak diubah
  const fieldChangeCounts = computeFieldChangeCounts(diffData);
  if (fieldChangeCounts.length > 0) {
    doc.setFontSize(11);
    doc.text("Kolom Paling Banyak Diubah", 14, nextY);
    nextY += 5;

    autoTable(doc, {
      startY: nextY,
      head: [["Kolom", "Jumlah Diubah"]],
      body: fieldChangeCounts.map((f) => [f.field, f.count]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [28, 35, 51] },
      columnStyles: { 1: { halign: "right" } },
    });

    nextY = doc.lastAutoTable.finalY + 10;
  }

  // Tabel KK per Lingkungan
  if (summaryData?.kk) {
    if (nextY > 250) {
      doc.addPage();
      nextY = 16;
    }
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
}