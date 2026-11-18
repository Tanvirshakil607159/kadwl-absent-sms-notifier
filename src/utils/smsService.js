import { isUnicodeText } from "./smsUtils.js";

const envApiKey =
  typeof import.meta !== "undefined" && import.meta.env
    ? import.meta.env.VITE_BULKSMS_API_KEY || ""
    : "";

// SMS Gateway client and simulation engine
export const DEFAULT_GATEWAY_CONFIG = {
  provider: "bulksmsbd", // 'simulation' | 'greenweb' | 'bulksmsbd' | 'custom'
  apiKey: envApiKey,
  clientId: "",
  senderId: "KADW-HR",
  customUrl: "",
  customMethod: "POST",
  customParamMobile: "to",
  customParamMessage: "message",
  customParamKey: "token",
  ratePerSMS: 0.35, // BDT per SMS part
  delayBetweenSMS: 250, // ms to avoid rate limit
};

const BULKSMSBD_ERRORS = {
  1001: () => "BulkSMSBD Error 1001: Invalid mobile number.",
  1002: (sender) =>
    `BulkSMSBD Error 1002: Sender ID "${sender}" is incorrect or disabled.`,
  1003: () => "BulkSMSBD Error 1003: Required API fields are missing.",
  1004: () => "BulkSMSBD Error 1004: Gateway internal routing error.",
  1005: (sender) =>
    `BulkSMSBD Error 1005: Sender ID "${sender}" not found or unapproved. Enter your exact approved Sender ID or assigned Non-masking number from your bulksmsbd.net dashboard.`,
  1006: () => "BulkSMSBD Error 1006: Balance validity has expired.",
  1007: () => "BulkSMSBD Error 1007: Insufficient SMS account balance.",
  1008: () =>
    "BulkSMSBD Error 1008: IP address is not whitelisted in your BulkSMSBD account.",
  1009: () => "BulkSMSBD Error 1009: BulkSMSBD account is not verified.",
  1010: () => "BulkSMSBD Error 1010: BulkSMSBD account is disabled.",
  1011: () => "BulkSMSBD Error 1011: Invalid API key or user ID not found.",
  1012: () =>
    "BulkSMSBD Error 1012: Masking sender requires Bengali/Unicode text.",
  1013: (sender) =>
    `BulkSMSBD Error 1013: Sender ID "${sender}" is not linked with your API key.`,
  1014: () => "BulkSMSBD Error 1014: BulkSMSBD internal server error.",
  1015: (sender) =>
    `BulkSMSBD Error 1015: Authorization failed or no valid gateway found for Sender ID "${sender}".`,
  1032: () => "BulkSMSBD Error 1032: Recipient number is blocked (DND).",
};

const FATAL_BULKSMSBD_CODES = new Set([
  1002, 1005, 1006, 1007, 1008, 1009, 1010, 1011, 1013, 1015,
]);

export function validateGateway(config) {
  if (!config || typeof config !== "object")
    return "Invalid gateway configuration.";
  if (
    !["simulation", "greenweb", "bulksmsbd", "custom"].includes(config.provider)
  )
    return "This provider is not supported. Select an available gateway.";
  if (
    config.ratePerSMS === "" ||
    !Number.isFinite(Number(config.ratePerSMS)) ||
    Number(config.ratePerSMS) < 0
  )
    return "SMS rate must be zero or greater.";
  if (
    config.delayBetweenSMS === "" ||
    !Number.isFinite(Number(config.delayBetweenSMS)) ||
    Number(config.delayBetweenSMS) < 0 ||
    Number(config.delayBetweenSMS) > 60000
  )
    return "Dispatch delay must be between 0 and 60,000 ms.";
  if (config.provider === "simulation") return "";
  if (typeof config.apiKey !== "string" || !config.apiKey.trim())
    return "Enter your gateway API key before sending.";
  if (typeof config.senderId !== "string" || !config.senderId.trim())
    return "Enter your approved sender ID.";
  if (config.provider === "custom") {
    try {
      if (new URL(config.customUrl.trim()).protocol !== "https:")
        return "Use an HTTPS gateway URL.";
    } catch {
      return "Enter a valid HTTPS gateway URL.";
    }
    if (!["GET", "POST"].includes(config.customMethod))
      return "Choose GET or POST.";
    const rawKeys = [
      config.customParamMobile,
      config.customParamMessage,
      config.customParamKey,
    ];
    const keys = rawKeys.map((key) =>
      typeof key === "string" ? key.trim() : "",
    );
    if (keys.some((key) => !key) || new Set([...keys, "sender"]).size !== 4)
      return "Custom parameter names must be nonempty, distinct, and different from sender.";
  }
  return "";
}
const request = (url, options = {}) =>
  fetch(url, { ...options, signal: AbortSignal.timeout(20000) });

async function parseBulkSMSBDResponse(res, sender = "") {
  const rawText = await res.text();
  let data;
  try {
    data = JSON.parse(rawText);
  } catch {
    return {
      ok: false,
      code: NaN,
      data: null,
      error: `BulkSMSBD returned a non-JSON response (HTTP ${res.status}): ${rawText.slice(0, 120) || "Empty response"}`,
      fatal: false,
    };
  }
  if (!data || typeof data !== "object") {
    return {
      ok: false,
      code: NaN,
      data: null,
      error: `Unexpected BulkSMSBD response (HTTP ${res.status}).`,
      fatal: false,
    };
  }
  const code = Number(data.response_code);
  const ok = res.ok && code === 202;
  let error =
    data.error_message ||
    data.success_message ||
    `BulkSMSBD Error (HTTP ${res.status}): ${JSON.stringify(data)}`;
  if (
    code === 1005 ||
    (typeof data.error_message === "string" &&
      data.error_message.includes("is_masking"))
  ) {
    error = BULKSMSBD_ERRORS[1005](sender);
  } else if (BULKSMSBD_ERRORS[code]) {
    error = BULKSMSBD_ERRORS[code](sender);
  }
  return {
    ok,
    code,
    data,
    error,
    fatal: !ok && FATAL_BULKSMSBD_CODES.has(code),
  };
}

export async function checkBulkSMSBDBalance(apiKey) {
  const trimmedKey = typeof apiKey === "string" ? apiKey.trim() : "";
  if (!trimmedKey) {
    return {
      success: false,
      response: "Enter your BulkSMSBD API key before checking balance.",
    };
  }
  try {
    const res = await request("https://bulksmsbd.net/api/getBalanceApi", {
      method: "POST",
      body: new URLSearchParams({ api_key: trimmedKey }),
    });
    const parsed = await parseBulkSMSBDResponse(res);
    if (!parsed.ok) {
      return { success: false, response: parsed.error };
    }
    const balance = Number(parsed.data.balance);
    return {
      success: true,
      balance: Number.isFinite(balance) ? balance : 0,
      response: Number.isFinite(balance)
        ? `BulkSMSBD connected. Available balance: ৳${balance.toFixed(2)}`
        : "BulkSMSBD API key verified.",
    };
  } catch (err) {
    return {
      success: false,
      response: err.message || "Network / CORS Error. Could not reach BulkSMSBD.",
    };
  }
}

export async function checkGatewayBalanceForBatch(
  config,
  estimatedCost,
  messageCount = 0,
) {
  if (!config || config.provider !== "bulksmsbd") {
    return { supported: false, sufficient: true };
  }
  const res = await checkBulkSMSBDBalance(config.apiKey);
  if (!res.success) {
    return {
      supported: true,
      sufficient: false,
      balance: 0,
      requiredCost: Number(estimatedCost) || 0,
      response: res.response,
    };
  }
  const balanceCents = Math.round((Number(res.balance) || 0) * 100);
  const costCents = Math.round(Math.max(0, Number(estimatedCost) || 0) * 100);
  const balance = balanceCents / 100;
  const requiredCost = costCents / 100;
  const hasCredit = costCents > 0 ? balanceCents >= costCents : balanceCents > 0 || messageCount === 0;
  const remaining = Math.max(0, (balanceCents - costCents) / 100);
  const shortfall = Math.max(0, (costCents - balanceCents) / 100);

  if (!hasCredit) {
    return {
      supported: true,
      sufficient: false,
      balance,
      requiredCost,
      shortfall,
      response:
        balanceCents <= 0
          ? `Insufficient BulkSMSBD balance (৳0.00). Recharge before sending ${messageCount} messages.`
          : `Insufficient BulkSMSBD balance: available ৳${balance.toFixed(2)} is less than estimated cost ৳${requiredCost.toFixed(2)} for ${messageCount} messages (short by ৳${shortfall.toFixed(2)}).`,
    };
  }

  return {
    supported: true,
    sufficient: true,
    balance,
    requiredCost,
    remaining,
    response: `Balance available: ৳${balance.toFixed(2)} — sufficient to send all ${messageCount} messages (est. cost ৳${requiredCost.toFixed(2)}, remaining ~৳${remaining.toFixed(2)}).`,
  };
}

// Dispatch a single SMS through the configured gateway
export async function sendSingleSMS(
  recipient,
  messageText,
  config = DEFAULT_GATEWAY_CONFIG,
) {
  const { normalized, isValid } = recipient.phoneInfo || {};

  if (!isValid) {
    return {
      success: false,
      status: "Invalid Number",
      response: "Invalid Bangladesh Mobile Number format",
    };
  }

  const configError = validateGateway(config);
  if (configError || !messageText?.trim())
    return {
      success: false,
      status: "Failed",
      response: configError || "Message cannot be empty.",
      fatal: Boolean(configError),
    };
  const delayMs = Number(config.delayBetweenSMS) || 0;
  if (delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  // If Simulation mode is active
  if (config.provider === "simulation") {
    return {
      success: true,
      status: "Simulated",
      response:
        "Simulation complete. No SMS was sent and no charge was incurred.",
    };
  }

  const apiKey = config.apiKey.trim();
  const sender = config.senderId.trim();

  // Real Gateway Dispatch Implementations
  try {
    if (config.provider === "greenweb") {
      // Greenweb API
      const url = `https://api.greenweb.com.bd/api.php?token=${encodeURIComponent(apiKey)}&to=${encodeURIComponent(normalized)}&message=${encodeURIComponent(messageText)}`;
      const res = await request(url, { method: "GET" });
      const text = await res.text();
      const isOk = res.ok && /^\s*(?:ok\b|success(?:ful)?\b)/i.test(text);
      return {
        success: isOk,
        status: isOk ? "Sent" : "Failed",
        response: text.slice(0, 100),
      };
    } else if (config.provider === "bulksmsbd") {
      // BulkSMSBD API
      // Recipient number must strictly be formatted as 880XXXXXXXXXX
      const recipientNum = normalized.startsWith("0")
        ? "88" + normalized
        : normalized.startsWith("880")
          ? normalized
          : "880" + normalized;

      const msgType = isUnicodeText(messageText) ? "unicode" : "text";
      const res = await request("https://bulksmsbd.net/api/smsapi", {
        method: "POST",
        body: new URLSearchParams({
          api_key: apiKey,
          type: msgType,
          number: recipientNum,
          senderid: sender,
          message: messageText,
        }),
      });
      const parsed = await parseBulkSMSBDResponse(res, sender);
      return {
        success: parsed.ok,
        status: parsed.ok ? "Sent" : "Failed",
        response: parsed.ok
          ? parsed.data.success_message || "Accepted by gateway"
          : parsed.error,
        fatal: parsed.fatal,
      };
    } else if (config.provider === "custom") {
      // Custom Webhook or API
      const customUrl = config.customUrl.trim();
      const paramKey = config.customParamKey.trim();
      const paramMobile = config.customParamMobile.trim();
      const paramMessage = config.customParamMessage.trim();
      if (config.customMethod === "POST") {
        const body = {
          [paramKey]: apiKey,
          [paramMobile]: normalized,
          [paramMessage]: messageText,
          sender,
        };
        const res = await request(customUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const respText = await res.text();
        return {
          success: res.ok,
          status: res.ok ? "Sent" : "Failed",
          response: respText.slice(0, 100),
        };
      } else {
        // GET
        const url = new URL(customUrl);
        url.searchParams.append(paramKey, apiKey);
        url.searchParams.append(paramMobile, normalized);
        url.searchParams.append(paramMessage, messageText);
        url.searchParams.append("sender", sender);
        const res = await request(url.toString());
        const respText = await res.text();
        return {
          success: res.ok,
          status: res.ok ? "Sent" : "Failed",
          response: respText.slice(0, 100),
        };
      }
    } else {
      return {
        success: false,
        status: "Failed",
        response: "Unsupported gateway provider.",
      };
    }
  } catch (err) {
    return {
      success: false,
      status: "Failed",
      response: err.message || "Network / CORS Error. Check API endpoint.",
    };
  }
}
