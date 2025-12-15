"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./styles.module.css";
import edit from "../../../public/icons/edit.png";

export default function RecibosPage() {
  // ===== Catálogos
  const [tipos, setTipos] = useState([]);
  const [monMtca, setMonMtca] = useState([]);
  const [tcEditables, setTcEditables] = useState([]); // mon_codigos editables

  // ===== Clientes
  const [clientes, setClientes] = useState([]);
  const [loadingClientes, setLoadingClientes] = useState(true);

  // ===== Form principal
  const [cliente, setCliente] = useState(""); // CodCliente
  const [fecha, setFecha] = useState("");
  const [tipoComprobante, setTipoComprobante] = useState("");

  // Moneda/TipoCambio combinados
  const [monSel, setMonSel] = useState({ mon_codigo: "", mtca_codigo: "" });

  // Tipo de cambio (puede ser editable según moneda)
  const [tc, setTc] = useState("");
  const [tcEditable, setTcEditable] = useState(false);
  const tcInputRef = useRef(null);

  // Saldo cliente (auto)
  const [saldoCliente, setSaldoCliente] = useState(null);

  // ===== UI y errores
  const [loadingCore, setLoadingCore] = useState(true);
  const [err, setErr] = useState("");

  // ===== Tabs y undock
  const [activeTab, setActiveTab] = useState("facturas"); // "facturas" | "cheques"
  const [isDetached, setIsDetached] = useState(false);
  const [fpMax, setFpMax] = useState(false);
  const [fpPos, setFpPos] = useState({ x: 60, y: 60 });
  const [fpSize, setFpSize] = useState({ w: 840, h: 520 });

  // ===== Facturas
  const [facturasStatus, setFacturasStatus] = useState("idle"); // idle | loading | ready | error
  const [facturas, setFacturas] = useState([]);
  const [facturaSel, setFacturaSel] = useState(""); // guarda el Comprobante elegido
  const [facturaObj, setFacturaObj] = useState(null); // guarda el objeto completo

  // ===== Cheques
  const [cheques, setCheques] = useState([]);
  const [seleccionados, setSeleccionados] = useState(new Set());
  const [file, setFile] = useState(null);
  const [importMsg, setImportMsg] = useState("");

  // ===== Otros métodos (transferencias, cajas, aplicaciones)
  const [optsTransf, setOptsTransf] = useState([]);
  const [optsCajas, setOptsCajas] = useState([]);
  const [optsApl, setOptsApl] = useState([]);

  const [selTransf, setSelTransf] = useState("");
  const [montoTransf, setMontoTransf] = useState("");
  const [transfUsadas, setTransfUsadas] = useState([]); // [{id,label,monto}]

  const [selCaja, setSelCaja] = useState("");
  const [montoCaja, setMontoCaja] = useState("");
  const [cajasUsadas, setCajasUsadas] = useState([]);

  const [selApl, setSelApl] = useState("");
  const [montoApl, setMontoApl] = useState("");
  const [aplUsadas, setAplUsadas] = useState([]);

  // ================== Helpers ==================
  const fmtDate = (d) => {
    try { return new Date(d).toLocaleDateString("es-AR"); } catch { return d ?? ""; }
  };
  const fmtMoney = (n) => {
    try { return new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n) || 0); }
    catch { return n ?? ""; }
  };
  const comboValue = (m) => `${m.mon_codigo}||${m.mtca_codigo}`;
  const parseComboValue = (v) => {
    const [mon_codigo = "", mtca_codigo = ""] = String(v || "").split("||");
    return { mon_codigo, mtca_codigo };
  };
  const prereqOK = !!(cliente && monSel.mon_codigo && monSel.mtca_codigo && tc);
  const readyToConfirm =
    !(loadingCore || loadingClientes) &&
    cliente && fecha && tipoComprobante &&
    monSel?.mon_codigo && monSel?.mtca_codigo && tc;

  // ================== Defaults ==================
  useEffect(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    setFecha(`${yyyy}-${mm}-${dd}`);
  }, []);

  // ================== Carga catálogos ==================
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoadingCore(true);
        setErr("");
        if (!window?.api) { setErr("Bridge IPC no disponible."); return; }

        const [rTipos, rMon, rEdit] = await Promise.all([
          window.api.recibos?.getTiposComprobante?.({ tipoFijo: "RC", circuito: "V" }),
          window.api.recibos?.getMonedas?.(),           // mon + mtca
          window.api.recibos?.getMonedasTcEditables?.() // monedas NO locales
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

        const arr = rEdit?.ok ? (rEdit.data || []) : Array.isArray(rEdit) ? rEdit : [];
        setTcEditables(arr.map(String));
      } catch (e) {
        console.error(e);
        setErr("Error cargando catálogos.");
      } finally {
        if (mounted) setLoadingCore(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // ================== Carga clientes ==================
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

  // ================== Traer TC según selección ==================
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { mon_codigo, mtca_codigo } = monSel || {};
        if (!fecha || !mon_codigo || !mtca_codigo) { setTc(""); setTcEditable(false); return; }
        if (!window?.api?.recibos?.getTipoCambio) { setTc(""); setTcEditable(false); return; }

        const r = await window.api.recibos.getTipoCambio({ mon_codigo, mtca_codigo, fecha });
        if (!mounted) return;
        setTc(r?.ok && r.cotizacion != null ? String(r.cotizacion) : "");
        setTcEditable(false);
      } catch (e) {
        console.error(e);
        if (mounted) { setTc(""); setTcEditable(false); }
      }
    })();
    return () => { mounted = false; };
  }, [monSel, fecha]);

  // ================== Traer saldo cliente automático ==================
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!cliente || !monSel.mon_codigo || !monSel.mtca_codigo) { setSaldoCliente(null); return; }
        const r = await window.api.recibos?.getSaldoCliente?.({
          codcli: cliente,
          mon_codigo: monSel.mon_codigo,
          mtca_codigo: monSel.mtca_codigo
        });
        if (!mounted) return;
        const v = r?.ok ? r?.saldo : r?.saldo;
        setSaldoCliente(v != null ? Number(v) : 0);
      } catch (e) {
        console.error("[Saldo cliente] error", e);
        if (mounted) setSaldoCliente(0);
      }
    })();
    return () => { mounted = false; };
  }, [cliente, monSel.mon_codigo, monSel.mtca_codigo]);

  // ================== Traer facturas cuando hay Cliente + TC ==================
  useEffect(() => {
    let mounted = true;

    if (!cliente || !tc) {
      setFacturasStatus("idle");
      setFacturas([]);
      setFacturaSel("");
      setFacturaObj(null);
      return () => {};
    }

    (async () => {
      try {
        setFacturasStatus("loading");
        setFacturas([]);
        setFacturaSel("");
        setFacturaObj(null);

        const payload = {
          codcli: cliente,
          mon_codigo: monSel.mon_codigo,
          mtca_codigo: monSel.mtca_codigo,
        };
        const r = await window.api.recibos?.getFacturas?.(payload);
        const rows = r?.ok ? (r.data || []) : Array.isArray(r) ? r : [];
        if (!mounted) return;
        setFacturas(Array.isArray(rows) ? rows : []);
        setFacturasStatus("ready");
      } catch (e) {
        console.error("[Facturas] error:", e);
        if (mounted) {
          setFacturas([]);
          setFacturasStatus("error");
        }
      }
    })();

    return () => { mounted = false; };
  }, [cliente, tc, monSel.mon_codigo, monSel.mtca_codigo]);

  // ================== Cargar catálogos de métodos ==================
  useEffect(() => {
    (async () => {
      try {
        const [rT, rC, rA] = await Promise.all([
          window.api.recibos?.getTransferenciasBancarias?.(),
          window.api.recibos?.getCajas?.(),
          window.api.recibos?.getAplicaciones?.()
        ]);
        const toLabel = (t) => t?.Moneda ? `${t.Moneda}` : "";
        setOptsTransf((rT?.ok ? rT.data : rT) ?.map(t => ({
          id: `${t.CodBanco}|${t.NroCuenta}`,
          label: `[${t.CodBanco}] ${t.Banco} — ${t.Cuenta} (${toLabel(t)})`
        })) || []);
        setOptsCajas((rC?.ok ? rC.data : rC) ?.map(c => ({
          id: String(c.CodCaja),
          label: `${c.Caja} (${c.Moneda})`
        })) || []);
        setOptsApl((rA?.ok ? rA.data : rA) ?.map(a => ({
          id: String(a.CodCaja),
          label: `${a.Caja} (${a.Moneda})`
        })) || []);
      } catch (e) {
        console.error("[Métodos] error", e);
        setOptsTransf([]); setOptsCajas([]); setOptsApl([]);
      }
    })();
  }, []);

  // ================== Importar cheques ==================
  function onFileChange(e) {
    setImportMsg("");
    setFile(e.target.files?.[0] ?? null);
  }

  function mapRowToCheque(row) {
    const hasECH =
      Object.prototype.hasOwnProperty.call(row, "Numero de ECHEQ") &&
      Object.prototype.hasOwnProperty.call(row, "CMC7") &&
      Object.prototype.hasOwnProperty.call(row, "Banco Emisión") &&
      Object.prototype.hasOwnProperty.call(row, "Importe");

    if (hasECH) {
      const cmc7 = String(row["CMC7"] ?? "");
      const codBanco = cmc7.slice(0, 3) || "";
      return {
        codBanco,
        banco: String(row["Banco Emisión"] ?? ""),
        numero: String(row["Numero de ECHEQ"] ?? ""),
        importe: Number(row["Importe"] ?? 0) || 0,
        tipo: "ECH",
      };
    }

    const numero = row["Número de Cheque"] ?? row["Numero de Cheque"] ?? row["Nro Cheque"] ?? row["Cheque"];
    const cod = row["Código de Banco"] ?? row["Codigo de Banco"] ?? row["CodBanco"] ?? row["Cod Banco"];
    const banco = row["Nombre de Banco"] ?? row["Banco"];
    const importe = row["Importe"];

    if (numero != null && importe != null && (cod != null || banco != null)) {
      return {
        codBanco: String(cod ?? ""),
        banco: String(banco ?? ""),
        numero: String(numero ?? ""),
        importe: Number(importe ?? 0) || 0,
        tipo: "CHE",
      };
    }
    return null;
  }

  async function cargarCheques() {
    try {
      setImportMsg("");
      if (!file) { setImportMsg("Seleccioná un archivo Excel primero."); return; }
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.SheetNames[0];
      const json = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { defval: "" });

      const mapped = json.map(mapRowToCheque).filter(Boolean);
      if (!mapped.length) {
        setImportMsg("No se detectaron cheques válidos en la planilla.");
        setCheques([]);
        setSeleccionados(new Set());
        return;
      }
      setCheques(mapped);
      setSeleccionados(new Set()); // arranca sin seleccionar
      setImportMsg(`Se importaron ${mapped.length} cheque(s).`);
      setActiveTab("cheques");
    } catch (e) {
      console.error("[Import Cheques] error:", e);
      setImportMsg("Error al procesar el archivo. Verificá la plantilla.");
    }
  }

  // ================== Sumas ==================
  const sumaChequesSel = useMemo(() => {
    if (!cheques.length || seleccionados.size === 0) return 0;
    let sum = 0;
    seleccionados.forEach(idx => { sum += Number(cheques[idx]?.importe) || 0; });
    return sum;
  }, [cheques, seleccionados]);

  const sumaOtros = useMemo(() => {
    const s1 = transfUsadas.reduce((a, x) => a + (Number(x.monto) || 0), 0);
    const s2 = cajasUsadas.reduce((a, x) => a + (Number(x.monto) || 0), 0);
    const s3 = aplUsadas.reduce((a, x) => a + (Number(x.monto) || 0), 0);
    return s1 + s2 + s3;
  }, [transfUsadas, cajasUsadas, aplUsadas]);

  const aplicado = sumaChequesSel + sumaOtros;
  const saldoMax = Number(saldoCliente ?? 0) || 0;
  const restante = saldoMax - aplicado;
  const restanteFmt = useMemo(
    () => new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(restante),
    [restante]
  );

  // ================== Guardar métodos ==================
  const addTransf = () => {
    if (!selTransf || !montoTransf) return;
    setTransfUsadas(prev => [...prev, { id: selTransf, label: optsTransf.find(o => o.id === selTransf)?.label || selTransf, monto: Number(montoTransf) || 0 }]);
    setSelTransf(""); setMontoTransf("");
  };
  const addCaja = () => {
    if (!selCaja || !montoCaja) return;
    setCajasUsadas(prev => [...prev, { id: selCaja, label: optsCajas.find(o => o.id === selCaja)?.label || selCaja, monto: Number(montoCaja) || 0 }]);
    setSelCaja(""); setMontoCaja("");
  };
  const addApl = () => {
    if (!selApl || !montoApl) return;
    setAplUsadas(prev => [...prev, { id: selApl, label: optsApl.find(o => o.id === selApl)?.label || selApl, monto: Number(montoApl) || 0 }]);
    setSelApl(""); setMontoApl("");
  };

  // ================== Confirmar ==================
  function onConfirmar() {
    if (!readyToConfirm) return;

    if (saldoMax > 0 && aplicado < saldoMax) {
      const ok = window.confirm(
        "EL importe total de los valores recibidos es menor que las facturas aplicadas ¿Desea emitir el recibo y que la diferencia genere un saldo a favor del cliente?"
      );
      if (!ok) {
        setSeleccionados(new Set());
        return;
      }
      // TODO: lógica de saldo a favor
    }
    // TODO: emitir recibo
  }

  // ================== Drag para el panel flotante ==================
  const headerDragRef = useRef(null);
  useEffect(() => {
    if (!isDetached) return;
    const el = headerDragRef.current;
    if (!el) return;

    let startX = 0, startY = 0, originX = 0, originY = 0;
    const onDown = (e) => {
      const ev = e.touches?.[0] || e;
      startX = ev.clientX; startY = ev.clientY;
      originX = fpPos.x; originY = fpPos.y;
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
      document.addEventListener("touchmove", onMove, { passive: false });
      document.addEventListener("touchend", onUp);
    };
    const onMove = (e) => {
      const ev = e.touches?.[0] || e;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      setFpPos({ x: originX + dx, y: originY + dy });
      e.preventDefault?.();
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onUp);
    };

    el.addEventListener("mousedown", onDown);
    el.addEventListener("touchstart", onDown, { passive: true });
    return () => {
      el.removeEventListener("mousedown", onDown);
      el.removeEventListener("touchstart", onDown);
    };
  }, [isDetached, fpPos.x, fpPos.y]);

  // ================== Render ==================
  return (
    <div className={styles.pageBg}>
      <div className={styles.container}>
        <div className={styles.titleContainer}>
          <h1 className={styles.title}>Recibos</h1>
        </div>

        {err && <div className={styles.errorBox}>{err}</div>}

        {/* ===== Filtros superiores ===== */}
        <div className={styles.tab}>
          <div className={styles.formGrid}>
            {/* 1) Tipo de Comprobante */}
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

            {/* 2) Fecha */}
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

            {/* 3) Cliente */}
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

            {/* === Orden inferior: Moneda/Tipo ➜ Tipo de Cambio ➜ Saldo === */}

            {/* A) Moneda / Tipo de Cambio (combo) */}
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

            {/* B) Tipo de Cambio (con lápiz editable si es no-local) */}
            <div className={`${styles.field} ${tcEditable ? styles.editing : ""}`}>
              <label htmlFor="tc">Tipo de Cambio</label>
              <div className={styles.tcWrapper}>
                <input
                  id="tc"
                  ref={tcInputRef}
                  type="number"
                  step="0.0001"
                  min="0"
                  className={`${styles.input} ${tcEditable ? styles.tcEditable : ""}`}
                  value={tc}
                  onChange={(e) => setTc(e.target.value)}
                  disabled={loadingCore || !monSel.mon_codigo || !monSel.mtca_codigo || !fecha || !tcEditable}
                  placeholder={!monSel.mon_codigo || !monSel.mtca_codigo || !fecha ? "Seleccione moneda/tipo y fecha" : ""}
                />
                <button
                  type="button"
                  className={`${styles.tcEditBtn} ${(!tcEditables.includes(String(monSel.mon_codigo)) || !prereqOK) ? styles.tcEditBtnDisabled : ""}`}
                  disabled={!tcEditables.includes(String(monSel.mon_codigo)) || !prereqOK}
                  onClick={() => {
                    if (!tcEditables.includes(String(monSel.mon_codigo))) return;
                    setTcEditable((v) => {
                      const nv = !v;
                      if (nv) setTimeout(() => tcInputRef.current?.focus(), 0);
                      return nv;
                    });
                  }}
                >
                  <img src={edit.src ?? edit} alt="Editar" className={styles.tcEditImg} />
                </button>
              </div>
              {tcEditable && <span className={styles.tcHint}>Editando TC manualmente</span>}
            </div>

            {/* C) Saldo del cliente (auto) */}
            <div className={styles.field}>
              <label htmlFor="saldo">Saldo del cliente</label>
              <input
                id="saldo"
                className={styles.input}
                value={saldoCliente == null ? "" : `$ ${fmtMoney(saldoCliente)}`}
                readOnly
                placeholder="—"
              />
            </div>
          </div>
        </div>

        {/* ===== Tabs + botones de undock (cuando está acoplado) ===== */}
        <div className={styles.tabsShell}>
          <div className={styles.tabsHeaderRow}>
            <div className={styles.toggleContainer}>
              <button
                className={`${styles.toggleButton} ${activeTab === "facturas" ? styles.active : ""}`}
                onClick={() => setActiveTab("facturas")}
              >
                Facturas
              </button>
              <button
                className={`${styles.toggleButton} ${activeTab === "cheques" ? styles.active : ""}`}
                onClick={() => setActiveTab("cheques")}
              >
                Facturas a aplicar
              </button>
            </div>

            {activeTab === "cheques" && !isDetached && (
              <div className={styles.tabWinBtns}>
                <button
                  className={styles.winBtn}
                  title="Desacoplar"
                  onClick={() => {
                    setIsDetached(true);
                    setFpMax(false);
                    setFpPos({ x: 60, y: 60 });
                    setFpSize({ w: 840, h: 520 });
                  }}
                >—</button>
                <button
                  className={styles.winBtn}
                  title="Desacoplar y maximizar"
                  onClick={() => { setIsDetached(true); setFpMax(true); }}
                >□</button>
                <button
                  className={`${styles.winBtn} ${styles.winBtnDanger}`}
                  title="Desacoplar"
                  onClick={() => { setIsDetached(true); setFpMax(false); }}
                >✕</button>
              </div>
            )}
          </div>

          <div className={styles.tabsContent}>
            {activeTab === "facturas" ? (
              <div className={styles.tabInner}>
                {!prereqOK ? (
                  <div className={styles.muted}>
                    Elegí <strong>Cliente</strong> y asegurate de tener <strong>Tipo de Cambio</strong> cargado.
                  </div>
                ) : (
                  <>
                    <label className={styles.labelStrong} htmlFor="facturasSelect">Facturas</label>
                    <select
                      id="facturasSelect"
                      className={styles.selector}
                      style={{ width: "100%" }}
                      value={facturaSel}
                      onChange={(e) => {
                        const comp = e.target.value;
                        setFacturaSel(comp);
                        const obj = facturas.find(f => f.Comprobante === comp) || null;
                        setFacturaObj(obj);
                      }}
                      disabled={facturasStatus !== "ready" || !facturas.length}
                    >
                      <option value="">
                        {facturasStatus === "loading"
                          ? "Cargando facturas…"
                          : facturas.length ? "Seleccione una factura" : "No hay facturas con saldo"}
                      </option>
                      {facturasStatus === "ready" &&
                        facturas.map((f, idx) => (
                          <option key={idx} value={f.Comprobante}>
                            {f.Comprobante} — Emisión {fmtDate(f["Fecha Emision"])} — Original {fmtMoney(f["Importe Original"])} — Saldo {fmtMoney(f.Saldo)}
                          </option>
                        ))}
                    </select>

                    {facturasStatus === "error" && (
                      <div className={styles.errorBox} style={{ marginTop: 8 }}>
                        No se pudieron obtener las facturas para la combinación seleccionada.
                      </div>
                    )}

                    {facturaObj && (
                      <div className={styles.muted} style={{ marginTop: 8 }}>
                        Factura elegida: <strong>{facturaObj.Comprobante}</strong> — Saldo <strong>{fmtMoney(facturaObj.Saldo)}</strong>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className={styles.tabInner}>
                {/* Si está desacoplado, mostramos un aviso liviano acá */}
                {isDetached ? (
                  <div className={styles.muted}>La pestaña “Facturas a aplicar” está abierta como panel flotante.</div>
                ) : (
                  <ValoresPanel
                    styles={styles}
                    // header saldo
                    saldoMax={saldoMax}
                    aplicado={aplicado}
                    restante={restante}
                    restanteFmt={restanteFmt}
                    // cheques
                    cheques={cheques}
                    seleccionados={seleccionados}
                    setSeleccionados={setSeleccionados}
                    onFileChange={onFileChange}
                    cargarCheques={cargarCheques}
                    importMsg={importMsg}
                    // otros métodos
                    optsTransf={optsTransf}
                    optsCajas={optsCajas}
                    optsApl={optsApl}
                    selTransf={selTransf} setSelTransf={setSelTransf} montoTransf={montoTransf} setMontoTransf={setMontoTransf} transfUsadas={transfUsadas} setTransfUsadas={setTransfUsadas} addTransf={addTransf}
                    selCaja={selCaja} setSelCaja={setSelCaja} montoCaja={montoCaja} setMontoCaja={setMontoCaja} cajasUsadas={cajasUsadas} setCajasUsadas={setCajasUsadas} addCaja={addCaja}
                    selApl={selApl} setSelApl={setSelApl} montoApl={montoApl} setMontoApl={setMontoApl} aplUsadas={aplUsadas} setAplUsadas={setAplUsadas} addApl={addApl}
                  />
                )}
              </div>
            )}
          </div>
        </div>

        <button className={styles.btn} disabled={!readyToConfirm} style={{ marginTop: 12 }} onClick={onConfirmar}>
          Confirmar Recibos
        </button>
      </div>

      {/* ===== Panel flotante (cuando está desacoplado) ===== */}
      {isDetached && (
        <div
          className={styles.floatingPanel}
          style={{
            position: "fixed",
            left: fpMax ? 12 : fpPos.x,
            top: fpMax ? 12 : fpPos.y,
            width: fpMax ? "calc(100vw - 24px)" : fpSize.w,
            height: fpMax ? "calc(100vh - 24px)" : fpSize.h,
            zIndex: 9999
          }}
        >
          <div className={styles.fpHeader} ref={headerDragRef}>
            <span className={styles.fpTitle}>Facturas a aplicar</span>
            <div className={styles.fpWinBtns}>
              <button onClick={() => setFpMax(false)}>—</button>
              <button onClick={() => setFpMax((v) => !v)}>□</button>
              <button
                onClick={() => { setIsDetached(false); setActiveTab("cheques"); }}
                className={styles.winBtnDanger}
              >✕</button>
            </div>
          </div>
          <div className={styles.fpBody}>
            <ValoresPanel
              styles={styles}
              // header saldo
              saldoMax={saldoMax}
              aplicado={aplicado}
              restante={restante}
              restanteFmt={restanteFmt}
              // cheques
              cheques={cheques}
              seleccionados={seleccionados}
              setSeleccionados={setSeleccionados}
              onFileChange={onFileChange}
              cargarCheques={cargarCheques}
              importMsg={importMsg}
              // otros métodos
              optsTransf={optsTransf}
              optsCajas={optsCajas}
              optsApl={optsApl}
              selTransf={selTransf} setSelTransf={setSelTransf} montoTransf={montoTransf} setMontoTransf={setMontoTransf} transfUsadas={transfUsadas} setTransfUsadas={setTransfUsadas} addTransf={addTransf}
              selCaja={selCaja} setSelCaja={setSelCaja} montoCaja={montoCaja} setMontoCaja={setMontoCaja} cajasUsadas={cajasUsadas} setCajasUsadas={setCajasUsadas} addCaja={addCaja}
              selApl={selApl} setSelApl={setSelApl} montoApl={montoApl} setMontoApl={setMontoApl} aplUsadas={aplUsadas} setAplUsadas={setAplUsadas} addApl={addApl}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ===== Subcomponente: Panel de valores (cheques + métodos) ===== */
function ValoresPanel(props) {
  const {
    styles,
    saldoMax, aplicado, restante, restanteFmt,
    cheques, seleccionados, setSeleccionados,
    onFileChange, cargarCheques, importMsg,
    // otros métodos
    optsTransf, optsCajas, optsApl,
    selTransf, setSelTransf, montoTransf, setMontoTransf, transfUsadas, setTransfUsadas, addTransf,
    selCaja, setSelCaja, montoCaja, setMontoCaja, cajasUsadas, setCajasUsadas, addCaja,
    selApl, setSelApl, montoApl, setMontoApl, aplUsadas, setAplUsadas, addApl,
  } = props;

  return (
    <>
      {/* Header saldo */}
      <div className={styles.saldoHeader}>
        <div><strong>Saldo Disponible:</strong> $ {new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(saldoMax)}</div>
        <div>Aplicado: <strong>$ {new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(aplicado)}</strong> · Restante: <strong className={restante >= 0 ? styles.saldoOk : styles.saldoBad}>$ {restanteFmt}</strong></div>
      </div>

      {/* Transferencias */}
      <Accordion title="Transferencias bancarias">
        <div className={styles.filtersGrid}>
          <div className={styles.filterItem}>
            <label className={styles.label}>Cuenta</label>
            <select className={styles.select} value={selTransf} onChange={e=>setSelTransf(e.target.value)}>
              <option value="">(Seleccione)</option>
              {optsTransf.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
          <div className={styles.filterItem}>
            <label className={styles.label}>Monto</label>
            <input className={styles.select} type="number" step="0.01" value={montoTransf} onChange={e=>setMontoTransf(e.target.value)} />
          </div>
          <div className={styles.filterItem}>
            <button className={styles.smallBtn} onClick={addTransf}>Agregar</button>
          </div>
        </div>

        {!!transfUsadas.length && (
          <ul style={{ marginTop: 8 }}>
            {transfUsadas.map((t, i) => (
              <li key={`${t.id}-${i}`}>
                {t.label} — <strong>$ {new Intl.NumberFormat("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2}).format(t.monto)}</strong>
                <button className={styles.smallBtn} style={{ marginLeft: 8 }} onClick={() => setTransfUsadas(prev => prev.filter((_,k)=>k!==i))}>Quitar</button>
              </li>
            ))}
          </ul>
        )}
      </Accordion>

      {/* Cajas */}
      <Accordion title="Cajas">
        <div className={styles.filtersGrid}>
          <div className={styles.filterItem}>
            <label className={styles.label}>Caja</label>
            <select className={styles.select} value={selCaja} onChange={e=>setSelCaja(e.target.value)}>
              <option value="">(Seleccione)</option>
              {optsCajas.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
          <div className={styles.filterItem}>
            <label className={styles.label}>Monto</label>
            <input className={styles.select} type="number" step="0.01" value={montoCaja} onChange={e=>setMontoCaja(e.target.value)} />
          </div>
          <div className={styles.filterItem}>
            <button className={styles.smallBtn} onClick={addCaja}>Agregar</button>
          </div>
        </div>

        {!!cajasUsadas.length && (
          <ul style={{ marginTop: 8 }}>
            {cajasUsadas.map((t, i) => (
              <li key={`${t.id}-${i}`}>
                {t.label} — <strong>$ {new Intl.NumberFormat("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2}).format(t.monto)}</strong>
                <button className={styles.smallBtn} style={{ marginLeft: 8 }} onClick={() => setCajasUsadas(prev => prev.filter((_,k)=>k!==i))}>Quitar</button>
              </li>
            ))}
          </ul>
        )}
      </Accordion>

      {/* Aplicaciones varias */}
      <Accordion title="Aplicaciones">
        <div className={styles.filtersGrid}>
          <div className={styles.filterItem}>
            <label className={styles.label}>Aplicación</label>
            <select className={styles.select} value={selApl} onChange={e=>setSelApl(e.target.value)}>
              <option value="">(Seleccione)</option>
              {optsApl.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
          <div className={styles.filterItem}>
            <label className={styles.label}>Monto</label>
            <input className={styles.select} type="number" step="0.01" value={montoApl} onChange={e=>setMontoApl(e.target.value)} />
          </div>
          <div className={styles.filterItem}>
            <button className={styles.smallBtn} onClick={addApl}>Agregar</button>
          </div>
        </div>

        {!!aplUsadas.length && (
          <ul style={{ marginTop: 8 }}>
            {aplUsadas.map((t, i) => (
              <li key={`${t.id}-${i}`}>
                {t.label} — <strong>$ {new Intl.NumberFormat("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2}).format(t.monto)}</strong>
                <button className={styles.smallBtn} style={{ marginLeft: 8 }} onClick={() => setAplUsadas(prev => prev.filter((_,k)=>k!==i))}>Quitar</button>
              </li>
            ))}
          </ul>
        )}
      </Accordion>

      {/* Cheques / ECheqs */}
      <Accordion title="Cheques / ECheqs">
        <div className={styles.field} style={{ marginBottom: 8 }}>
          <label className={styles.labelStrong}>Archivo</label>
          <input type="file" className={styles.input} onChange={onFileChange} />
          <button className={styles.smallBtn} style={{ marginTop: 6, width: 120 }} onClick={cargarCheques}>Cargar</button>
          {importMsg && <div className={styles.muted}>{importMsg}</div>}
        </div>

        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead className={styles.headerRow}>
              <tr>
                <th className={styles.checkCell}>Aplicar</th>
                <th>Código de Banco</th>
                <th>Nombre de Banco</th>
                <th>Número</th>
                <th className={styles.thRight}>Importe</th>
                <th>Tipo</th>
              </tr>
            </thead>
            <tbody>
              {cheques.length === 0 ? (
                <tr><td colSpan={6} className={styles.noResults}>No hay cheques importados todavía.</td></tr>
              ) : cheques.map((c, i) => (
                <tr key={`${c.numero ?? i}-${i}`} className={styles.row}>
                  <td className={styles.checkCell}>
                    <input
                      type="checkbox"
                      checked={seleccionados.has(i)}
                      onChange={(e) => {
                        const next = new Set(seleccionados);
                        if (e.target.checked) next.add(i);
                        else next.delete(i);
                        setSeleccionados(next);
                      }}
                    />
                  </td>
                  <td>{c.codBanco ?? ""}</td>
                  <td>{c.banco ?? ""}</td>
                  <td>{c.numero ?? ""}</td>
                  <td className={styles.tdRight}>
                    {new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(c.importe) || 0)}
                  </td>
                  <td>
                    {c.tipo
                      ? <span className={`${styles.badge} ${c.tipo === "ECH" ? styles.badgeECH : styles.badgeCHE}`}>
                          {c.tipo === "ECH" ? "ECH — ECheq" : "CHE — Cheque"}
                        </span>
                      : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className={styles.footerMsg}>
          Aplicado: <strong>$ {new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(aplicado)}</strong>
          &nbsp;·&nbsp;
          Restante: <strong className={restante >= 0 ? styles.ok : styles.error}>$ {restanteFmt}</strong>
        </p>
      </Accordion>
    </>
  );
}

/* ====== Acordeón reutilizable simple ====== */
function Accordion({ title, defaultOpen = true, rightAdornment = null, children }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className={styles.card}>
      <button className={styles.cardHeader} onClick={() => setOpen(o => !o)}>
        <span className={styles.cardTitle}>{title}</span>
        <span className={styles.cardHeaderRight}>
          {rightAdornment}
          <span className={`${styles.chev} ${open ? styles.chevOpen : ""}`}>▾</span>
        </span>
      </button>
      {open && <div className={styles.cardBody}>{children}</div>}
    </div>
  );
}
