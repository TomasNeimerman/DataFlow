import React from "react";


export default function ChequesSection({
  styles,
  nfmt,
  dfmt,
  file,
  onFileChange,
  cargarCheques,
  cancelarCheques,
  importMsg,
  cheques,
  selCheques,
  setSelCheques,
  allChequesChecked,
  toggleAllCheques,
}) {
  return (
    <div className={styles.card}>
      <button className={styles.cardHeader}>
        <span className={styles.cardTitle}>Cheques / ECheqs</span>
      </button>
      <div className={styles.cardBody}>
        <div className={styles.filtersGrid}>
          <div className={styles.filterItem}>
            <label className={styles.label}>Archivo</label>
            <input type="file" className={styles.input} onChange={onFileChange} />
          </div>
          <div className={styles.filterItem}>
            <label className={styles.label}>&nbsp;</label>
            <button className={styles.btn} onClick={cargarCheques} disabled={!file}>
              Cargar
            </button>
          </div>
          <div className={styles.filterItem}>
            <label className={styles.label}>&nbsp;</label>
            <button className={styles.smallBtn} onClick={cancelarCheques} disabled={!cheques.length}>
              Cancelar
            </button>
          </div>
        </div>
        {importMsg && <div className={styles.muted}>{importMsg}</div>}

        <div className={styles.tableContainer} style={{ marginTop: 8 }}>
          <table className={styles.table}>
            <thead className={styles.headerRow}>
              <tr>
                <th className={styles.checkCell}>
                  <input type="checkbox" checked={allChequesChecked} disabled={!cheques.length} onChange={toggleAllCheques} />
                </th>
                <th>Nro Echeq</th>
                <th>Razón Social</th>
                <th>Historial de Endosos</th>
                <th>Fecha Vencimiento</th>
                <th className={styles.tdRight}>Importe</th>
              </tr>
            </thead>
            <tbody>
              {!cheques?.length ? (
                <tr>
                  <td className={styles.noResults} colSpan={6}>
                    No hay cheques importados todavía.
                  </td>
                </tr>
              ) : (
                cheques.map((c, i) => (
                  <tr key={`${c.nroEcheq || i}-${i}`} className={styles.row}>
                    <td className={styles.checkCell}>
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
                    </td>
                    <td>{c.nroEcheq}</td>
                    <td>{c.razonSocial}</td>
                    <td>{c.historialEndosos}</td>
                    <td>{c.fechaVencimiento ? dfmt(c.fechaVencimiento) : ""}</td>
                    <td className={styles.tdRight}>$ {nfmt(c.importe)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
