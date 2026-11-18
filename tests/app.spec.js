import { test, expect } from "@playwright/test";
const rows =
  "Employee ID\tName\tLine\tShift\tAbsent Days\tMobile No\nE001\tAmina Akter\t1\tDay\t1\t01712345678\nE002\tRahima Begum\t2\tDay\t3\t01812345678\nE003\tFatima Khan\t1\tNight\t5\tbad";
async function paste(page, value = rows) {
  await page.getByRole("tab", { name: /Import/ }).click();
  await page.getByRole("button", { name: "Paste from Excel" }).first().click();
  await page.getByLabel("Attendance rows").fill(value);
  await page.getByRole("button", { name: "Import pasted employees" }).click();
  await expect(page.getByRole("tab", { name: /Attendance/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
}
test("Company branding, clean initial state, keyboard dialog, and reduced motion", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByAltText("K.A. Design Wear Ltd. company logo"),
  ).toBeVisible();
  await expect(page.locator("link[rel=icon]")).toHaveAttribute(
    "href",
    /company-logo\.png$/,
  );
  await page.getByRole("tab", { name: /Attendance/ }).click();
  await expect(
    page.getByRole("heading", { name: "Your team’s day starts here" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: /Messages/ }).click();
  await expect(
    page.getByRole("button", { name: "Review & send SMS", exact: true }),
  ).toBeDisabled();
  await paste(page);
  await page.getByRole("button", { name: "Clear employee list" }).click();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Close dialog" }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    page.getByRole("button", { name: "Clear employees", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Clear employee list" }),
  ).toBeFocused();
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page
      .locator(".lucide")
      .first()
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
  expect(errors).toEqual([]);
});
test("Import, category filters, phone edits, selection across filters and reload persistence", async ({
  page,
}) => {
  await page.goto("/");
  await paste(page);
  await page.getByRole("tab", { name: /Overview/ }).click();
  await expect(
    page.getByRole("button", { name: /Total absent 3/ }),
  ).toBeVisible();
  await page.getByRole("tab", { name: /Attendance/ }).click();
  await page.getByRole("checkbox", { name: "Select Amina Akter" }).check();
  await page.getByLabel("Filter by line").selectOption("2");
  await page.getByLabel("Select filtered").check();
  await page.getByLabel("Select filtered").uncheck();
  await page.getByRole("button", { name: "Reset filters" }).click();
  await expect(
    page.getByRole("checkbox", { name: "Select Amina Akter" }),
  ).toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: "Select Rahima Begum" }),
  ).not.toBeChecked();
  await page.getByRole("tab", { name: /Overview/ }).click();
  await page.getByRole("button", { name: /Phone issues 1/ }).click();
  await expect(
    page.getByRole("checkbox", { name: "Select Fatima Khan" }),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "Select Amina Akter" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Edit phone for Fatima Khan" })
    .click();
  await page.getByLabel("Mobile number for Fatima Khan").fill("01912345678");
  await page.getByRole("button", { name: "Save phone number" }).click();
  await expect(page.getByText("No matching employees.")).toBeVisible();
  await page.getByRole("button", { name: "Reset filters" }).first().click();
  await page.reload();
  await expect(page.getByText("01912345678", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: /Overview/ }).click();
  await expect(
    page.getByRole("button", { name: /Total absent 3/ }),
  ).toBeVisible();
});
test("Personalized simulation skips invalid numbers, records zero charges, exports history", async ({
  page,
}) => {
  const external = [];
  page.on("request", (request) => {
    if (/greenweb|bulksmsbd/.test(request.url())) external.push(request.url());
  });
  await page.addInitScript(() =>
    localStorage.setItem(
      "kadw_gateway_config",
      JSON.stringify({ provider: "simulation" }),
    ),
  );
  await page.goto("/");
  await paste(page);
  await page.getByLabel("Select filtered").check();
  await page.getByRole("button", { name: /Compose for 3 selected/ }).click();
  await page
    .getByRole("button", { name: "Review simulation", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("2 recipients");
  await expect(page.getByRole("dialog")).toContainText(
    "1 invalid numbers will be skipped",
  );
  await expect(page.getByRole("dialog")).toContainText("Amina Akter");
  await page.getByRole("button", { name: "Start simulation" }).click();
  await expect(
    page.getByRole("heading", { name: "Dispatch complete" }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog").getByText("Simulated", { exact: true }),
  ).toHaveCount(2);
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("tab", { name: /History/ }).click();
  await expect(
    page.locator("#panel-history").getByText("৳0.00", { exact: true }),
  ).toHaveCount(2);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Excel" }).click();
  expect((await download).suggestedFilename()).toMatch(
    /KADW_SMS_Dispatch_Report.*xlsx/,
  );
  expect(external).toEqual([]);
});
test("Stopping a batch waits for the in-flight result and preserves partial history", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "kadw_gateway_config",
      JSON.stringify({
        provider: "simulation",
        ratePerSMS: 0.35,
        delayBetweenSMS: 4000,
      }),
    ),
  );
  await page.goto("/");
  await paste(page);
  await page
    .getByRole("button", { name: "Select valid phones", exact: true })
    .click();
  await page.getByRole("button", { name: /Compose for 2 selected/ }).click();
  await page
    .getByRole("button", { name: "Review simulation", exact: true })
    .click();
  await page.getByRole("button", { name: "Start simulation" }).click();
  await page
    .getByRole("button", { name: "Stop after current message" })
    .click();
  await expect(
    page.getByRole("button", { name: "Close dialog" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("heading", { name: "Dispatch stopped" }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText(
    "1 of 2 recipients processed",
  );
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("tab", { name: /History/ }).click();
  await expect(
    page
      .locator("#panel-history tbody .badge")
      .filter({ hasText: "Simulated" }),
  ).toHaveCount(1);
});
test("Upload rejects a later invalid file instead of importing a stale valid preview", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Import attendance", exact: true })
    .first()
    .click();
  await page
    .getByLabel("Attendance file")
    .setInputFiles({
      name: "attendance.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("Employee ID,Name,Mobile No\nE1,Amina,01712345678"),
    });
  await expect(
    page.getByRole("button", { name: "Import 1 employees" }),
  ).toBeEnabled();
  await page
    .getByLabel("Attendance file")
    .setInputFiles({
      name: "bad.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("Wrong,Columns\n1,2"),
    });
  await expect(page.getByRole("alert")).toContainText("columns are required");
  await expect(
    page.getByRole("button", { name: /Import.*employees/ }),
  ).toBeDisabled();
});
test("Duplicate paste is rejected without replacing existing records", async ({
  page,
}) => {
  await page.goto("/");
  await paste(page);
  await page.getByRole("button", { name: "Paste from Excel" }).first().click();
  await page
    .getByLabel("Attendance rows")
    .fill("ID,Name,Mobile\nE1,A,01712345678\ne1,B,01812345678");
  await page.getByRole("button", { name: "Import pasted employees" }).click();
  await expect(page.getByRole("alert")).toContainText("Duplicate employee ID");
  await page.getByRole("tab", { name: /Overview/ }).click();
  await expect(
    page.getByRole("button", { name: /Total absent 3/ }),
  ).toBeVisible();
});
test("Settings prefill BulkSMS, validate live keys, reset unsaved edits and do not persist credentials", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("tab", { name: /Settings/ }).click();
  await expect(page.getByLabel("SMS provider")).toHaveValue("bulksmsbd");
  await page.getByLabel("API key", { exact: true }).fill("");
  await page.getByLabel("Rate per SMS part").fill("0.36");
  await expect(page.locator("#panel-settings")).toContainText(
    "You have unsaved changes",
  );
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByRole("status").last()).toContainText("API key");
  await page.getByLabel("API key", { exact: true }).fill("test-key-never-used");
  await page.getByLabel("Rate per SMS part").fill("0");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(
    page.getByRole("button", { name: "Live gateway selected" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("kadw_gateway_config")).apiKey,
    ),
  ).toBe("");
  await page.getByLabel("Sender ID", { exact: true }).fill("unsaved");
  await page.getByRole("button", { name: "Reset changes", exact: true }).click();
  await expect(page.getByLabel("Sender ID", { exact: true })).toHaveValue(
    "KADW-HR",
  );
  await expect(page.getByLabel("Rate per SMS part")).toHaveValue("0");
});
test("BulkSMSBD balance check, live send, and fatal error stops batch without looping", async ({
  page,
}) => {
  let smsRequests = 0;
  let mode = "ok";
  await page.route("https://bulksmsbd.net/api/getBalanceApi", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ response_code: 202, balance: 2026.22 }),
    });
  });
  await page.route("https://bulksmsbd.net/api/smsapi", async (route) => {
    smsRequests++;
    const body = new URLSearchParams(route.request().postData() || "");
    expect(body.get("api_key")).toBe("demo-key-123");
    expect(body.get("senderid")).toBe("8809617600000");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        mode === "ok"
          ? { response_code: 202, success_message: "SMS Submitted Successfully" }
          : { response_code: 1005, error_message: "is_masking error" },
      ),
    });
  });

  await page.goto("/");
  await page.getByRole("tab", { name: /Settings/ }).click();
  await page.getByLabel("SMS provider").selectOption("bulksmsbd");
  await page.getByLabel("API key", { exact: true }).fill("  demo-key-123  ");
  await page.getByLabel("Sender ID", { exact: true }).fill(" 8809617600000 ");
  await page.getByLabel("Delay between messages (ms)").fill("0");
  await page.getByRole("button", { name: "Check API key & balance" }).click();
  await expect(page.locator("#panel-settings")).toContainText("৳2026.22");
  await page.getByRole("button", { name: "Save settings" }).click();

  await paste(page);
  await page.getByRole("button", { name: "Select valid phones" }).click();
  await page.getByRole("button", { name: /Compose for 2 selected/ }).click();
  await page.getByRole("button", { name: "Review & send SMS" }).click();
  await page.getByRole("button", { name: "Send 2 messages" }).click();
  await expect(
    page.getByRole("heading", { name: "Dispatch complete" }),
  ).toBeVisible();
  expect(smsRequests).toBe(2);
  await page.getByRole("button", { name: "Done", exact: true }).click();

  mode = "fatal";
  smsRequests = 0;
  await page.getByRole("button", { name: "Review & send SMS" }).click();
  await page.getByRole("button", { name: "Send 2 messages" }).click();
  await expect(
    page.getByRole("heading", { name: "Dispatch stopped" }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText(
    "1 of 2 recipients processed",
  );
  expect(smsRequests).toBe(1);
});
test("Corrupt saved data does not crash and valid legacy sample IDs survive", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("kadw_sms_history", "null");
    localStorage.setItem("kadw_gateway_config", "{broken");
    localStorage.setItem(
      "kadw_absent_records",
      JSON.stringify([
        {
          employeeId: "KADW11952",
          name: "Existing employee",
          mobileNo: 1712345678,
          line: 1,
          absentDays: "3",
        },
      ]),
    );
    localStorage.setItem("kadw_absent_date", "14-Sep-2026");
  });
  await page.goto("/");
  await expect(page.getByLabel("Attendance date")).toHaveValue("2026-09-14");
  await page.getByRole("tab", { name: /Attendance/ }).click();
  await expect(
    page.getByText("Existing employee", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Search employees").fill("17123");
  await expect(
    page.getByRole("checkbox", { name: "Select Existing employee" }),
  ).toBeVisible();
});
test("Mobile layout stays within viewport and composer fields use available width", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page.getByRole("tab", { name: /Messages/ }).click();
  const width = await page
    .getByLabel("Your message", { exact: true })
    .evaluate((el) => el.getBoundingClientRect().width);
  expect(width).toBeGreaterThan(300);
  await page.getByRole("tab", { name: /Overview/ }).click();
  await paste(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page.screenshot({
    path: "artifacts/dashboard-mobile-populated.png",
    fullPage: true,
    animations: "disabled",
    timeout: 10000,
  });
});
test("List pagination, sorting, clear confirmation and sample template download", async ({
  page,
}) => {
  await page.goto("/");
  const data =
    "ID,Name,Mobile No,Absent Days\n" +
    Array.from(
      { length: 12 },
      (_, i) => `T${i},Test Employee ${i},01712345678,${i + 1}`,
    ).join("\n");
  await paste(page, data);
  await expect(
    page.getByRole("checkbox", { name: /Select Test Employee/ }),
  ).toHaveCount(10);
  await page.getByRole("button", { name: "Next employee page" }).click();
  await expect(
    page.getByRole("checkbox", { name: /Select Test Employee/ }),
  ).toHaveCount(2);
  await page.getByRole("button", { name: "Previous employee page" }).click();
  await page.getByRole("button", { name: "Absent", exact: true }).click();
  await page.getByRole("button", { name: "Absent", exact: true }).click();
  await expect(page.locator("tbody tr").first()).toContainText(
    "Test Employee 11",
  );
  await page.getByRole("button", { name: "Clear employee list" }).click();
  await page.getByRole("button", { name: "Keep employees" }).click();
  await expect(page.locator("#employees-title .count")).toHaveText("12");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download sample template" }).click();
  expect((await download).suggestedFilename()).toBe(
    "KADW_Daily_Absent_List_Template.xlsx",
  );
  await page.getByRole("button", { name: "Clear employee list" }).click();
  await page
    .getByRole("button", { name: "Clear employees", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your team’s day starts here" }),
  ).toBeVisible();
});
test("Emergency Message uploads directory, filters Staff/Worker/Office & Designation, prepares emergency chuti, and sends", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "kadw_gateway_config",
      JSON.stringify({ provider: "simulation", delayBetweenSMS: 0 }),
    ),
  );
  await page.goto("/");
  await page.getByRole("tab", { name: /Emergency Message/ }).click();
  const csv = [
    "SL,Employee ID,Employee Name,Designation,Employee_Type,Mobile No",
    "1,KADS5,Sahidul,Deputy Production Manager,Staff,01741144499",
    "2,KADW23,Maksuda,Junior Sewing Operator,Worker,01708049441",
    "3,KADS40,Md. Arif Hossain,Senior Merchandiser,Office,01939196876",
    '4,KADS188,Aysha Siddiqua,"Manager HR,Admin & Compliance",Staff,01703211565',
  ].join("\n");
  await page
    .getByLabel("Emergency employee list file")
    .setInputFiles({
      name: "employees.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });
  await expect(page.locator("#emergency-list-title .count")).toHaveText("4");
  await page.getByRole("button", { name: /^Staff\s+2$/ }).click();
  await expect(page.locator("#emergency-list-title .count")).toHaveText("2");
  await expect(page.getByText("Sahidul", { exact: true })).toBeVisible();
  await expect(page.getByText("Maksuda", { exact: true })).toHaveCount(0);
  await page
    .getByLabel("Filter by designation")
    .selectOption("Manager HR,Admin & Compliance");
  await expect(page.locator("#emergency-list-title .count")).toHaveText("1");
  await page.getByLabel("Select filtered (1)").check();
  await page.getByLabel("Emergency notice date").fill("2026-11-19");
  await page
    .getByRole("button", { name: "Review emergency simulation" })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Aysha Siddiqua");
  await expect(page.getByRole("dialog")).toContainText("19 Nov 2026");
  await expect(page.getByRole("dialog")).toContainText("জরুরি ছুটি");
  await page.getByRole("button", { name: "Start simulation" }).click();
  await expect(
    page.getByRole("heading", { name: "Dispatch complete" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: "Clear directory" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Clear directory", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Upload emergency employee directory" }),
  ).toBeVisible();
});
