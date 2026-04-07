// app/components/Recibos/MediosSection/index.js
// ✅ VERSIÓN ÓPTIMA: Sin headers en Transferencias, Cajas y Aplicaciones

"use client";

import React, { useMemo, useState } from "react";
import styles from "../../../pages/Modules/Recibos/styles.module.css";
import PaginationBar from "../../PaginationBar";

export default function MediosSection({
  seleccionadoFacturas,
  saldoMostrado,
  chequesFormato,
  setChequesFormato,
  file,
  onFileChange,
  cheques,
  selCheques,
  setSelCheques,
  importMsg,
  setImportMsg,
  cargarCheques,
  cancelarCheques,
  chequesAplicados,
  setChequesAplicados,
  optsTransf,
  transfSel,
  setTransfSel,
  transfMonto,
  setTransfMonto,
  aplicTransf,
  addTransf,
  delTransf,
  optsCajas,
  cajaSel,
  setCajaSel,
  cajaMonto,
  setCajaMonto,
  aplicCajas,
  addCaja,
  delCaja,
  optsAp,
  apSel,
  setApSel,
  apMonto,
  setApMonto,
  aplicAps,
  addAp,
  delAp,
  nfmt,
  dfmt,
  aplicadoMedios,
}) {
  const [chequesTab, setChequesTab] = useState("ech");
  const [chequesPage, setChequesPage] = useState(1);
  const [chequesPageSize, setChequesPageSize] = useState(15);

  // Calcular cheques paginados
  const chequesPaginados = useMemo(() => {
    const start = (chequesPage - 1) * chequesPageSize;
    const end = start + chequesPageSize;
    return cheques.slice(start, end);
  }, [cheques, chequesPage, chequesPageSize]);

  // Calcular suma de cheques seleccionados
  const totalChequesSeleccionados = useMemo(() => {
    let suma = 0;
    selCheques.forEach((idx) => {
      if (cheques[idx]) suma += Number(cheques[idx].importe) || 0;
    });
    return suma;
  }, [cheques, selCheques]);

  // Función para agregar cheques seleccionados a medios de cobro
  const handleAgregarCheques = () => {
    if (selCheques.size === 0) return;

    const chequesSeleccionados = Array.from(selCheques).map((idx) => cheques[idx]);
    const nuevoMedio = {
      id: `chq-${Date.now()}`,
      cantidad: selCheques.size,
      monto: totalChequesSeleccionados,
      cheques: chequesSeleccionados,
    };

    setChequesAplicados((prev) => [...prev, nuevoMedio]);
    setSelCheques(new Set()); // Limpiar selección
    setChequesPage(1); // Resetear paginación
  };

  // ═══════════════════════════════════════════════════════════════
  // HANDLER: Cambiar tab + Validar archivo
  // ═══════════════════════════════════════════════════════════════
  async function handleTabClick(tabKey) {
    // NO llamar a cancelarCheques() para mantener los excels cargados
    // Solo cambiar la tab sin limpiar
    setChequesTab(tabKey);
    setImportMsg(""); // Solo limpiar mensaje
    // NO resetear chequesFormato para mantener el estado
  }

  // ═══════════════════════════════════════════════════════════════
  // HANDLER: Validar archivo cuando se selecciona
  // ═══════════════════════════════════════════════════════════════
  async function handleFileChangeWithValidation(e) {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setImportMsg("");

    try {
      const XLSX = await import("xlsx");
      const buf = await selectedFile.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sh = wb.SheetNames[0];
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sh], { defval: "" });

      if (!rows.length) {
        alert("⚠️ El archivo está vacío.");
        return;
      }

      const norm = (s) =>
        String(s || "")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/\s+/g, " ")
          .trim();

      const headers = new Set(Object.keys(rows[0] || {}).map(norm));
      const esFisico = headers.has(norm("Nro de Cheque")) || 
                       headers.has(norm("Firmante/Emisor")) || 
                       headers.has(norm("Cod. Banco"));
      const formatoDetectado = esFisico ? "CHE" : "ECH";

      const tabEsperado = chequesTab === "ech" ? "ECH" : "CHE";
      
      if (formatoDetectado !== tabEsperado) {
        alert(
          `❌ ERROR: Estás en la tab "${chequesTab === "ech" ? "ECheqs" : "Cheques Físicos"}" ` +
          `pero cargaste un archivo de ${formatoDetectado === "ECH" ? "ECheqs" : "Cheques Físicos"}.\n\n` +
          `Por favor, selecciona el archivo correcto o cambia a la tab correspondiente.`
        );
        e.target.value = "";
        return;
      }

      onFileChange(e);
      setChequesFormato(formatoDetectado);
    } catch (error) {
      console.error("Error validando archivo:", error);
      alert("⚠️ Error al validar el archivo. Verifica que sea un Excel válido.");
      e.target.value = "";
    }
  }

  const esReciboACuenta = Number(seleccionadoFacturas || 0) <= 0;
  const saldoRestanteCliente = Number(saldoMostrado || 0);
  const restanteVsFact = saldoRestanteCliente - Number(aplicadoMedios || 0);

  return (
    <div>
      {/* ==================== CHEQUES / ECHEQS CON TABS ==================== */}
      <div className={styles.card}>
        <div className={styles.cardBody}>
          <div className={styles.toggleContainer}>
            <button
              className={`${styles.toggleButton} ${chequesTab === "ech" ? styles.active : ""}`}
              onClick={() => handleTabClick("ech")}
            >
              ECheqs
            </button>
            <button
              className={`${styles.toggleButton} ${chequesTab === "che" ? styles.active : ""}`}
              onClick={() => handleTabClick("che")}
            >
              Cheques Físicos
            </button>
          </div>

          {chequesTab === "ech" && (
            <>
              <div className={styles.filtersGrid}>
                <div className={styles.filterItem}>
                  <label className={styles.label}>Archivo ECheqs</label>
                  <input
                    type="file"
                    className={styles.input}
                    onChange={handleFileChangeWithValidation}
                    accept=".xlsx, .xls"
                  />
                </div>

                <div className={styles.filterItem}>
                  <label className={styles.label}>&nbsp;</label>
                  <button
                    className={styles.btn}
                    onClick={cargarCheques}
                    disabled={!file || chequesFormato !== "ECH"}
                  >
                    Cargar ECheqs
                  </button>
                </div>

                <div className={styles.filterItem}>
                  <label className={styles.label}>&nbsp;</label>
                  <button
                    className={styles.btn}
                    onClick={cancelarCheques}
                    disabled={!cheques?.length}
                  >
                    Cancelar
                  </button>
                </div>
              </div>

              {importMsg && (
                <div className={styles.muted}>{importMsg}</div>
              )}

              {cheques && cheques.length > 0 && chequesFormato === "ECH" && (
                <>
                  <div className={styles.chequesTableContainer}>
                    <table className={styles.table}>
                      <thead>
                        <tr className={styles.headerRow}>
                          <th style={{ width: "40px" }}>Sel</th>
                          <th>Nro ECheq</th>
                          <th>Razón Social</th>
                          <th>Endosos</th>
                          <th>Vencimiento</th>
                          <th>Importe</th>
                        </tr>
                      </thead>
                      <tbody>
                        {chequesPaginados.map((c, i) => {
                          const idx = (chequesPage - 1) * chequesPageSize + i;
                          return (
                            <tr key={idx} className={styles.row}>
                              <td style={{ textAlign: "center" }}>
                                <input
                                  type="checkbox"
                                  checked={selCheques.has(idx)}
                                  onChange={() => {
                                    const n = new Set(selCheques);
                                    n.has(idx) ? n.delete(idx) : n.add(idx);
                                    setSelCheques(n);
                                  }}
                                />
                              </td>
                              <td>{c?.nroEcheq ?? ""}</td>
                              <td>{c?.razonSocial ?? ""}</td>
                              <td>{c?.historialEndosos ?? ""}</td>
                              <td>{c?.fechaVencimiento ? dfmt(c.fechaVencimiento) : ""}</td>
                              <td className={styles.tdRight}>$ {nfmt(c?.importe ?? 0)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {selCheques.size > 0 && (
                    <div
                      style={{
                        position: "sticky",
                        bottom: 0,
                        padding: "16px",
                        backgroundColor: "#fff",
                        borderTop: "2px solid #e82c02",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        zIndex: 20,
                        boxShadow: "0 -2px 8px rgba(0,0,0,0.1)",
                      }}
                    >
                      <div style={{ fontSize: "0.95rem", fontWeight: "500", color: "#333" }}>
                        {selCheques.size} cheque{selCheques.size !== 1 ? "s" : ""} seleccionado{selCheques.size !== 1 ? "s" : ""} • Total: <strong style={{ color: "#e82c02", fontSize: "1.1rem" }}>$ {nfmt(totalChequesSeleccionados)}</strong>
                      </div>
                      <button
                        className={styles.btn}
                        style={{
                          background: "#e82c02",
                          color: "#fff",
                          padding: "10px 24px",
                          fontSize: "0.95rem",
                          fontWeight: "600",
                        }}
                        onClick={handleAgregarCheques}
                      >
                        ➕ Agregar Cheques
                      </button>
                    </div>
                  )}

                  <PaginationBar
                    totalRows={cheques.length}
                    page={chequesPage}
                    pageSize={chequesPageSize}
                    onPageChange={(newPage) => setChequesPage(newPage)}
                    onPageSizeChange={(newSize) => {
                      setChequesPageSize(newSize);
                      setChequesPage(1);
                    }}
                    pageSizeOptions={[15, 30, 60, 90, 120]}
                    labels={{ items: "cheques" }}
                  />
                </>
              )}

              {(!cheques || cheques.length === 0) && (
                <div className={styles.muted}>
                  Sin ECheqs cargados. Selecciona un archivo y haz clic en "Cargar ECheqs".
                </div>
              )}
            </>
          )}

          {chequesTab === "che" && (
            <>
              <div className={styles.filtersGrid}>
                <div className={styles.filterItem}>
                  <label className={styles.label}>Archivo Cheques Físicos</label>
                  <input
                    type="file"
                    className={styles.input}
                    onChange={handleFileChangeWithValidation}
                    accept=".xlsx, .xls"
                  />
                </div>

                <div className={styles.filterItem}>
                  <label className={styles.label}>&nbsp;</label>
                  <button
                    className={styles.btn}
                    onClick={cargarCheques}
                    disabled={!file || chequesFormato !== "CHE"}
                  >
                    Cargar Cheques
                  </button>
                </div>

                <div className={styles.filterItem}>
                  <label className={styles.label}>&nbsp;</label>
                  <button
                    className={styles.btn}
                    onClick={cancelarCheques}
                    disabled={!cheques?.length}
                  >
                    Cancelar
                  </button>
                </div>
              </div>

              {importMsg && (
                <div className={styles.muted}>{importMsg}</div>
              )}

              {cheques && cheques.length > 0 && chequesFormato === "CHE" && (
                <>
                  <div className={styles.chequesTableContainer}>
                    <table className={styles.table}>
                      <thead>
                        <tr className={styles.headerRow}>
                          <th style={{ width: "40px" }}>Sel</th>
                          <th>Nro de Cheque</th>
                          <th>Fecha de Pago</th>
                          <th>Importe</th>
                          <th>Firmante/Emisor</th>
                          <th>CUIT Librador</th>
                          <th>Cod. Banco</th>
                          <th>Estado Firma</th>
                          <th>Observaciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {chequesPaginados.map((c, i) => {
                          const idx = (chequesPage - 1) * chequesPageSize + i;
                          return (
                            <tr key={idx} className={styles.row}>
                              <td style={{ textAlign: "center" }}>
                                <input
                                  type="checkbox"
                                  checked={selCheques.has(idx)}
                                  onChange={() => {
                                    const n = new Set(selCheques);
                                    n.has(idx) ? n.delete(idx) : n.add(idx);
                                    setSelCheques(n);
                                  }}
                                />
                              </td>
                              <td>{c?.nroEcheq ?? ""}</td>
                              <td>{c?.fechaVencimiento ? dfmt(c.fechaVencimiento) : ""}</td>
                              <td className={styles.tdRight}>$ {nfmt(c?.importe ?? 0)}</td>
                              <td>{c?.razonSocial ?? ""}</td>
                              <td>{c?.cuitLibrador ?? ""}</td>
                              <td>{c?.codBanco ?? ""}</td>
                              <td>{c?.estadoFirma ?? ""}</td>
                              <td>{c?.observaciones ?? ""}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {selCheques.size > 0 && (
                    <div
                      style={{
                        position: "sticky",
                        bottom: 0,
                        padding: "16px",
                        backgroundColor: "#fff",
                        borderTop: "2px solid #e82c02",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        zIndex: 20,
                        boxShadow: "0 -2px 8px rgba(0,0,0,0.1)",
                      }}
                    >
                      <div style={{ fontSize: "0.95rem", fontWeight: "500", color: "#333" }}>
                        {selCheques.size} cheque{selCheques.size !== 1 ? "s" : ""} seleccionado{selCheques.size !== 1 ? "s" : ""} • Total: <strong style={{ color: "#e82c02", fontSize: "1.1rem" }}>$ {nfmt(totalChequesSeleccionados)}</strong>
                      </div>
                      <button
                        className={styles.btn}
                        style={{
                          background: "#e82c02",
                          color: "#fff",
                          padding: "10px 24px",
                          fontSize: "0.95rem",
                          fontWeight: "600",
                        }}
                        onClick={handleAgregarCheques}
                      >
                        ➕ Agregar Cheques
                      </button>
                    </div>
                  )}

                  <PaginationBar
                    totalRows={cheques.length}
                    page={chequesPage}
                    pageSize={chequesPageSize}
                    onPageChange={(newPage) => setChequesPage(newPage)}
                    onPageSizeChange={(newSize) => {
                      setChequesPageSize(newSize);
                      setChequesPage(1);
                    }}
                    pageSizeOptions={[15, 30, 60, 90, 120]}
                    labels={{ items: "cheques" }}
                  />
                </>
              )}

              {(!cheques || cheques.length === 0) && (
                <div className={styles.muted}>
                  Sin cheques físicos cargados. Selecciona un archivo y haz clic en "Cargar Cheques".
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ==================== CHEQUES AGREGADOS ==================== */}
      {chequesAplicados?.length > 0 && (
        <div className={styles.card}>
          <button className={styles.cardHeader} type="button">
            <span className={styles.cardTitle}>✓ Cheques Agregados ({chequesAplicados.length})</span>
          </button>

          <div className={styles.cardBody}>
            {/* Agrupar por tipo */}
            {(() => {
              const porTipo = { ECH: [], CHE: [] };
              chequesAplicados.forEach((medio) => {
                const tipo = medio.cheques?.[0]?.tipoCheque;
                if (tipo === "ECH") porTipo.ECH.push(medio);
                else if (tipo === "CHE") porTipo.CHE.push(medio);
              });

              return (
                <>
                  {/* ECheqs */}
                  {porTipo.ECH.length > 0 && (
                    <>
                      <div style={{ marginBottom: "12px", paddingBottom: "12px", borderBottom: "1px solid #eee" }}>
                        <ul className={styles.listSimple} style={{ marginBottom: 0 }}>
                          {porTipo.ECH.map((medio, i) => {
                            const numeros = medio.cheques?.map((c) => c.nroEcheq).join(", ") || "";
                            const fechas = medio.cheques?.map((c) => c.fechaVencimiento === "INVALID_DATE" ? "Sin Fecha" : (c.fechaVencimiento ? dfmt(c.fechaVencimiento) : "Sin Fecha")).join(", ") || "";
                            return (
                              <li key={medio.id}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", gap: "12px" }}>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: "0.9rem", fontWeight: "500", marginBottom: "2px" }}>
                                      {numeros}
                                    </div>
                                    <div style={{ fontSize: "0.85rem", color: "#666" }}>
                                      Vencimiento: {fechas} • {medio.cantidad} ECheq{medio.cantidad !== 1 ? "s" : ""} • <strong>$ {nfmt(medio.monto)}</strong>
                                    </div>
                                  </div>
                                  <button
                                    className={styles.smallBtn}
                                    onClick={() => {
                                      setChequesAplicados((prev) => prev.filter((m) => m.id !== medio.id));
                                    }}
                                  >
                                    Quitar
                                  </button>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    </>
                  )}

                  {/* Cheques Físicos */}
                  {porTipo.CHE.length > 0 && (
                    <>
                      <div style={{ marginBottom: "12px" }}>
                        <ul className={styles.listSimple} style={{ marginBottom: 0 }}>
                          {porTipo.CHE.map((medio, i) => {
                            const numeros = medio.cheques?.map((c) => c.nroEcheq).join(", ") || "";
                            const fechas = medio.cheques?.map((c) => c.fechaVencimiento === "INVALID_DATE" ? "Sin Fecha" : (c.fechaVencimiento ? dfmt(c.fechaVencimiento) : "Sin Fecha")).join(", ") || "";
                            return (
                              <li key={medio.id}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", gap: "12px" }}>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: "0.9rem", fontWeight: "500", marginBottom: "2px" }}>
                                      {numeros}
                                    </div>
                                    <div style={{ fontSize: "0.85rem", color: "#666" }}>
                                      Vencimiento: {fechas} • {medio.cantidad} Cheque Físico{medio.cantidad !== 1 ? "s" : ""} • <strong>$ {nfmt(medio.monto)}</strong>
                                    </div>
                                  </div>
                                  <button
                                    className={styles.smallBtn}
                                    onClick={() => {
                                      setChequesAplicados((prev) => prev.filter((m) => m.id !== medio.id));
                                    }}
                                  >
                                    Quitar
                                  </button>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    </>
                  )}
                </>
              );
            })()}

            <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #ddd", textAlign: "right" }}>
              <strong>Total Cheques: $ {nfmt(chequesAplicados.reduce((sum, m) => sum + m.monto, 0))}</strong>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TRANSFERENCIAS ==================== */}
      <div className={styles.card}>
        <div className={styles.cardBody}>
          <div className={styles.filtersGrid}>
            <div className={styles.filterItem}>
              <label className={styles.label}>Cuenta</label>
              <select
                className={styles.select}
                value={transfSel}
                onChange={(e) => setTransfSel(e.target.value)}
              >
                <option value="">(Seleccione)</option>
                {(optsTransf || []).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.filterItem}>
              <label className={styles.label}>Monto</label>
              <input
                className={styles.input}
                type="number"
                step="0.01"
                value={transfMonto}
                onFocus={(e) => {
                  if ((e.target.value || "") === "0") e.target.select();
                }}
                onChange={(e) => setTransfMonto(e.target.value)}
              />
            </div>

            <div className={styles.filterItem}>
              <label className={styles.label}>&nbsp;</label>
              <button
                className={styles.btn}
                onClick={addTransf}
                disabled={!transfSel || !transfMonto}
              >
                Agregar
              </button>
            </div>
          </div>

          {aplicTransf?.length > 0 && (
            <ul className={styles.listSimple}>
              {aplicTransf.map((t, i) => (
                <li key={i}>
                  <span>{t.label}</span> <strong>$ {nfmt(t.monto)}</strong>{" "}
                  <button className={styles.smallBtn} onClick={() => delTransf(i)}>
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ==================== CAJAS ==================== */}
      <div className={styles.card}>
        <div className={styles.cardBody}>
          <div className={styles.filtersGrid}>
            <div className={styles.filterItem}>
              <label className={styles.label}>Caja</label>
              <select
                className={styles.select}
                value={cajaSel}
                onChange={(e) => setCajaSel(e.target.value)}
              >
                <option value="">(Seleccione)</option>
                {(optsCajas || []).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.filterItem}>
              <label className={styles.label}>Monto</label>
              <input
                className={styles.input}
                type="number"
                step="0.01"
                value={cajaMonto}
                onFocus={(e) => {
                  if ((e.target.value || "") === "0") e.target.select();
                }}
                onChange={(e) => setCajaMonto(e.target.value)}
              />
            </div>

            <div className={styles.filterItem}>
              <label className={styles.label}>&nbsp;</label>
              <button
                className={styles.btn}
                onClick={addCaja}
                disabled={!cajaSel || !cajaMonto}
              >
                Agregar
              </button>
            </div>
          </div>

          {aplicCajas?.length > 0 && (
            <ul className={styles.listSimple}>
              {aplicCajas.map((t, i) => (
                <li key={i}>
                  <span>{t.label}</span> <strong>$ {nfmt(t.monto)}</strong>{" "}
                  <button className={styles.smallBtn} onClick={() => delCaja(i)}>
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ==================== APLICACIONES ==================== */}
      <div className={styles.card}>
        <div className={styles.cardBody}>
          <div className={styles.filtersGrid}>
            <div className={styles.filterItem}>
              <label className={styles.label}>Aplicación</label>
              <select
                className={styles.select}
                value={apSel}
                onChange={(e) => setApSel(e.target.value)}
              >
                <option value="">(Seleccione)</option>
                {(optsAp || []).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.filterItem}>
              <label className={styles.label}>Monto</label>
              <input
                className={styles.input}
                type="number"
                step="0.01"
                value={apMonto}
                onFocus={(e) => {
                  if ((e.target.value || "") === "0") e.target.select();
                }}
                onChange={(e) => setApMonto(e.target.value)}
              />
            </div>

            <div className={styles.filterItem}>
              <label className={styles.label}>&nbsp;</label>
              <button
                className={styles.btn}
                onClick={addAp}
                disabled={!apSel || !apMonto}
              >
                Agregar
              </button>
            </div>
          </div>

          {aplicAps?.length > 0 && (
            <ul className={styles.listSimple}>
              {aplicAps.map((t, i) => (
                <li key={i}>
                  <span>{t.label}</span> <strong>$ {nfmt(t.monto)}</strong>{" "}
                  <button className={styles.smallBtn} onClick={() => delAp(i)}>
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}