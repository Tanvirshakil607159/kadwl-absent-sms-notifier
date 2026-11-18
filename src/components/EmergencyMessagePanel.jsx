import { useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ClipboardPaste,
  Download,
  Eye,
  Megaphone,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  Send,
  SlidersHorizontal,
  Trash2,
  Upload,
  UploadCloud,
  Users,
  X,
} from "lucide-react";
import {
  EMERGENCY_TEMPLATES,
  calculateSMSStats,
  exportEmergencyExcelTemplate,
  normalizePhoneNumber,
  parseEmergencyFile,
  parseEmergencyText,
  renderTemplate,
} from "../utils/smsUtils";
import { todayISO } from "../utils/dates";

const PAGE_SIZE = 20;

function typeBadgeColor(employeeType = "") {
  const normalized = employeeType.trim().toLowerCase();
  if (normalized === "staff") return "blue";
  if (normalized === "office") return "purple";
  if (normalized === "worker") return "green";
  return "amber";
}

export default function EmergencyMessagePanel({
  records,
  onImportRecords,
  onClearRecords,
  onUpdatePhone,
  onTriggerSend,
  gatewayRate,
  senderId,
  simulation,
  busy,
}) {
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [search, setSearch] = useState("");
  const [employeeTypeFilter, setEmployeeTypeFilter] = useState("");
  const [designationFilter, setDesignationFilter] = useState("");
  const [phoneFilter, setPhoneFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [editingId, setEditingId] = useState(null);
  const [editPhone, setEditPhone] = useState("");

  const [importMode, setImportMode] = useState("file");
  const [showImporter, setShowImporter] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [importError, setImportError] = useState("");
  const [pasteText, setPasteText] = useState("");
  const fileInputRef = useRef(null);
  const sequenceRef = useRef(0);

  const [noticeDate, setNoticeDate] = useState(todayISO);
  const [templateId, setTemplateId] = useState(EMERGENCY_TEMPLATES[0].id);
  const [message, setMessage] = useState(EMERGENCY_TEMPLATES[0].text);
  const [previewIndex, setPreviewIndex] = useState(0);
  const textareaRef = useRef(null);

  const formattedNoticeDate = useMemo(() => {
    const safe = /^\d{4}-\d{2}-\d{2}$/.test(noticeDate)
      ? noticeDate
      : todayISO();
    return new Date(safe + "T12:00:00").toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }, [noticeDate]);

  const typeCounts = useMemo(() => {
    const counts = new Map();
    for (const r of records) {
      const label = (r.employeeType || "Unspecified").trim();
      counts.set(label, (counts.get(label) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [records]);

  const designations = useMemo(
    () =>
      [...new Set(records.map((r) => r.designation).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b),
      ),
    [records],
  );

  const invalidPhoneCount = useMemo(
    () =>
      records.filter((r) => !normalizePhoneNumber(r.mobileNo).isValid).length,
    [records],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((r) => {
      if (
        q &&
        ![r.name, r.employeeId, r.designation, r.employeeType, r.mobileNo].some(
          (v) => String(v || "").toLowerCase().includes(q),
        )
      ) {
        return false;
      }
      if (employeeTypeFilter) {
        const typeLabel = (r.employeeType || "Unspecified").trim();
        if (typeLabel !== employeeTypeFilter) return false;
      }
      if (designationFilter && r.designation !== designationFilter) {
        return false;
      }
      if (
        phoneFilter === "invalid" &&
        normalizePhoneNumber(r.mobileNo).isValid
      ) {
        return false;
      }
      if (
        phoneFilter === "valid" &&
        !normalizePhoneNumber(r.mobileNo).isValid
      ) {
        return false;
      }
      return true;
    });
  }, [records, search, employeeTypeFilter, designationFilter, phoneFilter]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const visible = filtered.slice(
    currentPage * PAGE_SIZE,
    currentPage * PAGE_SIZE + PAGE_SIZE,
  );

  const validSelectedIds = useMemo(() => {
    const existing = new Set(records.map((r) => r.employeeId));
    return new Set([...selectedIds].filter((id) => existing.has(id)));
  }, [records, selectedIds]);

  const selectedRecords = useMemo(
    () => records.filter((r) => validSelectedIds.has(r.employeeId)),
    [records, validSelectedIds],
  );

  const allFilteredSelected =
    filtered.length > 0 &&
    filtered.every((r) => validSelectedIds.has(r.employeeId));

  const validRecipients = useMemo(
    () =>
      selectedRecords.filter((r) => normalizePhoneNumber(r.mobileNo).isValid),
    [selectedRecords],
  );

  const previewTargets = selectedRecords.length ? selectedRecords : filtered;
  const safePreviewIndex = Math.min(
    previewIndex,
    Math.max(0, previewTargets.length - 1),
  );
  const previewRecord = previewTargets[safePreviewIndex] || {
    name: "Sahidul",
    employeeId: "KADS5",
    designation: "Deputy Production Manager",
    employeeType: "Staff",
  };
  const renderedPreview = renderTemplate(
    message,
    previewRecord,
    formattedNoticeDate,
  );
  const previewStats = calculateSMSStats(renderedPreview, gatewayRate);

  const totalCost = useMemo(
    () =>
      validRecipients
        .reduce(
          (sum, r) =>
            sum +
            calculateSMSStats(
              renderTemplate(message, r, formattedNoticeDate),
              gatewayRate,
            ).cost,
          0,
        )
        .toFixed(2),
    [validRecipients, message, formattedNoticeDate, gatewayRate],
  );

  function resetFilters() {
    setSearch("");
    setEmployeeTypeFilter("");
    setDesignationFilter("");
    setPhoneFilter("all");
    setPage(0);
  }

  function applyImportedRows(rows) {
    onImportRecords(rows);
    setSelectedIds(new Set());
    resetFilters();
    setShowImporter(false);
    setPasteText("");
    setImportError("");
  }

  async function processFile(file) {
    if (!file) return;
    const id = ++sequenceRef.current;
    setImportError("");
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      setImportError("Choose an Excel (.xlsx, .xls) or CSV file.");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setImportError("Please use a file smaller than 15 MB.");
      return;
    }
    setLoading(true);
    try {
      const parsed = await parseEmergencyFile(file);
      if (sequenceRef.current === id) applyImportedRows(parsed);
    } catch (err) {
      if (sequenceRef.current === id) setImportError(err.message);
    } finally {
      if (sequenceRef.current === id) setLoading(false);
    }
  }

  async function submitPaste() {
    if (!pasteText.trim()) return;
    setLoading(true);
    setImportError("");
    try {
      const parsed = await parseEmergencyText(pasteText);
      applyImportedRows(parsed);
    } catch (err) {
      setImportError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function insertTag(tag) {
    const start = textareaRef.current?.selectionStart ?? message.length;
    const end = textareaRef.current?.selectionEnd ?? message.length;
    setMessage(message.slice(0, start) + tag + message.slice(end));
    setTemplateId("custom");
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(
        start + tag.length,
        start + tag.length,
      );
    });
  }

  const uploaderCard = (
    <section className="panel" aria-labelledby="emergency-import-title">
      <header className="panel-heading">
        <div>
          <h2 id="emergency-import-title">
            <Megaphone size={18} />
            Upload emergency employee directory
          </h2>
          <p>
            Import your master XLSX, XLS, or CSV file with SL, Employee ID,
            Employee Name, Designation, Employee_Type, and Mobile No.
          </p>
        </div>
        {records.length > 0 && (
          <button
            type="button"
            className="btn"
            onClick={() => {
              setShowImporter(false);
              setImportError("");
            }}
          >
            Cancel
          </button>
        )}
      </header>
      <div className="section-body">
        <div
          className="import-methods"
          role="group"
          aria-label="Emergency import method"
        >
          <button
            type="button"
            className="btn"
            aria-pressed={importMode === "file"}
            onClick={() => {
              setImportMode("file");
              setImportError("");
            }}
          >
            <Upload size={16} />
            Upload Excel / CSV
          </button>
          <button
            type="button"
            className="btn"
            aria-pressed={importMode === "paste"}
            onClick={() => {
              setImportMode("paste");
              setImportError("");
            }}
          >
            <ClipboardPaste size={16} />
            Paste rows
          </button>
        </div>

        {importMode === "file" ? (
          <>
            <button
              type="button"
              className={`dropzone ${dragging ? "dragging" : ""}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                processFile(e.dataTransfer.files[0]);
              }}
            >
              <UploadCloud size={36} />
              <strong>
                Drop your employee master XLSX/CSV here, or browse files
              </strong>
              <span>
                Supports Employee_Type (Staff, Worker, Office) & Designation ·
                up to 15 MB
              </span>
            </button>
            <input
              ref={fileInputRef}
              className="sr-only"
              type="file"
              aria-label="Emergency employee list file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => {
                processFile(e.target.files[0]);
                e.target.value = "";
              }}
            />
          </>
        ) : (
          <>
            <label className="field">
              Emergency employee rows
              <textarea
                rows={7}
                className="paste-input"
                disabled={loading}
                value={pasteText}
                onChange={(e) => {
                  setPasteText(e.target.value);
                  if (importError) setImportError("");
                }}
                placeholder={
                  "SL\tEmployee ID\tEmployee Name\tDesignation\tEmployee_Type\tMobile No\n1\tKADS5\tSahidul\tDeputy Production Manager\tStaff\t01741144499"
                }
              />
            </label>
            <div className="tab-action-group">
              <button
                type="button"
                className="btn btn-primary"
                disabled={loading || !pasteText.trim()}
                onClick={submitPaste}
              >
                Import pasted directory
              </button>
            </div>
          </>
        )}

        {loading && <p role="status">Reading employee directory…</p>}
        {importError && (
          <p className="error-note" role="alert">
            <AlertCircle size={17} />
            {importError}
          </p>
        )}

        <div className="tab-action-bar" style={{ marginBottom: 0 }}>
          <p className="help-text">
            Required columns: Employee ID and Employee Name. Recommended:
            Designation, Employee_Type, Mobile No.
          </p>
          <button
            type="button"
            className="text-button"
            onClick={exportEmergencyExcelTemplate}
          >
            <Download size={14} />
            Download emergency template
          </button>
        </div>
      </div>
    </section>
  );

  if (records.length === 0 || showImporter) {
    return uploaderCard;
  }

  return (
    <div className="emergency-workspace">
      <div className="tab-action-bar">
        <div className="tab-action-group">
          <button
            type="button"
            className="btn"
            onClick={() => setShowImporter(true)}
            disabled={busy}
          >
            <Upload size={16} />
            Replace directory
          </button>
          <button
            type="button"
            className="text-button"
            onClick={exportEmergencyExcelTemplate}
          >
            <Download size={14} />
            Download emergency template
          </button>
        </div>
        <button
          type="button"
          className="btn btn-danger"
          disabled={busy}
          onClick={() => {
            setSelectedIds(new Set());
            onClearRecords();
          }}
        >
          <Trash2 size={15} />
          Clear directory
        </button>
      </div>

      <div className="emergency-type-pills" role="group" aria-label="Filter by employee type">
        <button
          type="button"
          className={`filter-pill ${!employeeTypeFilter && phoneFilter === "all" ? "active" : ""}`}
          onClick={() => {
            setEmployeeTypeFilter("");
            setPhoneFilter("all");
            setPage(0);
          }}
        >
          All employees <span className="count">{records.length}</span>
        </button>
        {typeCounts.map(([type, count]) => (
          <button
            key={type}
            type="button"
            className={`filter-pill ${employeeTypeFilter === type ? "active" : ""}`}
            onClick={() => {
              setEmployeeTypeFilter((prev) => (prev === type ? "" : type));
              setPhoneFilter("all");
              setPage(0);
            }}
          >
            {type} <span className="count">{count}</span>
          </button>
        ))}
        {invalidPhoneCount > 0 && (
          <button
            type="button"
            className={`filter-pill ${phoneFilter === "invalid" ? "active" : ""}`}
            onClick={() => {
              setPhoneFilter((prev) =>
                prev === "invalid" ? "all" : "invalid",
              );
              setEmployeeTypeFilter("");
              setPage(0);
            }}
          >
            Phone issues <span className="count">{invalidPhoneCount}</span>
          </button>
        )}
      </div>

      <div className="dashboard-grid">
        <section
          className="panel employee-panel"
          aria-labelledby="emergency-list-title"
        >
          <div className="panel-heading">
            <div>
              <h2 id="emergency-list-title">
                <Users size={18} />
                Emergency recipients{" "}
                <span className="count">{filtered.length}</span>
              </h2>
              <p>
                Filter by Staff, Worker, Office, or Designation and select who
                receives the notice.
              </p>
            </div>
          </div>

          <div className="table-tools">
            <label className="search-box">
              <Search size={17} />
              <input
                aria-label="Search emergency recipients"
                placeholder="Search name, ID, designation, or phone…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
              />
            </label>
            <div className="filter-row">
              <SlidersHorizontal size={15} />
              <select
                aria-label="Filter by employee type"
                value={employeeTypeFilter}
                onChange={(e) => {
                  setEmployeeTypeFilter(e.target.value);
                  setPage(0);
                }}
              >
                <option value="">All employee types</option>
                {typeCounts.map(([type]) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <select
                aria-label="Filter by designation"
                value={designationFilter}
                onChange={(e) => {
                  setDesignationFilter(e.target.value);
                  setPage(0);
                }}
              >
                <option value="">All designations</option>
                {designations.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              {(search ||
                employeeTypeFilter ||
                designationFilter ||
                phoneFilter !== "all") && (
                <button
                  type="button"
                  className="text-button"
                  onClick={resetFilters}
                >
                  Reset filters
                  <X size={13} />
                </button>
              )}
              <span className="filter-count">{filtered.length} matching</span>
            </div>
          </div>

          <div className="selection-bar">
            <label>
              <input
                type="checkbox"
                checked={allFilteredSelected}
                onChange={() => {
                  const ids = filtered.map((r) => r.employeeId);
                  setSelectedIds((prev) => {
                    const next = new Set(prev);
                    if (allFilteredSelected) {
                      ids.forEach((id) => next.delete(id));
                    } else {
                      ids.forEach((id) => next.add(id));
                    }
                    return next;
                  });
                }}
              />
              Select filtered ({filtered.length})
            </label>
            <button
              type="button"
              className="text-button"
              onClick={() => {
                const validIds = filtered
                  .filter((r) => normalizePhoneNumber(r.mobileNo).isValid)
                  .map((r) => r.employeeId);
                setSelectedIds((prev) => new Set([...prev, ...validIds]));
              }}
            >
              Select valid phones
            </button>
            {validSelectedIds.size > 0 && (
              <button
                type="button"
                className="text-button"
                onClick={() => setSelectedIds(new Set())}
              >
                Clear selection
              </button>
            )}
          </div>

          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>
                    <span className="sr-only">Select recipient</span>
                  </th>
                  <th>Employee</th>
                  <th>Designation</th>
                  <th>Type</th>
                  <th>Mobile number</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => {
                  const info = normalizePhoneNumber(r.mobileNo);
                  const isSelected = validSelectedIds.has(r.employeeId);
                  return (
                    <tr
                      key={r.employeeId}
                      className={isSelected ? "selected-row" : ""}
                    >
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Select ${r.name} (${r.employeeId})`}
                          checked={isSelected}
                          onChange={() =>
                            setSelectedIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(r.employeeId))
                                next.delete(r.employeeId);
                              else next.add(r.employeeId);
                              return next;
                            })
                          }
                        />
                      </td>
                      <td>
                        <strong>{r.name}</strong>
                        <small>{r.employeeId}</small>
                      </td>
                      <td>{r.designation || "—"}</td>
                      <td>
                        <span
                          className={`badge ${typeBadgeColor(r.employeeType)}`}
                        >
                          {r.employeeType || "Unspecified"}
                        </span>
                      </td>
                      <td>
                        {editingId === r.employeeId ? (
                          <div className="phone-edit">
                            <input
                              aria-label={`Emergency mobile for ${r.name}`}
                              value={editPhone}
                              onChange={(e) => setEditPhone(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  onUpdatePhone(
                                    r.employeeId,
                                    editPhone.trim(),
                                  );
                                  setEditingId(null);
                                }
                                if (e.key === "Escape") setEditingId(null);
                              }}
                              autoFocus
                            />
                            <button
                              type="button"
                              className="icon-button"
                              aria-label="Save emergency phone"
                              onClick={() => {
                                onUpdatePhone(r.employeeId, editPhone.trim());
                                setEditingId(null);
                              }}
                            >
                              <Check size={15} />
                            </button>
                            <button
                              type="button"
                              className="icon-button"
                              aria-label="Cancel emergency phone edit"
                              onClick={() => setEditingId(null)}
                            >
                              <X size={15} />
                            </button>
                          </div>
                        ) : (
                          <div className="phone-value">
                            <span className={info.isValid ? "" : "danger"}>
                              {info.normalized || "Missing number"}
                            </span>
                            <button
                              type="button"
                              className="icon-button"
                              aria-label={`Edit emergency phone for ${r.name}`}
                              onClick={() => {
                                setEditPhone(r.mobileNo);
                                setEditingId(r.employeeId);
                              }}
                            >
                              <Pencil size={13} />
                            </button>
                          </div>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="icon-button"
                          aria-label={`Send emergency SMS to ${r.name}`}
                          disabled={!info.isValid || !message.trim() || busy}
                          onClick={() =>
                            onTriggerSend(message, [r], formattedNoticeDate)
                          }
                        >
                          <Send size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!visible.length && (
                  <tr>
                    <td colSpan={6} className="no-results">
                      No matching employees.{" "}
                      <button
                        type="button"
                        className="text-button"
                        onClick={resetFilters}
                      >
                        Reset filters
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <footer className="table-footer">
            <span>
              <strong>{validSelectedIds.size}</strong> selected for emergency
              SMS
            </span>
            <div>
              <button
                type="button"
                className="icon-button"
                aria-label="Previous emergency page"
                disabled={currentPage === 0}
                onClick={() => setPage(currentPage - 1)}
              >
                <ChevronLeft size={16} />
              </button>
              <span>
                {currentPage + 1} / {pages}
              </span>
              <button
                type="button"
                className="icon-button"
                aria-label="Next emergency page"
                disabled={currentPage + 1 >= pages}
                onClick={() => setPage(currentPage + 1)}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </footer>
        </section>

        <section
          className="panel composer-panel"
          aria-labelledby="emergency-composer-title"
        >
          <div className="panel-heading">
            <div>
              <h2 id="emergency-composer-title">
                <Megaphone size={18} />
                Emergency Message
              </h2>
              <p>Prepare urgent factory notices like emergency chuti.</p>
            </div>
            <span className="badge rose">Urgent</span>
          </div>

          <div className="composer-body">
            <label className="field">
              Notice / Chuti date
              <div className="input-action-row">
                <CalendarDays size={16} />
                <input
                  type="date"
                  aria-label="Emergency notice date"
                  value={noticeDate}
                  onChange={(e) => {
                    if (e.target.value) setNoticeDate(e.target.value);
                  }}
                />
              </div>
            </label>

            <label className="field">
              Emergency template
              <select
                aria-label="Emergency template"
                value={templateId}
                onChange={(e) => {
                  setTemplateId(e.target.value);
                  const tpl = EMERGENCY_TEMPLATES.find(
                    (t) => t.id === e.target.value,
                  );
                  if (tpl) setMessage(tpl.text);
                }}
              >
                {EMERGENCY_TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
                <option value="custom">Custom emergency message</option>
              </select>
            </label>

            <label className="field">
              Emergency SMS message
              <textarea
                ref={textareaRef}
                aria-label="Emergency SMS message"
                rows={5}
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  setTemplateId("custom");
                }}
                placeholder="Write your emergency notice…"
              />
            </label>

            <div className="variable-row">
              <span>Personalize:</span>
              {["Name", "ID", "Designation", "EmployeeType", "Date"].map(
                (tag) => (
                  <button
                    type="button"
                    key={tag}
                    onClick={() => insertTag(`{${tag}}`)}
                  >
                    <Plus size={10} />
                    {tag}
                  </button>
                ),
              )}
            </div>

            <div className="message-stats">
              <span>
                {previewStats.charCount} characters · {previewStats.parts} parts
              </span>
              <span>{previewStats.isUnicode ? "Unicode" : "GSM-7"}</span>
            </div>

            <div className="preview-heading">
              <span>
                <Eye size={15} />
                Recipient preview
              </span>
              {previewTargets.length > 1 && (
                <div>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Previous emergency preview recipient"
                    onClick={() =>
                      setPreviewIndex(
                        (safePreviewIndex - 1 + previewTargets.length) %
                          previewTargets.length,
                      )
                    }
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <small>
                    {safePreviewIndex + 1}/{previewTargets.length}
                  </small>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Next emergency preview recipient"
                    onClick={() =>
                      setPreviewIndex(
                        (safePreviewIndex + 1) % previewTargets.length,
                      )
                    }
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>

            <div className="message-preview">
              <div>
                <span className="sender-avatar">
                  <MessageSquare size={16} />
                </span>
                <div>
                  <strong>{senderId || "KADW-HR"}</strong>
                  <small>
                    To: {previewRecord.name} ({previewRecord.employeeId})
                  </small>
                </div>
              </div>
              <p lang={previewStats.isUnicode ? "bn" : "en"}>
                {renderedPreview || "Your emergency message preview will appear here."}
              </p>
              <small>
                Preview only · {previewStats.parts} SMS parts for this recipient
              </small>
            </div>

            <div className="send-summary">
              <div>
                <span>Ready to send</span>
                <strong>
                  {validRecipients.length}{" "}
                  {validRecipients.length === 1 ? "recipient" : "recipients"}
                </strong>
              </div>
              <div>
                <span>Estimated cost</span>
                <strong>৳{totalCost}</strong>
              </div>
            </div>

            {selectedRecords.length > validRecipients.length && (
              <p className="warning-note">
                {selectedRecords.length - validRecipients.length} selected
                employees have invalid numbers and will be skipped.
              </p>
            )}

            <button
              type="button"
              className="btn btn-primary send-button"
              disabled={!validRecipients.length || !message.trim() || busy}
              onClick={() =>
                onTriggerSend(message, selectedRecords, formattedNoticeDate)
              }
            >
              <Send size={17} />
              {simulation
                ? "Review emergency simulation"
                : "Review & send emergency SMS"}
            </button>

            <p className="composer-footnote">
              <CircleHelp size={13} />
              {simulation
                ? "Simulation is on. No real SMS or charges."
                : "Review recipients and cost before sending."}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
