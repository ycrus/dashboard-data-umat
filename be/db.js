const { Pool, types } = require("pg");

// OID 1082 = tipe kolom "date" di PostgreSQL.
// Secara default, pg mengubahnya jadi objek Date JS (lalu ikut terkonversi ke
// timezone lokal). Ini bisa menggeser tanggal saat dikirim sebagai JSON dan
// dikirim balik sebagai query param (mis. 2026-06-01 jadi 2026-05-31 karena
// offset UTC). Dengan override ini, kolom "date" selalu dikembalikan sebagai
// string mentah 'YYYY-MM-DD' sesuai isi database, tanpa konversi apa pun.
types.setTypeParser(1082, (val) => val);

const pool = new Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : false,
});

pool.on("error", (err) => {
  console.error("Kesalahan tak terduga pada koneksi PostgreSQL:", err);
});

module.exports = pool;