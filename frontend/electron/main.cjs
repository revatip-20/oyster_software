const { app, BrowserWindow, dialog, ipcMain, safeStorage } = require("electron");
const fs = require("node:fs/promises");
const nodeFs = require("node:fs");
const path = require("node:path");

// Load environment variables from frontend/.env file if present
function loadEnv() {
  const envPaths = [
    path.join(__dirname, "..", ".env"),
    path.join(process.cwd(), "frontend", ".env"),
    ...(process.resourcesPath ? [path.join(process.resourcesPath, ".env")] : []),
    ...(process.execPath ? [path.join(path.dirname(process.execPath), ".env")] : []),
  ];

  for (const envPath of envPaths) {
    try {
      if (nodeFs.existsSync(envPath)) {
        const fileContent = nodeFs.readFileSync(envPath, "utf8");
        for (const line of fileContent.split(/\r?\n/)) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) continue;
          const eqIdx = trimmed.indexOf("=");
          if (eqIdx !== -1) {
            const key = trimmed.slice(0, eqIdx).trim();
            let val = trimmed.slice(eqIdx + 1).trim();
            if (
              (val.startsWith('"') && val.endsWith('"')) ||
              (val.startsWith("'") && val.endsWith("'"))
            ) {
              val = val.slice(1, -1);
            }
            if (val) {
              process.env[key] = val;
              if (key === "BACKEND_API_URL" && !process.env.VITE_BACKEND_API_URL) {
                process.env.VITE_BACKEND_API_URL = val;
              }
              if (key === "VITE_BACKEND_API_URL" && !process.env.BACKEND_API_URL) {
                process.env.BACKEND_API_URL = val;
              }
            }
          }
        }
        console.info(`[electron] Loaded environment variables from: ${envPath}`);
      }
    } catch (err) {
      console.warn(`[electron] Could not load .env from ${envPath}:`, err.message);
    }
  }
}
loadEnv();

function getBackendApiUrl() {
  let url =
    process.env.BACKEND_API_URL ||
    process.env.VITE_BACKEND_API_URL ||
    process.env.BACKEND_URL ||
    process.env.VITE_BACKEND_URL ||
    "https://oyster-software.onrender.com";

  url = String(url).trim().replace(/\/+$/, "");
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }
  return url;
}

console.info(`[electron] Backend API target URL: ${getBackendApiUrl()}`);

ipcMain.handle("app:get-version", () => app.getVersion());

let authenticatedSession = null;

function getSessionFilePath() {
  return path.join(app.getPath("userData"), "auth-session.bin");
}

async function persistAuthenticatedSession() {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("Secure credential storage is unavailable.");
  }

  const sessionDirectory = app.getPath("userData");
  const sessionPath = getSessionFilePath();
  const temporaryPath = `${sessionPath}.tmp`;
  const encryptedSession = safeStorage.encryptString(JSON.stringify(authenticatedSession));

  await fs.mkdir(sessionDirectory, { recursive: true });
  await fs.writeFile(temporaryPath, encryptedSession);
  await fs.rename(temporaryPath, sessionPath);
}

async function clearPersistedSession() {
  try {
    await fs.rm(getSessionFilePath(), { force: true });
  } catch (error) {
    console.error("Unable to remove the saved authentication session.", error);
  }
}

async function loadPersistedSession() {
  if (!safeStorage.isEncryptionAvailable()) return null;

  try {
    const encryptedSession = await fs.readFile(getSessionFilePath());
    const savedSession = JSON.parse(safeStorage.decryptString(encryptedSession));
    if (
      typeof savedSession.accessToken !== "string"
      || typeof savedSession.refreshToken !== "string"
      || !savedSession.user
    ) {
      await clearPersistedSession();
      return null;
    }
    return savedSession;
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Unable to restore the saved authentication session.", error);
      await clearPersistedSession();
    }
    return null;
  }
}

async function refreshAuthenticatedSession() {
  if (!authenticatedSession?.refreshToken) {
    authenticatedSession = null;
    await clearPersistedSession();
    return { ok: false, sessionExpired: true, error: "Please sign in again." };
  }

  const apiBaseUrl = getBackendApiUrl();

  let response;
  try {
    response = await fetch(`${apiBaseUrl}/users/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: authenticatedSession.refreshToken }),
    });
  } catch {
    return {
      ok: false,
      error: `Could not connect to the backend at ${apiBaseUrl}. Your saved session is retained.`,
    };
  }

  if (response.status === 401 || response.status === 403) {
    authenticatedSession = null;
    await clearPersistedSession();
    return {
      ok: false,
      sessionExpired: true,
      error: "Your saved session is no longer valid. Please sign in again.",
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      error: `Session refresh failed (HTTP ${response.status}). Your saved session is retained.`,
    };
  }

  let refreshed;
  try {
    refreshed = await response.json();
  } catch {
    return { ok: false, error: "The backend returned an invalid session response." };
  }

  if (
    typeof refreshed.access_token !== "string"
    || typeof refreshed.refresh_token !== "string"
    || !refreshed.user
  ) {
    return { ok: false, error: "The backend returned an incomplete session response." };
  }

  authenticatedSession = {
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token,
    expiresIn: refreshed.expires_in,
    user: refreshed.user,
  };
  await persistAuthenticatedSession();
  return { ok: true, user: authenticatedSession.user };
}

ipcMain.handle("auth:get-session", async () => {
  if (!authenticatedSession) {
    authenticatedSession = await loadPersistedSession();
  }
  if (!authenticatedSession) return null;

  const refreshed = await refreshAuthenticatedSession();
  if (refreshed.ok || refreshed.sessionExpired) return refreshed.user ?? null;
  return authenticatedSession?.user ?? null;
});

ipcMain.handle("backend:status", async () => {
  const apiBaseUrl = getBackendApiUrl();
  try {
    const response = await fetch(`${apiBaseUrl}/`);
    if (!response.ok) {
      return {
        ok: false,
        error: `Backend health check failed (HTTP ${response.status}).`,
      };
    }
    const result = await response.json();
    return {
      ok: true,
      message: typeof result.message === "string"
        ? result.message
        : "Backend is connected.",
    };
  } catch {
    return {
      ok: false,
      error: `Could not connect to the backend at ${apiBaseUrl}.`,
    };
  }
});

const workspaceSections = {
  supervisors: {
    roles: ["admin"],
    listPath: "/users/get-supervisor",
    createPath: "/users/add-supervisor",
    updatePath: (id) => `/users/edit-supervisor/${id}`,
    deletePath: (id) => `/users/delete-supervisor/${id}`,
  },
  employees: {
    roles: ["admin", "supervisor"],
    listPath: "/users/get-employees",
    createPath: "/users/add-employee",
    updatePath: (id) => `/users/edit-employee/${id}`,
    deletePath: (id) => `/users/delete-employee/${id}`,
  },
  rawMaterials: {
    roles: ["admin", "supervisor"],
    listPath: "/get-raw-material",
    createPath: "/raw-materials/",
    updatePath: (id) => `/raw-materials/${id}`,
    deletePath: (id) => `/raw-materials/${id}`,
  },
  products: {
    roles: ["admin", "supervisor"],
    listPath: "/get-products",
    createPath: "/products/",
    updatePath: (id) => `/products/${id}`,
    deletePath: (id) => `/products/${id}`,
  },
  costData: {
    roles: ["admin", "supervisor"],
    listPath: "/get-cost-data",
    createPath: "/cost-data/",
    updatePath: (id) => `/cost-data/${id}`,
    deletePath: (id) => `/cost-data/${id}`,
  },
  suppliers: {
    roles: ["admin", "supervisor"],
    listPath: "/get-suppliers",
    createPath: "/suppliers/",
    updatePath: (id) => `/suppliers/${id}`,
    deletePath: (id) => `/suppliers/${id}`,
  },
  customers: {
    roles: ["admin", "supervisor"],
    listPath: "/get-customers",
    createPath: "/customers/",
    updatePath: (id) => `/customers/${id}`,
    deletePath: (id) => `/customers/${id}`,
  },
  dailyInputs: {
    roles: ["admin", "supervisor"],
    listPath: "/daily-inputs/",
    createPath: "/daily-inputs/",
    updatePath: (id) => `/daily-inputs/${id}`,
    deletePath: (id) => `/daily-inputs/${id}`,
  },
};

async function requestWorkspaceApi(path, method, body) {
  const apiBaseUrl = getBackendApiUrl();
  const headers = {
    Authorization: `Bearer ${authenticatedSession.accessToken}`,
  };
  if (body) headers["Content-Type"] = "application/json";

  let response;
  try {
    console.info(`[backend-api] ${method} ${path}`);
    response = await fetch(`${apiBaseUrl}${path}`, {
      method,
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    console.error(`[backend-api] ${method} ${path} failed: network request error`);
    return {
      ok: false,
      error: `Could not connect to the backend at ${apiBaseUrl}. Check that the backend is running.`,
    };
  }

  if (response.status === 401) {
    const refreshed = await refreshAuthenticatedSession();
    if (!refreshed.ok) {
      return {
        ok: false,
        ...(refreshed.sessionExpired ? { sessionExpired: true } : {}),
        error: refreshed.error || "Unable to refresh your session.",
      };
    }

    try {
      console.info(`[backend-api] retry ${method} ${path}`);
      response = await fetch(`${apiBaseUrl}${path}`, {
        method,
        headers: {
          ...headers,
          Authorization: `Bearer ${authenticatedSession.accessToken}`,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      return {
        ok: false,
        error: `Could not connect to the backend at ${apiBaseUrl}. Your saved session is retained.`,
      };
    }
  }

  console.info(`[backend-api] ${method} ${path} -> HTTP ${response.status}`);

  if (!response.ok) {
    let detail = `The backend returned an error (HTTP ${response.status}).`;
    try {
      const result = await response.json();
      if (typeof result.detail === "string") {
        detail = result.detail;
      } else if (Array.isArray(result.detail)) {
        detail = result.detail
          .map((item) => {
            if (typeof item === "string") return item;
            if (item && typeof item.msg === "string") return item.msg;
            return "";
          })
          .filter(Boolean)
          .join(" ");
      }
    } catch {
      // Keep the HTTP status message when the backend response is not JSON.
    }
    if (response.status === 401) {
      authenticatedSession = null;
      await clearPersistedSession();
    }
    return {
      ok: false,
      sessionExpired: response.status === 401,
      error: detail,
    };
  }

  try {
    return { ok: true, data: await response.json() };
  } catch {
    return { ok: false, error: "The backend returned an invalid response." };
  }
}

function canAccessSection(section) {
  return Boolean(
    authenticatedSession
      && Object.hasOwn(workspaceSections, section)
      && workspaceSections[section]
      && workspaceSections[section].roles.includes(authenticatedSession.user.role),
  );
}

ipcMain.handle("workspace:list", async (_event, section) => {
  if (!authenticatedSession) {
    return { ok: false, sessionExpired: true, error: "Please sign in again." };
  }
  if (!canAccessSection(section)) {
    return { ok: false, error: "You do not have permission to view this section." };
  }
  return requestWorkspaceApi(workspaceSections[section].listPath, "GET");
});

ipcMain.handle("workspace:create", async (_event, section, record) => {
  if (!authenticatedSession) {
    return { ok: false, sessionExpired: true, error: "Please sign in again." };
  }
  if (!canAccessSection(section)) {
    return { ok: false, error: "You do not have permission to add this record." };
  }
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return { ok: false, error: "The submitted form data is invalid." };
  }
  return requestWorkspaceApi(
    workspaceSections[section].createPath,
    "POST",
    record,
  );
});

ipcMain.handle(
  "workspace:mutate",
  async (_event, operation, section, recordId, record, recordIds) => {
    if (!authenticatedSession) {
      return {
        ok: false,
        sessionExpired: true,
        error: "Please sign in again.",
      };
    }

    if (!canAccessSection(section)) {
      return {
        ok: false,
        error: "You do not have permission to change this section.",
      };
    }

    if (!["update", "delete"].includes(operation)) {
      return {
        ok: false,
        error: "This workspace operation is not supported.",
      };
    }

    if (operation === "delete") {
      const ids = (Array.isArray(recordIds) && recordIds.length > 0
        ? recordIds
        : [recordId]
      ).map(Number);

      if (
        ids.length === 0
        || !ids.every((id) => Number.isInteger(id) && id > 0)
      ) {
        return {
          ok: false,
          error: "The selected record IDs are invalid.",
        };
      }

      if (section === "dailyInputs" && ids.length > 1) {
        return requestWorkspaceApi("/daily-inputs/", "DELETE", { ids });
      }

      for (const id of ids) {
        const result = await requestWorkspaceApi(
          workspaceSections[section].deletePath(id),
          "DELETE",
        );
        if (!result.ok) {
          return result;
        }
      }

      return {
        ok: true,
        data: {
          deleted_count: ids.length,
          deleted_ids: ids,
        },
      };
    }

    // Update records
    if (
      !record ||
      typeof record !== "object" ||
      Array.isArray(record)
    ) {
      return {
        ok: false,
        error: "The submitted form data is invalid.",
      };
    }

    return requestWorkspaceApi(
      workspaceSections[section].updatePath(recordId),
      "PATCH",
      record
    );
  }
);


ipcMain.handle("workspace:export-csv", async (event, section, columnLabels, rows) => {
  if (!authenticatedSession) {
    return { ok: false, sessionExpired: true, error: "Please sign in again." };
  }
  if (!canAccessSection(section)) {
    return { ok: false, error: "You do not have permission to export this section." };
  }
  if (
    !Array.isArray(columnLabels)
    || columnLabels.length === 0
    || !columnLabels.every((label) => typeof label === "string")
    || !Array.isArray(rows)
    || !rows.every((row) => Array.isArray(row) && row.length === columnLabels.length)
  ) {
    return { ok: false, error: "The table data could not be exported." };
  }

  const escapeCsvCell = (value) => {
    let cell = value === null || value === undefined ? "" : String(value);
    const trimmed = cell.trim();
    if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}.*)?$/.test(trimmed) || /^\d{2}[-/]\d{2}[-/]\d{4}$/.test(trimmed)) {
      const cleanDate = trimmed.includes("T") ? trimmed.split("T")[0] : trimmed;
      return `"=""${cleanDate}"""`;
    }
    if (/^[\s]*[=+\-@]/.test(cell)) cell = `'${cell}`;
    return `"${cell.replaceAll('"', '""')}"`;
  };
  const csv = [columnLabels, ...rows]
    .map((row) => row.map(escapeCsvCell).join(","))
    .join("\r\n");
  const options = {
    title: "Save table as CSV",
    defaultPath: path.join(
      app.getPath("downloads"),
      `${section}-${new Date().toISOString().slice(0, 10)}.csv`,
    ),
    filters: [{ name: "CSV files", extensions: ["csv"] }],
  };

  try {
    const window = BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePath } = window
      ? await dialog.showSaveDialog(window, options)
      : await dialog.showSaveDialog(options);
    if (canceled || !filePath) return { ok: true, canceled: true };

    await fs.writeFile(filePath, `\uFEFF${csv}`, "utf8");
    return { ok: true, filePath, count: rows.length };
  } catch {
    return { ok: false, error: "Unable to save the CSV file." };
  }
});

ipcMain.handle("workspace:export-pdf", async (event, section, htmlContent, title) => {
  if (!authenticatedSession) {
    return { ok: false, sessionExpired: true, error: "Please sign in again." };
  }
  if (!canAccessSection(section)) {
    return { ok: false, error: "You do not have permission to export this section." };
  }
  if (!htmlContent || typeof htmlContent !== "string") {
    return { ok: false, error: "No document content provided for PDF export." };
  }

  const defaultFileName = `${section || "document"}-invoice-${new Date().toISOString().slice(0, 10)}.pdf`;
  const options = {
    title: `Save ${title || "Invoice"} as PDF`,
    defaultPath: path.join(app.getPath("downloads"), defaultFileName),
    filters: [{ name: "PDF files", extensions: ["pdf"] }],
  };

  try {
    const parentWindow = BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePath } = parentWindow
      ? await dialog.showSaveDialog(parentWindow, options)
      : await dialog.showSaveDialog(options);
    if (canceled || !filePath) return { ok: true, canceled: true };

    const printWin = new BrowserWindow({
      show: false,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
      },
    });

    await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
    const pdfBuffer = await printWin.webContents.printToPDF({
      printBackground: true,
      pageSize: "A4",
      landscape: true,
      margins: { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 },
    });
    printWin.destroy();

    await fs.writeFile(filePath, pdfBuffer);
    return { ok: true, filePath };
  } catch {
    return { ok: false, error: "Unable to generate and save the PDF file." };
  }
});

ipcMain.handle("workspace:print-preview", async (event, htmlContent, title) => {
  if (!authenticatedSession) {
    return { ok: false, sessionExpired: true, error: "Please sign in again." };
  }
  if (!htmlContent || typeof htmlContent !== "string") {
    return { ok: false, error: "No document content provided for print preview." };
  }

  const escapeHtmlText = (text) => {
    if (text === null || text === undefined) return "";
    return String(text)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  };

  const fullPreviewHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Print Preview - ${escapeHtmlText(title || "Invoice")}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0f172a;
      color: #f8fafc;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .preview-toolbar {
      background: #1e293b;
      border-bottom: 1px solid #334155;
      padding: 10px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-shrink: 0;
      z-index: 100;
    }
    .preview-toolbar-title {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .preview-badge {
      background: #2563eb;
      color: #ffffff;
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .preview-doc-title {
      font-size: 14px;
      font-weight: 600;
      color: #f1f5f9;
    }
    .preview-toolbar-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .preview-btn {
      padding: 7px 14px;
      font-size: 13px;
      font-weight: 500;
      border-radius: 6px;
      cursor: pointer;
      border: 1px solid transparent;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s ease;
    }
    .preview-btn-print {
      background: #2563eb;
      color: #ffffff;
      border-color: #1d4ed8;
      font-weight: 600;
      box-shadow: 0 1px 3px rgba(0,0,0,0.3);
    }
    .preview-btn-print:hover {
      background: #1d4ed8;
    }
    .preview-btn-secondary {
      background: #334155;
      color: #e2e8f0;
      border-color: #475569;
    }
    .preview-btn-secondary:hover {
      background: #475569;
      color: #ffffff;
    }
    .preview-zoom-controls {
      display: flex;
      align-items: center;
      gap: 4px;
      background: #0f172a;
      padding: 3px;
      border-radius: 6px;
      border: 1px solid #334155;
    }
    .preview-zoom-btn {
      background: transparent;
      border: none;
      color: #94a3b8;
      padding: 4px 8px;
      font-size: 12px;
      border-radius: 4px;
      cursor: pointer;
    }
    .preview-zoom-btn:hover {
      color: #f8fafc;
      background: #1e293b;
    }
    .preview-zoom-btn.active {
      color: #ffffff;
      background: #334155;
      font-weight: 600;
    }
    .preview-container {
      flex: 1;
      overflow: auto;
      background: #0f172a;
      padding: 24px;
      display: flex;
      justify-content: center;
      align-items: flex-start;
    }
    .preview-paper {
      background: #ffffff;
      color: #0f172a;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
      border-radius: 2px;
      padding: 12mm 15mm;
      width: 297mm;
      min-height: 210mm;
      box-sizing: border-box;
      transform-origin: top center;
      transition: transform 0.2s ease;
    }

    @media print {
      .preview-toolbar {
        display: none !important;
      }
      body {
        background: transparent !important;
        margin: 0 !important;
        padding: 0 !important;
        height: auto !important;
      }
      .preview-container {
        padding: 0 !important;
        background: transparent !important;
        display: block !important;
      }
      .preview-paper {
        box-shadow: none !important;
        border-radius: 0 !important;
        padding: 0 !important;
        margin: 0 !important;
        width: 100% !important;
        min-height: auto !important;
        transform: none !important;
      }
      @page {
        size: A4 landscape;
        margin: 10mm;
      }
    }
  </style>
</head>
<body>
  <div class="preview-toolbar">
    <div class="preview-toolbar-title">
      <span class="preview-badge">Print Preview</span>
      <span class="preview-doc-title">${escapeHtmlText(title || "Invoice")}</span>
    </div>
    <div class="preview-zoom-controls">
      <button class="preview-zoom-btn" onclick="setZoom(0.75)">75%</button>
      <button class="preview-zoom-btn active" id="zoom-100" onclick="setZoom(1.0)">100%</button>
      <button class="preview-zoom-btn" onclick="setZoom(1.25)">125%</button>
      <button class="preview-zoom-btn" onclick="fitWidth()">Fit Width</button>
    </div>
    <div class="preview-toolbar-actions">
      <button class="preview-btn preview-btn-secondary" onclick="window.close()">Close</button>
      <button class="preview-btn preview-btn-print" onclick="window.print()">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 6 2 18 2 18 9"></polyline>
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
          <rect x="6" y="14" width="12" height="8"></rect>
        </svg>
        Print
      </button>
    </div>
  </div>

  <div class="preview-container" id="preview-container">
    <div class="preview-paper" id="preview-paper">
      ${htmlContent}
    </div>
  </div>

  <script>
    let currentZoom = 1.0;
    const paper = document.getElementById("preview-paper");
    const container = document.getElementById("preview-container");

    function setZoom(val) {
      currentZoom = val;
      paper.style.transform = "scale(" + val + ")";
      document.querySelectorAll(".preview-zoom-btn").forEach(btn => btn.classList.remove("active"));
      if (val === 1.0) {
        document.getElementById("zoom-100").classList.add("active");
      }
    }

    function fitWidth() {
      const containerWidth = container.clientWidth - 60;
      const paperWidth = paper.offsetWidth || 1122;
      const ratio = Math.min(1.2, Math.max(0.4, containerWidth / paperWidth));
      setZoom(Math.round(ratio * 100) / 100);
    }
  </script>
</body>
</html>`;

  try {
    const parentWindow = BrowserWindow.fromWebContents(event.sender);
    const previewWindow = new BrowserWindow({
      parent: parentWindow || undefined,
      width: 1180,
      height: 860,
      minWidth: 800,
      minHeight: 500,
      title: `Print Preview - ${title || "Document"}`,
      backgroundColor: "#0f172a",
      autoHideMenuBar: true,
      webPreferences: {
        sandbox: false,
        contextIsolation: false,
      },
    });

    const tempPath = path.join(app.getPath("temp"), `print-preview-${Date.now()}.html`);
    await fs.writeFile(tempPath, fullPreviewHtml, "utf8");
    await previewWindow.loadFile(tempPath);

    previewWindow.on("closed", () => {
      fs.unlink(tempPath).catch(() => {});
    });

    return { ok: true };
  } catch {
    return { ok: false, error: "Unable to open print preview." };
  }
});

ipcMain.handle("auth:login", async (_event, credentials) => {
  const apiBaseUrl = getBackendApiUrl();

  let response;
  try {
    response = await fetch(`${apiBaseUrl}/users/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: credentials.email,
        password: credentials.password,
      }),
    });
  } catch {
    return {
      ok: false,
      error: `Could not connect to the backend at ${apiBaseUrl}. Check that the backend is running.`,
    };
  }

  let result;
  try {
    result = await response.json();
  } catch {
    return {
      ok: false,
      error: `The backend returned an invalid response (HTTP ${response.status}).`,
    };
  }

  if (!result || typeof result !== "object") {
    return {
      ok: false,
      error: `The backend returned an invalid response (HTTP ${response.status}).`,
    };
  }

  if (!response.ok) {
    const detail = typeof result.detail === "string"
      ? result.detail
      : "Unable to sign in. Check your details and try again.";
    return { ok: false, error: detail };
  }

  if (
    typeof result.access_token !== "string"
    || typeof result.refresh_token !== "string"
    || !result.user
  ) {
    return { ok: false, error: "The backend returned an incomplete login response." };
  }

  authenticatedSession = {
    accessToken: result.access_token,
    refreshToken: result.refresh_token,
    expiresIn: result.expires_in,
    user: result.user,
  };

  try {
    await persistAuthenticatedSession();
  } catch (error) {
    authenticatedSession = null;
    return {
      ok: false,
      error: error.message || "Unable to securely save your session on this device.",
    };
  }

  return { ok: true, user: authenticatedSession.user };
});

ipcMain.handle("auth:logout", async () => {
  authenticatedSession = null;
  await clearPersistedSession();
});

function createWindow() {
  const window = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 720,
    minHeight: 520,
    backgroundColor: "#10151f",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (!app.isPackaged) {
    window.loadURL(
      process.env.VITE_DEV_SERVER_URL || "http://127.0.0.1:5173",
    );
  } else {
    window.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
