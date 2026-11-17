import { useMemo, useState } from "react";
import {
  Search,
  SlidersHorizontal,
  ArrowDownUp,
  Pencil,
  Check,
  X,
  Send,
  Users,
  Upload,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from "lucide-react";
import { normalizePhoneNumber } from "../utils/smsUtils";
export default function AbsentTable({
  records,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onDeselectAll,
  onUpdatePhone,
  onSingleSend,
  activeQuickFilter,
  setActiveQuickFilter,
  onOpenUpload,
  onClearRecords,
  busy,
}) {
  const [search, setSearch] = useState("");
  const [line, setLine] = useState("");
  const [shift, setShift] = useState("");
  const [sort, setSort] = useState({ field: "sl", asc: true });
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState(null);
  const [phone, setPhone] = useState("");
  const lines = [...new Set(records.map((r) => r.line).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b, undefined, { numeric: true }),
  );
  const shifts = [...new Set(records.map((r) => r.shift).filter(Boolean))];
  const filtered = useMemo(
    () =>
      records
        .filter((r) => {
          const q = search.trim().toLowerCase();
          if (
            q &&
            ![r.name, r.employeeId, r.mobileNo, r.designation, r.line].some(
              (v) => String(v).toLowerCase().includes(q),
            )
          )
            return false;
          if ((line && r.line !== line) || (shift && r.shift !== shift))
            return false;
          return (
            activeQuickFilter === "all" ||
            (activeQuickFilter === "1day" && r.absentDays === 1) ||
            (activeQuickFilter === "2to3" &&
              r.absentDays >= 2 &&
              r.absentDays <= 3) ||
            (activeQuickFilter === "4plus" && r.absentDays >= 4) ||
            (activeQuickFilter === "invalidPhone" &&
              !normalizePhoneNumber(r.mobileNo).isValid)
          );
        })
        .sort(
          (a, b) =>
            (typeof a[sort.field] === "number"
              ? a[sort.field] - b[sort.field]
              : String(a[sort.field]).localeCompare(String(b[sort.field]))) *
            (sort.asc ? 1 : -1),
        ),
    [records, search, line, shift, activeQuickFilter, sort],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 10));
  const currentPage = Math.min(page, pages - 1);
  const visible = filtered.slice(currentPage * 10, currentPage * 10 + 10);
  const allSelected =
    filtered.length > 0 && filtered.every((r) => selectedIds.has(r.employeeId));
  function toggleAll() {
    const ids = filtered.map((r) => r.employeeId);
    if (allSelected) onDeselectAll(ids);
    else onSelectAll(ids);
  }
  function reset() {
    setSearch("");
    setLine("");
    setShift("");
    setActiveQuickFilter("all");
    setPage(0);
  }
  function sortBy(field) {
    setSort({ field, asc: sort.field === field ? !sort.asc : true });
    setPage(0);
  }
  return (
    <section className="panel employee-panel" aria-labelledby="employees-title">
      <div className="panel-heading">
        <div>
          <h2 id="employees-title">
            <Users size={18} />
            Employee list <span className="count">{records.length}</span>
          </h2>
          <p>Review attendance and choose your recipients.</p>
        </div>
        {records.length > 0 && (
          <button
            className="icon-button danger"
            aria-label="Clear employee list"
            onClick={onClearRecords}
            disabled={busy}
          >
            <Trash2 size={17} />
          </button>
        )}
      </div>
      <div className="table-tools">
        <label className="search-box">
          <Search size={17} />
          <input
            aria-label="Search employees"
            placeholder="Search name, ID, or phone…"
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
            aria-label="Filter by line"
            value={line}
            onChange={(e) => {
              setLine(e.target.value);
              setPage(0);
            }}
          >
            <option value="">All lines</option>
            {lines.map((l) => (
              <option key={l} value={l}>
                Line {l}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by shift"
            value={shift}
            onChange={(e) => {
              setShift(e.target.value);
              setPage(0);
            }}
          >
            <option value="">All shifts</option>
            {shifts.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          {(search || line || shift || activeQuickFilter !== "all") && (
            <button className="text-button" onClick={reset}>
              Reset filters
              <X size={13} />
            </button>
          )}
          <span className="filter-count">{filtered.length} employees</span>
        </div>
      </div>
      {records.length === 0 ? (
        <div className="empty-state">
          <div className="empty-illustration">
            <Users size={36} />
            <span>
              <Check size={15} />
            </span>
          </div>
          <h3>Your team’s day starts here</h3>
          <p>
            Import an attendance report to see absent employees
            <br />
            and send your first follow-up.
          </p>
          <button className="btn btn-primary" onClick={onOpenUpload}>
            <Upload size={16} />
            Import attendance
          </button>
          <small>Excel & CSV supported · Your data stays in this browser</small>
        </div>
      ) : (
        <>
          <div className="selection-bar">
            <label>
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
              />
              Select filtered ({filtered.length})
            </label>
            <button
              className="text-button"
              onClick={() =>
                onSelectAll(
                  filtered
                    .filter((r) => normalizePhoneNumber(r.mobileNo).isValid)
                    .map((r) => r.employeeId),
                )
              }
            >
              Select valid phones
            </button>
            {selectedIds.size > 0 && (
              <button
                className="text-button"
                onClick={() => onDeselectAll([...selectedIds])}
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
                    <span className="sr-only">Select employee</span>
                  </th>
                  <th
                    aria-sort={
                      sort.field === "name"
                        ? sort.asc
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    <button onClick={() => sortBy("name")}>
                      Employee
                      <ArrowDownUp size={12} />
                    </button>
                  </th>
                  <th>Line / shift</th>
                  <th
                    aria-sort={
                      sort.field === "absentDays"
                        ? sort.asc
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    <button onClick={() => sortBy("absentDays")}>
                      Absent
                      <ArrowDownUp size={12} />
                    </button>
                  </th>
                  <th>Mobile number</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => {
                  const info = normalizePhoneNumber(r.mobileNo);
                  return (
                    <tr
                      key={r.employeeId}
                      className={
                        selectedIds.has(r.employeeId) ? "selected-row" : ""
                      }
                    >
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Select ${r.name}`}
                          checked={selectedIds.has(r.employeeId)}
                          onChange={() => onToggleSelect(r.employeeId)}
                        />
                      </td>
                      <td>
                        <strong>{r.name}</strong>
                        <small>
                          {r.employeeId}
                          {r.designation ? ` · ${r.designation}` : ""}
                        </small>
                      </td>
                      <td>
                        {r.line ? `Line ${r.line}` : "—"}
                        <small>{r.shift || "—"}</small>
                      </td>
                      <td>
                        <span
                          className={`badge ${r.absentDays >= 4 ? "rose" : r.absentDays >= 2 ? "amber" : "green"}`}
                        >
                          {r.absentDays} {r.absentDays === 1 ? "day" : "days"}
                        </span>
                        <small title="Last present date">
                          {r.lastPresentDate || "No previous date"}
                        </small>
                      </td>
                      <td>
                        {editing === r.employeeId ? (
                          <div className="phone-edit">
                            <input
                              aria-label={`Mobile number for ${r.name}`}
                              value={phone}
                              onChange={(e) => setPhone(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  onUpdatePhone(r.employeeId, phone.trim());
                                  setEditing(null);
                                }
                                if (e.key === "Escape") setEditing(null);
                              }}
                              autoFocus
                            />
                            <button
                              className="icon-button"
                              aria-label="Save phone number"
                              onClick={() => {
                                onUpdatePhone(r.employeeId, phone.trim());
                                setEditing(null);
                              }}
                            >
                              <Check size={15} />
                            </button>
                            <button
                              className="icon-button"
                              aria-label="Cancel phone edit"
                              onClick={() => setEditing(null)}
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
                              className="icon-button"
                              aria-label={`Edit phone for ${r.name}`}
                              onClick={() => {
                                setPhone(r.mobileNo);
                                setEditing(r.employeeId);
                              }}
                            >
                              <Pencil size={13} />
                            </button>
                          </div>
                        )}
                      </td>
                      <td>
                        <button
                          className="icon-button"
                          aria-label={`Preview SMS for ${r.name}`}
                          disabled={!info.isValid || busy}
                          onClick={() => onSingleSend(r)}
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
                      <button className="text-button" onClick={reset}>
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
              <strong>{selectedIds.size}</strong> selected for messaging
            </span>
            <div>
              <button
                className="icon-button"
                aria-label="Previous employee page"
                disabled={currentPage === 0}
                onClick={() => setPage(currentPage - 1)}
              >
                <ChevronLeft size={16} />
              </button>
              <span>
                {currentPage + 1} / {pages}
              </span>
              <button
                className="icon-button"
                aria-label="Next employee page"
                disabled={currentPage + 1 >= pages}
                onClick={() => setPage(currentPage + 1)}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </footer>
        </>
      )}
    </section>
  );
}
