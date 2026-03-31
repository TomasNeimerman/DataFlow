// pages/Modules/Recibos/index.js
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./styles.module.css";

// Módulos
import FormHeader from "../../../components/Recibos/FormHeader";
import Tabs from "../../../components/Recibos/Tabs";
import FacturasSection from "../../../components/Recibos/FacturasSection";
import MediosSection from "../../../components/Recibos/MediosSection";
import ValoresBox from "../../../components/Recibos/ValoresBox";
import SubmitDock from "../../../components/Recibos/SubmitDock";

export default function RecibosPage() {
  /* ======================= CIRCUITO (Ventas o Finanzas) ======================= */
  const [circuito, setCircuito] = useState("V"); // "V" = Ventas, "F" = Finanzas

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

  // Saldo de BD (congelado cuando se selecciona cliente)
  const [saldoBase, setSaldoBase] = useState(0);
  // Valor de facturas seleccionadas (congelado cuando se presiona "Aplicar")
  const [valorFacturas, setValorFacturas] = useState(0);

  /* ======================= Facturas ======================= */
  const [facturas, setFacturas] = useState([]);
  const [aplicaFact, setAplicaFact] = useState({});

  /* ======================= Medios (Cheques) ======================= */
  const [chequesFormato, setChequesFormato] = useState(""); // "ECH" | "CHE"
  const [cheques, setCheques] = useState([]);
  const [selCheques, setSelCheques] = useState(new Set());
  const [file, setFile] = useState(null);
  const [importMsg, setImportMsg] = useState("");
  const [chequesAplicados, setChequesAplicados] = useState([]); // NUEVO: Cheques persistentes

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

  /* ======================= Movimientos de Fondos (Prioridad 3) ======================= */
  const [optsMovFondos, setOptsMovFondos] = useState([]);
  const [movFondosSel, setMovFondosSel] = useState("");

  /* ======================= UI ======================= */
  const [err, setErr] = useState("");
  const [loadingCore, setLoadingCore] = useState(true);
  const [loadingClientes, setLoadingClientes] = useState(true);
  const [activeTab, setActiveTab] = useState("facturas"); // "facturas" | "medios"

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

  // Carga de catálogos iniciales
  useEffect(() => {
    (async () => {
      try {
        setLoadingCore(true);
        const [rTipos, rMon] = await Promise.all([
          window?.api?.recibos?.getTiposComprobante?.({ tipoFijo: "RC", circuito }),
          window?.api?.recibos?.getMonedas?.(),
        ]);
        if (rTipos?.ok) setTipos(rTipos.data || []);
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
  }, [circuito]);

  // Carga de clientes
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
  const readySaldoFact = !!(cliente && monSel.mon_codigo && monSel.mtca_codigo && tc);

  // Auto-seleccionar Pesos cuando carga
  useEffect(() => {
    if (monMtca.length > 0 && !monSel.mon_codigo) {
      const pesos = monMtca.find(m => String(m.mon_codigo) === "1" || String(m.mon_codigo).toUpperCase() === "PES");
      if (pesos) {
        setMonSel({
          mon_codigo: pesos.mon_codigo,
          mtca_codigo: pesos.mtca_codigo,
        });
      }
    }
  }, [monMtca]);

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
        
        // Extraer saldo - buscar en múltiples ubicaciones
        let saldoValue = 0;
        if (sf) {
          // Si es un número directo
          if (typeof sf === 'number') {
            saldoValue = sf;
          }
          // Si tiene propiedad saldo
          else if (sf.saldo !== undefined) {
            saldoValue = Number(sf.saldo);
          }
          // Si tiene data con saldo
          else if (sf.data?.saldo !== undefined) {
            saldoValue = Number(sf.data.saldo);
          }
          // Si data es un número
          else if (typeof sf.data === 'number') {
            saldoValue = sf.data;
          }
          // Si data es un objeto con saldo
          else if (sf.data?.data?.saldo !== undefined) {
            saldoValue = Number(sf.data.data.saldo);
          }
          // Búsqueda de emergencia: buscar cualquier valor numérico
          else if (typeof sf === 'object') {
            // Buscar primera propiedad numérica
            for (let key in sf) {
              const val = Number(sf[key]);
              if (!isNaN(val) && val > 0) {
                saldoValue = val;
                break;
              }
              // Si es un objeto, buscar dentro
              if (typeof sf[key] === 'object' && sf[key] !== null) {
                for (let innerKey in sf[key]) {
                  const innerVal = Number(sf[key][innerKey]);
                  if (!isNaN(innerVal) && innerVal > 0) {
                    saldoValue = innerVal;
                    break;
                  }
                }
              }
            }
          }
        }
        
        setSaldoBase(Number(saldoValue) || 0);
        
        // Extraer facturas
        let facturas = [];
        if (ff?.ok && ff.data) {
          facturas = Array.isArray(ff.data) ? ff.data : (ff.data.data || []);
        } else if (Array.isArray(ff?.data)) {
          facturas = ff.data;
        } else if (Array.isArray(ff)) {
          facturas = ff;
        }
        
        setFacturas(facturas);
        setAplicaFact({});
      } catch (e) {
        console.error("Error en getSaldoCliente:", e);
        setSaldoBase(0);
        setFacturas([]);
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

  /* ======================= Cálculos de Valores ======================= */
  const seleccionadoFacturas = useMemo(
    () => Object.values(aplicaFact).reduce((a, it) => a + (it?.checked ? Number(it.monto) || 0 : 0), 0),
    [aplicaFact]
  );

  const aplicarFacturas = () => setValorFacturas(seleccionadoFacturas);

  const totalSeleccionadoExcept = (index) =>
    Object.entries(aplicaFact).reduce((acc, [k, v]) => {
      if (Number(k) === Number(index)) return acc;
      return acc + (v?.checked ? (Number(v.monto) || 0) : 0);
    }, 0);

  // Totales de medios
  const aplicadoCheques = useMemo(
    () => (Array.isArray(cheques) ? cheques : []).reduce((a, c, i) => {
      if (!selCheques.has(i)) return a;
      const importe = Number(c?.importe || c?.Importe || 0) || 0;
      return a + importe;
    }, 0),
    [cheques, selCheques]
  );

  const aplicadoTransf = useMemo(
    () => (aplicTransf || []).reduce((a, b) => a + (Number(b.monto) || 0), 0),
    [aplicTransf]
  );

  const aplicadoCajas = useMemo(
    () => (aplicCajas || []).reduce((a, b) => a + (Number(b.monto) || 0), 0),
    [aplicCajas]
  );

  const aplicadoAps = useMemo(
    () => (aplicAps || []).reduce((a, b) => a + (Number(b.monto) || 0), 0),
    [aplicAps]
  );

  const aplicadoMedios = aplicadoCheques + aplicadoTransf + aplicadoCajas + aplicadoAps;

  // Estados del recibo
  const restanteVsFact = valorFacturas - aplicadoMedios;
  const excedentePos = Math.max(0, aplicadoMedios - valorFacturas);
  const esReciboACuenta = Number(valorFacturas || 0) <= 0;
  const saldoRestanteCliente = Math.max(0, saldoBase - valorFacturas);
  const facturasPendienteMonto = Math.max(0, Number(valorFacturas || 0) - Number(aplicadoMedios || 0));
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
  function delTransf(i) {
    setAplicTransf((p) => p.filter((_, idx) => idx !== i));
  }

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
  function delCaja(i) {
    setAplicCajas((p) => p.filter((_, idx) => idx !== i));
  }

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
  function delAp(i) {
    setAplicAps((p) => p.filter((_, idx) => idx !== i));
  }

  /* ======================= Cheques ======================= */
  function onFileChange(e) {
    setFile(e.target.files?.[0] || null);
    setImportMsg("");
  }

  // Helper: parsear fecha DD/MM/AAAA a ISO string
  function parseFecha(fechaStr) {
    if (!fechaStr) return "";
    const str = String(fechaStr).trim();
    
    // Detectar número serial de Excel (número entre 1 y 60000)
    const serialNum = Number(str);
    if (!isNaN(serialNum) && serialNum > 0 && serialNum < 100000) {
      // Excel cuenta desde 1/1/1900, pero hay un bug histórico (29/2/1900)
      // Entonces si el serial es > 59, restar 1
      let excelSerial = serialNum;
      if (excelSerial > 59) excelSerial -= 1;
      
      const d = new Date((excelSerial - 1) * 86400 * 1000 + new Date(1900, 0, 1).getTime());
      if (!isNaN(d.getTime())) {
        return d.toISOString();
      }
    }
    
    // Intenta formato DD/MM/AAAA
    const match = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match) {
      const [, day, month, year] = match;
      const d = new Date(Number(year), Number(month) - 1, Number(day));
      if (!isNaN(d.getTime())) {
        return d.toISOString();
      }
    }

    // Intenta otros formatos comunes
    try {
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        return d.toISOString();
      }
    } catch (e) {
      // ignorar
    }

    return "INVALID_DATE"; // Devolver marcador para fecha inválida
  }

  function cargarCheques() {
    if (!file || !chequesFormato) {
      setImportMsg("Selecciona un archivo y un formato.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const XLSX = await import("xlsx");
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: "array" });
        const sh = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sh, { defval: "" });

        if (!rows.length) {
          setImportMsg("⚠️ El archivo está vacío.");
          return;
        }

        // Parsear cheques según formato
        const chequesParsed = rows
          .map((row) => mapRowToCheque(row, chequesFormato))
          .filter(Boolean);

        if (!chequesParsed.length) {
          setImportMsg("⚠️ No se encontraron cheques válidos en el archivo.");
          return;
        }

        setCheques(chequesParsed);
        setImportMsg(`✓ ${chequesParsed.length} cheques cargados correctamente.`);
      } catch (error) {
        console.error("Error cargando cheques:", error);
        setImportMsg("❌ Error al procesar el archivo.");
      }
    };
    reader.readAsArrayBuffer(file);
  }

  // Helper: parsear fila del Excel a objeto cheque
  function mapRowToCheque(row, formato) {
    const norm = (s) =>
      String(s || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim();

    const dict = {};
    for (const k of Object.keys(row || {})) {
      dict[norm(k)] = row[k];
    }

    const get = (...keys) => {
      for (const k of keys) {
        const v = dict[norm(k)];
        if (v !== undefined && v !== null && String(v).trim() !== "") return v;
      }
      return undefined;
    };

    // Helper para derivar razón social desde historial de endosos
    const deriveRazonFromHist = (hist) => {
      const s = String(hist || "");
      if (!s) return "";
      const parts = s.split("-").map(x => x.trim()).filter(Boolean);
      const filtered = parts.filter(p => {
        const low = p.toLowerCase();
        if (low === "cuit") return false;
        if (/^\d{6,}$/.test(p)) return false;
        if (/(aceptado|rechazado|pendiente|endoso)/.test(low)) return false;
        return true;
      });
      return filtered.sort((a,b)=>b.length-a.length)[0] || "";
    };

    // ECheqs
    if (formato === "ECH") {
      const nroEcheq = get("numero de echeq", "nro echeq");
      const razonSocial = get("nombre o razon social beneficiario endoso", "nombre o razon social emisor") || "";
      const historialEndosos = get("historial de endosos") || "";
      const fechaVencimiento = get("fecha pago", "fecha de pago") || "";
      const importe = get("importe");

      if (nroEcheq == null || importe == null) return null;

      return {
        tipoCheque: "ECH",
        nroEcheq: String(nroEcheq || "").padStart(8, "0"),
        razonSocial: String(razonSocial || ""),
        historialEndosos: String(historialEndosos || ""),
        fechaVencimiento: parseFecha(fechaVencimiento),
        importe: Number(importe) || 0,
      };
    }

    // Cheques Físicos
    if (formato === "CHE") {
      const nroCheque = get("nro de cheque", "numero de cheque", "nro cheque", "numero cheque");
      const fechaPago = get("fecha de pago", "fecha pago");
      const importe = get("importe");
      const firmante = get("firmante/emisor", "firmante", "emisor") || "";
      const cuitLibrador = get("cuit librador", "cuit") || "";
      const codBanco = get("cod. banco", "codigo banco", "cod banco") || "";
      const estadoFirma = get("estado firma", "estado", "estado de firma") || "";
      const observaciones = get("observaciones", "obs", "observacion") || "";

      if (nroCheque == null || importe == null) return null;

      return {
        tipoCheque: "CHE",
        nroEcheq: String(nroCheque || ""),
        razonSocial: String(firmante || ""),
        cuitLibrador: String(cuitLibrador || ""),
        codBanco: String(codBanco || ""),
        estadoFirma: String(estadoFirma || ""),
        observaciones: String(observaciones || ""),
        fechaVencimiento: parseFecha(fechaPago),
        importe: Number(importe) || 0,
      };
    }

    return null;
  }

  function cancelarCheques() {
    setCheques([]);
    setSelCheques(new Set());
    setFile(null);
    setChequesFormato("");
    setImportMsg("");
  }

  /* ======================= Validación y Confirmación ======================= */
  const ready = !!(tipoComprobante && fecha && cliente && monSel.mon_codigo && monSel.mtca_codigo && tc);

  const canConfirm = esReciboACuenta
    ? Number(aplicadoMedios || 0) > 0
    : Number(aplicadoMedios || 0) >= Number(valorFacturas || 0);

  function onConfirmar() {
    if (!ready || !canConfirm) return;

    if (esReciboACuenta) {
      alert("Recibo a cuenta listo para emitir.");
      return;
    }

    alert("Recibo listo para emitir.");
  }

  /* ======================= Render ======================= */
  return (
    <div className={styles.pageBg}>
      <div className={styles.container}>
        {/* Selector de Circuito (Prioridad 3) */}
        {circuito === "F" && (
          <div className={styles.circuitoSelector}>
            <label>
              <input
                type="checkbox"
                checked={circuito === "F"}
                onChange={(e) => setCircuito(e.target.checked ? "F" : "V")}
              />
              {" "}Recibos de Finanzas (Cobros Varios)
            </label>
          </div>
        )}

        {/* HEADER + VALORES BOX STICKY */}
        <div className={styles.stickyHead}>
          <div className={styles.titleContainer}>
            <h1 className={styles.title}>Recibos {circuito === "F" ? "- Finanzas" : ""}</h1>
          </div>

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
            esFinanzas={circuito === "F"}
          />

          <Tabs
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            esFinanzas={circuito === "F"}
          />

          <div className={styles.valoresBoxSticky}>
            <ValoresBox
              valorFacturas={valorFacturas}
              aplicadoMedios={aplicadoMedios}
              mostrarPendiente={activeTab === "medios"}
              nfmt={nfmt}
            />
          </div>
        </div>

        {activeTab === "facturas" && (
          <div className={styles.tabInner}>
            <FacturasSection
              facturas={facturas}
              aplicaFact={aplicaFact}
              setAplicaFact={setAplicaFact}
              seleccionadoFacturas={seleccionadoFacturas}
              aplicarFacturas={aplicarFacturas}
              totalSeleccionadoExcept={totalSeleccionadoExcept}
              saldoMostrado={Math.max(0, saldoBase - valorFacturas)}
              nfmt={nfmt}
              dfmt={dfmt}
              setActiveTab={setActiveTab}
            />
          </div>
        )}

        {activeTab === "medios" && (
          <div className={styles.tabInner}>
            <MediosSection
              seleccionadoFacturas={seleccionadoFacturas}
              saldoMostrado={Math.max(0, saldoBase - valorFacturas)}
              chequesFormato={chequesFormato}
              setChequesFormato={setChequesFormato}
              file={file}
              onFileChange={onFileChange}
              cheques={cheques}
              selCheques={selCheques}
              setSelCheques={setSelCheques}
              importMsg={importMsg}
              setImportMsg={setImportMsg}
              cargarCheques={cargarCheques}
              cancelarCheques={cancelarCheques}
              chequesAplicados={chequesAplicados}
              setChequesAplicados={setChequesAplicados}
              optsTransf={optsTransf}
              transfSel={transfSel}
              setTransfSel={setTransfSel}
              transfMonto={transfMonto}
              setTransfMonto={setTransfMonto}
              aplicTransf={aplicTransf}
              addTransf={addTransf}
              delTransf={delTransf}
              optsCajas={optsCajas}
              cajaSel={cajaSel}
              setCajaSel={setCajaSel}
              cajaMonto={cajaMonto}
              setCajaMonto={setCajaMonto}
              aplicCajas={aplicCajas}
              addCaja={addCaja}
              delCaja={delCaja}
              optsAp={optsAp}
              apSel={apSel}
              setApSel={setApSel}
              apMonto={apMonto}
              setApMonto={setApMonto}
              aplicAps={aplicAps}
              addAp={addAp}
              delAp={delAp}
              nfmt={nfmt}
              dfmt={dfmt}
              aplicadoMedios={aplicadoMedios}
            />
          </div>
        )}

        <SubmitDock
          ready={ready}
          canConfirm={canConfirm}
          onConfirmar={onConfirmar}
          esReciboACuenta={esReciboACuenta}
          valorFacturas={valorFacturas}
          seleccionadoFacturas={seleccionadoFacturas}
        />
      </div>
    </div>
  );
}