const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("node:path");

ipcMain.handle("app:get-version", () => app.getVersion());

let authenticatedSession = null;

ipcMain.handle("auth:get-session", () => authenticatedSession?.user ?? null);

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

  if (response.status === 401 && authenticatedSession.refreshToken) {
    try {
      console.info("[backend-api] POST /users/refresh");
      const refreshResponse = await fetch(`${apiBaseUrl}/users/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          refresh_token: authenticatedSession.refreshToken,
        }),
      });
      if (refreshResponse.ok) {
        const refreshed = await refreshResponse.json();
        if (
          typeof refreshed.access_token === "string"
          && typeof refreshed.refresh_token === "string"
        ) {
          authenticatedSession.accessToken = refreshed.access_token;
          authenticatedSession.refreshToken = refreshed.refresh_token;
          authenticatedSession.expiresIn = refreshed.expires_in;
          console.info(`[backend-api] retry ${method} ${path}`);
          response = await fetch(`${apiBaseUrl}${path}`, {
            method,
            headers: {
              ...headers,
              Authorization: `Bearer ${authenticatedSession.accessToken}`,
            },
            ...(body ? { body: JSON.stringify(body) } : {}),
          });
        } else {
          authenticatedSession = null;
        }
      } else {
        authenticatedSession = null;
      }
    } catch {
      return {
        ok: false,
        sessionExpired: true,
        error: "Your session expired and could not be refreshed. Please sign in again.",
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
  async (_event, operation, section, recordId, record) => {
    if (!authenticatedSession) {
      return { ok: false, sessionExpired: true, error: "Please sign in again." };
    }
    if (!canAccessSection(section)) {
      return {
        ok: false,
        error: "You do not have permission to change this section.",
      };
    }
    if (!["update", "delete"].includes(operation)) {
      return { ok: false, error: "This workspace operation is not supported." };
    }
    if (!Number.isInteger(recordId) || recordId < 1) {
      return { ok: false, error: "The selected record has an invalid ID." };
    }

    if (operation === "delete") {
      return requestWorkspaceApi(
        workspaceSections[section].deletePath(recordId),
        "DELETE",
      );
    }

    if (!record || typeof record !== "object" || Array.isArray(record)) {
      return { ok: false, error: "The submitted form data is invalid." };
    }
    return requestWorkspaceApi(
      workspaceSections[section].updatePath(recordId),
      "PATCH",
      record,
    );
  },
);

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

  return { ok: true, user: authenticatedSession.user };
});

ipcMain.handle("auth:logout", () => {
  authenticatedSession = null;
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
