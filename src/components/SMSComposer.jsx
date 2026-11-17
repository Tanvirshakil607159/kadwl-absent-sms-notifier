import { useRef, useState } from "react";
import {
  MessageSquare,
  Send,
  Eye,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Plus,
} from "lucide-react";
import {
  DEFAULT_TEMPLATES,
  calculateSMSStats,
  renderTemplate,
  normalizePhoneNumber,
} from "../utils/smsUtils";
export default function SMSComposer({
  selectedRecords,
  allRecords,
  absentDate,
  onTriggerBulkSend,
  gatewayRate,
  senderId,
  simulation,
  busy,
}) {
  const [templateId, setTemplateId] = useState(DEFAULT_TEMPLATES[0].id);
  const [message, setMessage] = useState(DEFAULT_TEMPLATES[0].text);
  const [preview, setPreview] = useState(0);
  const textarea = useRef(null);
  const targets = selectedRecords.length ? selectedRecords : allRecords;
  const index = Math.min(preview, Math.max(0, targets.length - 1));
  const record = targets[index] || {
    name: "Employee Name",
    employeeId: "EMP001",
    line: "1",
    absentDays: 1,
  };
  const rendered = renderTemplate(message, record, absentDate);
  const stats = calculateSMSStats(rendered, gatewayRate);
  const valid = selectedRecords.filter(
    (r) => normalizePhoneNumber(r.mobileNo).isValid,
  );
  const total = valid
    .reduce(
      (sum, r) =>
        sum +
        calculateSMSStats(renderTemplate(message, r, absentDate), gatewayRate)
          .cost,
      0,
    )
    .toFixed(2);
  function insert(tag) {
    const start = textarea.current?.selectionStart ?? message.length,
      end = textarea.current?.selectionEnd ?? message.length;
    setMessage(message.slice(0, start) + tag + message.slice(end));
    setTemplateId("custom");
    requestAnimationFrame(() => {
      textarea.current?.focus();
      textarea.current?.setSelectionRange(
        start + tag.length,
        start + tag.length,
      );
    });
  }
  return (
    <section
      className="panel composer-panel"
      id="composer"
      aria-labelledby="composer-title"
    >
      <div className="panel-heading">
        <div>
          <h2 id="composer-title">
            <MessageSquare size={18} />
            Message composer
          </h2>
          <p>A personal reminder goes a long way.</p>
        </div>
        <span className="badge green">SMS</span>
      </div>
      <div className="composer-body">
        <label className="field">
          Message template
          <select
            value={templateId}
            onChange={(e) => {
              setTemplateId(e.target.value);
              const tpl = DEFAULT_TEMPLATES.find(
                (t) => t.id === e.target.value,
              );
              if (tpl) setMessage(tpl.text);
            }}
          >
            {DEFAULT_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
            <option value="custom">Custom message</option>
          </select>
        </label>
        <label className="field">
          Your message
          <textarea
            aria-label="Your message"
            ref={textarea}
            rows={5}
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              setTemplateId("custom");
            }}
            placeholder="Write your attendance reminder…"
          />
        </label>
        <div className="variable-row">
          <span>Personalize:</span>
          {[
            "Name",
            "ID",
            "Date",
            "AbsentDays",
            "Line",
            "Shift",
            "LastPresentDate",
          ].map((tag) => (
            <button key={tag} onClick={() => insert(`{${tag}}`)}>
              <Plus size={10} />
              {tag}
            </button>
          ))}
        </div>
        <div className="message-stats">
          <span>
            {stats.charCount} characters · {stats.parts} parts
          </span>
          <span>{stats.isUnicode ? "Unicode" : "GSM-7"}</span>
        </div>
        <div className="preview-heading">
          <span>
            <Eye size={15} />
            Recipient preview
          </span>
          {targets.length > 1 && (
            <div>
              <button
                className="icon-button"
                aria-label="Previous preview recipient"
                onClick={() =>
                  setPreview((index - 1 + targets.length) % targets.length)
                }
              >
                <ChevronLeft size={14} />
              </button>
              <small>
                {index + 1}/{targets.length}
              </small>
              <button
                className="icon-button"
                aria-label="Next preview recipient"
                onClick={() => setPreview((index + 1) % targets.length)}
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
                {targets.length ? `To: ${record.name}` : "Example recipient"}
              </small>
            </div>
          </div>
          <p lang={stats.isUnicode ? "bn" : "en"}>
            {rendered || "Your message preview will appear here."}
          </p>
          <small>
            Preview only · {stats.parts} SMS parts for this recipient
          </small>
        </div>
        <div className="send-summary">
          <div>
            <span>Ready to send</span>
            <strong>
              {valid.length} {valid.length === 1 ? "recipient" : "recipients"}
            </strong>
          </div>
          <div>
            <span>Estimated cost</span>
            <strong>৳{total}</strong>
          </div>
        </div>
        {selectedRecords.length > valid.length && (
          <p className="warning-note">
            {selectedRecords.length - valid.length} selected employees have
            invalid numbers and will be skipped.
          </p>
        )}
        <button
          className="btn btn-primary send-button"
          disabled={!valid.length || !message.trim() || busy}
          onClick={() => onTriggerBulkSend(message)}
        >
          <Send size={17} />
          {simulation ? "Review simulation" : "Review & send SMS"}
        </button>
        <p className="composer-footnote">
          <CircleHelp size={13} />
          {simulation
            ? "Simulation is on. No real SMS or charges."
            : "Review recipients and cost before sending."}
        </p>
      </div>
    </section>
  );
}
