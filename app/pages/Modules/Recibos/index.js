import { useEffect, useMemo, useState } from "react";
import styles from "./styles.module.css";

export default function RecibosPage() {
  // Catálogos por IPC
  const [tipos, setTipos] = useState([]);
  const [monedas, setMonedas] = useState([]);
  const [clientes, setClientes] = useState([]); // [{ CodCliente, TipoCliente }]

  // Form
  const [cliente, setCliente] = useState("");   // guarda CodCliente
  const [fecha, setFecha] = useState("");
  const [tipoComprobante, setTipoComprobante] = useState("");
  const [moneda, setMoneda] = useState("");
  const [tc, setTc] = useState("");

  // Cheques (se llenará vía importación IPC)
  const [cheques, setCheques] = useState([]);

  // UI
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Fecha por defecto (hoy)
  useEffect(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    setFecha(`${yyyy}-${mm}-${dd}`);
  }, []);

  // Cargar catálogos (solo funciones)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setErr("");

        if (!window?.api) { setErr("Bridge IPC no disponible."); return; }

        const [rTipos, rMon, rCliTodos] = await Promise.all([
          window.api.recibos?.getTiposComprobante?.({ tipoFijo: "RC", circuito: "V" }),
          window.api.recibos?.getMonedas?.(),
          window.api.clientesForm?.traerTodos?.(),
        ]);
        if (!mounted) return;
        
        if (rTipos?.ok && Array.isArray(rTipos.data)) setTipos(rTipos.data);
        if (rMon?.ok && Array.isArray(rMon.data)) setMonedas(rMon.data);
        
        // ---- Clientes: usar SOLO CodCliente y TipoCliente ----
        // rCliTodos puede venir como {ok, data} o directamente como array:
        if (!rCliTodos?.ok) {
          setClientes(rCliTodos?.data || []);
        };
        
      } catch (e) {
        console.error(e);
        setErr("Error cargando catálogos.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Traer TC (siempre por función; sin suposiciones)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!fecha || !moneda) { setTc(""); return; }
        if (!window?.api?.recibos?.getTipoCambio) { setTc(""); return; }

        const r = await window.api.recibos.getTipoCambio({ mon_codigo: moneda, fecha });
        if (!mounted) return;
        setTc(r?.ok && r.cotizacion ? String(r.cotizacion) : "");
      } catch (e) {
        console.error(e);
        if (mounted) setTc("");
      }
    })();
    return () => { mounted = false; };
  }, [moneda, fecha]);

  // Total (solo numérico; moneda la decide el select)
  const total = useMemo(() => {
    if (!Array.isArray(cheques) || cheques.length === 0) return 0;
    return cheques.reduce((acc, c) => acc + (Number(c.importe) || 0), 0);
  }, [cheques]);

  const totalFmt = useMemo(() => {
    if (!cheques.length) return "—";
    try {
      return new Intl.NumberFormat("es-AR", {
        style: moneda ? "currency" : undefined,
        currency: moneda || undefined,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(total);
    } catch {
      return new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(total);
    }
  }, [total, moneda, cheques.length]);

  const Badge = ({ tipo }) => {
    const cls = tipo === "ECH" ? `${styles.badge} ${styles.badgeECH}` : `${styles.badge} ${styles.badgeCHE}`;
    const label = tipo === "ECH" ? "ECH — ECheq" : "CHE — Cheque";
    return <span className={cls}>{label}</span>;
  };

  const readyToConfirm = !loading && cliente && fecha && tipoComprobante && moneda;
  return (
    <div className={styles.pageBg}>
      <div className={styles.container}>
        <div className={styles.titleContainer}>
          <h1 className={styles.title}>Recibos</h1>
        </div>

        {err && <div style={{ color: "#b00020", fontWeight: 700, marginBottom: 8 }}>{err}</div>}

        <div className={styles.tab}>
          <div className={styles.formGrid}>
            {/* Cliente (value = CodCliente, label = CodCliente - TipoCliente) */}
            <div className={styles.field}>
              <label htmlFor="cliente">Cliente</label>
              <select
                id="cliente"
                className={styles.selector}
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                disabled={loading || !clientes.length}
              >
                <option value="">Seleccione un cliente</option>
                {clientes.map((c) => (
                  <option key={c.CodCliente} value={c.CodCliente}>
                    {c.CodCliente} - {c.TipoCliente}
                  </option>
                ))}
              </select>
            </div>

            {/* Fecha */}
            <div className={styles.field}>
              <label htmlFor="fecha">Fecha</label>
              <input
                id="fecha"
                type="date"
                className={styles.input}
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                disabled={loading}
              />
            </div>

            {/* Tipo de Comprobante */}
            <div className={styles.field}>
              <label htmlFor="tipoComprobante">Tipo de Comprobante</label>
              <select
                id="tipoComprobante"
                className={styles.selector}
                value={tipoComprobante}
                onChange={(e) => setTipoComprobante(e.target.value)}
                disabled={loading || !tipos.length}
              >
                <option value="">Seleccione tipo</option>
                {tipos.map((t) => (
                  <option key={t.tco_cod} value={t.tco_cod}>
                    {t.tco_cod} - {t.tco_desc}
                  </option>
                ))}
              </select>
            </div>

            {/* Moneda */}
            <div className={styles.field}>
              <label htmlFor="moneda">Moneda</label>
              <select
                id="moneda"
                className={styles.selector}
                value={moneda}
                onChange={(e) => setMoneda(e.target.value)}
                disabled={loading || !monedas.length}
              >
                <option value="">Seleccione moneda</option>
                {monedas.map((m) => (
                  <option key={m.mon_codigo} value={m.mon_codigo}>
                    {m.mon_codigo} - {m.mon_descrip}
                  </option>
                ))}
              </select>
            </div>

            {/* Tipo de Cambio */}
            <div className={styles.field}>
              <label htmlFor="tc">Tipo de Cambio</label>
              <input
                id="tc"
                type="number"
                step="0.0001"
                min="0"
                className={styles.input}
                value={tc}
                onChange={(e) => setTc(e.target.value)}
                disabled={loading || !moneda}
                placeholder={moneda ? "Cargando..." : "Seleccione moneda y fecha"}
                readOnly
              />
            </div>

            {/* Importar Cheques */}
            <div className={styles.field}>
              <label htmlFor="archivo" className={styles.labelStrong}>
                Importar Cheques de terceros / ECheqs
              </label>
              <input id="archivo" type="file" className={styles.input} disabled={loading} />
            </div>
          </div>

          <button className={styles.btn} disabled={!readyToConfirm}>
            Confirmar Recibos
          </button>

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
                {cheques.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: 12, color: "#666" }}>
                      No hay cheques importados todavía.
                    </td>
                  </tr>
                ) : (
                  cheques.map((c, i) => (
                    <tr key={`${c.numero ?? i}-${i}`}>
                      <td>{c.codBanco ?? ""}</td>
                      <td>{c.banco ?? ""}</td>
                      <td>{c.numero ?? ""}</td>
                      <td className={styles.tdRight}>
                        {new Intl.NumberFormat("es-AR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        }).format(Number(c.importe) || 0)}
                      </td>
                      <td>{c.tipo ? <Badge tipo={c.tipo} /> : ""}</td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className={`${styles.tdRight} ${styles.tdTotalLabel}`}>Total</td>
                  <td className={`${styles.tdRight} ${styles.tdTotalAmount}`}>{totalFmt}</td>
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
