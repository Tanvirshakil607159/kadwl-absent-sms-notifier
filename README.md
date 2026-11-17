# K.A. Design Wear — Attendance & Notifications

A responsive HR workspace for importing absence reports, reviewing employees and preparing personalized Bangla or English SMS reminders.

## Run locally

Install Node.js 22.12+ (Node 24 is supported), then run:

```sh
npm install
npm run dev
```

On Windows, double-click `run.bat`. The app opens at the address printed by Vite. Keep using the same address and port: saved attendance and message history belong to that browser origin.

```sh
npm run build       # Create production files in dist/
npm run preview     # Preview the production build
npm run lint        # Static checks
npm test            # Business logic regression tests
npm run test:e2e    # Browser regression tests (Google Chrome required)
```

## Workflow

1. Import XLSX, XLS, or CSV, or paste rows copied from Excel. Imports replace the current employee list; imported employees are not selected automatically.
2. Filter by absence duration, line, shift, name, ID, or phone. Fix invalid phone numbers directly in the list. Selecting or deselecting filtered employees preserves selections outside that filter.
3. Select employees, choose a template, and preview personalized messages. Estimates use the rendered message for each valid recipient, including GSM extension characters and Unicode multipart boundaries.
4. Review the recipient list, personalized text, mode, and estimated cost before starting. Invalid phone numbers are skipped.
5. Open Message history to review or export results. Stopping a batch finishes its current message, saves that result, and stops the remaining queue.

## Imports

Employee ID and Name headers are required for file imports. Header order is flexible. Supported optional columns include Designation, Line, Shift, Last Present Date, No of Absent Days, and Mobile No. Download the sample Excel template from the app.

Pasted data may include headers, or exactly 3 columns (ID, Name, Mobile) or the 9 sample-template columns. Duplicate IDs, missing required values, and invalid absence durations are rejected before replacing the current list. Bangladesh phone numbers support local, +880, numeric Excel cells, and Bengali-digit formats.

## SMS configuration

Simulation is the default. It makes no gateway requests, incurs no cost, and records results as **Simulated**. Greenweb BD, BulkSMSBD, and custom HTTPS endpoints are supported. Unsupported providers and missing credentials produce errors rather than simulated success.

Gateway API keys remain in memory only and must be re-entered after reload. Other settings, attendance, and message history use browser local storage. Old stored API keys are cleared during initialization. Storage failures display a visible warning.

Live SMS requires an active provider account, approved sender ID, and a provider endpoint that permits browser requests. A backend proxy is needed for providers that reject browser CORS requests, and is recommended for shared production deployments. The current app has no server authentication or cross-device database. **Sent** means accepted by the provider, not a confirmed handset delivery receipt. Custom gateways currently use HTTP success status as acceptance; inspect their response in history for provider-specific details. Requests time out after 20 seconds; timeouts are recorded as failures and are not retried automatically because the provider may already have accepted the message.

No live SMS was sent during development verification. Gateway success/failure handling is covered by mocked network tests.

## Branding and accessibility

The supplied original company logo is stored at `public/company-logo.png` and used for the company identity, favicon, and touch icon. Interface icons animate gently and respond to interaction; reduced-motion preferences disable animation. Dialogs support keyboard focus trapping, Escape, and focus restoration. The layout adapts to phones, with horizontal scrolling confined to employee tables.

## Spreadsheet dependency

SheetJS CE 0.20.3 is installed from the [official SheetJS distribution](https://docs.sheetjs.com/docs/getting-started/installation/frameworks/). Spreadsheet code loads only when importing or exporting, keeping the initial page bundle smaller.
