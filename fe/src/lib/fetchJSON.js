export async function fetchJSON(url) {
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || `Gagal memuat ${url} (status ${res.status})`);
  }
  return body;
}