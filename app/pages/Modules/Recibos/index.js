import { useEffect, useMemo, useState } from "react";
import styles from "./styles.module.css";

export default function Recibos() {
  // Estado UI
  const [cliente, setCliente] = useState("");
  const [fecha, setFecha] = useState("");
  const [tipoComprobante] = useState("RC");
  const [moneda, setMoneda] = useState("ARS");
  const [tc, setTc] = useState("1.0000"); // TC por defecto (ARS=1)

  // Setear fecha del día al montar
  useEffect(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    setFecha(`${yyyy}-${mm}-${dd}`);
  }, []);

  // Datos de ejemplo (5 cheques)
  const CHEQUES_EJEMPLO = useMemo(
    () => [
      { codBanco: "143", banco: "Banco Macro",   numero: "00012345", importe: 120000.5, tipo: "ECH" },
      { codBanco: "011", banco: "Banco Nación",  numero: "98765432", importe:  85000.0, tipo: "CHE" },
      { codBanco: "007", banco: "Banco Galicia", numero: "55566677", importe: 150000.0, tipo: "CHE" },
      { codBanco: "017", banco: "BBVA",          numero: "11223344", importe:  92000.75, tipo: "ECH" },
      { codBanco: "072", banco: "Santander",     numero: "22334455", importe:  70000.0, tipo: "CHE" },
    ],
    []
  );

  // Habilitar/deshabilitar TC según moneda
  const tcDisabled = moneda === "ARS";

  useEffect(() => {
    if (moneda === "ARS") {
      setTc("1.0000");
    } else {
      // si venía en 0 o vacío, dale un valor “seguro”
      if (!(parseFloat(tc) > 0)) setTc("1000.0000");
    }
  }, [moneda]); // eslint-disable-line react-hooks/exhaustive-deps

  const currencyFmt = (value, currency) =>
    new Intl.NumberFormat("es-AR", { style: "currency", currency }).format(value);

  // Filas + total (conversión por TC si aplica)
  const { filas, total } = useMemo(() => {
    const tcn = Math.max(parseFloat(tc || "1"), 0.0000001); // evitar /0
    let sum = 0;

    const rows = CHEQUES_EJEMPLO.map((c) => {
      const importeConv = moneda === "ARS" ? c.importe : c.importe / tcn;
      sum += importeConv;
      return {
        ...c,
        importeConv,
        importeFmt: currencyFmt(importeConv, moneda),
      };
    });

    return { filas: rows, total: sum };
  }, [CHEQUES_EJEMPLO, moneda, tc]);

  const badge = (tipo) => {
    const text = tipo === "ECH" ? "ECH — ECheq" : "CHE — Cheque";
    const cls  = tipo === "ECH" ? styles.badgeECH : styles.badgeCHE;
    return <span className={`${styles.badge} ${cls}`}>{text}</span>;
  };

  return (
    <div className={styles.pageBg}>
      <div className={styles.container}>
        <div className={styles.titleContainer}>
          <h1 className={styles.title}>Recibos</h1>
        </div>

        <div className={styles.tab}>
          {/* Grid de formulario */}
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label htmlFor="cliente">Cliente</label>
              <select
                id="cliente"
                className={styles.selector}
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
              >
                <option value="">Seleccione un cliente</option>
                <option value="1">Cliente 1</option>
                <option value="2">Cliente 2</option>
              </select>
            </div>

            <div className={styles.field}>
              <label htmlFor="fecha">Fecha</label>
              <input
                id="fecha"
                type="date"
                className={styles.input}
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="tipoComprobante">Tipo de Comprobante</label>
              <select
                id="tipoComprobante"
                className={styles.select}
                value={tipoComprobante}
                onChange={() => {}}
              >
                <option value="RC">RC - Recibo</option>
              </select>
            </div>

            <div className={styles.field}>
              <label htmlFor="moneda">Moneda</label>
              <select
                id="moneda"
                className={styles.select}
                value={moneda}
                onChange={(e) => setMoneda(e.target.value)}
              >
                <option value="ARS">ARS - Peso Argentino</option>
                <option value="USD">USD - Dólar</option>
                <option value="EUR">EUR - Euro</option>
              </select>
            </div>

            <div className={styles.field}>
              <label htmlFor="tc">Tipo de Cambio</label>
              <input
                id="tc"
                type="number"
                step="0.0001"
                min="0"
                className={styles.input}
                value={tc}
                disabled={tcDisabled}
                onChange={(e) => setTc(e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="archivo" className={styles.labelStrong}>
                Importar Cheques de terceros / ECheqs
              </label>
              <input id="archivo" type="file" className={styles.input} />
            </div>
          </div>

          {/* Acciones */}
          <button className={styles.btn}>Confirmar Recibos</button>

          {/* Previsualización */}
          <h2 className={styles.subtitle}>Previsualización de cheques</h2>
          <div className={styles.tableResponsive}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Código de Banco</th>
                  <th>Nombre de Banco</th>
                  <th>Número de Cheque</th>
                  <th className={styles.thRight}>Importe</th>
                  <th>Tipo de Cheque</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((c, i) => (
                  <tr key={`${c.numero}-${i}`}>
                    <td>{c.codBanco}</td>
                    <td>{c.banco}</td>
                    <td>{c.numero}</td>
                    <td className={styles.tdRight}>{c.importeFmt}</td>
                    <td>{badge(c.tipo)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className={`${styles.tdRight} ${styles.tdTotalLabel}`}>
                    Total
                  </td>
                  <td className={`${styles.tdRight} ${styles.tdTotalAmount}`}>
                    {currencyFmt(total, moneda)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
