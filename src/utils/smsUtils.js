import { normalizeAttendanceDate } from "./dates.js";
const loadSpreadsheet = () => import("xlsx");

// Validate and normalize Bangladesh phone numbers
export function normalizePhoneNumber(phone) {
  if (!phone) return { isValid: false, normalized: "", raw: "" };

  // Remove all non-digit characters except leading +
  let cleaned = String(phone)
    .trim()
    .replace(/[০-৯]/g, (digit) => String(digit.charCodeAt(0) - 0x09e6))
    .replace(/[\s()-]/g, "");

  // Strip leading +880 or 880 or +
  if (cleaned.startsWith("+880")) {
    cleaned = "0" + cleaned.substring(4);
  } else if (cleaned.startsWith("880")) {
    cleaned = "0" + cleaned.substring(3);
  } else if (cleaned.startsWith("+")) {
    cleaned = cleaned.substring(1);
  }

  // Ensure starts with 01
  if (!cleaned.startsWith("0") && cleaned.length === 10) {
    cleaned = "0" + cleaned;
  }

  // Bangladesh mobile number pattern: 01[3-9]XXXXXXXX (11 digits total)
  const bdRegex = /^01[3-9]\d{8}$/;
  const isValid = bdRegex.test(cleaned);

  return {
    isValid,
    normalized: cleaned,
    raw: phone,
    international: isValid ? "+88" + cleaned : cleaned,
  };
}

// GSM basic characters use one septet; extension characters use two.
const GSM_BASIC = new Set(
  Array.from(
    "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà",
  ),
);
const GSM_EXTENDED = new Set(Array.from("^{}\\[~]|€\f"));
export function isUnicodeText(text = "") {
  return [...text].some(
    (char) => !GSM_BASIC.has(char) && !GSM_EXTENDED.has(char),
  );
}
export function calculateSMSStats(text = "", ratePerPart = 0.35) {
  const isUnicode = isUnicodeText(text);
  const units = isUnicode
    ? text.length
    : [...text].reduce(
        (sum, char) => sum + (GSM_EXTENDED.has(char) ? 2 : 1),
        0,
      );
  const single = isUnicode ? 70 : 160;
  const multi = isUnicode ? 67 : 153;
  let parts = units ? 1 : 0;
  let used = units;
  if (units > single) {
    used = 0;
    for (const char of text) {
      const size = isUnicode ? char.length : GSM_EXTENDED.has(char) ? 2 : 1;
      if (used + size > multi) {
        parts++;
        used = 0;
      }
      used += size;
    }
  }
  const rate = Number.isFinite(Number(ratePerPart))
    ? Math.max(0, Number(ratePerPart))
    : 0.35;
  return {
    charCount: text.length,
    units,
    isUnicode,
    parts,
    remaining: units <= single ? single - units : multi - used,
    cost: Number((parts * rate).toFixed(2)),
  };
}

// Replace template variables
export function renderTemplate(template, record, absentDate = "") {
  if (!template) return "";

  const replacements = {
    "{Name}": record.name || "",
    "{ID}": record.employeeId || "",
    "{Line}": record.line ? `Line ${record.line}` : "",
    "{Shift}": record.shift || "",
    "{AbsentDays}":
      record.absentDays !== undefined ? String(record.absentDays) : "1",
    "{LastPresentDate}": record.lastPresentDate || "",
    "{Date}": absentDate || "",
    "{Designation}": record.designation || "",
    "{Company}": "K.A. Design Wear Ltd.",
  };

  return template.replace(/\{[A-Za-z]+\}/g, (key) => replacements[key] ?? key);
}

// Standard templates
export const DEFAULT_TEMPLATES = [
  {
    id: "bangla_day1",
    name: "Bangla - ১ম দিন অনুপস্থিতি নোটিশ",
    category: "Bangla",
    text: "সম্মানিত {Name} (ID: {ID}), আপনি আজ {Date} তারিখে কর্মস্থলে অনুপস্থিত। অনুপস্থিতির সুনির্দিষ্ট কারণ অবিলম্বে আপনার সুপারভাইজারকে জানান। - K.A. Design Wear Ltd.",
  },
  {
    id: "bangla_severe",
    name: "Bangla - জরুরি সতর্কতা (বহুদিন অনুপস্থিত)",
    category: "Bangla",
    text: "জরুরি নোটিশ: {Name} (ID: {ID}), আপনি বিগত {AbsentDays} দিন যাবত কর্মস্থলে অনুপস্থিত (সর্বশেষ উপস্থিত: {LastPresentDate})। অবিলম্বে HR বিভাগে যোগাযোগ করার নির্দেশ দেওয়া যাচ্ছে। - K.A. Design Wear Ltd.",
  },
  {
    id: "bangla_line_notice",
    name: "Bangla - লাইন ভিত্তিক নোটিশ",
    category: "Bangla",
    text: "জরুরি নোটিশ: {Name}, {Line}-এ আপনার অনুপস্থিতি লিপিবদ্ধ হয়েছে ({Date})। কোনো সমস্যা থাকলে দ্রুত লাইন ইনচার্জের সাথে যোগাযোগ করুন। - K.A. Design Wear Ltd.",
  },
  {
    id: "english_standard",
    name: "English - Daily Absent Reminder",
    category: "English",
    text: "Dear {Name} ({ID}), you are marked absent on {Date} at K.A. Design Wear Ltd. ({Line}). Please report the reason to your supervisor immediately.",
  },
  {
    id: "english_critical",
    name: "English - Multi-Day Critical Alert",
    category: "English",
    text: "CRITICAL NOTICE: {Name} ({ID}), you have been absent for {AbsentDays} consecutive days since {LastPresentDate}. Please report to HR immediately. - K.A. Design Wear Ltd.",
  },
];

const cleanHeader = (header) =>
  String(header ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
const aliases = {
  employeeId: ["employeeid", "empid", "id", "cardno", "card"],
  name: ["name", "employeename", "workername"],
  designation: ["designation", "desig", "post", "role"],
  line: ["line", "lineno", "section"],
  shift: ["shift", "shifttype"],
  lastPresentDate: [
    "lastpresentdate",
    "lastattendance",
    "lastattendancedate",
    "presentdate",
  ],
  absentDays: [
    "absentdays",
    "noofabsentdays",
    "daysabsent",
    "absent",
    "noofabsent",
  ],
  mobileNo: [
    "mobileno",
    "mobile",
    "mobilenumber",
    "phone",
    "phoneno",
    "phonenumber",
    "contact",
    "contactno",
    "cell",
  ],
};
export function parseAttendanceRows(rows, allowHeaderless = false) {
  let headerIndex = rows.findIndex((row) => {
    const keys = row.map(cleanHeader);
    return (
      aliases.employeeId.some((key) => keys.includes(key)) &&
      aliases.name.some((key) => keys.includes(key))
    );
  });
  let map = {};
  if (headerIndex < 0) {
    if (!allowHeaderless)
      throw new Error(
        "Employee ID and Name columns are required. Download the template for an example.",
      );
    const firstRow = rows.find((row) =>
      row.some((cell) => String(cell ?? "").trim()),
    );
    const trimmed = firstRow ? [...firstRow] : [];
    while (trimmed.length && !String(trimmed[trimmed.length - 1] ?? "").trim()) {
      trimmed.pop();
    }
    const count = trimmed.length;
    const fields =
      count === 9
        ? [
            "sl",
            "employeeId",
            "name",
            "designation",
            "line",
            "shift",
            "lastPresentDate",
            "absentDays",
            "mobileNo",
          ]
        : count === 3
          ? ["employeeId", "name", "mobileNo"]
          : null;
    if (!fields)
      throw new Error(
        "Include column headers, or paste 3 columns (ID, Name, Mobile) or the 9 template columns.",
      );
    map = Object.fromEntries(fields.map((field, index) => [field, index]));
  } else {
    const headers = rows[headerIndex].map(cleanHeader);
    map = Object.fromEntries(
      Object.entries(aliases).map(([field, keys]) => [
        field,
        headers.findIndex((header) => keys.includes(header)),
      ]),
    );
  }
  const ids = new Set();
  const records = [];
  for (const [offset, row] of rows.slice(headerIndex + 1).entries()) {
    if (!row.some((value) => String(value ?? "").trim())) continue;
    const get = (field) =>
      map[field] >= 0 ? String(row[map[field]] ?? "").trim() : "";
    const employeeId = get("employeeId"),
      name = get("name");
    if (
      /^(grand\s*)?total(?:\s|:|$)/i.test(employeeId) ||
      /^(grand\s*)?total(?:\s|:|$)/i.test(name)
    )
      continue;
    if (!employeeId || !name)
      throw new Error(
        "Row " +
          (headerIndex + offset + 2) +
          ": employee ID and name are required.",
      );
    if (ids.has(employeeId.toLowerCase()))
      throw new Error(
        "Duplicate employee ID: " +
          employeeId +
          ". Remove duplicate rows before importing.",
      );
    ids.add(employeeId.toLowerCase());
    const rawDays = get("absentDays");
    const days = rawDays === "" ? 1 : Number(rawDays);
    if (!Number.isInteger(days) || days < 1)
      throw new Error(
        "Invalid absent days for " +
          employeeId +
          ". Use a positive whole number.",
      );
    let lastPresentDate = get("lastPresentDate");
    if (/^\d{5}$/.test(lastPresentDate))
      lastPresentDate = new Date(
        Date.UTC(1899, 11, 30) + Number(lastPresentDate) * 86400000,
      ).toLocaleDateString("en-GB", {
        timeZone: "UTC",
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    records.push({
      sl: records.length + 1,
      employeeId,
      name,
      designation: get("designation"),
      line: get("line"),
      shift: get("shift"),
      lastPresentDate,
      absentDays: days,
      mobileNo: get("mobileNo"),
      status: "Pending",
    });
  }
  if (!records.length)
    throw new Error(
      "No employee rows found. Add records below the column headers.",
    );
  const dateMatch = rows
    .slice(0, Math.max(0, headerIndex))
    .flat()
    .join(" ")
    .match(
      /Absent\s*Date\s*[:–-]?\s*(\d{1,2}[-/](?:[A-Za-z]{3}|\d{1,2})[-/]\d{4}|\d{4}-\d{2}-\d{2})/i,
    );
  if (dateMatch && !normalizeAttendanceDate(dateMatch[1])) {
    throw new Error(
      "The report contains an invalid attendance date. Correct it before importing.",
    );
  }
  return { records, detectedAbsentDate: dateMatch?.[1] || "" };
}
export async function parseAttendanceText(text) {
  const XLSX = await loadSpreadsheet();
  const workbook = XLSX.read(text, { type: "string", raw: true });
  const sheetName = workbook.SheetNames[0];
  const worksheet = sheetName ? workbook.Sheets[sheetName] : null;
  if (!worksheet) throw new Error("No attendance rows found.");
  const rows = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: "",
    raw: true,
  });
  return parseAttendanceRows(rows, true);
}
export async function parseAttendanceFile(file) {
  const XLSX = await loadSpreadsheet();
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!worksheet) throw new Error("File contains no readable worksheets.");
  return parseAttendanceRows(
    XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "", raw: true }),
  );
}

// Export sample Excel template
export async function exportSampleExcelTemplate() {
  const XLSX = await loadSpreadsheet();
  const sampleData = [
    {
      SL: 1,
      "Employee ID": "KADW11952",
      Name: "Mst. Sathi Akter",
      Designation: "Junior Sewing Operator",
      Line: "1",
      Shift: "Day",
      "Last Present Date": "10-Sep-2026",
      "No of Absent Days": 3,
      "Mobile No": "01963251202",
    },
    {
      SL: 2,
      "Employee ID": "KADW12002",
      Name: "Azufa Khatun",
      Designation: "Junior Sewing Operator",
      Line: "1",
      Shift: "Day",
      "Last Present Date": "13-Sep-2026",
      "No of Absent Days": 1,
      "Mobile No": "01607656800",
    },
    {
      SL: 3,
      "Employee ID": "KADW12208",
      Name: "Fahima Akter",
      Designation: "Junior Sewing Operator",
      Line: "4",
      Shift: "Day",
      "Last Present Date": "08-Sep-2026",
      "No of Absent Days": 6,
      "Mobile No": "01768958655",
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Daily Absent List");

  XLSX.writeFile(workbook, "KADW_Daily_Absent_List_Template.xlsx");
}

// Export SMS delivery log report
export async function exportDispatchHistoryReport(logs) {
  const XLSX = await loadSpreadsheet();
  if (!logs || logs.length === 0) return;

  const exportRows = logs.map((log) => ({
    Timestamp: log.timestamp,
    "Employee ID": log.employeeId,
    "Employee Name": log.name,
    Line: log.line,
    "Mobile No": log.mobile,
    Status: log.status,
    "Message Parts": log.parts,
    "Cost (BDT)": log.cost,
    "SMS Message": log.message,
    "Gateway Response": log.gatewayResponse || "Success",
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "SMS Dispatch History");

  const filename = `KADW_SMS_Dispatch_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(workbook, filename);
}
