"use client";

import styles from "./styles.module.css";

export default function Resultados({
  resultados = [],
  cliDetalle = null, // { hasDefi1, hasDefi2, labelDefi1, labelDefi2, ... }
}) {
  const money = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return "0,00";
    return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <>
      <div className={styles.titleWrap}>
        <h2 className={styles.title}>Resultados de la actualización</h2>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr className={styles.headerRow}>
              <th>Lista</th><th>Cod.Gen</th><th>Ele1</th><th>Ele2</th><th>Ele3</th>
              <th className={styles.num}>Precio Anterior</th>
              <th className={`${styles.num} ${styles.priceNew}`}>Precio Nuevo</th>
              <th>Fecha Mod.</th>
            </tr>
          </thead>
          <tbody>
            {Array.isArray(resultados) && resultados.length > 0 ? (
              resultados.map((r, i) => (
                <tr key={i} className={styles.row}>
                  <td>{r.lprdlp_Cod}</td>
                  <td>{r.lprart_CodGen}</td>
                  <td>{r.lprart_CodEle1 || ""}</td>
                  <td>{r.lprart_CodEle2 || ""}</td>
                  <td>{r.lprart_CodEle3 || ""}</td>
                  <td className={styles.num}>{money(r.PrecioAnterior)}</td>
                  <td className={`${styles.num} ${styles.priceNew}`}>{money(r.PrecioNuevo)}</td>
                  <td>{r.FechaModStr || ""}</td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={8} className={styles.noResults}>No hay resultados para mostrar aún.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ===== Detalle de asignación a clientes ===== */}
      {cliDetalle && (
        <>
          <div className={styles.titleWrap} style={{ marginTop: 16 }}>
            <h2 className={styles.title}>Última asignación de listas a clientes</h2>
          </div>

          <p className={styles.tabNote} style={{ marginTop: 4 }}>
            Se aplicó la lista destino <strong>{cliDetalle.toList}</strong>
            {cliDetalle.fromList ? <> a clientes de la lista <strong>{cliDetalle.fromList}</strong></> : null}.
            {" "}Total actualizados: <strong>{cliDetalle.count}</strong>
            {" "}(modo: {cliDetalle.filtros?.modo}).
          </p>

          <p className={styles.info} style={{ marginTop: 4 }}>
            {cliDetalle.filtros?.lista ? <>Lista actual: <strong>{cliDetalle.filtros.lista}</strong> | </> : null}
            {cliDetalle.filtros?.vendedor ? <>Vendedor: <strong>{cliDetalle.filtros.vendedor.cod} - {cliDetalle.filtros.vendedor.desc}</strong> | </> : null}
            {cliDetalle.filtros?.distribucion ? <>{cliDetalle.labelDefi1}: <strong>{cliDetalle.filtros.distribucion.cod} - {cliDetalle.filtros.distribucion.desc}</strong> | </> : null}
            {cliDetalle.filtros?.canal ? <>{cliDetalle.labelDefi2}: <strong>{cliDetalle.filtros.canal.cod} - {cliDetalle.filtros.canal.desc}</strong></> : null}
          </p>

          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr className={styles.headerRow}>
                  <th>Cliente</th>
                  <th>Zona</th>
                  <th>Vendedor</th>
                  <th>Tipo</th>
                  {cliDetalle.hasDefi1 && <th>{cliDetalle.labelDefi1}</th>}
                  {cliDetalle.hasDefi2 && <th>{cliDetalle.labelDefi2}</th>}
                  <th>Lista destino</th>
                </tr>
              </thead>
              <tbody>
                {cliDetalle.items?.length ? (
                  cliDetalle.items.map((it, i) => (
                    <tr key={`${it.cli_cod}-${i}`} className={styles.row}>
                      <td>{it.cli_cod}</td>
                      <td>{it.zona}</td>
                      <td>{it.vendedor}</td>
                      <td>{it.tipo}</td>
                      {cliDetalle.hasDefi1 && <td>{it.distribucion}</td>}
                      {cliDetalle.hasDefi2 && <td>{it.canal}</td>}
                      <td>{cliDetalle.toList}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5 + (cliDetalle.hasDefi1?1:0) + (cliDetalle.hasDefi2?1:0)} className={styles.noResults}>
                      Sin ítems para mostrar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {(cliDetalle.items?.length ?? 0) < (cliDetalle.count ?? 0) && (
            <p className={styles.info} style={{ marginTop: 6 }}>
              Mostrando {cliDetalle.items?.length ?? 0} de {cliDetalle.count ?? 0} actualizados.
            </p>
          )}
        </>
      )}
    </>
  );
}
