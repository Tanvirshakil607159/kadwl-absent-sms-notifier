import { useState } from "react";
import ContentFrame from "./ContentFrame";
import { parseAttendanceText } from "../utils/smsUtils";
export default function PasteModal({
  embedded = false,
  onClose,
  onDataParsed,
  recordsCount,
}) {
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState(""),
    [error, setError] = useState("");
  async function submit() {
    setLoading(true);
    try {
      const result = await parseAttendanceText(text);
      onDataParsed(result.records, result.detectedAbsentDate);
      if (embedded) {
        setText("");
        setError("");
      } else onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <ContentFrame
      embedded={embedded}
      title="Paste your attendance list"
      description="Copy cells from Excel or your ERP, including the column headers."
      onClose={onClose}
      locked={loading}
      footer={
        <>
          <button
            className="btn"
            disabled={loading}
            onClick={() => {
              if (embedded) {
                setText("");
                setError("");
              } else onClose();
            }}
          >
            {embedded ? "Clear paste" : "Cancel"}
          </button>
          <button
            className="btn btn-primary"
            disabled={loading || !text.trim()}
            onClick={submit}
          >
            Import pasted employees
          </button>
        </>
      }
    >
      <label className="field">
        Attendance rows
        <textarea
          disabled={loading}
          rows={9}
          className="paste-input"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (error) setError("");
          }}
          placeholder={
            "Employee ID\tName\tMobile No\nEMP001\tEmployee Name\t01712345678"
          }
        />
      </label>
      {error && (
        <p className="error-note" role="alert">
          {error}
        </p>
      )}
      <p className="help-text">
        Without headers, use 3 columns (ID, Name, Mobile) or all 9 template
        columns. Tab-separated and CSV rows are supported.
        {recordsCount > 0 &&
          ` This replaces the current ${recordsCount} employees.`}
      </p>
    </ContentFrame>
  );
}
