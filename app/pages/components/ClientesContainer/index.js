"use client";
import React, { useEffect, useMemo, useState, useCallback } from "react";
import styles from "./styles.module.css";
import EmpresaSelected from "../EmpresaSelected"; // quitá si no lo usás

export default function Clientes() {
  // Data
  const [clientes, setClientes] = useState([]);
  const [listas, setListas] = useState([]); // códigos (strings)

  // Selección / edición
  const [selectedClientesData, setSelectedClientesData] = useState({});
  const selectedIds = useMemo(
    () => Object.keys(selectedClientesData).filter(id => selectedClientesData[id]?.isSelected),
    [selectedClientesData]
  );
  const selectedCount = selectedIds.length;
  const allSelected = clientes.length > 0 && selectedCount === clientes.length;

  // Campo a actualizar (por ahora solo "lista")
  const [fieldMode, setFieldMode] = useState("lista");
  const newValueHeader = "Nueva Lista";
  const [globalNewValue, setGlobalNewValue] = useState(""); // <- único origen de verdad

  // Ordenamiento
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState("asc");

  // UI / estado
  const [loading, setLoading] = useState(false);
  const [runLogs, setRunLogs] = useState([]);
  const [runErrors, setRunErrors] = useState([]);
  const [importMessage, setImportMessage] = useState("");
  const [importStatus, setImportStatus] = useState(null); // "ok" | "error" | null
  const [isImportButtonDisabled, setIsImportButtonDisabled] = useState(false);

  const normalize = (v) => (v == null ? "" : String(v).trim());

  // Fetchers
  const fetchClientes = useCallback(async () => {
    if (!window?.api?.clientesForm?.traerTodos) return;
    setLoading(true); setRunErrors([]);
    try {
      const r = await window.api.clientesForm.traerTodos();
      if (!r?.success) throw new Error(r?.message || "No se pudieron obtener clientes.");
      setClientes(r.data || []);
    } catch (e) {
      setClientes([]);
      setRunErrors([e?.message || "Error cargando clientes."]);
    } finally { setLoading(false); }
  }, []);

  const fetchListas = useCallback(async () => {
    if (!window?.api?.clientesForm?.traerCodigosLista) return;
    try {
      const r = await window.api.clientesForm.traerCodigosLista();
      if (r?.success) setListas(r.data || []);
    } catch {}
  }, []);

  useEffect(() => { fetchClientes(); fetchListas(); }, [fetchClientes, fetchListas]);

  // Ordenamiento
  const handleSort = (columnName) => {
    if (sortColumn === columnName) setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortColumn(columnName); setSortDirection("asc"); }
  };
  const renderSortArrow = (columnName) => (
    <span style={{ marginLeft: 6 }}>
      <span style={{ fontWeight: sortColumn === columnName && sortDirection === "asc" ? "bold" : "normal" }}>▲</span>
      <span style={{ fontWeight: sortColumn === columnName && sortDirection === "desc" ? "bold" : "normal" }}>▼</span>
    </span>
  );
  const sortedClientes = useMemo(() => {
    if (!clientes?.length || !sortColumn) return clientes || [];
    const arr = [...clientes];
    arr.sort((a, b) => {
      let va = a?.[sortColumn], vb = b?.[sortColumn];
      const nA = Number(va), nB = Number(vb);
      if (!isNaN(nA) && !isNaN(nB)) return sortDirection === "asc" ? nA - nB : nB - nA;
      va = normalize(va).toLowerCase(); vb = normalize(vb).toLowerCase();
      if (va < vb) return sortDirection === "asc" ? -1 : 1;
      if (va > vb) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [clientes, sortColumn, sortDirection]);

  // Selecciones
  const onClienteToggle = (id) => {
    setSelectedClientesData((prev) => {
      const next = { ...prev };
      const cur = next[id] || { isSelected: false, newValue: "" };
      const willSelect = !cur.isSelected;

      next[id] = { ...cur, isSelected: willSelect };

      // Si ya hay valor global elegido, aplicar automáticamente al marcar
      if (willSelect && fieldMode === "lista" && globalNewValue) {
        next[id].newValue = globalNewValue;
      }
      return next;
    });
  };

  const onSelectAllChange = (checked) => {
    setSelectedClientesData((prev) => {
      const map = {};
      if (checked) {
        for (const c of clientes) {
          map[c.CodCliente] = {
            isSelected: true,
            newValue: (fieldMode === "lista" ? globalNewValue : "") || "",
          };
        }
      }
      return map;
    });
  };

  // ÚNICO editor de valor nuevo (global)
  const onGlobalValueChange = (value) => {
    setGlobalNewValue(value);
    if (!selectedIds.length) return;
    setSelectedClientesData((prev) => {
      const next = { ...prev };
      selectedIds.forEach((id) => {
        next[id] = { ...(next[id] || { isSelected: true }), newValue: value };
      });
      return next;
    });
  };

  // Helpers
  const getCommonFromCodOrError = () => {
    const currentListas = new Set(
      selectedIds.map((id) => {
        const c = clientes.find((x) => String(x.CodCliente) === String(id));
        return normalize(c?.CodListaPrecio);
      })
    );
    if (currentListas.size === 0) return { error: "No hay clientes seleccionados." };
    if (currentListas.size > 1) {
      return { error: "Los seleccionados tienen distintas listas de origen. Filtrá/seleccioná una sola lista de origen." };
    }
    return { fromCod: Array.from(currentListas)[0] };
  };

  const onImportarClick = async () => {
    setRunErrors([]); setRunLogs([]); setImportMessage(""); setImportStatus(null);

    if (selectedCount === 0) { setRunErrors(["Seleccioná al menos un cliente."]); return; }
    if (fieldMode !== "lista") { setRunErrors(["Por ahora solo se puede actualizar Lista de Precios."]); return; }
    if (!globalNewValue) { setRunErrors(["Elegí la lista destino en el selector de arriba."]); return; }

    const { fromCod, error: fromErr } = getCommonFromCodOrError();
    if (fromErr) { setRunErrors([fromErr]); return; }
    if (normalize(fromCod) === normalize(globalNewValue)) {
      setRunErrors(["La lista destino es igual a la de origen."]);
      return;
    }

    try {
      setIsImportButtonDisabled(true);
      const r = await window.api?.clientesForm?.actualizarLista({ fromCod, toCod: globalNewValue });
      if (!r?.success) throw new Error(r?.message || "No se pudo actualizar.");
      setImportStatus("ok"); setImportMessage(`Actualizados: ${r.updatedRows ?? 0}`);
      setRunLogs([`Origen ${fromCod} → Destino ${globalNewValue}`]);
      await fetchClientes();
      setSelectedClientesData({});
    } catch (e) {
      setImportStatus("error"); setImportMessage("Falló la actualización.");
      setRunErrors([e?.message || "Error desconocido al actualizar."]);
    } finally { setIsImportButtonDisabled(false); }
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.headerContainer}>
        <h2 className={styles.title}>Actualizador de Clientes</h2>
        <EmpresaSelected />
      </div>

      {/* Barra superior */}
      <div className={styles.massBar}>
        <div className={styles.massLeft}>
          <label className={styles.label}>Campo a Actualizar:</label>
          <select className={styles.input} value={fieldMode} onChange={(e) => setFieldMode(e.target.value)}>
            <option value="lista">Lista de Precios</option>
          </select>
        </div>

        {/* Editor global: ÚNICO lugar donde se elige el valor */}
        <div className={styles.massRight}>
          <label className={styles.label}>{newValueHeader}:</label>
          <select
            className={`${styles.input} ${styles.updateAccentInput}`}
            value={globalNewValue}
            onChange={(e) => onGlobalValueChange(e.target.value)}
          >
            <option value="">(seleccionar)</option>
            {listas.map((cod) => <option key={cod} value={cod}>{cod}</option>)}
          </select>
        </div>
      </div>

      {/* Tabla */}
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr className={styles.headerRow}>
              <th onClick={() => handleSort("CodCliente")}>Código {renderSortArrow("CodCliente")}</th>
              <th onClick={() => handleSort("RazonSocial")}>Razón Social {renderSortArrow("RazonSocial")}</th>
              <th onClick={() => handleSort("Direccion")}>Dirección {renderSortArrow("Direccion")}</th>
              <th onClick={() => handleSort("CodZona")}>CodZona {renderSortArrow("CodZona")}</th>
              <th onClick={() => handleSort("Zona")}>Zona {renderSortArrow("Zona")}</th>
              <th onClick={() => handleSort("Localidad")}>Localidad {renderSortArrow("Localidad")}</th>
              <th onClick={() => handleSort("CodigoPostal")}>CodPostal {renderSortArrow("CodigoPostal")}</th>
              <th onClick={() => handleSort("CodCodicionVenta")}>CodCondVta {renderSortArrow("CodCodicionVenta")}</th>
              <th onClick={() => handleSort("CondicionVenta")}>CondiciónVenta {renderSortArrow("CondicionVenta")}</th>
              <th onClick={() => handleSort("CodVendedor")}>CodVendedor {renderSortArrow("CodVendedor")}</th>
              <th onClick={() => handleSort("Vendedor")}>Vendedor {renderSortArrow("Vendedor")}</th>
              <th onClick={() => handleSort("CodTipoCliente")}>CodTipoCliente {renderSortArrow("CodTipoCliente")}</th>
              <th onClick={() => handleSort("TipoCliente")}>TipoCliente {renderSortArrow("TipoCliente")}</th>
              <th onClick={() => handleSort("CodListaPrecio")}>CodLista {renderSortArrow("CodListaPrecio")}</th>
              <th onClick={() => handleSort("ListaPrecio")}>ListaPrecio {renderSortArrow("ListaPrecio")}</th>
              <th onClick={() => handleSort("CodDescuentoCom")}>CodDescCom {renderSortArrow("CodDescuentoCom")}</th>
              <th onClick={() => handleSort("DescuentoCom")}>DescCom {renderSortArrow("DescuentoCom")}</th>
              <th>{newValueHeader}</th>
              <th>
                Actualizar&nbsp;
                <input type="checkbox" checked={allSelected} onChange={(e) => onSelectAllChange(e.target.checked)} title="Seleccionar todos" />
              </th>
            </tr>
          </thead>
          <tbody>
            {!sortedClientes?.length ? (
              <tr><td colSpan={19} className={styles.noResults}>{loading ? "Cargando…" : "Sin resultados"}</td></tr>
            ) : (
              sortedClientes.map((cli) => {
                const isSelected = !!selectedClientesData?.[cli.CodCliente]?.isSelected;
                // Mostrar SOLO el valor global (no editable por fila)
                return (
                  <tr key={cli.CodCliente}>
                    <td>{cli.CodCliente}</td>
                    <td>{cli.RazonSocial}</td>
                    <td>{cli.Direccion}</td>
                    <td>{cli.CodZona}</td>
                    <td>{cli.Zona}</td>
                    <td>{cli.Localidad}</td>
                    <td>{cli.CodigoPostal}</td>
                    <td>{cli.CodCodicionVenta}</td>
                    <td>{cli.CondicionVenta}</td>
                    <td>{cli.CodVendedor}</td>
                    <td>{cli.Vendedor}</td>
                    <td>{cli.CodTipoCliente}</td>
                    <td>{cli.TipoCliente}</td>
                    <td>{cli.CodListaPrecio}</td>
                    <td>{cli.ListaPrecio}</td>
                    <td>{cli.CodDescuentoCom}</td>
                    <td>{cli.DescuentoCom}</td>
                    <td className={styles.editCell}>
                      <span className={globalNewValue ? "" : styles.muted}>
                        {globalNewValue || "—"}
                      </span>
                    </td>
                    <td style={{ width: 80, textAlign: "center" }}>
                      <input type="checkbox" checked={isSelected} onChange={() => onClienteToggle(cli.CodCliente)} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Logs / Errores */}
      {runLogs.length > 0 && (
        <div className={styles.logBox}>
          <div className={styles.logTitle}>Resultado de la operación</div>
          <ul className={styles.logList}>{runLogs.map((l, i) => <li key={i} className={styles.logItem}>{l}</li>)}</ul>
        </div>
      )}
      {runErrors.length > 0 && (
        <div className={styles.errorBox}>
          <div className={styles.errorTitle}>Errores detectados</div>
          <ul className={styles.errorList}>{runErrors.map((e, i) => <li key={i} className={styles.errorItem}>{e}</li>)}</ul>
        </div>
      )}

      {/* Footer en armonía con el contenedor (no sticky) */}
      <div className={styles.footerBar}>
        {importMessage ? (
          <p className={`${styles.footerMsg} ${importStatus === "ok" ? styles.ok : importStatus === "error" ? styles.error : ""}`}>
            {importMessage}
          </p>
        ) : null}
        <button
          className={styles.btnAccentFull}
          onClick={onImportarClick}
          disabled={!!isImportButtonDisabled || selectedCount === 0 || !globalNewValue}
        >
          Actualizar Clientes Seleccionados
        </button>
      </div>
    </div>
  );
}
