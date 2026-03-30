// components/Recibos/MediosSection/index.js
"use client";
import React from "react";
import styles from "../../../pages/Modules/Recibos/styles.module.css";

export default function MediosSection({
  // cheques
  file,
  onFileChange,
  cargarCheques,
  cancelarCheques,
  cheques,
  selCheques,
  setSelCheques,
  importMsg,
  chequesFormato,
  setChequesFormato,

  // totales / info
  aplicadoMedios,
  restanteVsFact,
  excedentePos,
  esReciboACuenta,
  saldoRestanteCliente,
  facturasPendienteMonto,
  cantFacturasAplicadas,
  nfmt,
  dfmt,

  // Finanzas support
  esFinanzas = false,
  movFondosSel,
  setMovFondosSel,
  optsMovFondos,

  // transferencias
  optsTransf,
  transfSel,
  setTransfSel,
  transfMonto,
  setTransfMonto,
  aplicTransf,
  addTransf,
  delTransf,

  // cajas
  optsCajas,
  cajaSel,
  setCajaSel,
  cajaMonto,
  setCajaMonto,
  aplicCajas,
  addCaja,
  delCaja,

  // aplicaciones
  optsAp,
  apSel,
  setApSel,
  apMonto,
  setApMonto,
  aplicAps,
  addAp,
  delAp,
}) {
  const esFilaTotal = (c) => {
    const a = String(c?.nroEcheq ?? "").trim().toUpperCase();
    const b = String(c?.razonSocial ?? "").trim().toUpperCase();
    return a === "TOTAL" || b === "TOTAL";
  };

  const indicesSeleccionables = (cheques || [])
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => !esFilaTotal(c))
    .map(({ i }) => i);

  const allChequesChecked =
    indicesSeleccionables.length > 0 &&
    indicesSeleccionables.every((i) => selCheques.has(i));

  const toggleAllCheques = (e) => {
    if (!indicesSeleccionables.length) return;
    if (e.target.checked) setSelCheques(new Set(indicesSeleccionables));
    else setSelCheques(new Set());
  };

  const labelNro = chequesFormato === "CHE" ? "Nro Cheque" : "Nro Echeq";
  const labelHist = chequesFormato === "CHE" ? "Estado / Obs." : "Historial de Endosos";
  const labelFecha = chequesFormato === "CHE" ? "Fecha de Pago" : "Fecha Vencimiento";

  return (
    <div className={styles.tabInner}>
      {/* HEADER CON INFO (mejorado - "Valores" en lugar de "Aplicado") */}
      <div className={styles.saldoHeader}>
        <div className={styles.favorRow}>
          {!esReciboACuenta && (
            <>
              <span>
                <strong>Saldo Restante:</strong> $ {nfmt(saldoRestanteCliente)}
              </span>
              <span>·</span>
            </>
          )}

          {!esReciboACuenta && (
            <>
              {facturasPendienteMonto > 0 ? (
                <span>
                  <strong>Facturas a pagar:</strong> $ {nfmt(facturasPendienteMonto)}
                </span>
              ) : (
                <span className={styles.parenGreen}>
                  <strong>Facturas a pagar</strong> (a favor): $ {nfmt(excedentePos)}
                </span>
              )}
              <span>·</span>
              <span>
                <strong>Cant. facturas:</strong> {cantFacturasAplicadas}
              </span>
            </>
          )}
        </div>

        <div>
          <strong>Total Valores:</strong> $ {nfmt(aplicadoMedios)} ·{" "}
          {esReciboACuenta ? (
            <>
              Saldo Total: <strong>$ {nfmt(saldoRestanteCliente)}</strong>
            </>
          ) : (
            <>
              Restante:{" "}
              <strong className={restanteVsFact < 0 ? styles.saldoFavor : ""}>
                $ {nfmt(restanteVsFact)}
              </strong>
            </>
          )}
        </div>
      </div>

      {/* MOVIMIENTOS DE FONDOS (solo Finanzas) */}
      {esFinanzas && (
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>Movimiento de Fondos</span>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.filtersGrid}>
              <div className={styles.filterItem}>
                <label className={styles.label}>Tipo de Movimiento</label>
                <select
                  className={styles.select}
                  value={movFondosSel}
                  onChange={(e) => setMovFondosSel(e.target.value)}
                >
                  <option value="">(Seleccione)</option>
                  {(optsMovFondos || []).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================= Cheques / ECheqs ======================= */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>Cheques / ECheqs</span>
        </div>

        <div className={styles.cardBody}>
          <div className={styles.filtersGrid}>
            <div className={styles.filterItem}>
              <label className={styles.label}>Tipo</label>
              <select
                className={styles.select}
                value={chequesFormato || ""}
                onChange={(e) => {
                  cancelarCheques();
                  setChequesFormato(e.target.value);
                }}
              >
                <option value="">(Seleccione)</option>
                <option value="ECH">ECheqs</option>
                <option value="CHE">Cheques físicos</option>
              </select>
            </div>

            <div className={styles.filterItem}>
              <label className={styles.label}>Archivo</label>
              <input
                type="file"
                className={styles.input}
                onChange={onFileChange}
                disabled={!chequesFormato}
                accept=".xlsx, .xls"
              />
            </div>

            <div className={styles.filterItem}>
              <label className={styles.label}>&nbsp;</label>
              <button
                className={styles.btn}
                onClick={cargarCheques}
                disabled={!chequesFormato || !file}
              >
                Cargar
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

          {!chequesFormato && (
            <div className={styles.muted}>Seleccioná el tipo de cheques para habilitar la carga.</div>
          )}

          {importMsg && <div className={styles.muted}>{importMsg}</div>}

          {cheques?.length > 0 && (
            <div className={`${styles.cardBody} ${styles.tableContainer}`}>
              <table className={styles.table}>
                <thead className={styles.headerRow}>
                  <tr>
                    <th className={styles.checkCell}>
                      <input
                        type="checkbox"
                        checked={allChequesChecked}
                        onChange={toggleAllCheques}
                        title="Seleccionar todos"
                      />
                    </th>
                    <th>{labelNro}</th>
                    <th>Razón Social</th>
                    <th>{labelHist}</th>
                    <th>{labelFecha}</th>
                    <th className={styles.tdRight}>Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {cheques.map((c, i) => {
                    const isTotal = esFilaTotal(c);
                    return (
                      <tr
                        key={i}
                        className={`${styles.row} ${isTotal ? styles.rowTotal : ""}`}
                      >
                        <td className={styles.checkCell}>
                          <input
                            type="checkbox"
                            checked={selCheques.has(i)}
                            onChange={(e) => {
                              const newSel = new Set(selCheques);
                              if (e.target.checked) newSel.add(i);
                              else newSel.delete(i);
                              setSelCheques(newSel);
                            }}
                            disabled={isTotal}
                          />
                        </td>
                        <td className={isTotal ? styles.fontBold : ""}>
                          {c.nroEcheq || c.nroCheque || "-"}
                        </td>
                        <td className={isTotal ? styles.fontBold : ""}>
                          {c.razonSocial || "-"}
                        </td>
                        <td className={styles.muted}>
                          {c.historialEndosos || c.estado || "-"}
                        </td>
                        <td className={styles.muted}>
                          {dfmt(c.fechaVencimiento || c.fechaPago || "")}
                        </td>
                        <td className={`${styles.tdRight} ${isTotal ? styles.fontBold : ""}`}>
                          $ {nfmt(Number(c.importe || 0))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ======================= Transferencias ======================= */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>Transferencias Bancarias</span>
        </div>

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

      {/* ======================= Cajas ======================= */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>Cajas</span>
        </div>

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

      {/* ======================= Aplicaciones ======================= */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>Aplicaciones (Apps/Plataformas)</span>
        </div>

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