import { BookOpen } from "lucide-react";

export default function AppHeader() {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
      <div className="flex items-start gap-3">
        <div className="mdu-stamp w-12 h-12 flex items-center justify-center shrink-0 mt-1" style={{ color: "var(--gold)" }}>
          <BookOpen size={20} />
        </div>
        <div>
          <h1 className="mdu-display text-2xl font-semibold" style={{ color: "var(--paper)" }}>
            Sistem Monitoring Perubahan Data Umat
          </h1>
        </div>
      </div>
    </div>
  );
}