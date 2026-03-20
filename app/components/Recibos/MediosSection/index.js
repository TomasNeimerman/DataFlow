"use client";
import React from "react";
import styles from "../../../pages/Modules/Recibos/styles.module.css"; // ✅ ruta correcta desde pages/components/...

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

  // ✅ NUEVO: formato seleccionado
  chequesFormato,          // "ECH" | "CHE" | ""
  setChequesFormato,       // setter desde la página

  // header info
  aplicadoMedios,
  restanteVsFact,
  excedentePos,
  esReciboACuenta,
  saldoRestanteCliente,
  facturasPendienteMonto,
  cantFacturasAplicadas,

  // helpers
  nfmt,
  dfmt,

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
  // ===== TOTAL no seleccionable + "seleccionar todos" sin TOTAL =====
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

  // labels según formato (solo texto)
  const labelNro = chequesFormato === "CHE" ? "Nro Cheque" : "Nro Echeq";
  const labelHist = chequesFormato === "CHE" ? "Estado / Obs." : "Historial de Endosos";
  const labelFecha = chequesFormato === "CHE" ? "Fecha de Pago" : "Fecha Vencimiento";

  return (
    <div className={styles.tabInner}>
      {/* ===== Header saldo ===== */}
      <div className={styles.saldoHeader}>
        <div className={styles.favorRow}>
          <span>
            <strong>Saldo Restante:</strong> $ {nfmt(saldoRestanteCliente)}
          </span>

          {!esReciboACuenta && (
            <>
              <span>·</span>

              {facturasPendienteMonto > 0 ? (
                <span>
                  <strong>Facturas a pagar:</strong> $ {nfmt(facturasPendienteMonto)}
                </span>
              ) : (
                <span className={styles.parenGreen}>
                  <strong>Facturas a pagar</strong> (a favor): {nfmt(excedentePos)}
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
          Aplicado: <strong>$ {nfmt(aplicadoMedios)}</strong> ·{" "}
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

      {/* ======================= Cheques ======================= */}
      <div className={styles.card}>
        <button className={styles.cardHeader} type="button">
          <span className={styles.cardTitle}>Cheques / ECheqs</span>
        </button>

        <div className={styles.cardBody}>
          <div className={styles.filtersGrid}>
            {/* ✅ NUEVO: selector de tipo */}
            <div className={styles.filterItem}>
              <label className={styles.label}>Tipo</label>
              <select
                className={styles.select}
                value={chequesFormato || ""}
                onChange={(e) => {
                  // cambio de tipo => limpío cheques + archivo (para evitar mezcla)
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
              <button className={styles.btn} onClick={cancelarCheques} disabled={!cheques?.length}>
                Cancelar
              </button>
            </div>
          </div>

          {!chequesFormato && (
            <div className={styles.muted}>Seleccioná el tipo de cheques para habilitar la carga.</div>
          )}

          {importMsg && <div className={styles.muted}>{importMsg}</div>}

          {/* Tabla SOLO si hay cheques importados */}
          {!!cheques?.length && (
            <div className={styles.tableContainer} style={{ marginTop: 8 }}>
              <table className={styles.table}>
                <thead className={styles.headerRow}>
                  <tr>
                    <th className={styles.checkCell}>
                      <input
                        type="checkbox"
                        checked={allChequesChecked}
                        disabled={!indicesSeleccionables.length}
                        onChange={toggleAllCheques}
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
                  {cheques.map((c, i) => (
                    <tr key={`${c?.nroEcheq || i}-${i}`} className={styles.row}>
                      <td className={styles.checkCell}>
                        {!esFilaTotal(c) && (
                          <input
                            type="checkbox"
                            checked={selCheques.has(i)}
                            onChange={(e) => {
                              const next = new Set(selCheques);
                              if (e.target.checked) next.add(i);
                              else next.delete(i);
                              setSelCheques(next);
                            }}
                          />
                        )}
                      </td>

                      <td>{c?.nroEcheq ?? ""}</td>
                      <td>{c?.razonSocial ?? ""}</td>
                      <td>{c?.historialEndosos ?? ""}</td>
                      <td>{c?.fechaVencimiento ? dfmt(c.fechaVencimiento) : ""}</td>
                      <td className={styles.tdRight}>$ {nfmt(c?.importe ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ======================= Transferencias ======================= */}
      <div className={styles.card}>
        <button className={styles.cardHeader} type="button">
          <span className={styles.cardTitle}>Transferencias bancarias</span>
        </button>

        <div className={styles.cardBody}>
          <div className={styles.filtersGrid}>
            <div className={styles.filterItem}>
              <label className={styles.label}>Cuenta</label>
              <select className={styles.select} value={transfSel} onChange={(e) => setTransfSel(e.target.value)}>
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
              <button className={styles.btn} onClick={addTransf} disabled={!transfSel || !transfMonto}>
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
        <button className={styles.cardHeader} type="button">
          <span className={styles.cardTitle}>Cajas</span>
        </button>

        <div className={styles.cardBody}>
          <div className={styles.filtersGrid}>
            <div className={styles.filterItem}>
              <label className={styles.label}>Caja</label>
              <select className={styles.select} value={cajaSel} onChange={(e) => setCajaSel(e.target.value)}>
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
              <button className={styles.btn} onClick={addCaja} disabled={!cajaSel || !cajaMonto}>
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
        <button className={styles.cardHeader} type="button">
          <span className={styles.cardTitle}>Aplicaciones</span>
        </button>

        <div className={styles.cardBody}>
          <div className={styles.filtersGrid}>
            <div className={styles.filterItem}>
              <label className={styles.label}>Aplicación</label>
              <select className={styles.select} value={apSel} onChange={(e) => setApSel(e.target.value)}>
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
              <button className={styles.btn} onClick={addAp} disabled={!apSel || !apMonto}>
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