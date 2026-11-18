import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizePhoneNumber,
  isUnicodeText,
  calculateSMSStats,
  renderTemplate,
  parseAttendanceRows,
  parseAttendanceText,
  parseAttendanceFile,
  parseEmergencyText,
  parseEmergencyFile,
  matchesIdRange,
} from "../src/utils/smsUtils.js";
import { normalizeAttendanceDate } from "../src/utils/dates.js";
import {
  sendSingleSMS,
  checkBulkSMSBDBalance,
  checkGatewayBalanceForBatch,
  DEFAULT_GATEWAY_CONFIG,
  validateGateway,
} from "../src/utils/smsService.js";
import { readStored, writeStored } from "../src/utils/storage.js";
const config = { ...DEFAULT_GATEWAY_CONFIG, delayBetweenSMS: 0 };
const recipient = { phoneInfo: normalizePhoneNumber("01712345678") };

test("Bangladesh phone normalization supports country codes, Excel numbers, and Bangla digits", () => {
  for (const phone of [
    "01712345678",
    "+880 1712-345678",
    "8801712345678",
    1712345678,
    "০১৭১২৩৪৫৬৭৮",
  ])
    assert.equal(normalizePhoneNumber(phone).normalized, "01712345678");
  for (const phone of ["", null, "01212345678", "0171234567", "017abc45678"])
    assert.equal(normalizePhoneNumber(phone).isValid, false);
});
test("SMS counters handle GSM basic, extensions, Unicode and multipart boundaries", () => {
  assert.equal(isUnicodeText("£é€"), false);
  assert.equal(isUnicodeText("বাংলা"), true);
  assert.equal(calculateSMSStats("a".repeat(160)).parts, 1);
  assert.equal(calculateSMSStats("a".repeat(161)).parts, 2);
  assert.equal(calculateSMSStats("^".repeat(80)).parts, 1);
  assert.equal(calculateSMSStats("^".repeat(153)).parts, 3);
  assert.equal(calculateSMSStats("ব".repeat(70)).parts, 1);
  assert.equal(calculateSMSStats("ব".repeat(71)).parts, 2);
  assert.equal(calculateSMSStats("😀".repeat(67)).parts, 3);
  assert.equal(calculateSMSStats("").cost, 0);
  assert.equal(calculateSMSStats("test", 0).cost, 0);
});
test("Personalization preserves record text and calculates actual rendered size", () => {
  const text = renderTemplate("{Name} {ID} {Name}", {
    name: "Literal {ID}",
    employeeId: "E001",
  });
  assert.equal(text, "Literal {ID} E001 Literal {ID}");
  assert.equal(
    calculateSMSStats(renderTemplate("{Name}", { name: "A".repeat(161) }))
      .parts,
    2,
  );
});
test("Reordered import headers preserve IDs, names, phones and days", () => {
  const result = parseAttendanceRows([
    ["Absent Date: 14-Sep-2026"],
    ["Name", "Mobile No", "Employee ID", "No of Absent Days"],
    ["Amina", 1712345678, "E001", 4],
  ]);
  assert.equal(result.records[0].employeeId, "E001");
  assert.equal(result.records[0].absentDays, 4);
  assert.equal(normalizePhoneNumber(result.records[0].mobileNo).isValid, true);
  assert.equal(result.detectedAbsentDate, "14-Sep-2026");
});
test("Reject duplicate IDs, missing names, invalid absent days and unknown schemas", () => {
  assert.throws(
    () =>
      parseAttendanceRows([
        ["ID", "Name"],
        ["E1", "A"],
        ["e1", "B"],
      ]),
    /Duplicate/,
  );
  assert.throws(
    () =>
      parseAttendanceRows([
        ["ID", "Name"],
        ["E1", ""],
      ]),
    /required/,
  );
  assert.throws(
    () =>
      parseAttendanceRows([
        ["ID", "Name", "Absent Days"],
        ["E1", "A", -1],
      ]),
    /Invalid absent days/,
  );
  assert.throws(
    () =>
      parseAttendanceRows([
        ["Foo", "Bar"],
        ["E1", "A"],
      ]),
    /columns are required/,
  );
});
test("CSV paste supports quoted names with commas and headerless TSV", async () => {
  const csv = await parseAttendanceText(
    'Employee ID,Name,Mobile No\nE1,"Akter, Amina",01712345678',
  );
  assert.equal(csv.records[0].name, "Akter, Amina");
  const tsv = await parseAttendanceText("E2\tFatima\t01812345678");
  assert.equal(tsv.records[0].employeeId, "E2");
  assert.equal(tsv.records[0].mobileNo, "01812345678");
});
test("Excel import handles real workbooks and date serials", async () => {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ["ID", "Name", "Mobile No", "Last Present Date"],
      ["E1", "Amina", 1712345678, 46279],
    ]),
    "Attendance",
  );
  const data = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  const result = await parseAttendanceFile(new Blob([data]));
  assert.equal(result.records[0].name, "Amina");
  assert.match(result.records[0].lastPresentDate, /2026/);
});
test("Dates accept ERP formats without timezone shifts or invalid calendar dates", () => {
  for (const value of [
    "2026-09-14",
    "14-Sep-2026",
    "14/09/2026",
    "14 Sept 2026",
  ])
    assert.equal(normalizeAttendanceDate(value), "2026-09-14");
  for (const value of ["2026-02-30", "31/04/2026", "nonsense"])
    assert.equal(normalizeAttendanceDate(value), "");
});
test("Default gateway config uses BulkSMSBD", () => {
  assert.equal(DEFAULT_GATEWAY_CONFIG.provider, "bulksmsbd");
  assert.equal(typeof DEFAULT_GATEWAY_CONFIG.apiKey, "string");
});
test("Simulation is explicit, deterministic and never calls a network", async () => {
  const original = global.fetch;
  global.fetch = () => {
    throw new Error("Unexpected network call");
  };
  try {
    const result = await sendSingleSMS(recipient, "test", {
      ...config,
      provider: "simulation",
    });
    assert.equal(result.status, "Simulated");
    assert.equal(result.success, true);
  } finally {
    global.fetch = original;
  }
});
test("Missing keys, unsupported providers, blank messages and invalid phones fail", async () => {
  assert.equal(
    (
      await sendSingleSMS(recipient, "test", {
        ...config,
        provider: "greenweb",
        apiKey: "",
      })
    ).status,
    "Failed",
  );
  assert.equal(
    (
      await sendSingleSMS(recipient, "test", {
        ...config,
        provider: "alphasms",
        apiKey: "test",
      })
    ).success,
    false,
  );
  assert.equal((await sendSingleSMS(recipient, " ", config)).success, false);
  assert.equal(
    (
      await sendSingleSMS(
        { phoneInfo: normalizePhoneNumber("bad") },
        "test",
        config,
      )
    ).status,
    "Invalid Number",
  );
});
test("Gateway validation accepts zero costs but rejects negative and empty settings", () => {
  assert.equal(validateGateway({ ...config, apiKey: "test", ratePerSMS: 0 }), "");
  assert.match(validateGateway({ ...config, ratePerSMS: -1 }), /rate/);
  assert.match(validateGateway({ ...config, ratePerSMS: "" }), /rate/);
  assert.match(validateGateway({ ...config, delayBetweenSMS: -1 }), /delay/);
  assert.match(
    validateGateway({
      ...config,
      provider: "custom",
      apiKey: "test",
      customUrl: "http://example.com",
    }),
    /HTTPS/,
  );
});
test("Gateway errors containing token or unsuccessful do not report success", async () => {
  const original = global.fetch;
  try {
    for (const response of [
      "Invalid token",
      "unsuccessful",
      "ERROR: no balance",
    ]) {
      global.fetch = async () => new Response(response);
      assert.equal(
        (
          await sendSingleSMS(recipient, "test", {
            ...config,
            provider: "greenweb",
            apiKey: "test",
          })
        ).success,
        false,
      );
    }
    global.fetch = async () => new Response("OK: accepted");
    assert.equal(
      (
        await sendSingleSMS(recipient, "test", {
          ...config,
          provider: "greenweb",
          apiKey: "test",
        })
      ).success,
      true,
    );
  } finally {
    global.fetch = original;
  }
});
test("BulkSMSBD supports string codes, trims credentials, handles non-JSON errors, and flags fatal codes", async () => {
  const original = global.fetch;
  try {
    let captured;
    global.fetch = async (url, options) => {
      captured = { url, options };
      return new Response(JSON.stringify({ response_code: "202" }));
    };
    const resOk = await sendSingleSMS(recipient, "বাংলা", {
      ...config,
      provider: "bulksmsbd",
      apiKey: "  test-key  ",
      senderId: "  8809617600000  ",
    });
    assert.equal(resOk.success, true);
    assert.equal(captured.url, "https://bulksmsbd.net/api/smsapi");
    assert.equal(captured.options.method, "POST");
    const params = new URLSearchParams(captured.options.body);
    assert.equal(params.get("api_key"), "test-key");
    assert.equal(params.get("senderid"), "8809617600000");
    assert.equal(params.get("number"), "8801712345678");
    assert.equal(params.get("type"), "unicode");

    global.fetch = async () =>
      new Response(JSON.stringify({ response_code: 202 }), { status: 500 });
    assert.equal(
      (
        await sendSingleSMS(recipient, "test", {
          ...config,
          provider: "bulksmsbd",
          apiKey: "test",
        })
      ).success,
      false,
    );

    global.fetch = async () =>
      new Response("<html>502 Bad Gateway</html>", { status: 502 });
    const resHtml = await sendSingleSMS(recipient, "test", {
      ...config,
      provider: "bulksmsbd",
      apiKey: "test",
    });
    assert.equal(resHtml.success, false);
    assert.match(resHtml.response, /non-JSON response/i);

    global.fetch = async () =>
      new Response(JSON.stringify({ response_code: 1011 }));
    const resFatal = await sendSingleSMS(recipient, "test", {
      ...config,
      provider: "bulksmsbd",
      apiKey: "bad-key",
    });
    assert.equal(resFatal.success, false);
    assert.equal(resFatal.fatal, true);
    assert.match(resFatal.response, /1011/);
  } finally {
    global.fetch = original;
  }
});
test("Pre-send batch balance availability check blocks insufficient or zero balance", async () => {
  const sim = await checkGatewayBalanceForBatch(
    { provider: "simulation" },
    100,
    50,
  );
  assert.equal(sim.supported, false);
  assert.equal(sim.sufficient, true);

  const original = global.fetch;
  try {
    global.fetch = async () =>
      new Response(JSON.stringify({ response_code: 202, balance: 1.4 }));
    const exactOk = await checkGatewayBalanceForBatch(
      { provider: "bulksmsbd", apiKey: "k" },
      1.4000000000000001,
      2,
    );
    assert.equal(exactOk.sufficient, true);
    assert.match(exactOk.response, /sufficient/i);

    global.fetch = async () =>
      new Response(JSON.stringify({ response_code: 202, balance: 1.0 }));
    const short = await checkGatewayBalanceForBatch(
      { provider: "bulksmsbd", apiKey: "k" },
      1.4,
      2,
    );
    assert.equal(short.sufficient, false);
    assert.match(short.response, /Insufficient.*short by ৳0\.40/i);

    global.fetch = async () =>
      new Response(JSON.stringify({ response_code: 202, balance: 0 }));
    const zero = await checkGatewayBalanceForBatch(
      { provider: "bulksmsbd", apiKey: "k" },
      0,
      2,
    );
    assert.equal(zero.sufficient, false);
  } finally {
    global.fetch = original;
  }
});
test("BulkSMSBD balance check validates API key and parses balance response", async () => {
  assert.equal((await checkBulkSMSBDBalance("  ")).success, false);
  const original = global.fetch;
  try {
    global.fetch = async (url, options) => {
      assert.equal(url, "https://bulksmsbd.net/api/getBalanceApi");
      assert.equal(options.method, "POST");
      assert.equal(new URLSearchParams(options.body).get("api_key"), "abc123");
      return new Response(
        JSON.stringify({
          response_code: 202,
          balance: 2026.220000000000027,
        }),
      );
    };
    const ok = await checkBulkSMSBDBalance(" abc123 ");
    assert.equal(ok.success, true);
    assert.match(ok.response, /৳2026\.22/);

    global.fetch = async () =>
      new Response(JSON.stringify({ response_code: 1011 }));
    const bad = await checkBulkSMSBDBalance("bad");
    assert.equal(bad.success, false);
    assert.match(bad.response, /1011/);
  } finally {
    global.fetch = original;
  }
});
test("Custom GET includes sender and uses a timeout signal; network failures are recorded", async () => {
  const original = global.fetch;
  try {
    global.fetch = async (url, options) => {
      assert.equal(new URL(url).searchParams.get("sender"), "KADW-HR");
      assert.ok(options.signal);
      return new Response("Accepted");
    };
    const custom = {
      ...config,
      provider: "custom",
      apiKey: "test",
      customUrl: "https://example.com/sms",
      customMethod: "GET",
    };
    assert.equal(
      (await sendSingleSMS(recipient, "test", custom)).success,
      true,
    );
    global.fetch = async () => {
      throw new Error("Network unavailable");
    };
    assert.equal(
      (await sendSingleSMS(recipient, "test", custom)).status,
      "Failed",
    );
  } finally {
    global.fetch = original;
  }
});
test("Malformed and unavailable browser storage recover safely", () => {
  global.localStorage = {
    getItem: () => "{broken",
    setItem: () => {
      throw new Error("Quota full");
    },
  };
  assert.deepEqual(readStored("records", [], Array.isArray), []);
  assert.equal(writeStored("records", []), false);
  global.localStorage.getItem = () => "null";
  assert.deepEqual(readStored("records", [], Array.isArray), []);
  delete global.localStorage;
});
test("Emergency directory parser supports Employee_Type, quoted designations, XLSX files and {EmployeeType} templates", async () => {
  const csv = [
    "SL,Employee ID,Employee Name,Designation,Employee_Type,Mobile No",
    '1,KADS188,Aysha Siddiqua,"Manager HR,Admin & Compliance",Staff,01703211565',
    "2,KADW23,Maksuda,Junior Sewing Operator,Worker,01708049441",
    "3,KADS40,Md. Arif Hossain,Senior Merchandiser,Office,01939196876",
  ].join("\n");
  const parsed = await parseEmergencyText(csv);
  assert.equal(parsed.length, 3);
  assert.equal(parsed[0].designation, "Manager HR,Admin & Compliance");
  assert.equal(parsed[0].employeeType, "Staff");
  assert.equal(parsed[1].employeeType, "Worker");
  assert.equal(parsed[2].employeeType, "Office");
  assert.equal(
    renderTemplate("{Name} ({EmployeeType})", parsed[0], "18 Nov 2026"),
    "Aysha Siddiqua (Staff)",
  );

  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      [
        "SL",
        "Employee ID",
        "Employee Name",
        "Designation",
        "Employee_Type",
        "Mobile No",
      ],
      [1, "KADS5", "Sahidul", "Deputy Production Manager", "Staff", 1741144499],
    ]),
    "Employees",
  );
  const data = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  const fileRecords = await parseEmergencyFile(new Blob([data]));
  assert.equal(fileRecords[0].employeeId, "KADS5");
  assert.equal(fileRecords[0].employeeType, "Staff");
  assert.equal(
    normalizePhoneNumber(fileRecords[0].mobileNo).normalized,
    "01741144499",
  );
});
test("ID range filter supports prefixed ranges, numeric bounds, single-ended bounds, and reversed bounds", () => {
  assert.equal(matchesIdRange("KADS30", "KADS5", "KADS50"), true);
  assert.equal(matchesIdRange("KADS5", "KADS5", "KADS50"), true);
  assert.equal(matchesIdRange("KADS107", "KADS5", "KADS50"), false);
  assert.equal(matchesIdRange("KADW23", "KADS5", "KADS50"), false);
  assert.equal(matchesIdRange("KADW23", "10", "45"), true);
  assert.equal(matchesIdRange("KADS40", "10", "45"), true);
  assert.equal(matchesIdRange("KADS5", "10", "45"), false);
  assert.equal(matchesIdRange("KADS30", "KADS50", "KADS5"), true);
  assert.equal(matchesIdRange("KADS107", "KADS100", ""), true);
  assert.equal(matchesIdRange("KADS5", "", "KADS40"), true);
  assert.equal(matchesIdRange("KADS107", "", "KADS40"), false);
  assert.equal(matchesIdRange("E002", "E001", "E002"), true);
});
