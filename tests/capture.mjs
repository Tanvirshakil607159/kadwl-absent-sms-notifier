import { chromium } from "@playwright/test";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1100 },
  deviceScaleFactor: 1,
});
page.on("pageerror", (error) => console.log("PAGE ERROR:", error.message));
await page.goto("http://127.0.0.1:5173");
await page.evaluate(() => document.fonts.ready);
await page.screenshot({
  path: "artifacts/dashboard-desktop.png",
  fullPage: true,
});
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({
  path: "artifacts/dashboard-mobile.png",
  fullPage: true,
});
console.log(
  "Page width",
  await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    viewport: innerWidth,
  })),
);
await page.setViewportSize({ width: 1440, height: 1100 });
await page.getByRole("button", { name: "Paste from Excel" }).click();
await page
  .getByLabel("Attendance rows")
  .fill(
    "ID,Name,Line,Shift,Absent Days,Mobile No\nDEMO001,Amina Akter,1,Day,1,01712345678\nDEMO002,Rahima Begum,2,Day,3,01812345678\nDEMO003,Fatima Khan,1,Night,5,Invalid",
  );
await page.getByRole("button", { name: "Import pasted employees" }).click();
await page.getByRole("checkbox", { name: "Select Amina Akter" }).check();
await page.screenshot({
  path: "artifacts/dashboard-populated.png",
  fullPage: true,
  animations: "disabled",
});
await browser.close();
