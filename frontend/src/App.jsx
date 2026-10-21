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

function ProductRawMaterialsManager({
  value = [],
  selectedIds = [],
  rawMaterials = [],
  onChange,
  disabled = false,
  isLoading = false,
  error = "",
  onRetry,
  isWireHighlight = false,
  onAddNewRawMaterial,
  initialSelectedMaterialId,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [pendingMaterialId, setPendingMaterialId] = useState("");
  const [pendingQty, setPendingQty] = useState("");
  const [addError, setAddError] = useState("");
  const qtyInputRef = useRef(null);

  useEffect(() => {
    if (initialSelectedMaterialId) {
      const numId = Number(initialSelectedMaterialId);
      setPendingMaterialId(numId);
      setSearchTerm("");
      setPendingQty("1");
      setTimeout(() => {
        if (qtyInputRef.current) {
          qtyInputRef.current.focus();
          qtyInputRef.current.select();
        }
      }, 50);
    }
  }, [initialSelectedMaterialId]);

  const rawMaterialMap = useMemo(
    () => new Map((rawMaterials || []).map((rm) => [Number(rm.id), rm])),
    [rawMaterials]
  );

  // Normalize items: [{ raw_material_id, quantity, material_name, code, unit }]
  const items = useMemo(() => {
    const source =
      Array.isArray(value) && value.length > 0
        ? value
        : Array.isArray(selectedIds)
          ? selectedIds
          : [];

    return source
      .map((it) => {
        if (!it && it !== 0) return null;
        const id = typeof it === "object" ? Number(it.raw_material_id || it.id) : Number(it);
        if (!id) return null;
        const master = rawMaterialMap.get(id);
        const qty =
          typeof it === "object" && it.quantity !== undefined && it.quantity !== null && it.quantity !== ""
            ? it.quantity
            : 1;
        return {
          raw_material_id: id,
          quantity: qty,
          material_name: master?.material_name || (typeof it === "object" ? it.material_name : "") || `Raw Material #${id}`,
          code: master?.code || (typeof it === "object" ? it.code : "") || "",
          unit: master?.unit || (typeof it === "object" ? it.unit : "") || "",
          rate: master?.rate ?? (typeof it === "object" ? it.rate : undefined),
        };
      })
      .filter(Boolean);
  }, [value, selectedIds, rawMaterialMap]);

  const selectedPendingRm = useMemo(() => {
    if (!pendingMaterialId) return null;
    return rawMaterialMap.get(Number(pendingMaterialId));
  }, [pendingMaterialId, rawMaterialMap]);

  // Filter raw materials based on search term
  // Only show raw materials when searched, matching materials starting with the search query
  const filteredMaterials = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    let list = rawMaterials || [];
    if (!q) return [];
    return list.filter((rm) => {
      const name = String(rm.material_name || "").trim().toLowerCase();
      const code = String(rm.code || "").trim().toLowerCase();
      return name.startsWith(q) || (code && code.startsWith(q));
    });
  }, [searchTerm, rawMaterials]);

  const handleDeselectMaterial = () => {
    setPendingMaterialId("");
    setPendingQty("");
    setAddError("");
  };

  const handleSelectMaterial = (rmId) => {
    if (disabled) return;
    setAddError("");
    const numId = Number(rmId);

    // If already selected, clicking it again toggles/deselects it!
    if (Number(pendingMaterialId) === numId) {
      handleDeselectMaterial();
      return;
    }

    setPendingMaterialId(numId);

    const existing = items.find((it) => it.raw_material_id === numId);
    if (existing) {
      setPendingQty(String(existing.quantity));
    } else if (!pendingQty || parseFloat(pendingQty) <= 0) {
      setPendingQty("1");
    }

    setTimeout(() => {
      if (qtyInputRef.current) {
        qtyInputRef.current.focus();
        qtyInputRef.current.select();
      }
    }, 40);
  };

  const handleAddMoreRawMaterial = () => {
    setAddError("");
    if (disabled || !pendingMaterialId) {
      setAddError("Please select a raw material from the list below.");
      return;
    }
    const numId = Number(pendingMaterialId);
    const numQty = parseFloat(pendingQty);
    if (isNaN(numQty) || numQty <= 0) {
      setAddError("Please enter a valid quantity greater than 0.");
      qtyInputRef.current?.focus();
      return;
    }

    const existingIndex = items.findIndex((it) => it.raw_material_id === numId);
    let nextItems;
    if (existingIndex >= 0) {
      nextItems = items.map((it, idx) =>
        idx === existingIndex ? { ...it, quantity: numQty } : it
      );
    } else {
      const rm = rawMaterialMap.get(numId);
      nextItems = [
        ...items,
        {
          raw_material_id: numId,
          quantity: numQty,
          material_name: rm?.material_name || `Raw Material #${numId}`,
          code: rm?.code || "",
          unit: rm?.unit || "",
        },
      ];
    }
    onChange(nextItems);
    setPendingMaterialId("");
    setPendingQty("");
  };

  const handleItemQuantityChange = (id, newQty) => {
    if (disabled) return;
    const nextItems = items.map((it) => {
      if (it.raw_material_id === id) {
        return { ...it, quantity: newQty };
      }
      return it;
    });
    onChange(nextItems);
  };

  const handleRemoveItem = (id) => {
    if (disabled) return;
    const nextItems = items.filter((it) => it.raw_material_id !== id);
    onChange(nextItems);
    if (Number(pendingMaterialId) === Number(id)) {
      setPendingMaterialId("");
      setPendingQty("");
    }
  };

  return (
    <div className="product-raw-materials-manager">
      {/* 1. Added Raw Materials for this Element */}
      <div className="prm-added-section">
        <div className="prm-section-header">
          <span className="prm-section-title">
            Raw Materials in this Element ({items.length})
          </span>
          {items.length > 0 && !disabled && (
            <button
              type="button"
              className="prm-clear-btn"
              onClick={() => onChange([])}
            >
              Clear all
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="prm-empty-state">
            No raw materials added yet. Search or select a raw material from the list below, enter quantity, and click <strong>+ Add More {isWireHighlight ? "Wire" : "Raw Material"}</strong>.
          </div>
        ) : (
          <div className="prm-items-list">
            {items.map((item) => (
              <div key={item.raw_material_id} className="prm-item-card">
                <div className="prm-item-details">
                  <span className="prm-mat-name">{item.material_name}</span>
                  {item.code && <span className="prm-code-badge">[{item.code}]</span>}
                  {isWireHighlight &&
                    String(item.material_name || "").toLowerCase().includes("wire") && (
                      <span className="wire-badge">WIRE</span>
                    )}
                </div>

                <div className="prm-item-qty-box">
                  <label className="prm-qty-label">Quantity:</label>
                  <input
                    type="number"
                    min="0.0001"
                    step="any"
                    className="prm-item-qty-input"
                    value={item.quantity ?? ""}
                    onChange={(e) => handleItemQuantityChange(item.raw_material_id, e.target.value)}
                    placeholder="Qty"
                    disabled={disabled}
                    required
                  />
                  <span className="prm-unit-badge">{item.unit || "unit"}</span>
                </div>

                {!disabled && (
                  <button
                    type="button"
                    className="prm-remove-btn"
                    onClick={() => handleRemoveItem(item.raw_material_id)}
                    title={`Remove ${item.material_name}`}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. Search, Select Material from List Below, Set Quantity & Add More */}
      {!disabled && (
        <div className="prm-add-container">
          <div className="prm-add-header-row">
            <span className="prm-add-title">
              {isWireHighlight ? "Search & Select Wire:" : "Search & Select Raw Material:"}
            </span>
            {selectedPendingRm ? (
              <span className="prm-selected-pill">
                <span className="prm-selected-text">
                  Selected: <strong>{selectedPendingRm.material_name}</strong>
                  {selectedPendingRm.unit && ` (${selectedPendingRm.unit})`}
                </span>
                <button
                  type="button"
                  className="prm-deselect-btn"
                  onClick={handleDeselectMaterial}
                  title="Deselect this raw material"
                >
                  ✕ Deselect
                </button>
              </span>
            ) : (
              <span className="prm-select-hint">
                {searchTerm.trim()
                  ? "Click any raw material below to select it"
                  : "Search raw material to view and select"}
              </span>
            )}
          </div>

          {/* Action Row: Search bar + Quantity input + Add More button */}
          <div className="prm-control-bar">
            {/* Search Input */}
            <div className="prm-search-wrap">
              <span className="prm-search-icon" aria-hidden="true">🔍</span>
              <input
                type="text"
                className="prm-search-input"
                placeholder={isWireHighlight ? "Search wires starting with (e.g. 'W')..." : "Search raw materials starting with (e.g. 'W')..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={disabled || isLoading}
              />
              {searchTerm && (
                <button
                  type="button"
                  className="prm-clear-search-btn"
                  onClick={() => setSearchTerm("")}
                  title="Clear search"
                >
                  ×
                </button>
              )}
            </div>

            {/* Quantity Input for selected raw material */}
            <div className="prm-qty-input-wrap">
              <label className="prm-qty-field-label">Quantity:</label>
              <input
                ref={qtyInputRef}
                type="number"
                min="0.0001"
                step="any"
                className="prm-add-qty-field"
                placeholder="Qty"
                value={pendingQty}
                onChange={(e) => {
                  setPendingQty(e.target.value);
                  setAddError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddMoreRawMaterial();
                  }
                }}
                disabled={disabled || isLoading || !pendingMaterialId}
              />
              {selectedPendingRm?.unit ? (
                <span className="prm-add-unit-badge">{selectedPendingRm.unit}</span>
              ) : (
                <span className="prm-add-unit-badge-placeholder">unit</span>
              )}
            </div>

            {/* + Add More Raw Material Button */}
            <button
              type="button"
              className="prm-add-btn"
              disabled={disabled || !pendingMaterialId}
              onClick={handleAddMoreRawMaterial}
            >
              + Add More {isWireHighlight ? "Wire" : "Raw Material"}
            </button>
          </div>

          {addError && <span className="prm-add-error">{addError}</span>}
          {error && (
            <span className="prm-add-error">
              {error} {onRetry && <button type="button" onClick={onRetry}>Retry</button>}
            </span>
          )}

          {/* 3. Raw Materials List Below: Only shows when searched */}
          <div className="prm-list-container">
            <div className="prm-list-toolbar">
              <span className="prm-list-count">
                {searchTerm.trim() ? (
                  <>
                    Matching: <strong>{filteredMaterials.length}</strong> raw material{filteredMaterials.length === 1 ? "" : "s"}
                  </>
                ) : (
                  <>
                    Search Raw Materials ({rawMaterials.length} available)
                  </>
                )}
              </span>
              {searchTerm && (
                <button
                  type="button"
                  className="prm-show-all-btn"
                  onClick={() => setSearchTerm("")}
                >
                  Clear search
                </button>
              )}
            </div>

            <div className="prm-list-scroll">
              {isLoading ? (
                <div className="prm-list-loading">Loading raw materials…</div>
              ) : filteredMaterials.length === 0 ? (
                <div className="prm-list-empty">
                  {searchTerm.trim() ? (
                    <div className="prm-not-found-card">
                      <div className="prm-not-found-icon-wrap">
                        <span className="prm-not-found-icon">🔍</span>
                      </div>
                      <p className="prm-not-found-msg">
                        Raw material <strong>"{searchTerm.trim()}"</strong> is not present in inventory.
                      </p>
                      <div className="prm-not-found-prompt">
                        <span className="prm-not-found-q">Add the raw material?</span>
                        <button
                          type="button"
                          className="prm-not-found-yes-btn"
                          onClick={() => onAddNewRawMaterial && onAddNewRawMaterial(searchTerm.trim())}
                        >
                          + Yes, Add Raw Material
                        </button>
                      </div>
                      <button
                        type="button"
                        className="prm-clear-filter-link"
                        onClick={() => setSearchTerm("")}
                      >
                        Clear search
                      </button>
                    </div>
                  ) : (
                    <div className="prm-search-unsearched-prompt">
                      <span className="prm-search-unsearched-icon">🔍</span>
                      <p className="prm-search-unsearched-msg">
                        Please type in the search box above to find raw materials.
                      </p>
                      <span className="prm-search-unsearched-sub">
                        (e.g., search <strong>W</strong> for raw materials starting with <strong>W</strong>)
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                filteredMaterials.map((rm) => {
                  const isSelected = Number(pendingMaterialId) === Number(rm.id);
                  const addedItem = items.find((it) => it.raw_material_id === Number(rm.id));
                  const isWire = String(rm.material_name || "").toLowerCase().includes("wire");

                  return (
                    <div
                      key={rm.id}
                      className={`prm-row-card${isSelected ? " selected" : ""}${addedItem ? " already-added" : ""}`}
                      onClick={() => handleSelectMaterial(rm.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleSelectMaterial(rm.id);
                        }
                      }}
                    >
                      <div className="prm-row-radio">
                        <span className={`prm-radio-circle${isSelected ? " active" : ""}`} />
                      </div>

                      <div className="prm-row-content">
                        <span className="prm-row-name">{rm.material_name}</span>
                        {rm.code && <span className="prm-code-badge">[{rm.code}]</span>}
                        {isWireHighlight && isWire && <span className="wire-badge">WIRE</span>}
                      </div>

                      <div className="prm-row-meta">
                        {rm.unit && <span className="prm-meta-unit">{rm.unit}</span>}
                        {addedItem && (
                          <span className="prm-added-tag" title="Already added to this element">
                            ✓ Added ({addedItem.quantity} {addedItem.unit || rm.unit || ""})
                          </span>
                        )}
                        <span className={`prm-select-cta${isSelected ? " active" : ""}`}>
                          {isSelected ? "Selected ✓ (Click to deselect)" : "Select"}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const MultiRawMaterialPicker = ProductRawMaterialsManager;

function DailyInputItemPicker({
  rawMaterials = [],
  products = [],
  selectedType = "",
  selectedRawMaterialId = "",
  selectedProductId = "",
  onTypeChange,
  onSelect,
  onDeselect,
  onAddNewRawMaterial,
  onAddNewProduct,
  disabled = false,
  isLoading = false,
  error = "",
  onRetry,
  hasError = false,
}) {
  const [searchTerm, setSearchTerm] = useState("");

  // Normalize selectedType ("raw_material" | "product" | "")
  const currentType =
    selectedType === "product" || selectedType === "element"
      ? "product"
      : selectedType === "raw_material"
      ? "raw_material"
      : "";

  // Reset search term when the dropdown type changes
  useEffect(() => {
    setSearchTerm("");
  }, [currentType]);

  // Find currently selected item
  const selectedItem = useMemo(() => {
    if (currentType === "raw_material" && selectedRawMaterialId) {
      const rm = rawMaterials.find((m) => String(m.id) === String(selectedRawMaterialId));
      if (rm) return { ...rm, _itemType: "raw_material", _displayName: rm.material_name };
      return { id: selectedRawMaterialId, _displayName: `Raw Material #${selectedRawMaterialId}`, _itemType: "raw_material" };
    }
    if (currentType === "product" && selectedProductId) {
      const prd = products.find((p) => String(p.id) === String(selectedProductId));
      if (prd) return { ...prd, _itemType: "product", _displayName: prd.name };
      return { id: selectedProductId, _displayName: `Product #${selectedProductId}`, _itemType: "product" };
    }
    return null;
  }, [currentType, selectedRawMaterialId, selectedProductId, rawMaterials, products]);

  // Items list based strictly on the selected dropdown type
  const filteredItems = useMemo(() => {
    let list = [];
    if (currentType === "raw_material") {
      list = rawMaterials.map((rm) => ({
        id: rm.id,
        name: rm.material_name,
        code: rm.code,
        hsn_code: rm.hsn_code,
        unit: rm.unit,
        rate: rm.rate,
        _itemType: "raw_material",
        _orig: rm,
      }));
    } else if (currentType === "product") {
      list = products.map((p) => ({
        id: p.id,
        name: p.name,
        code: p.code,
        type: p.type,
        zach_code: p.zach_code,
        unit: "num",
        _itemType: "product",
        _orig: p,
      }));
    } else {
      return [];
    }

    const q = searchTerm.trim().toLowerCase();

    // Raw material: do not show raw material unless searched!
    // And only show raw materials starting with the search query (e.g. 'w')
    if (currentType === "raw_material") {
      if (!q) return [];
      return list.filter((item) => {
        const name = String(item.name || "").trim().toLowerCase();
        const code = String(item.code || "").trim().toLowerCase();
        return name.startsWith(q) || (code && code.startsWith(q));
      });
    }

    if (!q) return list;

    return list.filter((item) => {
      const name = String(item.name || "").toLowerCase();
      const code = String(item.code || "").toLowerCase();
      const hsn = String(item.hsn_code || "").toLowerCase();
      const zach = String(item.zach_code || "").toLowerCase();
      const subType = String(item.type || "").toLowerCase();
      return (
        name.includes(q) ||
        code.includes(q) ||
        hsn.includes(q) ||
        zach.includes(q) ||
        subType.includes(q)
      );
    });
  }, [rawMaterials, products, currentType, searchTerm]);

  const handleItemClick = (item) => {
    if (disabled || !item) return;
    onSelect({
      type: item._itemType,
      id: item.id,
      item: item._orig,
    });
  };

  return (
    <div className="di-picker-container">
      {/* 1. SHOW THE DROP DOWN FIRST: RAW MATERIAL OR PRODUCT */}
      <div className="di-type-dropdown-section">
        <label className="di-type-dropdown-label" htmlFor="di-type-dropdown-select">
          Select Item Type: <span className="di-select-only-one">Raw Material or Product</span> *
        </label>
        <div className="di-type-select-wrapper">
          <select
            id="di-type-dropdown-select"
            className="di-type-dropdown-select"
            value={currentType}
            onChange={(e) => {
              const val = e.target.value;
              if (onTypeChange) {
                onTypeChange(val);
              }
            }}
            disabled={disabled}
          >
            <option value="">-- Select Raw Material or Product --</option>
            <option value="raw_material">Raw Material</option>
            <option value="product">Product</option>
          </select>
        </div>
      </div>

      {/* 2. AND THEN SHOW THE BOX */}
      <div className={`di-box ${hasError && !selectedItem ? "di-box-error" : ""}`}>
        {!currentType ? (
          <div className="di-box-empty-prompt">
            <span className="di-box-empty-icon">👆</span>
            <p className="di-box-empty-text">
              Please select <strong>Raw Material</strong> or <strong>Product</strong> from the dropdown above to search items.
            </p>
          </div>
        ) : (
          <>
            {/* Box Header with Selected Item Pill or Instruction */}
            <div className="di-picker-header">
              <span className="di-picker-title">
                {currentType === "raw_material" ? "Raw Material Selection" : "Product Selection"}{" "}
                <span className="di-picker-subtext">
                  {currentType === "raw_material"
                    ? searchTerm.trim()
                      ? `(${filteredItems.length} matching of ${rawMaterials.length})`
                      : `(${rawMaterials.length} available)`
                    : `(${(products || []).length} available)`}
                </span>
              </span>

              {selectedItem ? (
                <div className="di-selected-pill">
                  <span
                    className={`di-type-badge ${
                      selectedItem._itemType === "raw_material" ? "type-rm" : "type-prd"
                    }`}
                  >
                    ✓ {selectedItem._itemType === "raw_material" ? "RAW MATERIAL SELECTED" : "PRODUCT SELECTED"}
                  </span>
                  <span className="di-selected-name">
                    <strong>{selectedItem._displayName}</strong>
                    {selectedItem.code && ` [${selectedItem.code}]`}
                    {selectedItem.unit && ` (${selectedItem.unit})`}
                    {selectedItem.type && ` • ${selectedItem.type}`}
                    {selectedItem.rate !== undefined && selectedItem.rate !== null && selectedItem.rate !== "" && ` • Rate: ₹${selectedItem.rate}`}
                  </span>
                  <button
                    type="button"
                    className="di-deselect-btn"
                    onClick={onDeselect}
                    title="Change or deselect this item"
                    disabled={disabled}
                  >
                    ✕ Change
                  </button>
                </div>
              ) : (
                <div className="di-unselected-warning">
                  <span className="di-warn-icon">👉</span>
                  <span>
                    {currentType === "raw_material" && !searchTerm.trim() ? (
                      <>Please search for a <strong>Raw Material</strong> in the search box below *</>
                    ) : (
                      <>Please click to select a <strong>{currentType === "raw_material" ? "Raw Material" : "Product"}</strong> from the list below *</>
                    )}
                  </span>
                </div>
              )}
            </div>

            {/* Search Input Bar & Items List (only when no item is currently selected) */}
            {!selectedItem && (
              <>
                <div className="di-control-bar">
                  <div className="di-search-wrap">
                    <span className="di-search-icon" aria-hidden="true">🔍</span>
                    <input
                      type="text"
                      className="di-search-input"
                      placeholder={
                        currentType === "raw_material"
                          ? "Search raw material starting with (e.g. 'W')... (Press Enter to select)"
                          : "Search product by name, code, Zach code, type... (Press Enter to select)"
                      }
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          e.stopPropagation();
                          if (filteredItems.length > 0) {
                            handleItemClick(filteredItems[0]);
                          }
                        }
                      }}
                      onBlur={() => {
                        if (!selectedItem && searchTerm.trim() && filteredItems.length === 1) {
                          handleItemClick(filteredItems[0]);
                        }
                      }}
                      disabled={disabled || isLoading}
                    />
                    {searchTerm && (
                      <button
                        type="button"
                        className="di-clear-search-btn"
                        onClick={() => setSearchTerm("")}
                        title="Clear search"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>

                {error && (
                  <div className="di-picker-error">
                    {error} {onRetry && <button type="button" onClick={onRetry}>Retry</button>}
                  </div>
                )}

                {/* Items List */}
                <div className="di-list-container">
                  <div className="di-list-scroll">
                    {isLoading ? (
                      <div className="di-list-loading">
                        Loading {currentType === "raw_material" ? "raw materials" : "products"}…
                      </div>
                    ) : filteredItems.length === 0 ? (
                      <div className="di-list-empty">
                        {searchTerm.trim() ? (
                          <div className="di-not-found-card">
                            <div className="di-not-found-icon-wrap">
                              <span className="di-not-found-icon">🔍</span>
                            </div>
                            <p className="di-not-found-msg">
                              <strong>"{searchTerm.trim()}"</strong> does not exist in {currentType === "raw_material" ? "Raw Materials" : "Products"}.
                            </p>
                            <div className="di-not-found-prompt">
                              <span className="di-not-found-q">Want to add?</span>
                              <div className="di-not-found-actions">
                                {currentType === "raw_material" ? (
                                  <button
                                    type="button"
                                    className="di-add-btn-rm"
                                    onClick={() => onAddNewRawMaterial && onAddNewRawMaterial(searchTerm.trim())}
                                  >
                                    + Add Raw Material
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className="di-add-btn-prd"
                                    onClick={() => onAddNewProduct && onAddNewProduct(searchTerm.trim())}
                                  >
                                    + Add Product
                                  </button>
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              className="di-clear-filter-link"
                              onClick={() => setSearchTerm("")}
                            >
                              Clear search
                            </button>
                          </div>
                        ) : (
                          <div className="di-empty-prompt">
                            {currentType === "raw_material" ? (
                              <div className="di-unsearched-prompt">
                                <span className="di-unsearched-icon">🔍</span>
                                <p className="di-unsearched-msg">
                                  Please type in the search box above to find raw materials.
                                </p>
                                <span className="di-unsearched-sub">
                                  (e.g., search <strong>W</strong> for raw materials starting with <strong>W</strong>)
                                </span>
                              </div>
                            ) : (
                              "No products available."
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      filteredItems.map((item) => {
                        const isSelected =
                          selectedItem &&
                          selectedItem._itemType === item._itemType &&
                          String(selectedItem.id) === String(item.id);

                        return (
                          <div
                            key={`${item._itemType}-${item.id}`}
                            className={`di-item-row ${isSelected ? "selected" : ""} ${
                              item._itemType === "raw_material" ? "row-rm" : "row-prd"
                            }`}
                            onClick={() => handleItemClick(item)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                handleItemClick(item);
                              }
                            }}
                          >
                            <div className="di-row-radio">
                              <span className={`di-radio-circle ${isSelected ? "active" : ""}`} />
                            </div>

                            <span
                              className={`di-type-tag ${
                                item._itemType === "raw_material" ? "tag-rm" : "tag-prd"
                              }`}
                            >
                              {item._itemType === "raw_material" ? "RAW MATERIAL" : "PRODUCT"}
                            </span>

                            <div className="di-item-info">
                              <span className="di-item-name">{item.name}</span>
                              {item.code && <span className="di-item-code">[{item.code}]</span>}
                              {item.zach_code && <span className="di-item-zach">Zach: {item.zach_code}</span>}
                              {item.type && <span className="di-item-subtype">({item.type})</span>}
                            </div>

                            <div className="di-item-meta">
                              {item._itemType === "raw_material" && (
                                <>
                                  {item.unit && <span className="di-meta-pill">Unit: {item.unit}</span>}
                                  {item.rate !== undefined && item.rate !== null && item.rate !== "" && (
                                    <span className="di-meta-pill">Rate: ₹{item.rate}</span>
                                  )}
                                </>
                              )}
                              <span className={`di-select-cta ${isSelected ? "active" : ""}`}>
                                {isSelected ? "Selected ✓" : "Select →"}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Workspace({ user, onLogout }) {
  const availableNavigation = useMemo(() => {
    return navigation
      .map((item) => {
        if (item.children) {
          const visibleChildren = item.children.filter((child) => {
            if (child.adminOnly && user.role !== "admin") return false;
            return !child.roles || child.roles.includes(user.role);
          });
          if (visibleChildren.length === 0) return null;
          return {
            ...item,
            children: visibleChildren,
          };
        }
        if (item.adminOnly && user.role !== "admin") return false;
        return !item.roles || item.roles.includes(user.role) ? item : null;
      })
      .filter(Boolean);
  }, [user.role]);

  const flatNavigation = useMemo(() => {
    const list = [];
    availableNavigation.forEach((item) => {
      if (item.children) {
        item.children.forEach((c) => list.push(c));
      } else {
        list.push(item);
      }
    });
    return list;
  }, [availableNavigation]);

  const [openDropdowns, setOpenDropdowns] = useState({
    staff: true,
    masterFiles: true,
    parties: true,
  });

  const toggleDropdown = (groupId) => {
    setOpenDropdowns((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const [activeSection, setActiveSection] = useState("dashboard");

  useEffect(() => {
    const parentGroup = availableNavigation.find(
      (item) => item.children && item.children.some((child) => child.id === activeSection)
    );
    if (parentGroup) {
      setOpenDropdowns((prev) => (prev[parentGroup.id] ? prev : { ...prev, [parentGroup.id]: true }));
    }
  }, [activeSection, availableNavigation]);
  const [requestVersion, setRequestVersion] = useState(0);
  const [records, setRecords] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [csvSearchTerm, setCsvSearchTerm] = useState("");
  const [csvBillDateFrom, setCsvBillDateFrom] = useState("");
  const [csvBillDateTo, setCsvBillDateTo] = useState("");
  const [csvSelectedIds, setCsvSelectedIds] = useState([]);
  const [csvSelectedColumns, setCsvSelectedColumns] = useState([]);
  const [csvValueFilters, setCsvValueFilters] = useState({});
  const [csvFilterFieldToAdd, setCsvFilterFieldToAdd] = useState("");
  const [csvFilterOptionSearch, setCsvFilterOptionSearch] = useState({});
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [csvPreview, setCsvPreview] = useState(null);
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
    products: [],
  });
  
  const [lookupLoading, setLookupLoading] = useState({
    suppliers: false,
    customers: false,
    rawMaterials: false,
    products: false,
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
  const [productSaveConfirm, setProductSaveConfirm] = useState(null);
  const [quickAddRawMaterialModal, setQuickAddRawMaterialModal] = useState(null);
  const [isSavingQuickRm, setIsSavingQuickRm] = useState(false);
  const [quickRmError, setQuickRmError] = useState("");
  const [justCreatedRmId, setJustCreatedRmId] = useState(null);

  function handleOpenQuickAddRawMaterial(searchedName) {
    setPageError("");
    setQuickRmError("");
    setQuickAddRawMaterialModal({
      material_name: searchedName || "",
      hsn_code: "",
      unit: "num",
      rate: "",
      discount_percent: 0,
      cgst_percent: 0,
      ut_sgst_percent: 0,
      igst_percent: 0,
    });
  }

  async function handleSaveQuickRawMaterial(event) {
    event.preventDefault();
    setQuickRmError("");

    const name = String(quickAddRawMaterialModal?.material_name || "").trim();
    if (!name) {
      setQuickRmError("Material name is required.");
      return;
    }

    setIsSavingQuickRm(true);

    const payload = {
      material_name: name,
      hsn_code: quickAddRawMaterialModal.hsn_code ? String(quickAddRawMaterialModal.hsn_code).trim() : null,
      unit: quickAddRawMaterialModal.unit || "num",
      rate: quickAddRawMaterialModal.rate !== "" && quickAddRawMaterialModal.rate !== null ? Number(quickAddRawMaterialModal.rate) : 0,
      discount_percent: quickAddRawMaterialModal.discount_percent !== "" && quickAddRawMaterialModal.discount_percent !== null ? Number(quickAddRawMaterialModal.discount_percent) : 0,
      cgst_percent: quickAddRawMaterialModal.cgst_percent !== "" && quickAddRawMaterialModal.cgst_percent !== null ? Number(quickAddRawMaterialModal.cgst_percent) : 0,
      ut_sgst_percent: quickAddRawMaterialModal.ut_sgst_percent !== "" && quickAddRawMaterialModal.ut_sgst_percent !== null ? Number(quickAddRawMaterialModal.ut_sgst_percent) : 0,
      igst_percent: quickAddRawMaterialModal.igst_percent !== "" && quickAddRawMaterialModal.igst_percent !== null ? Number(quickAddRawMaterialModal.igst_percent) : 0,
    };

    try {
      const result = await window.desktop.createWorkspaceRecord("rawMaterials", payload);
      if (!result.ok) {
        setQuickRmError(typeof result.error === "string" ? result.error : "Failed to create raw material.");
        setIsSavingQuickRm(false);
        return;
      }

      const newRm = result.data;
      setLookupOptions((prev) => ({
        ...prev,
        rawMaterials: [...(prev.rawMaterials || []).filter((rm) => String(rm.id) !== String(newRm.id)), newRm],
      }));

      setDashboardCounts((current) => ({
        ...current,
        rawMaterials: (current.rawMaterials || 0) + 1,
      }));

      if (activeSection === "dailyInputs") {
        handleDailyInputItemSelect({ type: "raw_material", id: newRm.id, item: newRm });
      } else {
        setJustCreatedRmId(newRm.id);
      }
      setNotice(`Raw material "${newRm.material_name}" created successfully and selected!`);
      setQuickAddRawMaterialModal(null);
    } catch (err) {
      setQuickRmError(err?.message || "Failed to create raw material.");
    } finally {
      setIsSavingQuickRm(false);
    }
  }

  const [quickAddProductModal, setQuickAddProductModal] = useState(null);
  const [isSavingQuickPrd, setIsSavingQuickPrd] = useState(false);
  const [quickPrdError, setQuickPrdError] = useState("");

  function handleOpenQuickAddProduct(searchedName) {
    setPageError("");
    setQuickPrdError("");
    setQuickAddProductModal({
      name: searchedName || "",
      product_mode: "without_zach_code",
      type: "element",
      zach_code: "",
      element_id: "",
      welded_element_id: "",
      raw_materials: [],
    });
  }

  async function handleSaveQuickProduct(event) {
    event.preventDefault();
    setQuickPrdError("");

    const name = String(quickAddProductModal?.name || "").trim();
    if (!name) {
      setQuickPrdError("Product name is required.");
      return;
    }

    const mode = quickAddProductModal.product_mode || "without_zach_code";
    const type = quickAddProductModal.type || "element";

    const payload = {
      name,
      type,
    };

    if (mode === "with_zach_code") {
      const zc = String(quickAddProductModal.zach_code || "").trim();
      if (!zc) {
        setQuickPrdError("Zach code is required when 'with zach code' is selected.");
        return;
      }
      payload.has_zach_code = true;
      payload.zach_code = zc;
    } else {
      payload.has_zach_code = false;
      payload.zach_code = null;

      if (type === "welded element") {
        if (!quickAddProductModal.element_id) {
          setQuickPrdError("Please select an element for the welded element.");
          return;
        }
        payload.element_id = Number(quickAddProductModal.element_id);
      } else if (type === "capacitor") {
        if (!quickAddProductModal.welded_element_id) {
          setQuickPrdError("Please select a welded element for the capacitor.");
          return;
        }
        payload.welded_element_id = Number(quickAddProductModal.welded_element_id);
      }
    }

    if (quickAddProductModal.raw_materials && quickAddProductModal.raw_materials.length > 0) {
      payload.raw_materials = quickAddProductModal.raw_materials.map((it) => ({
        raw_material_id: Number(it.raw_material_id || it.id),
        quantity: it.quantity ? Number(it.quantity) : 1,
      }));
      payload.raw_material_ids = payload.raw_materials.map((it) => it.raw_material_id);
      payload.raw_material_id = payload.raw_material_ids[0];
    }

    setIsSavingQuickPrd(true);
    try {
      const result = await window.desktop.createWorkspaceRecord("products", payload);
      if (!result.ok) {
        setQuickPrdError(typeof result.error === "string" ? result.error : "Failed to create product.");
        setIsSavingQuickPrd(false);
        return;
      }

      const newPrd = result.data;
      setLookupOptions((prev) => ({
        ...prev,
        products: [...(prev.products || []).filter((p) => String(p.id) !== String(newPrd.id)), newPrd],
      }));

      setDashboardCounts((current) => ({
        ...current,
        products: (current.products || 0) + 1,
      }));

      if (activeSection === "dailyInputs") {
        handleDailyInputItemSelect({ type: "product", id: newPrd.id, item: newPrd });
      }

      setNotice(`Product "${newPrd.name}" created successfully and selected!`);
      setQuickAddProductModal(null);
    } catch (err) {
      setQuickPrdError(err?.message || "Failed to create product.");
    } finally {
      setIsSavingQuickPrd(false);
    }
  }

  function handleDailyInputTypeChange(newType) {
    setFormType(newType);
    setFormValues((prev) => ({
      ...prev,
      type: newType,
      raw_material_id: "",
      product_id: "",
      element_id: "",
      item: "",
      unit: newType === "product" ? "num" : "",
      hsn_code: "",
      rate: "",
      discount_percent: 0,
      cgst_percent: 0,
      ut_sgst_percent: 0,
      igst_percent: 0,
      amount: 0,
      cgst_amount: 0,
      ut_sgst_amount: 0,
      igst_amount: 0,
      total_amount: 0,
    }));
  }

  function handleDailyInputItemSelect({ type, id, item }) {
    setPageError("");
    if (type === "raw_material") {
      const selectedRm =
        (lookupOptions.rawMaterials || []).find((m) => String(m.id) === String(id)) || item;
      const validRmId = Number(id || selectedRm?.id || item?.id);
      setFormType("raw_material");
      setFormValues((prev) => {
        const next = {
          ...prev,
          type: "raw_material",
          raw_material_id: validRmId,
          product_id: "",
          element_id: "",
          customer_id: "",
          item: selectedRm?.material_name || item?.material_name || item?.name || prev.item || "",
          unit: selectedRm?.unit ?? item?.unit ?? prev.unit ?? "",
          hsn_code: selectedRm?.hsn_code ?? item?.hsn_code ?? prev.hsn_code ?? "",
          rate: (selectedRm?.rate !== undefined && selectedRm?.rate !== null && selectedRm?.rate !== "") ? selectedRm.rate : prev.rate,
          discount_percent: (selectedRm?.discount_percent !== undefined && selectedRm?.discount_percent !== null) ? selectedRm.discount_percent : (prev.discount_percent || 0),
          cgst_percent: (selectedRm?.cgst_percent !== undefined && selectedRm?.cgst_percent !== null) ? selectedRm.cgst_percent : (prev.cgst_percent || 0),
          ut_sgst_percent: (selectedRm?.ut_sgst_percent !== undefined && selectedRm?.ut_sgst_percent !== null) ? selectedRm.ut_sgst_percent : (prev.ut_sgst_percent || 0),
          igst_percent: (selectedRm?.igst_percent !== undefined && selectedRm?.igst_percent !== null) ? selectedRm.igst_percent : (prev.igst_percent || 0),
        };

        const quantity = Number(next.quantity) || 0;
        const rate = Number(next.rate) || 0;
        const discountPercent = Number(next.discount_percent) || 0;
        const grossAmount = quantity * rate;
        const discountAmount = (grossAmount * discountPercent) / 100;
        next.amount = Number((grossAmount - discountAmount).toFixed(2));

        const cgstPercent = Number(next.cgst_percent) || 0;
        const utSgstPercent = Number(next.ut_sgst_percent) || 0;
        const igstPercent = Number(next.igst_percent) || 0;

        next.cgst_amount = Number(((next.amount * cgstPercent) / 100).toFixed(2));
        next.ut_sgst_amount = Number(((next.amount * utSgstPercent) / 100).toFixed(2));
        next.igst_amount = Number(((next.amount * igstPercent) / 100).toFixed(2));
        next.total_amount = Number((next.amount + next.cgst_amount + next.ut_sgst_amount + next.igst_amount).toFixed(2));

        return next;
      });
    } else if (type === "product") {
      const selectedPrd =
        (lookupOptions.products || []).find((p) => String(p.id) === String(id)) || item;
      const validPrdId = Number(id || selectedPrd?.id || item?.id);
      setFormType("product");
      setFormValues((prev) => ({
        ...prev,
        type: "product",
        product_id: validPrdId,
        element_id: validPrdId,
        raw_material_id: "",
        item: selectedPrd?.name || item?.name || prev.item || "",
        unit: prev.unit || "num",
      }));
    }
  }

  function handleDailyInputItemDeselect() {
    setFormValues((prev) => ({
      ...prev,
      raw_material_id: "",
      product_id: "",
      element_id: "",
      item: "",
      unit: prev.type === "product" ? "num" : "",
      hsn_code: "",
      rate: "",
      discount_percent: 0,
      cgst_percent: 0,
      ut_sgst_percent: 0,
      igst_percent: 0,
      amount: 0,
      cgst_amount: 0,
      ut_sgst_amount: 0,
      igst_amount: 0,
      total_amount: 0,
    }));
  }

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
    discount_percent: rawMaterial.discount_percent ?? 0,
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

      if (activeSection === "costData") {
        if (value === "Basic") {
          next.wound_cap_element_value = "";
          next.pp_film_width = "";
          next.pp_film_thickness = "";
        } else if (value === "Element") {
          next.wound_cap_basic_value = "";
          next.mpp_film_width = "";
          next.mpp_film_thickness = "";
        }
      } else if (activeSection === "products") {
        if (value === "element") {
          next.element_id = "";
          next.welded_element_id = "";
        } else if (value === "welded element") {
          next.welded_element_id = "";
        } else if (value === "capacitor") {
          next.element_id = "";
        }
      } else {
        if (value === "raw_material") {
          next.product_id = "";
          next.element_id = "";
          next.customer_id = "";
        } else if (value === "product" || value === "element") {
          next.raw_material_id = "";
        } else if (value === "other") {
          next.raw_material_id = "";
          next.product_id = "";
          next.element_id = "";
          next.supplier_id = "";
          next.customer_id = "";
        } else if (!value) {
          next.raw_material_id = "";
          next.product_id = "";
          next.element_id = "";
          next.supplier_id = "";
          next.customer_id = "";
        }
      }
    }

    if (name === "product_mode") {
      if (value === "with_zach_code") {
        next.element_id = "";
        next.welded_element_id = "";
      } else if (value === "without_zach_code") {
        next.zach_code = "";
      }
    }

    if (name === "raw_materials" || name === "raw_material_ids") {
      if (Array.isArray(value)) {
        if (value.length === 0) {
          next.raw_materials = [];
          next.raw_material_ids = [];
        } else if (typeof value[0] === "object") {
          next.raw_materials = value;
          next.raw_material_ids = value.map((it) => Number(it.raw_material_id || it.id));
        } else {
          next.raw_material_ids = value.map(Number);
          next.raw_materials = value.map((id) => {
            const existing = (current.raw_materials || []).find(
              (it) => Number(it.raw_material_id || it.id) === Number(id)
            );
            return existing || { raw_material_id: Number(id), quantity: 1 };
          });
        }
      }
    }

    // Auto-populate all master fields when raw_material_id is selected
    if (name === "raw_material_id") {
      const selectedRm = lookupOptions.rawMaterials?.find(
        (m) => String(m.id) === String(value)
      );
      if (selectedRm) {
        next.item = selectedRm.material_name || "";
        next.unit = selectedRm.unit ?? "";
        next.hsn_code = selectedRm.hsn_code ?? "";
        if (
          selectedRm.rate !== undefined &&
          selectedRm.rate !== null &&
          selectedRm.rate !== ""
        ) {
          next.rate = selectedRm.rate;
        }
        if (
          selectedRm.discount_percent !== undefined &&
          selectedRm.discount_percent !== null
        ) {
          next.discount_percent = selectedRm.discount_percent;
        }
        if (
          selectedRm.cgst_percent !== undefined &&
          selectedRm.cgst_percent !== null
        ) {
          next.cgst_percent = selectedRm.cgst_percent;
        }
        if (
          selectedRm.ut_sgst_percent !== undefined &&
          selectedRm.ut_sgst_percent !== null
        ) {
          next.ut_sgst_percent = selectedRm.ut_sgst_percent;
        }
        if (
          selectedRm.igst_percent !== undefined &&
          selectedRm.igst_percent !== null
        ) {
          next.igst_percent = selectedRm.igst_percent;
        }
      } else if (!value) {
        next.item = "";
        next.unit = "";
        next.hsn_code = "";
        next.rate = "";
        next.discount_percent = 0;
        next.cgst_percent = 0;
        next.ut_sgst_percent = 0;
        next.igst_percent = 0;
      }
    }

    // Auto-populate item name when product_id is selected
    if (name === "product_id" || name === "element_id") {
      const selectedPrd = lookupOptions.products?.find(
        (e) => String(e.id) === String(value)
      );
      if (selectedPrd) {
        next.item = selectedPrd.name || "";
      } else if (!value) {
        next.item = "";
      }
    }

    // Calculate Amount = (Quantity × Rate) - Discount Amount
    if (
      [
        "quantity",
        "rate",
        "discount_percent",
        "raw_material_id",
        "product_id",
        "element_id",
      ].includes(name)
    ) {
      const quantity = Number(next.quantity) || 0;
      const rate = Number(next.rate) || 0;
      const discountPercent = Number(next.discount_percent) || 0;

      const grossAmount = quantity * rate;
      const discountAmount = (grossAmount * discountPercent) / 100;
      next.amount = Number((grossAmount - discountAmount).toFixed(2));
    }

    // Calculate GST amounts and Total Amount on the discounted Amount
    if (
      [
        "quantity",
        "rate",
        "amount",
        "discount_percent",
        "cgst_percent",
        "ut_sgst_percent",
        "igst_percent",
        "raw_material_id",
        "product_id",
        "element_id",
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
      emptyValues[field.name] = field.type === "multiRawMaterial" || field.name === "raw_material_ids" || field.name === "raw_materials"
        ? []
        : (field.defaultValue ?? "");
    }
    if (activeSection === "products") {
      emptyValues.product_mode = "without_zach_code";
      emptyValues.zach_code = "";
      emptyValues.raw_materials = [];
      emptyValues.raw_material_ids = [];
    }
    if (activeSection === "dailyInputs") {
      emptyValues.type = "";
      emptyValues.raw_material_id = "";
      emptyValues.product_id = "";
      emptyValues.element_id = "";
    }
    setFormValues(emptyValues);
    setFormType(activeSection === "costData" ? "Basic" : activeSection === "products" ? "element" : "");
    setPageError("");
    setNotice("");
    setProductSaveConfirm(null);
  }

  function navigateToSection(section) {
    setActiveSection(section);
    setRequestVersion((version) => version + 1);
    setIsFormOpen(false);
    setEditingRecord(null);
    setFormValues({});
    setProductSaveConfirm(null);
    setFormType(section === "costData" ? "Basic" : section === "products" ? "element" : "raw_material");
    setSearchTerm("");
    setFilters([]);
    setFilterField("");
    setFilterValue("");
    setSelectedIds([]);
    setIsCsvModalOpen(false);
    setCsvSearchTerm("");
    setCsvBillDateFrom("");
    setCsvBillDateTo("");
    setCsvSelectedIds([]);
    setCsvSelectedColumns([]);
    setCsvValueFilters({});
    setCsvFilterFieldToAdd("");
    setCsvFilterOptionSearch({});
    setCsvPreview(null);
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
      ? ["customers", "suppliers", "rawMaterials", "products"]
      : activeSection === "products"
      ? ["rawMaterials", "products"]
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
      "product_id",
      "element_id",
      "welded_element_id",
      "user_id",
      "amount",
      "cgst_amount",
      "ut_sgst_amount",
      "igst_amount",
      "total_amount",
      "rate",
      "discount_percent",
      "cgst_percent",
      "ut_sgst_percent",
      "igst_percent",
      "wound_cap_basic_value",
      "mpp_film_width",
      "mpp_film_thickness",
      "core_od",
      "film_free_margin",
      "winding_stagger",
      "wound_capacitor_od",
      "turns_to_be_wound",
      "active_width",
      "band_length",
      "wt_of_capacitor",
      "wound_cap_element_value",
      "pp_film_width",
      "pp_film_thickness",
    ];

    for (const [key, value] of Object.entries(formValues)) {
      if (value === "" || value === null || value === undefined) {
        if (editingRecord && key !== "password") {
          record[key] = null;
        }
        continue;
      }

      if (key === "raw_material_ids") {
        const ids = (Array.isArray(value) ? value : [value])
          .map(Number)
          .filter((n) => Number.isInteger(n) && n > 0);
        record.raw_material_ids = ids;
        record.raw_material_id = ids.length > 0 ? ids[0] : null;
      } else if (key === "raw_materials") {
        const items = (Array.isArray(value) ? value : [])
          .filter((it) => it && (it.raw_material_id || it.id))
          .map((it) => ({
            raw_material_id: Number(it.raw_material_id || it.id),
            quantity:
              it.quantity !== "" && it.quantity !== null && it.quantity !== undefined
                ? Number(it.quantity)
                : 1,
          }));
        record.raw_materials = items;
        const ids = items.map((it) => it.raw_material_id);
        record.raw_material_ids = ids;
        record.raw_material_id = ids.length > 0 ? ids[0] : null;
      } else if (numericFields.includes(key)) {
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

    // Only send fields that belong to the active section form.
    const sectionFields = (
      (editingRecord ? activeConfig.updateFields : activeConfig.fields) || []
    ).map((field) => field.name);
    const sectionAllowedFields = new Set([
      ...sectionFields,
      ...(activeSection === "products" ? ["zach_code", "has_zach_code", "raw_material_id", "raw_material_ids", "raw_materials", "element_id", "welded_element_id"] : []),
      ...(activeSection === "dailyInputs"
        ? [
            "type",
            "raw_material_id",
            "product_id",
            "element_id",
            "customer_id",
            "supplier_id",
            "dc_no",
            "dc_date",
            "DC_no",
            "DC_date",
            "bill_no",
            "bill_date",
            "item",
            "quantity",
            "user_id",
            "unit",
            "rate",
            "discount_percent",
            "amount",
            "cgst_percent",
            "ut_sgst_percent",
            "igst_percent",
            "cgst_amount",
            "ut_sgst_amount",
            "igst_amount",
            "total_amount",
            "other_details",
            "remarks",
            "material_name",
            "hsn_code",
            "supplier_company_name",
            "supplier_contact_person",
            "supplier_email",
            "supplier_phone",
            "supplier_address",
            "supplier_city",
            "supplier_state",
            "supplier_gst_number",
          ]
        : []),
    ]);
    for (const key of Object.keys(record)) {
      if (!sectionAllowedFields.has(key)) {
        delete record[key];
      }
    }

    // --------------------------------------------------
    // Prepare Products payload
    // --------------------------------------------------
    if (activeSection === "products") {
      const isWithZach =
        formValues.product_mode === "with_zach_code" ||
        (!formValues.product_mode && (editingRecord?.has_zach_code || Boolean(editingRecord?.zach_code)));

      const typeVal = formValues.type || (editingRecord ? editingRecord.type : "element");
      record.type = typeVal;

      if (isWithZach) {
        const zachCodeVal = (formValues.zach_code ?? (editingRecord ? editingRecord.zach_code : "") ?? "").trim();
        if (!zachCodeVal) {
          setPageError("Zach Code is required when 'with zach code' is selected.");
          setIsSaving(false);
          return;
        }
        record.has_zach_code = true;
        record.zach_code = zachCodeVal;
        record.element_id = null;
        record.welded_element_id = null;
      } else {
        record.has_zach_code = false;
        record.zach_code = null;

        if (typeVal === "element") {
          record.element_id = null;
          record.welded_element_id = null;
        } else if (typeVal === "welded element") {
          record.welded_element_id = null;
          const elId = formValues.element_id !== undefined && formValues.element_id !== ""
            ? formValues.element_id
            : (editingRecord ? editingRecord.element_id : null);
          if (!elId) {
            setPageError("Please select an element for the welded element.");
            setIsSaving(false);
            return;
          }
          record.element_id = Number(elId);
        } else if (typeVal === "capacitor") {
          record.element_id = null;
          const weId = formValues.welded_element_id !== undefined && formValues.welded_element_id !== ""
            ? formValues.welded_element_id
            : (editingRecord ? editingRecord.welded_element_id : null);
          if (!weId) {
            setPageError("Please select a welded element for the capacitor.");
            setIsSaving(false);
            return;
          }
          record.welded_element_id = Number(weId);
        }
      }

      if (formValues.raw_materials) {
        record.raw_materials = (Array.isArray(formValues.raw_materials) ? formValues.raw_materials : [])
          .filter((it) => it && (it.raw_material_id || it.id))
          .map((it) => ({
            raw_material_id: Number(it.raw_material_id || it.id),
            quantity:
              it.quantity !== "" && it.quantity !== null && it.quantity !== undefined
                ? Number(it.quantity)
                : 1,
          }));
        record.raw_material_ids = record.raw_materials.map((it) => it.raw_material_id);
        if (record.raw_material_ids.length > 0) {
          record.raw_material_id = record.raw_material_ids[0];
        }
      }
    }

    // --------------------------------------------------
    // Prepare Cost Data payload
    // --------------------------------------------------
    if (activeSection === "costData") {
      const typeVal = formValues.type || (editingRecord ? editingRecord.type : "Basic");
      record.type = typeVal;

      if (typeVal === "Basic") {
        record.wound_cap_element_value = null;
        record.pp_film_width = null;
        record.pp_film_thickness = null;
      } else if (typeVal === "Element") {
        record.wound_cap_basic_value = null;
        record.mpp_film_width = null;
        record.mpp_film_thickness = null;
      }
    }

    // --------------------------------------------------
    // 2. Prepare Daily Inputs payload
    // --------------------------------------------------
    if (activeSection === "dailyInputs") {
      const typeVal = formValues.type || (editingRecord ? editingRecord.type : null);
      if (!typeVal) {
        setPageError("Please select Item Type: Raw Material or Product first.");
        setIsSaving(false);
        return;
      }
      record.type = typeVal;

      if (typeVal === "raw_material") {
        let rmId =
          formValues.raw_material_id !== undefined &&
          formValues.raw_material_id !== "" &&
          formValues.raw_material_id !== null
            ? formValues.raw_material_id
            : (editingRecord ? editingRecord.raw_material_id : null);
        if (!rmId || Number(rmId) <= 0) {
          const rawItemName = formValues.item || formValues.material_name || editingRecord?.item;
          if (rawItemName) {
            const matched = (lookupOptions.rawMaterials || []).find(
              (m) => String(m.material_name || "").trim().toLowerCase() === String(rawItemName).trim().toLowerCase()
            );
            if (matched) {
              rmId = matched.id;
            }
          }
        }
        if (!rmId || Number(rmId) <= 0) {
          setPageError("Please click and select a specific raw material from the list below.");
          setIsSaving(false);
          return;
        }
        record.type = "raw_material";
        record.raw_material_id = Number(rmId);
        record.product_id = null;
        record.element_id = null;
        record.customer_id = null;
      } else if (typeVal === "product" || typeVal === "element") {
        let prdId =
          formValues.product_id !== undefined &&
          formValues.product_id !== "" &&
          formValues.product_id !== null
            ? formValues.product_id
            : (formValues.element_id !== undefined &&
               formValues.element_id !== "" &&
               formValues.element_id !== null)
              ? formValues.element_id
              : (editingRecord ? (editingRecord.product_id || editingRecord.element_id) : null);
        if (!prdId || Number(prdId) <= 0) {
          const prdItemName = formValues.item || editingRecord?.item;
          if (prdItemName) {
            const matched = (lookupOptions.products || []).find(
              (p) => String(p.name || "").trim().toLowerCase() === String(prdItemName).trim().toLowerCase()
            );
            if (matched) {
              prdId = matched.id;
            }
          }
        }
        if (!prdId || Number(prdId) <= 0) {
          setPageError("Please click and select a specific product from the list below.");
          setIsSaving(false);
          return;
        }
        record.type = "product";
        record.product_id = Number(prdId);
        record.element_id = Number(prdId);
        record.raw_material_id = null;
      } else if (typeVal === "other") {
        const itemName = formValues.material_name || formValues.item || (editingRecord ? editingRecord.item : "");
        if (!itemName || !String(itemName).trim()) {
          setPageError("Material / item name is required.");
          setIsSaving(false);
          return;
        }
      }
      const qtyVal = formValues.quantity !== undefined && formValues.quantity !== ""
        ? Number(formValues.quantity)
        : (editingRecord && editingRecord.quantity !== undefined ? Number(editingRecord.quantity) : null);
      if (qtyVal === null || !Number.isFinite(qtyVal) || qtyVal <= 0) {
        setPageError("Quantity is required and must be greater than 0.");
        setIsSaving(false);
        return;
      }

      // If type === other, package raw material & supplier details into other_details
      if (record.type === "other") {
        record.customer_id = null;
        record.supplier_id = null;
        record.raw_material_id = null;
        record.element_id = null;
        record.item = String(formValues.material_name || formValues.item || editingRecord?.item || "").trim();

        const otherDetails = {
          material_name: record.item || null,
          hsn_code: formValues.hsn_code || null,
          unit: formValues.unit || record.unit || null,
          rate: formValues.rate !== undefined && formValues.rate !== "" ? Number(formValues.rate) : (record.rate !== undefined && record.rate !== null ? Number(record.rate) : null),
          discount_percent: formValues.discount_percent !== undefined && formValues.discount_percent !== "" ? Number(formValues.discount_percent) : null,
          cgst_percent: formValues.cgst_percent !== undefined && formValues.cgst_percent !== "" ? Number(formValues.cgst_percent) : null,
          ut_sgst_percent: formValues.ut_sgst_percent !== undefined && formValues.ut_sgst_percent !== "" ? Number(formValues.ut_sgst_percent) : null,
          igst_percent: formValues.igst_percent !== undefined && formValues.igst_percent !== "" ? Number(formValues.igst_percent) : null,
          supplier_company_name: formValues.supplier_company_name || null,
          supplier_contact_person: formValues.supplier_contact_person || null,
          supplier_email: formValues.supplier_email || null,
          supplier_phone: formValues.supplier_phone || null,
          supplier_address: formValues.supplier_address || null,
          supplier_city: formValues.supplier_city || null,
          supplier_state: formValues.supplier_state || null,
          supplier_gst_number: formValues.supplier_gst_number || null,
        };
        otherDetails.company_name = otherDetails.supplier_company_name;
        otherDetails.contact_person = otherDetails.supplier_contact_person;
        otherDetails.email = otherDetails.supplier_email;
        otherDetails.phone = otherDetails.supplier_phone;
        otherDetails.address = otherDetails.supplier_address;
        otherDetails.city = otherDetails.supplier_city;
        otherDetails.state = otherDetails.supplier_state;
        otherDetails.gst_number = otherDetails.supplier_gst_number;
        otherDetails.raw_material = {
          material_name: otherDetails.material_name,
          hsn_code: otherDetails.hsn_code,
          unit: otherDetails.unit,
          rate: otherDetails.rate,
          discount_percent: otherDetails.discount_percent,
          cgst_percent: otherDetails.cgst_percent,
          ut_sgst_percent: otherDetails.ut_sgst_percent,
          igst_percent: otherDetails.igst_percent,
        };
        otherDetails.supplier = {
          company_name: otherDetails.supplier_company_name,
          contact_person: otherDetails.supplier_contact_person,
          email: otherDetails.supplier_email,
          phone: otherDetails.supplier_phone,
          address: otherDetails.supplier_address,
          city: otherDetails.supplier_city,
          state: otherDetails.supplier_state,
          gst_number: otherDetails.supplier_gst_number,
        };

        record.other_details = otherDetails;
      }

      const allowedFields = [
        "DC_no",
        "dc_no",
        "DC_date",
        "dc_date",
        "bill_no",
        "bill_date",
        "item",
        "quantity",
        "unit",
        "rate",
        "discount_percent",
        "type",
        "customer_id",
        "supplier_id",
        "raw_material_id",
        "product_id",
        "element_id",
        "user_id",
        "amount",
        "cgst_amount",
        "ut_sgst_amount",
        "igst_amount",
        "total_amount",
        "other_details",
        "remarks",
      ];

      for (const key of Object.keys(record)) {
        if (!allowedFields.includes(key)) {
          delete record[key];
        }
      }
      delete record.item_picker;

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

      // Resolve the selected raw material or product name.
      if (record.type === "raw_material") {
        record.customer_id = null;
        record.product_id = null;
        record.element_id = null;

        const rawMaterial = lookupOptions.rawMaterials?.find(
          (material) =>
            String(material.id) === String(record.raw_material_id)
        );

        if (rawMaterial) {
          record.item = rawMaterial.material_name;
        }
      } else if (record.type === "product" || record.type === "element") {
        record.raw_material_id = null;
        const targetId = record.product_id || record.element_id;
        record.product_id = targetId;

        const product = lookupOptions.products?.find(
          (item) => String(item.id) === String(targetId)
        );

        if (product) {
          record.item = product.name;
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

        const isNumericCompare = numericFields.includes(key);
        const valuesMatch = isDateField
          ? String(newValue ?? "").slice(0, 10) ===
            String(originalValue ?? "").slice(0, 10)
          : key === "raw_material_ids"
            ? JSON.stringify([...(Array.isArray(newValue) ? newValue : [])].map(Number).sort()) ===
              JSON.stringify([...(Array.isArray(originalValue) ? originalValue : [])].map(Number).sort())
          : isNumericCompare
            ? Number(newValue) === Number(originalValue)
            : key === "other_details"
              ? JSON.stringify(newValue ?? null) === JSON.stringify(originalValue ?? null)
              : String(newValue ?? "") === String(originalValue ?? "");

        if (valuesMatch) {
          if (
            activeSection === "dailyInputs" &&
            (key === "type" || key === "raw_material_id" || key === "product_id" || key === "element_id" || (key === "rate" && formValues.rate !== "" && formValues.rate !== null && formValues.rate !== undefined))
          ) {
            // Keep critical dailyInputs identifiers so backend PUT/PATCH always receives them
          } else {
            delete record[key];
          }
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

    if (activeSection === "dailyInputs") {
      const savedRmId = result.data?.raw_material_id || record.raw_material_id || formValues.raw_material_id;
      const savedElId = result.data?.element_id || record.element_id || formValues.element_id;
      const savedRate = result.data?.rate !== undefined
        ? result.data?.rate
        : (record.rate !== undefined ? record.rate : formValues.rate);
      if (savedRmId && savedRate !== undefined && savedRate !== null && savedRate !== "") {
        setLookupOptions((prev) => ({
          ...prev,
          rawMaterials: (prev.rawMaterials || []).map((rm) =>
            String(rm.id) === String(savedRmId)
              ? { ...rm, rate: Number(savedRate) }
              : rm
          ),
        }));
      }
      const savedPrdId = result.data?.product_id || result.data?.element_id || record.product_id || record.element_id;
      if (savedPrdId) {
        setLookupRequestVersion((v) => v + 1);
      }
      setLookupRequestVersion((v) => v + 1);
    }

    if (isAddMore) {
      setNotice("Daily Input added successfully.");

      setFormValues((prev) => ({
        ...prev,
        DC_no: prev.DC_no ?? formValues.DC_no ?? "",
        DC_date: prev.DC_date ?? formValues.DC_date ?? "",
        bill_no: prev.bill_no ?? formValues.bill_no ?? "",
        bill_date: prev.bill_date ?? formValues.bill_date ?? "",
        quantity: "",
        item: "",
        unit: "",
        type: formValues.type || "raw_material",
        customer_id: prev.customer_id ?? formValues.customer_id ?? "",
        supplier_id: prev.supplier_id ?? formValues.supplier_id ?? "",
        raw_material_id: "",
        product_id: "",
        element_id: "",
        material_name: "",
        hsn_code: "",
        supplier_company_name: prev.supplier_company_name ?? formValues.supplier_company_name ?? "",
        supplier_contact_person: prev.supplier_contact_person ?? formValues.supplier_contact_person ?? "",
        supplier_email: prev.supplier_email ?? formValues.supplier_email ?? "",
        supplier_phone: prev.supplier_phone ?? formValues.supplier_phone ?? "",
        supplier_address: prev.supplier_address ?? formValues.supplier_address ?? "",
        supplier_city: prev.supplier_city ?? formValues.supplier_city ?? "",
        supplier_state: prev.supplier_state ?? formValues.supplier_state ?? "",
        supplier_gst_number: prev.supplier_gst_number ?? formValues.supplier_gst_number ?? "",
        other_details: null,
        rate: "",
        discount_percent: "",
        amount: "",
        cgst_amount: "",
        ut_sgst_amount: "",
        igst_amount: "",
        total_amount: "",
      }));

      setFormType(formValues.type || "raw_material");
      setEditingRecord(null);
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

    const idsToDelete = [...selectedIds].map(Number);

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

  function normalizeCsvDate(value) {
    if (!value) return "";
    const text = String(value);
    return text.includes("T") ? text.split("T")[0] : text.slice(0, 10);
  }

  function recordMatchesBillDateRange(record) {
    if (activeSection !== "dailyInputs") return true;
    const billDate = normalizeCsvDate(record.bill_date);
    if (!billDate) return false;
    if (csvBillDateFrom && billDate < csvBillDateFrom) return false;
    if (csvBillDateTo && billDate > csvBillDateTo) return false;
    return true;
  }

  function getRecordFieldValue(record, key) {
    if (key === "DC_no") return record.DC_no ?? record.dc_no;
    if (key === "DC_date") return record.DC_date ?? record.dc_date;
    return record[key];
  }

  function openCsvModal() {
    const columns = sections[activeSection]?.columns || [];
    setPageError("");
    setNotice("");
    setCsvSearchTerm("");
    setCsvBillDateFrom("");
    setCsvBillDateTo("");
    setCsvSelectedIds(selectedIds.length > 0 ? [...selectedIds] : []);
    setCsvSelectedColumns(columns.map(([key]) => key));
    setCsvValueFilters({});
    setCsvFilterOptionSearch({});
    setCsvFilterFieldToAdd(columns[0]?.[0] || "");
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

  function toggleCsvColumn(key) {
    setCsvSelectedColumns((prev) => (
      prev.includes(key)
        ? prev.filter((column) => column !== key)
        : [...prev, key]
    ));
  }

  function toggleCsvFilterValue(field, value) {
    const normalized = String(value);
    setCsvValueFilters((prev) => {
      const current = prev[field] || [];
      const nextValues = current.some((item) => String(item) === normalized)
        ? current.filter((item) => String(item) !== normalized)
        : [...current, normalized];
      if (nextValues.length === 0) {
        const next = { ...prev };
        delete next[field];
        return next;
      }
      return { ...prev, [field]: nextValues };
    });
  }

  function addCsvFilterField(fieldOverride) {
    const columns = sections[activeSection]?.columns || [];
    const field =
      fieldOverride
      || csvFilterFieldToAdd
      || columns.find(
        ([key]) => !Object.prototype.hasOwnProperty.call(csvValueFilters, key),
      )?.[0];
    if (!field) return;

    const nextFilters = Object.prototype.hasOwnProperty.call(csvValueFilters, field)
      ? csvValueFilters
      : { ...csvValueFilters, [field]: [] };

    setCsvValueFilters(nextFilters);
    setCsvFilterFieldToAdd(
      columns.find(
        ([key]) => !Object.prototype.hasOwnProperty.call(nextFilters, key),
      )?.[0] || "",
    );
  }

  function removeCsvFilterField(field) {
    setCsvValueFilters((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
    setCsvFilterOptionSearch((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function setAllCsvFilterValues(field, values) {
    setCsvValueFilters((prev) => {
      if (!values || values.length === 0) {
        const next = { ...prev };
        next[field] = [];
        return next;
      }
      return { ...prev, [field]: values.map(String) };
    });
  }

  function formatCsvCell(record, key) {
    const raw = getRecordFieldValue(record, key);
    const val = getRelatedCompanyName(key, raw) ?? raw ?? "";
    if (typeof val === "string" && key.toLowerCase().includes("date") && val.includes("T")) {
      return val.split("T")[0];
    }
    if (val === null || val === undefined || val === "") return "";
    if (typeof val === "object") return JSON.stringify(val);
    return String(val);
  }

  function recordMatchesCsvValueFilters(record) {
    return Object.entries(csvValueFilters).every(([field, values]) => {
      if (!values || values.length === 0) return true;
      const raw = getRecordFieldValue(record, field);
      if (raw === null || raw === undefined || raw === "") return false;
      return values.some((value) => String(value) === String(raw));
    });
  }

  function handleDownloadCsv(event) {
    event.preventDefault();

    if (csvSelectedColumns.length === 0) {
      setPageError("Select at least one column to include in the CSV.");
      return;
    }

    let exportRecords;
    if (activeSection === "dailyInputs") {
      if (!csvBillDateFrom || !csvBillDateTo) {
        setPageError("Enter both From Bill Date and To Bill Date.");
        return;
      }
      if (csvBillDateFrom > csvBillDateTo) {
        setPageError("From Bill Date cannot be after To Bill Date.");
        return;
      }
      exportRecords = records.filter(
        (record) =>
          recordMatchesBillDateRange(record)
          && recordMatchesCsvValueFilters(record),
      );
      if (exportRecords.length === 0) {
        setPageError("No Daily Inputs match the selected filters.");
        return;
      }
    } else {
      exportRecords = csvFilteredRecords.filter((record) =>
        recordMatchesCsvValueFilters(record)
        && (
          csvSelectedIds.length === 0
          || csvSelectedIds.some((selectedId) => String(selectedId) === String(record.id))
        ),
      );
      if (exportRecords.length === 0) {
        setPageError("No records match the selected filters.");
        return;
      }
    }

    setIsExportingCsv(true);
    setPageError("");
    setNotice("");

    try {
      const selectedColumns = activeConfig.columns.filter(([key]) =>
        csvSelectedColumns.includes(key),
      );
      const columnLabels = selectedColumns.map(([, label]) => label);
      const rows = exportRecords.map((record) =>
        selectedColumns.map(([key]) => formatCsvCell(record, key)),
      );
      const activeFilterCount = Object.values(csvValueFilters).filter(
        (values) => values.length > 0,
      ).length;
      const subtitleParts = [];
      if (activeSection === "dailyInputs") {
        subtitleParts.push(`Bill date ${csvBillDateFrom} to ${csvBillDateTo}`);
      }
      if (activeFilterCount > 0) {
        subtitleParts.push(`${activeFilterCount} field filter(s)`);
      }
      subtitleParts.push(`${exportRecords.length} record(s)`);

      const isDailyInputs = activeSection === "dailyInputs";
      const totalAmountSum = exportRecords.reduce((sum, r) => sum + (Number(r.total_amount) || 0), 0);
      const amountSum = exportRecords.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
      const cgstSum = exportRecords.reduce((sum, r) => sum + (Number(r.cgst_amount) || 0), 0);
      const utSgstSum = exportRecords.reduce((sum, r) => sum + (Number(r.ut_sgst_amount) || 0), 0);
      const igstSum = exportRecords.reduce((sum, r) => sum + (Number(r.igst_amount) || 0), 0);
      const quantitySum = exportRecords.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);

      const totalsMap = {
        total_amount: totalAmountSum.toFixed(2),
        amount: amountSum.toFixed(2),
        cgst_amount: cgstSum.toFixed(2),
        ut_sgst_amount: utSgstSum.toFixed(2),
        igst_amount: igstSum.toFixed(2),
        quantity: Number.isInteger(quantitySum) ? String(quantitySum) : quantitySum.toFixed(2),
      };

      let labelPlaced = false;
      const totalsRow = selectedColumns.map(([key]) => {
        if (totalsMap[key] !== undefined) {
          return totalsMap[key];
        }
        if (!labelPlaced) {
          labelPlaced = true;
          return "Grand Total";
        }
        return "";
      });

      setCsvPreview({
        title: isDailyInputs ? "Daily Inputs Invoice" : `${activeConfig.label} CSV`,
        subtitle: subtitleParts.join(" · "),
        section: activeSection,
        columnKeys: selectedColumns.map(([key]) => key),
        columnLabels,
        rows,
        totalsRow,
        totalAmountSum,
        amountSum,
        cgstSum,
        utSgstSum,
        igstSum,
        recordCount: exportRecords.length,
      });
      setIsCsvModalOpen(false);
      setCsvSearchTerm("");
      setCsvBillDateFrom("");
      setCsvBillDateTo("");
      setCsvSelectedIds([]);
      setCsvSelectedColumns([]);
      setCsvValueFilters({});
      setCsvFilterFieldToAdd("");
      setCsvFilterOptionSearch({});
      setNotice(
        isDailyInputs
          ? `Generated invoice preview for ${exportRecords.length} record(s).`
          : `Opened ${exportRecords.length} record(s) for viewing and printing.`
      );
    } catch {
      setPageError("Unable to open this table. Please try again.");
    } finally {
      setIsExportingCsv(false);
    }
  }

  function isNumericColumn(key) {
    if (!key) return false;
    const lower = key.toLowerCase();
    return (
      lower.includes("amount")
      || lower.includes("rate")
      || lower.includes("quantity")
      || lower.includes("percent")
      || lower === "cgst_rate"
      || lower === "ut_sgst_rate"
      || lower === "igst_rate"
    );
  }

  function buildPrintableHtml(preview) {
    if (!preview) return "";

    const escapeHtml = (text) => {
      if (text === null || text === undefined) return "";
      return String(text)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    };

    const headerCells = preview.columnLabels
      .map((label, idx) => {
        const key = preview.columnKeys?.[idx];
        const isNum = isNumericColumn(key);
        return `<th class="${isNum ? "num-col" : ""}">${escapeHtml(label)}</th>`;
      })
      .join("");

    const bodyRows = preview.rows
      .map((row) => {
        const cells = row
          .map((cell, idx) => {
            const key = preview.columnKeys?.[idx];
            const isNum = isNumericColumn(key);
            return `<td class="${isNum ? "num-col" : ""}">${escapeHtml(cell || "—")}</td>`;
          })
          .join("");
        return `<tr>${cells}</tr>`;
      })
      .join("");

    let totalsHtml = "";
    if (preview.totalsRow) {
      const totalCells = preview.totalsRow
        .map((cell, idx) => {
          const key = preview.columnKeys?.[idx];
          const isNum = isNumericColumn(key);
          const isTotalAmount = key === "total_amount";
          let displayVal = cell;
          if (cell && !isNaN(Number(cell)) && idx !== 0) {
            if (key !== "quantity") {
              displayVal = "₹" + Number(cell).toLocaleString("en-IN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              });
            }
          }
          return `<td class="${isNum ? "num-col" : ""} ${isTotalAmount ? "highlight" : ""}">${escapeHtml(displayVal || "")}</td>`;
        })
        .join("");
      totalsHtml = `<tfoot><tr class="totals-row">${totalCells}</tr></tfoot>`;
    }

    const totalAmountFormatted = preview.totalAmountSum > 0
      ? "₹" + preview.totalAmountSum.toLocaleString("en-IN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : "";

    const taxableFormatted = preview.amountSum > 0
      ? "₹" + preview.amountSum.toLocaleString("en-IN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : "";

    const totalTaxSum = (preview.cgstSum || 0) + (preview.utSgstSum || 0) + (preview.igstSum || 0);
    const taxFormatted = totalTaxSum > 0
      ? "₹" + totalTaxSum.toLocaleString("en-IN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : "";

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(preview.title)}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 8mm 10mm;
    }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 11px;
      line-height: 1.4;
    }
    .invoice-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 8px;
      margin-bottom: 12px;
    }
    .invoice-header h1 {
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 4px 0;
      letter-spacing: -0.3px;
    }
    .invoice-header .subtitle {
      font-size: 11px;
      color: #475569;
      margin: 0;
    }
    .invoice-header .meta {
      text-align: right;
      font-size: 10px;
      color: #64748b;
      line-height: 1.5;
    }
    .summary-cards {
      display: flex;
      gap: 12px;
      margin-bottom: 14px;
      flex-wrap: wrap;
    }
    .summary-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 6px 12px;
      min-width: 120px;
    }
    .summary-card.highlight {
      background: #eff6ff;
      border-color: #bfdbfe;
    }
    .summary-card .label {
      font-size: 9px;
      font-weight: 600;
      text-transform: uppercase;
      color: #64748b;
      margin-bottom: 2px;
      display: block;
      letter-spacing: 0.5px;
    }
    .summary-card.highlight .label {
      color: #1d4ed8;
    }
    .summary-card .value {
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
    }
    .summary-card.highlight .value {
      color: #1e40af;
      font-size: 14px;
    }
    table.printable-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
      margin-top: 4px;
      page-break-inside: auto;
    }
    table.printable-table th {
      background: #f1f5f9;
      color: #1e293b;
      font-weight: 700;
      text-align: left;
      padding: 6px 8px;
      border: 1px solid #cbd5e1;
      white-space: nowrap;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    table.printable-table th.num-col,
    table.printable-table td.num-col {
      text-align: right;
    }
    table.printable-table td {
      padding: 5px 8px;
      border: 1px solid #e2e8f0;
      color: #334155;
      word-break: break-word;
    }
    table.printable-table tbody tr:nth-child(even) {
      background: #f8fafc;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    table.printable-table tr {
      page-break-inside: avoid;
      page-break-after: auto;
    }
    table.printable-table thead {
      display: table-header-group;
    }
    table.printable-table tfoot {
      display: table-footer-group;
    }
    table.printable-table tfoot tr {
      background: #f1f5f9;
      font-weight: 700;
      border-top: 2px solid #0f172a;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    table.printable-table tfoot td {
      padding: 6px 8px;
      border: 1px solid #cbd5e1;
      color: #0f172a;
      font-weight: 700;
    }
    table.printable-table tfoot td.highlight {
      background: #eff6ff;
      color: #1d4ed8;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  </style>
</head>
<body>
  <div class="invoice-header">
    <div>
      <h1>${escapeHtml(preview.title)}</h1>
      <p class="subtitle">${escapeHtml(preview.subtitle)}</p>
    </div>
    <div class="meta">
      <div>Generated on: ${new Date().toLocaleDateString("en-IN")}</div>
      <div>Records: ${preview.recordCount}</div>
    </div>
  </div>

  <div class="summary-cards">
    <div class="summary-card">
      <span class="label">Total Records</span>
      <span class="value">${preview.recordCount}</span>
    </div>
    ${
      totalAmountFormatted
        ? `<div class="summary-card highlight"><span class="label">Total Amount</span><span class="value">${totalAmountFormatted}</span></div>`
        : ""
    }
    ${
      taxableFormatted
        ? `<div class="summary-card"><span class="label">Taxable Amount</span><span class="value">${taxableFormatted}</span></div>`
        : ""
    }
    ${
      taxFormatted
        ? `<div class="summary-card"><span class="label">Total Tax</span><span class="value">${taxFormatted}</span></div>`
        : ""
    }
  </div>

  <table class="printable-table">
    <thead>
      <tr>${headerCells}</tr>
    </thead>
    <tbody>
      ${bodyRows}
    </tbody>
    ${totalsHtml}
  </table>
</body>
</html>`;
  }

  async function handleDownloadCsvFromPreview() {
    if (!csvPreview) return;
    const rowsToExport = [...csvPreview.rows];
    if (csvPreview.totalsRow) {
      rowsToExport.push(csvPreview.totalsRow);
    }
    const filename = `${csvPreview.section || activeSection}-${new Date().toISOString().slice(0, 10)}`;

    if (window.desktop?.exportWorkspaceCsv) {
      try {
        const result = await window.desktop.exportWorkspaceCsv(
          csvPreview.section || activeSection,
          csvPreview.columnLabels,
          rowsToExport,
        );
        if (result?.ok && !result.canceled) {
          setNotice(`CSV file successfully saved (${rowsToExport.length} rows including totals).`);
        } else if (result?.error) {
          setPageError(result.error);
        }
      } catch {
        setPageError("Failed to save CSV file.");
      }
    } else {
      try {
        const escapeCsvCell = (value) => {
          let cell = value === null || value === undefined ? "" : String(value);
          if (/^[\s]*[=+\-@]/.test(cell)) cell = `'${cell}`;
          return `"${cell.replaceAll('"', '""')}"`;
        };
        const csvContent = [csvPreview.columnLabels, ...rowsToExport]
          .map((r) => r.map(escapeCsvCell).join(","))
          .join("\r\n");
        const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${filename}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setNotice("CSV downloaded successfully.");
      } catch {
        setPageError("Failed to download CSV.");
      }
    }
  }

  async function handleDownloadPdfFromPreview() {
    if (!csvPreview) return;
    const printableHtml = buildPrintableHtml(csvPreview);

    if (window.desktop?.exportWorkspacePdf) {
      try {
        const result = await window.desktop.exportWorkspacePdf(
          csvPreview.section || activeSection,
          printableHtml,
          csvPreview.title,
        );
        if (result?.ok && !result.canceled) {
          setNotice(`PDF successfully saved to: ${result.filePath}`);
        } else if (result?.error) {
          setPageError(result.error);
        }
      } catch {
        setPageError("Failed to save PDF file.");
      }
    } else {
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(printableHtml);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 300);
      } else {
        window.print();
      }
    }
  }

  async function handlePrintCsvPreview() {
    if (!csvPreview) return;
    const printableHtml = buildPrintableHtml(csvPreview);

    if (window.desktop?.openPrintPreview) {
      try {
        const res = await window.desktop.openPrintPreview(printableHtml, csvPreview.title);
        if (res?.error) {
          window.print();
        }
      } catch {
        window.print();
      }
    } else {
      window.print();
    }
  }

  function closeCsvPreview() {
    setCsvPreview(null);
  }

  const activeNavigation = flatNavigation.find(
    (item) => item.id === activeSection,
  );
  const activeGroup = availableNavigation.find(
    (item) => item.children && item.children.some((child) => child.id === activeSection),
  );
  const activeConfig = sections[activeSection];
  const activeColumns = activeConfig?.columns ?? [];
  const availableFilterColumns = activeColumns.filter(
    ([key]) => !filters.some((filter) => filter.field === key),
  );
  const selectedFilterField = filterField || availableFilterColumns[0]?.[0] || "";

  function getRelatedCompanyName(key, value, record) {
    if (key === "zach_code") {
      return value || "—";
    }
    if (key === "component_name") {
      if (record?.has_zach_code || record?.zach_code) return "—";
      if (value) return value;
      if (record?.type === "welded element") {
        const elName = record.element_name || lookupOptions.products?.find((p) => String(p.id) === String(record.element_id))?.name;
        return elName ? `Element: ${elName}` : "—";
      }
      if (record?.type === "capacitor") {
        const weName = record.welded_element_name || lookupOptions.products?.find((p) => String(p.id) === String(record.welded_element_id))?.name;
        return weName ? `Welded Element: ${weName}` : "—";
      }
      return "—";
    }
    if (key === "raw_material_name") {
      if (record?.has_zach_code || record?.zach_code) return "—";
      if (value) return value;
      if (record?.raw_material_names && record.raw_material_names.length > 0) {
        return record.raw_material_names.join(", ");
      }
      if (record?.raw_material_ids && record.raw_material_ids.length > 0) {
        const idSet = new Set(record.raw_material_ids.map(Number));
        const names = (lookupOptions.rawMaterials || [])
          .filter((rm) => idSet.has(Number(rm.id)))
          .map((rm) => rm.material_name)
          .filter(Boolean);
        if (names.length > 0) return names.join(", ");
      }
      return undefined;
    }
    if (key === "raw_material_id") {
      if (record?.type === "other") {
        return record.item || record.other_details?.material_name || "—";
      }
      if (value) {
        return (record && record.item) || lookupOptions.rawMaterials?.find((material) => material.id === value)?.material_name;
      }
      return record?.item || undefined;
    }
    if (key === "product_id" || key === "element_id") {
      if (activeSection === "products" && key === "element_id") {
        return record?.element_name || lookupOptions.products?.find((p) => String(p.id) === String(value))?.name || (value ? `Element #${value}` : "—");
      }
      if (record?.type === "other") {
        return "—";
      }
      if (value) {
        return (record && record.item) || lookupOptions.products?.find((product) => product.id === value)?.name;
      }
    }
    if (key === "welded_element_id") {
      return record?.welded_element_name || lookupOptions.products?.find((p) => String(p.id) === String(value))?.name || (value ? `Welded Element #${value}` : "—");
    }
    if (key === "supplier_id") {
      if (record?.type === "other") {
        return record.other_details?.supplier_company_name || record.other_details?.company_name || "—";
      }
      if (value) {
        return lookupOptions.suppliers?.find((supplier) => supplier.id === value)?.company_name;
      }
    }
    if (key === "customer_id") {
      if (record?.type === "other") {
        return "—";
      }
      if (value) {
        return lookupOptions.customers?.find((customer) => customer.id === value)?.company_name;
      }
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
    const raw = getRecordFieldValue(record, key);
    const values = [raw, getRelatedCompanyName(key, raw, record)];
    return values
      .filter((value) => value !== null && value !== undefined)
      .map((value) => String(value).toLocaleLowerCase());
  }

  function getCsvFilterOptions(field) {
    if (field === "type") {
      if (activeSection === "products") {
        return [
          { value: "element", label: "element" },
          { value: "welded element", label: "welded element" },
          { value: "capacitor", label: "capacitor" },
        ];
      }
      return [
        { value: "raw_material", label: "Raw material" },
        { value: "product", label: "Product" },
        { value: "other", label: "Other" },
      ];
    }

    let lookupOptionsForField = [];
    if (field === "supplier_id") {
      lookupOptionsForField = (lookupOptions.suppliers || []).map((item) => ({
        value: String(item.id),
        label: item.company_name || `Supplier #${item.id}`,
      }));
    } else if (field === "customer_id") {
      lookupOptionsForField = (lookupOptions.customers || []).map((item) => ({
        value: String(item.id),
        label: item.company_name || `Customer #${item.id}`,
      }));
    } else if (field === "raw_material_id") {
      lookupOptionsForField = (lookupOptions.rawMaterials || []).map((item) => ({
        value: String(item.id),
        label: item.material_name || `Raw material #${item.id}`,
      }));
    } else if (field === "product_id" || field === "element_id") {
      lookupOptionsForField = (lookupOptions.products || []).map((item) => ({
        value: String(item.id),
        label: item.name ? `${item.name} (${item.type || "product"})` : `Product #${item.id}`,
      }));
    }

    if (lookupOptionsForField.length > 0) {
      return lookupOptionsForField.sort((a, b) => a.label.localeCompare(b.label));
    }

    const unique = new Map();
    for (const record of records) {
      const raw = getRecordFieldValue(record, field);
      if (raw === null || raw === undefined || raw === "") continue;
      const value = String(raw);
      if (!unique.has(value)) {
        unique.set(value, formatCsvCell(record, field) || value);
      }
    }
    return [...unique.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
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
    return records.filter((record) => {
      if (!recordMatchesBillDateRange(record)) return false;
      if (!recordMatchesCsvValueFilters(record)) return false;
      if (!normalizedSearch) return true;
      const values = [
        String(record.id ?? ""),
        ...activeColumns.flatMap(([key]) => getColumnSearchValues(record, key)),
      ];
      return values.some((value) =>
        String(value).toLocaleLowerCase().includes(normalizedSearch),
      );
    });
  }, [
    activeColumns,
    activeSection,
    csvBillDateFrom,
    csvBillDateTo,
    csvSearchTerm,
    csvValueFilters,
    lookupOptions,
    records,
  ]);

  const activeLookups = activeSection === "dailyInputs"
    ? ["customers", "suppliers", "rawMaterials", "products"]
    : activeSection === "products"
    ? ["rawMaterials", "products"]
    : [];
  const isLookupLoading = activeLookups.some((lookup) => lookupLoading[lookup]);
  const activeLookupError = activeLookups
    .map((lookup) => lookupErrors[lookup])
    .find(Boolean);

  return (
    <main className="workspace-shell">
      <aside aria-label="Main navigation" className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark sidebar-mark" aria-hidden="true">OE</div>
          <div>
            <strong>Oyster Electronics</strong>
          </div>
        </div>

        <span className="sidebar-caption">MENU</span>
        <nav className="sidebar-nav">
          {availableNavigation.map((item) => {
            if (item.children) {
              const isGroupOpen = !!openDropdowns[item.id];
              const isGroupActive = item.children.some((child) => child.id === activeSection);

              return (
                <div className={`nav-group${isGroupActive ? " group-active" : ""}`} key={item.id}>
                  <button
                    type="button"
                    className={`nav-item nav-group-header${isGroupActive ? " active-parent" : ""}`}
                    onClick={() => toggleDropdown(item.id)}
                    aria-expanded={isGroupOpen}
                  >
                    <span aria-hidden="true" className="nav-marker">{item.marker}</span>
                    <span className="nav-group-title">{item.label}</span>
                    <svg
                      aria-hidden="true"
                      className={`nav-chevron-icon${isGroupOpen ? " open" : ""}`}
                      fill="none"
                      height="20"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2.8"
                      viewBox="0 0 24 24"
                      width="20"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {isGroupOpen && (
                    <div className="nav-group-children">
                      {item.children.map((child) => {
                        const isChildActive = activeSection === child.id;
                        return (
                          <button
                            key={child.id}
                            type="button"
                            aria-current={isChildActive ? "page" : undefined}
                            className={`nav-item nav-sub-item${isChildActive ? " active" : ""}`}
                            onClick={() => navigateToSection(child.id)}
                          >
                            <span aria-hidden="true" className="nav-sub-marker">{child.marker}</span>
                            <span className="nav-sub-label">{child.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            const isActive = activeSection === item.id;
            return (
              <button
                aria-current={isActive ? "page" : undefined}
                className={`nav-item${isActive ? " active" : ""}`}
                key={item.id}
                onClick={() => navigateToSection(item.id)}
                type="button"
              >
                <span aria-hidden="true" className="nav-marker">{item.marker}</span>
                {item.label}
              </button>
            );
          })}
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
            {activeGroup && (
              <>
                <span>{activeGroup.label}</span>
                <span aria-hidden="true">/</span>
              </>
            )}
            <strong>{activeNavigation?.label || sections[activeSection]?.label}</strong>
          </div>
          <span className="topbar-user">{user.first_name} {user.last_name}</span>
        </header>

        <div className={`page-content ${isFormOpen ? "has-form-open" : ""}`}>
          {activeSection === "dashboard" ? (
            <Dashboard
              backendStatus={backendStatus}
              counts={dashboardCounts}
              isLoading={isLoading}
              onNavigate={navigateToSection}
              pageError={pageError}
              onRefresh={() => setRequestVersion((version) => version + 1)}
              navigationItems={flatNavigation}
              user={user}
            />
          ) : (
            <section aria-labelledby="page-title" className={`section-page ${isFormOpen ? "has-form-open" : ""}`}>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">WORKSPACE</span>
                  <h1 id="page-title">{activeConfig.label}</h1>
                  <p>{activeConfig.description}</p>
                </div>
                <div className="page-heading-actions">
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
                          setProductSaveConfirm(null);
                        } else {
                          setEditingRecord(null);
                          setProductSaveConfirm(null);
                          const initialType = activeSection === "costData" ? "Basic" : activeSection === "products" ? "element" : activeSection === "dailyInputs" ? "raw_material" : "raw_material";
                          setFormType(initialType);
                          const initialValues = {};
                          const fields = sections[activeSection]?.fields || [];
                          for (const field of fields) {
                            initialValues[field.name] =
                              field.type === "multiRawMaterial" ||
                              field.name === "raw_material_ids" ||
                              field.name === "raw_materials"
                                ? []
                                : (field.defaultValue ?? "");
                          }
                          if (activeSection === "products") {
                            initialValues.product_mode = "without_zach_code";
                            initialValues.zach_code = "";
                            initialValues.raw_materials = [];
                            initialValues.raw_material_ids = [];
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
                    if (activeSection === "products") {
                      if (formRef.current && !formRef.current.reportValidity()) {
                        return;
                      }
                      const name = (formValues.name || (editingRecord ? editingRecord.name : "") || "").trim();
                      if (!name) {
                        setPageError("Product name is required.");
                        return;
                      }
                      const pType = formValues.type || (editingRecord ? editingRecord.type : "element");
                      const isWithZach =
                        formValues.product_mode === "with_zach_code" ||
                        (!formValues.product_mode && (editingRecord?.has_zach_code || Boolean(editingRecord?.zach_code)));

                      const rms = (Array.isArray(formValues.raw_materials) ? formValues.raw_materials : [])
                        .filter((it) => it && (it.raw_material_id || it.id))
                        .map((it) => {
                          const rid = Number(it.raw_material_id || it.id);
                          const master = lookupOptions.rawMaterials?.find((m) => Number(m.id) === rid);
                          const qty = it.quantity !== "" && it.quantity !== null && it.quantity !== undefined ? it.quantity : 1;
                          return {
                            id: rid,
                            name: master?.material_name || it.material_name || `Raw Material #${rid}`,
                            code: master?.code || it.code || "",
                            quantity: qty,
                            unit: master?.unit || it.unit || "",
                          };
                        });

                      if (isWithZach) {
                        const zachCode = (formValues.zach_code ?? (editingRecord ? editingRecord.zach_code : "") ?? "").trim();
                        if (!zachCode) {
                          setPageError("Zach Code is required when 'with zach code' is selected.");
                          return;
                        }
                        setProductSaveConfirm({
                          name,
                          type: pType,
                          isZachCode: true,
                          zachCode,
                          elementName: null,
                          weldedElementName: null,
                          rawMaterials: rms,
                        });
                        return;
                      }

                      if (pType === "welded element" && !formValues.element_id && !(editingRecord && editingRecord.element_id)) {
                        setPageError("Please select an element for the welded element.");
                        return;
                      }
                      if (pType === "capacitor" && !formValues.welded_element_id && !(editingRecord && editingRecord.welded_element_id)) {
                        setPageError("Please select a welded element for the capacitor.");
                        return;
                      }

                      const elName = pType === "welded element"
                        ? (lookupOptions.products?.find((p) => String(p.id) === String(formValues.element_id || editingRecord?.element_id))?.name || "Selected Element")
                        : null;

                      const weName = pType === "capacitor"
                        ? (lookupOptions.products?.find((p) => String(p.id) === String(formValues.welded_element_id || editingRecord?.welded_element_id))?.name || "Selected Welded Element")
                        : null;

                      setProductSaveConfirm({
                        name,
                        type: pType,
                        isZachCode: false,
                        zachCode: null,
                        elementName: elName,
                        weldedElementName: weName,
                        rawMaterials: rms,
                      });
                    } else {
                      submitForm(false);
                    }
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
                        const currentProductMode =
                          formValues.product_mode ||
                          (editingRecord?.has_zach_code || Boolean(editingRecord?.zach_code)
                            ? "with_zach_code"
                            : "without_zach_code");

                        if (
                          activeSection === "products" &&
                          field.dependsOnProductMode &&
                          currentProductMode !== field.dependsOnProductMode
                        ) {
                          return null;
                        }

                        if (field.type === "productModeRadio") {
                          const currentVal = currentProductMode;
                          return (
                            <div className="form-field-group product-mode-group field-wide" key={field.name}>
                              <div className="product-mode-radios">
                                <label className={`product-mode-radio-label ${currentVal === "with_zach_code" ? "selected" : ""}`}>
                                  <input
                                    type="radio"
                                    name="product_mode"
                                    value="with_zach_code"
                                    checked={currentVal === "with_zach_code"}
                                    onChange={() => handleFormFieldChange("product_mode", "with_zach_code")}
                                    disabled={isSaving}
                                  />
                                  <span className="radio-custom" />
                                  <span className="radio-text">with zach code</span>
                                </label>
                                <label className={`product-mode-radio-label ${currentVal === "without_zach_code" ? "selected" : ""}`}>
                                  <input
                                    type="radio"
                                    name="product_mode"
                                    value="without_zach_code"
                                    checked={currentVal === "without_zach_code"}
                                    onChange={() => handleFormFieldChange("product_mode", "without_zach_code")}
                                    disabled={isSaving}
                                  />
                                  <span className="radio-custom" />
                                  <span className="radio-text">without zach code</span>
                                </label>
                              </div>
                            </div>
                          );
                        }

                        // If field depends on "other", only show when formType is "other"
                        if (field.dependsOnType === "other" && formType !== "other") {
                          return null;
                        }
                        // When formType is "other", hide master dropdowns (rawMaterial, element, supplier, customer)
                        if (
                          formType === "other" &&
                          ["rawMaterial", "element", "supplier", "customer"].includes(field.type)
                        ) {
                          return null;
                        }

                        // For costData, only show fields that match the selected type (Basic vs Element)
                        if (
                          activeSection === "costData" &&
                          field.dependsOnType &&
                          (Array.isArray(field.dependsOnType)
                            ? !field.dependsOnType.includes(formType)
                            : formType !== field.dependsOnType)
                        ) {
                          return null;
                        }

                        // For products, only show fields that match dependsOnProductType
                        if (
                          activeSection === "products" &&
                          field.dependsOnProductType &&
                          formType !== field.dependsOnProductType
                        ) {
                          return null;
                        }

                        const isFieldDisabled = Boolean(
                          field.dependsOnType &&
                            (Array.isArray(field.dependsOnType)
                              ? !field.dependsOnType.includes(formType)
                              : formType !== field.dependsOnType)
                        );

                        const isFieldRequired =
                          typeof field.required === "function"
                            ? field.required(field.dependsOnProductMode ? currentProductMode : formType)
                            : Boolean(field.required);

                        const lookupKey =
                          field.type === "supplier"
                            ? "suppliers"
                            : field.type === "customer"
                              ? "customers"
                              : field.type === "rawMaterial"
                                ? "rawMaterials"
                                : field.type === "product"
                                  ? "products"
                                  : null;

                        const lookupRecords = lookupKey ? lookupOptions[lookupKey] || [] : [];
                        const isLookupBusy = lookupKey ? lookupLoading[lookupKey] : false;
                        const lookupError = lookupKey ? lookupErrors[lookupKey] : "";
                        const optionValue = "id";
                        const optionName =
                          lookupKey === "suppliers" || lookupKey === "customers"
                            ? "company_name"
                            : lookupKey === "rawMaterials"
                              ? "material_name"
                              : "name";

                        if (field.type === "productElement") {
                          const elements = [
                            ...(lookupOptions.products || []),
                            ...(records || []),
                          ].filter(
                            (p, idx, self) =>
                              p &&
                              String(p.type).toLowerCase() === "element" &&
                              String(p.id) !== String(editingRecord?.id) &&
                              self.findIndex((item) => String(item.id) === String(p.id)) === idx
                          );

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
                              <span className="field-label-text">
                                {field.label}
                                {isFieldRequired ? " *" : ""}
                              </span>
                              <select
                                id={`record-${field.name}`}
                                name={field.name}
                                onChange={(e) => handleFormFieldChange(field.name, e.target.value)}
                                required={isFieldRequired}
                                value={formValues[field.name] ?? ""}
                                disabled={isSaving}
                              >
                                <option value="">
                                  {elements.length === 0
                                    ? "No elements available (create an Element first)"
                                    : "Select element…"}
                                </option>
                                {elements.map((el) => (
                                  <option key={el.id} value={el.id}>
                                    {el.name} {el.code ? `(${el.code})` : ""}
                                  </option>
                                ))}
                              </select>
                            </label>
                          );
                        }

                        if (field.type === "productWeldedElement") {
                          const weldedElements = [
                            ...(lookupOptions.products || []),
                            ...(records || []),
                          ].filter(
                            (p, idx, self) =>
                              p &&
                              String(p.type).toLowerCase() === "welded element" &&
                              String(p.id) !== String(editingRecord?.id) &&
                              self.findIndex((item) => String(item.id) === String(p.id)) === idx
                          );

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
                              <span className="field-label-text">
                                {field.label}
                                {isFieldRequired ? " *" : ""}
                              </span>
                              <select
                                id={`record-${field.name}`}
                                name={field.name}
                                onChange={(e) => handleFormFieldChange(field.name, e.target.value)}
                                required={isFieldRequired}
                                value={formValues[field.name] ?? ""}
                                disabled={isSaving}
                              >
                                <option value="">
                                  {weldedElements.length === 0
                                    ? "No welded elements available (create a Welded Element first)"
                                    : "Select welded element…"}
                                </option>
                                {weldedElements.map((we) => (
                                  <option key={we.id} value={we.id}>
                                    {we.name} {we.code ? `(${we.code})` : ""}
                                  </option>
                                ))}
                              </select>
                            </label>
                          );
                        }

                        if (field.type === "multiRawMaterial") {
                          const isWeldedElement = activeSection === "products" && formType === "welded element";
                          const isCapacitor = activeSection === "products" && formType === "capacitor";
                          const labelText = isWeldedElement
                            ? "Select Wire / Wires (from Raw Material)"
                            : isCapacitor
                              ? "Select Raw Materials"
                              : field.label;
                          const placeholderText = isWeldedElement
                            ? "Search wires starting with (e.g. 'W')..."
                            : "Search raw materials starting with (e.g. 'W')...";

                          return (
                            <div
                              className={`form-field-group ${field.wide ? "field-wide" : ""}`}
                              key={field.name}
                            >
                              <div className="field-group-header">
                                <span className="field-group-label">
                                  {labelText}
                                  {isFieldRequired ? " *" : ""}
                                </span>
                                {isWeldedElement && (
                                  <span className="field-group-hint">
                                    Select wire(s) to weld onto the element
                                  </span>
                                )}
                              </div>
                              <MultiRawMaterialPicker
                                value={formValues.raw_materials || formValues[field.name]}
                                selectedIds={formValues.raw_material_ids || formValues[field.name]}
                                rawMaterials={lookupOptions.rawMaterials || []}
                                onChange={(nextItems) => handleFormFieldChange(field.name, nextItems)}
                                disabled={isFieldDisabled || isSaving}
                                isLoading={lookupLoading.rawMaterials}
                                error={lookupErrors.rawMaterials}
                                onRetry={() => setLookupRequestVersion((version) => version + 1)}
                                placeholderOverride={placeholderText}
                                isWireHighlight={isWeldedElement}
                                onAddNewRawMaterial={(searchedName) => handleOpenQuickAddRawMaterial(searchedName)}
                                initialSelectedMaterialId={justCreatedRmId}
                              />
                            </div>
                          );
                        }

                        if (field.type === "dailyInputItemPicker") {
                          return (
                            <div
                              className={`form-field-group ${field.wide ? "field-wide" : ""}`}
                              key={field.name}
                            >
                              <DailyInputItemPicker
                                rawMaterials={lookupOptions.rawMaterials || []}
                                products={lookupOptions.products || []}
                                selectedType={formValues.type || editingRecord?.type}
                                selectedRawMaterialId={
                                  formValues.raw_material_id !== undefined
                                    ? formValues.raw_material_id
                                    : editingRecord?.raw_material_id
                                }
                                selectedProductId={
                                  formValues.product_id !== undefined
                                    ? formValues.product_id
                                    : formValues.element_id !== undefined
                                      ? formValues.element_id
                                      : editingRecord?.product_id || editingRecord?.element_id
                                }
                                onTypeChange={handleDailyInputTypeChange}
                                onSelect={handleDailyInputItemSelect}
                                onDeselect={handleDailyInputItemDeselect}
                                onAddNewRawMaterial={(searched) => handleOpenQuickAddRawMaterial(searched)}
                                onAddNewProduct={(searched) => handleOpenQuickAddProduct(searched)}
                                disabled={isFieldDisabled || isSaving}
                                isLoading={lookupLoading.rawMaterials || lookupLoading.products}
                                error={lookupErrors.rawMaterials || lookupErrors.products}
                                onRetry={() => setLookupRequestVersion((v) => v + 1)}
                                hasError={Boolean(pageError && (!formValues.raw_material_id && !formValues.product_id))}
                              />
                            </div>
                          );
                        }

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
                            <span className="field-label-text">
                              {field.label}
                              {isFieldRequired && !isFieldDisabled ? " *" : ""}
                            </span>

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
                                            : formType === "product" || formType === "element"
                                              ? "product"
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
                                      lookupRecords.map((lookupRecord) => {
                                        const details = [];
                                        if (lookupRecord.type) details.push(lookupRecord.type);
                                        if (lookupRecord.unit) details.push(lookupRecord.unit);
                                        if (
                                          lookupRecord.rate !== undefined &&
                                          lookupRecord.rate !== null &&
                                          lookupRecord.rate !== ""
                                        ) {
                                          details.push(`Rate: ₹${lookupRecord.rate}`);
                                        }
                                        if (
                                          lookupRecord.discount_percent !== undefined &&
                                          lookupRecord.discount_percent !== null &&
                                          lookupRecord.discount_percent !== "" &&
                                          Number(lookupRecord.discount_percent) > 0
                                        ) {
                                          details.push(`Disc: ${lookupRecord.discount_percent}%`);
                                        }
                                        const detailsStr = details.length > 0 ? ` (${details.join(" · ")})` : "";
                                        return (
                                          <option
                                            key={lookupRecord.id}
                                            value={lookupRecord[optionValue]}
                                          >
                                            {lookupRecord[optionName]}
                                            {detailsStr}
                                          </option>
                                        );
                                      })}
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
                                {formValues[field.name] &&
                                  !field.options.some(
                                    (option) => option.value === formValues[field.name]
                                  ) && (
                                    <option value={formValues[field.name]}>
                                      {formValues[field.name]}
                                    </option>
                                  )}
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
                                max={field.max}
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

                      const isAmountField = (name) =>
                        ["amount", "cgst_amount", "ut_sgst_amount", "igst_amount", "total_amount"].includes(name);

                      const isRemarksField = (name) => name === "remarks";

                      const amountFields = otherFields.filter((f) => isAmountField(f.name));
                      const remarksFields = otherFields.filter((f) => isRemarksField(f.name));
                      const mainOtherFields = otherFields.filter(
                        (f) => !isAmountField(f.name) && !isRemarksField(f.name)
                      );

                      return (
                        <>
                          {documentFields.length > 0 && (
                            <div className="document-fields">
                              {documentFields.map(renderField)}
                            </div>
                          )}

                          <div className="other-fields-grid">
                            {mainOtherFields.map(renderField)}
                          </div>

                          {amountFields.length > 0 && (
                            <div className="amounts-fields-row">
                              {amountFields.map(renderField)}
                            </div>
                          )}

                          {remarksFields.length > 0 && (
                            <div className="remarks-fields-row">
                              {remarksFields.map(renderField)}
                            </div>
                          )}
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
                        setProductSaveConfirm(null);
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

              {productSaveConfirm && (
                <div
                  aria-labelledby="product-confirm-title"
                  aria-modal="true"
                  className="modal-overlay product-confirm-overlay"
                  onClick={() => {
                    if (!isSaving) setProductSaveConfirm(null);
                  }}
                  role="presentation"
                >
                  <div
                    className="modal-dialog product-confirm-dialog"
                    onClick={(event) => event.stopPropagation()}
                    role="dialog"
                  >
                    <div className="product-confirm-header">
                      <div className="product-confirm-icon-wrap">
                        <span className="product-confirm-icon">💾</span>
                      </div>
                      <div className="product-confirm-header-text">
                        <h2 id="product-confirm-title">Confirm Save</h2>
                        <p className="product-confirm-sub">Please review the details before saving.</p>
                      </div>
                      <button
                        type="button"
                        className="product-confirm-close-btn"
                        onClick={() => {
                          if (!isSaving) setProductSaveConfirm(null);
                        }}
                        title="Close"
                      >
                        ×
                      </button>
                    </div>

                    <div className="product-confirm-prompt-card">
                      <p className="product-confirm-question">
                        {productSaveConfirm.isZachCode ? (
                          <>
                            Do you want to save the {productSaveConfirm.type}{" "}
                            <strong className="product-confirm-highlight">"{productSaveConfirm.name}"</strong>{" "}
                            with Zach Code{" "}
                            <strong className="product-confirm-highlight">"{productSaveConfirm.zachCode}"</strong>?
                          </>
                        ) : (
                          <>
                            Do you want to save the {productSaveConfirm.type}{" "}
                            <strong className="product-confirm-highlight">"{productSaveConfirm.name}"</strong>{" "}
                            with its raw material and quantity?
                          </>
                        )}
                      </p>
                    </div>

                    <div className="product-confirm-summary-grid">
                      <div className="product-confirm-cell">
                        <span className="confirm-meta-label">Product Name</span>
                        <span className="confirm-meta-value">{productSaveConfirm.name}</span>
                      </div>
                      <div className="product-confirm-cell">
                        <span className="confirm-meta-label">Type</span>
                        <span className={`confirm-type-badge type-${String(productSaveConfirm.type || "").replace(/\s+/g, "-")}`}>
                          {productSaveConfirm.type}
                        </span>
                      </div>
                      {productSaveConfirm.isZachCode && productSaveConfirm.zachCode && (
                        <div className="product-confirm-cell">
                          <span className="confirm-meta-label">Zach Code</span>
                          <span className="confirm-meta-value zach-code-value">{productSaveConfirm.zachCode}</span>
                        </div>
                      )}
                      {productSaveConfirm.elementName && (
                        <div className="product-confirm-cell">
                          <span className="confirm-meta-label">Element</span>
                          <span className="confirm-meta-value">{productSaveConfirm.elementName}</span>
                        </div>
                      )}
                      {productSaveConfirm.weldedElementName && (
                        <div className="product-confirm-cell">
                          <span className="confirm-meta-label">Welded Element</span>
                          <span className="confirm-meta-value">{productSaveConfirm.weldedElementName}</span>
                        </div>
                      )}
                    </div>

                      <div className="product-confirm-materials-block">
                        <div className="product-confirm-mat-heading">
                          <span>Raw Materials &amp; Quantities</span>
                          <span className="product-confirm-count-pill">
                            {productSaveConfirm.rawMaterials.length} item{productSaveConfirm.rawMaterials.length === 1 ? "" : "s"}
                          </span>
                        </div>

                        {productSaveConfirm.rawMaterials.length === 0 ? (
                          <div className="product-confirm-no-mats">
                            ⚠️ No raw materials added to this {productSaveConfirm.type}.
                          </div>
                        ) : (
                          <div className="product-confirm-mat-list">
                            {productSaveConfirm.rawMaterials.map((rm) => (
                              <div key={rm.id} className="product-confirm-mat-item">
                                <div className="product-confirm-mat-name-box">
                                  <span className="mat-dot">•</span>
                                  <span className="mat-title">{rm.name}</span>
                                  {rm.code && <span className="prm-code-badge">[{rm.code}]</span>}
                                </div>
                                <div className="product-confirm-qty-pill">
                                  <strong>{rm.quantity}</strong>
                                  <span>{rm.unit || "unit"}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                    <div className="form-actions product-confirm-actions">
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

              {quickAddRawMaterialModal && (
                <div
                  aria-labelledby="quick-rm-title"
                  aria-modal="true"
                  className="modal-overlay quick-rm-overlay"
                  onClick={() => {
                    if (!isSavingQuickRm) setQuickAddRawMaterialModal(null);
                  }}
                  role="presentation"
                >
                  <div
                    className="modal-dialog quick-rm-dialog"
                    onClick={(event) => event.stopPropagation()}
                    role="dialog"
                  >
                    <div className="quick-rm-header">
                      <div className="quick-rm-icon-wrap">
                        <span className="quick-rm-icon">📦</span>
                      </div>
                      <div className="quick-rm-header-text">
                        <h2 id="quick-rm-title">Add Raw Material</h2>
                        <p className="quick-rm-sub">
                          Enter details to add this raw material. After saving, you will return directly to your product form.
                        </p>
                      </div>
                      <button
                        type="button"
                        className="quick-rm-close-btn"
                        disabled={isSavingQuickRm}
                        onClick={() => setQuickAddRawMaterialModal(null)}
                        title="Cancel and return to product"
                      >
                        ×
                      </button>
                    </div>

                    {quickRmError && (
                      <p className="workspace-error quick-rm-error" role="alert">
                        {quickRmError}
                      </p>
                    )}

                    <form className="quick-rm-form" onSubmit={handleSaveQuickRawMaterial}>
                      <div className="quick-rm-fields-grid">
                        <label className="quick-rm-field field-wide" htmlFor="qrm-name">
                          Material Name *
                          <input
                            id="qrm-name"
                            type="text"
                            required
                            disabled={isSavingQuickRm}
                            value={quickAddRawMaterialModal.material_name}
                            onChange={(e) =>
                              setQuickAddRawMaterialModal((prev) => ({
                                ...prev,
                                material_name: e.target.value,
                              }))
                            }
                            placeholder="e.g. Copper Wire 0.5mm"
                            autoFocus
                          />
                        </label>

                        <label className="quick-rm-field" htmlFor="qrm-hsn">
                          HSN Code
                          <input
                            id="qrm-hsn"
                            type="text"
                            disabled={isSavingQuickRm}
                            value={quickAddRawMaterialModal.hsn_code}
                            onChange={(e) =>
                              setQuickAddRawMaterialModal((prev) => ({
                                ...prev,
                                hsn_code: e.target.value,
                              }))
                            }
                            placeholder="e.g. 8532"
                          />
                        </label>

                        <label className="quick-rm-field" htmlFor="qrm-unit">
                          Unit
                          <select
                            id="qrm-unit"
                            disabled={isSavingQuickRm}
                            value={quickAddRawMaterialModal.unit}
                            onChange={(e) =>
                              setQuickAddRawMaterialModal((prev) => ({
                                ...prev,
                                unit: e.target.value,
                              }))
                            }
                          >
                            <option value="num">num</option>
                            <option value="kg">kg</option>
                            <option value="litre">litre</option>
                            <option value="mtrs">mtrs</option>
                          </select>
                        </label>

                        <label className="quick-rm-field" htmlFor="qrm-rate">
                          Rate
                          <input
                            id="qrm-rate"
                            type="number"
                            min="0"
                            step="0.01"
                            disabled={isSavingQuickRm}
                            value={quickAddRawMaterialModal.rate}
                            onChange={(e) =>
                              setQuickAddRawMaterialModal((prev) => ({
                                ...prev,
                                rate: e.target.value,
                              }))
                            }
                            placeholder="0.00"
                          />
                        </label>

                        <label className="quick-rm-field" htmlFor="qrm-discount">
                          Discount (%)
                          <input
                            id="qrm-discount"
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            disabled={isSavingQuickRm}
                            value={quickAddRawMaterialModal.discount_percent}
                            onChange={(e) =>
                              setQuickAddRawMaterialModal((prev) => ({
                                ...prev,
                                discount_percent: e.target.value,
                              }))
                            }
                            placeholder="0"
                          />
                        </label>

                        <label className="quick-rm-field" htmlFor="qrm-cgst">
                          CGST (%)
                          <input
                            id="qrm-cgst"
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            disabled={isSavingQuickRm}
                            value={quickAddRawMaterialModal.cgst_percent}
                            onChange={(e) =>
                              setQuickAddRawMaterialModal((prev) => ({
                                ...prev,
                                cgst_percent: e.target.value,
                              }))
                            }
                            placeholder="0"
                          />
                        </label>

                        <label className="quick-rm-field" htmlFor="qrm-utsgst">
                          UTGST/SGST (%)
                          <input
                            id="qrm-utsgst"
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            disabled={isSavingQuickRm}
                            value={quickAddRawMaterialModal.ut_sgst_percent}
                            onChange={(e) =>
                              setQuickAddRawMaterialModal((prev) => ({
                                ...prev,
                                ut_sgst_percent: e.target.value,
                              }))
                            }
                            placeholder="0"
                          />
                        </label>

                        <label className="quick-rm-field" htmlFor="qrm-igst">
                          IGST (%)
                          <input
                            id="qrm-igst"
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            disabled={isSavingQuickRm}
                            value={quickAddRawMaterialModal.igst_percent}
                            onChange={(e) =>
                              setQuickAddRawMaterialModal((prev) => ({
                                ...prev,
                                igst_percent: e.target.value,
                              }))
                            }
                            placeholder="0"
                          />
                        </label>
                      </div>

                      <div className="form-actions quick-rm-actions">
                        <button
                          className="secondary-action"
                          disabled={isSavingQuickRm}
                          onClick={() => setQuickAddRawMaterialModal(null)}
                          type="button"
                        >
                          {activeSection === "dailyInputs"
                            ? "Cancel & Return to Daily Input"
                            : "Cancel & Return to Product"}
                        </button>
                        <button
                          className="primary-action"
                          disabled={isSavingQuickRm}
                          type="submit"
                        >
                          {isSavingQuickRm
                            ? "Saving Raw Material…"
                            : activeSection === "dailyInputs"
                              ? "Save & Select in Daily Input"
                              : "Save & Return to Product"}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {quickAddProductModal && (
                <div
                  aria-labelledby="quick-prd-title"
                  aria-modal="true"
                  className="modal-overlay quick-rm-overlay"
                  onClick={() => {
                    if (!isSavingQuickPrd) setQuickAddProductModal(null);
                  }}
                  role="presentation"
                >
                  <div
                    className="modal-dialog quick-rm-dialog quick-prd-dialog"
                    onClick={(event) => event.stopPropagation()}
                    role="dialog"
                  >
                    <div className="quick-rm-header">
                      <div className="quick-rm-icon-wrap" style={{ background: "#ede9fe" }}>
                        <span className="quick-rm-icon">⚙️</span>
                      </div>
                      <div className="quick-rm-header-text">
                        <h2 id="quick-prd-title">Add Product</h2>
                        <p className="quick-rm-sub">
                          Enter product details. After saving, you will return directly to Daily Input with this product selected.
                        </p>
                      </div>
                      <button
                        type="button"
                        className="quick-rm-close-btn"
                        disabled={isSavingQuickPrd}
                        onClick={() => setQuickAddProductModal(null)}
                        title="Cancel and return to Daily Input"
                      >
                        ×
                      </button>
                    </div>

                    {quickPrdError && (
                      <p className="workspace-error quick-rm-error" role="alert">
                        {quickPrdError}
                      </p>
                    )}

                    <form className="quick-rm-form" onSubmit={handleSaveQuickProduct}>
                      {/* Product Code Mode Radios */}
                      <div className="form-field-group product-mode-group field-wide">
                        <div className="product-mode-radios">
                          <label className={`product-mode-radio-label ${quickAddProductModal.product_mode === "with_zach_code" ? "selected" : ""}`}>
                            <input
                              type="radio"
                              name="quick_product_mode"
                              value="with_zach_code"
                              checked={quickAddProductModal.product_mode === "with_zach_code"}
                              onChange={() =>
                                setQuickAddProductModal((prev) => ({
                                  ...prev,
                                  product_mode: "with_zach_code",
                                }))
                              }
                              disabled={isSavingQuickPrd}
                            />
                            <span className="radio-custom" />
                            <span className="radio-text">with zach code</span>
                          </label>
                          <label className={`product-mode-radio-label ${quickAddProductModal.product_mode === "without_zach_code" ? "selected" : ""}`}>
                            <input
                              type="radio"
                              name="quick_product_mode"
                              value="without_zach_code"
                              checked={quickAddProductModal.product_mode === "without_zach_code"}
                              onChange={() =>
                                setQuickAddProductModal((prev) => ({
                                  ...prev,
                                  product_mode: "without_zach_code",
                                }))
                              }
                              disabled={isSavingQuickPrd}
                            />
                            <span className="radio-custom" />
                            <span className="radio-text">without zach code</span>
                          </label>
                        </div>
                      </div>

                      <div className="quick-rm-fields-grid">
                        <label className="quick-rm-field field-wide" htmlFor="qprd-name">
                          Product Name *
                          <input
                            id="qprd-name"
                            type="text"
                            required
                            disabled={isSavingQuickPrd}
                            value={quickAddProductModal.name}
                            onChange={(e) =>
                              setQuickAddProductModal((prev) => ({
                                ...prev,
                                name: e.target.value,
                              }))
                            }
                            placeholder="e.g. 10uF 440V Capacitor"
                            autoFocus
                          />
                        </label>

                        <label className="quick-rm-field" htmlFor="qprd-type">
                          Product Type *
                          <select
                            id="qprd-type"
                            disabled={isSavingQuickPrd}
                            value={quickAddProductModal.type}
                            onChange={(e) =>
                              setQuickAddProductModal((prev) => ({
                                ...prev,
                                type: e.target.value,
                              }))
                            }
                          >
                            <option value="element">element</option>
                            <option value="welded element">welded element</option>
                            <option value="capacitor">capacitor</option>
                          </select>
                        </label>

                        {quickAddProductModal.product_mode === "with_zach_code" && (
                          <label className="quick-rm-field" htmlFor="qprd-zach">
                            Zach Code *
                            <input
                              id="qprd-zach"
                              type="text"
                              required
                              disabled={isSavingQuickPrd}
                              value={quickAddProductModal.zach_code}
                              onChange={(e) =>
                                setQuickAddProductModal((prev) => ({
                                  ...prev,
                                  zach_code: e.target.value,
                                }))
                              }
                              placeholder="e.g. ZACH-1029"
                            />
                          </label>
                        )}

                        {quickAddProductModal.product_mode === "without_zach_code" &&
                          quickAddProductModal.type === "welded element" && (
                            <label className="quick-rm-field field-wide" htmlFor="qprd-el">
                              Select Element *
                              <select
                                id="qprd-el"
                                required
                                disabled={isSavingQuickPrd}
                                value={quickAddProductModal.element_id}
                                onChange={(e) =>
                                  setQuickAddProductModal((prev) => ({
                                    ...prev,
                                    element_id: e.target.value,
                                  }))
                                }
                              >
                                <option value="">Select element…</option>
                                {(lookupOptions.products || [])
                                  .filter((p) => String(p.type).toLowerCase() === "element")
                                  .map((el) => (
                                    <option key={el.id} value={el.id}>
                                      {el.name} {el.code ? `(${el.code})` : ""}
                                    </option>
                                  ))}
                              </select>
                            </label>
                          )}

                        {quickAddProductModal.product_mode === "without_zach_code" &&
                          quickAddProductModal.type === "capacitor" && (
                            <label className="quick-rm-field field-wide" htmlFor="qprd-wel">
                              Select Welded Element *
                              <select
                                id="qprd-wel"
                                required
                                disabled={isSavingQuickPrd}
                                value={quickAddProductModal.welded_element_id}
                                onChange={(e) =>
                                  setQuickAddProductModal((prev) => ({
                                    ...prev,
                                    welded_element_id: e.target.value,
                                  }))
                                }
                              >
                                <option value="">Select welded element…</option>
                                {(lookupOptions.products || [])
                                  .filter((p) => String(p.type).toLowerCase() === "welded element")
                                  .map((wel) => (
                                    <option key={wel.id} value={wel.id}>
                                      {wel.name} {wel.code ? `(${wel.code})` : ""}
                                    </option>
                                  ))}
                              </select>
                            </label>
                          )}
                      </div>

                      <div style={{ marginTop: "14px" }}>
                        <ProductRawMaterialsManager
                          value={quickAddProductModal.raw_materials}
                          rawMaterials={lookupOptions.rawMaterials || []}
                          onChange={(nextMaterials) =>
                            setQuickAddProductModal((prev) => ({
                              ...prev,
                              raw_materials: nextMaterials,
                            }))
                          }
                          disabled={isSavingQuickPrd}
                          isWireHighlight={quickAddProductModal.type === "welded element"}
                          onAddNewRawMaterial={(searched) => handleOpenQuickAddRawMaterial(searched)}
                        />
                      </div>

                      <div className="form-actions quick-rm-actions">
                        <button
                          className="secondary-action"
                          disabled={isSavingQuickPrd}
                          onClick={() => setQuickAddProductModal(null)}
                          type="button"
                        >
                          Cancel &amp; Return to Daily Input
                        </button>
                        <button
                          className="primary-action"
                          disabled={isSavingQuickPrd}
                          type="submit"
                        >
                          {isSavingQuickPrd ? "Saving Product…" : "Save & Select Product"}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
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
                      title={
                        activeSection === "dailyInputs"
                          ? "Generate invoice table for viewing, export, and printing"
                          : "Open records as a CSV table for viewing and printing"
                      }
                      type="button"
                    >
                      {activeSection === "dailyInputs" ? "Generate Invoice" : "Open CSV"}
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
            records.every((row) =>
              selectedIds.some((selectedId) => String(selectedId) === String(row.id))
            )
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
          checked={selectedIds.some((selectedId) => String(selectedId) === String(record.id))}
          onChange={() => toggleRowSelection(record.id)}
          aria-label={`Select row ${record.id}`}
        />
      </td>

                          {activeConfig.columns.map(([key]) => {
                            const cellValue = getRelatedCompanyName(key, record[key], record) ?? record[key];
                            return (
                              <td key={key} title={typeof cellValue === "string" ? cellValue : undefined}>
                                {formatCell(cellValue)}
                              </td>
                            );
                          })}
                          <td className="row-actions">
                              <button
                                className="table-action"
                                onClick={() => {
                                  setPageError("");
                                  setNotice("");
                                  setEditingRecord(record);
                                  setFormType(record.type || (activeSection === "costData" ? "Basic" : activeSection === "products" ? "element" : "raw_material"));

                                  const editValues = {};
                                  const fields =
                                    activeConfig.updateFields ||
                                    activeConfig.fields ||
                                    [];

                                  for (const field of fields) {
                                    if (field.name === "password") {
                                      editValues[field.name] = "";
                                    } else if (field.name === "product_mode") {
                                      const hasZach = Boolean(record.has_zach_code || record.zach_code);
                                      editValues.product_mode = hasZach ? "with_zach_code" : "without_zach_code";
                                    } else if (field.name === "zach_code") {
                                      editValues.zach_code = record.zach_code ?? "";
                                    } else if (field.name === "raw_material_ids" || field.name === "raw_materials" || field.type === "multiRawMaterial") {
                                      const rms = Array.isArray(record.raw_materials) && record.raw_materials.length > 0
                                        ? record.raw_materials
                                        : (Array.isArray(record.raw_material_ids)
                                            ? record.raw_material_ids.map((id) => ({ raw_material_id: id, quantity: 1 }))
                                            : (record.raw_material_id ? [{ raw_material_id: record.raw_material_id, quantity: 1 }] : []));
                                      editValues.raw_materials = rms;
                                      editValues.raw_material_ids = rms.map((it) => it.raw_material_id);
                                      editValues[field.name] = rms;
                                    } else if (field.name === "element_id") {
                                      editValues[field.name] = record.element_id ?? "";
                                    } else if (field.name === "welded_element_id") {
                                      editValues[field.name] = record.welded_element_id ?? "";
                                    } else {
                                      editValues[field.name] = record[field.name] ?? "";
                                    }
                                  }

                                  if (activeSection === "products") {
                                    const hasZach = Boolean(record.has_zach_code || record.zach_code);
                                    editValues.product_mode = hasZach ? "with_zach_code" : "without_zach_code";
                                    editValues.zach_code = record.zach_code ?? "";
                                  }

                                  if (activeSection === "dailyInputs") {
                                    editValues.type = record.type ?? "raw_material";
                                    editValues.raw_material_id = record.raw_material_id ?? "";
                                    editValues.product_id = record.product_id ?? "";
                                    editValues.element_id = record.element_id ?? "";
                                  }

                                  // Preserve daily input's own saved values without overwriting with master raw material / element
                                  if (record.type === "raw_material" || record.type === "element") {
                                    if (record.item) editValues.item = record.item;
                                    if (record.unit) editValues.unit = record.unit;
                                    if (record.rate !== undefined && record.rate !== null && record.rate !== "") {
                                      editValues.rate = record.rate;
                                    } else if (record.amount && record.quantity) {
                                      editValues.rate = Number((Number(record.amount) / Number(record.quantity)).toFixed(2));
                                    }
                                    if (record.discount_percent !== undefined && record.discount_percent !== null && record.discount_percent !== "") {
                                      editValues.discount_percent = record.discount_percent;
                                    } else if (record.type === "raw_material") {
                                      const matchedRm = lookupOptions.rawMaterials?.find(
                                        (m) => String(m.id) === String(record.raw_material_id)
                                      );
                                      if (matchedRm && matchedRm.discount_percent !== undefined && matchedRm.discount_percent !== null) {
                                        editValues.discount_percent = matchedRm.discount_percent;
                                      }
                                    }
                                    if (record.amount && Number(record.amount) > 0) {
                                      if (record.cgst_amount) {
                                        editValues.cgst_percent = Number(((Number(record.cgst_amount) * 100) / Number(record.amount)).toFixed(2));
                                      }
                                      if (record.ut_sgst_amount) {
                                        editValues.ut_sgst_percent = Number(((Number(record.ut_sgst_amount) * 100) / Number(record.amount)).toFixed(2));
                                      }
                                      if (record.igst_amount) {
                                        editValues.igst_percent = Number(((Number(record.igst_amount) * 100) / Number(record.amount)).toFixed(2));
                                      }
                                    }
                                  } else if (record.type === "other") {
                                    const details = record.other_details || {};
                                    editValues.material_name = details.material_name || record.item || "";
                                    editValues.item = details.material_name || record.item || "";
                                    editValues.hsn_code = details.hsn_code || "";
                                    editValues.unit = details.unit || record.unit || "";
                                    editValues.rate = details.rate ?? record.rate ?? "";
                                    editValues.supplier_company_name = details.supplier_company_name || details.company_name || "";
                                    editValues.supplier_contact_person = details.supplier_contact_person || details.contact_person || "";
                                    editValues.supplier_email = details.supplier_email || details.email || "";
                                    editValues.supplier_phone = details.supplier_phone || details.phone || "";
                                    editValues.supplier_address = details.supplier_address || details.address || "";
                                    editValues.supplier_city = details.supplier_city || details.city || "";
                                    editValues.supplier_state = details.supplier_state || details.state || "";
                                    editValues.supplier_gst_number = details.supplier_gst_number || details.gst_number || "";
                                    if (details.discount_percent !== undefined && details.discount_percent !== null) {
                                      editValues.discount_percent = details.discount_percent;
                                    } else if (record.discount_percent !== undefined && record.discount_percent !== null) {
                                      editValues.discount_percent = record.discount_percent;
                                    }
                                    if (details.cgst_percent !== undefined && details.cgst_percent !== null) {
                                      editValues.cgst_percent = details.cgst_percent;
                                    } else if (record.amount && record.cgst_amount) {
                                      editValues.cgst_percent = Number(((Number(record.cgst_amount) * 100) / Number(record.amount)).toFixed(2));
                                    }
                                    if (details.ut_sgst_percent !== undefined && details.ut_sgst_percent !== null) {
                                      editValues.ut_sgst_percent = details.ut_sgst_percent;
                                    } else if (record.amount && record.ut_sgst_amount) {
                                      editValues.ut_sgst_percent = Number(((Number(record.ut_sgst_amount) * 100) / Number(record.amount)).toFixed(2));
                                    }
                                    if (details.igst_percent !== undefined && details.igst_percent !== null) {
                                      editValues.igst_percent = details.igst_percent;
                                    } else if (record.amount && record.igst_amount) {
                                      editValues.igst_percent = Number(((Number(record.igst_amount) * 100) / Number(record.amount)).toFixed(2));
                                    }
                                  }

                                  setFormValues(editValues);
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
                    className="modal-dialog csv-options-dialog"
                    onClick={(event) => event.stopPropagation()}
                    role="dialog"
                  >
                    <div className="record-form-heading">
                      <h2 id="csv-modal-title">
                        {activeSection === "dailyInputs" ? "Generate Invoice" : "Open CSV"}
                      </h2>
                      <p>
                        {activeSection === "dailyInputs"
                          ? "Choose columns and optional field filters, plus a bill date range. Matching records will generate an invoice table with total additions."
                          : "Choose columns and optional field filters. Matching records will open for viewing and printing."}
                      </p>
                    </div>

                    <form className="invoice-modal-form csv-options-form" onSubmit={handleDownloadCsv}>
                      {pageError && (
                        <p className="workspace-error" role="alert">{pageError}</p>
                      )}

                      {activeSection === "dailyInputs" && (
                        <div className="csv-date-range">
                          <label className="invoice-name-field" htmlFor="csv-bill-date-from">
                            <span>From Bill Date</span>
                            <input
                              autoFocus
                              id="csv-bill-date-from"
                              onChange={(event) => setCsvBillDateFrom(event.target.value)}
                              required
                              type="date"
                              value={csvBillDateFrom}
                            />
                          </label>
                          <label className="invoice-name-field" htmlFor="csv-bill-date-to">
                            <span>To Bill Date</span>
                            <input
                              id="csv-bill-date-to"
                              min={csvBillDateFrom || undefined}
                              onChange={(event) => setCsvBillDateTo(event.target.value)}
                              required
                              type="date"
                              value={csvBillDateTo}
                            />
                          </label>
                        </div>
                      )}

                      <div className="invoice-select-list">
                        <div className="invoice-select-heading">
                          <strong>
                            Columns ({csvSelectedColumns.length}/{activeConfig.columns.length})
                          </strong>
                          <button
                            className="refresh-button"
                            onClick={() => {
                              const allKeys = activeConfig.columns.map(([key]) => key);
                              const allSelected = allKeys.every((key) =>
                                csvSelectedColumns.includes(key),
                              );
                              setCsvSelectedColumns(allSelected ? [] : allKeys);
                            }}
                            type="button"
                          >
                            {activeConfig.columns.every(([key]) =>
                              csvSelectedColumns.includes(key),
                            )
                              ? "Clear all"
                              : "Select all"}
                          </button>
                        </div>
                        <div className="csv-column-grid">
                          {activeConfig.columns.map(([key, label]) => (
                            <label className="csv-check-option" key={key}>
                              <input
                                checked={csvSelectedColumns.includes(key)}
                                onChange={() => toggleCsvColumn(key)}
                                type="checkbox"
                              />
                              <span>{label}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="invoice-select-list">
                        <div className="invoice-select-heading">
                          <strong>Field filters</strong>
                        </div>

                        <div className="csv-filter-list">
                          <p className="csv-filter-empty">
                            Choose a field (for example Supplier), then tick one or more values from the list.
                            You can add multiple fields.
                          </p>

                          <div className="csv-filter-add">
                            <label className="invoice-name-field csv-filter-field-picker" htmlFor="csv-filter-field">
                              <span>Filter field</span>
                              <select
                                id="csv-filter-field"
                                onChange={(event) => {
                                  const field = event.target.value;
                                  setCsvFilterFieldToAdd(field);
                                  if (field) addCsvFilterField(field);
                                }}
                                value=""
                              >
                                <option value="">
                                  Select a field to filter…
                                </option>
                                {activeConfig.columns
                                  .filter(
                                    ([key]) =>
                                      !Object.prototype.hasOwnProperty.call(csvValueFilters, key),
                                  )
                                  .map(([key, label]) => (
                                    <option key={key} value={key}>
                                      {label}
                                    </option>
                                  ))}
                              </select>
                            </label>
                          </div>

                          {Object.keys(csvValueFilters).length === 0 ? (
                            <p className="empty-state">
                              No filters added yet. Pick a field above to view and multi-select its values.
                            </p>
                          ) : (
                            Object.entries(csvValueFilters).map(([field, selectedValues]) => {
                              const fieldLabel =
                                activeConfig.columns.find(([key]) => key === field)?.[1] || field;
                              const options = getCsvFilterOptions(field);
                              const optionSearch = (csvFilterOptionSearch[field] || "")
                                .trim()
                                .toLocaleLowerCase();
                              const visibleOptions = optionSearch
                                ? options.filter((option) =>
                                    String(option.label).toLocaleLowerCase().includes(optionSearch)
                                    || String(option.value).toLocaleLowerCase().includes(optionSearch),
                                  )
                                : options;
                              const allVisibleSelected =
                                visibleOptions.length > 0
                                && visibleOptions.every((option) =>
                                  selectedValues.some(
                                    (value) => String(value) === String(option.value),
                                  ),
                                );

                              return (
                                <div className="csv-filter-block" key={field}>
                                  <div className="csv-filter-block-heading">
                                    <strong>{fieldLabel}</strong>
                                    <div className="csv-filter-block-actions">
                                      <button
                                        className="refresh-button"
                                        disabled={visibleOptions.length === 0}
                                        onClick={() => {
                                          if (allVisibleSelected) {
                                            const visibleSet = new Set(
                                              visibleOptions.map((option) => String(option.value)),
                                            );
                                            setAllCsvFilterValues(
                                              field,
                                              selectedValues.filter(
                                                (value) => !visibleSet.has(String(value)),
                                              ),
                                            );
                                          } else {
                                            const merged = new Set([
                                              ...selectedValues.map(String),
                                              ...visibleOptions.map((option) => String(option.value)),
                                            ]);
                                            setAllCsvFilterValues(field, [...merged]);
                                          }
                                        }}
                                        type="button"
                                      >
                                        {allVisibleSelected ? "Clear visible" : "Select visible"}
                                      </button>
                                      <button
                                        className="refresh-button"
                                        onClick={() => removeCsvFilterField(field)}
                                        type="button"
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  </div>

                                  <div className="csv-filter-search-wrap">
                                    <input
                                      onChange={(event) =>
                                        setCsvFilterOptionSearch((prev) => ({
                                          ...prev,
                                          [field]: event.target.value,
                                        }))
                                      }
                                      placeholder={`Search ${fieldLabel.toLowerCase()}…`}
                                      type="search"
                                      value={csvFilterOptionSearch[field] || ""}
                                    />
                                  </div>

                                  <div className="invoice-select-scroll csv-filter-options">
                                    {options.length === 0 ? (
                                      <p className="empty-state">No values available for this field.</p>
                                    ) : visibleOptions.length === 0 ? (
                                      <p className="empty-state">No values match your search.</p>
                                    ) : (
                                      visibleOptions.map((option) => (
                                        <label
                                          className="invoice-select-row"
                                          key={`${field}-${option.value}`}
                                        >
                                          <input
                                            checked={selectedValues.some(
                                              (value) => String(value) === String(option.value),
                                            )}
                                            onChange={() =>
                                              toggleCsvFilterValue(field, option.value)
                                            }
                                            type="checkbox"
                                          />
                                          <span>{option.label}</span>
                                        </label>
                                      ))
                                    )}
                                  </div>
                                  <p className="csv-filter-hint">
                                    {selectedValues.length === 0
                                      ? `Tick one or more ${fieldLabel.toLowerCase()} values below.`
                                      : `${selectedValues.length} ${fieldLabel.toLowerCase()} value(s) selected.`}
                                  </p>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>

                      {activeSection !== "dailyInputs" && (
                        <>
                          <label className="invoice-name-field" htmlFor="csv-search">
                            <span>Search</span>
                            <input
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
                                {csvSelectedIds.length > 0
                                  ? `${csvSelectedIds.length} row(s) selected`
                                  : `${csvFilteredRecords.length} matching row(s)`}
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
                                    : "No records match your search/filters."}
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
                        </>
                      )}

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
                          disabled={
                            isExportingCsv
                            || csvSelectedColumns.length === 0
                            || (
                              activeSection === "dailyInputs"
                              && (!csvBillDateFrom || !csvBillDateTo)
                            )
                          }
                          type="submit"
                        >
                          {isExportingCsv
                            ? "Opening…"
                            : (activeSection === "dailyInputs" ? "Generate Invoice" : "Open CSV")}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {csvPreview && (
                <div
                  aria-labelledby="csv-preview-title"
                  aria-modal="true"
                  className="modal-overlay csv-preview-overlay"
                  role="presentation"
                >
                  <div
                    className="modal-dialog csv-preview-dialog"
                    onClick={(event) => event.stopPropagation()}
                    role="dialog"
                  >
                    <div className="csv-preview-toolbar no-print">
                      <div className="record-form-heading">
                        <h2 id="csv-preview-title">{csvPreview.title}</h2>
                        <p>{csvPreview.subtitle}</p>
                      </div>
                      <div className="form-actions">
                        <button
                          className="secondary-action"
                          onClick={closeCsvPreview}
                          type="button"
                        >
                          Close
                        </button>
                        <button
                          className="secondary-action action-btn-csv"
                          onClick={handleDownloadCsvFromPreview}
                          title="Download as CSV file with grand totals"
                          type="button"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                          </svg>
                          Download CSV
                        </button>
                        <button
                          className="secondary-action action-btn-pdf"
                          onClick={handleDownloadPdfFromPreview}
                          title="Download as PDF document"
                          type="button"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <line x1="16" y1="13" x2="8" y2="13"></line>
                            <line x1="16" y1="17" x2="8" y2="17"></line>
                            <polyline points="10 9 9 9 8 9"></polyline>
                          </svg>
                          Download PDF
                        </button>
                        <button
                          className="csv-download-button"
                          onClick={handlePrintCsvPreview}
                          title="Print or view print preview"
                          type="button"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 6 2 18 2 18 9"></polyline>
                            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                            <rect x="6" y="14" width="12" height="8"></rect>
                          </svg>
                          Print
                        </button>
                      </div>
                    </div>

                    <div className="csv-preview-sheet" id="csv-print-area">
                      <div className="csv-preview-print-heading">
                        <h1>{csvPreview.title}</h1>
                        <p>{csvPreview.subtitle}</p>
                      </div>

                      <div className="csv-preview-summary-card">
                        <div className="summary-item">
                          <span className="summary-label">Total Records</span>
                          <span className="summary-value">{csvPreview.recordCount}</span>
                        </div>
                        {csvPreview.totalAmountSum > 0 && (
                          <div className="summary-item highlight">
                            <span className="summary-label">Total Amount</span>
                            <span className="summary-value">
                              ₹{csvPreview.totalAmountSum.toLocaleString("en-IN", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </span>
                          </div>
                        )}
                        {csvPreview.amountSum > 0 && (
                          <div className="summary-item">
                            <span className="summary-label">Taxable Amount</span>
                            <span className="summary-value">
                              ₹{csvPreview.amountSum.toLocaleString("en-IN", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </span>
                          </div>
                        )}
                        {((csvPreview.cgstSum || 0) + (csvPreview.utSgstSum || 0) + (csvPreview.igstSum || 0)) > 0 && (
                          <div className="summary-item">
                            <span className="summary-label">Total Tax</span>
                            <span className="summary-value">
                              ₹{((csvPreview.cgstSum || 0) + (csvPreview.utSgstSum || 0) + (csvPreview.igstSum || 0)).toLocaleString("en-IN", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="csv-preview-table-wrap">
                        <table className="csv-preview-table">
                          <thead>
                            <tr>
                              {csvPreview.columnLabels.map((label, colIndex) => {
                                const key = csvPreview.columnKeys?.[colIndex];
                                const isNum = isNumericColumn(key);
                                return (
                                  <th key={label} className={isNum ? "num-col" : ""}>
                                    {label}
                                  </th>
                                );
                              })}
                            </tr>
                          </thead>
                          <tbody>
                            {csvPreview.rows.map((row, rowIndex) => (
                              <tr key={`csv-row-${rowIndex}`}>
                                {row.map((cell, cellIndex) => {
                                  const key = csvPreview.columnKeys?.[cellIndex];
                                  const isNum = isNumericColumn(key);
                                  return (
                                    <td
                                      key={`csv-cell-${rowIndex}-${cellIndex}`}
                                      className={isNum ? "num-col" : ""}
                                    >
                                      {cell || "—"}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                          {csvPreview.totalsRow && (
                            <tfoot>
                              <tr className="csv-preview-totals-row">
                                {csvPreview.totalsRow.map((cell, cellIndex) => {
                                  const key = csvPreview.columnKeys?.[cellIndex];
                                  const isNum = isNumericColumn(key);
                                  const isTotalAmount = key === "total_amount";
                                  let displayVal = cell;
                                  if (cell && !isNaN(Number(cell)) && cellIndex !== 0) {
                                    if (key !== "quantity") {
                                      displayVal = "₹" + Number(cell).toLocaleString("en-IN", {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      });
                                    }
                                  }
                                  return (
                                    <td
                                      key={`csv-total-${cellIndex}`}
                                      className={`${isNum ? "num-col" : ""} ${isTotalAmount ? "total-amount-highlight" : ""}`}
                                    >
                                      {displayVal || ""}
                                    </td>
                                  );
                                })}
                              </tr>
                            </tfoot>
                          )}
                        </table>
                      </div>
                    </div>
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
