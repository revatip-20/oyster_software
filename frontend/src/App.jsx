import { useCallback, useEffect, useMemo, useState } from "react";
import { navigation, sections } from "./workspace.js";

function App() {
  const [user, setUser] = useState(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isCurrent = true;

    window.desktop
      .getSession()
      .then((sessionUser) => {
        if (isCurrent) setUser(sessionUser);
      })
      .catch(() => {
        if (isCurrent) {
          setError(
            "The desktop API bridge needs to be reloaded. Close and restart the app, then sign in again.",
          );
        }
      })
      .finally(() => {
        if (isCurrent) setIsCheckingSession(false);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = await window.desktop.login({ email, password });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setUser(result.user);
      setPassword("");
    } catch {
      setError("Unable to sign in. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  const handleLogout = useCallback(async () => {
    await window.desktop.logout();
    setUser(null);
    setPassword("");
    setError("");
  }, []);

  if (isCheckingSession) {
    return (
      <main className="session-loading">
        <div className="brand-mark" aria-hidden="true">D</div>
        <p>Restoring your workspace…</p>
      </main>
    );
  }

  if (user) {
    return <Workspace user={user} onLogout={handleLogout} />;
  }

  return (
    <main className="app-shell">
      <section aria-labelledby="login-heading" className="login-card">
        <div className="brand-mark" aria-hidden="true">D</div>
        <span className="eyebrow">DESKTOP WORKSPACE</span>
        <h1 id="login-heading">Welcome back</h1>
        <p className="login-description">Sign in to continue to your workspace.</p>

        <form className="login-form" onSubmit={handleSubmit}>
          <label htmlFor="email">Email address</label>
          <input
            autoComplete="username"
            autoFocus
            id="email"
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
            type="email"
            value={email}
          />

          <label htmlFor="password">Password</label>
          <input
            autoComplete="current-password"
            id="password"
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            required
            type="password"
            value={password}
          />

          {error && (
            <p aria-live="polite" className="login-error" role="alert">
              {error}
            </p>
          )}

          <button className="login-button" disabled={isLoading} type="submit">
            {isLoading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}

function Workspace({ user, onLogout }) {
  const availableNavigation = useMemo(
    () => navigation.filter((item) => {
      if (item.adminOnly && user.role !== "admin") return false;
      return !item.roles || item.roles.includes(user.role);
    }),
    [user.role],
  );
  const [activeSection, setActiveSection] = useState("dashboard");
  const [requestVersion, setRequestVersion] = useState(0);
  const [records, setRecords] = useState([]);
  const [lookupOptions, setLookupOptions] = useState({
    suppliers: [],
    rawMaterials: [],
  });
  const [lookupLoading, setLookupLoading] = useState({
    suppliers: false,
    rawMaterials: false,
  });
  const [lookupErrors, setLookupErrors] = useState({});
  const [lookupRequestVersion, setLookupRequestVersion] = useState(0);
  const [dashboardCounts, setDashboardCounts] = useState({});
  const [backendStatus, setBackendStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [pageError, setPageError] = useState("");
  const [notice, setNotice] = useState("");

  function navigateToSection(section) {
    setActiveSection(section);
    setRequestVersion((version) => version + 1);
    setIsFormOpen(false);
    setEditingRecord(null);
  }

  useEffect(() => {
    let isCurrent = true;

    async function loadDashboard() {
      setIsLoading(true);
      setPageError("");
      setNotice("");
      try {
        const accessibleSections = Object.keys(sections).filter(
          (section) => section !== "supervisors" || user.role === "admin",
        );
        const [statusResult, ...results] = await Promise.all([
          window.desktop.getBackendStatus(),
          ...accessibleSections.map((section) =>
            window.desktop.listWorkspaceSection(section),
          ),
        ]);

        if (!isCurrent) return;
        setBackendStatus(statusResult);
        const failures = results.filter((result) => !result.ok);
        if (failures.length > 0) {
          setPageError(failures[0].error);
          if (failures.some((result) => result.sessionExpired)) onLogout();
        } else if (results.some((result) => !Array.isArray(result.data))) {
          setPageError("The backend returned an invalid records list.");
        } else {
          setDashboardCounts(
            Object.fromEntries(
              accessibleSections.map((section, index) => [
                section,
                results[index].data.length,
              ]),
            ),
          );
        }
      } catch {
        if (isCurrent) {
          setPageError(
            "Unable to reach the desktop API bridge. Close and restart the app, then retry.",
          );
        }
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    }

    async function loadSection() {
      setIsLoading(true);
      setPageError("");
      setNotice("");
      setRecords([]);
      try {
        const result = await window.desktop.listWorkspaceSection(activeSection);
        if (!isCurrent) return;
        if (result.ok && Array.isArray(result.data)) {
          setRecords(result.data);
        } else {
          setPageError(
            result.ok
              ? "The backend returned an invalid records list."
              : result.error,
          );
          if (result.sessionExpired) onLogout();
        }
      } catch {
        if (isCurrent) {
          setPageError(
            "Unable to reach the desktop API bridge. Close and restart the app, then retry.",
          );
        }
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    }

    if (activeSection === "dashboard") loadDashboard();
    else loadSection();

    return () => {
      isCurrent = false;
    };
  }, [activeSection, onLogout, requestVersion, user.role]);

  useEffect(() => {
    const lookups = activeSection === "rawMaterials"
      ? ["suppliers"]
      : activeSection === "elements"
        ? ["suppliers", "rawMaterials"]
        : [];
    if (lookups.length === 0) return undefined;
    let isCurrent = true;
    setLookupLoading((current) => ({
      ...current,
      ...Object.fromEntries(lookups.map((lookup) => [lookup, true])),
    }));
    setLookupErrors((current) => {
      const next = { ...current };
      for (const lookup of lookups) delete next[lookup];
      return next;
    });

    async function loadLookups() {
      try {
        const results = await Promise.all(
          lookups.map((lookup) =>
            window.desktop.listWorkspaceSection(lookup),
          ),
        );
        if (!isCurrent) return;
        const nextOptions = {};
        const nextErrors = {};
        results.forEach((result, index) => {
          const lookup = lookups[index];
          if (result.ok && Array.isArray(result.data)) {
            nextOptions[lookup] = result.data;
          } else {
            nextOptions[lookup] = [];
            nextErrors[lookup] = result.ok
              ? `The backend returned an invalid ${sections[lookup].label.toLowerCase()} list.`
              : result.error;
            if (result.sessionExpired) onLogout();
          }
        });
        setLookupOptions((current) => ({ ...current, ...nextOptions }));
        setLookupErrors((current) => ({ ...current, ...nextErrors }));
      } catch {
        if (isCurrent) {
          setLookupOptions((current) => ({
            ...current,
            ...Object.fromEntries(lookups.map((lookup) => [lookup, []])),
          }));
          setLookupErrors((current) => ({
            ...current,
            ...Object.fromEntries(
              lookups.map((lookup) => [lookup, `Unable to load ${sections[lookup].label.toLowerCase()}.`]),
            ),
          }));
        }
      } finally {
        if (isCurrent) {
          setLookupLoading((current) => ({
            ...current,
            ...Object.fromEntries(lookups.map((lookup) => [lookup, false])),
          }));
        }
      }
    }

    loadLookups();

    return () => {
      isCurrent = false;
    };
  }, [activeSection, lookupRequestVersion, onLogout]);

  async function handleSave(event) {
    event.preventDefault();
    setPageError("");
    setNotice("");
    setIsSaving(true);

    const formData = new FormData(event.currentTarget);
    const record = Object.fromEntries(formData.entries());
    for (const [key, value] of Object.entries(record)) {
      if (value === "") {
        if (editingRecord) {
          record[key] = null;
        } else {
          delete record[key];
        }
      } else if (["quantity", "supplier_id", "raw_material_id"].includes(key)) {
        record[key] = Number(value);
      }
    }

    try {
      if (editingRecord) {
        if (activeSection === "supervisors" && record.password === "") {
          delete record.password;
        }
        for (const [key, value] of Object.entries(record)) {
          const originalValue = editingRecord[key] ?? null;
          if (value === originalValue || (value === "" && originalValue === null)) {
            delete record[key];
          }
        }
        if (Object.keys(record).length === 0) {
          setNotice("No changes to save.");
          setIsFormOpen(false);
          setEditingRecord(null);
          return;
        }
      }

      const result = editingRecord
        ? await window.desktop.mutateWorkspaceRecord(
            "update",
            activeSection,
            editingRecord.id,
            record,
          )
        : await window.desktop.createWorkspaceRecord(activeSection, record);
      if (!result.ok) {
        setPageError(result.error);
        if (result.sessionExpired) onLogout();
        return;
      }
      setRecords((currentRecords) => editingRecord
        ? currentRecords.map((item) => item.id === editingRecord.id ? result.data : item)
        : [...currentRecords, result.data]);
      setNotice(
        `${sections[activeSection].singular} ${editingRecord ? "updated" : "added"} successfully.`,
      );
      setIsFormOpen(false);
      setEditingRecord(null);
    } catch {
      setPageError("Unable to save this record. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(record) {
    const label = record.company_name
      || record.material_name
      || record.element_name
      || `${record.first_name} ${record.last_name}`;
    if (!window.confirm(`Remove ${label} from the active workspace?`)) return;

    setPageError("");
    setNotice("");
    try {
      const result = await window.desktop.mutateWorkspaceRecord(
        "delete",
        activeSection,
        record.id,
      );
      if (!result.ok) {
        setPageError(result.error);
        if (result.sessionExpired) onLogout();
        return;
      }
      setRecords((currentRecords) =>
        currentRecords.filter((item) => item.id !== record.id),
      );
      setNotice(`${sections[activeSection].singular} removed successfully.`);
    } catch {
      setPageError("Unable to delete this record. Please try again.");
    }
  }

  const activeNavigation = availableNavigation.find(
    (item) => item.id === activeSection,
  );
  const activeConfig = sections[activeSection];
  const activeLookups = activeSection === "rawMaterials"
    ? ["suppliers"]
    : activeSection === "elements"
      ? ["suppliers", "rawMaterials"]
      : [];
  const isLookupLoading = activeLookups.some((lookup) => lookupLoading[lookup]);
  const activeLookupError = activeLookups
    .map((lookup) => lookupErrors[lookup])
    .find(Boolean);

  return (
    <main className="workspace-shell">
      <aside aria-label="Main navigation" className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark sidebar-mark" aria-hidden="true">D</div>
          <div>
            <strong>Workspace</strong>
            <span>Desktop app</span>
          </div>
        </div>

        <span className="sidebar-caption">MENU</span>
        <nav className="sidebar-nav">
          {availableNavigation.map((item) => (
            <button
              aria-current={activeSection === item.id ? "page" : undefined}
              className={`nav-item${activeSection === item.id ? " active" : ""}`}
              key={item.id}
              onClick={() => {
                navigateToSection(item.id);
              }}
              type="button"
            >
              <span aria-hidden="true" className="nav-marker">{item.marker}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-account">
          <div className="account-avatar">
            {user.first_name?.slice(0, 1).toUpperCase()}
          </div>
          <div className="account-details">
            <strong>{user.first_name} {user.last_name}</strong>
            <span>{user.role}</span>
          </div>
          <button
            aria-label="Sign out"
            className="logout-button"
            onClick={onLogout}
            title="Sign out"
            type="button"
          >
            ↪
          </button>
        </div>
      </aside>

      <section className="workspace-main">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <span aria-hidden="true">/</span>
            <strong>{activeNavigation?.label}</strong>
          </div>
          <span className="topbar-user">{user.first_name} {user.last_name}</span>
        </header>

        <div className="page-content">
          {activeSection === "attendance" ? (
            <section aria-labelledby="page-title" className="section-page">
              <div className="page-heading">
                <div>
                  <span className="eyebrow">WORKSPACE</span>
                  <h1 id="page-title">Attendance</h1>
                  <p>Attendance tracking for your team.</p>
                </div>
              </div>
              <div className="table-card">
                <p className="empty-state">
                  Attendance APIs are not available in the backend yet.
                </p>
              </div>
            </section>
          ) : activeSection === "dashboard" ? (
            <Dashboard
              backendStatus={backendStatus}
              counts={dashboardCounts}
              isLoading={isLoading}
              onNavigate={navigateToSection}
              pageError={pageError}
              sections={availableNavigation}
              user={user}
            />
          ) : (
            <section aria-labelledby="page-title" className="section-page">
              <div className="page-heading">
                <div>
                  <span className="eyebrow">WORKSPACE</span>
                  <h1 id="page-title">{activeConfig.label}</h1>
                  <p>{activeConfig.description}</p>
                </div>
                <button
                  className="primary-action"
                  onClick={() => {
                    setPageError("");
                    setNotice("");
                    setEditingRecord(null);
                    setIsFormOpen((open) => !open);
                  }}
                  type="button"
                >
                  {isFormOpen ? "Cancel" : `+ Add ${activeConfig.singular}`}
                </button>
              </div>

              {pageError && <p className="workspace-error" role="alert">{pageError}</p>}
              {notice && <p className="workspace-notice" role="status">{notice}</p>}

              {isFormOpen && (
                <form
                  className="record-form"
                  key={`${activeSection}-${editingRecord?.id ?? "new"}`}
                  onSubmit={handleSave}
                >
                  <div className="record-form-heading">
                    <h2>
                      {editingRecord ? "Edit" : "New"}{" "}
                      {activeConfig.singular.toLowerCase()}
                    </h2>
                    <p>
                      {editingRecord
                        ? "Update the fields below and save your changes."
                        : "Enter the details below to add a record."}
                    </p>
                  </div>
                  <div className="form-fields">
                    {(editingRecord
                      ? activeConfig.updateFields
                      : activeConfig.fields
                    ).map((field) => {
                      const lookupKey = field.type === "supplier"
                        ? "suppliers"
                        : field.type === "rawMaterial"
                          ? "rawMaterials"
                          : null;
                      const lookupRecords = lookupKey
                        ? lookupOptions[lookupKey]
                        : [];
                      const lookupError = lookupKey
                        ? lookupErrors[lookupKey]
                        : "";
                      const isLookupBusy = lookupKey
                        ? lookupLoading[lookupKey]
                        : false;
                      const optionName = field.type === "supplier"
                        ? "company_name"
                        : "material_name";

                      return (
                        <label
                          className={field.wide ? "field-wide" : ""}
                          htmlFor={`record-${field.name}`}
                          key={field.name}
                        >
                          {field.label}{field.required ? " *" : ""}
                          {lookupKey ? (
                            <>
                              <select
                                defaultValue={editingRecord?.[field.name] ?? ""}
                                disabled={isLookupBusy || Boolean(lookupError)}
                                id={`record-${field.name}`}
                                name={field.name}
                              >
                                <option value="">
                                  {isLookupBusy
                                    ? `Loading ${sections[lookupKey].label.toLowerCase()}…`
                                    : lookupRecords.length === 0
                                      ? `No ${sections[lookupKey].label.toLowerCase()} available`
                                      : `No ${field.label.toLowerCase()}`}
                                </option>
                                {lookupRecords.map((lookupRecord) => (
                                  <option key={lookupRecord.id} value={lookupRecord.id}>
                                    {lookupRecord[optionName]}
                                  </option>
                                ))}
                              </select>
                              {lookupError && (
                                <span className="field-error" role="alert">
                                  {lookupError}{" "}
                                  <button
                                    className="inline-retry"
                                    onClick={() => setLookupRequestVersion((version) => version + 1)}
                                    type="button"
                                  >
                                    Retry
                                  </button>
                                </span>
                              )}
                            </>
                          ) : field.wide ? (
                            <textarea
                              id={`record-${field.name}`}
                              name={field.name}
                              defaultValue={editingRecord?.[field.name] ?? ""}
                              required={field.required}
                              rows="3"
                            />
                          ) : (
                            <input
                              defaultValue={editingRecord
                                ? field.name === "password"
                                  ? ""
                                  : editingRecord[field.name] ?? ""
                                : field.defaultValue}
                              id={`record-${field.name}`}
                              minLength={field.minLength}
                              min={field.min}
                              name={field.name}
                              required={field.required}
                              type={field.type || "text"}
                            />
                          )}
                        </label>
                      );
                    })}
                  </div>
                  <div className="form-actions">
                    <button
                      className="secondary-action"
                      onClick={() => {
                        setIsFormOpen(false);
                        setEditingRecord(null);
                      }}
                      type="button"
                    >
                      Cancel
                    </button>
                    <button
                      className="primary-action"
                      disabled={isSaving || isLookupLoading || Boolean(activeLookupError)}
                      type="submit"
                    >
                      {isSaving ? "Saving…" : "Save"}
                    </button>
                  </div>
                </form>
              )}

              <div className="table-card">
                <div className="table-toolbar">
                  <div>
                    <h2>{activeConfig.label}</h2>
                    <span>{records.length} {records.length === 1 ? "record" : "records"}</span>
                  </div>
                  <div className="table-toolbar-actions">
                    {isLoading && <span className="loading-indicator">Loading…</span>}
                    <button
                      className="refresh-button"
                      disabled={isLoading}
                      onClick={() => setRequestVersion((version) => version + 1)}
                      type="button"
                    >
                      Refresh
                    </button>
                  </div>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        {activeConfig.columns.map(([, label]) => (
                          <th key={label}>{label}</th>
                        ))}
                        <th className="actions-heading">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!isLoading && records.map((record, index) => (
                        <tr key={record.id ?? index}>
                          {activeConfig.columns.map(([key]) => (
                            <td key={key}>
                              {key === "supplier_id" && record[key]
                                ? lookupOptions.suppliers.find(
                                    (supplier) => supplier.id === record[key],
                                  )?.company_name ?? `Supplier #${record[key]}`
                                : activeSection === "elements"
                                  && key === "raw_material_id"
                                  && record[key]
                                    ? lookupOptions.rawMaterials.find(
                                        (material) => material.id === record[key],
                                      )?.material_name ?? `Material #${record[key]}`
                                    : formatCell(record[key])}
                            </td>
                          ))}
                          <td className="row-actions">
                            <button
                              className="table-action"
                              onClick={() => {
                                setPageError("");
                                setNotice("");
                                setEditingRecord(record);
                                setIsFormOpen(true);
                              }}
                              type="button"
                            >
                              Edit
                            </button>
                            <button
                              className="table-action delete-action"
                              onClick={() => handleDelete(record)}
                              type="button"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                      {!isLoading && records.length === 0 && (
                        <tr>
                          <td className="empty-state" colSpan={activeConfig.columns.length + 1}>
                            No records yet.
                          </td>
                        </tr>
                      )}
                      {isLoading && (
                        <tr>
                          <td className="empty-state" colSpan={activeConfig.columns.length + 1}>
                            Loading records…
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}
        </div>
      </section>
    </main>
  );
}

function Dashboard({
  backendStatus,
  counts,
  isLoading,
  onNavigate,
  pageError,
  sections,
  user,
}) {
  const countCards = sections
    .filter((section) => section.id !== "dashboard" && sections[section.id])
    .map((section) => ({
      ...section,
      count: counts[section.id] ?? 0,
    }));

  return (
    <section aria-labelledby="page-title" className="section-page">
      <div className="page-heading dashboard-heading">
        <div>
          <span className="eyebrow">OVERVIEW</span>
          <h1 id="page-title">Good day, {user.first_name}</h1>
          <p>Here’s what’s happening in your workspace.</p>
        </div>
        <span className="role-badge">{user.role}</span>
      </div>

      {pageError && <p className="workspace-error" role="alert">{pageError}</p>}
      <p
        className={`backend-status${backendStatus?.ok ? " connected" : " disconnected"}`}
        role="status"
      >
        <span aria-hidden="true" className="backend-status-dot" />
        {backendStatus?.ok
          ? backendStatus.message
          : backendStatus?.error ?? "Checking backend…"}
      </p>

      <div className="summary-grid">
        {countCards.map((card) => (
          <button
            className="summary-card"
            key={card.id}
            onClick={() => onNavigate(card.id)}
            type="button"
          >
            <span className="summary-icon">{card.marker}</span>
            <span className="summary-label">{card.label}</span>
            <strong className="summary-count">
              {isLoading ? "…" : counts[card.id] ?? 0}
            </strong>
            <span className="summary-link">View records <span aria-hidden="true">→</span></span>
          </button>
        ))}
      </div>

      <div className="dashboard-note">
        <span className="note-icon" aria-hidden="true">i</span>
        <div>
          <strong>Signed in as {user.role}</strong>
          <p>
            Your workspace sections are available according to your account
            permissions.
          </p>
        </div>
      </div>
    </section>
  );
}

function formatCell(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default App;
