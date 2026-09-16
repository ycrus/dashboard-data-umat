/**
 * Menghitung berapa kali tiap kolom muncul di daftar "Diubah", diurutkan dari
 * yang paling sering. Dipakai bareng oleh chart di layar (PerubahanDataPanel)
 * dan file ekspor (PDF & Excel) supaya angkanya selalu konsisten.
 */
export function computeFieldChangeCounts(diffData) {
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
}