import { useState } from "react";
import { Download, Search, History, Trash2 } from "lucide-react";
import ContentFrame from "./ContentFrame";
import { exportDispatchHistoryReport } from "../utils/smsUtils";
export default function HistoryLogModal({
  embedded = false,
  onClose,
  historyLogs,
  onClearHistory,
}) {
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [confirmClear, setConfirmClear] = useState(false);
  const logs = historyLogs.filter(
    (log) =>
      (!status || log.status === status) &&
      [log.name, log.employeeId, log.mobile, log.message].some((v) =>
        String(v).toLowerCase().includes(search.trim().toLowerCase()),
      ),
  );
  return (
    <ContentFrame
      embedded={embedded}
      title="Message history"
      description="Gateway acceptance is not a delivery receipt. Simulations are labeled separately."
      onClose={onClose}
      wide
      footer={
        !embedded && (
          <button className="btn" onClick={onClose}>
            Close
          </button>
        )
      }
    >
      <div className="history-tools">
        <label className="search-box">
          <Search size={16} />
          <input
            aria-label="Search message history"
            placeholder="Search name, ID, or message…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <select
          aria-label="Filter message status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          {["Sent", "Simulated", "Failed", "Invalid Number"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <button
          className="btn"
          disabled={!logs.length}
          onClick={() => exportDispatchHistoryReport(logs)}
        >
          <Download size={15} />
          Export Excel
        </button>
      </div>
      {logs.length ? (
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Message</th>
                <th>Status</th>
                <th>Cost</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, i) => (
                <tr key={log.id || i}>
                  <td>
                    <strong>{log.name}</strong>
                    <small>
                      {log.employeeId} · {log.mobile}
                    </small>
                    <small>{log.timestamp}</small>
                  </td>
                  <td>
                    <details>
                      <summary>View message & response</summary>
                      <p className="history-message">{log.message}</p>
                      <small>{log.gatewayResponse}</small>
                    </details>
                  </td>
                  <td>
                    <span
                      className={`badge ${log.status === "Sent" ? "green" : log.status === "Simulated" ? "blue" : "rose"}`}
                    >
                      {log.status}
                    </span>
                  </td>
                  <td>৳{Number(log.cost || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="history-empty">
          <History size={32} />
          <h3>
            {historyLogs.length
              ? "No matching messages"
              : "Your message history will appear here"}
          </h3>
          <p>
            Sent messages, simulations, and errors stay available in this
            browser.
          </p>
        </div>
      )}
      {historyLogs.length > 0 && (
        <div className="clear-history">
          {confirmClear ? (
            <>
              <p>
                Delete all {historyLogs.length} history entries? This cannot be
                undone.
              </p>
              <button
                className="btn btn-danger"
                onClick={() => {
                  onClearHistory();
                  setConfirmClear(false);
                }}
              >
                Delete history
              </button>
              <button className="btn" onClick={() => setConfirmClear(false)}>
                Keep history
              </button>
            </>
          ) : (
            <button
              className="text-button danger"
              onClick={() => setConfirmClear(true)}
            >
              <Trash2 size={14} />
              Clear history
            </button>
          )}
        </div>
      )}
    </ContentFrame>
  );
}
