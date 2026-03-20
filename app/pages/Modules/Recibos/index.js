// pages/Modules/Recibos/index.js
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import styles from "./styles.module.css";

// Módulos
import FormHeader from "../../../components/Recibos/FormHeader";
import Tabs from "../../../components/Recibos/Tabs";
import FacturasSection from "../../../components/Recibos/FacturasSection";
import MediosSection from "../../../components/Recibos/MediosSection";



export default function RecibosPage() {
  const router = useRouter();
  /* ======================= Catálogos ======================= */
  const [tipos, setTipos] = useState([]);
  const [monMtca, setMonMtca] = useState([]);
  const [clientes, setClientes] = useState([]);

  /* ======================= Form header ======================= */
  const [tipoComprobante, setTipoComprobante] = useState("");
  const [fecha, setFecha] = useState("");
  const [cliente, setCliente] = useState("");
  const [monSel, setMonSel] = useState({ mon_codigo: "", mtca_codigo: "" });

  const [tc, setTc] = useState("");
  const [tcEditables, setTcEditables] = useState([]);
  const [tcEditable, setTcEditable] = useState(false);
  const tcRef = useRef(null);

  // Saldo de BD + “valor facturas” aplicado (congelado)
  const [saldoBase, setSaldoBase] = useState(0);
  const [valorFacturas, setValorFacturas] = useState(0);

  /* ======================= Facturas ======================= */
  const [facturas, setFacturas] = useState([]);
  // idx -> {checked, monto}
  const [aplicaFact, setAplicaFact] = useState({});

  /* ======================= Medios (Cheques) ======================= */
  const [chequesFormato, setChequesFormato] = useState(""); // "ECH" | "CHE"
  const [cheques, setCheques] = useState([]);
  const [selCheques, setSelCheques] = useState(new Set());
  const [file, setFile] = useState(null);
  const [importMsg, setImportMsg] = useState("");
  

  /* ======================= Medios (Transferencias/Cajas/Apps) ======================= */
  const [optsTransf, setOptsTransf] = useState([]);
  const [transfSel, setTransfSel] = useState("");
  const [transfMonto, setTransfMonto] = useState("");
  const [aplicTransf, setAplicTransf] = useState([]);

  const [optsCajas, setOptsCajas] = useState([]);
  const [cajaSel, setCajaSel] = useState("");
  const [cajaMonto, setCajaMonto] = useState("");
  const [aplicCajas, setAplicCajas] = useState([]);

  const [optsAp, setOptsAp] = useState([]);
  const [apSel, setApSel] = useState("");
  const [apMonto, setApMonto] = useState("");
  const [aplicAps, setAplicAps] = useState([]);

  /* ======================= UI ======================= */
  const [err, setErr] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loadingCore, setLoadingCore] = useState(true);
  const [loadingClientes, setLoadingClientes] = useState(true);
  const [activeTab, setActiveTab] = useState("facturas"); // "facturas" | "medios"
  const [sending, setSending] = useState(false);

  /* ======================= Helpers ======================= */
  const nfmt = (v) =>
    new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
      Number(v) || 0
    );
  const dfmt = (d) => {
    try {
      return new Date(d).toLocaleDateString("es-AR");
    } catch {
      return d || "";
    }
  };
  const pad3 = (n) => String(n ?? "").padStart(3, "0");
  const pick = (o, ks) => {
    for (const k of ks) if (o?.[k] != null) return o[k];
  };

  /* ======================= Init ======================= */
  useEffect(() => {
    const d = new Date();
    setFecha(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    );
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setLoadingCore(true);
        const [rTipos, rMon] = await Promise.all([
          window?.api?.recibos?.getTiposComprobante?.({ tipoFijo: "RC", circuito: "V" }),
          window?.api?.recibos?.getMonedas?.(),
        ]);
        if (rTipos?.ok) {
          const data = rTipos.data || [];
          setTipos(data);
          if (data.some((t) => t.tco_cod === "RC")) setTipoComprobante("RC");
        }
        const mm = (rMon?.ok ? rMon.data : []).map((x) => ({
          mon_codigo: String(x.mon_codigo),
          mon_descrip: String(x.mon_descrip || ""),
          mtca_codigo: String(x.mtca_codigo),
          mtca_descrip: String(x.mtca_descrip || ""),
        }));
        setMonMtca(mm);

        const rEdit = await window?.api?.recibos?.getMonedasTcEditables?.();
        setTcEditables(rEdit?.ok ? rEdit.data.map(String) : []);
      } catch (e) {
        console.error(e);
        setErr("Error cargando catálogos");
      } finally {
        setLoadingCore(false);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setLoadingClientes(true);
        const res = await window?.api?.clientesForm?.traerTodos?.();
        setClientes(res?.data || (Array.isArray(res) ? res : []));
      } catch {
        setClientes([]);
      } finally {
        setLoadingClientes(false);
      }
    })();
  }, []);

  /* ======================= Tipo de cambio ======================= */
  const readySaldoFact = !!(cliente && monSel.mon_codigo && monSel.mtca_codigo);

  useEffect(() => {
    (async () => {
      const { mon_codigo, mtca_codigo } = monSel;
      if (!fecha || !mon_codigo || !mtca_codigo) {
        setTc("");
        setTcEditable(false);
        return;
      }
      const r = await window?.api?.recibos?.getTipoCambio?.({ mon_codigo, mtca_codigo, fecha });
      setTc(r?.ok && r.cotizacion != null ? String(r.cotizacion) : "");
      setTcEditable(false);
    })();
  }, [monSel, fecha]);

  const monEditable = monSel?.mon_codigo && tcEditables.includes(String(monSel.mon_codigo));
  function toggleTcEdit() {
    if (!monEditable) return;
    setTcEditable((v) => !v);
    setTimeout(() => tcRef.current?.focus(), 0);
  }

  /* ======================= Saldo + Facturas ======================= */
  useEffect(() => {
    setValorFacturas(0);
  }, [cliente, monSel.mon_codigo, monSel.mtca_codigo, tc]);

  useEffect(() => {
    if (!(cliente && monSel.mon_codigo && monSel.mtca_codigo && tc)) {
      setSaldoBase(0);
      setFacturas([]);
      setAplicaFact({});
      return;
    }
    (async () => {
      try {
        const payload = { codcli: cliente, mon_codigo: monSel.mon_codigo, mtca_codigo: monSel.mtca_codigo };
        const [sf, ff] = await Promise.all([
          window?.api?.recibos?.getSaldoCliente?.(payload),
          window?.api?.recibos?.getFacturas?.(payload),
        ]);
        setSaldoBase(Number(sf?.saldo || 0));
        setFacturas(ff?.ok ? ff.data || [] : []);
        setAplicaFact({});
      } catch (e) {
        console.error(e);
      }
    })();
  }, [cliente, monSel.mon_codigo, monSel.mtca_codigo, tc]);

  /* ======================= Catálogos de medios ======================= */
  const normalizeTransferencias = (raw) => {
    const rows = raw?.data ?? (Array.isArray(raw) ? raw : []);
    return rows
      .map((r) => {
        const CodBanco = pick(r, ["CodBanco", "codBanco", "ctbbco_Cod", "bco_Cod"]) ?? "";
        const Banco = pick(r, ["Banco", "bco_descrip"]) ?? "";
        const NroCuenta = pick(r, ["NroCuenta", "ctb_Cod"]) ?? "";
        const Cuenta = pick(r, ["Cuenta", "ctb_Desc"]) ?? "";
        const Moneda = pick(r, ["Moneda", "mon_simbolo"]) ?? "";
        const value = `${CodBanco}|${NroCuenta}`;
        const label = `[${pad3(CodBanco)}] ${Banco} — ${Cuenta} (${Moneda})`;
        return { value, label };
      })
      .filter((o) => o.value !== "|");
  };
  const normalizeCajas = (raw) => {
    const rows = raw?.data ?? (Array.isArray(raw) ? raw : []);
    return rows.map((r) => {
      const CodCaja = pick(r, ["CodCaja", "caj_Cod"]) ?? "";
      const Caja = pick(r, ["Caja", "caj_Desc"]) ?? "";
      const Moneda = pick(r, ["Moneda", "mon_simbolo"]) ?? "";
      return { value: String(CodCaja), label: `${Caja} (${Moneda})` };
    });
  };
  const normalizeAplicaciones = (raw) => {
    const rows = raw?.data ?? (Array.isArray(raw) ? raw : []);
    return rows.map((r) => {
      const Cod = pick(r, ["CodApl", "CodCaja", "apl_Cod"]) ?? "";
      const Desc = pick(r, ["Aplicacion", "Caja", "apl_Desc"]) ?? "";
      const Moneda = pick(r, ["Moneda", "mon_simbolo"]) ?? "";
      return { value: String(Cod), label: `${Desc} (${Moneda})` };
    });
  };

  useEffect(() => {
    (async () => {
      try {
        const [t, c, a] = await Promise.all([
          window?.api?.recibos?.getTransferencias?.(),
          window?.api?.recibos?.getCajas?.(),
          window?.api?.recibos?.getAplicaciones?.(),
        ]);
        setOptsTransf(normalizeTransferencias(t));
        setOptsCajas(normalizeCajas(c));
        setOptsAp(normalizeAplicaciones(a));
      } catch (e) {
        console.error(e);
        setOptsTransf([]);
        setOptsCajas([]);
        setOptsAp([]);
      }
    })();
  }, []);

  /* ======================= Facturas: selección y límites ======================= */
  const seleccionadoFacturas = useMemo(
    () => Object.values(aplicaFact).reduce((a, it) => a + (it?.checked ? Number(it.monto) || 0 : 0), 0),
    [aplicaFact]
  );
  const aplicarFacturas = () => setValorFacturas(seleccionadoFacturas);

  // helper: total seleccionado menos una fila (para topear por saldo del cliente) -> lo usa el componente
  const totalSeleccionadoExcept = (index) =>
    Object.entries(aplicaFact).reduce((acc, [k, v]) => {
      if (Number(k) === Number(index)) return acc;
      return acc + (v?.checked ? (Number(v.monto) || 0) : 0);
    }, 0);

  /* ======================= Cheques ======================= */
  function onFileChange(e) {
    setFile(e.target.files?.[0] || null);
    setImportMsg("");
  }

  // columnas pedidas: Nro Echeq, Razón Social, Historial de Endosos, Fecha Vencimiento, Importe
function mapRowToCheque(row, formato) {
  // normaliza keys (acentos/espacios)
  const norm = (s) =>
    String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const dict = {};
  for (const k of Object.keys(row || {})) dict[norm(k)] = row[k];

  const get = (...keys) => {
    for (const k of keys) {
      const v = dict[norm(k)];
      if (v !== undefined && v !== null && String(v).trim() !== "") return v;
    }
    return undefined;
  };

  // helper para intentar derivar razón social desde el historial de endosos (si viene vacío)
  const deriveRazonFromHist = (hist) => {
    const s = String(hist || "");
    if (!s) return "";
    const parts = s.split("-").map(x => x.trim()).filter(Boolean);
    // ejemplo típico: "CUIT - 307... - ECOEXIST SRL - aceptado"
    const filtered = parts.filter(p => {
      const low = p.toLowerCase();
      if (low === "cuit") return false;
      if (/^\d{6,}$/.test(p)) return false;
      if (/(aceptado|rechazado|pendiente|endoso)/.test(low)) return false;
      return true;
    });
    // devolvemos el “nombre” más largo que quede
    return filtered.sort((a,b)=>b.length-a.length)[0] || "";
  };

  // ------------------- ECHEQS -------------------
  if (formato === "ECH") {
    const nroEcheq =
      get("Nro Echeq", "Numero de ECHEQ", "Nro ECHEQ", "Número de ECHEQ", "Numero Echeq");

    const historialEndosos = get("Historial de Endosos", "Historial Endosos", "Endosos") || "";

    // en algunos archivos puede venir como "Fecha Vencimiento" o "Fecha Pago"
    const fechaVencimiento =
      get("Fecha Vencimiento", "Fec Vencimiento", "Fecha Pago", "Fecha de Pago") || "";

    const importe = get("Importe", "Monto");

    // puede venir o no; si no viene, intentamos derivar del historial
    const razonSocial =
      get("Razón Social", "Razon Social", "Nombre o Razón Social", "Nombre o Razon Social") ||
      deriveRazonFromHist(historialEndosos);

    if (nroEcheq == null || importe == null) return null;

    return {
      tipoCheque: "ECH",
      nroEcheq: String(nroEcheq || ""),
      razonSocial: String(razonSocial || ""),
      historialEndosos: String(historialEndosos || ""),
      fechaVencimiento: fechaVencimiento ? String(fechaVencimiento) : "",
      importe: Number(importe) || 0,
    };
  }

  // ------------------- CHEQUES FÍSICOS -------------------
  const nroCheque = get("Nro de Cheque", "Nro Cheque", "Numero de Cheque", "Número de Cheque", "Cheque");
  const fechaPago = get("Fecha de Pago", "Fecha Pago");
  const importe = get("Importe", "Monto");

  const firmanteEmisor = get("Firmante/Emisor", "Firmante Emisor", "Emisor", "Librador") || "";
  const cuitLibrador = get("CUIT Librador", "Cuit Librador", "CUIT") || "";
  const codBanco = get("Cod. Banco", "Cod Banco", "Codigo Banco", "Código Banco") || "";
  const estadoFirma = get("Estado Firma", "Estado") || "";
  const observaciones = get("Observaciones", "Obs") || "";

  if (nroCheque == null || importe == null) return null;

  return {
    tipoCheque: "CHE",
    // para mantener tu tabla actual, seguimos guardando el número en nroEcheq (aunque sea físico)
    nroEcheq: String(nroCheque || ""),
    razonSocial: String(firmanteEmisor || ""),
    historialEndosos: String([estadoFirma, observaciones].filter(Boolean).join(" - ")),
    fechaVencimiento: fechaPago ? String(fechaPago) : "",
    importe: Number(importe) || 0,

    // extras por si después los necesitás
    codBanco: String(codBanco || ""),
    cuitLibrador: String(cuitLibrador || ""),
    estadoFirma: String(estadoFirma || ""),
    observaciones: String(observaciones || ""),
  };
}

async function cargarCheques() {
  try {
    if (!file) {
      setImportMsg("Seleccioná un archivo.");
      return;
    }

    const XLSX = await import("xlsx");
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sh = wb.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sh], { defval: "" });

    if (!rows.length) {
      setCheques([]);
      setSelCheques(new Set());
      setChequesFormato("");
      setImportMsg("El archivo no tiene filas.");
      return;
    }

    // Detecta formato por headers
    const norm = (s) =>
      String(s || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim();

    const headers = new Set(Object.keys(rows[0] || {}).map(norm));
    const esFisico = headers.has(norm("Nro de Cheque")) || headers.has(norm("Firmante/Emisor")) || headers.has(norm("Cod. Banco"));
    const formato = esFisico ? "CHE" : "ECH";

    const mapped = rows.map(r => mapRowToCheque(r, formato)).filter(Boolean);

    setCheques(mapped);
    setSelCheques(new Set());
    setChequesFormato(formato);
    setImportMsg(`Se importaron ${mapped.length} cheque(s). (${formato === "ECH" ? "ECheqs" : "Físicos"})`);
    setActiveTab("medios");
  } catch (e) {
    console.error(e);
    setImportMsg("Error procesando planilla.");
  }
}

  function cancelarCheques() {
    setCheques([]);
    setSelCheques(new Set());
    setImportMsg("");
    setFile(null);
  }

  const aplicadoCheques = useMemo(() => {
    let sum = 0;
    selCheques.forEach((i) => (sum += Number(cheques[i]?.importe) || 0));
    return sum;
  }, [selCheques, cheques]);

  /* ======================= Medios totales ======================= */
  const aplicadoTransf = useMemo(
    () => 0 + (Array.isArray(aplicTransf) ? aplicTransf : []).reduce((a, b) => a + (Number(b.monto) || 0), 0),
    [aplicTransf]
  );
  const aplicadoCajas = useMemo(
    () => 0 + (Array.isArray(aplicCajas) ? aplicCajas : []).reduce((a, b) => a + (Number(b.monto) || 0), 0),
    [aplicCajas]
  );
  const aplicadoAps = useMemo(
    () => 0 + (Array.isArray(aplicAps) ? aplicAps : []).reduce((a, b) => a + (Number(b.monto) || 0), 0),
    [aplicAps]
  );

  const aplicadoMedios = aplicadoCheques + aplicadoTransf + aplicadoCajas + aplicadoAps;

  // Restante contra valor de facturas (puede ser negativo => a favor)
  const restanteVsFact = valorFacturas - aplicadoMedios;
  const excedentePos = Math.max(0, aplicadoMedios - valorFacturas);
  const facturasaplic = Number(valorFacturas || 0) - Number(aplicadoMedios || 0);
  // ===== Distinguir recibo a cuenta vs con facturas =====
const esReciboACuenta = Number(valorFacturas || 0) <= 0;

// saldo del cliente "reservado" (ya lo venías mostrando)
const saldoRestanteCliente = Math.max(0, saldoBase - valorFacturas);

// pendiente de facturas (si hay facturas aplicadas)
const facturasPendienteMonto = Math.max(0, Number(valorFacturas || 0) - Number(aplicadoMedios || 0));

// cantidad de facturas seleccionadas/aplicadas (por ahora)
const cantFacturasAplicadas = Object.values(aplicaFact || {}).filter(
  (it) => it?.checked && Number(it?.monto || 0) > 0
).length;
  /* ======================= Add / Del medios ======================= */
  function addTransf() {
    if (!transfSel || !transfMonto) return;
    const found = optsTransf.find((o) => o.value === transfSel);
    setAplicTransf((p) => [
      ...p,
      { value: transfSel, label: found?.label || transfSel, monto: Number(transfMonto) || 0 },
    ]);
    setTransfSel("");
    setTransfMonto("");
  }
  function delTransf(i) { setAplicTransf((p) => p.filter((_, idx) => idx !== i)); }

  function addCaja() {
    if (!cajaSel || !cajaMonto) return;
    const found = optsCajas.find((o) => o.value === cajaSel);
    setAplicCajas((p) => [
      ...p,
      { value: cajaSel, label: found?.label || cajaSel, monto: Number(cajaMonto) || 0 },
    ]);
    setCajaSel("");
    setCajaMonto("");
  }
  function delCaja(i) { setAplicCajas((p) => p.filter((_, idx) => idx !== i)); }

  function addAp() {
    if (!apSel || !apMonto) return;
    const found = optsAp.find((o) => o.value === apSel);
    setAplicAps((p) => [
      ...p,
      { value: apSel, label: found?.label || apSel, monto: Number(apMonto) || 0 },
    ]);
    setApSel("");
    setApMonto("");
  }
  function delAp(i) { setAplicAps((p) => p.filter((_, idx) => idx !== i)); }

  /* ======================= Confirmar ======================= */
  const ready = !!(tipoComprobante && fecha && cliente && monSel.mon_codigo && monSel.mtca_codigo && tc);
  const canConfirm = esReciboACuenta
    ? aplicadoMedios > 0
    : aplicadoMedios >= valorFacturas;

  async function onConfirmar() {
    if (!canConfirm) return;

    setSending(true);
    try {
      const payload = {
        recibo: {
          codigoCliente: cliente,
          nombreCliente: clientes.find(c => c.CodCliente === cliente)?.RazonSocial || "",
          fecha: fecha,
          moneda: monSel.mon_codigo,
          tipoCambio: tc,
          observaciones: `Recibo generado desde DataFlow`,
          valores: construirValores(),
          aplicaciones: construirAplicaciones(),
        }
      };

      const result = await window.api.sdk.ventas.ingresarRecibo(payload);

      if (result?.success) {
        setSuccessMsg("✓ Recibo registrado exitosamente en Bejerman ERP");
        setTimeout(() => setSuccessMsg(""), 6000);
        // Limpiar formulario
        setCliente("");
        setFecha(`${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,"0")}-${String(new Date().getDate()).padStart(2,"0")}`);
        setMonSel({ mon_codigo: "", mtca_codigo: "" });
        setTc("");
        setSaldoBase(0);
        setValorFacturas(0);
        setFacturas([]);
        setAplicaFact({});
        setCheques([]);
        setSelCheques(new Set());
        setFile(null);
        setImportMsg("");
        setTransfSel("");
        setTransfMonto("");
        setAplicTransf([]);
        setCajaSel("");
        setCajaMonto("");
        setAplicCajas([]);
        setApSel("");
        setApMonto("");
        setAplicAps([]);
        setActiveTab("facturas");
        setSending(false);
      } else {
        const errores = (result.errors || [])
          .map(e => typeof e === 'object' ? JSON.stringify(e) : e)
          .join('\n');
        const mensaje = typeof result.message === 'object'
          ? JSON.stringify(result.message)
          : result.message;
        alert(`✗ Error al registrar recibo:\n\n${errores || mensaje}`);
        setSending(false);
      }

    } catch (error) {
      alert(`✗ Error inesperado: ${error.message}`);
      setSending(false);
    }
  }

  function construirValores() {
    const valores = [];

    // Cheques electrónicos seleccionados
    Array.from(selCheques).forEach(idx => {
      const cheque = cheques[idx];
      valores.push({
        tipo: 'ECH',
        codigoBanco: '143', // TODO: Parsear del archivo si está disponible
        numeroCheque: cheque.nroEcheq,
        importe: cheque.importe,
        fechaEmision: fecha,
        fechaCobro: cheque.fechaVencimiento || fecha,
        librador: cheque.razonSocial || "",
        observaciones: cheque.historialEndosos || "",
      });
    });

    // Transferencias
    aplicTransf.forEach(tf => {
      const [codBanco, nroCuenta] = (tf.value || '|').split('|');
      valores.push({
        tipo: 'TRF',
        importe: tf.monto,
        codigoBanco: codBanco || '',
        numeroCuenta: nroCuenta || '',
        fechaTransferencia: fecha,
        observaciones: tf.label || '',
      });
    });

    // Cajas (efectivo)
    aplicCajas.forEach(caja => {
      valores.push({
        tipo: 'EFE',
        importe: caja.monto,
        cajaOrigen: caja.value,
        observaciones: caja.label || '',
      });
    });

    // Aplicaciones (otros valores)
    aplicAps.forEach(ap => {
      valores.push({
        tipo: 'EFE',
        importe: ap.monto,
        observaciones: ap.label || '',
      });
    });

    return valores;
  }

  function construirAplicaciones() {
    const aplicaciones = [];

    Object.entries(aplicaFact)
      .filter(([_, v]) => v?.checked)
      .forEach(([idx, v]) => {
        const factura = facturas[idx];

        aplicaciones.push({
          tipoComprobante: factura.TipoFijo || 'FC',
          letra: (factura.Letra || ' ').trim() || ' ',
          puntoVenta: factura.PtoVenta ?? '',
          numeroComprobante: factura.Numero || '00000000',
          fechaEmision: factura['Fecha Emision'] || '',
          importe: Number(v.monto) || 0,
        });
      });

    return aplicaciones;
  }

  /* ======================= Render ======================= */
  return (
    <div className={styles.pageBg}>
      {sending && (
        <div className={styles.sendingOverlay}>
          <div className={styles.spinner} />
          <span className={styles.sendingText}>Enviando...</span>
        </div>
      )}
      <div className={styles.container}>
        {/* ---------- STICKY HEADER ---------- */}
        <div className={styles.stickyHead}>
          <div className={styles.titleContainer}>
            <h1 className={styles.title}>Recibos</h1>
          </div>

          {successMsg && <div className={styles.successBox}>{successMsg}</div>}
          {err && <div className={styles.errorBox}>{err}</div>}

          <FormHeader
            tipos={tipos}
            monMtca={monMtca}
            clientes={clientes}
            tipoComprobante={tipoComprobante}
            setTipoComprobante={setTipoComprobante}
            fecha={fecha}
            setFecha={setFecha}
            cliente={cliente}
            setCliente={setCliente}
            monSel={monSel}
            setMonSel={setMonSel}
            tc={tc}
            setTc={setTc}
            readySaldoFact={readySaldoFact}
            monEditable={monEditable}
            tcEditable={tcEditable}
            toggleTcEdit={toggleTcEdit}
            tcRef={tcRef}
            saldoMostrado={Math.max(0, saldoBase - valorFacturas)}
            nfmt={nfmt}
          />

          <Tabs activeTab={activeTab} setActiveTab={setActiveTab} />
        </div>

        {/* ======================= FACTURAS ======================= */}
        {activeTab === "facturas" && (
          <FacturasSection
            facturas={facturas}
            aplicaFact={aplicaFact}
            setAplicaFact={setAplicaFact}
            saldoBase={saldoBase}
            valorFacturas={valorFacturas}
            setValorFacturas={setValorFacturas}
            seleccionadoFacturas={seleccionadoFacturas}
            aplicarFacturas={aplicarFacturas}
            restanteVsFact={restanteVsFact}
            nfmt={nfmt}
            dfmt={dfmt}
            totalSeleccionadoExcept={totalSeleccionadoExcept}
          />
        )}

        {/* ======================= MEDIOS DE COBRO ======================= */}
        {activeTab === "medios" && (
          <MediosSection
            // cheques
            file={file}
            onFileChange={onFileChange}
            cargarCheques={cargarCheques}
            cancelarCheques={cancelarCheques}
            cheques={cheques}
            selCheques={selCheques}
            setSelCheques={setSelCheques}
            importMsg={importMsg}
            chequesFormato={chequesFormato}
            setChequesFormato={setChequesFormato}
            // totales / info
            aplicadoMedios={aplicadoMedios}
            restanteVsFact={restanteVsFact}
            excedentePos={excedentePos}
            facturasaplic={facturasaplic}
            nfmt={nfmt}
            dfmt={dfmt}
            esReciboACuenta={esReciboACuenta}
            saldoRestanteCliente={saldoRestanteCliente}
            facturasPendienteMonto={facturasPendienteMonto}
            cantFacturasAplicadas={cantFacturasAplicadas}
            // transferencias
            optsTransf={optsTransf}
            transfSel={transfSel}
            setTransfSel={setTransfSel}
            transfMonto={transfMonto}
            setTransfMonto={setTransfMonto}
            aplicTransf={aplicTransf}
            addTransf={addTransf}
            delTransf={delTransf}
            // cajas
            optsCajas={optsCajas}
            cajaSel={cajaSel}
            setCajaSel={setCajaSel}
            cajaMonto={cajaMonto}
            setCajaMonto={setCajaMonto}
            aplicCajas={aplicCajas}
            addCaja={addCaja}
            delCaja={delCaja}
            // aplicaciones
            optsAp={optsAp}
            apSel={apSel}
            setApSel={setApSel}
            apMonto={apMonto}
            setApMonto={setApMonto}
            aplicAps={aplicAps}
            addAp={addAp}
            delAp={delAp}
          />
        )}

        {/* ======= Submit Dock (dentro del contenedor) ======= */}
        <div className={styles.submitDock}>
          <button className={styles.submitBtn} disabled={!ready || !canConfirm || sending} onClick={onConfirmar}>
            {sending ? "Enviando..." : Number(valorFacturas || 0) <= 0 ? "Confirmar Recibo a Cuenta" : "Confirmar Recibos"}
          </button>
        </div>
      </div>
    </div>
  );
}
