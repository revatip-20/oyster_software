const fs = require('fs');

let content = fs.readFileSync('frontend/src/App.jsx', 'utf8');

function applyPatch(name, target, replacement) {
  const count = content.split(target).length - 1;
  if (count === 0) {
    throw new Error(`Patch "${name}" FAILED: target not found!`);
  }
  if (count > 1) {
    throw new Error(`Patch "${name}" FAILED: target found ${count} times (must be unique)!`);
  }
  content = content.replace(target, replacement);
  console.log(`Patch "${name}" applied successfully.`);
}

// 1. Top helpers
applyPatch(
  'Top Date Helpers',
  'import { navigation, sections, INDIAN_STATES } from "./workspace.js";\n\nfunction App() {',
  `import { navigation, sections, INDIAN_STATES } from "./workspace.js";

export function formatDateToDDMMYYYY(value) {
  if (value === null || value === undefined || value === "") return "";
  if (value instanceof Date && !isNaN(value.getTime())) {
    const day = String(value.getDate()).padStart(2, "0");
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const year = value.getFullYear();
    return \`\${day}/\${month}/\${year}\`;
  }
  const str = String(value).trim();
  const ddmmyyyyMatch = str.match(/^(\\d{1,2})[\\/\\-](\\d{1,2})[\\/\\-](\\d{4})$/);
  if (ddmmyyyyMatch) {
    const day = ddmmyyyyMatch[1].padStart(2, "0");
    const month = ddmmyyyyMatch[2].padStart(2, "0");
    const year = ddmmyyyyMatch[3];
    return \`\${day}/\${month}/\${year}\`;
  }
  const yyyymmddMatch = str.match(/^(\\d{4})[\\/\\-](\\d{1,2})[\\/\\-](\\d{1,2})(?:[T\\s].*)?$/);
  if (yyyymmddMatch) {
    const year = yyyymmddMatch[1];
    const month = yyyymmddMatch[2].padStart(2, "0");
    const day = yyyymmddMatch[3].padStart(2, "0");
    const yNum = parseInt(year, 10);
    const mNum = parseInt(month, 10);
    const dNum = parseInt(day, 10);
    if (yNum >= 1900 && yNum <= 2100 && mNum >= 1 && mNum <= 12 && dNum >= 1 && dNum <= 31) {
      return \`\${day}/\${month}/\${year}\`;
    }
  }
  if (str.includes("T") || str.includes("Z")) {
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      const day = String(parsed.getDate()).padStart(2, "0");
      const month = String(parsed.getMonth() + 1).padStart(2, "0");
      const year = parsed.getFullYear();
      return \`\${day}/\${month}/\${year}\`;
    }
  }
  return value;
}

export function toIsoDateString(value) {
  if (value === null || value === undefined || value === "") return "";
  if (value instanceof Date && !isNaN(value.getTime())) {
    const yyyy = value.getFullYear();
    const mm = String(value.getMonth() + 1).padStart(2, "0");
    const dd = String(value.getDate()).padStart(2, "0");
    return \`\${yyyy}-\${mm}-\${dd}\`;
  }
  const str = String(value).trim();
  const ddmmyyyyMatch = str.match(/^(\\d{1,2})[\\/\\-](\\d{1,2})[\\/\\-](\\d{4})$/);
  if (ddmmyyyyMatch) {
    const day = ddmmyyyyMatch[1].padStart(2, "0");
    const month = ddmmyyyyMatch[2].padStart(2, "0");
    const year = ddmmyyyyMatch[3];
    return \`\${year}-\${month}-\${day}\`;
  }
  const yyyymmddMatch = str.match(/^(\\d{4})[\\/\\-](\\d{1,2})[\\/\\-](\\d{1,2})/);
  if (yyyymmddMatch) {
    const year = yyyymmddMatch[1];
    const month = yyyymmddMatch[2].padStart(2, "0");
    const day = yyyymmddMatch[3].padStart(2, "0");
    return \`\${year}-\${month}-\${day}\`;
  }
  return str;
}

function App() {`
);

// 2. Month-End State and Functions
applyPatch(
  'Month-End State and Functions',
  `  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [csvPreview, setCsvPreview] = useState(null);
  const toggleRowSelection = (id) => {`,
  `  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [csvPreview, setCsvPreview] = useState(null);

  const [monthEndStatus, setMonthEndStatus] = useState(null);
  const [isMonthEndModalOpen, setIsMonthEndModalOpen] = useState(false);
  const [isProcessingMonthEnd, setIsProcessingMonthEnd] = useState(false);

  const checkMonthEndStatus = useCallback(async () => {
    if (!user) return;
    try {
      let result;
      if (window.desktop?.getStockBalanceStatus) {
        result = await window.desktop.getStockBalanceStatus();
      } else {
        const res = await fetch("/stock-balance/status");
        result = await res.json();
      }
      const data = result?.data || result;
      if (data) {
        setMonthEndStatus(data);
        if (data.needs_processing) {
          const dismissedKey = \`dismissed_month_end_\${data.target_month}\`;
          if (!sessionStorage.getItem(dismissedKey)) {
            setIsMonthEndModalOpen(true);
          }
        }
      }
    } catch (err) {
      console.warn("Check month-end status failed:", err);
    }
  }, [user]);

  useEffect(() => {
    checkMonthEndStatus();
  }, [checkMonthEndStatus]);

  function handleDismissMonthEnd() {
    setIsMonthEndModalOpen(false);
    if (monthEndStatus?.target_month) {
      sessionStorage.setItem(\`dismissed_month_end_\${monthEndStatus.target_month}\`, "true");
    }
  }

  async function handleConfirmMonthEnd() {
    setIsProcessingMonthEnd(true);
    setPageError("");
    try {
      let result;
      if (window.desktop?.processStockBalance) {
        result = await window.desktop.processStockBalance(monthEndStatus?.target_month);
      } else {
        const res = await fetch("/stock-balance/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target_month: monthEndStatus?.target_month }),
        });
        result = await res.json();
      }

      if (result && (result.ok || result.target_month)) {
        setIsMonthEndModalOpen(false);
        const processedTarget = result.target_month || monthEndStatus?.target_month || "new month";
        sessionStorage.setItem(\`dismissed_month_end_\${processedTarget}\`, "true");
        setNotice(\`Month-end stock balance processed successfully! Open Balance has been replaced with Close Balance for \${processedTarget}.\`);
        setRequestVersion((v) => v + 1);
        setLookupRequestVersion((v) => v + 1);
        checkMonthEndStatus();
      } else {
        setPageError(result?.error || result?.detail || "Failed to process month-end balance.");
      }
    } catch (err) {
      console.error("Month-end processing error:", err);
      setPageError("An error occurred while processing month-end balance.");
    } finally {
      setIsProcessingMonthEnd(false);
    }
  }

  const toggleRowSelection = (id) => {`
);

// 3. handleFormFieldChange products
applyPatch(
  'FormFieldChange products balance',
  `    if (activeSection === "rawMaterials" && ["open_balance", "received", "consumption"].includes(name)) {
      const ob = parseFloat(name === "open_balance" ? value : next.open_balance) || 0;
      const rc = parseFloat(name === "received" ? value : next.received) || 0;
      const cn = parseFloat(name === "consumption" ? value : next.consumption) || 0;
      next.close_balance = Number((ob + rc - cn).toFixed(4));
    }`,
  `    if ((activeSection === "rawMaterials" || activeSection === "products") && ["open_balance", "received", "consumption"].includes(name)) {
      const ob = parseFloat(name === "open_balance" ? value : next.open_balance) || 0;
      const rc = parseFloat(name === "received" ? value : next.received) || 0;
      const cn = parseFloat(name === "consumption" ? value : next.consumption) || 0;
      next.close_balance = Number((ob + rc - cn).toFixed(4));
    }`
);

// 4. handleClearForm products
applyPatch(
  'ClearForm products balance',
  `    if (activeSection === "products") {
      emptyValues.product_mode = "with_zach_code";
      emptyValues.zach_code = "";
      emptyValues.raw_materials = [];
      emptyValues.raw_material_ids = [];
    }`,
  `    if (activeSection === "products") {
      emptyValues.product_mode = "with_zach_code";
      emptyValues.zach_code = "";
      emptyValues.raw_materials = [];
      emptyValues.raw_material_ids = [];
      emptyValues.open_balance = 0;
      emptyValues.received = 0;
      emptyValues.consumption = 0;
      emptyValues.close_balance = 0;
    }`
);

// 5. submitForm numericFields
applyPatch(
  'submitForm numericFields',
  `      "qty_ord",
      "qty_dis",
      "qty_bal",
      "price",
    ];`,
  `      "qty_ord",
      "qty_dis",
      "qty_bal",
      "price",
      "open_balance",
      "received",
      "consumption",
      "close_balance",
    ];`
);

// 6. submitForm allowedFields
applyPatch(
  'submitForm allowedFields',
  `...(activeSection === "products" ? ["zach_code", "has_zach_code", "po_batch_no", "ls", "hsn_code", "sach_code", "bin", "boxes", "raw_material_id", "raw_material_ids", "raw_materials", "element_id", "welded_element_id"] : []),`,
  `...(activeSection === "products" ? ["zach_code", "has_zach_code", "po_batch_no", "ls", "hsn_code", "sach_code", "bin", "boxes", "raw_material_id", "raw_material_ids", "raw_materials", "element_id", "welded_element_id", "open_balance", "received", "consumption", "close_balance"] : []),`
);

// 7. submitForm product payload
applyPatch(
  'submitForm product payload',
  `        if (record.raw_material_ids.length > 0) {
          record.raw_material_id = record.raw_material_ids[0];
        }
      }
    }

    // --------------------------------------------------
    // Prepare Consumption payload`,
  `        if (record.raw_material_ids.length > 0) {
          record.raw_material_id = record.raw_material_ids[0];
        }
      }

      if (formValues.open_balance !== undefined && formValues.open_balance !== "") {
        record.open_balance = Number(formValues.open_balance);
      }
      if (formValues.received !== undefined && formValues.received !== "") {
        record.received = Number(formValues.received);
      }
      if (formValues.consumption !== undefined && formValues.consumption !== "") {
        record.consumption = Number(formValues.consumption);
      }
      if (formValues.close_balance !== undefined && formValues.close_balance !== "") {
        record.close_balance = Number(formValues.close_balance);
      } else if (record.open_balance !== undefined || record.received !== undefined || record.consumption !== undefined) {
        record.close_balance = Number(((record.open_balance || 0) + (record.received || 0) - (record.consumption || 0)).toFixed(4));
      }
    }

    // --------------------------------------------------
    // Prepare Consumption payload`
);

// 8. submitForm date compare
applyPatch(
  'submitForm date compare',
  `        // Compare dates consistently when possible.
        const isDateField = [
          "dc_date",
          "bill_date",
        ].includes(key);

        const isNumericCompare = numericFields.includes(key);
        const valuesMatch = isDateField
          ? String(newValue ?? "").slice(0, 10) ===
            String(originalValue ?? "").slice(0, 10)`,
  `        // Compare dates consistently when possible.
        const isDateField = [
          "dc_date",
          "bill_date",
          "out_dc_date",
          "po_date",
          "joining_date",
          "date",
        ].includes(key.toLowerCase()) || key.toLowerCase().includes("date");

        const isNumericCompare = numericFields.includes(key);
        const valuesMatch = isDateField
          ? toIsoDateString(newValue) === toIsoDateString(originalValue)`
);

// 9. formatCsvCell
applyPatch(
  'formatCsvCell',
  `  function formatCsvCell(record, key) {
    const raw = getRecordFieldValue(record, key);
    const val = getRelatedCompanyName(key, raw, record) ?? raw ?? "";
    if (typeof val === "string" && key.toLowerCase().includes("date") && val.includes("T")) {
      return val.split("T")[0];
    }
    if (val === null || val === undefined || val === "") return "";
    if (typeof val === "object") return JSON.stringify(val);
    return String(val);
  }`,
  `  function formatCsvCell(record, key) {
    const raw = getRecordFieldValue(record, key);
    const val = getRelatedCompanyName(key, raw, record) ?? raw ?? "";
    if (val === null || val === undefined || val === "") return "";
    if (key.toLowerCase().includes("date")) {
      return formatDateToDDMMYYYY(val);
    }
    if (typeof val === "string" && (/^\\d{4}-\\d{2}-\\d{2}(?:[T\\s].*)?$/.test(val.trim()) || /^\\d{1,2}[-/]\\d{1,2}[-/]\\d{4}$/.test(val.trim()))) {
      return formatDateToDDMMYYYY(val);
    }
    if (typeof val === "object") return JSON.stringify(val);
    return String(val);
  }`
);

// 10. Fallback escapeCsvCell
applyPatch(
  'Fallback escapeCsvCell',
  `        const escapeCsvCell = (value) => {
          let cell = value === null || value === undefined ? "" : String(value);
          if (/^[\\s]*[=+\\-@]/.test(cell)) cell = \`'\${cell}\`;
          return \`"\${cell.replaceAll('"', '""')}"\`;
        };`,
  `        const escapeCsvCell = (value) => {
          let cell = value === null || value === undefined ? "" : String(value);
          const trimmed = cell.trim();
          const yyyymmdd = trimmed.match(/^(\\d{4})[-/](\\d{1,2})[-/](\\d{1,2})(?:[T\\s].*)?$/);
          if (yyyymmdd) {
            const formatted = \`\${yyyymmdd[3].padStart(2, "0")}/\${yyyymmdd[2].padStart(2, "0")}/\${yyyymmdd[1]}\`;
            return \`"=""\${formatted}"""\`;
          }
          const ddmmyyyy = trimmed.match(/^(\\d{1,2})[-/](\\d{1,2})[-/](\\d{4})$/);
          if (ddmmyyyy) {
            const formatted = \`\${ddmmyyyy[1].padStart(2, "0")}/\${ddmmyyyy[2].padStart(2, "0")}/\${ddmmyyyy[3]}\`;
            return \`"=""\${formatted}"""\`;
          }
          if (/^[\\s]*[=+\\-@]/.test(cell)) cell = \`'\${cell}\`;
          return \`"\${cell.replaceAll('"', '""')}"\`;
        };`
);

// 11. getColumnSearchValues
applyPatch(
  'getColumnSearchValues',
  `  function getColumnSearchValues(record, key) {
    const raw = getRecordFieldValue(record, key);
    const values = [raw, getRelatedCompanyName(key, raw, record)];
    return values
      .filter((value) => value !== null && value !== undefined)
      .map((value) => String(value).toLocaleLowerCase());
  }`,
  `  function getColumnSearchValues(record, key) {
    const raw = getRecordFieldValue(record, key);
    const related = getRelatedCompanyName(key, raw, record);
    const formatted = formatCell(related ?? raw, key);
    const values = [raw, related, formatted];
    return values
      .filter((value) => value !== null && value !== undefined && value !== "—")
      .map((value) => String(value).toLocaleLowerCase());
  }`
);

// 12. Daily Dispatch search & column
applyPatch(
  'Daily Dispatch dcDate search',
  `const dcDate = String(item.DC_date ?? item.dc_date ?? getRecordFieldValue(item, "DC_date") ?? "").toLowerCase();`,
  `const dcDate = String(formatDateToDDMMYYYY(item.DC_date ?? item.dc_date ?? getRecordFieldValue(item, "DC_date")) || "").toLowerCase();`
);
applyPatch(
  'Daily Dispatch selectable DC_date',
  `getValue: (item) => normalizeCsvDate(item.DC_date ?? item.dc_date ?? getRecordFieldValue(item, "DC_date")),`,
  `getValue: (item) => formatDateToDDMMYYYY(item.DC_date ?? item.dc_date ?? getRecordFieldValue(item, "DC_date")),`
);

// 13. Staging table date
applyPatch(
  'Daily Dispatch staging date',
  `<td title={row.DC_date}>{row.DC_date || "—"}</td>`,
  `<td title={formatDateToDDMMYYYY(row.DC_date)}>{formatDateToDDMMYYYY(row.DC_date) || "—"}</td>`
);

// 14. renderField disabled & date value
applyPatch(
  'renderField isFieldDisabled',
  `                        const isFieldDisabled = Boolean(
                          field.dependsOnType &&
                            (Array.isArray(field.dependsOnType)
                              ? !field.dependsOnType.includes(formType)
                              : formType !== field.dependsOnType)
                        );`,
  `                        const isFieldDisabled = Boolean(
                          field.disabled ||
                          (field.dependsOnType &&
                            (Array.isArray(field.dependsOnType)
                              ? !field.dependsOnType.includes(formType)
                              : formType !== field.dependsOnType))
                        );`
);
applyPatch(
  'renderField date value',
  `                                placeholder={field.placeholder || ""}
                                type={field.type || "text"}
                                value={formValues[field.name] ?? ""}
                              />`,
  `                                placeholder={field.placeholder || ""}
                                type={field.type || "text"}
                                value={field.type === "date" ? toIsoDateString(formValues[field.name]) : (formValues[field.name] ?? "")}
                              />`
);

// 15. Month-End Pop-Up Modal
applyPatch(
  'Month-End Pop-Up Modal',
  `                      <div className="form-actions product-confirm-actions">
                        <button
                          className="secondary-action"
                          disabled={isSaving}
                          onClick={() => setProductSaveConfirm(null)}
                          type="button"
                        >
                          Cancel
                        </button>
                        <button
                          className="primary-action"
                          disabled={isSaving}
                          onClick={async () => {
                            setProductSaveConfirm(null);
                            await submitForm(false);
                          }}
                          type="button"
                        >
                          {isSaving ? "Saving…" : "Yes, Save"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {quickAddRawMaterialModal && (`,
  `                      <div className="form-actions product-confirm-actions">
                        <button
                          className="secondary-action"
                          disabled={isSaving}
                          onClick={() => setProductSaveConfirm(null)}
                          type="button"
                        >
                          Cancel
                        </button>
                        <button
                          className="primary-action"
                          disabled={isSaving}
                          onClick={async () => {
                            setProductSaveConfirm(null);
                            await submitForm(false);
                          }}
                          type="button"
                        >
                          {isSaving ? "Saving…" : "Yes, Save"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {isMonthEndModalOpen && (
                  <div
                    aria-labelledby="month-end-title"
                    aria-modal="true"
                    className="modal-overlay product-confirm-overlay"
                    onClick={() => {
                      if (!isProcessingMonthEnd) handleDismissMonthEnd();
                    }}
                    role="presentation"
                  >
                    <div
                      className="modal-dialog product-confirm-dialog"
                      onClick={(event) => event.stopPropagation()}
                      role="dialog"
                      style={{ maxWidth: "560px" }}
                    >
                      <div className="product-confirm-header">
                        <div className="product-confirm-icon-wrap" style={{ background: "#fef3c7", borderColor: "#fde68a" }}>
                          <span className="product-confirm-icon">📅</span>
                        </div>
                        <div className="product-confirm-header-text">
                          <h2 id="month-end-title">End of Month Balance Processing</h2>
                          <p className="product-confirm-sub">Review stock balance rollover before proceeding</p>
                        </div>
                        <button
                          type="button"
                          className="product-confirm-close-btn"
                          onClick={() => {
                            if (!isProcessingMonthEnd) handleDismissMonthEnd();
                          }}
                          title="Close"
                        >
                          ×
                        </button>
                      </div>

                      <div className="product-confirm-prompt-card" style={{ background: "#eff6ff", borderLeftColor: "#2563eb" }}>
                        <p className="product-confirm-question" style={{ color: "#1e3a8a", fontSize: "14px" }}>
                          <strong>It is the end of the month. Do you want to process the data?</strong>
                        </p>
                      </div>

                      <div style={{ margin: "16px 0", fontSize: "13px", color: "#334155", lineHeight: "1.6" }}>
                        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "12px 14px", marginBottom: "12px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                            <span style={{ color: "#64748b" }}>Current recorded period:</span>
                            <strong>{monthEndStatus?.current_balance_month || "Current"}</strong>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                            <span style={{ color: "#64748b" }}>Processing for period:</span>
                            <strong style={{ color: "#2563eb" }}>{monthEndStatus?.target_month || "Next month"}</strong>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ color: "#64748b" }}>Today's Date:</span>
                            <strong>{monthEndStatus?.today_date || new Date().toLocaleDateString("en-IN")}</strong>
                          </div>
                        </div>

                        <div style={{ padding: "0 4px" }}>
                          <p style={{ margin: "0 0 6px 0", fontWeight: 600, color: "#0f172a" }}>
                            What will happen when you click "Yes, Process Data":
                          </p>
                          <ul style={{ margin: "0 0 10px 0", paddingLeft: "20px", color: "#475569" }}>
                            <li><strong>Open Balance</strong> will be replaced by the current <strong>Close Balance</strong>.</li>
                            <li><strong>Received</strong> and <strong>Consumption</strong> will be reset to <strong>0</strong>.</li>
                            <li><strong>Close Balance</strong> will start equal to the new Open Balance.</li>
                            <li><strong>Open Balance</strong> will remain unchanged throughout the rest of the month unless manually edited.</li>
                          </ul>
                          <p style={{ margin: 0, fontSize: "12px", color: "#64748b", fontStyle: "italic" }}>
                            Note: If you select "Not Now", no values will be changed. You can process this later anytime from the toolbar.
                          </p>
                        </div>
                      </div>

                      <div className="product-confirm-actions" style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "18px" }}>
                        <button
                          type="button"
                          className="table-action table-action-cancel"
                          disabled={isProcessingMonthEnd}
                          onClick={handleDismissMonthEnd}
                          style={{ padding: "8px 16px", borderRadius: "6px" }}
                        >
                          Not Now
                        </button>
                        <button
                          type="button"
                          className="table-action table-action-confirm"
                          disabled={isProcessingMonthEnd}
                          onClick={handleConfirmMonthEnd}
                          style={{
                            padding: "8px 18px",
                            borderRadius: "6px",
                            background: "#16a34a",
                            color: "#ffffff",
                            fontWeight: 600,
                            border: "none",
                            cursor: isProcessingMonthEnd ? "wait" : "pointer",
                          }}
                        >
                          {isProcessingMonthEnd ? "Processing…" : "Yes, Process Data"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {quickAddRawMaterialModal && (`
);

// 16. Table toolbar button
applyPatch(
  'Table toolbar button',
  `                    <button
                      className="refresh-button csv-download-button"
                      disabled={isLoading || records.length === 0}
                      onClick={openCsvModal}`,
  `                    {(activeSection === "rawMaterials" || activeSection === "products") && (
                      <button
                        className="refresh-button"
                        style={
                          monthEndStatus?.needs_processing
                            ? { background: "#fef3c7", color: "#92400e", borderColor: "#f59e0b", fontWeight: 600 }
                            : undefined
                        }
                        onClick={() => {
                          checkMonthEndStatus();
                          setIsMonthEndModalOpen(true);
                        }}
                        title="Process month-end stock balance: Open Balance becomes Close Balance"
                        type="button"
                      >
                        📅 Process Month-End {monthEndStatus?.needs_processing && "⚠️"}
                      </button>
                    )}
                    <button
                      className="refresh-button csv-download-button"
                      disabled={isLoading || records.length === 0}
                      onClick={openCsvModal}`
);

// 17. Table rows passing key to formatCell
applyPatch(
  'Table headings formatCell key',
  `              const cellValue = getRelatedCompanyName(key, rawVal, rec) ?? rawVal;
              const formatted = String(formatCell(cellValue) ?? "").trim();`,
  `              const cellValue = getRelatedCompanyName(key, rawVal, rec) ?? rawVal;
              const formatted = String(formatCell(cellValue, key) ?? "").trim();`
);
applyPatch(
  'Table rows formatCell key',
  `                                  const cellValue = getRelatedCompanyName(key, rawVal, rec) ?? rawVal;
                                  const formatted = String(formatCell(cellValue) ?? "").trim();
                                  return formatted !== "" && formatted !== "-" && formatted !== "—" && formatted.toLowerCase() !== "null";
                                })
                              )
                            : activeConfig.columns
                          ).map(([key]) => {
                            const rawVal = getRecordFieldValue(record, key);
                            const cellValue = getRelatedCompanyName(key, rawVal, record) ?? rawVal;
                            const formatted = formatCell(cellValue);`,
  `                                  const cellValue = getRelatedCompanyName(key, rawVal, rec) ?? rawVal;
                                  const formatted = String(formatCell(cellValue, key) ?? "").trim();
                                  return formatted !== "" && formatted !== "-" && formatted !== "—" && formatted.toLowerCase() !== "null";
                                })
                              )
                            : activeConfig.columns
                          ).map(([key]) => {
                            const rawVal = getRecordFieldValue(record, key);
                            const cellValue = getRelatedCompanyName(key, rawVal, record) ?? rawVal;
                            const formatted = formatCell(cellValue, key);`
);

// 18. editValues for products & PO date
applyPatch(
  'editValues products and po_date',
  `                                  if (activeSection === "products") {
                                    const hasZach = Boolean(record.has_zach_code || record.zach_code);
                                    editValues.product_mode = hasZach ? "with_zach_code" : "without_zach_code";
                                    editValues.ls = record.ls ?? "";
                                    editValues.hsn_code = record.hsn_code ?? "";
                                    editValues.sach_code = record.sach_code ?? "";
                                  }

                                  if (activeSection === "purchaseOrderReceived") {
                                    editValues.customer_id = record.customer_id ?? "";
                                    editValues.product_id = record.product_id ?? "";
                                    editValues.product_picker = record.product_id ?? "";
                                    editValues.item = record.item ?? "";
                                    editValues.zach_code = record.zach_code ?? "";
                                    editValues.sach_code = record.sach_code ?? "";
                                    editValues.po_no = record.po_no ?? "";
                                    editValues.po_date = record.po_date ? String(record.po_date).slice(0, 10) : "";`,
  `                                  if (activeSection === "products") {
                                    const hasZach = Boolean(record.has_zach_code || record.zach_code);
                                    editValues.product_mode = hasZach ? "with_zach_code" : "without_zach_code";
                                    editValues.ls = record.ls ?? "";
                                    editValues.hsn_code = record.hsn_code ?? "";
                                    editValues.sach_code = record.sach_code ?? "";
                                    editValues.open_balance = record.open_balance ?? 0;
                                    editValues.received = record.received ?? 0;
                                    editValues.consumption = record.consumption ?? 0;
                                    editValues.close_balance = record.close_balance ?? 0;
                                  }

                                  if (activeSection === "purchaseOrderReceived") {
                                    editValues.customer_id = record.customer_id ?? "";
                                    editValues.product_id = record.product_id ?? "";
                                    editValues.product_picker = record.product_id ?? "";
                                    editValues.item = record.item ?? "";
                                    editValues.zach_code = record.zach_code ?? "";
                                    editValues.sach_code = record.sach_code ?? "";
                                    editValues.po_no = record.po_no ?? "";
                                    editValues.po_date = record.po_date ? toIsoDateString(record.po_date) : "";`
);

// 19. formatCell bottom
applyPatch(
  'formatCell bottom',
  `function formatCell(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) {
    return (
      value
        .map((it) => {
          if (!it) return "";
          if (typeof it === "string") return it;
          const name =
            it.material_name ||
            it.name ||
            (it.raw_material_id ? \`RM #\${it.raw_material_id}\` : "");
          const qty =
            it.quantity !== undefined && it.quantity !== null && it.quantity !== ""
              ? it.quantity
              : "";
          const unit = it.unit ? \` \${it.unit}\` : "";
          return name ? (qty ? \`\${name} (\${qty}\${unit})\` : name) : JSON.stringify(it);
        })
        .filter(Boolean)
        .join(", ") || "—"
    );
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}`,
  `function formatCell(value, key = "") {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) {
    return (
      value
        .map((it) => {
          if (!it) return "";
          if (typeof it === "string") return it;
          const name =
            it.material_name ||
            it.name ||
            (it.raw_material_id ? \`RM #\${it.raw_material_id}\` : "");
          const qty =
            it.quantity !== undefined && it.quantity !== null && it.quantity !== ""
              ? it.quantity
              : "";
          const unit = it.unit ? \` \${it.unit}\` : "";
          return name ? (qty ? \`\${name} (\${qty}\${unit})\` : name) : JSON.stringify(it);
        })
        .filter(Boolean)
        .join(", ") || "—"
    );
  }
  if (typeof value === "object") return JSON.stringify(value);

  const keyLower = String(key || "").toLowerCase();
  const isDateKey = keyLower.includes("date");
  if (isDateKey) {
    const formattedDate = formatDateToDDMMYYYY(value);
    if (formattedDate) return formattedDate;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\\d{4}-\\d{2}-\\d{2}(?:[T\\s].*)?$/.test(trimmed) || /^\\d{1,2}[-/]\\d{1,2}[-/]\\d{4}$/.test(trimmed)) {
      const formattedDate = formatDateToDDMMYYYY(trimmed);
      if (formattedDate) return formattedDate;
    }
  }

  return String(value);
}`
);

fs.writeFileSync('frontend/src/App.jsx', content, 'utf8');
console.log('All patches applied and frontend/src/App.jsx saved successfully!');

