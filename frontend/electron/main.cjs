const { app, BrowserWindow, dialog, ipcMain, safeStorage } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");

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

  const apiBaseUrl = (
    process.env.BACKEND_API_URL || "http://127.0.0.1:8000"
  ).replace(/\/+$/, "");

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
  const apiBaseUrl = (
    process.env.BACKEND_API_URL || "http://127.0.0.1:8000"
  ).replace(/\/+$/, "");
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
  elements: {
    roles: ["admin", "supervisor"],
    listPath: "/get-elements",
    createPath: "/elements/",
    updatePath: (id) => `/elements/${id}`,
    deletePath: (id) => `/elements/${id}`,
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
  const apiBaseUrl = (
    process.env.BACKEND_API_URL || "http://127.0.0.1:8000"
  ).replace(/\/+$/, "");
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
      if (typeof result.detail === "string") detail = result.detail;
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

    // Bulk delete or single delete for Daily Inputs
    if (operation === "delete" && section === "dailyInputs") {
      const ids = Array.isArray(recordIds)
        ? recordIds
        : [recordId];

      const normalizedIds = ids.map(Number);

      if (
        normalizedIds.length === 0 ||
        !normalizedIds.every(
          (id) => Number.isInteger(id) && id > 0
        )
      ) {
        return {
          ok: false,
          error: "The selected record IDs are invalid.",
        };
      }

      return requestWorkspaceApi(
        "/daily-inputs/",
        "DELETE",
        normalizedIds
      );
    }

    // Validate the ID for other operations
    if (!Number.isInteger(recordId) || recordId < 1) {
      return {
        ok: false,
        error: "The selected record has an invalid ID.",
      };
    }

    // Delete records in other sections
    if (operation === "delete") {
      return requestWorkspaceApi(
        workspaceSections[section].deletePath(recordId),
        "DELETE"
      );
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

ipcMain.handle("auth:login", async (_event, credentials) => {
  const apiBaseUrl = (
    process.env.BACKEND_API_URL || "http://127.0.0.1:8000"
  ).replace(/\/+$/, "");

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
