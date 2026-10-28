// Browser fallback for window.desktop when running outside of Electron.
// Strictly uses the backend API URL provided in the environment variables.

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

export function getBackendApiUrl() {
  const url =
    (typeof import.meta !== "undefined" && import.meta.env && (import.meta.env.VITE_BACKEND_API_URL || import.meta.env.BACKEND_API_URL)) ||
    (typeof process !== "undefined" && process.env && (process.env.BACKEND_API_URL || process.env.VITE_BACKEND_API_URL)) ||
    "https://oyster-software.onrender.com";

  let trimmed = String(url).trim().replace(/\/+$/, "");
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    trimmed = `https://${trimmed}`;
  }
  return trimmed;
}

if (typeof window !== "undefined" && !window.desktop) {
  const SESSION_STORAGE_KEY = "oyster_auth_session";

  const getStoredSession = () => {
    try {
      const data = localStorage.getItem(SESSION_STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  };

  const setStoredSession = (session) => {
    try {
      if (session) {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
      } else {
        localStorage.removeItem(SESSION_STORAGE_KEY);
      }
    } catch {
      // ignore
    }
  };

  const refreshSession = async (session) => {
    if (!session?.refreshToken) {
      setStoredSession(null);
      return { ok: false, sessionExpired: true, error: "Please sign in again." };
    }
    const apiBaseUrl = getBackendApiUrl();
    let response;
    try {
      response = await fetch(`${apiBaseUrl}/users/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: session.refreshToken }),
      });
    } catch {
      return { ok: false, error: `Could not connect to the backend at ${apiBaseUrl}.` };
    }

    if (response.status === 401 || response.status === 403) {
      setStoredSession(null);
      return { ok: false, sessionExpired: true, error: "Your session has expired. Please sign in again." };
    }

    if (!response.ok) {
      return { ok: false, error: `Session refresh failed (HTTP ${response.status}).` };
    }

    try {
      const refreshed = await response.json();
      if (!refreshed.access_token || !refreshed.refresh_token || !refreshed.user) {
        return { ok: false, error: "Invalid session response from backend." };
      }
      const newSession = {
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token,
        expiresIn: refreshed.expires_in,
        user: refreshed.user,
      };
      setStoredSession(newSession);
      return { ok: true, user: newSession.user };
    } catch {
      return { ok: false, error: "Invalid JSON response on session refresh." };
    }
  };

  const requestWorkspaceApi = async (path, method, body) => {
    const session = getStoredSession();
    if (!session?.accessToken) {
      return { ok: false, sessionExpired: true, error: "Please sign in again." };
    }
    const apiBaseUrl = getBackendApiUrl();
    const headers = {
      Authorization: `Bearer ${session.accessToken}`,
    };
    if (body) headers["Content-Type"] = "application/json";

    let response;
    try {
      response = await fetch(`${apiBaseUrl}${path}`, {
        method,
        headers,
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      return {
        ok: false,
        error: `Could not connect to the backend at ${apiBaseUrl}. Check that the backend is running.`,
      };
    }

    if (response.status === 401) {
      const refreshed = await refreshSession(session);
      if (!refreshed.ok) {
        return {
          ok: false,
          ...(refreshed.sessionExpired ? { sessionExpired: true } : {}),
          error: refreshed.error || "Unable to refresh your session.",
        };
      }
      const latestSession = getStoredSession();
      try {
        response = await fetch(`${apiBaseUrl}${path}`, {
          method,
          headers: {
            ...headers,
            Authorization: `Bearer ${latestSession.accessToken}`,
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
      } catch {
        return {
          ok: false,
          error: `Could not connect to the backend at ${apiBaseUrl}.`,
        };
      }
    }

    if (!response.ok) {
      let detail = `The backend returned an error (HTTP ${response.status}).`;
      try {
        const result = await response.json();
        if (typeof result.detail === "string") {
          detail = result.detail;
        } else if (Array.isArray(result.detail)) {
          detail = result.detail
            .map((item) => (item && typeof item.msg === "string" ? item.msg : String(item)))
            .filter(Boolean)
            .join(" ");
        }
      } catch {
        // use fallback message
      }
      if (response.status === 401) {
        setStoredSession(null);
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
  };

  window.desktop = {
    getAppVersion: async () => "1.0.0 (Web)",

    getBackendStatus: async () => {
      const apiBaseUrl = getBackendApiUrl();
      try {
        const response = await fetch(`${apiBaseUrl}/`);
        if (!response.ok) {
          return { ok: false, error: `Backend health check failed (HTTP ${response.status}).` };
        }
        const result = await response.json();
        return {
          ok: true,
          message: typeof result.message === "string" ? result.message : "Backend is connected.",
        };
      } catch {
        return { ok: false, error: `Could not connect to the backend at ${apiBaseUrl}.` };
      }
    },

    getSession: async () => {
      const session = getStoredSession();
      if (!session) return null;
      const refreshed = await refreshSession(session);
      if (refreshed.ok) return refreshed.user;
      if (refreshed.sessionExpired) return null;
      return session.user || null;
    },

    login: async (credentials) => {
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
        return { ok: false, error: `The backend returned an invalid response (HTTP ${response.status}).` };
      }

      if (!response.ok) {
        const detail = typeof result?.detail === "string" ? result.detail : "Unable to sign in. Check your details and try again.";
        return { ok: false, error: detail };
      }

      if (!result?.access_token || !result?.refresh_token || !result?.user) {
        return { ok: false, error: "The backend returned an incomplete login response." };
      }

      const session = {
        accessToken: result.access_token,
        refreshToken: result.refresh_token,
        expiresIn: result.expires_in,
        user: result.user,
      };
      setStoredSession(session);
      return { ok: true, user: session.user };
    },

    logout: async () => {
      setStoredSession(null);
    },

    listWorkspaceSection: async (section) => {
      const cfg = workspaceSections[section];
      if (!cfg) return { ok: false, error: "Section not found." };
      return requestWorkspaceApi(cfg.listPath, "GET");
    },

    createWorkspaceRecord: async (section, record) => {
      const cfg = workspaceSections[section];
      if (!cfg) return { ok: false, error: "Section not found." };
      return requestWorkspaceApi(cfg.createPath, "POST", record);
    },

    mutateWorkspaceRecord: async (operation, section, recordId, record, recordIds) => {
      const cfg = workspaceSections[section];
      if (!cfg) return { ok: false, error: "Section not found." };

      if (operation === "delete") {
        const ids = (Array.isArray(recordIds) && recordIds.length > 0 ? recordIds : [recordId]).map(Number);
        if (section === "dailyInputs" && ids.length > 1) {
          return requestWorkspaceApi("/daily-inputs/", "DELETE", { ids });
        }
        for (const id of ids) {
          const res = await requestWorkspaceApi(cfg.deletePath(id), "DELETE");
          if (!res.ok) return res;
        }
        return { ok: true, data: { deleted_count: ids.length, deleted_ids: ids } };
      }

      if (operation === "update") {
        return requestWorkspaceApi(cfg.updatePath(recordId), "PATCH", record);
      }

      return { ok: false, error: "Unsupported operation." };
    },

    exportWorkspaceCsv: async (section, columnLabels, rows) => {
      try {
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
        const csv = [columnLabels, ...rows].map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
        const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${section}-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return { ok: true, count: rows.length };
      } catch (err) {
        return { ok: false, error: err.message || "Failed to export CSV." };
      }
    },

    exportWorkspacePdf: async (section, htmlContent, title) => {
      try {
        const printWindow = window.open("", "_blank");
        if (!printWindow) return { ok: false, error: "Popup blocked. Allow popups to print." };
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 300);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err.message || "Failed to open print preview." };
      }
    },

    openPrintPreview: async (htmlContent, title) => {
      try {
        const printWindow = window.open("", "_blank");
        if (!printWindow) return { ok: false, error: "Popup blocked. Allow popups to print preview." };
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.focus();
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err.message || "Failed to open print preview." };
      }
    },
  };
}
