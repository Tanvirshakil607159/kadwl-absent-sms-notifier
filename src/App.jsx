import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  ShieldCheck,
  Send,
  AlertCircle,
  Upload,
  ClipboardPaste,
  Users,
  MessageSquare,
  Megaphone,
  ArrowRight,
  Download,
} from "lucide-react";
import Header from "./components/Header";
import KPICards from "./components/KPICards";
import AbsentTable from "./components/AbsentTable";
import SMSComposer from "./components/SMSComposer";
import EmergencyMessagePanel from "./components/EmergencyMessagePanel";
import UploadModal from "./components/UploadModal";
import PasteModal from "./components/PasteModal";
import GatewaySettingsModal from "./components/GatewaySettingsModal";
import DispatchProgressModal from "./components/DispatchProgressModal";
import HistoryLogModal from "./components/HistoryLogModal";
import Dialog from "./components/Dialog";
import {
  normalizePhoneNumber,
  renderTemplate,
  calculateSMSStats,
  DEFAULT_TEMPLATES,
  exportSampleExcelTemplate,
} from "./utils/smsUtils";
import {
  DEFAULT_GATEWAY_CONFIG,
  sendSingleSMS,
  validateGateway,
} from "./utils/smsService";
import { readStored, writeStored } from "./utils/storage";
import { normalizeAttendanceDate, todayISO } from "./utils/dates";

function createLogId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
function dateInput(value) {
  return normalizeAttendanceDate(value) || todayISO();
}
function initialDate() {
  try {
    const value = localStorage.getItem("kadw_absent_date");
    return dateInput(value?.replaceAll('"', ""));
  } catch {
    return dateInput();
  }
}
function initialRecords() {
  const stored = readStored("kadw_absent_records", [], Array.isArray);
  const ids = new Set();
  return stored
    .filter((r) => r && r.employeeId != null && r.name != null)
    .map((r, i) => ({
      ...r,
      sl: i + 1,
      ...Object.fromEntries(
        [
          "employeeId",
          "name",
          "mobileNo",
          "designation",
          "line",
          "shift",
          "lastPresentDate",
        ].map((key) => [key, String(r[key] ?? "")]),
      ),
      absentDays: Math.max(1, Math.floor(Number(r.absentDays) || 1)),
    }))
    .filter((r) => {
      if (!r.employeeId || ids.has(r.employeeId.toLowerCase())) return false;
      ids.add(r.employeeId.toLowerCase());
      return true;
    });
}
function initialEmergencyRecords() {
  const stored = readStored("kadw_emergency_records", [], Array.isArray);
  const ids = new Set();
  return stored
    .filter((r) => r && r.employeeId != null && r.name != null)
    .map((r, i) => ({
      sl: i + 1,
      employeeId: String(r.employeeId ?? ""),
      name: String(r.name ?? ""),
      designation: String(r.designation ?? ""),
      employeeType: String(r.employeeType ?? ""),
      mobileNo: String(r.mobileNo ?? ""),
    }))
    .filter((r) => {
      if (!r.employeeId || ids.has(r.employeeId.toLowerCase())) return false;
      ids.add(r.employeeId.toLowerCase());
      return true;
    });
}
const sectionIds = [
  "overview",
  "import",
  "attendance",
  "messages",
  "emergency",
  "history",
  "settings",
];
function currentSection() {
  const section = window.location.hash.slice(1);
  return sectionIds.includes(section) ? section : "overview";
}
export default function App() {
  const [activeTab, setActiveTab] = useState(currentSection);
  const [importMethod, setImportMethod] = useState("file");
  function navigate(section) {
    setActiveTab(section);
    if (window.location.hash !== "#" + section) window.location.hash = section;
    document.getElementById("tab-" + section)?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function openImport(method = "file") {
    setImportMethod(method);
    navigate("import");
  }
  useEffect(() => {
    const syncSection = () => setActiveTab(currentSection());
    window.addEventListener("hashchange", syncSection);
    return () => window.removeEventListener("hashchange", syncSection);
  }, []);
  const [absentDate, setAbsentDate] = useState(initialDate);
  const [records, setRecords] = useState(initialRecords);
  const [emergencyRecords, setEmergencyRecords] = useState(
    initialEmergencyRecords,
  );
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [activeQuickFilter, setActiveQuickFilter] = useState("all");
  const [gatewayConfig, setGatewayConfig] = useState(() => {
    const stored = readStored(
      "kadw_gateway_config",
      {},
      (v) => !!v && typeof v === "object" && !Array.isArray(v),
    );
    return {
      ...DEFAULT_GATEWAY_CONFIG,
      ...stored,
      apiKey: DEFAULT_GATEWAY_CONFIG.apiKey,
    };
  });
  const [historyLogs, setHistoryLogs] = useState(() =>
    readStored("kadw_sms_history", [], Array.isArray).filter(
      (log) => log && typeof log === "object",
    ),
  );
  const [modal, setModal] = useState(null);
  const [revision, setRevision] = useState(0);
  const [review, setReview] = useState(null);
  const [dispatch, setDispatch] = useState(null);
  const [toast, setToast] = useState("");
  const [storageFailed, setStorageFailed] = useState(false);
  const timer = useRef(null),
    cancel = useRef(false),
    running = useRef(false);
  const busy = !!dispatch && !dispatch.isComplete;
  const simulation = gatewayConfig.provider === "simulation";
  const formattedDate = new Date(dateInput(absentDate) + "T12:00:00").toLocaleDateString(
    "en-GB",
    { day: "2-digit", month: "short", year: "numeric" },
  );
  function notify(message) {
    clearTimeout(timer.current);
    setToast(message);
    timer.current = setTimeout(() => setToast(""), 4500);
  }
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    const publicConfig = { ...gatewayConfig, apiKey: "" };
    const results = [
      writeStored("kadw_absent_date", absentDate),
      writeStored("kadw_absent_records", records),
      writeStored("kadw_emergency_records", emergencyRecords),
      writeStored("kadw_gateway_config", publicConfig),
      writeStored("kadw_sms_history", historyLogs),
    ];
    // Storage is an external system; surface failures after synchronization.
    queueMicrotask(() => setStorageFailed(results.some((ok) => !ok)));
  }, [absentDate, records, emergencyRecords, gatewayConfig, historyLogs]);
  useEffect(() => {
    if (!busy) return;
    const guard = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [busy]);
  function imported(rows, detectedDate) {
    setRecords(rows);
    navigate("attendance");
    setSelectedIds(new Set());
    setActiveQuickFilter("all");
    setRevision((r) => r + 1);
    if (detectedDate) setAbsentDate(dateInput(detectedDate));
    notify(
      `Imported ${rows.length} employees. Select recipients to prepare a message.`,
    );
  }
  function prepare(message, targets, dateLabel = formattedDate) {
    if (running.current || !message.trim()) return;
    const valid = targets.filter(
      (r) => normalizePhoneNumber(r.mobileNo).isValid,
    );
    if (!valid.length) {
      notify("Select at least one employee with a valid phone number.");
      return;
    }
    const error = validateGateway(gatewayConfig);
    if (error) {
      notify(error);
      navigate("settings");
      return;
    }
    const messages = valid.map((record) => ({
      record,
      message: renderTemplate(message, record, dateLabel),
    }));
    setReview({
      messages,
      skipped: targets.length - valid.length,
      cost: messages.reduce(
        (sum, item) =>
          sum + calculateSMSStats(item.message, gatewayConfig.ratePerSMS).cost,
        0,
      ),
      config: { ...gatewayConfig },
    });
  }
  async function send() {
    if (running.current || !review || !review.messages.length) return;
    running.current = true;
    cancel.current = false;
    const batch = review;
    setReview(null);
    setDispatch({
      progress: 0,
      total: batch.messages.length,
      logs: [],
      isComplete: false,
      cancelling: false,
      cancelled: false,
      error: "",
      currentEmployee: batch.messages[0].record,
    });
    let processed = 0;
    let fatalError = "";
    try {
      for (const item of batch.messages) {
        if (cancel.current) break;
        const { record, message } = item;
        setDispatch((prev) => ({ ...prev, currentEmployee: record }));
        const phoneInfo = normalizePhoneNumber(record.mobileNo);
        const stats = calculateSMSStats(message, batch.config.ratePerSMS);
        const result = await sendSingleSMS(
          { phoneInfo },
          message,
          batch.config,
        );
        const log = {
          id: createLogId(),
          timestamp: new Date().toLocaleString(),
          employeeId: record.employeeId,
          name: record.name,
          line: record.line || record.employeeType || "",
          mobile: phoneInfo.normalized,
          status: result.status,
          parts: stats.parts,
          cost:
            result.success && result.status !== "Simulated" ? stats.cost : 0,
          message,
          gatewayResponse: result.response,
        };
        processed++;
        setHistoryLogs((prev) => [log, ...prev]);
        setDispatch((prev) => ({
          ...prev,
          progress: prev.progress + 1,
          logs: [...prev.logs, log],
        }));
        if (result.fatal) {
          fatalError = result.response;
          break;
        }
      }
    } finally {
      running.current = false;
      setDispatch((prev) => ({
        ...prev,
        isComplete: true,
        cancelled: cancel.current && processed < batch.messages.length,
        cancelling: false,
        error: fatalError,
      }));
      if (fatalError) notify(`Dispatch stopped: ${fatalError}`);
    }
  }
  const selected = records.filter((r) => selectedIds.has(r.employeeId));
  return (
    <div className="app-shell">
      <div className="app-container">
        <Header
          absentDate={absentDate}
          setAbsentDate={setAbsentDate}
          activeTab={activeTab}
          onTabChange={navigate}
          recordsCount={records.length}
          selectedCount={selected.length}
          emergencyCount={emergencyRecords.length}
          historyCount={historyLogs.length}
          simulation={simulation}
        />
        <main id="main" className="tab-workspace">
          {storageFailed && (
            <div className="error-note" role="alert">
              <AlertCircle size={18} />
              Browser storage is unavailable or full. Changes may be lost on
              reload; export your message history before leaving.
            </div>
          )}
          <section
            id="panel-overview"
            role="tabpanel"
            aria-labelledby="tab-overview"
            hidden={activeTab !== "overview"}
            tabIndex={0}
          >
            <div className="section-heading">
              <div>
                <h2>Attendance overview</h2>
                <p>
                  Select a summary to open the matching employees in Attendance.
                </p>
              </div>
            </div>
            <KPICards
              records={records}
              activeFilter={activeQuickFilter}
              onFilterChange={(filter) => {
                setActiveQuickFilter(filter);
                navigate("attendance");
              }}
            />
            <div className="overview-actions">
              <article className="panel overview-action">
                <span className="icon-tile green">
                  <Upload size={24} />
                </span>
                <span className="eyebrow">STEP 01 · IMPORT</span>
                <h2>Start with your team</h2>
                <p>
                  Bring your attendance report from Excel, CSV, or a quick
                  paste.
                </p>
                <button
                  className="btn btn-primary"
                  onClick={() => openImport()}
                >
                  <Upload size={16} />
                  Import attendance
                  <ArrowRight size={15} />
                </button>
                <button
                  className="text-button"
                  onClick={() => openImport("paste")}
                >
                  <ClipboardPaste size={14} />
                  Paste from Excel
                </button>
              </article>
              <article className="panel overview-action">
                <span className="icon-tile blue">
                  <Users size={24} />
                </span>
                <span className="eyebrow">STEP 02 · ATTENDANCE</span>
                <h2>Review & select employees</h2>
                <p>
                  {records.length} employees in this report. Check phone numbers
                  and choose who needs a follow-up.
                </p>
                <button className="btn" onClick={() => navigate("attendance")}>
                  Open attendance
                  <ArrowRight size={15} />
                </button>
              </article>
              <article className="panel overview-action">
                <span className="icon-tile purple">
                  <MessageSquare size={24} />
                </span>
                <span className="eyebrow">STEP 03 · MESSAGES</span>
                <h2>Send a personal reminder</h2>
                <p>
                  {selected.length} employees selected. Prepare your message and
                  check the preview before sending.
                </p>
                <button className="btn" onClick={() => navigate("messages")}>
                  Open messages
                  <ArrowRight size={15} />
                </button>
              </article>
              <article className="panel overview-action">
                <span className="icon-tile rose">
                  <Megaphone size={24} />
                </span>
                <span className="eyebrow">BROADCAST · EMERGENCY</span>
                <h2>Emergency Message</h2>
                <p>
                  {emergencyRecords.length
                    ? `${emergencyRecords.length} employees ready for urgent notices such as emergency chuti.`
                    : "Upload your employee directory to filter Staff, Workers, or Office for emergency notices."}
                </p>
                <button className="btn" onClick={() => navigate("emergency")}>
                  Open Emergency Message
                  <ArrowRight size={15} />
                </button>
              </article>
            </div>
          </section>
          <section
            id="panel-import"
            role="tabpanel"
            aria-labelledby="tab-import"
            hidden={activeTab !== "import"}
            tabIndex={0}
            className="import-page"
          >
            <div
              className="import-methods"
              role="group"
              aria-label="Import method"
            >
              <button
                className="btn"
                aria-pressed={importMethod === "file"}
                onClick={() => setImportMethod("file")}
              >
                <Upload size={16} />
                Upload file
              </button>
              <button
                className="btn"
                aria-pressed={importMethod === "paste"}
                onClick={() => setImportMethod("paste")}
              >
                <ClipboardPaste size={16} />
                Paste from Excel
              </button>
            </div>
            <div hidden={importMethod !== "file"}>
              <UploadModal
                embedded
                onDataLoaded={imported}
                recordsCount={records.length}
              />
            </div>
            <div hidden={importMethod !== "paste"}>
              <PasteModal
                embedded
                onDataParsed={imported}
                recordsCount={records.length}
              />
            </div>
          </section>
          <section
            id="panel-attendance"
            role="tabpanel"
            aria-labelledby="tab-attendance"
            hidden={activeTab !== "attendance"}
            tabIndex={0}
          >
            <div className="tab-action-bar">
              <div className="tab-action-group">
                <button className="btn" onClick={() => openImport()}>
                  <Upload size={16} />
                  Import attendance
                </button>
                <button className="btn" onClick={() => openImport("paste")}>
                  <ClipboardPaste size={16} />
                  Paste from Excel
                </button>
                <button
                  className="text-button"
                  onClick={exportSampleExcelTemplate}
                >
                  <Download size={14} />
                  Download sample template
                </button>
              </div>
              <button
                className="btn btn-primary"
                onClick={() => navigate("messages")}
              >
                Compose for {selected.length} selected
                <ArrowRight size={16} />
              </button>
            </div>
            <AbsentTable
              key={revision}
              records={records}
              selectedIds={selectedIds}
              onToggleSelect={(id) =>
                setSelectedIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
                })
              }
              onSelectAll={(ids) =>
                setSelectedIds((prev) => new Set([...prev, ...ids]))
              }
              onDeselectAll={(ids) =>
                setSelectedIds((prev) => {
                  const next = new Set(prev);
                  ids.forEach((id) => next.delete(id));
                  return next;
                })
              }
              onUpdatePhone={(id, mobileNo) => {
                setRecords((prev) =>
                  prev.map((r) =>
                    r.employeeId === id ? { ...r, mobileNo } : r,
                  ),
                );
                notify("Phone number updated.");
              }}
              onSingleSend={(record) =>
                prepare(DEFAULT_TEMPLATES[0].text, [record])
              }
              activeQuickFilter={activeQuickFilter}
              setActiveQuickFilter={setActiveQuickFilter}
              onOpenUpload={() => openImport()}
              onClearRecords={() => setModal("clear")}
              busy={busy}
            />
          </section>
          <section
            id="panel-messages"
            role="tabpanel"
            aria-labelledby="tab-messages"
            hidden={activeTab !== "messages"}
            tabIndex={0}
            className="messages-page"
          >
            <div className="tab-action-bar">
              <p>
                {selected.length} selected recipients · selections are managed
                in Attendance.
              </p>
              <button className="btn" onClick={() => navigate("attendance")}>
                <Users size={16} />
                {selected.length ? "Edit recipients" : "Select recipients"}
              </button>
            </div>
            <SMSComposer
              selectedRecords={selected}
              allRecords={records}
              absentDate={formattedDate}
              onTriggerBulkSend={(message) => prepare(message, selected)}
              gatewayRate={Number(gatewayConfig.ratePerSMS) || 0}
              senderId={gatewayConfig.senderId}
              simulation={simulation}
              busy={busy}
            />
          </section>
          <section
            id="panel-emergency"
            role="tabpanel"
            aria-labelledby="tab-emergency"
            hidden={activeTab !== "emergency"}
            tabIndex={0}
          >
            <EmergencyMessagePanel
              records={emergencyRecords}
              onImportRecords={(rows) => {
                setEmergencyRecords(rows);
                notify(
                  `Loaded ${rows.length} employees into Emergency Message.`,
                );
              }}
              onClearRecords={() => setModal("clear-emergency")}
              onUpdatePhone={(id, mobileNo) => {
                setEmergencyRecords((prev) =>
                  prev.map((r) =>
                    r.employeeId === id ? { ...r, mobileNo } : r,
                  ),
                );
                notify("Emergency mobile number updated.");
              }}
              onTriggerSend={(message, targets, dateLabel) =>
                prepare(message, targets, dateLabel)
              }
              gatewayRate={Number(gatewayConfig.ratePerSMS) || 0}
              senderId={gatewayConfig.senderId}
              simulation={simulation}
              busy={busy}
            />
          </section>
          <section
            id="panel-history"
            role="tabpanel"
            aria-labelledby="tab-history"
            hidden={activeTab !== "history"}
            tabIndex={0}
          >
            <HistoryLogModal
              embedded
              historyLogs={historyLogs}
              onClearHistory={() => {
                setHistoryLogs([]);
                notify("Message history cleared.");
              }}
            />
          </section>
          <section
            id="panel-settings"
            role="tabpanel"
            aria-labelledby="tab-settings"
            hidden={activeTab !== "settings"}
            tabIndex={0}
            className="settings-page"
          >
            <GatewaySettingsModal
              embedded
              gatewayConfig={gatewayConfig}
              onSaveConfig={(config) => {
                setGatewayConfig(config);
                notify("Gateway settings saved.");
              }}
            />
          </section>
        </main>
        <footer className="app-footer">
          <span>© {new Date().getFullYear()} K.A. Design Wear Ltd.</span>
          <span>
            <ShieldCheck size={14} />
            Built for a more connected workplace.
          </span>
        </footer>
      </div>
      {modal === "clear" && (
        <Dialog
          title="Clear the employee list?"
          description={`Remove ${records.length} employees from this browser. Your message history will be kept.`}
          onClose={() => setModal(null)}
          footer={
            <>
              <button className="btn" onClick={() => setModal(null)}>
                Keep employees
              </button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  setRecords([]);
                  setSelectedIds(new Set());
                  setRevision((r) => r + 1);
                  setModal(null);
                  notify("Employee list cleared.");
                }}
              >
                Clear employees
              </button>
            </>
          }
        />
      )}
      {modal === "clear-emergency" && (
        <Dialog
          title="Clear the emergency directory?"
          description={`Remove ${emergencyRecords.length} employees from Emergency Message in this browser. Your message history will be kept.`}
          onClose={() => setModal(null)}
          footer={
            <>
              <button className="btn" onClick={() => setModal(null)}>
                Keep directory
              </button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  setEmergencyRecords([]);
                  setModal(null);
                  notify("Emergency directory cleared.");
                }}
              >
                Clear directory
              </button>
            </>
          }
        />
      )}
      {review && (
        <Dialog
          title={
            review.config.provider === "simulation"
              ? "Review your simulation"
              : "Review & send messages"
          }
          description={`${review.messages.length} recipients · Estimated live cost ৳${review.cost.toFixed(2)}`}
          onClose={() => setReview(null)}
          footer={
            <>
              <button className="btn" onClick={() => setReview(null)}>
                Back to editing
              </button>
              <button className="btn btn-primary" onClick={send}>
                <Send size={16} />
                {review.config.provider === "simulation"
                  ? "Start simulation"
                  : `Send ${review.messages.length} messages`}
              </button>
            </>
          }
        >
          <div className="info-note">
            {review.config.provider === "simulation"
              ? "Simulation only. No SMS will be sent and the actual charge is ৳0."
              : `Real messages will be submitted through ${review.config.provider}. Gateway acceptance does not guarantee delivery.`}
          </div>
          {review.skipped > 0 && (
            <p className="warning-note">
              {review.skipped} invalid numbers will be skipped.
            </p>
          )}
          <div className="review-list">
            {review.messages.map(({ record, message }) => (
              <article key={record.employeeId}>
                <strong>{record.name}</strong>
                <small>
                  {record.employeeId} ·{" "}
                  {normalizePhoneNumber(record.mobileNo).normalized}
                </small>
                <p>{message}</p>
              </article>
            ))}
          </div>
        </Dialog>
      )}
      {dispatch && (
        <DispatchProgressModal
          {...dispatch}
          onClose={() => {
            if (dispatch.isComplete) setDispatch(null);
          }}
          onCancel={() => {
            cancel.current = true;
            setDispatch((prev) => ({ ...prev, cancelling: true }));
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {toast}
        </div>
      )}
    </div>
  );
}
