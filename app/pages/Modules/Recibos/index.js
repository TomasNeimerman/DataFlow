// pages/Modules/Recibos/index.js
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./styles.module.css";

// Módulos
import FormHeader from "../../components/Recibos/FormHeader";
import Tabs from "../../components/Recibos/Tabs";
import FacturasSection from "../../components/Recibos/FacturasSection";
import MediosSection from "../../components/Recibos/MediosSection";



export default function RecibosPage() {
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

  useEffect(() => {
    (async () => {
      try {
        setLoadingCore(true);
        const [rTipos, rMon] = await Promise.all([
          window?.api?.recibos?.getTiposComprobante?.({ tipoFijo: "RC", circuito: "V" }),
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
  function mapRowToCheque(row) {
  const pick = (keys) => {
    for (const k of keys) if (row[k] != null && row[k] !== "") return row[k];
    return null;
  };

  const nroEcheq = pick([
    "Nro Echeq",
    "Numero de ECHEQ",
    "Nro ECHEQ",
    "Número de ECHEQ",
    "Numero Echeq",
  ]);

  // En el XLS viene como “Nombre o Razón Social Emisor” (y a veces el del beneficiario)
  const razonSocial = pick([
    "Razón Social",
    "Razon Social",
    "Nombre o Razón Social",
    "Nombre o Razón Social Emisor",
    "Nombre o Razón Social Beneficiario Endoso",
    "Nombre o Razon Social Emisor",
    "Nombre o Razon Social Beneficiario Endoso",
  ]);

  const historialEndosos = pick(["Historial de Endosos", "Historial Endosos"]);

  // En el XLS la “Fecha Vencimiento” viene como “Fecha Pago”
  const fechaVencimiento = pick([
    "Fecha Vencimiento",
    "Fec Vencimiento",
    "Fecha Pago",
    "Fecha de Pago",
  ]);

  const importe = pick(["Importe", "Monto"]);

  if (nroEcheq == null && importe == null) return null;

  return {
    nroEcheq: String(nroEcheq || ""),
    razonSocial: String(razonSocial || ""),
    historialEndosos: String(historialEndosos || ""),
    // lo dejo como string; tu dfmt ya lo muestra
    fechaVencimiento: fechaVencimiento ? String(fechaVencimiento) : "",
    importe: Number(importe) || 0,
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
      const mapped = rows.map(mapRowToCheque).filter(Boolean);
      setCheques(mapped);
      setSelCheques(new Set());
      setImportMsg(`Se importaron ${mapped.length} cheque(s).`);
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
  const facturasaplic = valorFacturas - aplicadoMedios;

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
  const canConfirm = valorFacturas > 0 && aplicadoMedios >= valorFacturas;

  async function onConfirmar() {
    if (!canConfirm) return;

    try {
      // Construir payload para el SDK
      const payload = {
        recibo: {
          // Datos básicos
          codigoCliente: cliente,
          nombreCliente: clientes.find(c => c.cli_CodCli === cliente)?.cli_RazonSoc || "",
          fecha: fecha,
          moneda: monSel.mon_codigo,
          tipoCambio: tc,
          observaciones: `Recibo generado desde DataFlow`,

          // Valores (medios de pago)
          valores: construirValores(),

          // Aplicaciones (facturas a cancelar)
          aplicaciones: construirAplicaciones(),
        }
      };

      // Llamar al SDK
      const result = await window.api.sdk.finanzas.ingresarRecibo(payload);

      // Manejar respuesta
      if (result?.success) {
        alert(`✓ Recibo registrado exitosamente en Bejerman ERP\n\n${result.message}`);
        // TODO: Limpiar formulario o redirigir
      } else {
        const errores = (result.errors || []).join('\n');
        alert(`✗ Error al registrar recibo:\n\n${errores || result.message}`);
      }

    } catch (error) {
      alert(`✗ Error inesperado: ${error.message}`);
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
        observaciones: caja.label || '',
      });
    });

    // Aplicaciones (otros valores)
    aplicAps.forEach(ap => {
      valores.push({
        tipo: 'OTR',
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
        const parts = (factura.Comprobante || '').split(' ');
        const tipoComp = parts[0] || 'FA';
        const numeroCompleto = parts[1] || '0001-00000000';
        const [ptoVenta, numero] = numeroCompleto.split('-');

        aplicaciones.push({
          tipoComprobante: tipoComp,
          puntoVenta: ptoVenta || '0001',
          numeroComprobante: numero || '00000000',
          importe: Number(v.monto) || 0,
        });
      });

    return aplicaciones;
  }

  /* ======================= Render ======================= */
  return (
    <div className={styles.pageBg}>
      <div className={styles.container}>
        {/* ---------- STICKY HEADER ---------- */}
        <div className={styles.stickyHead}>
          <div className={styles.titleContainer}>
            <h1 className={styles.title}>Recibos</h1>
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
            // totales / info
            aplicadoMedios={aplicadoMedios}
            restanteVsFact={restanteVsFact}
            excedentePos={excedentePos}
            facturasaplic={facturasaplic}
            nfmt={nfmt}
            dfmt={dfmt}
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
          <button className={styles.submitBtn} disabled={!ready || !canConfirm} onClick={onConfirmar}>
            Confirmar Recibos
          </button>
        </div>
      </div>
    </div>
  );
}
