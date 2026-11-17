import { useState } from "react";
import {
  AlertCircle,
  Eye,
  EyeOff,
  FlaskConical,
  Radio,
  Send,
  Wallet,
} from "lucide-react";
import ContentFrame from "./ContentFrame";
import {
  checkBulkSMSBDBalance,
  sendSingleSMS,
  validateGateway,
} from "../utils/smsService";
import { normalizePhoneNumber } from "../utils/smsUtils";

function normalizeConfig(cfg) {
  return {
    ...cfg,
    apiKey: typeof cfg.apiKey === "string" ? cfg.apiKey.trim() : "",
    senderId: typeof cfg.senderId === "string" ? cfg.senderId.trim() : "",
    customUrl: typeof cfg.customUrl === "string" ? cfg.customUrl.trim() : "",
    customParamMobile:
      typeof cfg.customParamMobile === "string"
        ? cfg.customParamMobile.trim()
        : "",
    customParamMessage:
      typeof cfg.customParamMessage === "string"
        ? cfg.customParamMessage.trim()
        : "",
    customParamKey:
      typeof cfg.customParamKey === "string" ? cfg.customParamKey.trim() : "",
  };
}

export default function GatewaySettingsModal({
  embedded = false,
  onClose,
  gatewayConfig,
  onSaveConfig,
}) {
  const [config, setConfig] = useState({ ...gatewayConfig });
  const [phone, setPhone] = useState(""),
    [testing, setTesting] = useState(false),
    [checkingBalance, setCheckingBalance] = useState(false),
    [showApiKey, setShowApiKey] = useState(false),
    [feedback, setFeedback] = useState(null);

  const busy = testing || checkingBalance;
  const isDirty = JSON.stringify(config) !== JSON.stringify(gatewayConfig);

  function update(key, value) {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setFeedback(null);
  }
  function save() {
    const cleaned = normalizeConfig(config);
    const error = validateGateway(cleaned);
    if (error) {
      setFeedback({ success: false, response: error });
      return;
    }
    setConfig(cleaned);
    setFeedback(null);
    onSaveConfig(cleaned);
    if (!embedded) onClose();
  }
  async function checkBalance() {
    setCheckingBalance(true);
    setFeedback(null);
    try {
      const result = await checkBulkSMSBDBalance(config.apiKey);
      setFeedback(result);
    } finally {
      setCheckingBalance(false);
    }
  }
  async function test() {
    setTesting(true);
    setFeedback(null);
    try {
      const cleaned = normalizeConfig(config);
      const configError = validateGateway(cleaned);
      if (configError) {
        setFeedback({ success: false, response: configError });
        return;
      }
      const result = await sendSingleSMS(
        { phoneInfo: normalizePhoneNumber(phone) },
        "K.A. Design Wear Ltd: SMS connection test.",
        { ...cleaned, delayBetweenSMS: 0 },
      );
      setFeedback(result);
    } finally {
      setTesting(false);
    }
  }
  return (
    <ContentFrame
      embedded={embedded}
      title="Gateway settings"
      description="Choose simulation or connect your SMS provider."
      onClose={onClose}
      locked={busy}
      footer={
        <>
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => {
              if (embedded) {
                setConfig({ ...gatewayConfig });
                setFeedback(null);
              } else onClose();
            }}
          >
            {embedded ? "Reset changes" : "Cancel"}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={save}
          >
            Save settings
          </button>
        </>
      }
    >
      {isDirty && (
        <div className="info-note" role="status">
          <AlertCircle size={18} />
          You have unsaved changes. Click Save settings to apply them before
          sending.
        </div>
      )}
      <label className="field">
        SMS provider
        <select
          value={config.provider}
          onChange={(e) => update("provider", e.target.value)}
        >
          <option value="simulation">Simulation — no actual messages</option>
          <option value="greenweb">Greenweb BD</option>
          <option value="bulksmsbd">BulkSMS (bulksmsbd.net)</option>
          <option value="custom">Custom HTTPS gateway</option>
        </select>
      </label>
      <div className="info-note">
        {config.provider === "simulation" ? (
          <FlaskConical size={21} />
        ) : (
          <Radio size={21} />
        )}
        <p>
          {config.provider === "simulation"
            ? "Practice the complete workflow without sending messages or spending your balance."
            : "Live mode sends real SMS. Use your provider’s approved sender ID. Your browser must be allowed by the provider’s CORS settings."}
        </p>
      </div>
      {config.provider !== "simulation" && (
        <div className="field">
          <label htmlFor="gateway-api-key">API key</label>
          <div className="input-action-row">
            <input
              id="gateway-api-key"
              type={showApiKey ? "text" : "password"}
              aria-label="API key"
              aria-describedby="api-key-help"
              autoComplete="off"
              value={config.apiKey}
              onChange={(e) => update("apiKey", e.target.value)}
              placeholder="Your provider API key"
            />
            <button
              type="button"
              className="btn"
              aria-label={showApiKey ? "Hide API key" : "Show API key"}
              onClick={() => setShowApiKey((prev) => !prev)}
            >
              {showApiKey ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <small id="api-key-help">
            Loaded from local environment when configured; custom edits stay in
            memory for this session only.
          </small>
        </div>
      )}
      <div className="form-grid">
        <div className="field">
          <label htmlFor="gateway-sender-id">Sender ID</label>
          <input
            id="gateway-sender-id"
            aria-describedby={
              config.provider === "bulksmsbd" ? "sender-id-help" : undefined
            }
            value={config.senderId}
            onChange={(e) => update("senderId", e.target.value)}
          />
          {config.provider === "bulksmsbd" && (
            <small id="sender-id-help">
              Use your exact approved Masking name or assigned Non-masking
              number from bulksmsbd.net.
            </small>
          )}
        </div>
        <label className="field">
          Rate per SMS part (৳)
          <input
            type="number"
            min="0"
            step="0.01"
            value={config.ratePerSMS}
            onChange={(e) =>
              update(
                "ratePerSMS",
                e.target.value === "" ? "" : Number(e.target.value),
              )
            }
          />
        </label>
        <label className="field">
          Delay between messages (ms)
          <input
            type="number"
            min="0"
            max="60000"
            step="50"
            value={config.delayBetweenSMS}
            onChange={(e) =>
              update(
                "delayBetweenSMS",
                e.target.value === "" ? "" : Number(e.target.value),
              )
            }
          />
        </label>
      </div>
      {config.provider === "custom" && (
        <>
          <label className="field">
            Gateway URL
            <input
              type="url"
              placeholder="https://your-gateway.example/send"
              value={config.customUrl}
              onChange={(e) => update("customUrl", e.target.value)}
            />
          </label>
          <div className="form-grid">
            <label className="field">
              HTTP method
              <select
                value={config.customMethod}
                onChange={(e) => update("customMethod", e.target.value)}
              >
                <option>POST</option>
                <option>GET</option>
              </select>
            </label>
            {[
              ["customParamMobile", "Phone parameter"],
              ["customParamMessage", "Message parameter"],
              ["customParamKey", "API key parameter"],
            ].map(([key, label]) => (
              <label key={key} className="field">
                {label}
                <input
                  value={config[key]}
                  onChange={(e) => update(key, e.target.value)}
                />
              </label>
            ))}
          </div>
        </>
      )}
      <div className="test-box">
        <h3>Test your connection</h3>
        <p>
          {config.provider === "simulation"
            ? "Try a simulated message to a valid Bangladesh number."
            : "This sends one real test message and may incur a charge."}
        </p>
        <label className="field">
          Test recipient
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="01712345678"
          />
        </label>
        <div className="test-actions">
          <button
            type="button"
            className="btn"
            disabled={busy || !phone.trim()}
            onClick={test}
          >
            <Send size={15} />
            {testing
              ? "Sending…"
              : config.provider === "simulation"
                ? "Run simulation test"
                : "Send real test SMS"}
          </button>
          {config.provider === "bulksmsbd" && (
            <button
              type="button"
              className="btn"
              disabled={busy || !config.apiKey.trim()}
              onClick={checkBalance}
            >
              <Wallet size={15} />
              {checkingBalance ? "Checking…" : "Check API key & balance"}
            </button>
          )}
        </div>
      </div>
      {feedback && (
        <p
          role="status"
          className={feedback.success ? "success-note" : "error-note"}
        >
          {feedback.response}
        </p>
      )}
    </ContentFrame>
  );
}
