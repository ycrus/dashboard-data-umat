require("dotenv").config();
const express = require("express");
const cors = require("cors");
const monitoringRoutes = require("./routes/monitoring");

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api", monitoringRoutes);

// Penanganan error terpusat
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Terjadi kesalahan pada server." });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API monitoring data umat berjalan di http://localhost:${PORT}`);
});