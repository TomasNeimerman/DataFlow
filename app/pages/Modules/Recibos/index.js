import { useEffect, useMemo, useState } from "react";
import styles from "./styles.module.css";

export default function RecibosPage() {
  const [tipos, setTipos] = useState([]);
  const [monMtca, setMonMtca] = useState([]);
  const [clientes, setClientes] = useState([]);

  const [cliente, setCliente] = useState("");
  const [fecha, setFecha] = useState("");
  const [tipoComprobante, setTipoComprobante] = useState("");
  const [monSel, setMonSel] = useState({ mon_codigo: "", mtca_codigo: "" });
  const [tc, setTc] = useState("");
  const [cheques, setCheques] = useState([]);

  const [loadingCore, setLoadingCore] = useState(true);
  const [loadingClientes, setLoadingClientes] = useState(true);
  const [err, setErr] = useState("");

  // --- NUEVO: Facturas ---
  const [facturasEnabled, setFacturasEnabled] = useState(false);
  const [facturas, setFacturas] = useState([]);           // array de facturas
  const [facturaSel, setFacturaSel] = useState("");       // valor seleccionado

  useEffect(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    setFecha(`${yyyy}-${mm}-${dd}`);
  }, []);

  // Tipos + Moneda/TC
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoadingCore(true);
        setErr("");
        if (!window?.api) { setErr("Bridge IPC no disponible."); return; }

        const [rTipos, rMon] = await Promise.all([
          window.api.recibos?.getTiposComprobante?.({ tipoFijo: "RC", circuito: "V" }),
          window.api.recibos?.getMonedas?.(),
        ]);
        if (!mounted) return;

        if (rTipos?.ok && Array.isArray(rTipos.data)) setTipos(rTipos.data);

        const monRows = rMon?.ok ? rMon.data : Array.isArray(rMon) ? rMon : [];
        setMonMtca(
          Array.isArray(monRows)
            ? monRows
                .filter(x => x?.mon_codigo != null && x?.mtca_codigo != null)
                .map(x => ({
                  mon_codigo: String(x.mon_codigo),
                  mon_descrip: String(x.mon_descrip ?? ""),
                  mtca_codigo: String(x.mtca_codigo),
                  mtca_descrip: String(x.mtca_descrip ?? ""),
                }))
            : []
        );
      } catch (e) {
        console.error(e);
        setErr("Error cargando catálogos.");
      } finally {
        if (mounted) setLoadingCore(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Clientes
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoadingClientes(true);
        let res;
        if (window.api?.traerTodos) res = await window.api.traerTodos();
        else if (window.api?.clientesForm?.traerTodos) res = await window.api.clientesForm.traerTodos();
        const data = Array.isArray(res) ? res : (res?.data ?? []);
        if (mounted) setClientes(data);
      } catch (e) {
        console.error("[Clientes] carga fallida:", e);
        if (mounted) setClientes([]);
      } finally {
        if (mounted) setLoadingClientes(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Tipo de cambio
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { mon_codigo, mtca_codigo } = monSel || {};
        if (!fecha || !mon_codigo || !mtca_codigo) { setTc(""); return; }
        if (!window?.api?.recibos?.getTipoCambio) { setTc(""); return; }
        const r = await window.api.recibos.getTipoCambio({ mon_codigo, mtca_codigo, fecha });
        if (!mounted) return;
        setTc(r?.ok && r.cotizacion != null ? String(r.cotizacion) : "");
      } catch (e) {
        console.error(e);
        if (mounted) setTc("");
      }
    })();
    return () => { mounted = false; };
  }, [monSel, fecha]);

  // --- Helpers ---
  const total = useMemo(() => {
    if (!Array.isArray(cheques) || cheques.length === 0) return 0;
    return cheques.reduce((acc, c) => acc + (Number(c.importe) || 0), 0);
  }, [cheques]);

  const totalFmt = useMemo(() => {
    if (!cheques.length) return "—";
    try {
      const curr = monSel?.mon_codigo || undefined;
      return new Intl.NumberFormat("es-AR", {
        style: curr ? "currency" : undefined,
        currency: curr,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(total);
    } catch {
      return new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(total);
    }
  }, [total, monSel, cheques.length]);

  const comboValue = (m) => `${m.mon_codigo}||${m.mtca_codigo}`;
  const parseComboValue = (v) => {
    const [mon_codigo = "", mtca_codigo = ""] = String(v || "").split("||");
    return { mon_codigo, mtca_codigo };
  };

  const readyToConfirm =
    !(loadingCore || loadingClientes) &&
    cliente && fecha && tipoComprobante &&
    monSel?.mon_codigo && monSel?.mtca_codigo && tc;

  const showFacturasUI = cliente && monSel?.mon_codigo && monSel?.mtca_codigo;

  // Descripciones actuales de moneda/tipo (para la opción contextual del select)
  const selDesc = useMemo(() => {
    const found = monMtca.find(
      m => m.mon_codigo === monSel.mon_codigo && m.mtca_codigo === monSel.mtca_codigo
    );
    return {
      mon: found?.mon_descrip || "",
      tca: found?.mtca_descrip || "",
    };
  }, [monMtca, monSel]);

  // Toggle habilitar/deshabilitar y fetch de facturas
  async function toggleFacturas() {
    if (!facturasEnabled) {
      // habilitando
      try {
        setFacturasEnabled(true);
        setFacturaSel("");
        setFacturas([]);
        const payload = {
          codcli: cliente.trim(),
          mon_codigo: monSel.mon_codigo,
          mtca_codigo: monSel.mtca_codigo,
        };
        console.log(payload)
        const r = await window.api.recibos?.getFacturas?.(payload);
        const rows = r?.ok ? (r.data || []) : Array.isArray(r) ? r : [];
        setFacturas(Array.isArray(rows) ? rows : []);
      } catch (e) {
        console.error("[Facturas] error:", e);
        setFacturas([]);
      }
    } else {
      // deshabilitando
      setFacturasEnabled(false);
      setFacturaSel("");
      setFacturas([]);
    }
  }

  // Formato helpers para la lista
  const fmtDate = (d) => {
    try { return new Date(d).toLocaleDateString("es-AR"); } catch { return d ?? ""; }
  };
  const fmtMoney = (n) => {
    try {
      return new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n) || 0);
    } catch { return n ?? ""; }
  };

  return (
    <div className={styles.pageBg}>
      <div className={styles.container}>
        <div className={styles.titleContainer}>
          <h1 className={styles.title}>Recibos</h1>
        </div>

        {err && <div className={styles.errorBox}>{err}</div>}

        <div className={styles.tab}>
          <div className={styles.formGrid}>
            {/* Cliente (Codigo - RazonSocial) */}
            <div className={styles.field}>
              <label htmlFor="cliente">Cliente</label>
              <select
                id="cliente"
                className={styles.selector}
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                disabled={loadingClientes || !clientes.length}
              >
                <option value="">{loadingClientes ? "Cargando..." : "Seleccione un cliente"}</option>
                {clientes.map((c) => (
                  <option key={c.CodCliente} value={c.CodCliente}>
                    {c.CodCliente} - {c.RazonSocial}
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
                disabled={loadingCore}
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
                disabled={loadingCore || !tipos.length}
              >
                <option value="">Seleccione tipo</option>
                {tipos.map((t) => (
                  <option key={t.tco_cod} value={t.tco_cod}>
                    {t.tco_cod} - {t.tco_desc}
                  </option>
                ))}
              </select>
            </div>

            {/* Moneda / Tipo de Cambio (combo) */}
            <div className={styles.field}>
              <label htmlFor="moneda">Moneda / Tipo de Cambio</label>
              <select
                id="moneda"
                className={styles.selector}
                value={monSel.mon_codigo && monSel.mtca_codigo ? `${monSel.mon_codigo}||${monSel.mtca_codigo}` : ""}
                onChange={(e) => setMonSel(parseComboValue(e.target.value))}
                disabled={loadingCore || !monMtca.length}
              >
                <option value="">Seleccione moneda / tipo</option>
                {monMtca.map((m, i) => (
                  <option key={`${m.mon_codigo}-${m.mtca_codigo}-${i}`} value={comboValue(m)}>
                    {m.mon_descrip} — {m.mtca_descrip}
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
                disabled={loadingCore || !monSel.mon_codigo || !monSel.mtca_codigo || !fecha}
                placeholder={!monSel.mon_codigo || !monSel.mtca_codigo || !fecha ? "Seleccione moneda/tipo y fecha" : "Cargando..."}
                readOnly
              />
            </div>

            {/* Importar Cheques */}
            <div className={styles.field}>
              <label htmlFor="archivo" className={styles.labelStrong}>
                Importar Cheques de terceros / ECheqs
              </label>
              <input id="archivo" type="file" className={styles.input} disabled={loadingCore} />
            </div>
          </div>

          {/* =================== BLOQUE FACTURAS =================== */}
          {showFacturasUI && (
            <div style={{ width: "100%", marginTop: 8 }}>
              <label className={styles.labelStrong} htmlFor="facturasSelect">Facturas</label>
              <select
                id="facturasSelect"
                className={styles.selector}
                style={{ width: "100%" }}
                value={facturaSel}
                onChange={(e) => setFacturaSel(e.target.value)}
                disabled={!facturasEnabled}
              >
                {/* Opción contextual con los datos elegidos */}
                <option value="">
                  {cliente} — {selDesc.mon} — {selDesc.tca}
                </option>

                {/* Opciones reales (si está habilitado y hubo fetch) */}
                {facturasEnabled && facturas.map((f, idx) => (
                  <option key={idx} value={f.Comprobante}>
                    {f["Fecha Emision"]} — Emisión {fmtDate(f["Fecha Emision"])} — Saldo {fmtMoney(f.Saldo)}
                  </option>
                ))}
              </select>

              <button
                className={styles.btn}
                style={{ marginTop: 8 }}
                onClick={toggleFacturas}
              >
                {facturasEnabled ? "Deshabilitar Factura" : "Habilitar Factura"}
              </button>
            </div>
          )}
          {/* ======================================================= */}

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
                    <td colSpan={5} className={styles.muted}>
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
                      <td>
                        {c.tipo
                          ? <span className={`${styles.badge} ${c.tipo === "ECH" ? styles.badgeECH : styles.badgeCHE}`}>
                              {c.tipo === "ECH" ? "ECH — ECheq" : "CHE — Cheque"}
                            </span>
                          : ""}
                      </td>
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
