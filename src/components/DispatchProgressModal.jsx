import { CheckCircle2, LoaderCircle, CircleStop } from "lucide-react";
import Dialog from "./Dialog";
export default function DispatchProgressModal({
  progress,
  total,
  currentEmployee,
  logs,
  isComplete,
  cancelling,
  cancelled,
  error,
  onClose,
  onCancel,
}) {
  const simulated = logs.filter((l) => l.status === "Simulated").length;
  const sent = logs.filter((l) => l.status === "Sent").length;
  const failed = logs.filter((l) => l.status === "Failed").length;
  return (
    <Dialog
      title={
        isComplete
          ? cancelled || error
            ? "Dispatch stopped"
            : "Dispatch complete"
          : cancelling
            ? "Stopping after current message…"
            : "Sending your reminders"
      }
      description={
        isComplete
          ? `${progress} of ${total} recipients processed.`
          : "Keep this page open until processing finishes."
      }
      locked={!isComplete}
      onClose={onClose}
      footer={
        isComplete ? (
          <button className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        ) : (
          <button
            className="btn btn-danger"
            disabled={cancelling}
            onClick={onCancel}
          >
            <CircleStop size={16} />
            {cancelling ? "Stopping…" : "Stop after current message"}
          </button>
        )
      }
    >
      <div className="dispatch-status">
        {isComplete ? (
          <CheckCircle2 size={35} />
        ) : (
          <LoaderCircle className="spin" size={35} />
        )}
        <p>
          {isComplete
            ? "Results have been saved to message history."
            : `Processing ${currentEmployee?.name || "recipient"}…`}
        </p>
      </div>
      <progress
        aria-label="Message dispatch progress"
        value={progress}
        max={total || 1}
      />
      {error && (
        <p className="error-note" role="alert">
          {error}
        </p>
      )}
      <div className="dispatch-counts">
        <span>
          <strong>{sent}</strong>Accepted
        </span>
        <span>
          <strong>{simulated}</strong>Simulated
        </span>
        <span>
          <strong>{failed}</strong>Failed
        </span>
      </div>
      <div className="dispatch-log" aria-live="polite">
        {logs.map((log) => (
          <div key={log.id}>
            <span>{log.name}</span>
            <span
              className={`badge ${log.status === "Sent" ? "green" : log.status === "Simulated" ? "blue" : "rose"}`}
            >
              {log.status}
            </span>
          </div>
        ))}
      </div>
    </Dialog>
  );
}
