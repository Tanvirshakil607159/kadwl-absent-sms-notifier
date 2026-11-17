import { useRef, useState } from "react";
import { UploadCloud, Download, FileCheck2, AlertCircle } from "lucide-react";
import ContentFrame from "./ContentFrame";
import {
  parseAttendanceFile,
  exportSampleExcelTemplate,
} from "../utils/smsUtils";
export default function UploadModal({
  embedded = false,
  onClose,
  onDataLoaded,
  recordsCount,
}) {
  const [dragging, setDragging] = useState(false),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [result, setResult] = useState(null);
  const input = useRef(null);
  const sequence = useRef(0);
  async function process(file) {
    if (!file) return;
    const id = ++sequence.current;
    setResult(null);
    setError("");
    setLoading(false);
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      setError("Choose an Excel (.xlsx, .xls) or CSV file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Please use a file smaller than 10 MB.");
      return;
    }
    setLoading(true);
    try {
      const data = await parseAttendanceFile(file);
      if (sequence.current === id) setResult({ ...data, name: file.name });
    } catch (err) {
      if (sequence.current === id) setError(err.message);
    } finally {
      if (sequence.current === id) setLoading(false);
    }
  }
  return (
    <ContentFrame
      embedded={embedded}
      title="Import attendance"
      description="Bring your employee list from Excel or your ERP export."
      onClose={onClose}
      footer={
        <>
          <button
            className="btn"
            onClick={() => {
              if (embedded) {
                sequence.current++;
                setResult(null);
                setError("");
                setLoading(false);
              } else onClose();
            }}
          >
            {embedded ? "Reset file" : "Cancel"}
          </button>
          <button
            className="btn btn-primary"
            disabled={!result || loading}
            onClick={() => {
              onDataLoaded(result.records, result.detectedAbsentDate);
              if (embedded) {
                setResult(null);
                setError("");
              } else onClose();
            }}
          >
            Import {result?.records.length || ""} employees
          </button>
        </>
      }
    >
      <button
        className={`dropzone ${dragging ? "dragging" : ""}`}
        onClick={() => input.current.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          process(e.dataTransfer.files[0]);
        }}
      >
        <UploadCloud size={36} />
        <strong>Drop your report here, or browse files</strong>
        <span>XLSX, XLS, or CSV · up to 10 MB</span>
      </button>
      <input
        ref={input}
        className="sr-only"
        type="file"
        aria-label="Attendance file"
        accept=".xlsx,.xls,.csv"
        onChange={(e) => {
          process(e.target.files[0]);
          e.target.value = "";
        }}
      />
      {loading && <p role="status">Reading your attendance report…</p>}
      {error && (
        <p className="error-note" role="alert">
          <AlertCircle size={17} />
          {error}
        </p>
      )}
      {result && (
        <div className="success-note">
          <FileCheck2 size={22} />
          <div>
            <strong>{result.name}</strong>
            <p>{result.records.length} employee records ready to import.</p>
          </div>
        </div>
      )}
      <p className="help-text">
        Employee ID and Name columns are required. Phone numbers can be
        corrected after import.
        {recordsCount > 0 &&
          ` Importing replaces the current ${recordsCount} employees.`}
      </p>
      <button className="text-button" onClick={exportSampleExcelTemplate}>
        <Download size={15} />
        Download the Excel template
      </button>
    </ContentFrame>
  );
}
