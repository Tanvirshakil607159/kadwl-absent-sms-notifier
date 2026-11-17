import {
  CalendarDays,
  LayoutDashboard,
  Upload,
  Users,
  MessageSquare,
  History,
  Settings,
} from "lucide-react";
const tabs = [
  [
    "overview",
    "Overview",
    LayoutDashboard,
    "Your attendance at a glance",
    "Review the summary, then open a section to get started.",
  ],
  [
    "import",
    "Import",
    Upload,
    "Bring your attendance report",
    "Upload a file or paste the rows copied from Excel.",
  ],
  [
    "attendance",
    "Attendance",
    Users,
    "Review your employee list",
    "Find absences, correct phone numbers, and select recipients.",
  ],
  [
    "messages",
    "Messages",
    MessageSquare,
    "Write a personal reminder",
    "Choose a template, preview your message, and review before sending.",
  ],
  [
    "history",
    "History",
    History,
    "Your message history",
    "Review previous results and export your reports.",
  ],
  [
    "settings",
    "Settings",
    Settings,
    "Connect your SMS gateway",
    "Manage your provider, sender ID, pricing, and connection.",
  ],
];
export default function Header({
  absentDate,
  setAbsentDate,
  activeTab,
  onTabChange,
  recordsCount,
  selectedCount,
  historyCount,
  simulation,
}) {
  const current = tabs.find(([id]) => id === activeTab) || tabs[0];
  function keyboard(event, index) {
    let next;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft")
      next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    onTabChange(tabs[next][0]);
    document.getElementById(`tab-${tabs[next][0]}`)?.focus();
  }
  return (
    <>
      <header className="topbar">
        <a
          className="brand"
          href="#overview"
          onClick={(e) => {
            e.preventDefault();
            onTabChange("overview");
          }}
        >
          <img
            src="./company-logo.png"
            alt="K.A. Design Wear Ltd. company logo"
          />
          <div>
            <strong>K.A. DESIGN WEAR LTD.</strong>
            <span>100% Export Oriented Garments Manufacturer</span>
          </div>
        </a>
        <div className="topbar-tools">
          <span className="workspace-label">HR workspace</span>
          <span className="avatar">HR</span>
        </div>
      </header>
      <nav
        className="section-tabs"
        role="tablist"
        aria-label="Workspace sections"
      >
        {tabs.map(([id, label, Icon], index) => {
          const count =
            id === "attendance"
              ? recordsCount
              : id === "messages"
                ? selectedCount
                : id === "history"
                  ? historyCount
                  : 0;
          return (
            <button
              key={id}
              id={`tab-${id}`}
              role="tab"
              type="button"
              aria-selected={activeTab === id}
              aria-controls={`panel-${id}`}
              tabIndex={activeTab === id ? 0 : -1}
              onClick={() => onTabChange(id)}
              onKeyDown={(event) => keyboard(event, index)}
            >
              <Icon size={18} />
              <span>{label}</span>
              {count > 0 && (
                <span
                  className="count"
                  aria-label={
                    id === "messages" ? `${count} selected` : `${count} records`
                  }
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>
      <section className="page-heading">
        <div>
          <div className="eyebrow">
            {current[1].toUpperCase()} · HR WORKSPACE
          </div>
          <h1>{current[3]}</h1>
          <p>{current[4]}</p>
        </div>
        <div className="heading-controls">
          <label className="date-control">
            <CalendarDays size={19} />
            <span>
              Attendance date
              <input
                aria-label="Attendance date"
                type="date"
                value={absentDate}
                onChange={(e) => {
                  if (e.target.value) setAbsentDate(e.target.value);
                }}
              />
            </span>
          </label>
          <button
            className={`mode-badge ${simulation ? "" : "live"}`}
            onClick={() => onTabChange("settings")}
          >
            <span className="status-dot" />
            {simulation
              ? "Simulation mode · no messages sent"
              : "Live gateway selected"}
            <Settings size={13} />
          </button>
        </div>
      </section>
    </>
  );
}
