import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const [selectedIds, setSelectedIds] = useState([]);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [invoiceName, setInvoiceName] = useState("");
  const [invoiceSelectedIds, setInvoiceSelectedIds] = useState([]);
  const [invoiceModalDailyInputs, setInvoiceModalDailyInputs] = useState([]);
  const [isLoadingInvoiceModalInputs, setIsLoadingInvoiceModalInputs] = useState(false);
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [csvSearchTerm, setCsvSearchTerm] = useState("");
  const [csvSelectedIds, setCsvSelectedIds] = useState([]);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const toggleRowSelection = (id) => {
  setSelectedIds((prev) => {
    const normalizedId = String(id);

    return prev.some((selectedId) => String(selectedId) === normalizedId)
      ? prev.filter((selectedId) => String(selectedId) !== normalizedId)
      : [...prev, id];
  });
};

const toggleSelectAll = (rows) => {
  const visibleIds = rows.map((record) => record.id);

  const allSelected =
    visibleIds.length > 0 &&
    visibleIds.every((id) =>
      selectedIds.some((selectedId) => String(selectedId) === String(id))
    );

  setSelectedIds((prev) =>
    allSelected
      ? prev.filter(
          (selectedId) =>
            !visibleIds.some((id) => String(id) === String(selectedId))
        )
      : [
          ...prev,
          ...visibleIds.filter(
            (id) =>
              !prev.some((selectedId) => String(selectedId) === String(id))
          ),
        ]
  );
};

  const [lookupOptions, setLookupOptions] = useState({
    suppliers: [],
    customers: [],
    rawMaterials: [],
    elements: [],
  });
  
  const [lookupLoading, setLookupLoading] = useState({
    suppliers: false,
    customers: false,
    rawMaterials: false,
    elements: false,
  });
  const [lookupErrors, setLookupErrors] = useState({});
  const [lookupRequestVersion, setLookupRequestVersion] = useState(0);
  const [dashboardCounts, setDashboardCounts] = useState({});
  const [backendStatus, setBackendStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [formType, setFormType] = useState("raw_material");
  const [formValues, setFormValues] = useState({});
  const [pageError, setPageError] = useState("");
  const [notice, setNotice] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState([]);
  const [filterField, setFilterField] = useState("");
  const [filterValue, setFilterValue] = useState("");
  const formRef = useRef(null);

function populateRawMaterialFields(record) {
  const rawMaterial = lookupOptions.rawMaterials?.find(
    (material) =>
      String(material.id) === String(record.raw_material_id)
  );

  if (!rawMaterial) {
    return record;
  }

  return {
    ...record,
    item: rawMaterial.material_name,
    unit: rawMaterial.unit ?? "",
    rate: rawMaterial.rate ?? 0,
    cgst_percent: rawMaterial.cgst_percent ?? 0,
    ut_sgst_percent: rawMaterial.ut_sgst_percent ?? 0,
    igst_percent: rawMaterial.igst_percent ?? 0,
  };
}

function handleFormFieldChange(name, value) {
  setFormValues((current) => {
    const next = { ...current, [name]: value };

    if (name === "type") {
      setFormType(value);

      if (value === "raw_material") {
        next.element_id = "";
        next.customer_id = "";
      } else if (value === "element") {
        next.raw_material_id = "";
      } else if (!value) {
        next.raw_material_id = "";
        next.element_id = "";
        next.supplier_id = "";
        next.customer_id = "";
      }
    }

    // Calculate Amount = Quantity × Rate
    if (
      ["quantity", "rate", "raw_material_id"].includes(name)
    ) {
      const quantity = Number(next.quantity) || 0;
      const rate = Number(next.rate) || 0;

      next.amount = Number((quantity * rate).toFixed(2));
    }

    // Calculate GST amounts
    if (
      [
        "quantity",
        "rate",
        "amount",
        "cgst_percent",
        "ut_sgst_percent",
        "igst_percent",
        "raw_material_id",
      ].includes(name)
    ) {
      const amount = Number(next.amount) || 0;
      const cgstPercent = Number(next.cgst_percent) || 0;
      const sgstPercent = Number(next.ut_sgst_percent) || 0;
      const igstPercent = Number(next.igst_percent) || 0;

      next.cgst_amount = Number(
        ((amount * cgstPercent) / 100).toFixed(2)
      );

      next.ut_sgst_amount = Number(
        ((amount * sgstPercent) / 100).toFixed(2)
      );

      next.igst_amount = Number(
        ((amount * igstPercent) / 100).toFixed(2)
      );

      next.total_amount = Number(
        (
          amount +
          next.cgst_amount +
          next.ut_sgst_amount +
          next.igst_amount
        ).toFixed(2)
      );
    }

    return next;
  });
}


  function handleClearForm() {
    const currentFields = (editingRecord ? activeConfig.updateFields : activeConfig.fields) || [];
    const emptyValues = {};
    for (const field of currentFields) {
      emptyValues[field.name] = "";
    }
    setFormValues(emptyValues);
    setFormType("");
    setPageError("");
    setNotice("");
  }

  function navigateToSection(section) {
    setActiveSection(section);
    setRequestVersion((version) => version + 1);
    setIsFormOpen(false);
    setEditingRecord(null);
    setFormValues({});
    setFormType("raw_material");
    setSearchTerm("");
    setFilters([]);
    setFilterField("");
    setFilterValue("");
    setSelectedIds([]);
    setIsInvoiceModalOpen(false);
    setInvoiceName("");
    setInvoiceSelectedIds([]);
    setInvoiceModalDailyInputs([]);
    setIsCsvModalOpen(false);
    setCsvSearchTerm("");
    setCsvSelectedIds([]);
  }

  function sortDailyInputsNewestFirst(list) {
    return [...list].sort((a, b) => Number(b.id) - Number(a.id));
  }

  async function openInvoiceModal() {
    setPageError("");
    setNotice("");
    setInvoiceName("");
    setInvoiceSelectedIds(
      activeSection === "dailyInputs" ? [...selectedIds] : [],
    );
    setIsInvoiceModalOpen(true);

    if (activeSection === "dailyInputs") {
      setInvoiceModalDailyInputs(sortDailyInputsNewestFirst(records));
      return;
    }

    setIsLoadingInvoiceModalInputs(true);
    try {
      const result = await window.desktop.listWorkspaceSection("dailyInputs");
      if (result.ok && Array.isArray(result.data)) {
        setInvoiceModalDailyInputs(sortDailyInputsNewestFirst(result.data));
      } else {
        setInvoiceModalDailyInputs([]);
        setPageError(
          result.ok
            ? "The backend returned an invalid Daily Inputs list."
            : result.error,
        );
        if (result.sessionExpired) onLogout();
      }
    } catch {
      setInvoiceModalDailyInputs([]);
      setPageError(
        "Unable to load Daily Inputs. Close and restart the app, then retry.",
      );
    } finally {
      setIsLoadingInvoiceModalInputs(false);
    }
  }

  function toggleInvoiceSelection(id) {
    setInvoiceSelectedIds((prev) => {
      const normalizedId = String(id);
      return prev.some((selectedId) => String(selectedId) === normalizedId)
        ? prev.filter((selectedId) => String(selectedId) !== normalizedId)
        : [...prev, id];
    });
  }

  async function handleGenerateInvoice(event) {
    event.preventDefault();
    const name = invoiceName.trim();
    if (!name) {
      setPageError("Enter a name for the invoice.");
      return;
    }
    if (invoiceSelectedIds.length === 0) {
      setPageError("Select at least one Daily Input for the invoice.");
      return;
    }

    setIsGeneratingInvoice(true);
    setPageError("");
    setNotice("");
    try {
      const result = await window.desktop.generateInvoice({
        name,
        daily_input_ids: invoiceSelectedIds.map(Number),
      });
      if (!result.ok) {
        setPageError(result.error || "Unable to generate the invoice.");
        if (result.sessionExpired) onLogout();
        return;
      }

      setIsInvoiceModalOpen(false);
      setInvoiceName("");
      setInvoiceSelectedIds([]);
      setNotice(
        `Invoice "${result.data?.name || name}" generated successfully.`,
      );
      if (activeSection === "invoices") {
        setRequestVersion((version) => version + 1);
      }

      if (result.data?.id) {
        const download = await window.desktop.downloadInvoicePdf(result.data.id);
        if (!download.ok) {
          setPageError(download.error || "Invoice saved, but PDF download failed.");
          if (download.sessionExpired) onLogout();
        } else if (!download.canceled && download.filePath) {
          setNotice(
            `Invoice "${result.data?.name || name}" generated and saved to ${download.filePath}.`,
          );
        }
      }
    } catch {
      setPageError(
        "Unable to reach the desktop API bridge. Close and restart the app, then retry.",
      );
    } finally {
      setIsGeneratingInvoice(false);
    }
  }

  async function handleDownloadInvoicePdf(invoiceId) {
    setPageError("");
    setNotice("");
    try {
      const result = await window.desktop.downloadInvoicePdf(invoiceId);
      if (!result.ok) {
        setPageError(result.error || "Unable to download the invoice PDF.");
        if (result.sessionExpired) onLogout();
        return;
      }
      if (!result.canceled && result.filePath) {
        setNotice(`Invoice PDF saved to ${result.filePath}.`);
      }
    } catch {
      setPageError(
        "Unable to reach the desktop API bridge. Close and restart the app, then retry.",
      );
    }
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
    const lookups = activeSection === "dailyInputs"
      ? ["customers", "suppliers", "rawMaterials", "elements"]
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
  
async function submitForm(isAddMore = false) {
  setPageError("");
  setNotice("");

  if (formRef.current && !formRef.current.reportValidity()) {
    return;
  }

  setIsSaving(true);

  try {
    const record = {};

    // --------------------------------------------------
    // 1. Build the record from form values
    // --------------------------------------------------
    const numericFields = [
      "quantity",
      "supplier_id",
      "customer_id",
      "raw_material_id",
      "element_id",
      "user_id",
      "amount",
      "cgst_amount",
      "ut_sgst_amount",
      "igst_amount",
      "total_amount",
    ];

    for (const [key, value] of Object.entries(formValues)) {
      if (value === "" || value === null || value === undefined) {
        // For updates, do not automatically send null for every
        // empty field. The backend rejects null for many fields.
        continue;
      }

      if (numericFields.includes(key)) {
        const numberValue = Number(value);

        if (!Number.isFinite(numberValue)) {
          setPageError(`Please enter a valid number for ${key}.`);
          return;
        }

        record[key] = numberValue;
      } else {
        record[key] = value;
      }
    }

    // --------------------------------------------------
    // 2. Prepare Daily Inputs payload
    // --------------------------------------------------
    if (activeSection === "dailyInputs") {
      // Only send fields supported by DailyInputCreate/Update.
      // "unit" and rate/GST percentage fields belong to the
      // frontend/raw-material master, not the DailyInput API.
      const allowedFields = [
        "DC_no",
        "dc_no",
        "DC_date",
        "dc_date",
        "bill_no",
        "bill_date",
        "item",
        "quantity",
        "type",
        "customer_id",
        "supplier_id",
        "raw_material_id",
        "element_id",
        "user_id",
        "amount",
        "cgst_amount",
        "ut_sgst_amount",
        "igst_amount",
        "total_amount",
      ];

      for (const key of Object.keys(record)) {
        if (!allowedFields.includes(key)) {
          delete record[key];
        }
      }

      // Normalize field names for the API.
      if (record.DC_no !== undefined) {
        record.dc_no = record.DC_no;
        delete record.DC_no;
      }

      if (record.DC_date !== undefined) {
        record.dc_date = record.DC_date;
        delete record.DC_date;
      }

      // Assign the logged-in user when available.
      if (
        (record.user_id === undefined || record.user_id === null) &&
        user?.id
      ) {
        record.user_id = Number(user.id);
      }

      // Resolve the selected raw material or element name.
      if (record.type === "raw_material") {
        record.customer_id = null;
        record.element_id = null;

        const rawMaterial = lookupOptions.rawMaterials?.find(
          (material) =>
            String(material.id) === String(record.raw_material_id)
        );

        if (rawMaterial) {
          record.item = rawMaterial.material_name;
        }
      } else if (record.type === "element") {
        record.raw_material_id = null;

        const element = lookupOptions.elements?.find(
          (item) => String(item.id) === String(record.element_id)
        );

        if (element) {
          record.item = element.element_name;
        }
      }

      // On create, send zero for empty amount/GST fields.
      // On update, omit empty amount/GST fields so the backend
      // does not receive explicit null values.
      const amountFields = [
        "amount",
        "cgst_amount",
        "ut_sgst_amount",
        "igst_amount",
        "total_amount",
      ];

      for (const key of amountFields) {
        const originalValue = formValues[key];

        if (
          originalValue === "" ||
          originalValue === null ||
          originalValue === undefined
        ) {
          if (!editingRecord) {
            record[key] = 0;
          } else {
            delete record[key];
          }
        }
      }
    }

    // --------------------------------------------------
    // 3. Remove unchanged fields when editing
    // --------------------------------------------------
    if (editingRecord) {
      if (
        activeSection === "supervisors" &&
        record.password === ""
      ) {
        delete record.password;
      }

      for (const key of Object.keys(record)) {
        // Handle API naming differences between DC_no/DC_date
        // and dc_no/dc_date.
        let originalValue = editingRecord[key];

        if (key === "dc_no" && originalValue === undefined) {
          originalValue = editingRecord.DC_no;
        }

        if (key === "dc_date" && originalValue === undefined) {
          originalValue = editingRecord.DC_date;
        }

        if (originalValue === undefined) {
          originalValue = null;
        }

        const newValue = record[key];

        // Compare dates consistently when possible.
        const isDateField = [
          "dc_date",
          "bill_date",
        ].includes(key);

        const valuesMatch = isDateField
          ? String(newValue ?? "").slice(0, 10) ===
            String(originalValue ?? "").slice(0, 10)
          : String(newValue ?? "") === String(originalValue ?? "");

        if (valuesMatch) {
          delete record[key];
        }
      }

      if (Object.keys(record).length === 0) {
        setNotice("No changes to save.");
        setIsFormOpen(false);
        setEditingRecord(null);
        setFormValues({});
        return;
      }
    }

    // Log the final payload immediately before the API request.
    console.log("Final API request:", {
      section: activeSection,
      operation: editingRecord ? "update" : "create",
      id: editingRecord?.id,
      payload: record,
    });

    // --------------------------------------------------
    // 4. Save through the desktop API
    // --------------------------------------------------
    const result = editingRecord
      ? await window.desktop.mutateWorkspaceRecord(
          "update",
          activeSection,
          editingRecord.id,
          record
        )
      : await window.desktop.createWorkspaceRecord(
          activeSection,
          record
        );

    if (!result.ok) {
      console.error("API save failed:", result);

      setPageError(
        typeof result.error === "string"
          ? result.error
          : JSON.stringify(result.error || result)
      );

      if (result.sessionExpired) {
        onLogout();
      }

      return;
    }

    // --------------------------------------------------
    // 5. Update the UI
    // --------------------------------------------------
    setRecords((currentRecords) =>
      editingRecord
        ? currentRecords.map((item) =>
            item.id === editingRecord.id ? result.data : item
          )
        : [...currentRecords, result.data]
    );

    setDashboardCounts((current) => ({
      ...current,
      [activeSection]:
        (current[activeSection] || 0) +
        (editingRecord ? 0 : 1),
    }));

    if (isAddMore) {
      setNotice("Daily Input added successfully.");

      setFormValues((prev) => ({
        ...prev,
        DC_no: prev.DC_no ?? "",
        DC_date: prev.DC_date ?? "",
        bill_no: prev.bill_no ?? "",
        bill_date: prev.bill_date ?? "",
        quantity: prev.quantity ?? "",
        item: "",
        unit: "",
        type: "",
        customer_id: "",
        supplier_id: "",
        raw_material_id: "",
        element_id: "",
        amount: "",
        cgst_amount: "",
        ut_sgst_amount: "",
        igst_amount: "",
        total_amount: "",
      }));

      setFormType("");
    } else {
      setNotice(
        `${sections[activeSection].singular} ${
          editingRecord ? "updated" : "added"
        } successfully.`
      );

      setIsFormOpen(false);
      setEditingRecord(null);
      setFormValues({});
    }
  } catch (error) {
    console.error("Failed to save record:", error);

    setPageError(
      error?.message ||
        "Unable to save this record. Check the console for details."
    );
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
        console.error("API save failed:", result);
        setPageError(
          typeof result.error === "string"
            ? result.error
            : JSON.stringify(result.error || result)
        );

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
  
async function handleDeleteSelected() {
  if (selectedIds.length === 0) return;

  const confirmed = window.confirm(
    `Remove ${selectedIds.length} selected record(s) from the active workspace?`
  );

  if (!confirmed) return;

  const idsToDelete = [...selectedIds];

  setPageError("");
  setNotice("");

  try {
    const result = await window.desktop.mutateWorkspaceRecord(
      "delete",
      activeSection,
      null,
      null,
      idsToDelete,
    );

    if (!result.ok) {
      setPageError(
        typeof result.error === "string"
          ? result.error
          : JSON.stringify(result.error || result)
      );

      if (result.sessionExpired) onLogout();
      return;
    }

    setRecords((currentRecords) =>
      currentRecords.filter(
        (item) =>
          !idsToDelete.some(
            (id) => String(id) === String(item.id)
          )
      )
    );

    setSelectedIds([]);
    setNotice(`${idsToDelete.length} record(s) removed successfully.`);
  } catch (error) {
    console.error("Bulk delete failed:", error);
    setPageError("Unable to delete selected records. Please try again.");
  }
}

  function openCsvModal() {
    setPageError("");
    setNotice("");
    setCsvSearchTerm("");
    setCsvSelectedIds(selectedIds.length > 0 ? [...selectedIds] : []);
    setIsCsvModalOpen(true);
  }

  function toggleCsvSelection(id) {
    setCsvSelectedIds((prev) => {
      const normalizedId = String(id);
      return prev.some((selectedId) => String(selectedId) === normalizedId)
        ? prev.filter((selectedId) => String(selectedId) !== normalizedId)
        : [...prev, id];
    });
  }

  function formatCsvCell(record, key) {
    const val = getRelatedCompanyName(key, record[key]) ?? record[key] ?? "";
    if (typeof val === "string" && key.toLowerCase().includes("date") && val.includes("T")) {
      return val.split("T")[0];
    }
    if (val === null || val === undefined || val === "") return "";
    if (typeof val === "object") return JSON.stringify(val);
    return String(val);
  }

  async function handleDownloadCsv(event) {
    event.preventDefault();
    const selectedRecords = records.filter((record) =>
      csvSelectedIds.some((selectedId) => String(selectedId) === String(record.id)),
    );
    if (selectedRecords.length === 0) {
      setPageError("Select at least one record to export.");
      return;
    }

    setIsExportingCsv(true);
    setPageError("");
    setNotice("");

    const columnLabels = activeConfig.columns.map(([, label]) => label);
    const rows = selectedRecords.map((record) =>
      activeConfig.columns.map(([key]) => formatCsvCell(record, key)),
    );

    try {
      const result = await window.desktop.exportWorkspaceCsv(
        activeSection,
        columnLabels,
        rows,
      );
      if (!result.ok) {
        setPageError(result.error);
        if (result.sessionExpired) onLogout();
        return;
      }
      if (!result.canceled) {
        const fileName = result.filePath.split(/[\\/]/).pop();
        setIsCsvModalOpen(false);
        setCsvSearchTerm("");
        setCsvSelectedIds([]);
        setNotice(`Exported ${result.count} records to ${fileName}.`);
      }
    } catch {
      setPageError("Unable to export this table. Please try again.");
    } finally {
      setIsExportingCsv(false);
    }
  }

  const activeNavigation = availableNavigation.find(
    (item) => item.id === activeSection,
  );
  const activeConfig = sections[activeSection];
  const activeColumns = activeConfig?.columns ?? [];
  const availableFilterColumns = activeColumns.filter(
    ([key]) => !filters.some((filter) => filter.field === key),
  );
  const selectedFilterField = filterField || availableFilterColumns[0]?.[0] || "";

  function getRelatedCompanyName(key, value) {
    if (key === "supplier_id" && value) {
      return lookupOptions.suppliers?.find((supplier) => supplier.id === value)?.company_name;
    }
    if (key === "customer_id" && value) {
      return lookupOptions.customers?.find((customer) => customer.id === value)?.company_name;
    }
    if (key === "raw_material_id" && value) {
      return lookupOptions.rawMaterials?.find((material) => material.id === value)?.material_name;
    }
    if (key === "element_id" && value) {
      return lookupOptions.elements?.find((element) => element.id === value)?.element_name;
    }
    if (key === "user_id" && value) {
      if (user && user.id === value) {
        return `${user.first_name} ${user.last_name}`.trim();
      }
      return `User #${value}`;
    }
    return undefined;
  }

  function getColumnSearchValues(record, key) {
    const values = [record[key], getRelatedCompanyName(key, record[key])];
    return values
      .filter((value) => value !== null && value !== undefined)
      .map((value) => String(value).toLocaleLowerCase());
  }

  const filteredRecords = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLocaleLowerCase();
    return records.filter((record) => {
      const matchesSearch = !normalizedSearch || [
        String(record.id ?? ""),
        ...activeColumns.flatMap(([key]) => getColumnSearchValues(record, key)),
      ].some((value) => String(value).toLocaleLowerCase().includes(normalizedSearch));

      return matchesSearch && filters.every((filter) =>
        getColumnSearchValues(record, filter.field)
          .some((value) => value.includes(filter.value.toLocaleLowerCase())),
      );
    });
  }, [activeColumns, filters, lookupOptions, records, searchTerm]);

  const csvFilteredRecords = useMemo(() => {
    const normalizedSearch = csvSearchTerm.trim().toLocaleLowerCase();
    if (!normalizedSearch) return records;
    return records.filter((record) => {
      const values = [
        String(record.id ?? ""),
        ...activeColumns.flatMap(([key]) => getColumnSearchValues(record, key)),
      ];
      return values.some((value) =>
        String(value).toLocaleLowerCase().includes(normalizedSearch),
      );
    });
  }, [activeColumns, csvSearchTerm, lookupOptions, records]);

  const activeLookups = activeSection === "dailyInputs"
    ? ["customers", "suppliers", "rawMaterials", "elements"]
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
          {activeSection === "dashboard" ? (
            <Dashboard
              backendStatus={backendStatus}
              counts={dashboardCounts}
              isLoading={isLoading}
              onNavigate={navigateToSection}
              pageError={pageError}
              onRefresh={() => setRequestVersion((version) => version + 1)}
              navigationItems={availableNavigation}
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
                <div className="page-heading-actions">
                  {(activeSection === "dailyInputs" || activeSection === "invoices") && (
                    <button
                      className="generate-invoice-button"
                      disabled={
                        isLoading
                        || (activeSection === "dailyInputs" && records.length === 0)
                      }
                      onClick={() => {
                        void openInvoiceModal();
                      }}
                      type="button"
                    >
                      Generate Invoice
                    </button>
                  )}
                  {!activeConfig.readOnly && (
                    <button
                      className="primary-action"
                      onClick={() => {
                        setPageError("");
                        setNotice("");
                        if (isFormOpen && !editingRecord) {
                          setIsFormOpen(false);
                          setEditingRecord(null);
                          setFormValues({});
                        } else {
                          setEditingRecord(null);
                          const initialType = activeSection === "dailyInputs" ? "raw_material" : "raw_material";
                          setFormType(initialType);
                          const initialValues = {};
                          const fields = sections[activeSection]?.fields || [];
                          for (const field of fields) {
                            initialValues[field.name] = field.defaultValue ?? "";
                          }
                          setFormValues(initialValues);
                          setIsFormOpen(true);
                        }
                      }}
                      type="button"
                    >
                      {isFormOpen && !editingRecord ? "Cancel" : `+ Add ${activeConfig.singular}`}
                    </button>
                  )}
                </div>
              </div>

              {pageError && <p className="workspace-error" role="alert">{pageError}</p>}
              {notice && <p className="workspace-notice" role="status">{notice}</p>}

              {isFormOpen && (
                <form
                  className="record-form"
                  key={`${activeSection}-${editingRecord?.id ?? "new"}`}
                  onSubmit={(event) => {
                    event.preventDefault();
                    submitForm(false);
                  }}
                  ref={formRef}
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
                    {(() => {
                      const fields = editingRecord
                        ? activeConfig.updateFields
                        : activeConfig.fields;

                      // Group the four document fields into one row
                      const documentFields = fields.filter(
                        (field) => field.row === 1
                      );

                      // Keep all remaining fields in the normal layout
                      const otherFields = fields.filter(
                        (field) => field.row !== 1
                      );

                      const renderField = (field) => {
                        const isFieldDisabled = Boolean(
                          field.dependsOnType &&
                            (Array.isArray(field.dependsOnType)
                              ? !field.dependsOnType.includes(formType)
                              : formType !== field.dependsOnType)
                        );

                        const isFieldRequired =
                          typeof field.required === "function"
                            ? field.required(formType)
                            : Boolean(field.required);

                        const lookupKey =
                          field.type === "supplier"
                            ? "suppliers"
                            : field.type === "customer"
                              ? "customers"
                              : field.type === "rawMaterial"
                                ? "rawMaterials"
                                : field.type === "element"
                                  ? "elements"
                                  : null;

                        const lookupRecords = lookupKey
                          ? lookupOptions[lookupKey] || []
                          : [];

                        const lookupError = lookupKey
                          ? lookupErrors[lookupKey]
                          : "";

                        const isLookupBusy = lookupKey
                          ? lookupLoading[lookupKey]
                          : false;

                        const optionName =
                          field.type === "rawMaterial"
                            ? "material_name"
                            : field.type === "element"
                              ? "element_name"
                              : "company_name";

                        const optionValue = "id";

                        return (
                          <label
                            className={[
                              field.wide ? "field-wide" : "",
                              isFieldDisabled ? "field-disabled" : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            htmlFor={`record-${field.name}`}
                            key={field.name}
                          >
                            {field.label}
                            {isFieldRequired && !isFieldDisabled ? " *" : ""}

                            {lookupKey ? (
                              <>
                                <select
                                  disabled={
                                    isFieldDisabled ||
                                    isLookupBusy ||
                                    Boolean(lookupError)
                                  }
                                  id={`record-${field.name}`}
                                  name={field.name}
                                  
                                    onChange={(event) => {
                                      const selectedId = event.target.value;

                                      handleFormFieldChange(field.name, selectedId);

                                      if (
                                        field.type === "rawMaterial" ||
                                        field.type === "element"
                                      ) {
                                        const selectedRecord = lookupRecords.find(
                                          (record) => String(record.id) === String(selectedId)
                                        );

                                        // Keep your existing unit functionality
                                        handleFormFieldChange(
                                          "unit",
                                          selectedRecord?.unit ?? ""
                                        );

                                        // Populate pricing and GST for raw materials
                                        if (field.type === "rawMaterial") {
                                          handleFormFieldChange(
                                            "rate",
                                            selectedRecord?.rate ?? 0
                                          );

                                          handleFormFieldChange(
                                            "cgst_percent",
                                            selectedRecord?.cgst_percent ?? 0
                                          );

                                          handleFormFieldChange(
                                            "ut_sgst_percent",
                                            selectedRecord?.ut_sgst_percent ?? 0
                                          );

                                          handleFormFieldChange(
                                            "igst_percent",
                                            selectedRecord?.igst_percent ?? 0
                                          );
                                        }
                                      }
                                    }}

                                  required={!isFieldDisabled && isFieldRequired}
                                  value={
                                    isFieldDisabled
                                      ? ""
                                      : formValues[field.name] ?? ""
                                  }
                                >
                                  <option value="">
                                    {isFieldDisabled
                                      ? `Not applicable for ${
                                          formType === "raw_material"
                                            ? "raw material"
                                            : formType === "element"
                                              ? "element"
                                              : "selected type"
                                        }`
                                      : isLookupBusy
                                        ? `Loading ${
                                            sections[lookupKey]?.label.toLowerCase() ||
                                            lookupKey
                                          }…`
                                        : lookupRecords.length === 0
                                          ? `No ${
                                              sections[lookupKey]?.label.toLowerCase() ||
                                              lookupKey
                                            } available`
                                          : `Select ${field.label.toLowerCase()}`}
                                  </option>

                                 
                                    {!isFieldDisabled &&
                                      lookupRecords.map((lookupRecord) => (
                                        <option
                                          key={lookupRecord.id}
                                          value={lookupRecord[optionValue]}
                                        >
                                          {lookupRecord[optionName]}
                                          {lookupRecord.unit
                                            ? ` (${lookupRecord.unit})`   
                                            : ""}
                                        </option>
                                      ))}
                                </select>

                                {lookupError && !isFieldDisabled && (
                                  <span className="field-error" role="alert">
                                    {lookupError}{" "}
                                    <button
                                      className="inline-retry"
                                      onClick={() =>
                                        setLookupRequestVersion(
                                          (version) => version + 1
                                        )
                                      }
                                      type="button"
                                    >
                                      Retry
                                    </button>
                                  </span>
                                )}
                              </>
                            ) : field.readOnly ? (
                              <div className="readonly-field-wrapper">
                                <input
                                  id={`record-${field.name}`}
                                  name={field.name}
                                  type="text"
                                  value={formValues[field.name] ?? ""}
                                  readOnly
                                  aria-readonly="true"
                                />

                                {field.restricted && (
                                  <span
                                    className="restricted-mark"
                                    title="This field cannot be edited"
                                    aria-label="Restricted field"
                                  >
                                  </span>
                                )}
                              </div>
                            ) : field.type === "select" ? (
                              <select
                                id={`record-${field.name}`}
                                name={field.name}
                                onChange={(event) =>
                                  handleFormFieldChange(
                                    field.name,
                                    event.target.value
                                  )
                                }
                                required={!isFieldDisabled && isFieldRequired}
                                disabled={isFieldDisabled}
                                value={formValues[field.name] ?? ""}
                              >
                                <option value="">
                                  Select {field.label.toLowerCase()}
                                </option>

                                {field.options.map((option) => (
                                  <option
                                    key={option.value}
                                    value={option.value}
                                  >
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            ) : field.wide ? (
                              <textarea
                                id={`record-${field.name}`}
                                name={field.name}
                                onChange={(event) =>
                                  handleFormFieldChange(
                                    field.name,
                                    event.target.value
                                  )
                                }
                                required={!isFieldDisabled && isFieldRequired}
                                disabled={isFieldDisabled}
                                rows="3"
                                value={formValues[field.name] ?? ""}
                              />
                            ) : (
                              <input
                                id={`record-${field.name}`}
                                minLength={field.minLength}
                                min={field.min}
                                step={field.step}
                                name={field.name}
                                onChange={(event) =>
                                  handleFormFieldChange(
                                    field.name,
                                    event.target.value
                                  )
                                }
                                required={!isFieldDisabled && isFieldRequired}
                                disabled={isFieldDisabled}
                                type={field.type || "text"}
                                value={formValues[field.name] ?? ""}
                              />
                            )}
                          </label>
                        );
                      };

                      return (
                        <>
                          {documentFields.length > 0 && (
                            <div className="document-fields">
                              {documentFields.map(renderField)}
                            </div>
                          )}

                          {otherFields.map(renderField)}
                        </>
                      );
                    })()}
                  </div>
                  <div className="form-actions">
                    <button
                      className="secondary-action"
                      onClick={() => {
                        setIsFormOpen(false);
                        setEditingRecord(null);
                        setFormValues({});
                      }}
                      type="button"
                    >
                      Cancel
                    </button>
                    <button
                      className="secondary-action"
                      disabled={isSaving}
                      onClick={handleClearForm}
                      type="button"
                    >
                      Clear
                    </button>
                    {activeSection === "dailyInputs" && !editingRecord && (
                      <button
                        className="secondary-action add-more-action"
                        disabled={isSaving || isLookupLoading || Boolean(activeLookupError)}
                        onClick={() => submitForm(true)}
                        type="button"
                      >
                        {isSaving ? "Saving…" : "Add More"}
                      </button>
                    )}
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
                    <span>
                      {filteredRecords.length} of {records.length} records
                    </span>
                  </div>
                  <div className="table-toolbar-actions">
                    {isLoading && <span className="loading-indicator">Loading…</span>}
                    <button
                      className="refresh-button csv-download-button"
                      disabled={isLoading || records.length === 0}
                      onClick={openCsvModal}
                      title="Select records to export as a CSV file"
                      type="button"
                    >
                      Download CSV
                    </button>
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
                <div className="table-filters">
                  <label className="table-search-field">
                    <span>Search</span>
                    <input
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder={`Search ${activeConfig.label.toLowerCase()}…`}
                      type="search"
                      value={searchTerm}
                    />
                  </label>
                  {activeSection !== "supervisors" && (
                    <div className="filter-builder">
                      <label>
                        <span>Filter field</span>
                        <select
                          disabled={availableFilterColumns.length === 0}
                          onChange={(event) => setFilterField(event.target.value)}
                          value={selectedFilterField}
                        >
                          {availableFilterColumns.map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>Contains</span>
                        <input
                          onChange={(event) => setFilterValue(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              if (selectedFilterField && filterValue.trim()) {
                                setFilters((current) => [
                                  ...current,
                                  { field: selectedFilterField, value: filterValue.trim() },
                                ]);
                                setFilterValue("");
                                setFilterField("");
                              }
                            }
                          }}
                          placeholder="Enter a value"
                          value={filterValue}
                        />
                      </label>
                      <button
                        className="refresh-button"
                        disabled={!selectedFilterField || !filterValue.trim()}
                        onClick={() => {
                          setFilters((current) => [
                            ...current,
                            { field: selectedFilterField, value: filterValue.trim() },
                          ]);
                          setFilterValue("");
                          setFilterField("");
                        }}
                        type="button"
                      >
                        Add filter
                      </button>
                    </div>
                  )}
                  {(searchTerm || filters.length > 0) && (
                    <button
                      className="clear-filters-button"
                      onClick={() => {
                        setSearchTerm("");
                        setFilters([]);
                        setFilterValue("");
                        setFilterField("");
                      }}
                      type="button"
                    >
                      Clear
                    </button>
                  )}
                </div>
                {activeSection !== "supervisors" && filters.length > 0 && (
                  <div aria-label="Active filters" className="active-filters">
                    {filters.map((filter) => (
                      <span className="active-filter" key={filter.field}>
                        {activeColumns.find(([key]) => key === filter.field)?.[1]} contains “{filter.value}”
                        <button
                          aria-label={`Remove ${filter.field} filter`}
                          onClick={() => setFilters((current) =>
                            current.filter((item) => item.field !== filter.field),
                          )}
                          type="button"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="table-scroll">
                  
                <div className="table-toolbar table-selection-toolbar">
                  <button
                    type="button"
                    className="table-action delete-action"
                    disabled={selectedIds.length === 0 || isLoading}
                    onClick={handleDeleteSelected}
                  >
                    Delete Selected ({selectedIds.length})
                  </button>
                </div>
                  <table>
                      <thead>
    <tr>
      {/* Select All checkbox */}
      <th className="select-heading">
        <input
          type="checkbox"
          checked={
            records.length > 0 &&
            records.every((row) => selectedIds.includes(row.id))
          }
          onChange={() => toggleSelectAll(records)}
          aria-label="Select all records"
        />
      </th>

      {/* Existing column headings */}
      {activeConfig.columns.map(([, label]) => (
        <th key={label}>{label}</th>
      ))}

      <th className="actions-heading">Actions</th>
    </tr>
  </thead>
                    <tbody>
                      {!isLoading && filteredRecords.map((record) => (
                        <tr key={record.id}>
                          {/* Row selection checkbox */}
      <td>
        <input
          type="checkbox"
          checked={selectedIds.includes(record.id)}
          onChange={() => toggleRowSelection(record.id)}
          aria-label={`Select row ${record.id}`}
        />
      </td>

                          {activeConfig.columns.map(([key]) => (
                            <td key={key}>
                              {formatCell(
                                getRelatedCompanyName(key, record[key]) ?? record[key],
                              )}
                            </td>
                          ))}
                          <td className="row-actions">
                            {activeSection === "invoices" ? (
                              <button
                                className="table-action"
                                disabled={!record.invoice_path}
                                onClick={() => handleDownloadInvoicePdf(record.id)}
                                type="button"
                              >
                                Download PDF
                              </button>
                            ) : (
                              <button
                                className="table-action"
                                onClick={() => {
                                  setPageError("");
                                  setNotice("");
                                  setEditingRecord(record);
                                  setFormType(record.type || "raw_material");

                                  const editValues = {};
                                  const fields =
                                    activeConfig.updateFields ||
                                    activeConfig.fields ||
                                    [];

                                  for (const field of fields) {
                                    if (field.name === "password") {
                                      editValues[field.name] = "";
                                    } else {
                                      editValues[field.name] = record[field.name] ?? "";
                                    }
                                  }

                                  // Populate fields from the selected raw material
                                  if (
                                    record.type === "raw_material" &&
                                    record.raw_material_id
                                  ) {
                                    const rm = lookupOptions.rawMaterials?.find(
                                      (material) =>
                                        String(material.id) ===
                                        String(record.raw_material_id)
                                    );

                                    if (rm) {
                                      editValues.item = rm.material_name;
                                      editValues.unit = rm.unit ?? "";
                                      editValues.rate = rm.rate ?? 0;
                                      editValues.cgst_percent =
                                        rm.cgst_percent ?? 0;
                                      editValues.ut_sgst_percent =
                                        rm.ut_sgst_percent ?? 0;
                                      editValues.igst_percent =
                                        rm.igst_percent ?? 0;
                                    }
                                  }

                                  setFormValues(editValues);
                                  setIsFormOpen(true);
                                }}
                                type="button"
                              >
                                Edit
                              </button>
                            )}
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
                      {!isLoading && filteredRecords.length === 0 && (
                        <tr>
                          <td className="empty-state" colSpan={activeConfig.columns.length + 2}>
                            {records.length === 0
                              ? "No records yet."
                              : "No records match your search and filters."}
                          </td>
                        </tr>
                      )}
                      {isLoading && (
                        <tr>
                          <td className="empty-state" colSpan={activeConfig.columns.length + 2}>
                            Loading records…
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {isInvoiceModalOpen && (
                <div
                  aria-labelledby="invoice-modal-title"
                  aria-modal="true"
                  className="modal-overlay"
                  onClick={() => {
                    if (!isGeneratingInvoice) setIsInvoiceModalOpen(false);
                  }}
                  role="presentation"
                >
                  <div
                    className="modal-dialog invoice-modal"
                    onClick={(event) => event.stopPropagation()}
                    role="dialog"
                  >
                    <div className="record-form-heading">
                      <h2 id="invoice-modal-title">Generate Invoice</h2>
                      <p>
                        Enter an invoice name and select the Daily Input records
                        to include. A PDF will be created and saved.
                      </p>
                    </div>

                    <form className="invoice-modal-form" onSubmit={handleGenerateInvoice}>
                      {pageError && (
                        <p className="workspace-error" role="alert">{pageError}</p>
                      )}

                      <label className="invoice-name-field" htmlFor="invoice-name">
                        <span>Invoice name</span>
                        <input
                          autoFocus
                          id="invoice-name"
                          onChange={(event) => setInvoiceName(event.target.value)}
                          placeholder="e.g. March supplier invoice"
                          required
                          type="text"
                          value={invoiceName}
                        />
                      </label>

                      <div className="invoice-select-list">
                        <div className="invoice-select-heading">
                          <strong>Daily Inputs</strong>
                          <button
                            className="refresh-button"
                            onClick={() => {
                              const allIds = invoiceModalDailyInputs.map((record) => record.id);
                              const allSelected =
                                allIds.length > 0
                                && allIds.every((id) =>
                                  invoiceSelectedIds.some(
                                    (selectedId) => String(selectedId) === String(id),
                                  ),
                                );
                              setInvoiceSelectedIds(allSelected ? [] : allIds);
                            }}
                            type="button"
                          >
                            {invoiceModalDailyInputs.length > 0
                              && invoiceModalDailyInputs.every((record) =>
                                invoiceSelectedIds.some(
                                  (selectedId) => String(selectedId) === String(record.id),
                                ),
                              )
                              ? "Clear all"
                              : "Select all"}
                          </button>
                        </div>

                        <div className="invoice-select-scroll">
                          {isLoadingInvoiceModalInputs ? (
                            <p className="empty-state">Loading Daily Inputs…</p>
                          ) : invoiceModalDailyInputs.length === 0 ? (
                            <p className="empty-state">No Daily Input records available.</p>
                          ) : (
                            invoiceModalDailyInputs.map((record) => (
                              <label className="invoice-select-row" key={record.id}>
                                <input
                                  checked={invoiceSelectedIds.some(
                                    (selectedId) => String(selectedId) === String(record.id),
                                  )}
                                  onChange={() => toggleInvoiceSelection(record.id)}
                                  type="checkbox"
                                />
                                <span>
                                  #{record.id}
                                  {" · "}
                                  {record.DC_no || record.dc_no || "—"}
                                  {" · "}
                                  {record.item || record.type || "—"}
                                  {" · "}
                                  {formatCell(record.total_amount)}
                                </span>
                              </label>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="form-actions">
                        <button
                          className="secondary-action"
                          disabled={isGeneratingInvoice}
                          onClick={() => setIsInvoiceModalOpen(false)}
                          type="button"
                        >
                          Cancel
                        </button>
                        <button
                          className="generate-invoice-button"
                          disabled={
                            isGeneratingInvoice
                            || isLoadingInvoiceModalInputs
                            || !invoiceName.trim()
                            || invoiceSelectedIds.length === 0
                          }
                          type="submit"
                        >
                          {isGeneratingInvoice ? "Generating…" : "Generate Invoice"}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {isCsvModalOpen && (
                <div
                  aria-labelledby="csv-modal-title"
                  aria-modal="true"
                  className="modal-overlay"
                  onClick={() => {
                    if (!isExportingCsv) setIsCsvModalOpen(false);
                  }}
                  role="presentation"
                >
                  <div
                    className="modal-dialog"
                    onClick={(event) => event.stopPropagation()}
                    role="dialog"
                  >
                    <div className="record-form-heading">
                      <h2 id="csv-modal-title">Download CSV</h2>
                      <p>
                        Search and select the {activeConfig.label.toLowerCase()} records
                        to include in the CSV file.
                      </p>
                    </div>

                    <form className="invoice-modal-form" onSubmit={handleDownloadCsv}>
                      {pageError && (
                        <p className="workspace-error" role="alert">{pageError}</p>
                      )}

                      <label className="invoice-name-field" htmlFor="csv-search">
                        <span>Search</span>
                        <input
                          autoFocus
                          id="csv-search"
                          onChange={(event) => setCsvSearchTerm(event.target.value)}
                          placeholder={`Search ${activeConfig.label.toLowerCase()}…`}
                          type="search"
                          value={csvSearchTerm}
                        />
                      </label>

                      <div className="invoice-select-list">
                        <div className="invoice-select-heading">
                          <strong>
                            {csvSelectedIds.length} selected
                          </strong>
                          <button
                            className="refresh-button"
                            onClick={() => {
                              const visibleIds = csvFilteredRecords.map((record) => record.id);
                              const allSelected =
                                visibleIds.length > 0
                                && visibleIds.every((id) =>
                                  csvSelectedIds.some(
                                    (selectedId) => String(selectedId) === String(id),
                                  ),
                                );
                              setCsvSelectedIds((prev) => (
                                allSelected
                                  ? prev.filter((selectedId) =>
                                      !visibleIds.some((id) => String(id) === String(selectedId)),
                                    )
                                  : [
                                      ...prev,
                                      ...visibleIds.filter((id) =>
                                        !prev.some((selectedId) => String(selectedId) === String(id)),
                                      ),
                                    ]
                              ));
                            }}
                            type="button"
                          >
                            {csvFilteredRecords.length > 0
                              && csvFilteredRecords.every((record) =>
                                csvSelectedIds.some(
                                  (selectedId) => String(selectedId) === String(record.id),
                                ),
                              )
                              ? "Clear visible"
                              : "Select visible"}
                          </button>
                        </div>

                        <div className="invoice-select-scroll">
                          {csvFilteredRecords.length === 0 ? (
                            <p className="empty-state">
                              {records.length === 0
                                ? "No records available."
                                : "No records match your search."}
                            </p>
                          ) : (
                            csvFilteredRecords.map((record) => (
                              <label className="invoice-select-row" key={record.id}>
                                <input
                                  checked={csvSelectedIds.some(
                                    (selectedId) => String(selectedId) === String(record.id),
                                  )}
                                  onChange={() => toggleCsvSelection(record.id)}
                                  type="checkbox"
                                />
                                <span>
                                  {activeConfig.columns.slice(0, 4).map(([key], index) => {
                                    const value = formatCsvCell(record, key);
                                    return (
                                      <span key={key}>
                                        {index > 0 ? " · " : ""}
                                        {value || "—"}
                                      </span>
                                    );
                                  })}
                                </span>
                              </label>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="form-actions">
                        <button
                          className="secondary-action"
                          disabled={isExportingCsv}
                          onClick={() => setIsCsvModalOpen(false)}
                          type="button"
                        >
                          Cancel
                        </button>
                        <button
                          className="csv-download-button"
                          disabled={isExportingCsv || csvSelectedIds.length === 0}
                          type="submit"
                        >
                          {isExportingCsv ? "Downloading…" : "Download CSV"}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
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
  onRefresh,
  pageError,
  navigationItems,
  user,
}) {
  const kpiCards = navigationItems
    .filter((section) => section.id !== "dashboard" && sections[section.id])
    .map((section) => ({
      ...section,
      count: counts[section.id] ?? 0,
      title: `Total ${section.label}`,
    }));
  const [reportNotice, setReportNotice] = useState("");

  function generateDailyReport() {
    const reportDate = new Date().toLocaleDateString("en-CA");
    const rows = [
      ["Daily dashboard report", reportDate],
      ["Role", user.role],
      [],
      ["Metric", "Count"],
      ...kpiCards.map((card) => [
        card.title,
        counts[card.id] ?? "Not loaded",
      ]),
    ];
    const csv = rows
      .map((row) => row.map((value) => {
        const cell = String(value ?? "");
        return `"${cell.replaceAll('"', '""')}"`;
      }).join(","))
      .join("\r\n");
    const file = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const downloadUrl = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `daily-report-${reportDate}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    setReportNotice(`Daily report downloaded for ${reportDate}.`);
  }

  return (
    <section aria-labelledby="page-title" className="section-page">
      <div className="page-heading dashboard-heading">
        <div>
          <span className="eyebrow">OVERVIEW</span>
          <h1 id="page-title">Good day, {user.first_name}</h1>
          <p>Here’s what’s happening in your workspace.</p>
        </div>
        <div className="dashboard-heading-actions">
          <span className="role-badge">{user.role}</span>
          <button
            className="generate-report-button"
            disabled={isLoading}
            onClick={generateDailyReport}
            type="button"
          >
            Generate daily report
          </button>
          <button
            className="refresh-button"
            disabled={isLoading}
            onClick={onRefresh}
            type="button"
          >
            Refresh KPIs
          </button>
        </div>
      </div>

      {pageError && <p className="workspace-error" role="alert">{pageError}</p>}
      {reportNotice && <p className="workspace-notice" role="status">{reportNotice}</p>}
      <p
        className={`backend-status${backendStatus?.ok ? " connected" : " disconnected"}`}
        role="status"
      >
        <span aria-hidden="true" className="backend-status-dot" />
        {backendStatus?.ok
          ? backendStatus.message
          : backendStatus?.error ?? "Checking backend…"}
      </p>

      <div className="kpi-grid-scroll">
        <div aria-label="Workspace key performance indicators" className="kpi-grid">
          {kpiCards.map((card) => (
            <button
              aria-label={`${card.title}: ${isLoading ? "loading" : card.count}. Open ${card.label}.`}
              className={`kpi-card kpi-${card.id}`}
              key={card.id}
              onClick={() => onNavigate(card.id)}
              type="button"
            >
              <span className="kpi-card-top">
                <span className="kpi-icon" aria-hidden="true">{card.marker}</span>
                <span className="kpi-period">ALL RECORDS</span>
              </span>
              <span className="kpi-title">{card.title}</span>
              <strong className="kpi-value">
                {isLoading ? "…" : counts[card.id] ?? "—"}
              </strong>
              <span className="kpi-link">
                View {card.label.toLowerCase()} <span aria-hidden="true">→</span>
              </span>
            </button>
          ))}
        </div>
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
