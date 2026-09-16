import { BookOpen, MapPin } from "lucide-react";

const TABS = [
  { key: "perubahan", label: "Perubahan Data", Icon: BookOpen },
  { key: "kk", label: "Monitoring KK Lingkungan", Icon: MapPin },
  { key: "umat", label: "Monitoring Umat Lingkungan", Icon: MapPin },
];

export default function TabBar({ activeTab, onChange }) {
  return (
    <div className="flex items-end gap-1 -mb-px relative z-10">
      {TABS.map(({ key, label, Icon }) => (
        <div
          key={key}
          className="mdu-toplevel-tab flex items-center gap-1.5"
          data-active={activeTab === key}
          onClick={() => onChange(key)}
        >
          <Icon size={12} /> {label}
        </div>
      ))}
    </div>
  );
}