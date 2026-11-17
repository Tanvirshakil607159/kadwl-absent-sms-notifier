import {
  Users,
  UserRoundCheck,
  Clock3,
  TriangleAlert,
  PhoneOff,
} from "lucide-react";
import { normalizePhoneNumber } from "../utils/smsUtils";
export default function KPICards({ records, activeFilter, onFilterChange }) {
  const cards = [
    [
      "all",
      "Total absent",
      records.length,
      "Employees in this report",
      Users,
      "green",
    ],
    [
      "1day",
      "First day",
      records.filter((r) => r.absentDays === 1).length,
      "A friendly reminder",
      UserRoundCheck,
      "blue",
    ],
    [
      "2to3",
      "2–3 days",
      records.filter((r) => r.absentDays >= 2 && r.absentDays <= 3).length,
      "Time to check in",
      Clock3,
      "amber",
    ],
    [
      "4plus",
      "4+ days",
      records.filter((r) => r.absentDays >= 4).length,
      "Needs HR attention",
      TriangleAlert,
      "rose",
    ],
    [
      "invalidPhone",
      "Phone issues",
      records.filter((r) => !normalizePhoneNumber(r.mobileNo).isValid).length,
      "Update before sending",
      PhoneOff,
      "purple",
    ],
  ];
  return (
    <div className="kpi-grid">
      {cards.map(([id, label, count, hint, Icon, color]) => (
        <button
          key={id}
          className={`kpi-card ${color} ${activeFilter === id ? "active" : ""}`}
          aria-pressed={activeFilter === id}
          onClick={() => onFilterChange(activeFilter === id ? "all" : id)}
        >
          <div className="kpi-top">
            <span>{label}</span>
            <span className="icon-tile">
              <Icon size={19} />
            </span>
          </div>
          <strong>{count.toLocaleString()}</strong>
          <p>{hint}</p>
        </button>
      ))}
    </div>
  );
}
