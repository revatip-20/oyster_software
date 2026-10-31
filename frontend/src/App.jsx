import React, { Component, Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { navigation, sections, INDIAN_STATES } from "./workspace.js";

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
  placeholderOverride = "",
  title = "",
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

  // Filter raw materials based on search term (shows all raw materials when not searching)
  const filteredMaterials = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    let list = rawMaterials || [];
    if (!q) return list;
    return list.filter((rm) => {
      const name = String(rm.material_name || "").trim().toLowerCase();
      const code = String(rm.code || "").trim().toLowerCase();
      const hsn = String(rm.hsn_code || "").trim().toLowerCase();
      return (
        name.includes(q) ||
        (code && code.includes(q)) ||
        (hsn && hsn.includes(q))
      );
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
            {title ? `${title} (${items.length})` : `Raw Materials in this Element (${items.length})`}
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
                Click any raw material below to select it
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
                placeholder={
                  placeholderOverride ||
                  (isWireHighlight
                    ? "Search wires by name or code..."
                    : "Search raw materials by name or code...")
                }
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
                    Raw Materials (<strong>{rawMaterials.length}</strong> available)
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
                    <div className="prm-empty-state" style={{ padding: "10px", textAlign: "center", color: "#64748b", fontSize: "12px" }}>
                      No raw materials found.
                      {onAddNewRawMaterial && (
                        <div style={{ marginTop: "8px" }}>
                          <button
                            type="button"
                            className="prm-not-found-yes-btn"
                            onClick={() => onAddNewRawMaterial("")}
                          >
                            + Add Raw Material
                          </button>
                        </div>
                      )}
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


function ConsumptionProductPicker({
  products = [],
  selectedProductId = "",
  onSelectProduct,
  onDeselectProduct,
  disabled = false,
  isLoading = false,
  error = "",
  onRetry,
}) {
  const [searchTerm, setSearchTerm] = useState("");

  const selectedProduct = useMemo(() => {
    if (!selectedProductId) return null;
    return products.find((p) => String(p.id) === String(selectedProductId)) || null;
  }, [selectedProductId, products]);

  const filteredProducts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return products || [];
    return (products || []).filter((p) => {
      const name = String(p.name || "").toLowerCase();
      const code = String(p.code || "").toLowerCase();
      const type = String(p.type || "").toLowerCase();
      const zach = String(p.zach_code || "").toLowerCase();
      return name.includes(q) || code.includes(q) || type.includes(q) || zach.includes(q);
    });
  }, [products, searchTerm]);

  return (
    <div className="di-box consumption-product-picker">
      <div className="di-picker-header">
        <span className="di-picker-title">
          Product Selection{" "}
          <span className="di-picker-subtext">
            ({(products || []).length} available)
          </span>
        </span>

        {selectedProduct ? (
          <div className="di-selected-pill">
            <span className="di-type-badge type-prd">✓ PRODUCT SELECTED</span>
            <span className="di-selected-name">
              <strong>{selectedProduct.name}</strong>
              {selectedProduct.code && ` [${selectedProduct.code}]`}
              {selectedProduct.type && ` • ${selectedProduct.type}`}
              {selectedProduct.zach_code && ` • Zach: ${selectedProduct.zach_code}`}
            </span>
            <button
              type="button"
              className="di-deselect-btn"
              onClick={onDeselectProduct}
              title="Change product"
              disabled={disabled}
            >
              ✕ Change Product
            </button>
          </div>
        ) : (
          <div className="di-unselected-warning">
            <span className="di-warn-icon">👉</span>
            <span>Please click to select a <strong>Product</strong> from the list below *</span>
          </div>
        )}
      </div>

      {!selectedProduct && (
        <>
          <div className="di-control-bar">
            <div className="di-search-wrap">
              <span className="di-search-icon" aria-hidden="true">🔍</span>
              <input
                type="text"
                className="di-search-input"
                placeholder="Search product by name, code, type, Zach code... (Press Enter to select)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (filteredProducts.length > 0) {
                      onSelectProduct(filteredProducts[0]);
                    }
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

          <div className="di-list-container">
            <div className="di-list-scroll">
              {isLoading ? (
                <div className="di-list-loading">Loading products…</div>
              ) : filteredProducts.length === 0 ? (
                <div className="di-list-empty">
                  <div className="di-empty-prompt">
                    <p style={{ margin: "4px 0" }}>
                      {searchTerm.trim()
                        ? `No products matching "${searchTerm.trim()}"`
                        : "No products available in master files."}
                    </p>
                  </div>
                </div>
              ) : (
                filteredProducts.map((p) => {
                  const isSelected = String(selectedProductId) === String(p.id);
                  return (
                    <div
                      key={p.id}
                      className={`di-item-row ${isSelected ? "selected" : ""} row-prd`}
                      onClick={() => onSelectProduct(p)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onSelectProduct(p);
                        }
                      }}
                    >
                      <div className="di-row-radio">
                        <span className={`di-radio-circle ${isSelected ? "active" : ""}`} />
                      </div>
                      <span className="di-type-tag tag-prd">PRODUCT</span>
                      <div className="di-item-info">
                        <span className="di-item-name">{p.name}</span>
                        {p.code && <span className="di-item-code">[{p.code}]</span>}
                        {p.zach_code && <span className="di-item-zach">Zach: {p.zach_code}</span>}
                        {p.type && <span className="di-item-subtype">({p.type})</span>}
                      </div>
                      <div className="di-item-meta">
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
    </div>
  );
}

function ConsumptionMaterialsPicker({
  value = [],
  rawMaterials = [],
  onChange,
  disabled = false,
  isLoading = false,
  error = "",
  onRetry,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [pendingMaterialId, setPendingMaterialId] = useState("");
  const [addError, setAddError] = useState("");

  const rawMaterialMap = useMemo(() => {
    return new Map((rawMaterials || []).map((rm) => [Number(rm.id), rm]));
  }, [rawMaterials]);

  // Normalized list of added raw materials
  const items = useMemo(() => {
    if (!Array.isArray(value)) return [];
    return value
      .map((it) => {
        if (!it) return null;
        const id = Number(it.raw_material_id || it.id);
        if (!id) return null;
        const master = rawMaterialMap.get(id);
        return {
          raw_material_id: id,
          quantity: it.quantity !== undefined && it.quantity !== null && it.quantity !== "" ? it.quantity : 1,
          material_name: master?.material_name || it.material_name || `Raw Material #${id}`,
          code: master?.code || it.code || "",
          unit: master?.unit || it.unit || "",
        };
      })
      .filter(Boolean);
  }, [value, rawMaterialMap]);

  const handleUpdateQty = (id, newQty) => {
    if (disabled) return;
    const next = items.map((it) => (it.raw_material_id === id ? { ...it, quantity: newQty } : it));
    onChange(next);
  };

  const handleRemove = (id) => {
    if (disabled) return;
    const next = items.filter((it) => it.raw_material_id !== id);
    onChange(next);
  };

  const handleAddMaterial = (rmId, qtyToAdd = 1) => {
    if (disabled) return;
    setAddError("");
    const numId = Number(rmId);
    if (!numId) {
      setAddError("Please select a raw material.");
      return;
    }
    const numQty = parseFloat(qtyToAdd);
    if (isNaN(numQty) || numQty <= 0) {
      setAddError("Please enter a valid quantity greater than 0.");
      return;
    }

    const existingIdx = items.findIndex((it) => it.raw_material_id === numId);
    let next;
    if (existingIdx >= 0) {
      next = items.map((it, idx) =>
        idx === existingIdx ? { ...it, quantity: Number(it.quantity || 0) + numQty } : it
      );
    } else {
      const rm = rawMaterialMap.get(numId);
      next = [
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
    onChange(next);
    setPendingMaterialId("");
  };

  const filteredMaterials = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return rawMaterials || [];
    return (rawMaterials || []).filter((rm) => {
      const name = String(rm.material_name || "").toLowerCase();
      const code = String(rm.code || "").toLowerCase();
      const hsn = String(rm.hsn_code || "").toLowerCase();
      return name.includes(q) || code.includes(q) || hsn.includes(q);
    });
  }, [rawMaterials, searchTerm]);

  return (
    <div className="consumption-materials-manager di-box">
      {/* 1. Added Raw Materials Section */}
      <div className="prm-added-section">
        <div className="prm-section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="prm-section-title" style={{ fontSize: "14px", fontWeight: "700" }}>
            Raw Materials Consumed ({items.length})
          </span>
          {items.length > 0 && !disabled && (
            <button
              type="button"
              className="prm-clear-btn"
              onClick={() => onChange([])}
              style={{ fontSize: "12px", color: "#dc2626", background: "none", border: "none", cursor: "pointer" }}
            >
              Clear all
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="prm-empty-state" style={{ padding: "12px", background: "#f8fafc", borderRadius: "6px", textAlign: "center", color: "#64748b", border: "1px dashed #cbd5e1", marginTop: "6px" }}>
            No raw materials added yet. Search or click <strong>+ Add</strong> on any raw material below.
          </div>
        ) : (
          <div className="prm-items-list" style={{ display: "flex", flexDirection: "column", gap: "8px", margin: "8px 0" }}>
            {items.map((item) => (
              <div
                key={item.raw_material_id}
                className="prm-item-card"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  background: "#ffffff",
                  border: "1.5px solid #e2e8f0",
                  borderRadius: "6px",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.03)"
                }}
              >
                <div className="prm-item-details" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontWeight: "600", color: "#0f172a" }}>{item.material_name}</span>
                  {item.code && <span className="prm-code-badge" style={{ fontSize: "11px", background: "#f1f5f9", padding: "2px 6px", borderRadius: "4px" }}>[{item.code}]</span>}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <label style={{ fontSize: "12px", color: "#64748b", fontWeight: "600" }}>Quantity:</label>
                  <input
                    type="number"
                    step="any"
                    min="0.0001"
                    value={item.quantity}
                    onChange={(e) => handleUpdateQty(item.raw_material_id, e.target.value)}
                    style={{ width: "80px", padding: "4px 8px", borderRadius: "4px", border: "1.5px solid #cbd5e1", textAlign: "right" }}
                    disabled={disabled}
                  />
                  <span style={{ fontSize: "12px", fontWeight: "600", color: "#334155" }}>{item.unit || "unit"}</span>
                  <button
                    type="button"
                    onClick={() => handleRemove(item.raw_material_id)}
                    style={{ background: "#fee2e2", color: "#ef4444", border: "none", borderRadius: "4px", padding: "4px 8px", cursor: "pointer", fontWeight: "700" }}
                    title="Remove raw material"
                    disabled={disabled}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. Search & Add Raw Materials */}
      <div className="prm-add-container" style={{ marginTop: "12px" }}>
        <div className="prm-add-header-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <span className="prm-add-title" style={{ fontWeight: "700", color: "#1e293b", fontSize: "13px" }}>
            Search & Add Raw Materials ({(rawMaterials || []).length} available):
          </span>
          {addError && <span style={{ color: "#ef4444", fontSize: "12px", fontWeight: "600" }}>{addError}</span>}
        </div>

        {/* Search Bar */}
        <div className="di-control-bar" style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
          <div className="di-search-wrap" style={{ flex: 1, position: "relative", display: "flex", alignItems: "center" }}>
            <span className="di-search-icon" aria-hidden="true" style={{ position: "absolute", left: "10px" }}>🔍</span>
            <input
              type="text"
              className="di-search-input"
              placeholder="Search raw material by name or code to add..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (filteredMaterials.length > 0) {
                    handleAddMaterial(filteredMaterials[0].id, 1);
                  }
                }
              }}
              style={{ width: "100%", padding: "6px 10px 6px 32px", borderRadius: "6px", border: "1.5px solid #cbd5e1" }}
              disabled={disabled || isLoading}
            />
            {searchTerm && (
              <button
                type="button"
                className="di-clear-search-btn"
                onClick={() => setSearchTerm("")}
                style={{ position: "absolute", right: "10px", background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Scrollable List of Raw Materials with Direct "+ Add" Action */}
        <div className="di-list-container" style={{ maxHeight: "240px", overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: "6px" }}>
          {isLoading ? (
            <div style={{ padding: "16px", textAlign: "center", color: "#64748b" }}>Loading raw materials…</div>
          ) : filteredMaterials.length === 0 ? (
            <div style={{ padding: "16px", textAlign: "center", color: "#64748b" }}>
              No raw materials found matching "{searchTerm}".
            </div>
          ) : (
            filteredMaterials.map((rm) => {
              const addedItem = items.find((it) => it.raw_material_id === Number(rm.id));
              const isSelected = Number(pendingMaterialId) === Number(rm.id);

              return (
                <div
                  key={rm.id}
                  className={`di-item-row ${addedItem ? "selected" : ""}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "6px 12px",
                    borderBottom: "1px solid #f1f5f9",
                    background: addedItem ? "#f0fdf4" : isSelected ? "#eff6ff" : "#ffffff",
                    cursor: "pointer",
                  }}
                  onClick={() => {
                    setPendingMaterialId(rm.id);
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1 }}>
                    <span style={{ fontWeight: "600", color: "#1e293b", fontSize: "13px" }}>{rm.material_name}</span>
                    {rm.code && <span style={{ fontSize: "11px", background: "#f1f5f9", padding: "1px 5px", borderRadius: "4px", color: "#475569" }}>[{rm.code}]</span>}
                    {rm.unit && <span style={{ fontSize: "11px", color: "#64748b" }}>({rm.unit})</span>}
                    {addedItem && (
                      <span style={{ fontSize: "11px", color: "#166534", fontWeight: "700", background: "#dcfce7", padding: "2px 6px", borderRadius: "4px" }}>
                        ✓ Added (Qty: {addedItem.quantity} {addedItem.unit || rm.unit || ""})
                      </span>
                    )}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }} onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="prm-add-btn"
                      onClick={() => handleAddMaterial(rm.id, 1)}
                      style={{
                        padding: "4px 12px",
                        fontSize: "12px",
                        fontWeight: "600",
                        background: "#2563eb",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: "5px",
                        cursor: "pointer",
                      }}
                    >
                      {addedItem ? "+ Add More" : "+ Add"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

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

  // Normalize selectedType ("raw_material" | "product" | "other" | "")
  const currentType =
    selectedType === "product" || selectedType === "element"
      ? "product"
      : selectedType === "raw_material"
      ? "raw_material"
      : selectedType === "other"
      ? "other"
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
      {/* 1. SHOW THE DROP DOWN FIRST: RAW MATERIAL, PRODUCT, OR OTHER */}
      <div className="di-type-dropdown-section">
        <label className="di-type-dropdown-label" htmlFor="di-type-dropdown-select">
          Select Item Type: <span className="di-select-only-one">Raw Material, Product, or Other</span> *
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
            <option value="">-- Select Item Type --</option>
            <option value="raw_material">Raw Material</option>
            <option value="product">Product</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      {/* 2. AND THEN SHOW THE BOX */}
      <div className={`di-box ${hasError && !selectedItem ? "di-box-error" : ""}`}>
        {!currentType ? (
          <div className="di-box-empty-prompt">
            <span className="di-box-empty-icon">👆</span>
            <p className="di-box-empty-text">
              Please select <strong>Raw Material</strong>, <strong>Product</strong>, or <strong>Other</strong> from the dropdown above.
            </p>
          </div>
        ) : currentType === "other" ? (
          <div className="di-box-other-prompt">
            <span className="di-box-empty-icon">📝</span>
            <p className="di-box-empty-text">
              <strong>Other / Custom Item</strong> selected. Please specify the item name, material details, and supplier information directly in the form fields below.
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
                    Please click to select a <strong>{currentType === "raw_material" ? "Raw Material" : "Product"}</strong> from the list below *
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
                          ? "Search raw material by name, code... (Press Enter to select)"
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
                  {currentType === "raw_material" && onAddNewRawMaterial && (
                    <button
                      type="button"
                      className="di-add-btn-quick di-add-btn-quick-rm"
                      onClick={() => onAddNewRawMaterial(searchTerm.trim())}
                      title="Raw material does not exist? Click to add it"
                    >
                      + Raw material does not exist? Add it
                    </button>
                  )}
                  {currentType === "product" && onAddNewProduct && (
                    <button
                      type="button"
                      className="di-add-btn-quick di-add-btn-quick-prd"
                      onClick={() => onAddNewProduct(searchTerm.trim())}
                      title="Product does not exist? Click to add it"
                    >
                      + Product does not exist? Add it
                    </button>
                  )}
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
                              <span className="di-not-found-q">Cannot find it?</span>
                              <div className="di-not-found-actions">
                                {currentType === "raw_material" ? (
                                  <button
                                    type="button"
                                    className="di-add-btn-rm di-add-btn-quick-rm"
                                    onClick={() => onAddNewRawMaterial && onAddNewRawMaterial(searchTerm.trim())}
                                  >
                                    + Raw material does not exist? Add it
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className="di-add-btn-prd di-add-btn-quick-prd"
                                    onClick={() => onAddNewProduct && onAddNewProduct(searchTerm.trim())}
                                  >
                                    + Product does not exist? Add it
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
                              <div>
                                <p style={{ margin: "4px 0" }}>No raw materials available in inventory.</p>
                                {onAddNewRawMaterial && (
                                  <div style={{ marginTop: "8px" }}>
                                    <button
                                      type="button"
                                      className="di-add-btn-quick di-add-btn-quick-rm"
                                      onClick={() => onAddNewRawMaterial("")}
                                    >
                                      + Add Raw Material
                                    </button>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div>
                                <p style={{ margin: "4px 0" }}>No products available in inventory.</p>
                                {onAddNewProduct && (
                                  <div style={{ marginTop: "8px" }}>
                                    <button
                                      type="button"
                                      className="di-add-btn-quick di-add-btn-quick-prd"
                                      onClick={() => onAddNewProduct("")}
                                    >
                                      + Add Product
                                    </button>
                                  </div>
                                )}
                              </div>
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

function DailyInputSupplierPicker({
  suppliers = [],
  selectedSupplierId = "",
  onSelect,
  onDeselect,
  onAddNewSupplier,
  disabled = false,
  isLoading = false,
  error = "",
  onRetry,
  hasError = false,
  required = true,
}) {
  const [searchTerm, setSearchTerm] = useState("");

  const selectedSupplier = useMemo(() => {
    if (!selectedSupplierId) return null;
    const s = suppliers.find((sup) => String(sup.id) === String(selectedSupplierId));
    if (s) return s;
    return { id: selectedSupplierId, company_name: `Supplier #${selectedSupplierId}` };
  }, [suppliers, selectedSupplierId]);

  const filteredSuppliers = useMemo(() => {
    const list = suppliers.map((s) => ({
      id: s.id,
      company_name: s.company_name || `Supplier #${s.id}`,
      code: s.code,
      contact_person: s.contact_person,
      phone: s.phone,
      city: s.city,
      state: s.state,
      gst_number: s.gst_number,
      _orig: s,
    }));

    const q = searchTerm.trim().toLowerCase();
    if (!q) return list;

    return list.filter((s) => {
      const name = String(s.company_name || "").trim().toLowerCase();
      const code = String(s.code || "").trim().toLowerCase();
      const contact = String(s.contact_person || "").trim().toLowerCase();
      const phone = String(s.phone || "").trim().toLowerCase();
      const city = String(s.city || "").trim().toLowerCase();
      const gst = String(s.gst_number || "").trim().toLowerCase();
      return (
        name.startsWith(q) ||
        (code && code.startsWith(q)) ||
        name.includes(q) ||
        contact.includes(q) ||
        phone.includes(q) ||
        city.includes(q) ||
        gst.includes(q)
      );
    });
  }, [suppliers, searchTerm]);

  const handleSupplierClick = (s) => {
    if (disabled || !s) return;
    onSelect(s._orig || s);
  };

  return (
    <div className="di-picker-container di-supplier-picker-container">
      <div className={`di-box ${hasError && !selectedSupplier ? "di-box-error" : ""}`}>
        {/* Header with Selected Pill or Instruction */}
        <div className="di-picker-header">
          <span className="di-picker-title">
            Supplier Selection {required ? "*" : ""}{" "}
            <span className="di-picker-subtext">
              {searchTerm.trim()
                ? `(${filteredSuppliers.length} matching of ${suppliers.length})`
                : `(${suppliers.length} available)`}
            </span>
          </span>

          {selectedSupplier ? (
            <div className="di-selected-pill">
              <span className="di-type-badge type-sup">
                ✓ SUPPLIER SELECTED
              </span>
              <span className="di-selected-name">
                <strong>{selectedSupplier.company_name}</strong>
                {selectedSupplier.code && ` [${selectedSupplier.code}]`}
                {selectedSupplier.contact_person && ` • 👤 ${selectedSupplier.contact_person}`}
                {selectedSupplier.phone && ` • 📞 ${selectedSupplier.phone}`}
                {selectedSupplier.city && ` • 📍 ${selectedSupplier.city}`}
                {selectedSupplier.gst_number && ` • GST: ${selectedSupplier.gst_number}`}
              </span>
              <button
                type="button"
                className="di-deselect-btn"
                onClick={onDeselect}
                title="Change or deselect this supplier"
                disabled={disabled}
              >
                ✕ Change
              </button>
            </div>
          ) : (
            <div className="di-unselected-warning">
              <span className="di-warn-icon">👉</span>
              <span>
                Please search for and select a <strong>Supplier</strong> from the list below {required ? "*" : ""}
              </span>
            </div>
          )}
        </div>

        {/* Search Bar & List (when no supplier is selected) */}
        {!selectedSupplier && (
          <>
            <div className="di-control-bar">
              <div className="di-search-wrap">
                <span className="di-search-icon" aria-hidden="true">🔍</span>
                <input
                  type="text"
                  className="di-search-input"
                  placeholder="Search supplier starting with (e.g. 'A')... (Press Enter to select)"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      e.stopPropagation();
                      if (filteredSuppliers.length > 0) {
                        handleSupplierClick(filteredSuppliers[0]);
                      }
                    }
                  }}
                  onBlur={() => {
                    if (!selectedSupplier && searchTerm.trim() && filteredSuppliers.length === 1) {
                      handleSupplierClick(filteredSuppliers[0]);
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
              {onAddNewSupplier && (
                <button
                  type="button"
                  className="di-add-btn-quick di-add-btn-quick-rm"
                  onClick={() => onAddNewSupplier(searchTerm.trim())}
                  title="Supplier does not exist? Click to add it"
                >
                  + Supplier does not exist? Add it
                </button>
              )}
            </div>

            {error && (
              <div className="di-picker-error">
                {error} {onRetry && <button type="button" onClick={onRetry}>Retry</button>}
              </div>
            )}

            {/* Suppliers List */}
            <div className="di-list-container">
              <div className="di-list-scroll">
                {isLoading ? (
                  <div className="di-list-loading">Loading suppliers…</div>
                ) : filteredSuppliers.length === 0 ? (
                  <div className="di-list-empty">
                    <div className="di-not-found-card">
                      <div className="di-not-found-icon-wrap">
                        <span className="di-not-found-icon">🔍</span>
                      </div>
                      <p className="di-not-found-msg">
                        <strong>"{searchTerm.trim()}"</strong> does not exist in Suppliers.
                      </p>
                      {onAddNewSupplier && (
                        <div className="di-not-found-prompt">
                          <span className="di-not-found-q">Cannot find supplier?</span>
                          <div className="di-not-found-actions">
                            <button
                              type="button"
                              className="di-add-btn-rm di-add-btn-quick-rm"
                              onClick={() => onAddNewSupplier(searchTerm.trim())}
                            >
                              + Supplier does not exist? Add it
                            </button>
                          </div>
                        </div>
                      )}
                      <button
                        type="button"
                        className="di-clear-filter-link"
                        onClick={() => setSearchTerm("")}
                      >
                        Clear search
                      </button>
                    </div>
                  </div>
                ) : (
                  filteredSuppliers.map((s) => {
                    const isSelected = selectedSupplier && String(selectedSupplier.id) === String(s.id);
                    return (
                      <div
                        key={s.id}
                        className={`di-item-row row-sup ${isSelected ? "selected" : ""}`}
                        onClick={() => handleSupplierClick(s)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleSupplierClick(s);
                          }
                        }}
                      >
                        <div className="di-row-radio">
                          <span className={`di-radio-circle ${isSelected ? "active" : ""}`} />
                        </div>

                        <span className="di-type-tag tag-sup">
                          SUPPLIER
                        </span>

                        <div className="di-item-info">
                          <span className="di-item-name">{s.company_name}</span>
                          {s.code && <span className="di-item-code">[{s.code}]</span>}
                          {s.contact_person && <span className="di-item-subtype">👤 {s.contact_person}</span>}
                          {s.city && <span className="di-item-subtype">📍 {s.city}</span>}
                        </div>

                        <div className="di-item-meta">
                          {s.phone && <span className="di-meta-pill">📞 {s.phone}</span>}
                          {s.gst_number && <span className="di-meta-pill">GST: {s.gst_number}</span>}
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
      </div>
    </div>
  );
}

function DailyInputRawMaterialPicker({
  rawMaterials = [],
  products = [],
  selectedRawMaterialId = "",
  selectedProductId = "",
  selectedItemName = "",
  onSelect,
  onDeselect,
  onAddNewRawMaterial,
  disabled = false,
  isLoading = false,
  error = "",
  onRetry,
  hasError = false,
  required = true,
}) {
  const [searchTerm, setSearchTerm] = useState("");

  const selectedItem = useMemo(() => {
    if (selectedRawMaterialId) {
      const rm = rawMaterials.find((m) => String(m.id) === String(selectedRawMaterialId));
      if (rm) {
        return {
          ...rm,
          _itemType: "raw_material",
          _displayName: rm.material_name || `Raw Material #${rm.id}`,
        };
      }
      return {
        id: selectedRawMaterialId,
        material_name: selectedItemName || `Raw Material #${selectedRawMaterialId}`,
        _itemType: "raw_material",
        _displayName: selectedItemName || `Raw Material #${selectedRawMaterialId}`,
      };
    }
    if (selectedProductId) {
      const p = products.find((prod) => String(prod.id) === String(selectedProductId));
      if (p) {
        return {
          ...p,
          _itemType: "product",
          _displayName: p.name || `Product #${p.id}`,
        };
      }
      return {
        id: selectedProductId,
        name: selectedItemName || `Product #${selectedProductId}`,
        _itemType: "product",
        _displayName: selectedItemName || `Product #${selectedProductId}`,
      };
    }
    if (selectedItemName) {
      const matchedRm = rawMaterials.find(
        (m) => String(m.material_name || "").trim().toLowerCase() === String(selectedItemName).trim().toLowerCase()
      );
      if (matchedRm) {
        return {
          ...matchedRm,
          _itemType: "raw_material",
          _displayName: matchedRm.material_name,
        };
      }
      return {
        id: "custom",
        material_name: selectedItemName,
        _itemType: "raw_material",
        _displayName: selectedItemName,
      };
    }
    return null;
  }, [selectedRawMaterialId, selectedProductId, selectedItemName, rawMaterials, products]);

  const filteredMaterials = useMemo(() => {
    const list = rawMaterials.map((rm) => ({
      id: rm.id,
      material_name: rm.material_name || `Raw Material #${rm.id}`,
      code: rm.code,
      zach_code: rm.zach_code,
      details: rm.details,
      unit: rm.unit,
      rate: rm.standard_rate !== undefined && rm.standard_rate !== null ? rm.standard_rate : rm.rate,
      hsn_code: rm.hsn_code,
      category: rm.category,
      _itemType: "raw_material",
      _orig: rm,
    }));

    const q = searchTerm.trim().toLowerCase();
    if (!q) return list;

    return list.filter((m) => {
      const name = String(m.material_name || "").trim().toLowerCase();
      const code = String(m.code || "").trim().toLowerCase();
      const zach = String(m.zach_code || "").trim().toLowerCase();
      const det = String(m.details || "").trim().toLowerCase();
      const hsn = String(m.hsn_code || "").trim().toLowerCase();
      const cat = String(m.category || "").trim().toLowerCase();
      return (
        name.startsWith(q) ||
        (code && code.startsWith(q)) ||
        (zach && zach.startsWith(q)) ||
        name.includes(q) ||
        code.includes(q) ||
        zach.includes(q) ||
        det.includes(q) ||
        hsn.includes(q) ||
        cat.includes(q)
      );
    });
  }, [rawMaterials, searchTerm]);

  const handleMaterialClick = (m) => {
    if (disabled || !m) return;
    onSelect(m._orig || m);
  };

  return (
    <div className="di-picker-container di-material-picker-container">
      <div className={`di-box ${hasError && !selectedItem ? "di-box-error" : ""}`}>
        {/* Header with Selected Pill or Instruction */}
        <div className="di-picker-header">
          <span className="di-picker-title">
            Raw Material Selection {required ? "*" : ""}{" "}
            <span className="di-picker-subtext">
              {searchTerm.trim()
                ? `(${filteredMaterials.length} matching of ${rawMaterials.length})`
                : `(${rawMaterials.length} available)`}
            </span>
          </span>

          {selectedItem ? (
            <div className="di-selected-pill">
              <span className="di-type-badge type-rm">
                ✓ RAW MATERIAL SELECTED
              </span>
              <span className="di-selected-name">
                <strong>{selectedItem._displayName || selectedItem.material_name}</strong>
                {selectedItem.code && ` [${selectedItem.code}]`}
                {selectedItem.zach_code && ` • Zach: ${selectedItem.zach_code}`}
                {selectedItem.unit && ` • Unit: ${selectedItem.unit}`}
                {selectedItem.rate !== undefined && selectedItem.rate !== null && selectedItem.rate !== "" && ` • Rate: ₹${Number(selectedItem.rate).toFixed(2)}`}
                {selectedItem.hsn_code && ` • HSN: ${selectedItem.hsn_code}`}
              </span>
              <button
                type="button"
                className="di-deselect-btn"
                onClick={onDeselect}
                title="Change or deselect this raw material"
                disabled={disabled}
              >
                ✕ Change
              </button>
            </div>
          ) : (
            <div className="di-unselected-warning">
              <span className="di-warn-icon">👉</span>
              <span>
                Please search for and select a <strong>Raw Material</strong> from the list below {required ? "*" : ""}
              </span>
            </div>
          )}
        </div>

        {/* Search Bar & List (when no raw material is selected) */}
        {!selectedItem && (
          <>
            <div className="di-control-bar">
              <div className="di-search-wrap">
                <span className="di-search-icon" aria-hidden="true">🔍</span>
                <input
                  type="text"
                  className="di-search-input"
                  placeholder="Search raw material starting with (e.g. 'A')... (Press Enter to select)"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      e.stopPropagation();
                      if (filteredMaterials.length > 0) {
                        handleMaterialClick(filteredMaterials[0]);
                      }
                    }
                  }}
                  onBlur={() => {
                    if (!selectedItem && searchTerm.trim() && filteredMaterials.length === 1) {
                      handleMaterialClick(filteredMaterials[0]);
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
              {onAddNewRawMaterial && (
                <button
                  type="button"
                  className="di-add-btn-quick di-add-btn-quick-rm"
                  onClick={() => onAddNewRawMaterial(searchTerm.trim())}
                  title="Raw material does not exist? Click to add it"
                >
                  + Raw material does not exist? Add it
                </button>
              )}
            </div>

            {error && (
              <div className="di-picker-error">
                {error} {onRetry && <button type="button" onClick={onRetry}>Retry</button>}
              </div>
            )}

            {/* Materials List */}
            <div className="di-list-container">
              <div className="di-list-scroll">
                {isLoading ? (
                  <div className="di-list-loading">Loading raw materials…</div>
                ) : filteredMaterials.length === 0 ? (
                  <div className="di-list-empty">
                    <div className="di-not-found-card">
                      <div className="di-not-found-icon-wrap">
                        <span className="di-not-found-icon">🔍</span>
                      </div>
                      <p className="di-not-found-msg">
                        <strong>"{searchTerm.trim()}"</strong> does not exist in Raw Materials.
                      </p>
                      {onAddNewRawMaterial && (
                        <div className="di-not-found-prompt">
                          <span className="di-not-found-q">Cannot find raw material?</span>
                          <div className="di-not-found-actions">
                            <button
                              type="button"
                              className="di-add-btn-rm di-add-btn-quick-rm"
                              onClick={() => onAddNewRawMaterial(searchTerm.trim())}
                            >
                              + Raw material does not exist? Add it
                            </button>
                          </div>
                        </div>
                      )}
                      <button
                        type="button"
                        className="di-clear-filter-link"
                        onClick={() => setSearchTerm("")}
                      >
                        Clear search
                      </button>
                    </div>
                  </div>
                ) : (
                  filteredMaterials.map((m) => {
                    const isSelected = selectedItem && String(selectedItem.id) === String(m.id);
                    return (
                      <div
                        key={m.id}
                        className={`di-item-row row-rm ${isSelected ? "selected" : ""}`}
                        onClick={() => handleMaterialClick(m)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleMaterialClick(m);
                          }
                        }}
                      >
                        <div className="di-row-radio">
                          <span className={`di-radio-circle ${isSelected ? "active" : ""}`} />
                        </div>

                        <span className="di-type-tag tag-rm">
                          RAW MATERIAL
                        </span>

                        <div className="di-item-info">
                          <span className="di-item-name">{m.material_name}</span>
                          {m.code && <span className="di-item-code">[{m.code}]</span>}
                          {m.zach_code && <span className="di-item-zach">Zach: {m.zach_code}</span>}
                          {m.details && <span className="di-item-subtype">({m.details})</span>}
                          {m.unit && <span className="di-item-subtype">Unit: {m.unit}</span>}
                          {m.category && <span className="di-item-subtype">📁 {m.category}</span>}
                        </div>

                        <div className="di-item-meta">
                          {m.rate !== undefined && m.rate !== null && m.rate !== "" && (
                            <span className="di-meta-pill">₹{Number(m.rate).toFixed(2)}</span>
                          )}
                          {m.hsn_code && <span className="di-meta-pill">HSN: {m.hsn_code}</span>}
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
      </div>
    </div>
  );
}

function DailyInputProductPicker({
  products = [],
  selectedProductId = "",
  selectedItemName = "",
  onSelect,
  onDeselect,
  onAddNewProduct,
  disabled = false,
  isLoading = false,
  error = "",
  onRetry,
  hasError = false,
  required = true,
}) {
  const [searchTerm, setSearchTerm] = useState("");

  const selectedItem = useMemo(() => {
    if (selectedProductId) {
      const p = products.find((prod) => String(prod.id) === String(selectedProductId));
      if (p) {
        return {
          ...p,
          _itemType: "product",
          _displayName: p.name || `Product #${p.id}`,
        };
      }
      return {
        id: selectedProductId,
        name: selectedItemName || `Product #${selectedProductId}`,
        _itemType: "product",
        _displayName: selectedItemName || `Product #${selectedProductId}`,
      };
    }
    if (selectedItemName) {
      const matched = products.find(
        (p) => String(p.name || "").trim().toLowerCase() === String(selectedItemName).trim().toLowerCase()
      );
      if (matched) {
        return {
          ...matched,
          _itemType: "product",
          _displayName: matched.name,
        };
      }
      return {
        id: "custom",
        name: selectedItemName,
        _itemType: "product",
        _displayName: selectedItemName,
      };
    }
    return null;
  }, [selectedProductId, selectedItemName, products]);

  const filteredProducts = useMemo(() => {
    const list = products.map((p) => ({
      id: p.id,
      name: p.name || `Product #${p.id}`,
      code: p.code,
      type: p.type,
      unit: p.unit || "num",
      zach_code: p.zach_code,
      sach_code: p.sach_code,
      hsn_code: p.hsn_code,
      bin: p.bin,
      boxes: p.boxes,
      po_batch_no: p.po_batch_no,
      ls: p.ls,
      _orig: p,
    }));

    const q = searchTerm.trim().toLowerCase();
    if (!q) return list;

    return list.filter((p) => {
      const name = String(p.name || "").trim().toLowerCase();
      const code = String(p.code || "").trim().toLowerCase();
      const zach = String(p.zach_code || "").trim().toLowerCase();
      const sach = String(p.sach_code || "").trim().toLowerCase();
      const hsn = String(p.hsn_code || "").trim().toLowerCase();
      const bin = String(p.bin || "").trim().toLowerCase();
      const boxes = String(p.boxes || "").trim().toLowerCase();
      const po = String(p.po_batch_no || "").trim().toLowerCase();
      const lsVal = String(p.ls || "").trim().toLowerCase();
      const pType = String(p.type || "").trim().toLowerCase();
      return (
        name.startsWith(q) ||
        (code && code.startsWith(q)) ||
        (zach && zach.startsWith(q)) ||
        (sach && sach.startsWith(q)) ||
        name.includes(q) ||
        code.includes(q) ||
        zach.includes(q) ||
        sach.includes(q) ||
        hsn.includes(q) ||
        bin.includes(q) ||
        boxes.includes(q) ||
        po.includes(q) ||
        lsVal.includes(q) ||
        pType.includes(q)
      );
    });
  }, [products, searchTerm]);

  const handleProductClick = (p) => {
    if (disabled || !p) return;
    onSelect(p._orig || p);
  };

  return (
    <div className="di-picker-container di-product-picker-container">
      <div className={`di-box ${hasError && !selectedItem ? "di-box-error" : ""}`}>
        {/* Header with Selected Pill or Instruction */}
        <div className="di-picker-header">
          <span className="di-picker-title">
            Product Selection {required ? "*" : ""}{" "}
            <span className="di-picker-subtext">
              {searchTerm.trim()
                ? `(${filteredProducts.length} matching of ${products.length})`
                : `(${products.length} available)`}
            </span>
          </span>

          {selectedItem ? (
            <div className="di-selected-pill">
              <span className="di-type-badge" style={{ background: "#ede9fe", color: "#6d28d9", border: "1px solid #c4b5fd" }}>
                ✓ PRODUCT SELECTED
              </span>
              <span className="di-selected-name">
                <strong>{selectedItem._displayName || selectedItem.name}</strong>
                {selectedItem.code && ` [${selectedItem.code}]`}
                {selectedItem.type && ` • Type: ${selectedItem.type}`}
                {selectedItem.unit && ` • Unit: ${selectedItem.unit}`}
                {selectedItem.zach_code && ` • Zach: ${selectedItem.zach_code}`}
                {selectedItem.hsn_code && ` • HSN: ${selectedItem.hsn_code}`}
                {selectedItem.po_batch_no && ` • P.O./Batch: ${selectedItem.po_batch_no}`}
                {selectedItem.ls && ` • Ls: ${selectedItem.ls}`}
                {selectedItem.sach_code && ` • Sach: ${selectedItem.sach_code}`}
                {selectedItem.bin && ` • Bin: ${selectedItem.bin}`}
                {selectedItem.boxes && ` • Boxes: ${selectedItem.boxes}`}
              </span>
              <button
                type="button"
                className="di-deselect-btn"
                onClick={onDeselect}
                title="Change or deselect this product"
                disabled={disabled}
              >
                ✕ Change
              </button>
            </div>
          ) : (
            <div className="di-unselected-warning">
              <span className="di-warn-icon">👉</span>
              <span>
                Please search for and select a <strong>Product</strong> from the list below {required ? "*" : ""}
              </span>
            </div>
          )}
        </div>

        {/* Search Bar & List (when no product is selected) */}
        {!selectedItem && (
          <>
            <div className="di-control-bar">
              <div className="di-search-wrap">
                <span className="di-search-icon" aria-hidden="true">🔍</span>
                <input
                  type="text"
                  className="di-search-input"
                  placeholder="Search product starting with (e.g. 'C')... (Press Enter to select)"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      e.stopPropagation();
                      if (filteredProducts.length > 0) {
                        handleProductClick(filteredProducts[0]);
                      }
                    }
                  }}
                  onBlur={() => {
                    if (!selectedItem && searchTerm.trim() && filteredProducts.length === 1) {
                      handleProductClick(filteredProducts[0]);
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
              {onAddNewProduct && (
                <button
                  type="button"
                  className="di-add-btn-quick di-add-btn-quick-prd"
                  onClick={() => onAddNewProduct(searchTerm.trim())}
                  title="Product does not exist? Click to add it"
                  style={{ background: "#7c3aed", borderColor: "#6d28d9", color: "#ffffff" }}
                >
                  + Product does not exist? Add it
                </button>
              )}
            </div>

            {error && (
              <div className="di-picker-error">
                {error} {onRetry && <button type="button" onClick={onRetry}>Retry</button>}
              </div>
            )}

            {/* Products List */}
            <div className="di-list-container">
              <div className="di-list-scroll">
                {isLoading ? (
                  <div className="di-list-loading">Loading products…</div>
                ) : filteredProducts.length === 0 ? (
                  <div className="di-list-empty">
                    <div className="di-not-found-card">
                      <div className="di-not-found-icon-wrap">
                        <span className="di-not-found-icon">🔍</span>
                      </div>
                      <p className="di-not-found-msg">
                        <strong>"{searchTerm.trim()}"</strong> does not exist in Products.
                      </p>
                      {onAddNewProduct && (
                        <div className="di-not-found-prompt">
                          <span className="di-not-found-q">Cannot find product?</span>
                          <div className="di-not-found-actions">
                            <button
                              type="button"
                              className="di-add-btn-prd di-add-btn-quick-prd"
                              onClick={() => onAddNewProduct(searchTerm.trim())}
                              style={{ background: "#7c3aed", borderColor: "#6d28d9", color: "#ffffff" }}
                            >
                              + Product does not exist? Add it
                            </button>
                          </div>
                        </div>
                      )}
                      <button
                        type="button"
                        className="di-clear-filter-link"
                        onClick={() => setSearchTerm("")}
                      >
                        Clear search
                      </button>
                    </div>
                  </div>
                ) : (
                  filteredProducts.map((p) => {
                    const isSelected = selectedItem && String(selectedItem.id) === String(p.id);
                    return (
                      <div
                        key={p.id}
                        className={`di-item-row ${isSelected ? "selected" : ""}`}
                        onClick={() => handleProductClick(p)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleProductClick(p);
                          }
                        }}
                      >
                        <div className="di-row-radio">
                          <span className={`di-radio-circle ${isSelected ? "active" : ""}`} />
                        </div>

                        <span className="di-type-tag" style={{ background: "#ede9fe", color: "#6d28d9", border: "1px solid #c4b5fd" }}>
                          PRODUCT
                        </span>

                        <div className="di-item-info">
                          <span className="di-item-name">{p.name}</span>
                          {p.code && <span className="di-item-code">[{p.code}]</span>}
                          {p.type && <span className="di-item-subtype">Type: {p.type}</span>}
                          {p.unit && <span className="di-item-subtype">Unit: {p.unit}</span>}
                        </div>

                        <div className="di-item-meta">
                          {p.zach_code && <span className="di-meta-pill">Zach: {p.zach_code}</span>}
                          {p.hsn_code && <span className="di-meta-pill">HSN: {p.hsn_code}</span>}
                          {p.po_batch_no && <span className="di-meta-pill">P.O./Batch: {p.po_batch_no}</span>}
                          {p.ls && <span className="di-meta-pill">Ls: {p.ls}</span>}
                          {p.sach_code && <span className="di-meta-pill">Sach: {p.sach_code}</span>}
                          {p.bin && <span className="di-meta-pill">Bin: {p.bin}</span>}
                          {p.boxes && <span className="di-meta-pill">Boxes: {p.boxes}</span>}
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
      </div>
    </div>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="section-error-boundary" style={{ padding: "30px", textAlign: "center" }}>
          <div style={{ maxWidth: "520px", margin: "0 auto", padding: "24px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "10px" }}>
            <span style={{ fontSize: "36px", display: "block", marginBottom: "12px" }}>⚠️</span>
            <h3 style={{ margin: "0 0 8px 0", color: "#991b1b" }}>Something went wrong in this section</h3>
            <p style={{ margin: "0 0 16px 0", color: "#b91c1c", fontSize: "14px" }}>
              {this.state.error?.message || "An unexpected error occurred while loading this view."}
            </p>
            <button
              type="button"
              className="primary-action"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                if (this.props.onReset) this.props.onReset();
              }}
            >
              Try Again / Refresh
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
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
    masterFiles: false,
    parties: false,
    staff: false,
  });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

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
    dailyInputs: [],
  });
  
  const [lookupLoading, setLookupLoading] = useState({
    suppliers: false,
    customers: false,
    rawMaterials: false,
    products: false,
    dailyInputs: false,
  });
  const [dailyDispatchType, setDailyDispatchType] = useState("");
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
  const [stagedDailyInputs, setStagedDailyInputs] = useState([]);
  const [stagedDailyDispatches, setStagedDailyDispatches] = useState([]);

  const stagedTotals = useMemo(() => {
    return stagedDailyInputs.reduce(
      (acc, row) => ({
        quantity: acc.quantity + (Number(row.quantity) || 0),
        basic_value: acc.basic_value + (Number(row.basic_value) || 0),
        discount_amount: acc.discount_amount + (Number(row.discount_amount) || 0),
        amount: acc.amount + (Number(row.amount) || 0),
        cgst_amount: acc.cgst_amount + (Number(row.cgst_amount) || 0),
        ut_sgst_amount: acc.ut_sgst_amount + (Number(row.ut_sgst_amount) || 0),
        igst_amount: acc.igst_amount + (Number(row.igst_amount) || 0),
        total_amount: acc.total_amount + (Number(row.total_amount) || 0),
      }),
      {
        quantity: 0,
        basic_value: 0,
        discount_amount: 0,
        amount: 0,
        cgst_amount: 0,
        ut_sgst_amount: 0,
        igst_amount: 0,
        total_amount: 0,
      }
    );
  }, [stagedDailyInputs]);
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
      zach_mode: "without_zach_code",
      zach_code: "",
      material_name: searchedName || "",
      details: "",
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

    const zachMode = quickAddRawMaterialModal?.zach_mode || "without_zach_code";
    const zachCodeVal = String(quickAddRawMaterialModal?.zach_code || "").trim();
    if (zachMode === "with_zach_code" && !zachCodeVal) {
      setQuickRmError("Zach No is required when 'zach no' is selected.");
      return;
    }

    setIsSavingQuickRm(true);

    const resolvedUnit =
      quickAddRawMaterialModal.unit === "other"
        ? (String(quickAddRawMaterialModal.unit_other || "").trim() || "other")
        : quickAddRawMaterialModal.unit || "num";

    const payload = {
      material_name: name,
      has_zach_code: zachMode === "with_zach_code",
      zach_code: zachMode === "with_zach_code" ? zachCodeVal : null,
      details: quickAddRawMaterialModal.details ? String(quickAddRawMaterialModal.details).trim() : null,
      hsn_code: quickAddRawMaterialModal.hsn_code ? String(quickAddRawMaterialModal.hsn_code).trim() : null,
      unit: resolvedUnit,
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
      product_mode: "with_zach_code",
      type: "element",
      ls: "",
      hsn_code: "",
      sach_code: "",
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

    const mode = quickAddProductModal.product_mode || "with_zach_code";
    const resolvedType =
      quickAddProductModal.type === "other"
        ? (String(quickAddProductModal.type_other || "").trim() || "other")
        : quickAddProductModal.type || "element";

    const payload = {
      name,
      type: resolvedType,
    };

    payload.ls = quickAddProductModal.ls ? String(quickAddProductModal.ls).trim() : null;
    payload.hsn_code = quickAddProductModal.hsn_code ? String(quickAddProductModal.hsn_code).trim() : null;
    payload.sach_code = quickAddProductModal.sach_code ? String(quickAddProductModal.sach_code).trim() : null;

    if (mode === "with_zach_code") {
      payload.has_zach_code = true;
    } else {
      payload.has_zach_code = false;
      payload.zach_code = null;

      if (resolvedType === "welded element") {
        if (!quickAddProductModal.element_id) {
          setQuickPrdError("Please select an element for the welded element.");
          return;
        }
        payload.element_id = Number(quickAddProductModal.element_id);
      } else if (resolvedType === "capacitor") {
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

  const [quickAddSupplierModal, setQuickAddSupplierModal] = useState(null);
  const [isSavingQuickSup, setIsSavingQuickSup] = useState(false);
  const [quickSupError, setQuickSupError] = useState("");

  function handleOpenQuickAddSupplier(searchedName) {
    setPageError("");
    setQuickSupError("");
    setQuickAddSupplierModal({
      company_name: searchedName || "",
      contact_person: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      state: "",
      pincode: "",
      gst_number: "",
    });
  }

  async function handleSaveQuickSupplier(event) {
    event.preventDefault();
    setQuickSupError("");

    const name = String(quickAddSupplierModal?.company_name || "").trim();
    if (!name) {
      setQuickSupError("Supplier company name is required.");
      return;
    }

    setIsSavingQuickSup(true);

    const payload = {
      company_name: name,
      contact_person: quickAddSupplierModal.contact_person ? String(quickAddSupplierModal.contact_person).trim() : null,
      email: quickAddSupplierModal.email ? String(quickAddSupplierModal.email).trim() : null,
      phone: quickAddSupplierModal.phone ? String(quickAddSupplierModal.phone).trim() : null,
      address: quickAddSupplierModal.address ? String(quickAddSupplierModal.address).trim() : null,
      city: quickAddSupplierModal.city ? String(quickAddSupplierModal.city).trim() : null,
      state: quickAddSupplierModal.state ? String(quickAddSupplierModal.state).trim() : null,
      pincode: quickAddSupplierModal.pincode ? String(quickAddSupplierModal.pincode).trim() : null,
      gst_number: quickAddSupplierModal.gst_number ? String(quickAddSupplierModal.gst_number).trim() : null,
    };

    try {
      const result = await window.desktop.createWorkspaceRecord("suppliers", payload);
      if (!result.ok) {
        setQuickSupError(typeof result.error === "string" ? result.error : "Failed to create supplier.");
        setIsSavingQuickSup(false);
        return;
      }

      const newSup = result.data;
      setLookupOptions((prev) => ({
        ...prev,
        suppliers: [...(prev.suppliers || []).filter((s) => String(s.id) !== String(newSup.id)), newSup],
      }));

      setDashboardCounts((current) => ({
        ...current,
        suppliers: (current.suppliers || 0) + 1,
      }));

      handleFormFieldChange("supplier_id", newSup.id);
      setNotice(`Supplier "${newSup.company_name}" created successfully and selected!`);
      setQuickAddSupplierModal(null);
    } catch (err) {
      setQuickSupError(err?.message || "Failed to create supplier.");
    } finally {
      setIsSavingQuickSup(false);
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
      zach_code: "",
      po_batch_no: "",
      ls: "",
      sach_code: "",
      bin: "",
      boxes: "",
      rate: "",
      basic_value: 0,
      discount_percent: 0,
      discount_amount: 0,
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

  function handleRawMaterialTypeSelect(rmType) {
    setPageError("");
    setFormValues((prev) => {
      const isOther = rmType === "other";
      const isProduct = rmType === "product";
      const nextType = isOther ? "other" : (isProduct ? "product" : "raw_material");
      return {
        ...prev,
        raw_material_type: rmType,
        type: nextType,
        raw_material_id: rmType === "raw_material" ? prev.raw_material_id : "",
        product_id: isProduct ? prev.product_id : "",
        element_id: isProduct ? prev.element_id : "",
        item: isOther ? (prev.material_name || prev.item || "") : (isProduct ? (prev.item || "") : prev.item),
        material_name: isOther ? (prev.material_name || prev.item || "") : (isProduct ? (prev.item || "") : prev.material_name),
        unit: isProduct ? (prev.unit || "num") : prev.unit,
        ...(isProduct ? {
          rate: "",
          basic_value: 0,
          discount_percent: 0,
          discount_amount: 0,
          amount: 0,
          cgst_percent: 0,
          ut_sgst_percent: 0,
          igst_percent: 0,
          cgst_amount: 0,
          ut_sgst_amount: 0,
          igst_amount: 0,
          total_amount: 0,
        } : {
          zach_code: "",
          po_batch_no: "",
          ls: "",
          sach_code: "",
          bin: "",
          boxes: "",
        }),
      };
    });
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
          raw_material_type: "raw_material",
          raw_material_id: validRmId,
          product_id: "",
          element_id: "",
          customer_id: "",
          item: selectedRm?.material_name || item?.material_name || item?.name || prev.item || "",
          material_name: selectedRm?.material_name || item?.material_name || item?.name || prev.material_name || "",
          unit: selectedRm?.unit ?? item?.unit ?? prev.unit ?? "",
          hsn_code: selectedRm?.hsn_code ?? item?.hsn_code ?? prev.hsn_code ?? "",
          zach_code: selectedRm?.zach_code ?? item?.zach_code ?? "",
          po_batch_no: "",
          ls: "",
          sach_code: "",
          bin: "",
          boxes: "",
          rate: (selectedRm?.rate !== undefined && selectedRm?.rate !== null && selectedRm?.rate !== "") ? selectedRm.rate : prev.rate,
          discount_percent: (selectedRm?.discount_percent !== undefined && selectedRm?.discount_percent !== null) ? selectedRm.discount_percent : (prev.discount_percent || 0),
          cgst_percent: (selectedRm?.cgst_percent !== undefined && selectedRm?.cgst_percent !== null) ? selectedRm.cgst_percent : (prev.cgst_percent || 0),
          ut_sgst_percent: (selectedRm?.ut_sgst_percent !== undefined && selectedRm?.ut_sgst_percent !== null) ? selectedRm.ut_sgst_percent : (prev.ut_sgst_percent || 0),
          igst_percent: (selectedRm?.igst_percent !== undefined && selectedRm?.igst_percent !== null) ? selectedRm.igst_percent : (prev.igst_percent || 0),
        };

        const quantity = Number(next.quantity) || 0;
        const rate = Number(next.rate) || 0;
        const grossAmount = Number((quantity * rate).toFixed(2));
        next.basic_value = grossAmount;
        const discountPercent = Number(next.discount_percent) || 0;
        const discountAmount = (grossAmount * discountPercent) / 100;
        next.discount_amount = Number(discountAmount.toFixed(2));
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
        raw_material_type: "product",
        product_id: validPrdId,
        element_id: validPrdId,
        raw_material_id: "",
        item: selectedPrd?.name || item?.name || prev.item || "",
        material_name: selectedPrd?.name || item?.name || prev.material_name || "",
        unit: selectedPrd?.unit || prev.unit || "num",
        hsn_code: selectedPrd?.hsn_code ?? item?.hsn_code ?? "",
        zach_code: selectedPrd?.zach_code ?? item?.zach_code ?? "",
        po_batch_no: selectedPrd?.po_batch_no ?? item?.po_batch_no ?? "",
        ls: selectedPrd?.ls ?? item?.ls ?? "",
        sach_code: selectedPrd?.sach_code ?? item?.sach_code ?? "",
        bin: selectedPrd?.bin ?? item?.bin ?? "",
        boxes: selectedPrd?.boxes ?? item?.boxes ?? "",
        rate: "",
        basic_value: 0,
        discount_percent: 0,
        discount_amount: 0,
        amount: 0,
        cgst_percent: 0,
        ut_sgst_percent: 0,
        igst_percent: 0,
        cgst_amount: 0,
        ut_sgst_amount: 0,
        igst_amount: 0,
        total_amount: 0,
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
      material_name: "",
      unit: prev.type === "product" ? "num" : "",
      hsn_code: "",
      zach_code: "",
      po_batch_no: "",
      ls: "",
      sach_code: "",
      bin: "",
      boxes: "",
      rate: "",
      basic_value: 0,
      discount_percent: 0,
      discount_amount: 0,
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

  function handleTableSelectRawMaterial(rmId) {
    handleDailyInputItemSelect({ type: "raw_material", id: rmId });
  }

  function handleTableSelectProduct(prdId) {
    handleDailyInputItemSelect({ type: "product", id: prdId });
  }


  function handleAddMoreDailyInput() {
    setPageError("");
    const supplierType = formValues.supplier_type || "supplier";
    const rawMaterialType = formValues.raw_material_type || (formValues.type === "other" ? "other" : (formValues.type === "product" ? "product" : "raw_material"));
    const typeVal = rawMaterialType === "product" || formValues.type === "product" || formValues.type === "element"
      ? "product"
      : (rawMaterialType === "other" || formValues.type === "other" ? "other" : "raw_material");
    let itemName = "";
    let rmId = null;
    let prdId = null;

    if (typeVal === "product") {
      prdId = formValues.product_id ? Number(formValues.product_id) : (formValues.element_id ? Number(formValues.element_id) : null);
      const matchedPrd = (lookupOptions.products || []).find((p) => Number(p.id) === prdId);
      itemName = matchedPrd?.name || formValues.item || formValues.material_name || "";
      if (!prdId && itemName) {
        const found = (lookupOptions.products || []).find(
          (p) => String(p.name || "").trim().toLowerCase() === String(itemName).trim().toLowerCase()
        );
        if (found) {
          prdId = found.id;
          itemName = found.name;
        }
      }
      if (!prdId || !itemName) {
        setPageError("Please click and select a specific product from the list first.");
        return;
      }
    } else if (supplierType === "general") {
      if (rawMaterialType === "other") {
        itemName = String(formValues.material_name || formValues.item || "").trim();
        if (!itemName) {
          setPageError("Please enter a raw material name.");
          return;
        }
      } else {
        rmId = formValues.raw_material_id ? Number(formValues.raw_material_id) : null;
        const matchedRm = (lookupOptions.rawMaterials || []).find((m) => Number(m.id) === rmId);
        itemName = matchedRm?.material_name || formValues.item || formValues.material_name || "";
        if (!rmId && itemName) {
          const found = (lookupOptions.rawMaterials || []).find(
            (m) => String(m.material_name || "").trim().toLowerCase() === String(itemName).trim().toLowerCase()
          );
          if (found) {
            rmId = found.id;
            itemName = found.material_name;
          }
        }
        if (!itemName) {
          setPageError("Please search and select a raw material from the list.");
          return;
        }
      }
      rmId = null;
    } else if (rawMaterialType === "other" || typeVal === "other") {
      itemName = String(formValues.material_name || formValues.item || "").trim();
      if (!itemName) {
        setPageError("Raw material name is required.");
        return;
      }
      rmId = null;
    } else if (typeVal === "raw_material") {
      rmId = formValues.raw_material_id ? Number(formValues.raw_material_id) : null;
      const matchedRm = (lookupOptions.rawMaterials || []).find((m) => Number(m.id) === rmId);
      itemName = matchedRm?.material_name || formValues.item || formValues.material_name || "";
      if (!rmId && itemName) {
        const found = (lookupOptions.rawMaterials || []).find(
          (m) => String(m.material_name || "").trim().toLowerCase() === String(itemName).trim().toLowerCase()
        );
        if (found) {
          rmId = found.id;
          itemName = found.material_name;
        }
      }
      if (!rmId || !itemName) {
        setPageError("Please click and select a specific raw material from the list first.");
        return;
      }
    } else {
      itemName = String(formValues.material_name || formValues.item || "").trim();
      if (!itemName) {
        setPageError("Material / item name is required.");
        return;
      }
    }

    const qty = Number(formValues.quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      setPageError("Quantity is required and must be greater than 0.");
      return;
    }

    const isProductItem = typeVal === "product" || rawMaterialType === "product";
    const rate = isProductItem ? 0 : (Number(formValues.rate) || 0);
    const basicValue = isProductItem ? 0 : Number((qty * rate).toFixed(2));
    const discountPercent = isProductItem ? 0 : (Number(formValues.discount_percent) || 0);
    const discountAmount = isProductItem ? 0 : (formValues.discount_amount !== undefined && formValues.discount_amount !== ""
      ? Number(formValues.discount_amount)
      : Number(((basicValue * discountPercent) / 100).toFixed(2)));
    const taxableValue = isProductItem ? 0 : Number((basicValue - discountAmount).toFixed(2));
    const cgstPercent = isProductItem ? 0 : (Number(formValues.cgst_percent) || 0);
    const sgstPercent = isProductItem ? 0 : (Number(formValues.ut_sgst_percent) || 0);
    const igstPercent = isProductItem ? 0 : (Number(formValues.igst_percent) || 0);
    const cgstAmount = isProductItem ? 0 : Number(((taxableValue * cgstPercent) / 100).toFixed(2));
    const sgstAmount = isProductItem ? 0 : Number(((taxableValue * sgstPercent) / 100).toFixed(2));
    const igstAmount = isProductItem ? 0 : Number(((taxableValue * igstPercent) / 100).toFixed(2));
    const invoiceValue = isProductItem
      ? (formValues.total_amount !== undefined && formValues.total_amount !== "" ? Number(formValues.total_amount) : 0)
      : Number((taxableValue + cgstAmount + sgstAmount + igstAmount).toFixed(2));

    const matchedRmForRow = !isProductItem
      ? (lookupOptions.rawMaterials || []).find(
          (m) =>
            (rmId && Number(m.id) === Number(rmId)) ||
            String(m.material_name || "").trim().toLowerCase() === String(itemName).trim().toLowerCase()
        )
      : null;
    const resolvedHsnCode = formValues.hsn_code || matchedRmForRow?.hsn_code || "";
    const resolvedZachCode = formValues.zach_code || matchedRmForRow?.zach_code || "";

    const newRow = {
      _tempId: Date.now() + Math.random(),
      item: itemName,
      supplier_type: supplierType,
      type: typeVal,
      raw_material_type: rawMaterialType,
      raw_material_id: rmId,
      product_id: prdId,
      element_id: prdId,
      quantity: qty,
      unit: formValues.unit === "other" && formValues.unit_other ? formValues.unit_other : (formValues.unit || ""),
      rate,
      basic_value: basicValue,
      discount_percent: discountPercent,
      discount_amount: discountAmount,
      amount: taxableValue,
      cgst_percent: cgstPercent,
      ut_sgst_percent: sgstPercent,
      igst_percent: igstPercent,
      cgst_amount: cgstAmount,
      ut_sgst_amount: sgstAmount,
      igst_amount: igstAmount,
      total_amount: invoiceValue,
      hsn_code: resolvedHsnCode,
      zach_code: resolvedZachCode,
      po_batch_no: formValues.po_batch_no || "",
      ls: formValues.ls || "",
      sach_code: formValues.sach_code || "",
      bin: formValues.bin || "",
      boxes: formValues.boxes || "",
      remarks: formValues.remarks || "",
      supplier_company_name: formValues.supplier_company_name || "",
      supplier_contact_person: formValues.supplier_contact_person || "",
      supplier_phone: formValues.supplier_phone || "",
      supplier_email: formValues.supplier_email || "",
      supplier_address: formValues.supplier_address || "",
      supplier_city: formValues.supplier_city || "",
      supplier_state: formValues.supplier_state || "",
      supplier_pincode: formValues.supplier_pincode || "",
      supplier_gst_number: formValues.supplier_gst_number || "",
      other_details: formValues.other_details || (supplierType === "general" ? {
        material_name: itemName,
        supplier_type: "general",
        raw_material_type: rawMaterialType,
        hsn_code: resolvedHsnCode,
        zach_code: resolvedZachCode,
        po_batch_no: formValues.po_batch_no || "",
        ls: formValues.ls || "",
        sach_code: formValues.sach_code || "",
        bin: formValues.bin || "",
        boxes: formValues.boxes || "",
        supplier_company_name: formValues.supplier_company_name || "",
        supplier_contact_person: formValues.supplier_contact_person || "",
        supplier_phone: formValues.supplier_phone || "",
        supplier_email: formValues.supplier_email || "",
        supplier_address: formValues.supplier_address || "",
        supplier_city: formValues.supplier_city || "",
        supplier_state: formValues.supplier_state || "",
        supplier_pincode: formValues.supplier_pincode || "",
        supplier_gst_number: formValues.supplier_gst_number || "",
        cgst_percent: cgstPercent,
        ut_sgst_percent: sgstPercent,
        igst_percent: igstPercent,
      } : null),
    };

    setStagedDailyInputs((prev) => [...prev, newRow]);

    // Clear active item inputs, keep document info and supplier type
    setFormValues((prev) => ({
      ...prev,
      supplier_type: supplierType,
      raw_material_type: rawMaterialType,
      raw_material_id: "",
      product_id: "",
      element_id: "",
      item: "",
      material_name: "",
      hsn_code: "",
      zach_code: "",
      po_batch_no: "",
      ls: "",
      sach_code: "",
      bin: "",
      boxes: "",
      quantity: "",
      rate: "",
      basic_value: "",
      discount_percent: prev.discount_percent || 0,
      discount_amount: "",
      amount: "",
      cgst_percent: prev.cgst_percent || 0,
      ut_sgst_percent: prev.ut_sgst_percent || 0,
      igst_percent: prev.igst_percent || 0,
      cgst_amount: "",
      ut_sgst_amount: "",
      igst_amount: "",
      total_amount: "",
      remarks: "",
    }));

    setNotice(`"${itemName}" added to table. (${stagedDailyInputs.length + 1} item(s) in table)`);
  }

  function handleEditStagedItem(index) {
    const itemToEdit = stagedDailyInputs[index];
    if (!itemToEdit) return;

    setStagedDailyInputs((prev) => prev.filter((_, idx) => idx !== index));

    setFormValues((prev) => ({
      ...prev,
      supplier_type: itemToEdit.supplier_type || "supplier",
      raw_material_type: itemToEdit.raw_material_type || (itemToEdit.type === "product" || itemToEdit.type === "element" ? "product" : (itemToEdit.type === "other" || !itemToEdit.raw_material_id ? "other" : "raw_material")),
      type: itemToEdit.type || "raw_material",
      raw_material_id: itemToEdit.raw_material_id || "",
      product_id: itemToEdit.product_id || "",
      element_id: itemToEdit.element_id || "",
      item: itemToEdit.item || "",
      material_name: itemToEdit.item || "",
      quantity: itemToEdit.quantity ?? "",
      unit: itemToEdit.unit || "",
      rate: itemToEdit.rate ?? "",
      basic_value: itemToEdit.basic_value ?? "",
      discount_percent: itemToEdit.discount_percent ?? "",
      discount_amount: itemToEdit.discount_amount ?? "",
      amount: itemToEdit.amount ?? "",
      cgst_percent: itemToEdit.cgst_percent ?? "",
      ut_sgst_percent: itemToEdit.ut_sgst_percent ?? "",
      igst_percent: itemToEdit.igst_percent ?? "",
      cgst_amount: itemToEdit.cgst_amount ?? "",
      ut_sgst_amount: itemToEdit.ut_sgst_amount ?? "",
      igst_amount: itemToEdit.igst_amount ?? "",
      total_amount: itemToEdit.total_amount ?? "",
      hsn_code: itemToEdit.hsn_code || "",
      zach_code: itemToEdit.zach_code || "",
      po_batch_no: itemToEdit.po_batch_no || "",
      ls: itemToEdit.ls || "",
      sach_code: itemToEdit.sach_code || "",
      bin: itemToEdit.bin || "",
      boxes: itemToEdit.boxes || "",
      remarks: itemToEdit.remarks || "",
      supplier_company_name: itemToEdit.supplier_company_name || "",
      supplier_contact_person: itemToEdit.supplier_contact_person || "",
      supplier_phone: itemToEdit.supplier_phone || "",
      supplier_email: itemToEdit.supplier_email || "",
      supplier_address: itemToEdit.supplier_address || "",
      supplier_city: itemToEdit.supplier_city || "",
      supplier_state: itemToEdit.supplier_state || "",
      supplier_pincode: itemToEdit.supplier_pincode || "",
      supplier_gst_number: itemToEdit.supplier_gst_number || "",
    }));

    setFormType(itemToEdit.type || "raw_material");
    setNotice(`Loaded "${itemToEdit.item}" back to fields.`);
  }

  function handleDeleteStagedItem(index) {
    const item = stagedDailyInputs[index];
    setStagedDailyInputs((prev) => prev.filter((_, idx) => idx !== index));
    if (item) {
      setNotice(`Removed "${item.item}" from table.`);
    }
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
    hsn_code: rawMaterial.hsn_code ?? record.hsn_code ?? "",
    zach_code: rawMaterial.zach_code ?? record.zach_code ?? "",
    rate: rawMaterial.rate ?? 0,
    discount_percent: rawMaterial.discount_percent ?? 0,
    cgst_percent: rawMaterial.cgst_percent ?? 0,
    ut_sgst_percent: rawMaterial.ut_sgst_percent ?? 0,
    igst_percent: rawMaterial.igst_percent ?? 0,
  };
}

function calculateCostDataBasicAutofill(data, changedField) {
  const currentType = data.type || "Basic";
  if (currentType !== "Basic") return data;

  const parseVal = (v) => {
    if (v === "" || v === null || v === undefined) return null;
    const num = parseFloat(v);
    return isNaN(num) ? null : num;
  };

  const next = { ...data };

  const filmWidth = parseVal(next.mpp_film_width);
  const freeMargin = parseVal(next.film_free_margin) ?? 0;
  const stagger = parseVal(next.winding_stagger) ?? 0;
  const basicVal = parseVal(next.wound_cap_basic_value);
  const filmThickness = parseVal(next.mpp_film_thickness);
  const coreOd = parseVal(next.core_od) ?? 0;

  // 1. Active width in mm = MPP film width - (2 * film free margin + winding stagger)
  if (changedField !== "active_width" || next.active_width === "" || next.active_width === null || next.active_width === undefined) {
    if (filmWidth !== null && filmWidth > 0) {
      const calcActiveWidth = filmWidth - (2 * freeMargin + stagger);
      next.active_width = calcActiveWidth > 0 ? Number(calcActiveWidth.toFixed(2)) : 0;
    } else if (changedField === "mpp_film_width") {
      next.active_width = "";
    }
  }

  const activeWidth = parseVal(next.active_width);

  // 2. Band length Mtrs = ((wound cap basic value * mpp film thickness * 10000) / (3.845 * active width in mm)) / 100
  if (changedField !== "band_length" || next.band_length === "" || next.band_length === null || next.band_length === undefined) {
    if (basicVal !== null && basicVal > 0 && filmThickness !== null && filmThickness > 0 && activeWidth !== null && activeWidth > 0) {
      const calcBandLength = ((basicVal * filmThickness * 10000) / (3.845 * activeWidth)) / 100;
      next.band_length = Number(calcBandLength.toFixed(2));
    } else if (["wound_cap_basic_value", "mpp_film_thickness", "mpp_film_width", "film_free_margin", "winding_stagger", "active_width"].includes(changedField)) {
      if (!basicVal || !filmThickness || !activeWidth) {
        next.band_length = "";
      }
    }
  }

  const bandLength = parseVal(next.band_length);

  // 3. Wound capacitor OD = (sqrt(band length mtrs * 100 * 2 * MPP film thickness) / (25 * (22 / 7))) + (Core OD + core OD)
  if (changedField !== "wound_capacitor_od" || next.wound_capacitor_od === "" || next.wound_capacitor_od === null || next.wound_capacitor_od === undefined) {
    if (bandLength !== null && bandLength > 0 && filmThickness !== null && filmThickness > 0) {
      const sqrtTerm = Math.sqrt(bandLength * 100 * 2 * filmThickness);
      const piTerm = 25 * (22 / 7);
      const calcOd = (sqrtTerm / piTerm) + (coreOd + coreOd);
      next.wound_capacitor_od = Number(calcOd.toFixed(2));
    } else if (["band_length", "wound_cap_basic_value", "mpp_film_thickness", "mpp_film_width", "core_od", "active_width"].includes(changedField)) {
      if (!bandLength || !filmThickness) {
        next.wound_capacitor_od = "";
      }
    }
  }

  const woundCapOd = parseVal(next.wound_capacitor_od);

  // 4. Turns to be wound = (250 * (wound capacitor OD - core OD)) / MPP film thickness
  if (changedField !== "turns_to_be_wound" || next.turns_to_be_wound === "" || next.turns_to_be_wound === null || next.turns_to_be_wound === undefined) {
    if (woundCapOd !== null && woundCapOd > 0 && filmThickness !== null && filmThickness > 0) {
      const calcTurns = (250 * (woundCapOd - coreOd)) / filmThickness;
      next.turns_to_be_wound = Number(calcTurns.toFixed(2));
    } else if (["wound_capacitor_od", "band_length", "wound_cap_basic_value", "mpp_film_thickness", "core_od", "mpp_film_width", "active_width"].includes(changedField)) {
      if (!woundCapOd || !filmThickness) {
        next.turns_to_be_wound = "";
      }
    }
  }

  // 5. Wt of capacitor gms = (2 * band length mtrs * MPP film width in mm * MPP film thickness in mm * 0.9) / 1000
  if (changedField !== "wt_of_capacitor" || next.wt_of_capacitor === "" || next.wt_of_capacitor === null || next.wt_of_capacitor === undefined) {
    if (bandLength !== null && bandLength > 0 && filmWidth !== null && filmWidth > 0 && filmThickness !== null && filmThickness > 0) {
      const calcWt = (2 * bandLength * filmWidth * filmThickness * 0.9) / 1000;
      next.wt_of_capacitor = Number(calcWt.toFixed(2));
    } else if (["band_length", "mpp_film_width", "mpp_film_thickness", "wound_cap_basic_value", "active_width"].includes(changedField)) {
      if (!bandLength || !filmWidth || !filmThickness) {
        next.wt_of_capacitor = "";
      }
    }
  }

  return next;
}

function handleFormFieldChange(name, value) {
  setFormValues((current) => {
    const next = { ...current, [name]: value };

    if (activeSection === "consumption" && name === "product_id" && value) {
      const selectedPrd = lookupOptions.products?.find((p) => String(p.id) === String(value));
      if (selectedPrd) {
        if (selectedPrd.unit && (!next.unit || next.unit === "num")) {
          next.unit = selectedPrd.unit;
        }
        if ((!next.raw_materials || next.raw_materials.length === 0) && Array.isArray(selectedPrd.raw_materials) && selectedPrd.raw_materials.length > 0) {
          next.raw_materials = selectedPrd.raw_materials.map((it) => ({
            raw_material_id: it.raw_material_id || it.id,
            material_name: it.material_name || it.name,
            code: it.code || "",
            unit: it.unit || "",
            quantity: it.quantity || 1,
          }));
          next.raw_material_ids = next.raw_materials.map((it) => it.raw_material_id);
        }
      }
    }

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
        } else if (value === "other") {
          next.element_id = "";
          next.welded_element_id = "";
        }
      } else if (activeSection === "dailyDispatch") {
        setDailyDispatchType(value);
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

    if (name === "zach_mode") {
      if (value === "without_zach_code") {
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
    if (name === "supplier_type") {
      next.supplier_type = value;
      if (value === "general") {
        next.supplier_id = "";
      }
    }

    if (name === "raw_material_type") {
      next.raw_material_type = value;
      if (value === "other") {
        next.type = "other";
        next.raw_material_id = "";
        next.product_id = "";
        next.element_id = "";
      } else if (value === "product") {
        next.type = "product";
        next.raw_material_id = "";
        next.rate = "";
        next.basic_value = 0;
        next.discount_percent = 0;
        next.discount_amount = 0;
        next.amount = 0;
        next.cgst_percent = 0;
        next.ut_sgst_percent = 0;
        next.igst_percent = 0;
        next.cgst_amount = 0;
        next.ut_sgst_amount = 0;
        next.igst_amount = 0;
        next.total_amount = 0;
      } else {
        next.type = "raw_material";
        next.product_id = "";
        next.element_id = "";
      }
    }

    if (name === "supplier_company_name") {
      next.supplier_company_name = value;
      const isGeneral = (next.supplier_type || formValues.supplier_type) === "general";
      if (!isGeneral) {
        const matchedSup = lookupOptions.suppliers?.find(
          (s) => String(s.company_name || "").trim().toLowerCase() === String(value).trim().toLowerCase()
        );
        if (matchedSup) {
          if (matchedSup.contact_person) next.supplier_contact_person = matchedSup.contact_person;
          if (matchedSup.phone) next.supplier_phone = matchedSup.phone;
          if (matchedSup.email) next.supplier_email = matchedSup.email;
          if (matchedSup.address) next.supplier_address = matchedSup.address;
          if (matchedSup.city) next.supplier_city = matchedSup.city;
          if (matchedSup.state) next.supplier_state = matchedSup.state;
          if (matchedSup.pincode) next.supplier_pincode = matchedSup.pincode;
          if (matchedSup.gst_number) next.supplier_gst_number = matchedSup.gst_number;
        }
      }
    }

    if (name === "material_name") {
      next.item = value;
      next.material_name = value;
      const isGeneral = (next.supplier_type || formValues.supplier_type) === "general";
      if (isGeneral) {
        next.raw_material_id = "";
      } else {
        const matchedRm = lookupOptions.rawMaterials?.find(
          (m) => String(m.material_name || "").trim().toLowerCase() === String(value).trim().toLowerCase()
        );
        if (matchedRm) {
          next.raw_material_id = matchedRm.id;
          if (matchedRm.unit && (!next.unit || next.unit === "num")) next.unit = matchedRm.unit;
          if (matchedRm.hsn_code && !next.hsn_code) next.hsn_code = matchedRm.hsn_code;
          if (matchedRm.zach_code && !next.zach_code) next.zach_code = matchedRm.zach_code;
          if (matchedRm.rate !== undefined && matchedRm.rate !== null && matchedRm.rate !== "" && (next.rate === "" || next.rate === undefined || next.rate === 0)) {
            next.rate = matchedRm.rate;
          }
          if (matchedRm.discount_percent !== undefined && matchedRm.discount_percent !== null) {
            next.discount_percent = matchedRm.discount_percent;
          }
          if (matchedRm.cgst_percent !== undefined && matchedRm.cgst_percent !== null) {
            next.cgst_percent = matchedRm.cgst_percent;
          }
          if (matchedRm.ut_sgst_percent !== undefined && matchedRm.ut_sgst_percent !== null) {
            next.ut_sgst_percent = matchedRm.ut_sgst_percent;
          }
          if (matchedRm.igst_percent !== undefined && matchedRm.igst_percent !== null) {
            next.igst_percent = matchedRm.igst_percent;
          }
        } else {
          next.raw_material_id = "";
        }
      }
    }

    if (name === "raw_material_id") {
      const selectedRm = lookupOptions.rawMaterials?.find(
        (m) => String(m.id) === String(value)
      );
      if (selectedRm) {
        next.item = selectedRm.material_name || "";
        next.unit = selectedRm.unit ?? "";
        next.hsn_code = selectedRm.hsn_code ?? "";
        next.zach_code = selectedRm.zach_code ?? "";
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
        next.discount_amount = 0;
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
        "basic_value",
        "discount_percent",
        "discount_amount",
        "material_name",
        "raw_material_id",
        "product_id",
        "element_id",
      ].includes(name)
    ) {
      const quantity = Number(next.quantity) || 0;
      const rate = Number(next.rate) || 0;
      const grossAmount = Number((quantity * rate).toFixed(2));
      next.basic_value = grossAmount;

      if (name === "discount_amount") {
        const discAmt = Number(next.discount_amount) || 0;
        if (grossAmount > 0) {
          next.discount_percent = Number(((discAmt * 100) / grossAmount).toFixed(2));
        }
        next.amount = Number((grossAmount - discAmt).toFixed(2));
      } else {
        const discountPercent = Number(next.discount_percent) || 0;
        const discountAmount = (grossAmount * discountPercent) / 100;
        next.discount_amount = Number(discountAmount.toFixed(2));
        next.amount = Number((grossAmount - discountAmount).toFixed(2));
      }
    }

    // Calculate GST amounts and Total Amount on the discounted Amount
    if (
      [
        "quantity",
        "rate",
        "basic_value",
        "amount",
        "discount_percent",
        "discount_amount",
        "material_name",
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

    if (activeSection === "dailyInputs" && (next.type === "product" || next.raw_material_type === "product" || next.type === "element")) {
      next.rate = "";
      next.basic_value = 0;
      next.discount_percent = 0;
      next.discount_amount = 0;
      next.amount = 0;
      next.cgst_percent = 0;
      next.ut_sgst_percent = 0;
      next.igst_percent = 0;
      next.cgst_amount = 0;
      next.ut_sgst_amount = 0;
      next.igst_amount = 0;
    }

    if (activeSection === "costData") {
      const costFields = [
        "type",
        "wound_cap_basic_value",
        "mpp_film_width",
        "mpp_film_thickness",
        "core_od",
        "film_free_margin",
        "winding_stagger",
        "active_width",
        "band_length",
        "wound_capacitor_od",
        "turns_to_be_wound",
        "wt_of_capacitor",
      ];
      if (costFields.includes(name)) {
        return calculateCostDataBasicAutofill(next, name);
      }
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
    if (activeSection === "rawMaterials") {
      emptyValues.zach_mode = "without_zach_code";
      emptyValues.zach_code = "";
    }
    if (activeSection === "products") {
      emptyValues.product_mode = "with_zach_code";
      emptyValues.zach_code = "";
      emptyValues.raw_materials = [];
      emptyValues.raw_material_ids = [];
    }
    if (activeSection === "dailyInputs") {
      emptyValues.type = "";
      emptyValues.supplier_type = "supplier";
      emptyValues.raw_material_id = "";
      emptyValues.product_id = "";
      emptyValues.element_id = "";
      setStagedDailyInputs([]);
    }
    setFormValues(emptyValues);
    setFormType(activeSection === "costData" ? "Basic" : activeSection === "products" ? "element" : activeSection === "dailyDispatch" ? "Job work" : "");
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
    setStagedDailyInputs([]);
    setProductSaveConfirm(null);
    setFormType(section === "costData" ? "Basic" : section === "products" ? "element" : section === "dailyDispatch" ? "Job work" : "raw_material");
    if (section === "dailyDispatch") {
      setDailyDispatchType("Job work");
    }
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
      ? ["suppliers", "rawMaterials", "products"]
      : activeSection === "dailyDispatch"
      ? ["dailyInputs", "products", "suppliers", "customers"]
      : activeSection === "products"
      ? ["rawMaterials", "products"]
      : activeSection === "consumption"
      ? ["products", "rawMaterials"]
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
      "out_quantity",
      "ok",
      "reject",
      "daily_input_id",
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
      "basic_value",
      "discount_percent",
      "discount_amount",
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
        if (value === "other" && formValues[`${key}_other`]) {
          record[key] = String(formValues[`${key}_other`]).trim();
        } else if (value === "other") {
          record[key] = "other";
        } else {
          record[key] = value;
        }
      }
    }

    // Only send fields that belong to the active section form.
    const sectionFields = (
      (editingRecord ? activeConfig.updateFields : activeConfig.fields) || []
    ).map((field) => field.name);
    const sectionAllowedFields = new Set([
      ...sectionFields,
      ...(activeSection === "consumption"
        ? [
            "product_id",
            "product_name",
            "product_code",
            "raw_materials",
            "raw_material_ids",
            "user_id",
          ]
        : []),
      ...(activeSection === "rawMaterials" ? ["zach_code", "has_zach_code", "details"] : []),
      ...(activeSection === "products" ? ["zach_code", "has_zach_code", "po_batch_no", "ls", "hsn_code", "sach_code", "bin", "boxes", "raw_material_id", "raw_material_ids", "raw_materials", "element_id", "welded_element_id"] : []),
      ...(activeSection === "dailyDispatch"
        ? [
            "type",
            "daily_input_id",
            "product_id",
            "supplier_id",
            "customer_id",
            "dc_no",
            "dc_date",
            "DC_no",
            "DC_date",
            "bill_no",
            "bill_date",
            "item",
            "zach_code",
            "po_batch_no",
            "sach_code",
            "ls",
            "quantity",
            "bin",
            "boxes",
            "unit",
            "hsn_code",
            "total_amount",
            "remarks",
            "out_dc_no",
            "out_dc_date",
            "out_quantity",
            "ok",
            "reject",
            "other_details",
            "user_id",
          ]
        : []),
      ...(activeSection === "dailyInputs"
        ? [
            "type",
            "raw_material_id",
            "product_id",
            "element_id",
            "supplier_id",
            "supplier_type",
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
            "basic_value",
            "discount_percent",
            "discount_amount",
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
            "zach_code",
            "po_batch_no",
            "ls",
            "sach_code",
            "bin",
            "boxes",
            "supplier_company_name",
            "supplier_contact_person",
            "supplier_email",
            "supplier_phone",
            "supplier_address",
            "supplier_city",
            "supplier_state",
            "supplier_pincode",
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
    // Prepare Raw Materials payload
    // --------------------------------------------------
    if (activeSection === "rawMaterials") {
      delete record.zach_mode;
      const isWithZach =
        formValues.zach_mode === "with_zach_code" ||
        (!formValues.zach_mode && (editingRecord?.has_zach_code || Boolean(editingRecord?.zach_code)));

      if (isWithZach) {
        const zachCodeVal = (formValues.zach_code ?? (editingRecord ? editingRecord.zach_code : "") ?? "").trim();
        if (!zachCodeVal) {
          setPageError("Zach No is required when 'zach no' is selected.");
          setIsSaving(false);
          return;
        }
        record.has_zach_code = true;
        record.zach_code = zachCodeVal;
      } else {
        record.has_zach_code = false;
        record.zach_code = null;
      }

      record.details = formValues.details !== undefined
        ? (formValues.details ? String(formValues.details).trim() : null)
        : (editingRecord?.details ?? null);
    }

    // --------------------------------------------------
    // Prepare Products payload
    // --------------------------------------------------
    if (activeSection === "products") {
      const isWithZach =
        formValues.product_mode === "with_zach_code" ||
        (!formValues.product_mode && (editingRecord?.has_zach_code || Boolean(editingRecord?.zach_code)));

      const typeVal = formValues.type === "other"
        ? (String(formValues.type_other || "").trim() || "other")
        : formValues.type || (editingRecord ? editingRecord.type : "element");
      record.type = typeVal;

      record.ls = formValues.ls !== undefined
        ? (formValues.ls ? String(formValues.ls).trim() : null)
        : (editingRecord?.ls ?? null);
      record.hsn_code = formValues.hsn_code !== undefined
        ? (formValues.hsn_code ? String(formValues.hsn_code).trim() : null)
        : (editingRecord?.hsn_code ?? null);
      record.sach_code = formValues.sach_code !== undefined
        ? (formValues.sach_code ? String(formValues.sach_code).trim() : null)
        : (editingRecord?.sach_code ?? null);

      if (isWithZach) {
        record.has_zach_code = true;
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
        } else {
          record.element_id = null;
          record.welded_element_id = null;
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
    // Prepare Consumption payload
    // --------------------------------------------------
    if (activeSection === "consumption") {
      if (!record.product_id) {
        setPageError("Please select a product.");
        setIsSaving(false);
        return;
      }
      record.product_id = Number(record.product_id);
      const prd = lookupOptions.products?.find((p) => Number(p.id) === record.product_id);
      if (prd) {
        record.product_name = prd.name;
        record.product_code = prd.code;
      }

      const rms = (Array.isArray(formValues.raw_materials) ? formValues.raw_materials : [])
        .filter((it) => it && (it.raw_material_id || it.id))
        .map((it) => ({
          raw_material_id: Number(it.raw_material_id || it.id),
          quantity:
            it.quantity !== "" && it.quantity !== null && it.quantity !== undefined
              ? Number(it.quantity)
              : 1,
        }));

      if (rms.length === 0) {
        setPageError("Please add at least one raw material.");
        setIsSaving(false);
        return;
      }

      record.raw_materials = rms;
      record.raw_material_ids = rms.map((it) => it.raw_material_id);
      if ((record.user_id === undefined || record.user_id === null) && user?.id) {
        record.user_id = user.id;
      }
    }

    // --------------------------------------------------
    // Prepare Cost Data payload
    // --------------------------------------------------
    if (activeSection === "costData") {
      const typeVal = formValues.type === "other"
        ? (String(formValues.type_other || "").trim() || "other")
        : formValues.type || (editingRecord ? editingRecord.type : "Basic");
      record.type = typeVal;

      if (typeVal === "Basic") {
        record.wound_cap_element_value = null;
        record.pp_film_width = null;
        record.pp_film_thickness = null;

        const calculated = calculateCostDataBasicAutofill(record, "submit");
        record.active_width = calculated.active_width !== undefined && calculated.active_width !== "" ? calculated.active_width : null;
        record.band_length = calculated.band_length !== undefined && calculated.band_length !== "" ? calculated.band_length : null;
        record.wound_capacitor_od = calculated.wound_capacitor_od !== undefined && calculated.wound_capacitor_od !== "" ? calculated.wound_capacitor_od : null;
        record.turns_to_be_wound = calculated.turns_to_be_wound !== undefined && calculated.turns_to_be_wound !== "" ? calculated.turns_to_be_wound : null;
        record.wt_of_capacitor = calculated.wt_of_capacitor !== undefined && calculated.wt_of_capacitor !== "" ? calculated.wt_of_capacitor : null;
      } else if (typeVal === "Element") {
        record.wound_cap_basic_value = null;
        record.mpp_film_width = null;
        record.mpp_film_thickness = null;
      }
    }

    if (activeSection === "dailyDispatch") {
      record.type = formValues.type || dailyDispatchType || (editingRecord ? editingRecord.type : "Job work");
      if (record.DC_no !== undefined) {
        record.dc_no = record.DC_no;
        delete record.DC_no;
      }
      if (record.DC_date !== undefined) {
        record.dc_date = record.DC_date;
        delete record.DC_date;
      }
      if ((record.user_id === undefined || record.user_id === null) && user?.id) {
        record.user_id = Number(user.id);
      }
    }

    // --------------------------------------------------
    // 2. Prepare Daily Inputs payload & batch save for new entries
    // --------------------------------------------------
    if (activeSection === "dailyInputs" && !editingRecord) {
      const supplierType = formValues.supplier_type || "supplier";
      const isOther = (formValues.type || formType) === "other";
      const suppId = formValues.supplier_id ? Number(formValues.supplier_id) : null;
      const suppCompName = String(formValues.supplier_company_name || "").trim();

      if (supplierType !== "general") {
        if (!isOther && (!suppId || suppId <= 0)) {
          setPageError("Supplier is compulsory. Please search and select a supplier from the list.");
          setIsSaving(false);
          return;
        }
        if (isOther && !suppCompName) {
          setPageError("Supplier company name is compulsory.");
          setIsSaving(false);
          return;
        }
      }

      let itemsToSave = [...stagedDailyInputs];

      const hasActiveItem = Boolean(
        (formValues.raw_material_id || formValues.product_id || formValues.item || formValues.material_name) &&
        Number(formValues.quantity) > 0
      );

      if (hasActiveItem) {
        const curRmType = formValues.raw_material_type || (formValues.type === "other" ? "other" : (formValues.type === "product" ? "product" : "raw_material"));
        const curType = curRmType === "product" || formValues.type === "product" || formValues.type === "element"
          ? "product"
          : supplierType === "general"
            ? (curRmType === "other" ? "other" : "raw_material")
            : (curRmType === "other" ? "other" : (formValues.type || formType || "raw_material"));
        let curItemName = formValues.material_name || formValues.item || "";
        let curRmId = formValues.raw_material_id ? Number(formValues.raw_material_id) : null;
        let curPrdId = formValues.product_id ? Number(formValues.product_id) : (formValues.element_id ? Number(formValues.element_id) : null);

        if ((curType === "product" || curType === "element") && curPrdId) {
          const p = (lookupOptions.products || []).find((prd) => Number(prd.id) === curPrdId);
          if (p) curItemName = p.name;
          curRmId = null;
        } else if (supplierType === "general") {
          curItemName = String(formValues.material_name || formValues.item || "").trim();
          curRmId = null;
        } else if (curRmType === "other" || curType === "other") {
          curItemName = String(formValues.material_name || formValues.item || "").trim();
          curRmId = null;
        } else if (curType === "raw_material" && curRmId) {
          const m = (lookupOptions.rawMaterials || []).find((rm) => Number(rm.id) === curRmId);
          if (m) curItemName = m.material_name;
        } else if (isOther) {
          curItemName = formValues.material_name || formValues.item || "";
        }

        const isProductItem = curType === "product" || curType === "element" || curRmType === "product";
        const curQty = Number(formValues.quantity);
        const curRate = isProductItem ? 0 : (Number(formValues.rate) || 0);
        const curBasic = isProductItem ? 0 : Number((curQty * curRate).toFixed(2));
        const curDiscPct = isProductItem ? 0 : (Number(formValues.discount_percent) || 0);
        const curDiscAmt = isProductItem ? 0 : (formValues.discount_amount !== undefined && formValues.discount_amount !== ""
          ? Number(formValues.discount_amount)
          : Number(((curBasic * curDiscPct) / 100).toFixed(2)));
        const curTaxable = isProductItem ? 0 : Number((curBasic - curDiscAmt).toFixed(2));
        const curCgstPct = isProductItem ? 0 : (Number(formValues.cgst_percent) || 0);
        const curSgstPct = isProductItem ? 0 : (Number(formValues.ut_sgst_percent) || 0);
        const curIgstPct = isProductItem ? 0 : (Number(formValues.igst_percent) || 0);
        const curCgstAmt = isProductItem ? 0 : Number(((curTaxable * curCgstPct) / 100).toFixed(2));
        const curSgstAmt = isProductItem ? 0 : Number(((curTaxable * curSgstPct) / 100).toFixed(2));
        const curIgstAmt = isProductItem ? 0 : Number(((curTaxable * curIgstPct) / 100).toFixed(2));
        const curTotalAmt = isProductItem
          ? (formValues.total_amount !== undefined && formValues.total_amount !== "" ? Number(formValues.total_amount) : 0)
          : Number((curTaxable + curCgstAmt + curSgstAmt + curIgstAmt).toFixed(2));

        const matchedCurRm = !isProductItem
          ? (lookupOptions.rawMaterials || []).find(
              (rm) =>
                (curRmId && Number(rm.id) === Number(curRmId)) ||
                String(rm.material_name || "").trim().toLowerCase() === String(curItemName).trim().toLowerCase()
            )
          : null;
        const resolvedCurHsn = formValues.hsn_code || matchedCurRm?.hsn_code || "";
        const resolvedCurZach = formValues.zach_code || matchedCurRm?.zach_code || "";

        itemsToSave.push({
          item: curItemName,
          supplier_type: supplierType,
          type: isProductItem ? "product" : curType,
          raw_material_type: isProductItem ? "product" : curRmType,
          raw_material_id: curRmId,
          product_id: curPrdId,
          element_id: curPrdId,
          quantity: curQty,
          unit: formValues.unit === "other" && formValues.unit_other ? formValues.unit_other : (formValues.unit || ""),
          rate: curRate,
          basic_value: curBasic,
          discount_percent: curDiscPct,
          discount_amount: curDiscAmt,
          amount: curTaxable,
          cgst_percent: curCgstPct,
          ut_sgst_percent: curSgstPct,
          igst_percent: curIgstPct,
          cgst_amount: curCgstAmt,
          ut_sgst_amount: curSgstAmt,
          igst_amount: curIgstAmt,
          total_amount: curTotalAmt,
          hsn_code: resolvedCurHsn,
          zach_code: resolvedCurZach,
          po_batch_no: formValues.po_batch_no || "",
          ls: formValues.ls || "",
          sach_code: formValues.sach_code || "",
          bin: formValues.bin || "",
          boxes: formValues.boxes || "",
          remarks: formValues.remarks || "",
          supplier_company_name: formValues.supplier_company_name || "",
          supplier_contact_person: formValues.supplier_contact_person || "",
          supplier_phone: formValues.supplier_phone || "",
          supplier_email: formValues.supplier_email || "",
          supplier_address: formValues.supplier_address || "",
          supplier_city: formValues.supplier_city || "",
          supplier_state: formValues.supplier_state || "",
          supplier_pincode: formValues.supplier_pincode || "",
          supplier_gst_number: formValues.supplier_gst_number || "",
          other_details: formValues.other_details || (supplierType === "general" ? {
            material_name: curItemName,
            supplier_type: "general",
            raw_material_type: curRmType,
            supplier_company_name: formValues.supplier_company_name || "",
            supplier_contact_person: formValues.supplier_contact_person || "",
            supplier_phone: formValues.supplier_phone || "",
            supplier_email: formValues.supplier_email || "",
            supplier_address: formValues.supplier_address || "",
            supplier_city: formValues.supplier_city || "",
            supplier_state: formValues.supplier_state || "",
            supplier_pincode: formValues.supplier_pincode || "",
            supplier_gst_number: formValues.supplier_gst_number || "",
            cgst_percent: curCgstPct,
            ut_sgst_percent: curSgstPct,
            igst_percent: curIgstPct,
            hsn_code: resolvedCurHsn,
            zach_code: resolvedCurZach,
            po_batch_no: formValues.po_batch_no || "",
            ls: formValues.ls || "",
            sach_code: formValues.sach_code || "",
            bin: formValues.bin || "",
            boxes: formValues.boxes || "",
          } : null),
        });
      }

      if (itemsToSave.length === 0) {
        setPageError(
          supplierType === "general"
            ? "Please enter or select an item and a valid quantity before saving."
            : "Please add at least one item with a valid quantity before saving."
        );
        setIsSaving(false);
        return;
      }

      setIsSaving(true);
      const commonHeader = {
        dc_no: formValues.DC_no || formValues.dc_no || null,
        dc_date: formValues.DC_date || formValues.dc_date || null,
        bill_no: formValues.bill_no || null,
        bill_date: formValues.bill_date || null,
        supplier_id: supplierType === "general" ? null : (isOther ? null : suppId),
        supplier_type: supplierType,
        supplier_company_name: supplierType === "general" ? (formValues.supplier_company_name || null) : null,
        supplier_contact_person: supplierType === "general" ? (formValues.supplier_contact_person || null) : null,
        supplier_phone: supplierType === "general" ? (formValues.supplier_phone || null) : null,
        supplier_email: supplierType === "general" ? (formValues.supplier_email || null) : null,
        supplier_address: supplierType === "general" ? (formValues.supplier_address || null) : null,
        supplier_city: supplierType === "general" ? (formValues.supplier_city || null) : null,
        supplier_state: supplierType === "general" ? (formValues.supplier_state || null) : null,
        supplier_pincode: supplierType === "general" ? (formValues.supplier_pincode || null) : null,
        supplier_gst_number: supplierType === "general" ? (formValues.supplier_gst_number || null) : null,
        user_id: user?.id ? Number(user.id) : null,
        customer_id: null,
      };

      const createdList = [];
      let failureError = null;

      for (let i = 0; i < itemsToSave.length; i++) {
        const item = itemsToSave[i];
        const itemSupplierType = item.supplier_type || supplierType;
        const isProdPayload = item.type === "product" || item.type === "element" || item.raw_material_type === "product";
        const payload = {
          ...commonHeader,
          supplier_type: itemSupplierType,
          supplier_id: itemSupplierType === "general" ? null : commonHeader.supplier_id,
          supplier_company_name: itemSupplierType === "general" ? (item.supplier_company_name || commonHeader.supplier_company_name || null) : null,
          supplier_contact_person: itemSupplierType === "general" ? (item.supplier_contact_person || commonHeader.supplier_contact_person || null) : null,
          supplier_phone: itemSupplierType === "general" ? (item.supplier_phone || commonHeader.supplier_phone || null) : null,
          supplier_email: itemSupplierType === "general" ? (item.supplier_email || commonHeader.supplier_email || null) : null,
          supplier_address: itemSupplierType === "general" ? (item.supplier_address || commonHeader.supplier_address || null) : null,
          supplier_city: itemSupplierType === "general" ? (item.supplier_city || commonHeader.supplier_city || null) : null,
          supplier_state: itemSupplierType === "general" ? (item.supplier_state || commonHeader.supplier_state || null) : null,
          supplier_pincode: itemSupplierType === "general" ? (item.supplier_pincode || commonHeader.supplier_pincode || null) : null,
          supplier_gst_number: itemSupplierType === "general" ? (item.supplier_gst_number || commonHeader.supplier_gst_number || null) : null,
          type: item.type || "raw_material",
          raw_material_id: itemSupplierType === "general" ? null : (item.raw_material_id || null),
          product_id: item.product_id || null,
          element_id: item.element_id || null,
          item: item.item,
          quantity: item.quantity,
          unit: item.unit || null,
          rate: isProdPayload ? 0 : (item.rate !== undefined && item.rate !== null && item.rate !== "" ? Number(item.rate) : 0),
          basic_value: isProdPayload ? 0 : (item.basic_value !== undefined && item.basic_value !== null ? Number(item.basic_value) : 0),
          discount_percent: isProdPayload ? 0 : (item.discount_percent !== undefined && item.discount_percent !== null ? Number(item.discount_percent) : 0),
          discount_amount: isProdPayload ? 0 : (item.discount_amount !== undefined && item.discount_amount !== null ? Number(item.discount_amount) : 0),
          cgst_percent: isProdPayload ? 0 : (item.cgst_percent !== undefined && item.cgst_percent !== null ? Number(item.cgst_percent) : 0),
          ut_sgst_percent: isProdPayload ? 0 : (item.ut_sgst_percent !== undefined && item.ut_sgst_percent !== null ? Number(item.ut_sgst_percent) : 0),
          igst_percent: isProdPayload ? 0 : (item.igst_percent !== undefined && item.igst_percent !== null ? Number(item.igst_percent) : 0),
          amount: isProdPayload ? 0 : (item.amount !== undefined && item.amount !== null ? Number(item.amount) : 0),
          cgst_amount: isProdPayload ? 0 : (item.cgst_amount !== undefined && item.cgst_amount !== null ? Number(item.cgst_amount) : 0),
          ut_sgst_amount: isProdPayload ? 0 : (item.ut_sgst_amount !== undefined && item.ut_sgst_amount !== null ? Number(item.ut_sgst_amount) : 0),
          igst_amount: isProdPayload ? 0 : (item.igst_amount !== undefined && item.igst_amount !== null ? Number(item.igst_amount) : 0),
          total_amount: item.total_amount !== undefined && item.total_amount !== null && item.total_amount !== "" ? Number(item.total_amount) : 0,
          hsn_code: item.hsn_code || null,
          zach_code: item.zach_code || null,
          po_batch_no: item.po_batch_no || null,
          ls: item.ls || null,
          sach_code: item.sach_code || null,
          bin: item.bin || null,
          boxes: item.boxes || null,
          remarks: item.remarks || null,
          other_details: item.other_details || (itemSupplierType === "general" ? {
            material_name: item.item,
            supplier_type: "general",
            supplier_company_name: item.supplier_company_name || commonHeader.supplier_company_name || null,
            supplier_contact_person: item.supplier_contact_person || commonHeader.supplier_contact_person || null,
            supplier_phone: item.supplier_phone || commonHeader.supplier_phone || null,
            supplier_email: item.supplier_email || commonHeader.supplier_email || null,
            supplier_address: item.supplier_address || commonHeader.supplier_address || null,
            supplier_city: item.supplier_city || commonHeader.supplier_city || null,
            supplier_state: item.supplier_state || commonHeader.supplier_state || null,
            supplier_pincode: item.supplier_pincode || commonHeader.supplier_pincode || null,
            supplier_gst_number: item.supplier_gst_number || commonHeader.supplier_gst_number || null,
            cgst_percent: item.cgst_percent,
            ut_sgst_percent: item.ut_sgst_percent,
            igst_percent: item.igst_percent,
            hsn_code: item.hsn_code || null,
            zach_code: item.zach_code || null,
            po_batch_no: item.po_batch_no || null,
            ls: item.ls || null,
            sach_code: item.sach_code || null,
            bin: item.bin || null,
            boxes: item.boxes || null,
          } : isOther ? {
            material_name: item.item,
            supplier_company_name: formValues.supplier_company_name,
            supplier_contact_person: formValues.supplier_contact_person,
            supplier_email: formValues.supplier_email,
            supplier_phone: formValues.supplier_phone,
            supplier_address: formValues.supplier_address,
            supplier_city: formValues.supplier_city,
            supplier_state: formValues.supplier_state,
            supplier_pincode: formValues.supplier_pincode,
            supplier_gst_number: formValues.supplier_gst_number,
          } : null),
        };

        const res = await window.desktop.createWorkspaceRecord("dailyInputs", payload);
        if (!res.ok) {
          failureError = res.error;
          break;
        }
        if (res.data) {
          createdList.push(res.data);
        }
      }

      setIsSaving(false);

      if (failureError) {
        setPageError(typeof failureError === "string" ? failureError : JSON.stringify(failureError));
        if (createdList.length > 0) {
          setRecords((prev) => [...createdList, ...prev]);
          setStagedDailyInputs((prev) => prev.slice(createdList.length));
        }
        return;
      }

      setRecords((prev) => [...createdList, ...prev]);
      setStagedDailyInputs([]);
      setFormValues({});
      setIsFormOpen(false);
      setNotice(`Successfully saved ${createdList.length} daily input record(s) to database.`);
      setRequestVersion((v) => v + 1);
      return;
    }

    if (activeSection === "dailyInputs") {
      const supplierType = formValues.supplier_type || (editingRecord ? editingRecord.supplier_type : "supplier") || "supplier";
      record.supplier_type = supplierType;

      if (supplierType === "general") {
        record.supplier_id = null;
        record.raw_material_id = null;
        const isProdGeneral = formValues.raw_material_type === "product" || formValues.type === "product" || formValues.type === "element";
        if (isProdGeneral) {
          let prdId = formValues.product_id || formValues.element_id || editingRecord?.product_id || editingRecord?.element_id || null;
          record.type = "product";
          record.product_id = prdId ? Number(prdId) : null;
          record.element_id = prdId ? Number(prdId) : null;
        } else {
          record.type = "raw_material";
          record.product_id = null;
          record.element_id = null;
        }
        const itemName = formValues.material_name || formValues.item || (editingRecord ? editingRecord.item : "");
        if (!itemName || !String(itemName).trim()) {
          setPageError(isProdGeneral ? "Product name is required." : "Material name is required.");
          setIsSaving(false);
          return;
        }
        record.item = String(itemName).trim();
        if (formValues.unit === "other" && formValues.unit_other) {
          record.unit = formValues.unit_other;
        }
        record.supplier_company_name = formValues.supplier_company_name !== undefined ? formValues.supplier_company_name : (editingRecord?.supplier_company_name || null);
        record.supplier_contact_person = formValues.supplier_contact_person !== undefined ? formValues.supplier_contact_person : (editingRecord?.supplier_contact_person || null);
        record.supplier_phone = formValues.supplier_phone !== undefined ? formValues.supplier_phone : (editingRecord?.supplier_phone || null);
        record.supplier_email = formValues.supplier_email !== undefined ? formValues.supplier_email : (editingRecord?.supplier_email || null);
        record.supplier_address = formValues.supplier_address !== undefined ? formValues.supplier_address : (editingRecord?.supplier_address || null);
        record.supplier_city = formValues.supplier_city !== undefined ? formValues.supplier_city : (editingRecord?.supplier_city || null);
        record.supplier_state = formValues.supplier_state !== undefined ? formValues.supplier_state : (editingRecord?.supplier_state || null);
        record.supplier_pincode = formValues.supplier_pincode !== undefined ? formValues.supplier_pincode : (editingRecord?.supplier_pincode || null);
        record.supplier_gst_number = formValues.supplier_gst_number !== undefined ? formValues.supplier_gst_number : (editingRecord?.supplier_gst_number || null);

        record.other_details = {
          ...(editingRecord?.other_details || {}),
          material_name: record.item,
          supplier_type: "general",
          supplier_company_name: record.supplier_company_name,
          supplier_contact_person: record.supplier_contact_person,
          supplier_phone: record.supplier_phone,
          supplier_email: record.supplier_email,
          supplier_address: record.supplier_address,
          supplier_city: record.supplier_city,
          supplier_state: record.supplier_state,
          supplier_pincode: record.supplier_pincode,
          supplier_gst_number: record.supplier_gst_number,
          cgst_percent: record.cgst_percent,
          ut_sgst_percent: record.ut_sgst_percent,
          igst_percent: record.igst_percent,
          hsn_code: record.hsn_code,
          zach_code: record.zach_code,
          po_batch_no: record.po_batch_no,
          ls: record.ls,
          sach_code: record.sach_code,
          bin: record.bin,
          boxes: record.boxes,
        };
      } else {
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
          record.customer_id = null;
        } else if (typeVal === "other") {
          const itemName = formValues.material_name || formValues.item || (editingRecord ? editingRecord.item : "");
          if (!itemName || !String(itemName).trim()) {
            setPageError("Material / item name is required.");
            setIsSaving(false);
            return;
          }
          const suppCompName = String(
            formValues.supplier_company_name ||
            editingRecord?.other_details?.supplier_company_name ||
            editingRecord?.other_details?.company_name ||
            ""
          ).trim();
          if (!suppCompName) {
            setPageError("Supplier company name is compulsory.");
            setIsSaving(false);
            return;
          }
        }

        if (typeVal === "raw_material" || typeVal === "product" || typeVal === "element") {
          const suppId =
            formValues.supplier_id !== undefined &&
            formValues.supplier_id !== "" &&
            formValues.supplier_id !== null
              ? formValues.supplier_id
              : (editingRecord ? editingRecord.supplier_id : null);
          if (!suppId || Number(suppId) <= 0) {
            setPageError("Supplier is compulsory. Please search and select a supplier from the list.");
            setIsSaving(false);
            return;
          }
          record.supplier_id = Number(suppId);
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
          basic_value: formValues.basic_value !== undefined && formValues.basic_value !== "" ? Number(formValues.basic_value) : (record.basic_value !== undefined && record.basic_value !== null ? Number(record.basic_value) : null),
          discount_percent: formValues.discount_percent !== undefined && formValues.discount_percent !== "" ? Number(formValues.discount_percent) : null,
          discount_amount: formValues.discount_amount !== undefined && formValues.discount_amount !== "" ? Number(formValues.discount_amount) : null,
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
          supplier_pincode: formValues.supplier_pincode || null,
          supplier_gst_number: formValues.supplier_gst_number || null,
        };
        otherDetails.company_name = otherDetails.supplier_company_name;
        otherDetails.contact_person = otherDetails.supplier_contact_person;
        otherDetails.email = otherDetails.supplier_email;
        otherDetails.phone = otherDetails.supplier_phone;
        otherDetails.address = otherDetails.supplier_address;
        otherDetails.city = otherDetails.supplier_city;
        otherDetails.state = otherDetails.supplier_state;
        otherDetails.pincode = otherDetails.supplier_pincode;
        otherDetails.gst_number = otherDetails.supplier_gst_number;
        otherDetails.raw_material = {
          material_name: otherDetails.material_name,
          hsn_code: otherDetails.hsn_code,
          unit: otherDetails.unit,
          rate: otherDetails.rate,
          discount_percent: otherDetails.discount_percent,
          discount_amount: otherDetails.discount_amount,
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
          pincode: otherDetails.supplier_pincode,
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
        "basic_value",
        "discount_percent",
        "discount_amount",
        "type",
        "supplier_id",
        "supplier_type",
        "supplier_company_name",
        "supplier_contact_person",
        "supplier_phone",
        "supplier_email",
        "supplier_address",
        "supplier_city",
        "supplier_state",
        "supplier_pincode",
        "supplier_gst_number",
        "hsn_code",
        "zach_code",
        "po_batch_no",
        "ls",
        "sach_code",
        "bin",
        "boxes",
        "cgst_percent",
        "ut_sgst_percent",
        "igst_percent",
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

      if (record.type === "product" || record.type === "element") {
        record.rate = 0;
        record.basic_value = 0;
        record.discount_percent = 0;
        record.discount_amount = 0;
        record.amount = 0;
        record.cgst_percent = 0;
        record.ut_sgst_percent = 0;
        record.igst_percent = 0;
        record.cgst_amount = 0;
        record.ut_sgst_amount = 0;
        record.igst_amount = 0;
        record.total_amount = 0;
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

      // Resolve the selected raw material or product name.
      if (record.type === "raw_material" && record.supplier_type !== "general") {
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
        "basic_value",
        "discount_amount",
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
            (key === "type" || key === "supplier_type" || key === "raw_material_id" || key === "product_id" || key === "element_id" || (key === "rate" && formValues.rate !== "" && formValues.rate !== null && formValues.rate !== undefined))
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
        supplier_id: prev.supplier_id ?? formValues.supplier_id ?? "",
        raw_material_id: "",
        product_id: "",
        element_id: "",
        material_name: "",
        hsn_code: "",
        zach_code: "",
        po_batch_no: "",
        ls: "",
        sach_code: "",
        bin: "",
        boxes: "",
        remarks: "",
        supplier_company_name: prev.supplier_company_name ?? formValues.supplier_company_name ?? "",
        supplier_contact_person: prev.supplier_contact_person ?? formValues.supplier_contact_person ?? "",
        supplier_email: prev.supplier_email ?? formValues.supplier_email ?? "",
        supplier_phone: prev.supplier_phone ?? formValues.supplier_phone ?? "",
        supplier_address: prev.supplier_address ?? formValues.supplier_address ?? "",
        supplier_city: prev.supplier_city ?? formValues.supplier_city ?? "",
        supplier_state: prev.supplier_state ?? formValues.supplier_state ?? "",
        supplier_pincode: prev.supplier_pincode ?? formValues.supplier_pincode ?? "",
        supplier_gst_number: prev.supplier_gst_number ?? formValues.supplier_gst_number ?? "",
        other_details: null,
        rate: "",
        basic_value: "",
        discount_percent: "",
        discount_amount: "",
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
    if (key === "basic_value") {
      if (record.basic_value !== undefined && record.basic_value !== null && record.basic_value !== "") {
        return record.basic_value;
      }
      const qty = Number(record.quantity) || 0;
      const rate = Number(record.rate) || 0;
      if (qty && rate) {
        return Number((qty * rate).toFixed(2));
      }
      return 0;
    }
    if (key === "discount_amount") {
      if (record.discount_amount !== undefined && record.discount_amount !== null && record.discount_amount !== "") {
        return record.discount_amount;
      }
      const qty = Number(record.quantity) || 0;
      const rate = Number(record.rate) || 0;
      const discPercent = Number(record.discount_percent) || 0;
      if (qty && rate && discPercent) {
        return Number(((qty * rate * discPercent) / 100).toFixed(2));
      }
      return 0;
    }
    if (key === "amount") {
      if (record.amount !== undefined && record.amount !== null && record.amount !== "") {
        return record.amount;
      }
      const qty = Number(record.quantity) || 0;
      const rate = Number(record.rate) || 0;
      const discPercent = Number(record.discount_percent) || 0;
      const basic = qty * rate;
      const disc = (basic * discPercent) / 100;
      return Number((basic - disc).toFixed(2));
    }
    if (key === "total_amount") {
      if (record.total_amount !== undefined && record.total_amount !== null && record.total_amount !== "") {
        return record.total_amount;
      }
      const amt = Number(getRecordFieldValue(record, "amount")) || 0;
      const cgst = Number(record.cgst_amount) || 0;
      const sgst = Number(record.ut_sgst_amount) || 0;
      const igst = Number(record.igst_amount) || 0;
      return Number((amt + cgst + sgst + igst).toFixed(2));
    }
    if (key === "out_boxes") return record.out_boxes ?? record.other_details?.out_boxes ?? record.boxes;
    if (key === "out_bins") return record.out_bins ?? record.other_details?.out_bins ?? record.bin;
    if (["hsn_code", "zach_code", "po_batch_no", "ls", "sach_code", "bin", "boxes"].includes(key)) {
      const directVal = record[key] ?? record.other_details?.[key];
      if (directVal !== undefined && directVal !== null && directVal !== "") {
        return directVal;
      }
      const prdId = record.product_id || (record.type === "element" ? record.element_id : null);
      if (prdId || record.type === "product" || record.type === "element") {
        const matchedPrd = (lookupOptions.products || []).find(
          (p) => (prdId && String(p.id) === String(prdId)) || String(p.name || "").trim().toLowerCase() === String(record.item || "").trim().toLowerCase()
        );
        if (matchedPrd && matchedPrd[key]) {
          return matchedPrd[key];
        }
      }
      if (key === "zach_code" || key === "hsn_code") {
        const rmId = record.raw_material_id;
        if (rmId || record.type === "raw_material") {
          const matchedRm = (lookupOptions.rawMaterials || []).find(
            (m) => (rmId && String(m.id) === String(rmId)) || String(m.material_name || "").trim().toLowerCase() === String(record.item || "").trim().toLowerCase()
          );
          if (matchedRm && matchedRm[key]) {
            return matchedRm[key];
          }
        }
      }
    }
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
    const val = getRelatedCompanyName(key, raw, record) ?? raw ?? "";
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
      const basicValueSum = exportRecords.reduce((sum, r) => {
        const val = Number(r.basic_value);
        if (Number.isFinite(val) && val > 0) return sum + val;
        const q = Number(r.quantity) || 0;
        const rt = Number(r.rate) || 0;
        return sum + (q * rt);
      }, 0);
      const discountAmountSum = exportRecords.reduce((sum, r) => {
        const val = Number(r.discount_amount);
        if (Number.isFinite(val) && val > 0) return sum + val;
        const q = Number(r.quantity) || 0;
        const rt = Number(r.rate) || 0;
        const dp = Number(r.discount_percent) || 0;
        return sum + ((q * rt * dp) / 100);
      }, 0);
      const cgstSum = exportRecords.reduce((sum, r) => sum + (Number(r.cgst_amount) || 0), 0);
      const utSgstSum = exportRecords.reduce((sum, r) => sum + (Number(r.ut_sgst_amount) || 0), 0);
      const igstSum = exportRecords.reduce((sum, r) => sum + (Number(r.igst_amount) || 0), 0);
      const quantitySum = exportRecords.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);

      const totalsMap = {
        total_amount: totalAmountSum.toFixed(2),
        amount: amountSum.toFixed(2),
        basic_value: basicValueSum.toFixed(2),
        discount_amount: discountAmountSum.toFixed(2),
        cgst_amount: cgstSum.toFixed(2),
        ut_sgst_amount: utSgstSum.toFixed(2),
        igst_amount: igstSum.toFixed(2),
        quantity: Number.isInteger(quantitySum) ? String(quantitySum) : String(Number(quantitySum.toFixed(4))),
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
      || lower.includes("value")
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
      if (value) return String(value);
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
      if (value) {
        if (typeof value === "string") return value;
        if (Array.isArray(value)) return value.join(", ");
      }
      if (Array.isArray(record?.raw_material_names) && record.raw_material_names.length > 0) {
        return record.raw_material_names.filter(Boolean).join(", ");
      }
      if (Array.isArray(record?.raw_materials) && record.raw_materials.length > 0) {
        const labels = record.raw_materials
          .map((item) => {
            if (!item) return "";
            const mname = item.material_name || (lookupOptions.rawMaterials || []).find((rm) => String(rm.id) === String(item.raw_material_id || item.id))?.material_name || `Material #${item.raw_material_id || item.id}`;
            const qty = item.quantity;
            const unit = item.unit || "";
            if (qty !== undefined && qty !== null && qty !== "") {
              return `${mname} (${qty}${unit ? " " + unit : ""})`.trim();
            }
            return unit ? `${mname} (${unit})` : mname;
          })
          .filter(Boolean);
        if (labels.length > 0) return labels.join(", ");
      }
      const rawIds = Array.isArray(record?.raw_material_ids)
        ? record.raw_material_ids
        : typeof record?.raw_material_ids === "string" && record.raw_material_ids.trim().startsWith("[")
          ? (() => { try { const p = JSON.parse(record.raw_material_ids); return Array.isArray(p) ? p : []; } catch { return []; } })()
          : [];
      if (rawIds.length > 0) {
        const idSet = new Set(rawIds.map(Number));
        const names = (lookupOptions.rawMaterials || [])
          .filter((rm) => idSet.has(Number(rm.id)))
          .map((rm) => rm.material_name)
          .filter(Boolean);
        if (names.length > 0) return names.join(", ");
      }
      if (record?.raw_material_id) {
        const rm = (lookupOptions.rawMaterials || []).find((m) => String(m.id) === String(record.raw_material_id));
        if (rm?.material_name) return rm.material_name;
      }
      return "—";
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
    if (key === "supplier_type") {
      const sType = record?.supplier_type || (record?.supplier_id ? "supplier" : "general");
      return sType === "general" ? "General" : "Supplier";
    }
    if (key === "supplier_id") {
      if (record?.supplier_type === "general" || (!record?.supplier_id && record?.supplier_type === "general")) {
        const comp = record.supplier_company_name || record.other_details?.supplier_company_name || record.other_details?.company_name;
        return comp ? `${comp} (General)` : "General";
      }
      if (record?.type === "other") {
        return record.other_details?.supplier_company_name || record.other_details?.company_name || "—";
      }
      if (value) {
        return lookupOptions.suppliers?.find((supplier) => supplier.id === value)?.company_name;
      }
      if (record?.supplier_company_name) {
        return `${record.supplier_company_name} (General)`;
      }
      if (record?.supplier_type === "general") {
        return "General";
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
    if (field === "supplier_type") {
      return [
        { value: "supplier", label: "Supplier" },
        { value: "general", label: "General" },
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
    ? ["suppliers", "rawMaterials", "products"]
    : activeSection === "dailyDispatch"
    ? ["dailyInputs", "products", "suppliers", "customers"]
    : activeSection === "products"
    ? ["rawMaterials", "products"]
    : [];
  const isLookupLoading = activeLookups.some((lookup) => lookupLoading[lookup]);
  const activeLookupError = activeLookups
    .map((lookup) => lookupErrors[lookup])
    .find(Boolean);

  return (
    <main className="workspace-shell">
      <aside aria-label="Main navigation" className={`sidebar ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`}>
        <div className="sidebar-brand">
          <div className="brand-mark sidebar-mark" aria-hidden="true" title="Oyster Electronics">OE</div>
          {!isSidebarCollapsed && (
            <div className="brand-text">
              <strong>Oyster Electronics</strong>
            </div>
          )}
          <button
            type="button"
            className="sidebar-collapse-toggle"
            onClick={() => setIsSidebarCollapsed((prev) => !prev)}
            title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isSidebarCollapsed ? "»" : "«"}
          </button>
        </div>

        {!isSidebarCollapsed && <span className="sidebar-caption">MENU</span>}
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
                    onClick={() => {
                      if (isSidebarCollapsed) {
                        setIsSidebarCollapsed(false);
                      }
                      toggleDropdown(item.id);
                    }}
                    aria-expanded={isGroupOpen}
                    title={item.label}
                  >
                    <span aria-hidden="true" className="nav-marker">{item.marker}</span>
                    {!isSidebarCollapsed && <span className="nav-group-title">{item.label}</span>}
                    {!isSidebarCollapsed && (
                      <svg
                        aria-hidden="true"
                        className={`nav-chevron-icon${isGroupOpen ? " open" : ""}`}
                        fill="none"
                        height="16"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2.4"
                        viewBox="0 0 24 24"
                        width="16"
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    )}
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
                            title={child.label}
                          >
                            <span aria-hidden="true" className="nav-sub-marker">{child.marker}</span>
                            {!isSidebarCollapsed && <span className="nav-sub-label">{child.label}</span>}
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
                title={item.label}
              >
                <span aria-hidden="true" className="nav-marker">{item.marker}</span>
                {!isSidebarCollapsed && item.label}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-account">
          <div className="account-avatar" title={`${user.first_name || ""} ${user.last_name || ""}`}>
            {user.first_name?.slice(0, 1).toUpperCase()}
          </div>
          {!isSidebarCollapsed && (
            <div className="account-details">
              <strong>{user.first_name} {user.last_name}</strong>
              <span>{user.role}</span>
            </div>
          )}
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
            <button
              type="button"
              className="topbar-sidebar-toggle-btn"
              onClick={() => setIsSidebarCollapsed((prev) => !prev)}
              title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label="Toggle navigation sidebar"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
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
            <ErrorBoundary key={activeSection} onReset={() => setRequestVersion((version) => version + 1)}>
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
                          setStagedDailyDispatches([]);
                          if (activeSection === "dailyDispatch") {
                            setDailyDispatchType("");
                          }
                        } else {
                          setEditingRecord(null);
                          setProductSaveConfirm(null);
                          const initialType = activeSection === "costData" ? "Basic" : activeSection === "products" ? "element" : activeSection === "dailyDispatch" ? "" : activeSection === "dailyInputs" ? "raw_material" : "raw_material";
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
                          if (activeSection === "rawMaterials") {
                            initialValues.zach_mode = "without_zach_code";
                            initialValues.zach_code = "";
                          }
                          if (activeSection === "products") {
                            initialValues.product_mode = "with_zach_code";
                            initialValues.zach_code = "";
                            initialValues.raw_materials = [];
                            initialValues.raw_material_ids = [];
                          }
                          if (activeSection === "consumption") {
                            initialValues.product_id = "";
                            initialValues.raw_materials = [];
                            initialValues.raw_material_ids = [];
                          }
                          if (activeSection === "dailyInputs") {
                            initialValues.supplier_type = "supplier";
                            setStagedDailyInputs([]);
                          }
                          if (activeSection === "dailyDispatch") {
                            setDailyDispatchType("");
                            initialValues.type = "";
                            setStagedDailyDispatches([]);
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

              {activeSection === "dailyDispatch" && isFormOpen && (
                <div className="rm-type-selector-card" style={{ marginBottom: "16px" }}>
                  <div className="rm-type-header">
                    <div className="rm-type-label-wrap">
                      <span className="rm-type-title">Select Dispatch Option:</span>
                      <span className="rm-type-required">*</span>
                    </div>
                    <div className="rm-type-pill-toggle" role="radiogroup" aria-label="Select Daily Dispatch Option">
                      {["Job work", "Element", "Capacitor", "welded element"].map((opt) => {
                        const isSelected = (isFormOpen ? (formValues.type || dailyDispatchType) : dailyDispatchType) === opt;
                        return (
                          <button
                            key={opt}
                            type="button"
                            role="radio"
                            aria-checked={isSelected}
                            className={`rm-type-pill-btn ${isSelected ? "active" : ""}`}
                            onClick={() => {
                              if (isSelected) {
                                setDailyDispatchType("");
                                setFormType("");
                                if (isFormOpen) {
                                  handleFormFieldChange("type", "");
                                }
                              } else {
                                setDailyDispatchType(opt);
                                setFormType(opt);
                                if (isFormOpen) {
                                  handleFormFieldChange("type", opt);
                                }
                              }
                            }}
                          >
                            <span>{opt}</span>
                            {isSelected && <span className="rm-type-check">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {((isFormOpen ? (formValues.type || dailyDispatchType) : dailyDispatchType) === "Job work") && (() => {
                    const dispatchedInputIds = new Set(
                      (records || [])
                        .filter((r) => r && r.daily_input_id !== null && r.daily_input_id !== undefined && r.daily_input_id !== "")
                        .map((r) => String(r.daily_input_id))
                    );
                    const dispatchedLegacyPos = new Set(
                      (records || [])
                        .filter((r) => r && (r.daily_input_id === null || r.daily_input_id === undefined || r.daily_input_id === "") && r.po_batch_no)
                        .map((r) => String(r.po_batch_no).trim().toLowerCase())
                    );
                    const poDailyInputs = (lookupOptions.dailyInputs || []).filter((di) => {
                      if (dispatchedInputIds.has(String(di.id))) return false;
                      const poVal = di.po_batch_no ?? di.other_details?.po_batch_no ?? getRecordFieldValue(di, "po_batch_no") ?? "";
                      const strPo = String(poVal).trim();
                      if (!strPo || strPo === "-" || strPo === "—") return false;
                      if (dispatchedLegacyPos.has(strPo.toLowerCase())) return false;
                      return true;
                    });
                    const isNonEmptyDisplayVal = (val) => {
                      if (val === null || val === undefined) return false;
                      const s = String(val).trim();
                      return s !== "" && s !== "-" && s !== "—" && s.toLowerCase() !== "null";
                    };
                    const jobWorkColumns = [
                      {
                        key: "po_batch_no",
                        label: "P.O. Number",
                        bold: true,
                        thStyle: { width: "15%", padding: "8px 10px", whiteSpace: "nowrap" },
                        tdStyle: { width: "15%", padding: "7px 10px" },
                        getValue: (di) => di.po_batch_no ?? di.other_details?.po_batch_no ?? getRecordFieldValue(di, "po_batch_no"),
                      },
                      {
                        key: "DC_no",
                        label: "DC No",
                        thStyle: { width: "12%", padding: "8px 10px", whiteSpace: "nowrap" },
                        tdStyle: { width: "12%", padding: "7px 10px" },
                        getValue: (di) => di.DC_no ?? di.dc_no ?? getRecordFieldValue(di, "DC_no"),
                      },
                      {
                        key: "DC_date",
                        label: "DC Date",
                        thStyle: { width: "12%", padding: "8px 10px", whiteSpace: "nowrap" },
                        tdStyle: { width: "12%", padding: "7px 10px" },
                        getValue: (di) => normalizeCsvDate(di.DC_date ?? di.dc_date ?? getRecordFieldValue(di, "DC_date")),
                      },
                      {
                        key: "item",
                        label: "Item",
                        tdClassName: "staged-item-name",
                        thStyle: { width: "24%", padding: "8px 10px", whiteSpace: "nowrap" },
                        tdStyle: { width: "24%", padding: "7px 10px" },
                        getValue: (di) => di.item,
                      },
                      {
                        key: "sach_code",
                        label: "Sach",
                        thStyle: { width: "12%", padding: "8px 10px", whiteSpace: "nowrap" },
                        tdStyle: { width: "12%", padding: "7px 10px" },
                        getValue: (di) => di.sach_code ?? di.other_details?.sach_code ?? getRecordFieldValue(di, "sach_code"),
                      },
                      {
                        key: "ls",
                        label: "Ls",
                        thStyle: { width: "7%", textAlign: "center", padding: "8px 8px", whiteSpace: "nowrap" },
                        tdStyle: { width: "7%", textAlign: "center", padding: "7px 8px" },
                        getValue: (di) => di.ls ?? di.other_details?.ls ?? getRecordFieldValue(di, "ls"),
                      },
                      {
                        key: "quantity",
                        label: "Quantity",
                        thClassName: "numeric-cell",
                        tdClassName: "numeric-cell",
                        thStyle: { width: "9%", textAlign: "right", padding: "8px 10px", whiteSpace: "nowrap" },
                        tdStyle: { width: "9%", textAlign: "right", padding: "7px 10px" },
                        getValue: (di) => di.quantity,
                      },
                    ];
                    const visibleJobWorkCols = jobWorkColumns;
                    return (
                      <div className="staged-raw-materials-section" style={{ marginTop: "14px" }}>
                        <div className="staged-raw-materials-header">
                          <h3>Daily Inputs with P.O. Number ({poDailyInputs.length})</h3>
                          <span className="staged-hint">
                            Showing all Daily Inputs that have a P.O.No / Batch No. Click a row or "Select" to load (click again or "Deselect" to clear).
                          </span>
                        </div>
                        <div className="staged-table-wrapper">
                          <table className="staged-table">
                            <thead>
                              <tr>
                                {visibleJobWorkCols.map((col) => (
                                  <th key={col.key} className={col.thClassName} style={col.thStyle}>
                                    {col.label}
                                  </th>
                                ))}
                                <th style={{ width: "9%", textAlign: "center", padding: "8px 10px", whiteSpace: "nowrap" }}>Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {lookupLoading.dailyInputs ? (
                                <tr>
                                  <td colSpan={visibleJobWorkCols.length + 1} style={{ textAlign: "center", padding: "16px", color: "#64748b" }}>
                                    Loading daily inputs with P.O. number…
                                  </td>
                                </tr>
                              ) : poDailyInputs.length === 0 ? (
                                <tr>
                                  <td colSpan={visibleJobWorkCols.length + 1} style={{ textAlign: "center", padding: "16px", color: "#64748b" }}>
                                    No Daily Inputs with a P.O.No / Batch No found.
                                  </td>
                                </tr>
                              ) : (
                                poDailyInputs.map((di) => {
                                  const poVal = di.po_batch_no ?? di.other_details?.po_batch_no ?? getRecordFieldValue(di, "po_batch_no") ?? "";
                                  const zachVal = di.zach_code ?? di.other_details?.zach_code ?? getRecordFieldValue(di, "zach_code") ?? "";
                                  const sachVal = di.sach_code ?? di.other_details?.sach_code ?? getRecordFieldValue(di, "sach_code") ?? "";
                                  const lsVal = di.ls ?? di.other_details?.ls ?? getRecordFieldValue(di, "ls") ?? "";
                                  const binVal = di.bin ?? di.other_details?.bin ?? getRecordFieldValue(di, "bin") ?? "";
                                  const boxesVal = di.boxes ?? di.other_details?.boxes ?? getRecordFieldValue(di, "boxes") ?? "";
                                  const hsnVal = di.hsn_code ?? di.other_details?.hsn_code ?? getRecordFieldValue(di, "hsn_code") ?? "";
                                  const cleanVal = (v) => (isNonEmptyDisplayVal(v) ? v : "");
                                  const isSelectedRow = stagedDailyDispatches.some(
                                    (row) => String(row.daily_input_id) === String(di.id)
                                  );
                                  const handleSelectJobWorkRow = () => {
                                    if (isSelectedRow) {
                                      setStagedDailyDispatches((prev) =>
                                        prev.filter((row) => String(row.daily_input_id) !== String(di.id))
                                      );
                                      setNotice(`Deselected Daily Input #${di.id} (P.O.No: ${poVal}).`);
                                      return;
                                    }
                                    const newRow = {
                                      type: "Job work",
                                      daily_input_id: di.id,
                                      product_id: di.product_id || di.element_id || null,
                                      supplier_id: di.supplier_id || null,
                                      DC_no: cleanVal(di.DC_no ?? di.dc_no ?? getRecordFieldValue(di, "DC_no")),
                                      DC_date: normalizeCsvDate(di.DC_date ?? di.dc_date ?? getRecordFieldValue(di, "DC_date")),
                                      bill_no: cleanVal(di.bill_no),
                                      bill_date: normalizeCsvDate(di.bill_date),
                                      item: cleanVal(di.item),
                                      zach_code: cleanVal(zachVal),
                                      po_batch_no: cleanVal(poVal),
                                      sach_code: cleanVal(sachVal),
                                      ls: cleanVal(lsVal),
                                      quantity: di.quantity ?? "",
                                      unit: cleanVal(di.unit) || "num",
                                      hsn_code: cleanVal(hsnVal),
                                      total_amount: di.total_amount ?? 0,
                                      remarks: cleanVal(di.remarks),
                                      out_dc_no: "",
                                      out_dc_date: "",
                                      out_quantity: "",
                                      out_boxes: "",
                                      out_bins: "",
                                      ok: "",
                                      reject: "",
                                      isAdded: false,
                                    };
                                    setStagedDailyDispatches((prev) => [...prev, newRow]);
                                    setNotice(`Added Daily Input #${di.id} (P.O.No: ${poVal}) to dispatch table below.`);
                                  };
                                  return (
                                    <tr
                                      key={di.id}
                                      className="staged-saved-row"
                                      style={{
                                        cursor: "pointer",
                                        background: isSelectedRow ? "#eff6ff" : undefined,
                                      }}
                                      onClick={handleSelectJobWorkRow}
                                    >
                                      {visibleJobWorkCols.map((col) => {
                                        const rawVal = col.getValue(di);
                                        const displayVal = isNonEmptyDisplayVal(rawVal) ? rawVal : "";
                                        return (
                                          <td key={col.key} className={col.tdClassName} style={col.tdStyle}>
                                            {col.bold && displayVal !== "" ? <strong>{displayVal}</strong> : displayVal}
                                          </td>
                                        );
                                      })}
                                      <td style={{ width: "10%", textAlign: "center", padding: "6px 8px" }}>
                                        <button
                                          type="button"
                                          className="table-btn-add-more"
                                          style={
                                            isSelectedRow
                                              ? { background: "#fee2e2", color: "#dc2626", border: "1px solid #fca5a5" }
                                              : undefined
                                          }
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleSelectJobWorkRow();
                                          }}
                                        >
                                          {isSelectedRow ? "Deselect ✕" : "Select"}
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>

                        {stagedDailyDispatches.length > 0 && (
                          <div className="dispatch-selected-section">
                            <div className="dispatch-selected-header">
                              <div className="dispatch-selected-title-wrap">
                                <h3>Selected Daily Input for Dispatch ({stagedDailyDispatches.length})</h3>
                                <span className="dispatch-selected-hint">
                                  Enter Out DC No, Out DC Date, Out Quantity, Out Boxes, Out Bins, OK, and Reject, click + Add to confirm each row, then click Save Dispatch.
                                </span>
                              </div>
                              <div className="dispatch-selected-actions">
                                <button
                                  type="button"
                                  className="dispatch-clear-btn"
                                  onClick={() => {
                                    setStagedDailyDispatches([]);
                                    setNotice("Cleared selected daily inputs.");
                                  }}
                                >
                                  Clear All
                                </button>
                                <button
                                  type="button"
                                  className="dispatch-save-btn"
                                  disabled={isSaving}
                                  onClick={async () => {
                                    setPageError("");
                                    setNotice("");
                                    setIsSaving(true);
                                    try {
                                      let savedCount = 0;
                                      const newlySavedRecords = [];
                                      for (const row of stagedDailyDispatches) {
                                        const outBoxesClean = row.out_boxes && String(row.out_boxes).trim() !== "" ? String(row.out_boxes).trim() : null;
                                        const outBinsClean = row.out_bins && String(row.out_bins).trim() !== "" ? String(row.out_bins).trim() : null;
                                        const payload = {
                                          type: row.type || "Job work",
                                          daily_input_id: row.daily_input_id ? Number(row.daily_input_id) : null,
                                          product_id: row.product_id ? Number(row.product_id) : null,
                                          supplier_id: row.supplier_id ? Number(row.supplier_id) : null,
                                          DC_no: row.DC_no || null,
                                          DC_date: row.DC_date || null,
                                          bill_no: row.bill_no || null,
                                          bill_date: row.bill_date || null,
                                          item: row.item || null,
                                          zach_code: row.zach_code || null,
                                          po_batch_no: row.po_batch_no || null,
                                          sach_code: row.sach_code || null,
                                          ls: row.ls || null,
                                          quantity: row.quantity !== "" && row.quantity !== null && row.quantity !== undefined ? Number(row.quantity) : null,
                                          bin: outBinsClean,
                                          boxes: outBoxesClean,
                                          unit: row.unit || "num",
                                          hsn_code: row.hsn_code || null,
                                          total_amount: row.total_amount !== "" && row.total_amount !== null && row.total_amount !== undefined ? Number(row.total_amount) : 0,
                                          remarks: row.remarks || null,
                                          out_dc_no: row.out_dc_no && String(row.out_dc_no).trim() !== "" ? String(row.out_dc_no).trim() : null,
                                          out_dc_date: row.out_dc_date && String(row.out_dc_date).trim() !== "" ? String(row.out_dc_date).trim() : null,
                                          out_quantity: row.out_quantity !== "" && row.out_quantity !== null && row.out_quantity !== undefined ? Number(row.out_quantity) : null,
                                          ok: row.ok !== "" && row.ok !== null && row.ok !== undefined ? Number(row.ok) : null,
                                          reject: row.reject !== "" && row.reject !== null && row.reject !== undefined ? Number(row.reject) : null,
                                          other_details: {
                                            out_boxes: outBoxesClean,
                                            out_bins: outBinsClean,
                                          },
                                        };
                                        const response = await window.desktop.createWorkspaceRecord("dailyDispatch", payload);
                                        if (!response?.ok) {
                                          setPageError(response?.error || "Failed to save Daily Dispatch record.");
                                          setIsSaving(false);
                                          return;
                                        }
                                        if (response.data) {
                                          newlySavedRecords.push(response.data);
                                        }
                                        savedCount += 1;
                                      }
                                      if (newlySavedRecords.length > 0) {
                                        setRecords((prev) => [...prev, ...newlySavedRecords]);
                                      }
                                      setStagedDailyDispatches([]);
                                      setDailyDispatchType("");
                                      setIsFormOpen(false);
                                      setRequestVersion((v) => v + 1);
                                      setNotice(`Saved ${savedCount} Daily Dispatch record${savedCount === 1 ? "" : "s"} successfully.`);
                                    } catch (err) {
                                      setPageError(err?.message || "Failed to save Daily Dispatch record.");
                                    } finally {
                                      setIsSaving(false);
                                    }
                                  }}
                                >
                                  {isSaving ? "Saving…" : `Save Dispatch (${stagedDailyDispatches.length})`}
                                </button>
                              </div>
                            </div>
                            <div className="dispatch-selected-table-wrapper">
                              <table className="dispatch-selected-table">
                                <colgroup>
                                  <col style={{ width: "115px" }} />
                                  <col style={{ width: "95px" }} />
                                  <col style={{ width: "100px" }} />
                                  <col style={{ width: "150px" }} />
                                  <col style={{ width: "90px" }} />
                                  <col style={{ width: "55px" }} />
                                  <col style={{ width: "80px" }} />
                                  <col style={{ width: "110px" }} />
                                  <col style={{ width: "130px" }} />
                                  <col style={{ width: "95px" }} />
                                  <col style={{ width: "90px" }} />
                                  <col style={{ width: "90px" }} />
                                  <col style={{ width: "75px" }} />
                                  <col style={{ width: "75px" }} />
                                  <col style={{ width: "95px" }} />
                                </colgroup>
                                <thead>
                                  <tr>
                                    <th style={{ whiteSpace: "nowrap" }} title="P.O. Number">P.O. Number</th>
                                    <th style={{ whiteSpace: "nowrap" }} title="DC No">DC No</th>
                                    <th style={{ whiteSpace: "nowrap" }} title="DC Date">DC Date</th>
                                    <th style={{ whiteSpace: "nowrap" }} title="Item">Item</th>
                                    <th style={{ whiteSpace: "nowrap" }} title="Sach">Sach</th>
                                    <th style={{ textAlign: "center", whiteSpace: "nowrap" }} title="Ls">Ls</th>
                                    <th style={{ textAlign: "right", whiteSpace: "nowrap" }} title="Quantity">Quantity</th>
                                    <th className="dispatch-input-col-header" style={{ whiteSpace: "nowrap" }} title="Out DC No">Out DC No</th>
                                    <th className="dispatch-input-col-header" style={{ whiteSpace: "nowrap" }} title="Out DC Date">Out DC Date</th>
                                    <th className="dispatch-input-col-header" style={{ whiteSpace: "nowrap" }} title="Out Quantity">Out Quantity</th>
                                    <th className="dispatch-input-col-header" style={{ whiteSpace: "nowrap" }} title="Out Boxes">Out Boxes</th>
                                    <th className="dispatch-input-col-header" style={{ whiteSpace: "nowrap" }} title="Out Bins">Out Bins</th>
                                    <th className="dispatch-input-col-header" style={{ whiteSpace: "nowrap" }} title="OK">OK</th>
                                    <th className="dispatch-input-col-header" style={{ whiteSpace: "nowrap" }} title="Reject">Reject</th>
                                    <th style={{ textAlign: "center", whiteSpace: "nowrap" }} title="Action">Action</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {stagedDailyDispatches.map((row, idx) => {
                                    const updateStagedField = (fieldKey, val) => {
                                      setStagedDailyDispatches((prev) =>
                                        prev.map((item, i) => (i === idx ? { ...item, [fieldKey]: val } : item))
                                      );
                                    };
                                    return (
                                      <tr
                                        key={`${row.daily_input_id}-${idx}`}
                                        style={row.isAdded ? { background: "#f0fdf4" } : undefined}
                                      >
                                        <td title={row.po_batch_no}>
                                          <strong>{row.po_batch_no}</strong>
                                        </td>
                                        <td title={row.DC_no}>{row.DC_no}</td>
                                        <td title={row.DC_date}>{row.DC_date}</td>
                                        <td className="staged-item-name" title={row.item}>
                                          {row.item}
                                        </td>
                                        <td title={row.sach_code}>{row.sach_code}</td>
                                        <td style={{ textAlign: "center" }}>{row.ls}</td>
                                        <td style={{ textAlign: "right", fontWeight: 600 }}>
                                          {row.quantity}
                                        </td>
                                        <td>
                                          {row.isAdded ? (
                                            <span title={row.out_dc_no}>{row.out_dc_no}</span>
                                          ) : (
                                            <input
                                              type="text"
                                              className="dispatch-inline-input"
                                              placeholder="Out DC No"
                                              value={row.out_dc_no ?? ""}
                                              onChange={(e) => updateStagedField("out_dc_no", e.target.value)}
                                            />
                                          )}
                                        </td>
                                        <td>
                                          {row.isAdded ? (
                                            <span title={row.out_dc_date}>{row.out_dc_date}</span>
                                          ) : (
                                            <input
                                              type="date"
                                              className="dispatch-inline-input"
                                              value={row.out_dc_date ?? ""}
                                              onChange={(e) => updateStagedField("out_dc_date", e.target.value)}
                                            />
                                          )}
                                        </td>
                                        <td>
                                          {row.isAdded ? (
                                            <span style={{ display: "block", textAlign: "right", fontWeight: 600 }}>
                                              {row.out_quantity}
                                            </span>
                                          ) : (
                                            <input
                                              type="number"
                                              step="any"
                                              min="0"
                                              className="dispatch-inline-input numeric"
                                              placeholder="0"
                                              value={row.out_quantity ?? ""}
                                              onChange={(e) => updateStagedField("out_quantity", e.target.value)}
                                            />
                                          )}
                                        </td>
                                        <td>
                                          {row.isAdded ? (
                                            <span style={{ display: "block", textAlign: "center" }}>
                                              {row.out_boxes}
                                            </span>
                                          ) : (
                                            <input
                                              type="text"
                                              className="dispatch-inline-input"
                                              placeholder="Out Boxes"
                                              value={row.out_boxes ?? ""}
                                              onChange={(e) => updateStagedField("out_boxes", e.target.value)}
                                            />
                                          )}
                                        </td>
                                        <td>
                                          {row.isAdded ? (
                                            <span style={{ display: "block", textAlign: "center" }}>
                                              {row.out_bins}
                                            </span>
                                          ) : (
                                            <input
                                              type="text"
                                              className="dispatch-inline-input"
                                              placeholder="Out Bins"
                                              value={row.out_bins ?? ""}
                                              onChange={(e) => updateStagedField("out_bins", e.target.value)}
                                            />
                                          )}
                                        </td>
                                        <td>
                                          {row.isAdded ? (
                                            <span style={{ display: "block", textAlign: "right" }}>
                                              {row.ok}
                                            </span>
                                          ) : (
                                            <input
                                              type="number"
                                              step="any"
                                              min="0"
                                              className="dispatch-inline-input numeric"
                                              placeholder="0"
                                              value={row.ok ?? ""}
                                              onChange={(e) => updateStagedField("ok", e.target.value)}
                                            />
                                          )}
                                        </td>
                                        <td>
                                          {row.isAdded ? (
                                            <span style={{ display: "block", textAlign: "right" }}>
                                              {row.reject}
                                            </span>
                                          ) : (
                                            <input
                                              type="number"
                                              step="any"
                                              min="0"
                                              className="dispatch-inline-input numeric"
                                              placeholder="0"
                                              value={row.reject ?? ""}
                                              onChange={(e) => updateStagedField("reject", e.target.value)}
                                            />
                                          )}
                                        </td>
                                        <td className="staged-actions-cell">
                                          {row.isAdded ? (
                                            <div className="staged-actions-wrap">
                                              <button
                                                type="button"
                                                className="table-action edit-staged-btn"
                                                title="Edit this dispatch row"
                                                onClick={() => {
                                                  updateStagedField("isAdded", false);
                                                  setNotice(`Editing dispatch row for P.O.No: ${row.po_batch_no || row.item}.`);
                                                }}
                                              >
                                                Edit
                                              </button>
                                              <button
                                                type="button"
                                                className="table-action delete-action delete-staged-btn"
                                                title="Delete this dispatch row"
                                                onClick={() => {
                                                  setStagedDailyDispatches((prev) => prev.filter((_, i) => i !== idx));
                                                  setNotice(`Deleted dispatch row for P.O.No: ${row.po_batch_no || row.item}.`);
                                                }}
                                              >
                                                Delete
                                              </button>
                                            </div>
                                          ) : (
                                            <button
                                              type="button"
                                              className="table-btn-add-more"
                                              title="Add this dispatch row"
                                              onClick={() => {
                                                updateStagedField("isAdded", true);
                                                setNotice(`Added dispatch row for P.O.No: ${row.po_batch_no || row.item}.`);
                                              }}
                                            >
                                              + Add
                                            </button>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {isFormOpen &&
                !(
                  activeSection === "dailyDispatch" &&
                  !editingRecord &&
                  (!(formValues.type || dailyDispatchType) ||
                    (formValues.type || dailyDispatchType) === "Job work")
                ) && (
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
                      const pType = formValues.type === "other"
                        ? (String(formValues.type_other || "").trim() || "other")
                        : formValues.type || (editingRecord ? editingRecord.type : "element");
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
                        setProductSaveConfirm({
                          name,
                          type: pType,
                          isZachCode: true,
                          ls: formValues.ls ?? (editingRecord?.ls ?? ""),
                          hsnCode: formValues.hsn_code ?? (editingRecord?.hsn_code ?? ""),
                          sachCode: formValues.sach_code ?? (editingRecord?.sach_code ?? ""),
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
                        ls: formValues.ls ?? (editingRecord?.ls ?? ""),
                        hsnCode: formValues.hsn_code ?? (editingRecord?.hsn_code ?? ""),
                        sachCode: formValues.sach_code ?? (editingRecord?.sach_code ?? ""),
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
                          (editingRecord
                            ? (editingRecord.has_zach_code || Boolean(editingRecord.zach_code)
                                ? "with_zach_code"
                                : "without_zach_code")
                            : "with_zach_code");

                        const currentZachMode =
                          formValues.zach_mode ||
                          (editingRecord
                            ? (editingRecord.has_zach_code || Boolean(editingRecord.zach_code)
                                ? "with_zach_code"
                                : "without_zach_code")
                            : "without_zach_code");

                        if (
                          activeSection === "products" &&
                          field.dependsOnProductMode &&
                          currentProductMode !== field.dependsOnProductMode
                        ) {
                          return null;
                        }

                        if (
                          activeSection === "rawMaterials" &&
                          field.dependsOnZachMode &&
                          currentZachMode !== field.dependsOnZachMode
                        ) {
                          return null;
                        }

                        if (field.type === "rawMaterialZachRadio") {
                          const currentVal = currentZachMode;
                          return (
                            <div className="form-field-group product-mode-group field-wide" key={field.name}>
                              <div className="product-mode-radios">
                                <label className={`product-mode-radio-label ${currentVal === "with_zach_code" ? "selected" : ""}`}>
                                  <input
                                    type="radio"
                                    name="zach_mode"
                                    value="with_zach_code"
                                    checked={currentVal === "with_zach_code"}
                                    onChange={() => handleFormFieldChange("zach_mode", "with_zach_code")}
                                    disabled={isSaving}
                                  />
                                  <span className="radio-custom" />
                                  <span className="radio-text">zach no</span>
                                </label>
                                <label className={`product-mode-radio-label ${currentVal === "without_zach_code" ? "selected" : ""}`}>
                                  <input
                                    type="radio"
                                    name="zach_mode"
                                    value="without_zach_code"
                                    checked={currentVal === "without_zach_code"}
                                    onChange={() => handleFormFieldChange("zach_mode", "without_zach_code")}
                                    disabled={isSaving}
                                  />
                                  <span className="radio-custom" />
                                  <span className="radio-text">no zach no</span>
                                </label>
                              </div>
                            </div>
                          );
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
                          ["rawMaterial", "element", "supplier", "customer", "dailyInputSupplierPicker"].includes(field.type)
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
                            ? field.required(
                                field.dependsOnProductMode
                                  ? currentProductMode
                                  : field.dependsOnZachMode
                                    ? currentZachMode
                                    : formType
                              )
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
                            ? "Search wires by name or code..."
                            : "Search raw materials by name or code...";

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
                                placeholderOverride={
                                  activeSection === "consumption"
                                    ? "Search raw materials by name or code to add..."
                                    : placeholderText
                                }
                                title={
                                  activeSection === "consumption"
                                    ? "Raw Materials Consumed"
                                    : ""
                                }
                                isWireHighlight={isWeldedElement}
                                onAddNewRawMaterial={(searchedName) => handleOpenQuickAddRawMaterial(searchedName)}
                                initialSelectedMaterialId={justCreatedRmId}
                              />
                            </div>
                          );
                        }

                        if (field.type === "consumptionProductPicker") {
  return (
    <div
      className={`form-field-group ${field.wide ? "field-wide" : ""}`}
      key={field.name}
    >
      <ConsumptionProductPicker
        products={lookupOptions.products || []}
        selectedProductId={formValues.product_id ?? ""}
        onSelectProduct={(prd) => {
          handleFormFieldChange("product_id", prd.id);
          if ((!formValues.raw_materials || formValues.raw_materials.length === 0) && Array.isArray(prd.raw_materials) && prd.raw_materials.length > 0) {
            handleFormFieldChange("raw_materials", prd.raw_materials.map((it) => ({
              raw_material_id: it.raw_material_id || it.id,
              quantity: it.quantity || 1,
              material_name: it.material_name || it.name,
              code: it.code || "",
              unit: it.unit || "",
            })));
          }
        }}
        onDeselectProduct={() => handleFormFieldChange("product_id", "")}
        disabled={isSaving}
        isLoading={lookupLoading.products}
        error={lookupErrors.products}
        onRetry={() => setLookupRequestVersion((v) => v + 1)}
      />
    </div>
  );
}

if (field.type === "consumptionMaterialsPicker") {
  return (
    <div
      className={`form-field-group ${field.wide ? "field-wide" : ""}`}
      key={field.name}
    >
      <ConsumptionMaterialsPicker
        value={formValues.raw_materials || []}
        rawMaterials={lookupOptions.rawMaterials || []}
        onChange={(nextItems) => handleFormFieldChange("raw_materials", nextItems)}
        disabled={isSaving}
        isLoading={lookupLoading.rawMaterials}
        error={lookupErrors.rawMaterials}
        onRetry={() => setLookupRequestVersion((v) => v + 1)}
      />
    </div>
  );
}

if (field.type === "dailyInputRawMaterialPicker" || field.type === "dailyInputItemPicker") {
                          return (
                            <div
                              className={`form-field-group ${field.wide ? "field-wide" : ""}`}
                              key={field.name}
                            >
                              <DailyInputRawMaterialPicker
                                rawMaterials={lookupOptions.rawMaterials || []}
                                products={lookupOptions.products || []}
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
                                selectedItemName={formValues.item || editingRecord?.item}
                                onSelect={(selected) => {
                                  if (selected._itemType === "product") {
                                    handleDailyInputItemSelect({ type: "product", id: selected.id, item: selected });
                                  } else {
                                    handleDailyInputItemSelect({ type: "raw_material", id: selected.id, item: selected });
                                  }
                                }}
                                onDeselect={handleDailyInputItemDeselect}
                                onAddNewRawMaterial={(searched) => handleOpenQuickAddRawMaterial(searched)}
                                disabled={isFieldDisabled || isSaving}
                                isLoading={lookupLoading.rawMaterials || lookupLoading.products}
                                error={lookupErrors.rawMaterials || lookupErrors.products}
                                onRetry={() => setLookupRequestVersion((v) => v + 1)}
                                hasError={Boolean(pageError && (!formValues.raw_material_id && !formValues.product_id && !formValues.item))}
                                required={isFieldRequired}
                              />
                            </div>
                          );
                        }

                        if (field.type === "dailyInputSupplierPicker") {
                          return (
                            <div
                              className={`form-field-group ${field.wide ? "field-wide" : ""}`}
                              key={field.name}
                            >
                              <DailyInputSupplierPicker
                                suppliers={lookupOptions.suppliers || []}
                                selectedSupplierId={
                                  formValues.supplier_id !== undefined
                                    ? formValues.supplier_id
                                    : editingRecord?.supplier_id
                                }
                                onSelect={(supplier) => handleFormFieldChange("supplier_id", supplier.id)}
                                onDeselect={() => handleFormFieldChange("supplier_id", "")}
                                onAddNewSupplier={(searched) => handleOpenQuickAddSupplier(searched)}
                                disabled={isFieldDisabled || isSaving}
                                isLoading={lookupLoading.suppliers}
                                error={lookupErrors.suppliers}
                                onRetry={() => setLookupRequestVersion((v) => v + 1)}
                                hasError={Boolean(pageError && (!formValues.supplier_id && !editingRecord?.supplier_id))}
                                required={isFieldRequired}
                              />
                            </div>
                          );
                        }

                        if (field.type === "select") {
                          const isOtherSelected =
                            String(formValues[field.name] || "").trim().toLowerCase() === "other";

                          return (
                            <React.Fragment key={field.name}>
                              <label
                                className={[
                                  field.wide ? "field-wide" : "",
                                  isFieldDisabled ? "field-disabled" : "",
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                                htmlFor={`record-${field.name}`}
                              >
                                <span className="field-label-text">
                                  {field.label}
                                  {isFieldRequired && !isFieldDisabled ? " *" : ""}
                                </span>
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
                              </label>

                              {isOtherSelected && !isFieldDisabled && (
                                <label
                                  className={[
                                    field.wide ? "field-wide" : "",
                                    "field-other-specify",
                                  ]
                                    .filter(Boolean)
                                    .join(" ")}
                                  htmlFor={`record-${field.name}-other`}
                                >
                                  <span className="field-label-text">
                                    Specify {field.label} *
                                  </span>
                                  <input
                                    id={`record-${field.name}-other`}
                                    name={`${field.name}_other`}
                                    type="text"
                                    placeholder={`Enter ${field.label.toLowerCase()}`}
                                    value={formValues[`${field.name}_other`] ?? ""}
                                    onChange={(e) =>
                                      handleFormFieldChange(
                                        `${field.name}_other`,
                                        e.target.value
                                      )
                                    }
                                    required={!isFieldDisabled && isFieldRequired}
                                    disabled={isFieldDisabled}
                                    autoFocus
                                  />
                                </label>
                              )}
                            </React.Fragment>
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
                                placeholder={field.placeholder || ""}
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

                      const isDailyInput = activeSection === "dailyInputs";

                      const taxPercentFields = isDailyInput
                        ? otherFields.filter((f) => f.row === 2)
                        : [];

                      const supplierPickerFields = isDailyInput
                        ? otherFields.filter((f) =>
                            [
                              "supplier_id",
                              "supplier_company_name",
                              "supplier_contact_person",
                              "supplier_email",
                              "supplier_phone",
                              "supplier_address",
                              "supplier_city",
                              "supplier_state",
                              "supplier_pincode",
                              "supplier_gst_number",
                            ].includes(f.name)
                          )
                        : [];

                      const amountFields = otherFields.filter((f) => isAmountField(f.name));
                      const remarksFields = otherFields.filter((f) => isRemarksField(f.name));
                      const mainOtherFields = otherFields.filter(
                        (f) => !isAmountField(f.name) && !isRemarksField(f.name) && f.row !== 2
                      );

                      if (isDailyInput) {
                        const currentSupplierType = formValues.supplier_type || "supplier";
                        const isSupplierMode = currentSupplierType === "supplier";
                        const isGeneralMode = currentSupplierType === "general";

                        return (
                          <>
                            {/* SELECT SUPPLIER TYPE: SUPPLIER OR GENERAL */}
                            <div className="supplier-type-selector-card">
                              <div className="supplier-type-header">
                                <div className="supplier-type-label-wrap">
                                  <span className="supplier-type-title">Select Supplier Type:</span>
                                  <span className="supplier-type-required">*</span>
                                </div>
                                <div className="supplier-type-pill-toggle" role="radiogroup" aria-label="Select Supplier Type">
                                  <button
                                    type="button"
                                    role="radio"
                                    aria-checked={isSupplierMode}
                                    className={`supplier-type-pill-btn supplier-mode ${isSupplierMode ? "active" : ""}`}
                                    onClick={() => handleFormFieldChange("supplier_type", "supplier")}
                                  >
                                    <span className="supplier-type-pill-icon">🏢</span>
                                    <span>Supplier</span>
                                    {isSupplierMode && <span className="supplier-type-check">✓</span>}
                                  </button>
                                  <button
                                    type="button"
                                    role="radio"
                                    aria-checked={isGeneralMode}
                                    className={`supplier-type-pill-btn general-mode ${isGeneralMode ? "active" : ""}`}
                                    onClick={() => handleFormFieldChange("supplier_type", "general")}
                                  >
                                    <span className="supplier-type-pill-icon">📦</span>
                                    <span>General</span>
                                    {isGeneralMode && <span className="supplier-type-check">✓</span>}
                                  </button>
                                </div>
                                <span className="supplier-type-badge-hint">
                                  {isSupplierMode
                                    ? "Supplier flow: Select supplier from list, pick raw materials & stage to table"
                                    : "General flow: Direct raw material master & daily input values"}
                                </span>
                              </div>
                            </div>

                            {isSupplierMode && supplierPickerFields.length > 0 && (
                              <div className="daily-supplier-picker-wrap">
                                {supplierPickerFields.map(renderField)}
                              </div>
                            )}

                            {isGeneralMode && (
                              <div className="general-section-card" style={{ marginBottom: "14px" }}>
                                <div className="general-card-header">
                                  <div className="general-card-title">
                                    <span>🏢</span>
                                    <span>Supplier Details</span>
                                  </div>
                                  <span className="general-card-subtext">
                                    Enter supplier details (saved in daily input only)
                                  </span>
                                </div>

                                <div className="general-fields-grid-4">
                                  <label>
                                    <span>Supplier Name</span>
                                    <input
                                      id="record-general-supplier_company_name"
                                      type="text"
                                      placeholder="Enter supplier name"
                                      value={formValues.supplier_company_name ?? ""}
                                      onChange={(e) => handleFormFieldChange("supplier_company_name", e.target.value)}
                                    />
                                  </label>

                                  <label>
                                    <span>Contact Person</span>
                                    <input
                                      id="record-general-supplier_contact_person"
                                      type="text"
                                      placeholder="Contact person"
                                      value={formValues.supplier_contact_person ?? ""}
                                      onChange={(e) => handleFormFieldChange("supplier_contact_person", e.target.value)}
                                    />
                                  </label>

                                  <label>
                                    <span>Phone</span>
                                    <input
                                      id="record-general-supplier_phone"
                                      type="text"
                                      placeholder="Phone number"
                                      value={formValues.supplier_phone ?? ""}
                                      onChange={(e) => handleFormFieldChange("supplier_phone", e.target.value)}
                                    />
                                  </label>

                                  <label>
                                    <span>Email</span>
                                    <input
                                      id="record-general-supplier_email"
                                      type="email"
                                      placeholder="supplier@example.com"
                                      value={formValues.supplier_email ?? ""}
                                      onChange={(e) => handleFormFieldChange("supplier_email", e.target.value)}
                                    />
                                  </label>

                                  <label className="field-span-2">
                                    <span>Address</span>
                                    <input
                                      id="record-general-supplier_address"
                                      type="text"
                                      placeholder="Office / factory address"
                                      value={formValues.supplier_address ?? ""}
                                      onChange={(e) => handleFormFieldChange("supplier_address", e.target.value)}
                                    />
                                  </label>

                                  <label>
                                    <span>City</span>
                                    <input
                                      id="record-general-supplier_city"
                                      type="text"
                                      placeholder="City"
                                      value={formValues.supplier_city ?? ""}
                                      onChange={(e) => handleFormFieldChange("supplier_city", e.target.value)}
                                    />
                                  </label>

                                  <label>
                                    <span>State</span>
                                    <select
                                      id="record-general-supplier_state"
                                      value={formValues.supplier_state ?? ""}
                                      onChange={(e) => handleFormFieldChange("supplier_state", e.target.value)}
                                    >
                                      <option value="">Select State</option>
                                      {INDIAN_STATES.map((st) => (
                                        <option key={st} value={st}>
                                          {st}
                                        </option>
                                      ))}
                                    </select>
                                  </label>

                                  <label>
                                    <span>Pincode</span>
                                    <input
                                      id="record-general-supplier_pincode"
                                      type="text"
                                      placeholder="Pincode"
                                      value={formValues.supplier_pincode ?? ""}
                                      onChange={(e) => handleFormFieldChange("supplier_pincode", e.target.value)}
                                    />
                                  </label>

                                  <label>
                                    <span>GST Number</span>
                                    <input
                                      id="record-general-supplier_gst_number"
                                      type="text"
                                      placeholder="GSTIN"
                                      value={formValues.supplier_gst_number ?? ""}
                                      onChange={(e) => handleFormFieldChange("supplier_gst_number", e.target.value)}
                                    />
                                  </label>
                                </div>
                              </div>
                            )}

                            {documentFields.length > 0 && (
                              <div className="document-fields">
                                {documentFields.map(renderField)}
                              </div>
                            )}

                            {/* IF SUPPLIER IS SELECTED: SHOW REST OF FLOW */}
                            {isSupplierMode && (
                              <>

                                {/* SELECT ITEM TYPE: RAW MATERIAL, PRODUCT, OTHER */}
                                <div className="rm-type-selector-card">
                                  <div className="rm-type-header">
                                    <div className="rm-type-label-wrap">
                                      <span className="rm-type-title">Select Item Type:</span>
                                      <span className="rm-type-required">*</span>
                                    </div>
                                    <div className="rm-type-pill-toggle" role="radiogroup" aria-label="Select Item Type">
                                      <button
                                        type="button"
                                        role="radio"
                                        aria-checked={formValues.raw_material_type === "raw_material" || (!formValues.raw_material_type || (formValues.raw_material_type !== "product" && formValues.raw_material_type !== "other"))}
                                        className={`rm-type-pill-btn ${formValues.raw_material_type === "raw_material" || (!formValues.raw_material_type || (formValues.raw_material_type !== "product" && formValues.raw_material_type !== "other")) ? "active" : ""}`}
                                        onClick={() => handleRawMaterialTypeSelect("raw_material")}
                                      >
                                        <span className="rm-type-pill-icon">📦</span>
                                        <span>Raw Material</span>
                                        {(formValues.raw_material_type === "raw_material" || (!formValues.raw_material_type || (formValues.raw_material_type !== "product" && formValues.raw_material_type !== "other"))) && <span className="rm-type-check">✓</span>}
                                      </button>
                                      <button
                                        type="button"
                                        role="radio"
                                        aria-checked={formValues.raw_material_type === "product"}
                                        className={`rm-type-pill-btn product-mode ${formValues.raw_material_type === "product" ? "active" : ""}`}
                                        onClick={() => handleRawMaterialTypeSelect("product")}
                                      >
                                        <span className="rm-type-pill-icon">⚙️</span>
                                        <span>Product</span>
                                        {formValues.raw_material_type === "product" && <span className="rm-type-check">✓</span>}
                                      </button>
                                      <button
                                        type="button"
                                        role="radio"
                                        aria-checked={formValues.raw_material_type === "other"}
                                        className={`rm-type-pill-btn other-mode ${formValues.raw_material_type === "other" ? "active" : ""}`}
                                        onClick={() => handleRawMaterialTypeSelect("other")}
                                      >
                                        <span className="rm-type-pill-icon">📝</span>
                                        <span>Other</span>
                                        {formValues.raw_material_type === "other" && <span className="rm-type-check">✓</span>}
                                      </button>
                                    </div>
                                    <span className="rm-type-badge-hint">
                                      {formValues.raw_material_type === "product"
                                        ? "Search and select a product from the list below, then enter details & invoice value in the table"
                                        : formValues.raw_material_type === "other"
                                        ? "Enter item name and all details directly as inputs"
                                        : "List of raw materials is displayed below and can be searched"}
                                    </span>
                                  </div>
                                </div>

                                {formValues.raw_material_type === "product" ? (
                                  <div className="daily-rm-picker-wrap">
                                    <DailyInputProductPicker
                                      products={lookupOptions.products || []}
                                      selectedProductId={formValues.product_id || formValues.element_id}
                                      selectedItemName={formValues.item}
                                      onSelect={(selected) => {
                                        handleDailyInputItemSelect({ type: "product", id: selected.id, item: selected });
                                      }}
                                      onDeselect={handleDailyInputItemDeselect}
                                      onAddNewProduct={(searched) => handleOpenQuickAddProduct(searched)}
                                      disabled={isSaving}
                                      isLoading={lookupLoading.products}
                                      error={lookupErrors.products}
                                      onRetry={() => setLookupRequestVersion((v) => v + 1)}
                                      hasError={Boolean(pageError && !formValues.item && !formValues.product_id)}
                                      required={true}
                                    />
                                  </div>
                                ) : formValues.raw_material_type !== "other" ? (
                                  <>
                                    <div className="daily-rm-picker-wrap">
                                      <DailyInputRawMaterialPicker
                                        rawMaterials={lookupOptions.rawMaterials || []}
                                        products={lookupOptions.products || []}
                                        selectedRawMaterialId={formValues.raw_material_id}
                                        selectedProductId={formValues.product_id}
                                        selectedItemName={formValues.item}
                                        onSelect={(selected) => {
                                          if (selected._itemType === "product") {
                                            handleDailyInputItemSelect({ type: "product", id: selected.id, item: selected });
                                          } else {
                                            handleDailyInputItemSelect({ type: "raw_material", id: selected.id, item: selected });
                                          }
                                        }}
                                        onDeselect={handleDailyInputItemDeselect}
                                        onAddNewRawMaterial={(searched) => handleOpenQuickAddRawMaterial(searched)}
                                        disabled={isSaving}
                                        isLoading={lookupLoading.rawMaterials}
                                        error={lookupErrors.rawMaterials}
                                        onRetry={() => setLookupRequestVersion((v) => v + 1)}
                                        hasError={Boolean(pageError && !formValues.item && !formValues.raw_material_id)}
                                        required={true}
                                      />
                                    </div>

                                    {taxPercentFields.length > 0 && (
                                      <div className="daily-input-tax-row">
                                        {taxPercentFields.map(renderField)}
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <div className="general-section-card" style={{ marginBottom: "12px" }}>
                                    <div className="general-fields-grid-4">
                                      <label className="field-span-2">
                                        <span>Raw Material Name <span style={{ color: "#ef4444" }}>*</span></span>
                                        <input
                                          id="record-supplier-other-material_name"
                                          type="text"
                                          placeholder="Enter raw material name"
                                          value={formValues.material_name || formValues.item || ""}
                                          onChange={(e) => {
                                            handleFormFieldChange("material_name", e.target.value);
                                            handleFormFieldChange("item", e.target.value);
                                          }}
                                          required
                                        />
                                      </label>

                                      <label>
                                        <span>Zach Code</span>
                                        <input
                                          id="record-supplier-other-zach_code"
                                          type="text"
                                          placeholder="Enter Zach Code"
                                          value={formValues.zach_code ?? ""}
                                          onChange={(e) => handleFormFieldChange("zach_code", e.target.value)}
                                        />
                                      </label>

                                      <label>
                                        <span>HSN Code</span>
                                        <input
                                          id="record-supplier-other-hsn_code"
                                          type="text"
                                          placeholder="e.g. 8481"
                                          value={formValues.hsn_code ?? ""}
                                          onChange={(e) => handleFormFieldChange("hsn_code", e.target.value)}
                                        />
                                      </label>

                                      <label>
                                        <span>Unit</span>
                                        <select
                                          id="record-supplier-other-unit"
                                          value={formValues.unit || "num"}
                                          onChange={(e) => handleFormFieldChange("unit", e.target.value)}
                                        >
                                          <option value="num">num</option>
                                          <option value="kg">kg</option>
                                          <option value="litre">litre</option>
                                          <option value="mtrs">mtrs</option>
                                          <option value="other">other</option>
                                        </select>
                                      </label>

                                      <label>
                                        <span>Standard Rate (₹)</span>
                                        <input
                                          id="record-supplier-other-rate"
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          placeholder="0.00"
                                          value={formValues.rate ?? ""}
                                          onChange={(e) => handleFormFieldChange("rate", e.target.value)}
                                        />
                                      </label>

                                      <label>
                                        <span>Discount (%)</span>
                                        <input
                                          id="record-supplier-other-discount_percent"
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          max="100"
                                          placeholder="0.00"
                                          value={formValues.discount_percent ?? ""}
                                          onChange={(e) => handleFormFieldChange("discount_percent", e.target.value)}
                                        />
                                      </label>

                                      <label>
                                        <span>CGST (%)</span>
                                        <input
                                          id="record-supplier-other-cgst_percent"
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          max="100"
                                          placeholder="0.00"
                                          value={formValues.cgst_percent ?? ""}
                                          onChange={(e) => handleFormFieldChange("cgst_percent", e.target.value)}
                                        />
                                      </label>

                                      <label>
                                        <span>UTGST/SGST (%)</span>
                                        <input
                                          id="record-supplier-other-ut_sgst_percent"
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          max="100"
                                          placeholder="0.00"
                                          value={formValues.ut_sgst_percent ?? ""}
                                          onChange={(e) => handleFormFieldChange("ut_sgst_percent", e.target.value)}
                                        />
                                      </label>

                                      <label>
                                        <span>IGST (%)</span>
                                        <input
                                          id="record-supplier-other-igst_percent"
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          max="100"
                                          placeholder="0.00"
                                          value={formValues.igst_percent ?? ""}
                                          onChange={(e) => handleFormFieldChange("igst_percent", e.target.value)}
                                        />
                                      </label>
                                    </div>
                                  </div>
                                )}

                                <div className="staged-raw-materials-section">
                                  <div className="staged-raw-materials-header">
                                    <h3>Items Table ({stagedDailyInputs.length})</h3>
                                    <span className="staged-hint">
                                      Select item above, enter quantity below, then click "+ Add" to save into table.
                                    </span>
                                  </div>
                                  <div className="staged-table-wrapper">
                                    <table className="staged-table">
                                      {(formValues.type === "product" || formValues.raw_material_type === "product") ? (
                                        <colgroup>
                                          <col style={{ width: "3.5%" }} />
                                          <col style={{ width: "8%" }} />
                                          <col style={{ width: "12%" }} />
                                          <col style={{ width: "7%" }} />
                                          <col style={{ width: "5.5%" }} />
                                          <col style={{ width: "6%" }} />
                                          <col style={{ width: "5.5%" }} />
                                          <col style={{ width: "5.5%" }} />
                                          <col style={{ width: "7.5%" }} />
                                          <col style={{ width: "5%" }} />
                                          <col style={{ width: "6.5%" }} />
                                          <col style={{ width: "8%" }} />
                                          <col style={{ width: "10%" }} />
                                          <col style={{ width: "10%" }} />
                                        </colgroup>
                                      ) : (
                                        <colgroup>
                                          <col style={{ width: "3.5%" }} />
                                          <col style={{ width: "12%" }} />
                                          <col style={{ width: "5.5%" }} />
                                          <col style={{ width: "5%" }} />
                                          <col style={{ width: "6.5%" }} />
                                          <col style={{ width: "6.5%" }} />
                                          <col style={{ width: "6.5%" }} />
                                          <col style={{ width: "6.5%" }} />
                                          <col style={{ width: "6.5%" }} />
                                          <col style={{ width: "6.5%" }} />
                                          <col style={{ width: "6.5%" }} />
                                          <col style={{ width: "7.5%" }} />
                                          <col style={{ width: "11%" }} />
                                          <col style={{ width: "10%" }} />
                                        </colgroup>
                                      )}
                                      <thead>
                                        <tr>
                                          <th style={{ textAlign: "center" }} title="ID">ID</th>
                                          {(formValues.type === "product" || formValues.raw_material_type === "product") ? (
                                            <>
                                              <th title="P.O.No / Batch No">P.O.No</th>
                                              <th title="Name of Item">Item</th>
                                              <th title="Sach Code">Sach</th>
                                              <th title="Ls">Ls</th>
                                              <th className="numeric-cell" title="Quantity">Qty</th>
                                              <th title="Bin">Bin</th>
                                              <th title="Boxes">Boxes</th>
                                              <th title="Zach Code">Zach Code</th>
                                              <th title="Unit">Unit</th>
                                              <th title="HSN Code">HSN Code</th>
                                            </>
                                          ) : (
                                            <>
                                              <th title="Name of Item">Item</th>
                                              <th className="numeric-cell" title="Quantity">Qty</th>
                                              <th title="Unit">Unit</th>
                                              <th className="numeric-cell" title="Rate">Rate</th>
                                              <th className="numeric-cell" title="Basic Value = Quantity × Rate">Basic Val</th>
                                              <th className="numeric-cell" title="Discount Value">Disc Val</th>
                                              <th className="numeric-cell" title="Taxable Value = Basic Value - Discount Value">Taxable Val</th>
                                              <th className="numeric-cell" title="CGST Amount">CGST Amt</th>
                                              <th className="numeric-cell" title="SGST Amount">SGST Amt</th>
                                              <th className="numeric-cell" title="IGST Amount">IGST Amt</th>
                                            </>
                                          )}
                                          <th className="numeric-cell" title="Invoice Value">Invoice Val</th>
                                          <th title="Remarks">Remarks</th>
                                          <th style={{ textAlign: "center" }} title="Action">Action</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {stagedDailyInputs.map((row, idx) => {
                                          const isRowProduct = row.type === "product" || row.type === "element" || row.raw_material_type === "product";
                                          const isTableProduct = formValues.type === "product" || formValues.raw_material_type === "product";
                                          return (
                                            <tr key={row._tempId} className="staged-saved-row">
                                              <td style={{ textAlign: "center" }}>{idx + 1}</td>
                                              {isTableProduct ? (
                                                <>
                                                  <td>{row.po_batch_no || "—"}</td>
                                                  <td className="staged-item-name" title={row.item || "—"}>
                                                    {row.item || "—"}
                                                    {isRowProduct && (
                                                      <span style={{ marginLeft: "6px", fontSize: "10px", padding: "1px 5px", background: "#ede9fe", color: "#6d28d9", borderRadius: "4px", border: "1px solid #c4b5fd" }}>
                                                        Product
                                                      </span>
                                                    )}
                                                  </td>
                                                  <td>{row.sach_code || "—"}</td>
                                                  <td>{row.ls || "—"}</td>
                                                  <td className="numeric-cell">{row.quantity}</td>
                                                  <td>{row.bin || "—"}</td>
                                                  <td>{row.boxes || "—"}</td>
                                                  <td>{row.zach_code || "—"}</td>
                                                  <td>{row.unit || "—"}</td>
                                                  <td>{row.hsn_code || "—"}</td>
                                                </>
                                              ) : (
                                                <>
                                                  <td className="staged-item-name" title={row.item || "—"}>
                                                    {row.item || "—"}
                                                    {isRowProduct && (
                                                      <span style={{ marginLeft: "6px", fontSize: "10px", padding: "1px 5px", background: "#ede9fe", color: "#6d28d9", borderRadius: "4px", border: "1px solid #c4b5fd" }}>
                                                        Product
                                                      </span>
                                                    )}
                                                  </td>
                                                  <td className="numeric-cell">{row.quantity}</td>
                                                  <td>{row.unit || "—"}</td>
                                                  <td className="numeric-cell">{isRowProduct ? "—" : `₹${Number(row.rate || 0).toFixed(2)}`}</td>
                                                  <td className="numeric-cell">{isRowProduct ? "—" : `₹${Number(row.basic_value || 0).toFixed(2)}`}</td>
                                                  <td className="numeric-cell">{isRowProduct ? "—" : `₹${Number(row.discount_amount || 0).toFixed(2)}`}</td>
                                                  <td className="numeric-cell">{isRowProduct ? "—" : `₹${Number(row.amount || 0).toFixed(2)}`}</td>
                                                  <td className="numeric-cell">{isRowProduct ? "—" : `₹${Number(row.cgst_amount || 0).toFixed(2)}`}</td>
                                                  <td className="numeric-cell">{isRowProduct ? "—" : `₹${Number(row.ut_sgst_amount || 0).toFixed(2)}`}</td>
                                                  <td className="numeric-cell">{isRowProduct ? "—" : `₹${Number(row.igst_amount || 0).toFixed(2)}`}</td>
                                                </>
                                              )}
                                              <td className="numeric-cell staged-total-cell">₹{Number(row.total_amount || 0).toFixed(2)}</td>
                                              <td title={row.remarks || "—"}>{row.remarks || "—"}</td>
                                              <td className="staged-actions-cell" style={{ textAlign: "center" }}>
                                                <div className="staged-actions-wrap">
                                                  <button
                                                    type="button"
                                                    className="staged-action-btn edit-staged-btn"
                                                    onClick={() => handleEditStagedItem(idx)}
                                                    title="Edit this item"
                                                  >
                                                    Edit
                                                  </button>
                                                  <button
                                                    type="button"
                                                    className="staged-action-btn delete-staged-btn"
                                                    onClick={() => handleDeleteStagedItem(idx)}
                                                    title="Delete this item"
                                                  >
                                                    Delete
                                                  </button>
                                                </div>
                                              </td>
                                            </tr>
                                          );
                                        })}

                                        <tr className="table-active-input-row">
                                          <td style={{ textAlign: "center", fontWeight: "700", color: "#64748b" }}>
                                            {stagedDailyInputs.length + 1}
                                          </td>
                                          {(formValues.type === "product" || formValues.raw_material_type === "product") ? (
                                            <>
                                              <td>
                                                <input
                                                  type="text"
                                                  placeholder="P.O.No"
                                                  className="table-input"
                                                  value={formValues.po_batch_no ?? ""}
                                                  onChange={(e) => handleFormFieldChange("po_batch_no", e.target.value)}
                                                />
                                              </td>
                                              <td className="table-item-name-cell" title={formValues.material_name || formValues.item || (formValues.raw_material_type === "other" ? "Enter name above" : "Select item from above")}>
                                                {(formValues.material_name || formValues.item) ? (
                                                  <div className="table-active-item-badge">
                                                    <span className="table-active-item-text">{formValues.material_name || formValues.item}</span>
                                                    <span style={{ marginLeft: "5px", fontSize: "10px", padding: "1px 4px", background: "#ede9fe", color: "#6d28d9", borderRadius: "3px" }}>
                                                      Product
                                                    </span>
                                                  </div>
                                                ) : (
                                                  <div className="table-active-item-placeholder">
                                                    {formValues.raw_material_type === "other" ? "(Enter name above)" : "(Select above)"}
                                                  </div>
                                                )}
                                              </td>
                                              <td>
                                                <input
                                                  type="text"
                                                  placeholder="Sach"
                                                  className="table-input"
                                                  value={formValues.sach_code ?? ""}
                                                  onChange={(e) => handleFormFieldChange("sach_code", e.target.value)}
                                                />
                                              </td>
                                              <td>
                                                <input
                                                  type="text"
                                                  placeholder="Ls"
                                                  className="table-input"
                                                  value={formValues.ls ?? ""}
                                                  onChange={(e) => handleFormFieldChange("ls", e.target.value)}
                                                />
                                              </td>
                                              <td className="numeric-cell">
                                                <input
                                                  type="number"
                                                  step="any"
                                                  min="0.0001"
                                                  placeholder="0.00"
                                                  className="table-input table-qty-input numeric-input"
                                                  value={formValues.quantity ?? ""}
                                                  onChange={(e) => handleFormFieldChange("quantity", e.target.value)}
                                                />
                                              </td>
                                              <td>
                                                <input
                                                  type="text"
                                                  placeholder="Bin"
                                                  className="table-input"
                                                  value={formValues.bin ?? ""}
                                                  onChange={(e) => handleFormFieldChange("bin", e.target.value)}
                                                />
                                              </td>
                                              <td>
                                                <input
                                                  type="text"
                                                  placeholder="Boxes"
                                                  className="table-input"
                                                  value={formValues.boxes ?? ""}
                                                  onChange={(e) => handleFormFieldChange("boxes", e.target.value)}
                                                />
                                              </td>
                                              <td>
                                                <input
                                                  type="text"
                                                  placeholder="Zach Code"
                                                  className="table-input"
                                                  value={formValues.zach_code ?? ""}
                                                  onChange={(e) => handleFormFieldChange("zach_code", e.target.value)}
                                                />
                                              </td>
                                              <td>
                                                <select
                                                  className="table-input table-unit-select"
                                                  value={formValues.unit || "num"}
                                                  onChange={(e) => handleFormFieldChange("unit", e.target.value)}
                                                >
                                                  <option value="num">num</option>
                                                  <option value="kg">kg</option>
                                                  <option value="litre">litre</option>
                                                  <option value="mtrs">mtrs</option>
                                                  <option value="other">other</option>
                                                </select>
                                              </td>
                                              <td>
                                                <input
                                                  type="text"
                                                  placeholder="HSN Code"
                                                  className="table-input"
                                                  value={formValues.hsn_code ?? ""}
                                                  onChange={(e) => handleFormFieldChange("hsn_code", e.target.value)}
                                                />
                                              </td>
                                              <td className="numeric-cell">
                                                <input
                                                  type="number"
                                                  step="0.01"
                                                  min="0"
                                                  placeholder="0.00"
                                                  className="table-input numeric-input"
                                                  value={formValues.total_amount ?? ""}
                                                  onChange={(e) => handleFormFieldChange("total_amount", e.target.value)}
                                                />
                                              </td>
                                            </>
                                          ) : (
                                            <>
                                              <td className="table-item-name-cell" title={formValues.material_name || formValues.item || (formValues.raw_material_type === "other" ? "Enter name above" : "Select item from above")}>
                                                {(formValues.material_name || formValues.item) ? (
                                                  <div className="table-active-item-badge">
                                                    <span className="table-active-item-text">{formValues.material_name || formValues.item}</span>
                                                  </div>
                                                ) : (
                                                  <div className="table-active-item-placeholder">
                                                    {formValues.raw_material_type === "other" ? "(Enter name above)" : "(Select above)"}
                                                  </div>
                                                )}
                                              </td>
                                              <td className="numeric-cell">
                                                <input
                                                  type="number"
                                                  step="any"
                                                  min="0.0001"
                                                  placeholder="0.00"
                                                  className="table-input table-qty-input numeric-input"
                                                  value={formValues.quantity ?? ""}
                                                  onChange={(e) => handleFormFieldChange("quantity", e.target.value)}
                                                />
                                              </td>
                                              <td>
                                                <select
                                                  className="table-input table-unit-select"
                                                  value={formValues.unit || "num"}
                                                  onChange={(e) => handleFormFieldChange("unit", e.target.value)}
                                                >
                                                  <option value="num">num</option>
                                                  <option value="kg">kg</option>
                                                  <option value="litre">litre</option>
                                                  <option value="mtrs">mtrs</option>
                                                  <option value="other">other</option>
                                                </select>
                                              </td>
                                              <td className="numeric-cell">
                                                <input
                                                  type="number"
                                                  step="0.01"
                                                  min="0"
                                                  placeholder="0.00"
                                                  className="table-input table-rate-input numeric-input"
                                                  value={formValues.rate ?? ""}
                                                  onChange={(e) => handleFormFieldChange("rate", e.target.value)}
                                                />
                                              </td>
                                              <td className="numeric-cell table-calculated-cell">
                                                {`₹${Number(formValues.basic_value || 0).toFixed(2)}`}
                                              </td>
                                              <td className="numeric-cell table-calculated-cell">
                                                {`₹${Number(formValues.discount_amount || 0).toFixed(2)}`}
                                              </td>
                                              <td className="numeric-cell table-calculated-cell">
                                                {`₹${Number(formValues.amount || 0).toFixed(2)}`}
                                              </td>
                                              <td className="numeric-cell table-calculated-cell">
                                                {`₹${Number(formValues.cgst_amount || 0).toFixed(2)}`}
                                              </td>
                                              <td className="numeric-cell table-calculated-cell">
                                                {`₹${Number(formValues.ut_sgst_amount || 0).toFixed(2)}`}
                                              </td>
                                              <td className="numeric-cell table-calculated-cell">
                                                {`₹${Number(formValues.igst_amount || 0).toFixed(2)}`}
                                              </td>
                                              <td className="numeric-cell table-calculated-cell staged-total-cell">
                                                {`₹${Number(formValues.total_amount || 0).toFixed(2)}`}
                                              </td>
                                            </>
                                          )}
                                          <td>
                                            <input
                                              type="text"
                                              placeholder="Remarks"
                                              className="table-input"
                                              value={formValues.remarks ?? ""}
                                              onChange={(e) => handleFormFieldChange("remarks", e.target.value)}
                                            />
                                          </td>
                                          <td style={{ textAlign: "center" }}>
                                            {editingRecord ? (
                                              <span style={{ fontSize: "11px", color: "#64748b" }}>Editing</span>
                                            ) : (
                                              <button
                                                type="button"
                                                className="table-btn-add-more"
                                                onClick={handleAddMoreDailyInput}
                                                title="Add this row to the table"
                                              >
                                                + Add
                                              </button>
                                            )}
                                          </td>
                                        </tr>
                                      </tbody>
                                      <tfoot>
                                        <tr className="staged-table-footer">
                                          <td colSpan={2}>
                                            <strong>Total ({stagedDailyInputs.length})</strong>
                                          </td>
                                          {(formValues.type === "product" || formValues.raw_material_type === "product") ? (
                                            <>
                                              <td>—</td>
                                              <td>—</td>
                                              <td>—</td>
                                              <td className="numeric-cell">
                                                <strong>
                                                  {Number.isInteger(stagedTotals.quantity)
                                                    ? String(stagedTotals.quantity)
                                                    : String(Number(stagedTotals.quantity.toFixed(4)))}
                                                </strong>
                                              </td>
                                              <td>—</td>
                                              <td>—</td>
                                              <td>—</td>
                                              <td>—</td>
                                              <td>—</td>
                                            </>
                                          ) : (
                                            <>
                                              <td className="numeric-cell">
                                                <strong>
                                                  {Number.isInteger(stagedTotals.quantity)
                                                    ? String(stagedTotals.quantity)
                                                    : String(Number(stagedTotals.quantity.toFixed(4)))}
                                                </strong>
                                              </td>
                                              <td>—</td>
                                              <td>—</td>
                                              <td className="numeric-cell"><strong>₹{stagedTotals.basic_value.toFixed(2)}</strong></td>
                                              <td className="numeric-cell"><strong>₹{stagedTotals.discount_amount.toFixed(2)}</strong></td>
                                              <td className="numeric-cell"><strong>₹{stagedTotals.amount.toFixed(2)}</strong></td>
                                              <td className="numeric-cell"><strong>₹{stagedTotals.cgst_amount.toFixed(2)}</strong></td>
                                              <td className="numeric-cell"><strong>₹{stagedTotals.ut_sgst_amount.toFixed(2)}</strong></td>
                                              <td className="numeric-cell"><strong>₹{stagedTotals.igst_amount.toFixed(2)}</strong></td>
                                            </>
                                          )}
                                          <td className="numeric-cell staged-total-cell"><strong>₹{stagedTotals.total_amount.toFixed(2)}</strong></td>
                                          <td>—</td>
                                          <td>—</td>
                                        </tr>
                                      </tfoot>
                                    </table>
                                  </div>
                                </div>
                              </>
                            )}

                            {/* IF GENERAL IS SELECTED: SHOW RAW MATERIAL DETAILS AND DAILY INPUTS TABLE */}
                            {isGeneralMode && (
                              <div className="general-mode-container">
                                {/* SECTION 1: RAW MATERIAL DETAILS */}
                                <div className="general-section-card">
                                  <div className="general-card-header">
                                    <div className="general-card-title">
                                      <span>📦</span>
                                      <span>Raw Material Details</span>
                                    </div>
                                    <span className="general-card-subtext">
                                      {formValues.raw_material_type === "other"
                                        ? "Enter raw material name & all details manually"
                                        : "Search and select raw material from list"}
                                    </span>
                                  </div>

                                  {/* SELECT ITEM TYPE: RAW MATERIAL, PRODUCT, OTHER */}
                                  <div className="rm-type-selector-card">
                                    <div className="rm-type-header">
                                      <div className="rm-type-label-wrap">
                                        <span className="rm-type-title">Select Item Type:</span>
                                        <span className="rm-type-required">*</span>
                                      </div>
                                      <div className="rm-type-pill-toggle" role="radiogroup" aria-label="Select Item Type">
                                        <button
                                          type="button"
                                          role="radio"
                                          aria-checked={formValues.raw_material_type === "raw_material" || (!formValues.raw_material_type || (formValues.raw_material_type !== "product" && formValues.raw_material_type !== "other"))}
                                          className={`rm-type-pill-btn ${formValues.raw_material_type === "raw_material" || (!formValues.raw_material_type || (formValues.raw_material_type !== "product" && formValues.raw_material_type !== "other")) ? "active" : ""}`}
                                          onClick={() => handleRawMaterialTypeSelect("raw_material")}
                                        >
                                          <span className="rm-type-pill-icon">📦</span>
                                          <span>Raw Material</span>
                                          {(formValues.raw_material_type === "raw_material" || (!formValues.raw_material_type || (formValues.raw_material_type !== "product" && formValues.raw_material_type !== "other"))) && <span className="rm-type-check">✓</span>}
                                        </button>
                                        <button
                                          type="button"
                                          role="radio"
                                          aria-checked={formValues.raw_material_type === "product"}
                                          className={`rm-type-pill-btn product-mode ${formValues.raw_material_type === "product" ? "active" : ""}`}
                                          onClick={() => handleRawMaterialTypeSelect("product")}
                                        >
                                          <span className="rm-type-pill-icon">⚙️</span>
                                          <span>Product</span>
                                          {formValues.raw_material_type === "product" && <span className="rm-type-check">✓</span>}
                                        </button>
                                        <button
                                          type="button"
                                          role="radio"
                                          aria-checked={formValues.raw_material_type === "other"}
                                          className={`rm-type-pill-btn other-mode ${formValues.raw_material_type === "other" ? "active" : ""}`}
                                          onClick={() => handleRawMaterialTypeSelect("other")}
                                        >
                                          <span className="rm-type-pill-icon">📝</span>
                                          <span>Other</span>
                                          {formValues.raw_material_type === "other" && <span className="rm-type-check">✓</span>}
                                        </button>
                                      </div>
                                      <span className="rm-type-badge-hint">
                                        {formValues.raw_material_type === "product"
                                          ? "Search and select a product from the list below, then enter details & invoice value in the table"
                                          : formValues.raw_material_type === "other"
                                          ? "Enter item name and all details directly as inputs"
                                          : "List of raw materials is displayed below and can be searched"}
                                      </span>
                                    </div>
                                  </div>

                                  {/* IF PRODUCT */}
                                  {formValues.raw_material_type === "product" ? (
                                    <div className="general-rm-picker-wrap">
                                      <DailyInputProductPicker
                                        products={lookupOptions.products || []}
                                        selectedProductId={formValues.product_id || formValues.element_id}
                                        selectedItemName={formValues.item}
                                        onSelect={(selected) => {
                                          handleDailyInputItemSelect({ type: "product", id: selected.id, item: selected });
                                        }}
                                        onDeselect={handleDailyInputItemDeselect}
                                        onAddNewProduct={(searched) => handleOpenQuickAddProduct(searched)}
                                        disabled={isSaving}
                                        isLoading={lookupLoading.products}
                                        error={lookupErrors.products}
                                        onRetry={() => setLookupRequestVersion((v) => v + 1)}
                                        hasError={Boolean(pageError && !formValues.item && !formValues.product_id)}
                                        required={true}
                                      />
                                    </div>
                                  ) : formValues.raw_material_type !== "other" ? (
                                    /* IF RAW MATERIAL: SEARCHABLE LIST OF RAW MATERIALS */
                                    <div className="general-rm-picker-wrap">
                                      <DailyInputRawMaterialPicker
                                        rawMaterials={lookupOptions.rawMaterials || []}
                                        products={[]}
                                        selectedRawMaterialId={formValues.raw_material_id}
                                        selectedProductId={null}
                                        selectedItemName={formValues.item || formValues.material_name}
                                        onSelect={(selected) => {
                                          handleDailyInputItemSelect({ type: "raw_material", id: selected.id, item: selected });
                                        }}
                                        onDeselect={handleDailyInputItemDeselect}
                                        onAddNewRawMaterial={(searched) => handleOpenQuickAddRawMaterial(searched)}
                                        disabled={isSaving}
                                        isLoading={lookupLoading.rawMaterials}
                                        error={lookupErrors.rawMaterials}
                                        onRetry={() => setLookupRequestVersion((v) => v + 1)}
                                        hasError={Boolean(pageError && !formValues.item && !formValues.material_name)}
                                        required={true}
                                      />

                                      <div className="general-fields-grid-4" style={{ marginTop: "10px" }}>
                                        <label>
                                          <span>Zach Code</span>
                                          <input
                                            id="record-general-zach_code"
                                            type="text"
                                            placeholder="Enter Zach Code"
                                            value={formValues.zach_code ?? ""}
                                            onChange={(e) => handleFormFieldChange("zach_code", e.target.value)}
                                          />
                                        </label>

                                        <label>
                                          <span>HSN Code</span>
                                          <input
                                            id="record-general-hsn_code"
                                            type="text"
                                            placeholder="e.g. 8481"
                                            value={formValues.hsn_code ?? ""}
                                            onChange={(e) => handleFormFieldChange("hsn_code", e.target.value)}
                                          />
                                        </label>

                                        <label>
                                          <span>Discount (%)</span>
                                          <input
                                            id="record-general-discount_percent"
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            max="100"
                                            placeholder="0.00"
                                            value={formValues.discount_percent ?? ""}
                                            onChange={(e) => handleFormFieldChange("discount_percent", e.target.value)}
                                          />
                                        </label>

                                        <label>
                                          <span>CGST (%)</span>
                                          <input
                                            id="record-general-cgst_percent"
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            max="100"
                                            placeholder="0.00"
                                            value={formValues.cgst_percent ?? ""}
                                            onChange={(e) => handleFormFieldChange("cgst_percent", e.target.value)}
                                          />
                                        </label>

                                        <label>
                                          <span>UTGST/SGST (%)</span>
                                          <input
                                            id="record-general-ut_sgst_percent"
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            max="100"
                                            placeholder="0.00"
                                            value={formValues.ut_sgst_percent ?? ""}
                                            onChange={(e) => handleFormFieldChange("ut_sgst_percent", e.target.value)}
                                          />
                                        </label>

                                        <label>
                                          <span>IGST (%)</span>
                                          <input
                                            id="record-general-igst_percent"
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            max="100"
                                            placeholder="0.00"
                                            value={formValues.igst_percent ?? ""}
                                            onChange={(e) => handleFormFieldChange("igst_percent", e.target.value)}
                                          />
                                        </label>
                                      </div>
                                    </div>
                                  ) : (
                                    /* IF OTHER IS SELECTED: RAW MATERIAL NAME AND ALL OTHER DETAILS AS INPUT */
                                    <div className="general-fields-grid-4">
                                      <label className="field-span-2">
                                        <span>Raw Material Name <span style={{ color: "#ef4444" }}>*</span></span>
                                        <input
                                          id="record-general-material_name"
                                          type="text"
                                          placeholder="Enter raw material name"
                                          value={formValues.material_name || formValues.item || ""}
                                          onChange={(e) => {
                                            handleFormFieldChange("material_name", e.target.value);
                                            handleFormFieldChange("item", e.target.value);
                                          }}
                                          required
                                        />
                                      </label>

                                      <label>
                                        <span>Zach Code</span>
                                        <input
                                          id="record-general-other-zach_code"
                                          type="text"
                                          placeholder="Enter Zach Code"
                                          value={formValues.zach_code ?? ""}
                                          onChange={(e) => handleFormFieldChange("zach_code", e.target.value)}
                                        />
                                      </label>

                                      <label>
                                        <span>HSN Code</span>
                                        <input
                                          id="record-general-hsn_code"
                                          type="text"
                                          placeholder="e.g. 8481"
                                          value={formValues.hsn_code ?? ""}
                                          onChange={(e) => handleFormFieldChange("hsn_code", e.target.value)}
                                        />
                                      </label>

                                      <label>
                                        <span>Unit</span>
                                        <select
                                          id="record-general-unit"
                                          value={formValues.unit || "num"}
                                          onChange={(e) => handleFormFieldChange("unit", e.target.value)}
                                        >
                                          <option value="num">num</option>
                                          <option value="kg">kg</option>
                                          <option value="litre">litre</option>
                                          <option value="mtrs">mtrs</option>
                                          <option value="other">other</option>
                                        </select>
                                      </label>

                                      <label>
                                        <span>Standard Rate (₹)</span>
                                        <input
                                          id="record-general-rate"
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          placeholder="0.00"
                                          value={formValues.rate ?? ""}
                                          onChange={(e) => handleFormFieldChange("rate", e.target.value)}
                                        />
                                      </label>

                                      <label>
                                        <span>Discount (%)</span>
                                        <input
                                          id="record-general-discount_percent"
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          max="100"
                                          placeholder="0.00"
                                          value={formValues.discount_percent ?? ""}
                                          onChange={(e) => handleFormFieldChange("discount_percent", e.target.value)}
                                        />
                                      </label>

                                      <label>
                                        <span>CGST (%)</span>
                                        <input
                                          id="record-general-cgst_percent"
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          max="100"
                                          placeholder="0.00"
                                          value={formValues.cgst_percent ?? ""}
                                          onChange={(e) => handleFormFieldChange("cgst_percent", e.target.value)}
                                        />
                                      </label>

                                      <label>
                                        <span>UTGST/SGST (%)</span>
                                        <input
                                          id="record-general-ut_sgst_percent"
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          max="100"
                                          placeholder="0.00"
                                          value={formValues.ut_sgst_percent ?? ""}
                                          onChange={(e) => handleFormFieldChange("ut_sgst_percent", e.target.value)}
                                        />
                                      </label>

                                      <label>
                                        <span>IGST (%)</span>
                                        <input
                                          id="record-general-igst_percent"
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          max="100"
                                          placeholder="0.00"
                                          value={formValues.igst_percent ?? ""}
                                          onChange={(e) => handleFormFieldChange("igst_percent", e.target.value)}
                                        />
                                      </label>
                                    </div>
                                  )}
                                </div>

                                {/* SECTION 2: RAW MATERIALS TABLE (JUST LIKE IN SUPPLIER TYPE) */}
                                <div className="staged-raw-materials-section">
                                  <div className="staged-raw-materials-header">
                                    <h3>Items Table ({stagedDailyInputs.length})</h3>
                                    <span className="staged-hint">
                                      Select item above, enter quantity below, then click "+ Add" to save into table.
                                    </span>
                                  </div>
                                  <div className="staged-table-wrapper">
                                    <table className="staged-table">
                                      {(formValues.type === "product" || formValues.raw_material_type === "product") ? (
                                        <colgroup>
                                          <col style={{ width: "3.5%" }} />
                                          <col style={{ width: "8%" }} />
                                          <col style={{ width: "12%" }} />
                                          <col style={{ width: "7%" }} />
                                          <col style={{ width: "5.5%" }} />
                                          <col style={{ width: "6%" }} />
                                          <col style={{ width: "5.5%" }} />
                                          <col style={{ width: "5.5%" }} />
                                          <col style={{ width: "7.5%" }} />
                                          <col style={{ width: "5%" }} />
                                          <col style={{ width: "6.5%" }} />
                                          <col style={{ width: "8%" }} />
                                          <col style={{ width: "10%" }} />
                                          <col style={{ width: "10%" }} />
                                        </colgroup>
                                      ) : (
                                        <colgroup>
                                          <col style={{ width: "3.5%" }} />
                                          <col style={{ width: "12%" }} />
                                          <col style={{ width: "5.5%" }} />
                                          <col style={{ width: "5%" }} />
                                          <col style={{ width: "6.5%" }} />
                                          <col style={{ width: "6.5%" }} />
                                          <col style={{ width: "6.5%" }} />
                                          <col style={{ width: "6.5%" }} />
                                          <col style={{ width: "6.5%" }} />
                                          <col style={{ width: "6.5%" }} />
                                          <col style={{ width: "6.5%" }} />
                                          <col style={{ width: "7.5%" }} />
                                          <col style={{ width: "11%" }} />
                                          <col style={{ width: "10%" }} />
                                        </colgroup>
                                      )}
                                      <thead>
                                        <tr>
                                          <th style={{ textAlign: "center" }} title="ID">ID</th>
                                          {(formValues.type === "product" || formValues.raw_material_type === "product") ? (
                                            <>
                                              <th title="P.O.No / Batch No">P.O.No</th>
                                              <th title="Name of Item">Item</th>
                                              <th title="Sach Code">Sach</th>
                                              <th title="Ls">Ls</th>
                                              <th className="numeric-cell" title="Quantity">Qty</th>
                                              <th title="Bin">Bin</th>
                                              <th title="Boxes">Boxes</th>
                                              <th title="Zach Code">Zach Code</th>
                                              <th title="Unit">Unit</th>
                                              <th title="HSN Code">HSN Code</th>
                                            </>
                                          ) : (
                                            <>
                                              <th title="Name of Item">Item</th>
                                              <th className="numeric-cell" title="Quantity">Qty</th>
                                              <th title="Unit">Unit</th>
                                              <th className="numeric-cell" title="Rate">Rate</th>
                                              <th className="numeric-cell" title="Basic Value = Quantity × Rate">Basic Val</th>
                                              <th className="numeric-cell" title="Discount Value">Disc Val</th>
                                              <th className="numeric-cell" title="Taxable Value = Basic Value - Discount Value">Taxable Val</th>
                                              <th className="numeric-cell" title="CGST Amount">CGST Amt</th>
                                              <th className="numeric-cell" title="SGST Amount">SGST Amt</th>
                                              <th className="numeric-cell" title="IGST Amount">IGST Amt</th>
                                            </>
                                          )}
                                          <th className="numeric-cell" title="Invoice Value">Invoice Val</th>
                                          <th title="Remarks">Remarks</th>
                                          <th style={{ textAlign: "center" }} title="Action">Action</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {stagedDailyInputs.map((row, idx) => {
                                          const isRowProduct = row.type === "product" || row.type === "element" || row.raw_material_type === "product";
                                          const isTableProduct = formValues.type === "product" || formValues.raw_material_type === "product";
                                          return (
                                            <tr key={row._tempId} className="staged-saved-row">
                                              <td style={{ textAlign: "center" }}>{idx + 1}</td>
                                              {isTableProduct ? (
                                                <>
                                                  <td>{row.po_batch_no || "—"}</td>
                                                  <td className="staged-item-name" title={row.item || "—"}>
                                                    {row.item || "—"}
                                                    {isRowProduct && (
                                                      <span style={{ marginLeft: "6px", fontSize: "10px", padding: "1px 5px", background: "#ede9fe", color: "#6d28d9", borderRadius: "4px", border: "1px solid #c4b5fd" }}>
                                                        Product
                                                      </span>
                                                    )}
                                                  </td>
                                                  <td>{row.sach_code || "—"}</td>
                                                  <td>{row.ls || "—"}</td>
                                                  <td className="numeric-cell">{row.quantity}</td>
                                                  <td>{row.bin || "—"}</td>
                                                  <td>{row.boxes || "—"}</td>
                                                  <td>{row.zach_code || "—"}</td>
                                                  <td>{row.unit || "—"}</td>
                                                  <td>{row.hsn_code || "—"}</td>
                                                </>
                                              ) : (
                                                <>
                                                  <td className="staged-item-name" title={row.item || "—"}>
                                                    {row.item || "—"}
                                                    {isRowProduct && (
                                                      <span style={{ marginLeft: "6px", fontSize: "10px", padding: "1px 5px", background: "#ede9fe", color: "#6d28d9", borderRadius: "4px", border: "1px solid #c4b5fd" }}>
                                                        Product
                                                      </span>
                                                    )}
                                                  </td>
                                                  <td className="numeric-cell">{row.quantity}</td>
                                                  <td>{row.unit || "—"}</td>
                                                  <td className="numeric-cell">{isRowProduct ? "—" : `₹${Number(row.rate || 0).toFixed(2)}`}</td>
                                                  <td className="numeric-cell">{isRowProduct ? "—" : `₹${Number(row.basic_value || 0).toFixed(2)}`}</td>
                                                  <td className="numeric-cell">{isRowProduct ? "—" : `₹${Number(row.discount_amount || 0).toFixed(2)}`}</td>
                                                  <td className="numeric-cell">{isRowProduct ? "—" : `₹${Number(row.amount || 0).toFixed(2)}`}</td>
                                                  <td className="numeric-cell">{isRowProduct ? "—" : `₹${Number(row.cgst_amount || 0).toFixed(2)}`}</td>
                                                  <td className="numeric-cell">{isRowProduct ? "—" : `₹${Number(row.ut_sgst_amount || 0).toFixed(2)}`}</td>
                                                  <td className="numeric-cell">{isRowProduct ? "—" : `₹${Number(row.igst_amount || 0).toFixed(2)}`}</td>
                                                </>
                                              )}
                                              <td className="numeric-cell staged-total-cell">₹{Number(row.total_amount || 0).toFixed(2)}</td>
                                              <td title={row.remarks || "—"}>{row.remarks || "—"}</td>
                                              <td className="staged-actions-cell" style={{ textAlign: "center" }}>
                                                <div className="staged-actions-wrap">
                                                  <button
                                                    type="button"
                                                    className="staged-action-btn edit-staged-btn"
                                                    onClick={() => handleEditStagedItem(idx)}
                                                    title="Edit this item"
                                                  >
                                                    Edit
                                                  </button>
                                                  <button
                                                    type="button"
                                                    className="staged-action-btn delete-staged-btn"
                                                    onClick={() => handleDeleteStagedItem(idx)}
                                                    title="Delete this item"
                                                  >
                                                    Delete
                                                  </button>
                                                </div>
                                              </td>
                                            </tr>
                                          );
                                        })}

                                        <tr className="table-active-input-row">
                                          <td style={{ textAlign: "center", fontWeight: "700", color: "#64748b" }}>
                                            {stagedDailyInputs.length + 1}
                                          </td>
                                          {(formValues.type === "product" || formValues.raw_material_type === "product") ? (
                                            <>
                                              <td>
                                                <input
                                                  type="text"
                                                  placeholder="P.O.No"
                                                  className="table-input"
                                                  value={formValues.po_batch_no ?? ""}
                                                  onChange={(e) => handleFormFieldChange("po_batch_no", e.target.value)}
                                                />
                                              </td>
                                              <td className="table-item-name-cell" title={formValues.material_name || formValues.item || (formValues.raw_material_type === "other" ? "Enter name above" : "Select item from above")}>
                                                {(formValues.material_name || formValues.item) ? (
                                                  <div className="table-active-item-badge">
                                                    <span className="table-active-item-text">{formValues.material_name || formValues.item}</span>
                                                    <span style={{ marginLeft: "5px", fontSize: "10px", padding: "1px 4px", background: "#ede9fe", color: "#6d28d9", borderRadius: "3px" }}>
                                                      Product
                                                    </span>
                                                  </div>
                                                ) : (
                                                  <div className="table-active-item-placeholder">
                                                    {formValues.raw_material_type === "other" ? "(Enter name above)" : "(Select above)"}
                                                  </div>
                                                )}
                                              </td>
                                              <td>
                                                <input
                                                  type="text"
                                                  placeholder="Sach"
                                                  className="table-input"
                                                  value={formValues.sach_code ?? ""}
                                                  onChange={(e) => handleFormFieldChange("sach_code", e.target.value)}
                                                />
                                              </td>
                                              <td>
                                                <input
                                                  type="text"
                                                  placeholder="Ls"
                                                  className="table-input"
                                                  value={formValues.ls ?? ""}
                                                  onChange={(e) => handleFormFieldChange("ls", e.target.value)}
                                                />
                                              </td>
                                              <td className="numeric-cell">
                                                <input
                                                  type="number"
                                                  step="any"
                                                  min="0.0001"
                                                  placeholder="0.00"
                                                  className="table-input table-qty-input numeric-input"
                                                  value={formValues.quantity ?? ""}
                                                  onChange={(e) => handleFormFieldChange("quantity", e.target.value)}
                                                />
                                              </td>
                                              <td>
                                                <input
                                                  type="text"
                                                  placeholder="Bin"
                                                  className="table-input"
                                                  value={formValues.bin ?? ""}
                                                  onChange={(e) => handleFormFieldChange("bin", e.target.value)}
                                                />
                                              </td>
                                              <td>
                                                <input
                                                  type="text"
                                                  placeholder="Boxes"
                                                  className="table-input"
                                                  value={formValues.boxes ?? ""}
                                                  onChange={(e) => handleFormFieldChange("boxes", e.target.value)}
                                                />
                                              </td>
                                              <td>
                                                <input
                                                  type="text"
                                                  placeholder="Zach Code"
                                                  className="table-input"
                                                  value={formValues.zach_code ?? ""}
                                                  onChange={(e) => handleFormFieldChange("zach_code", e.target.value)}
                                                />
                                              </td>
                                              <td>
                                                <select
                                                  className="table-input table-unit-select"
                                                  value={formValues.unit || "num"}
                                                  onChange={(e) => handleFormFieldChange("unit", e.target.value)}
                                                >
                                                  <option value="num">num</option>
                                                  <option value="kg">kg</option>
                                                  <option value="litre">litre</option>
                                                  <option value="mtrs">mtrs</option>
                                                  <option value="other">other</option>
                                                </select>
                                                {formValues.unit === "other" && (
                                                  <input
                                                    type="text"
                                                    placeholder="Specify unit"
                                                    className="table-input"
                                                    style={{ marginTop: "4px" }}
                                                    value={formValues.unit_other || ""}
                                                    onChange={(e) => handleFormFieldChange("unit_other", e.target.value)}
                                                  />
                                                )}
                                              </td>
                                              <td>
                                                <input
                                                  type="text"
                                                  placeholder="HSN Code"
                                                  className="table-input"
                                                  value={formValues.hsn_code ?? ""}
                                                  onChange={(e) => handleFormFieldChange("hsn_code", e.target.value)}
                                                />
                                              </td>
                                              <td className="numeric-cell">
                                                <input
                                                  type="number"
                                                  step="0.01"
                                                  min="0"
                                                  placeholder="0.00"
                                                  className="table-input numeric-input"
                                                  value={formValues.total_amount ?? ""}
                                                  onChange={(e) => handleFormFieldChange("total_amount", e.target.value)}
                                                />
                                              </td>
                                            </>
                                          ) : (
                                            <>
                                              <td className="table-item-name-cell" title={formValues.material_name || formValues.item || (formValues.raw_material_type === "other" ? "Enter name above" : "Select item from above")}>
                                                {(formValues.material_name || formValues.item) ? (
                                                  <div className="table-active-item-badge">
                                                    <span className="table-active-item-text">{formValues.material_name || formValues.item}</span>
                                                  </div>
                                                ) : (
                                                  <div className="table-active-item-placeholder">
                                                    {formValues.raw_material_type === "other" ? "(Enter name above)" : "(Select above)"}
                                                  </div>
                                                )}
                                              </td>
                                              <td className="numeric-cell">
                                                <input
                                                  type="number"
                                                  step="any"
                                                  min="0.0001"
                                                  placeholder="0.00"
                                                  className="table-input table-qty-input numeric-input"
                                                  value={formValues.quantity ?? ""}
                                                  onChange={(e) => handleFormFieldChange("quantity", e.target.value)}
                                                />
                                              </td>
                                              <td>
                                                <select
                                                  className="table-input table-unit-select"
                                                  value={formValues.unit || "num"}
                                                  onChange={(e) => handleFormFieldChange("unit", e.target.value)}
                                                >
                                                  <option value="num">num</option>
                                                  <option value="kg">kg</option>
                                                  <option value="litre">litre</option>
                                                  <option value="mtrs">mtrs</option>
                                                  <option value="other">other</option>
                                                </select>
                                                {formValues.unit === "other" && (
                                                  <input
                                                    type="text"
                                                    placeholder="Specify unit"
                                                    className="table-input"
                                                    style={{ marginTop: "4px" }}
                                                    value={formValues.unit_other || ""}
                                                    onChange={(e) => handleFormFieldChange("unit_other", e.target.value)}
                                                  />
                                                )}
                                              </td>
                                              <td className="numeric-cell">
                                                <input
                                                  type="number"
                                                  step="0.01"
                                                  min="0"
                                                  placeholder="0.00"
                                                  className="table-input table-rate-input numeric-input"
                                                  value={formValues.rate ?? ""}
                                                  onChange={(e) => handleFormFieldChange("rate", e.target.value)}
                                                />
                                              </td>
                                              <td className="numeric-cell table-calculated-cell">
                                                {`₹${Number(formValues.basic_value || 0).toFixed(2)}`}
                                              </td>
                                              <td className="numeric-cell table-calculated-cell">
                                                {`₹${Number(formValues.discount_amount || 0).toFixed(2)}`}
                                              </td>
                                              <td className="numeric-cell table-calculated-cell">
                                                {`₹${Number(formValues.amount || 0).toFixed(2)}`}
                                              </td>
                                              <td className="numeric-cell table-calculated-cell">
                                                {`₹${Number(formValues.cgst_amount || 0).toFixed(2)}`}
                                              </td>
                                              <td className="numeric-cell table-calculated-cell">
                                                {`₹${Number(formValues.ut_sgst_amount || 0).toFixed(2)}`}
                                              </td>
                                              <td className="numeric-cell table-calculated-cell">
                                                {`₹${Number(formValues.igst_amount || 0).toFixed(2)}`}
                                              </td>
                                              <td className="numeric-cell table-calculated-cell staged-total-cell">
                                                {`₹${Number(formValues.total_amount || 0).toFixed(2)}`}
                                              </td>
                                            </>
                                          )}
                                          <td>
                                            <input
                                              type="text"
                                              placeholder="Remarks"
                                              className="table-input"
                                              value={formValues.remarks ?? ""}
                                              onChange={(e) => handleFormFieldChange("remarks", e.target.value)}
                                            />
                                          </td>
                                          <td style={{ textAlign: "center" }}>
                                            {editingRecord ? (
                                              <span style={{ fontSize: "11px", color: "#64748b" }}>Editing</span>
                                            ) : (
                                              <button
                                                type="button"
                                                className="table-btn-add-more"
                                                onClick={handleAddMoreDailyInput}
                                                title="Add this item row to the table"
                                              >
                                                + Add
                                              </button>
                                            )}
                                          </td>
                                        </tr>
                                      </tbody>
                                      <tfoot>
                                        <tr className="staged-table-footer">
                                          <td colSpan={2}>
                                            <strong>Total ({stagedDailyInputs.length})</strong>
                                          </td>
                                          {(formValues.type === "product" || formValues.raw_material_type === "product") ? (
                                            <>
                                              <td>—</td>
                                              <td>—</td>
                                              <td>—</td>
                                              <td className="numeric-cell">
                                                <strong>
                                                  {Number.isInteger(stagedTotals.quantity)
                                                    ? String(stagedTotals.quantity)
                                                    : String(Number(stagedTotals.quantity.toFixed(4)))}
                                                </strong>
                                              </td>
                                              <td>—</td>
                                              <td>—</td>
                                              <td>—</td>
                                              <td>—</td>
                                              <td>—</td>
                                            </>
                                          ) : (
                                            <>
                                              <td className="numeric-cell">
                                                <strong>
                                                  {Number.isInteger(stagedTotals.quantity)
                                                    ? String(stagedTotals.quantity)
                                                    : String(Number(stagedTotals.quantity.toFixed(4)))}
                                                </strong>
                                              </td>
                                              <td>—</td>
                                              <td>—</td>
                                              <td className="numeric-cell"><strong>₹{stagedTotals.basic_value.toFixed(2)}</strong></td>
                                              <td className="numeric-cell"><strong>₹{stagedTotals.discount_amount.toFixed(2)}</strong></td>
                                              <td className="numeric-cell"><strong>₹{stagedTotals.amount.toFixed(2)}</strong></td>
                                              <td className="numeric-cell"><strong>₹{stagedTotals.cgst_amount.toFixed(2)}</strong></td>
                                              <td className="numeric-cell"><strong>₹{stagedTotals.ut_sgst_amount.toFixed(2)}</strong></td>
                                              <td className="numeric-cell"><strong>₹{stagedTotals.igst_amount.toFixed(2)}</strong></td>
                                            </>
                                          )}
                                          <td className="numeric-cell staged-total-cell"><strong>₹{stagedTotals.total_amount.toFixed(2)}</strong></td>
                                          <td>—</td>
                                          <td>—</td>
                                        </tr>
                                      </tfoot>
                                    </table>
                                  </div>
                                </div>
                              </div>
                            )}
                          </>
                        );
                      }


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
                        setStagedDailyInputs([]);
                        setStagedDailyDispatches([]);
                        setDailyDispatchType("");
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
                    <button
                      className="primary-action"
                      disabled={isSaving || isLookupLoading || Boolean(activeLookupError)}
                      type="submit"
                    >
                      {isSaving
                        ? "Saving to DB…"
                        : activeSection === "dailyInputs" && !editingRecord && stagedDailyInputs.length > 0
                          ? `Save All (${stagedDailyInputs.length + ((formValues.raw_material_id || formValues.product_id || formValues.item) && Number(formValues.quantity) > 0 ? 1 : 0)})`
                          : "Save"}
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
                            (with Zach Code)?
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
                      {productSaveConfirm.ls && (
                        <div className="product-confirm-cell">
                          <span className="confirm-meta-label">Ls</span>
                          <span className="confirm-meta-value">{productSaveConfirm.ls}</span>
                        </div>
                      )}
                      {productSaveConfirm.hsnCode && (
                        <div className="product-confirm-cell">
                          <span className="confirm-meta-label">HSN Code</span>
                          <span className="confirm-meta-value">{productSaveConfirm.hsnCode}</span>
                        </div>
                      )}
                      {productSaveConfirm.sachCode && (
                        <div className="product-confirm-cell">
                          <span className="confirm-meta-label">Sach Code</span>
                          <span className="confirm-meta-value">{productSaveConfirm.sachCode}</span>
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
                      <div className="form-field-group product-mode-group field-wide">
                        <div className="product-mode-radios">
                          <label className={`product-mode-radio-label ${quickAddRawMaterialModal.zach_mode === "with_zach_code" ? "selected" : ""}`}>
                            <input
                              type="radio"
                              name="quick_rm_zach_mode"
                              value="with_zach_code"
                              checked={quickAddRawMaterialModal.zach_mode === "with_zach_code"}
                              onChange={() =>
                                setQuickAddRawMaterialModal((prev) => ({
                                  ...prev,
                                  zach_mode: "with_zach_code",
                                }))
                              }
                              disabled={isSavingQuickRm}
                            />
                            <span className="radio-custom" />
                            <span className="radio-text">zach no</span>
                          </label>
                          <label className={`product-mode-radio-label ${(quickAddRawMaterialModal.zach_mode || "without_zach_code") === "without_zach_code" ? "selected" : ""}`}>
                            <input
                              type="radio"
                              name="quick_rm_zach_mode"
                              value="without_zach_code"
                              checked={(quickAddRawMaterialModal.zach_mode || "without_zach_code") === "without_zach_code"}
                              onChange={() =>
                                setQuickAddRawMaterialModal((prev) => ({
                                  ...prev,
                                  zach_mode: "without_zach_code",
                                  zach_code: "",
                                }))
                              }
                              disabled={isSavingQuickRm}
                            />
                            <span className="radio-custom" />
                            <span className="radio-text">no zach no</span>
                          </label>
                        </div>
                      </div>

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

                        {quickAddRawMaterialModal.zach_mode === "with_zach_code" && (
                          <label className="quick-rm-field" htmlFor="qrm-zach">
                            Zach No *
                            <input
                              id="qrm-zach"
                              type="text"
                              required
                              disabled={isSavingQuickRm}
                              value={quickAddRawMaterialModal.zach_code || ""}
                              onChange={(e) =>
                                setQuickAddRawMaterialModal((prev) => ({
                                  ...prev,
                                  zach_code: e.target.value,
                                }))
                              }
                              placeholder="Enter Zach No"
                            />
                          </label>
                        )}

                        <label className="quick-rm-field" htmlFor="qrm-details">
                          Details
                          <input
                            id="qrm-details"
                            type="text"
                            disabled={isSavingQuickRm}
                            value={quickAddRawMaterialModal.details || ""}
                            onChange={(e) =>
                              setQuickAddRawMaterialModal((prev) => ({
                                ...prev,
                                details: e.target.value,
                              }))
                            }
                            placeholder="Enter details"
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
                            <option value="other">other</option>
                          </select>
                        </label>

                        {quickAddRawMaterialModal.unit === "other" && (
                          <label className="quick-rm-field" htmlFor="qrm-unit-other">
                            Specify Unit *
                            <input
                              id="qrm-unit-other"
                              type="text"
                              required
                              disabled={isSavingQuickRm}
                              value={quickAddRawMaterialModal.unit_other || ""}
                              onChange={(e) =>
                                setQuickAddRawMaterialModal((prev) => ({
                                  ...prev,
                                  unit_other: e.target.value,
                                }))
                              }
                              placeholder="e.g. rolls, bags, cartons"
                              autoFocus
                            />
                          </label>
                        )}

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
                            <option value="other">other</option>
                          </select>
                        </label>

                        {quickAddProductModal.type === "other" && (
                          <label className="quick-rm-field" htmlFor="qprd-type-other">
                            Specify Product Type *
                            <input
                              id="qprd-type-other"
                              type="text"
                              required
                              disabled={isSavingQuickPrd}
                              value={quickAddProductModal.type_other || ""}
                              onChange={(e) =>
                                setQuickAddProductModal((prev) => ({
                                  ...prev,
                                  type_other: e.target.value,
                                }))
                              }
                              placeholder="e.g. sensor, relay, module"
                              autoFocus
                            />
                          </label>
                        )}

                        <label className="quick-rm-field" htmlFor="qprd-hsn">
                          HSN Code
                          <input
                            id="qprd-hsn"
                            type="text"
                            disabled={isSavingQuickPrd}
                            value={quickAddProductModal.hsn_code || ""}
                            onChange={(e) =>
                              setQuickAddProductModal((prev) => ({
                                ...prev,
                                hsn_code: e.target.value,
                              }))
                            }
                            placeholder="e.g. 8532"
                          />
                        </label>

                        <label className="quick-rm-field" htmlFor="qprd-ls">
                          Ls
                          <input
                            id="qprd-ls"
                            type="text"
                            disabled={isSavingQuickPrd}
                            value={quickAddProductModal.ls || ""}
                            onChange={(e) =>
                              setQuickAddProductModal((prev) => ({
                                ...prev,
                                ls: e.target.value,
                              }))
                            }
                            placeholder="e.g. LS-01"
                          />
                        </label>

                        <label className="quick-rm-field" htmlFor="qprd-sach">
                          Sach Code
                          <input
                            id="qprd-sach"
                            type="text"
                            disabled={isSavingQuickPrd}
                            value={quickAddProductModal.sach_code || ""}
                            onChange={(e) =>
                              setQuickAddProductModal((prev) => ({
                                ...prev,
                                sach_code: e.target.value,
                              }))
                            }
                            placeholder="e.g. SACH-01"
                          />
                        </label>

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

              {quickAddSupplierModal && (
                <div
                  aria-labelledby="quick-sup-title"
                  aria-modal="true"
                  className="modal-overlay quick-rm-overlay"
                  onClick={() => {
                    if (!isSavingQuickSup) setQuickAddSupplierModal(null);
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
                        <span className="quick-rm-icon">🏢</span>
                      </div>
                      <div className="quick-rm-header-text">
                        <h2 id="quick-sup-title">Add Supplier</h2>
                        <p className="quick-rm-sub">
                          Enter details to add this supplier. After saving, you will return directly to Daily Input with this supplier selected.
                        </p>
                      </div>
                      <button
                        type="button"
                        className="quick-rm-close-btn"
                        disabled={isSavingQuickSup}
                        onClick={() => setQuickAddSupplierModal(null)}
                        title="Cancel and return to Daily Input"
                      >
                        ×
                      </button>
                    </div>

                    {quickSupError && (
                      <p className="workspace-error quick-rm-error" role="alert">
                        {quickSupError}
                      </p>
                    )}

                    <form className="quick-rm-form" onSubmit={handleSaveQuickSupplier}>
                      <div className="quick-rm-fields-grid">
                        <label className="quick-rm-field field-wide" htmlFor="qsup-company">
                          Company Name *
                          <input
                            id="qsup-company"
                            type="text"
                            required
                            disabled={isSavingQuickSup}
                            value={quickAddSupplierModal.company_name}
                            onChange={(e) =>
                              setQuickAddSupplierModal((prev) => ({
                                ...prev,
                                company_name: e.target.value,
                              }))
                            }
                            placeholder="e.g. Acme Industries Ltd."
                            autoFocus
                          />
                        </label>

                        <label className="quick-rm-field" htmlFor="qsup-contact">
                          Contact Person
                          <input
                            id="qsup-contact"
                            type="text"
                            disabled={isSavingQuickSup}
                            value={quickAddSupplierModal.contact_person}
                            onChange={(e) =>
                              setQuickAddSupplierModal((prev) => ({
                                ...prev,
                                contact_person: e.target.value,
                              }))
                            }
                            placeholder="e.g. John Doe"
                          />
                        </label>

                        <label className="quick-rm-field" htmlFor="qsup-phone">
                          Phone
                          <input
                            id="qsup-phone"
                            type="text"
                            disabled={isSavingQuickSup}
                            value={quickAddSupplierModal.phone}
                            onChange={(e) =>
                              setQuickAddSupplierModal((prev) => ({
                                ...prev,
                                phone: e.target.value,
                              }))
                            }
                            placeholder="e.g. +91 9876543210"
                          />
                        </label>

                        <label className="quick-rm-field" htmlFor="qsup-email">
                          Email
                          <input
                            id="qsup-email"
                            type="email"
                            disabled={isSavingQuickSup}
                            value={quickAddSupplierModal.email}
                            onChange={(e) =>
                              setQuickAddSupplierModal((prev) => ({
                                ...prev,
                                email: e.target.value,
                              }))
                            }
                            placeholder="e.g. contact@supplier.com"
                          />
                        </label>

                        <label className="quick-rm-field" htmlFor="qsup-city">
                          City
                          <input
                            id="qsup-city"
                            type="text"
                            disabled={isSavingQuickSup}
                            value={quickAddSupplierModal.city}
                            onChange={(e) =>
                              setQuickAddSupplierModal((prev) => ({
                                ...prev,
                                city: e.target.value,
                              }))
                            }
                            placeholder="e.g. Pune"
                          />
                        </label>

                        <label className="quick-rm-field" htmlFor="qsup-state">
                          State
                          <select
                            id="qsup-state"
                            disabled={isSavingQuickSup}
                            value={quickAddSupplierModal.state}
                            onChange={(e) =>
                              setQuickAddSupplierModal((prev) => ({
                                ...prev,
                                state: e.target.value,
                              }))
                            }
                          >
                            <option value="">Select state...</option>
                            {INDIAN_STATES.map((st) => (
                              <option key={st} value={st}>
                                {st}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="quick-rm-field" htmlFor="qsup-pincode">
                          Pincode
                          <input
                            id="qsup-pincode"
                            type="text"
                            disabled={isSavingQuickSup}
                            value={quickAddSupplierModal.pincode}
                            onChange={(e) =>
                              setQuickAddSupplierModal((prev) => ({
                                ...prev,
                                pincode: e.target.value,
                              }))
                            }
                            placeholder="e.g. 411001"
                          />
                        </label>

                        <label className="quick-rm-field" htmlFor="qsup-gst">
                          GST Number
                          <input
                            id="qsup-gst"
                            type="text"
                            disabled={isSavingQuickSup}
                            value={quickAddSupplierModal.gst_number}
                            onChange={(e) =>
                              setQuickAddSupplierModal((prev) => ({
                                ...prev,
                                gst_number: e.target.value,
                              }))
                            }
                            placeholder="e.g. 27ABCDE1234F1Z5"
                          />
                        </label>

                        <label className="quick-rm-field field-wide" htmlFor="qsup-address">
                          Address
                          <input
                            id="qsup-address"
                            type="text"
                            disabled={isSavingQuickSup}
                            value={quickAddSupplierModal.address}
                            onChange={(e) =>
                              setQuickAddSupplierModal((prev) => ({
                                ...prev,
                                address: e.target.value,
                              }))
                            }
                            placeholder="Street address / area"
                          />
                        </label>
                      </div>

                      <div className="form-actions quick-rm-actions">
                        <button
                          className="secondary-action"
                          disabled={isSavingQuickSup}
                          onClick={() => setQuickAddSupplierModal(null)}
                          type="button"
                        >
                          Cancel &amp; Return to Daily Input
                        </button>
                        <button
                          className="primary-action"
                          disabled={isSavingQuickSup}
                          type="submit"
                        >
                          {isSavingQuickSup ? "Saving Supplier…" : "Save & Select in Daily Input"}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {!(activeSection === "dailyDispatch" && isFormOpen) && (
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
      {(activeSection === "dailyDispatch" && filteredRecords.length > 0
        ? activeConfig.columns.filter(([key]) =>
            filteredRecords.some((rec) => {
              const rawVal = getRecordFieldValue(rec, key);
              const cellValue = getRelatedCompanyName(key, rawVal, rec) ?? rawVal;
              const formatted = String(formatCell(cellValue) ?? "").trim();
              return formatted !== "" && formatted !== "-" && formatted !== "—" && formatted.toLowerCase() !== "null";
            })
          )
        : activeConfig.columns
      ).map(([, label]) => (
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

                          {(activeSection === "dailyDispatch" && filteredRecords.length > 0
                            ? activeConfig.columns.filter(([key]) =>
                                filteredRecords.some((rec) => {
                                  const rawVal = getRecordFieldValue(rec, key);
                                  const cellValue = getRelatedCompanyName(key, rawVal, rec) ?? rawVal;
                                  const formatted = String(formatCell(cellValue) ?? "").trim();
                                  return formatted !== "" && formatted !== "-" && formatted !== "—" && formatted.toLowerCase() !== "null";
                                })
                              )
                            : activeConfig.columns
                          ).map(([key]) => {
                            const rawVal = getRecordFieldValue(record, key);
                            const cellValue = getRelatedCompanyName(key, rawVal, record) ?? rawVal;
                            const formatted = formatCell(cellValue);
                            const displayCell =
                              activeSection === "dailyDispatch" &&
                              (formatted === "-" || formatted === "—")
                                ? ""
                                : formatted;
                            return (
                              <td key={key} title={typeof cellValue === "string" ? cellValue : undefined}>
                                {displayCell}
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

                                  let editValues = {};
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
                                    } else if (field.name === "zach_mode") {
                                      const hasZach = Boolean(record.has_zach_code || record.zach_code);
                                      editValues.zach_mode = hasZach ? "with_zach_code" : "without_zach_code";
                                    } else if (field.name === "zach_code") {
                                      editValues.zach_code = record.zach_code ?? "";
                                    } else if (field.name === "product_id" || field.type === "consumptionProductPicker") {
  editValues[field.name] = record.product_id ?? "";
} else if (field.name === "raw_material_ids" || field.name === "raw_materials" || field.type === "multiRawMaterial" || field.type === "consumptionMaterialsPicker") {
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
                                    } else if (field.type === "select") {
                                      const rawVal = record[field.name];
                                      const standardOptions = (field.options || [])
                                        .filter((opt) => opt.value !== "other")
                                        .map((opt) => String(opt.value).toLowerCase());
                                      if (rawVal !== undefined && rawVal !== null && rawVal !== "") {
                                        const strVal = String(rawVal).trim();
                                        if (standardOptions.includes(strVal.toLowerCase())) {
                                          const matching = (field.options || []).find((opt) => String(opt.value).toLowerCase() === strVal.toLowerCase());
                                          editValues[field.name] = matching ? matching.value : strVal;
                                          editValues[`${field.name}_other`] = "";
                                        } else if ((field.options || []).some((opt) => opt.value === "other")) {
                                          editValues[field.name] = "other";
                                          editValues[`${field.name}_other`] = strVal;
                                        } else {
                                          editValues[field.name] = strVal;
                                          editValues[`${field.name}_other`] = "";
                                        }
                                      } else {
                                        editValues[field.name] = "";
                                        editValues[`${field.name}_other`] = "";
                                      }
                                    } else {
                                      editValues[field.name] = record[field.name] ?? "";
                                    }
                                  }

                                  if (activeSection === "rawMaterials") {
                                    const hasZach = Boolean(record.has_zach_code || record.zach_code);
                                    editValues.zach_mode = hasZach ? "with_zach_code" : "without_zach_code";
                                    editValues.zach_code = record.zach_code ?? "";
                                    editValues.details = record.details ?? "";
                                  }

                                  if (activeSection === "products") {
                                    const hasZach = Boolean(record.has_zach_code || record.zach_code);
                                    editValues.product_mode = hasZach ? "with_zach_code" : "without_zach_code";
                                    editValues.ls = record.ls ?? "";
                                    editValues.hsn_code = record.hsn_code ?? "";
                                    editValues.sach_code = record.sach_code ?? "";
                                  }

                                  if (activeSection === "dailyInputs") {
                                    const suppType = record.supplier_type || (record.supplier_id ? "supplier" : "general");
                                    editValues.supplier_type = suppType;
                                    editValues.type = record.type ?? "raw_material";
                                    const isProd = record.type === "product" || record.type === "element" || Boolean(record.product_id);
                                    editValues.raw_material_type = isProd ? "product" : (record.type === "other" ? "other" : "raw_material");
                                    editValues.raw_material_id = record.raw_material_id ?? "";
                                    editValues.product_id = record.product_id || (record.type === "element" ? record.element_id : "") || "";
                                    editValues.element_id = record.element_id ?? "";
                                    editValues.supplier_id = record.supplier_id ?? "";
                                    editValues.material_name = record.item || "";
                                    editValues.item = record.item || "";
                                    if (isProd) {
                                      editValues.rate = 0;
                                      editValues.basic_value = 0;
                                      editValues.discount_percent = 0;
                                      editValues.discount_amount = 0;
                                      editValues.amount = 0;
                                      editValues.cgst_percent = 0;
                                      editValues.cgst_amount = 0;
                                      editValues.ut_sgst_percent = 0;
                                      editValues.ut_sgst_amount = 0;
                                      editValues.igst_percent = 0;
                                      editValues.igst_amount = 0;
                                      editValues.total_amount = record.total_amount ?? "";

                                      const matchedPrd = lookupOptions.products?.find(
                                        (p) => String(p.id) === String(editValues.product_id || record.product_id || record.element_id) ||
                                               String(p.name || "").trim().toLowerCase() === String(record.item || "").trim().toLowerCase()
                                      );
                                      editValues.hsn_code = record.hsn_code || record.other_details?.hsn_code || matchedPrd?.hsn_code || "";
                                      editValues.zach_code = record.zach_code || record.other_details?.zach_code || matchedPrd?.zach_code || "";
                                      editValues.po_batch_no = record.po_batch_no || record.other_details?.po_batch_no || matchedPrd?.po_batch_no || "";
                                      editValues.ls = record.ls || record.other_details?.ls || matchedPrd?.ls || "";
                                      editValues.sach_code = record.sach_code || record.other_details?.sach_code || matchedPrd?.sach_code || "";
                                      editValues.bin = record.bin || record.other_details?.bin || matchedPrd?.bin || "";
                                      editValues.boxes = record.boxes || record.other_details?.boxes || matchedPrd?.boxes || "";
                                    } else {
                                      if (record.cgst_percent !== undefined && record.cgst_percent !== null) {
                                        editValues.cgst_percent = record.cgst_percent;
                                      }
                                      if (record.ut_sgst_percent !== undefined && record.ut_sgst_percent !== null) {
                                        editValues.ut_sgst_percent = record.ut_sgst_percent;
                                      }
                                      if (record.igst_percent !== undefined && record.igst_percent !== null) {
                                        editValues.igst_percent = record.igst_percent;
                                      }
                                      if (suppType === "general") {
                                        editValues.supplier_company_name = record.supplier_company_name || record.other_details?.supplier_company_name || record.other_details?.company_name || "";
                                        editValues.supplier_contact_person = record.supplier_contact_person || record.other_details?.supplier_contact_person || record.other_details?.contact_person || "";
                                        editValues.supplier_phone = record.supplier_phone || record.other_details?.supplier_phone || record.other_details?.phone || "";
                                        editValues.supplier_email = record.supplier_email || record.other_details?.supplier_email || record.other_details?.email || "";
                                        editValues.supplier_address = record.supplier_address || record.other_details?.supplier_address || record.other_details?.address || "";
                                        editValues.supplier_city = record.supplier_city || record.other_details?.supplier_city || record.other_details?.city || "";
                                        editValues.supplier_state = record.supplier_state || record.other_details?.supplier_state || record.other_details?.state || "";
                                        editValues.supplier_pincode = record.supplier_pincode || record.other_details?.supplier_pincode || record.other_details?.pincode || "";
                                        editValues.supplier_gst_number = record.supplier_gst_number || record.other_details?.supplier_gst_number || record.other_details?.gst_number || "";

                                        const matchedRm = lookupOptions.rawMaterials?.find(
                                          (m) => String(m.id) === String(record.raw_material_id) || String(m.material_name || "").toLowerCase() === String(record.item || "").toLowerCase()
                                        );
                                        if (matchedRm) {
                                          if (!editValues.hsn_code) editValues.hsn_code = matchedRm.hsn_code || "";
                                          if (!editValues.unit) editValues.unit = matchedRm.unit || "num";
                                          if (!editValues.rate) editValues.rate = matchedRm.rate || 0;
                                          if (editValues.cgst_percent === undefined || editValues.cgst_percent === "") editValues.cgst_percent = matchedRm.cgst_percent || 0;
                                          if (editValues.ut_sgst_percent === undefined || editValues.ut_sgst_percent === "") editValues.ut_sgst_percent = matchedRm.ut_sgst_percent || 0;
                                          if (editValues.igst_percent === undefined || editValues.igst_percent === "") editValues.igst_percent = matchedRm.igst_percent || 0;
                                        }
                                      }
                                    }
                                  }

                                  setFormType(
                                    editValues.type ||
                                    record.type ||
                                    (activeSection === "costData"
                                      ? "Basic"
                                      : activeSection === "products"
                                        ? "element"
                                        : "raw_material")
                                  );

                                  // Preserve daily input's own saved values without overwriting with master raw material / element
                                  if (record.type === "product" || (record.type === "element" && editValues.raw_material_type === "product")) {
                                    if (record.item) editValues.item = record.item;
                                    if (record.unit) {
                                      const stdUnits = ["num", "kg", "litre", "mtrs"];
                                      if (stdUnits.includes(String(record.unit).toLowerCase())) {
                                        editValues.unit = record.unit;
                                        editValues.unit_other = "";
                                      } else {
                                        editValues.unit = "other";
                                        editValues.unit_other = record.unit;
                                      }
                                    }
                                    editValues.rate = 0;
                                    editValues.basic_value = 0;
                                    editValues.discount_percent = 0;
                                    editValues.discount_amount = 0;
                                    editValues.amount = 0;
                                    editValues.cgst_percent = 0;
                                    editValues.cgst_amount = 0;
                                    editValues.ut_sgst_percent = 0;
                                    editValues.ut_sgst_amount = 0;
                                    editValues.igst_percent = 0;
                                    editValues.igst_amount = 0;
                                    editValues.total_amount = 0;
                                  } else if (record.type === "raw_material" || record.type === "element") {
                                    if (record.item) editValues.item = record.item;
                                    if (record.unit) {
                                      const stdUnits = ["num", "kg", "litre", "mtrs"];
                                      if (stdUnits.includes(String(record.unit).toLowerCase())) {
                                        editValues.unit = record.unit;
                                        editValues.unit_other = "";
                                      } else {
                                        editValues.unit = "other";
                                        editValues.unit_other = record.unit;
                                      }
                                    }
                                    if (record.rate !== undefined && record.rate !== null && record.rate !== "") {
                                      editValues.rate = record.rate;
                                    } else if (record.amount && record.quantity) {
                                      editValues.rate = Number((Number(record.amount) / Number(record.quantity)).toFixed(2));
                                    }
                                    const calcQty = Number(record.quantity) || 0;
                                    const calcRate = Number(editValues.rate !== undefined && editValues.rate !== "" ? editValues.rate : record.rate) || 0;
                                    const calcBasic = Number((calcQty * calcRate).toFixed(2));
                                    editValues.basic_value = record.basic_value !== undefined && record.basic_value !== null && record.basic_value !== "" ? record.basic_value : calcBasic;
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
                                    if (record.discount_amount !== undefined && record.discount_amount !== null && record.discount_amount !== "") {
                                      editValues.discount_amount = record.discount_amount;
                                    } else if (calcBasic && editValues.discount_percent) {
                                      editValues.discount_amount = Number(((calcBasic * Number(editValues.discount_percent)) / 100).toFixed(2));
                                    } else {
                                      editValues.discount_amount = 0;
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
                                    const otherQty = Number(record.quantity) || 0;
                                    const otherRate = Number(editValues.rate) || 0;
                                    const otherBasic = Number((otherQty * otherRate).toFixed(2));
                                    editValues.basic_value = details.basic_value ?? record.basic_value ?? otherBasic;
                                    editValues.supplier_company_name = details.supplier_company_name || details.company_name || "";
                                    editValues.supplier_contact_person = details.supplier_contact_person || details.contact_person || "";
                                    editValues.supplier_email = details.supplier_email || details.email || "";
                                    editValues.supplier_phone = details.supplier_phone || details.phone || "";
                                    editValues.supplier_address = details.supplier_address || details.address || "";
                                    editValues.supplier_city = details.supplier_city || details.city || "";
                                    editValues.supplier_state = details.supplier_state || details.state || "";
                                    editValues.supplier_pincode = details.supplier_pincode || details.pincode || "";
                                    editValues.supplier_gst_number = details.supplier_gst_number || details.gst_number || "";
                                    if (details.discount_percent !== undefined && details.discount_percent !== null) {
                                      editValues.discount_percent = details.discount_percent;
                                    } else if (record.discount_percent !== undefined && record.discount_percent !== null) {
                                      editValues.discount_percent = record.discount_percent;
                                    }
                                    if (details.discount_amount !== undefined && details.discount_amount !== null) {
                                      editValues.discount_amount = details.discount_amount;
                                    } else if (record.discount_amount !== undefined && record.discount_amount !== null) {
                                      editValues.discount_amount = record.discount_amount;
                                    } else if (otherBasic && editValues.discount_percent) {
                                      editValues.discount_amount = Number(((otherBasic * Number(editValues.discount_percent)) / 100).toFixed(2));
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

                                  if (activeSection === "costData") {
                                    editValues = calculateCostDataBasicAutofill(editValues, "init");
                                  }

                                  if (activeSection === "dailyDispatch") {
                                    setDailyDispatchType(record.type || "Job work");
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
          </ErrorBoundary>
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
          <h1 id="page-title">Oyster Electronics</h1>
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

      
    </section>
  );
}

function formatCell(value) {
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
            (it.raw_material_id ? `RM #${it.raw_material_id}` : "");
          const qty =
            it.quantity !== undefined && it.quantity !== null && it.quantity !== ""
              ? it.quantity
              : "";
          const unit = it.unit ? ` ${it.unit}` : "";
          return name ? (qty ? `${name} (${qty}${unit})` : name) : JSON.stringify(it);
        })
        .filter(Boolean)
        .join(", ") || "—"
    );
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default App;
