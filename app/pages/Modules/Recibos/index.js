// app/pages/RecibosPage.jsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./styles.module.css";
import edit from "../../../public/icons/edit.png";

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
  const [facturasPago, setFacturasPago] = useState([]);

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

  function aplicarFacturas() {
    setValorFacturas(seleccionadoFacturas);
  }

  // saldo visible en pestaña Facturas (saldo cliente – valorFacturas aplicado)
  const saldoMostrado = Math.max(0, saldoBase - valorFacturas);

  function totalSeleccionadoExcept(index) {
    return Object.entries(aplicaFact).reduce((acc, [k, v]) => {
      if (Number(k) === Number(index)) return acc;
      return acc + (v?.checked ? (Number(v.monto) || 0) : 0);
    }, 0);
  }

  /* ======================= Cheques ======================= */
  function onFileChange(e) {
    setFile(e.target.files?.[0] || null);
    setImportMsg("");
  }

  // >>> NUEVO mapeo de columnas específicas para Cheques
  function mapRowToCheque(row) {
    const nroEcheq =
      row["Nro Echeq"] ??
      row["Numero de ECHEQ"] ??
      row["Nro ECHEQ"] ??
      row["Número de ECHEQ"] ??
      row["Numero Echeq"];

    const razonSocial = row["Razón Social"] ?? row["Razon Social"];
    const historialEndosos = row["Historial de Endosos"];
    const fechaVencimiento = row["Fecha Vencimiento"] ?? row["Fec Vencimiento"];
    const importe = row["Importe"];

    if (nroEcheq == null || importe == null) return null;

    return {
      nroEcheq: String(nroEcheq || ""),
      razonSocial: String(razonSocial || ""),
      historialEndosos: String(historialEndosos || ""),
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

  // >>> NUEVO: cancelar cheques importados
  function cancelarCheques() {
    setCheques([]);
    setSelCheques(new Set());
    setImportMsg("");
    // opcional: limpiar archivo seleccionado
    setFile(null);
  }

  const aplicadoCheques = useMemo(() => {
    let sum = 0;
    selCheques.forEach((i) => (sum += Number(cheques[i]?.importe) || 0));
    return sum;
  }, [selCheques, cheques]);

  const allChequesChecked = cheques.length > 0 && selCheques.size === cheques.length;
  function toggleAllCheques(e) {
    if (!cheques.length) return;
    if (e.target.checked) {
      const all = new Set(cheques.map((_, i) => i));
      setSelCheques(all);
    } else {
      setSelCheques(new Set());
    }
  }

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

  /* ======================= Confirmar ======================= */
  const ready = !!(tipoComprobante && fecha && cliente && monSel.mon_codigo && monSel.mtca_codigo && tc);
  const canConfirm = valorFacturas > 0 && aplicadoMedios >= valorFacturas;
  const facturasaplic = valorFacturas - aplicadoMedios;
  function onConfirmar() {
    if (!canConfirm) return;
    alert("Recibo listo para emitir (demo).");
  }

  /* ======================= Helpers combos ======================= */
  const comboValue = (m) => `${m.mon_codigo}||${m.mtca_codigo}`;
  const parseCombo = (v) => {
    const [mon_codigo = "", mtca_codigo = ""] = String(v || "").split("||");
    return { mon_codigo, mtca_codigo };
  };

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

          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label>Tipo de Comprobante</label>
              <select
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

            <div className={styles.field}>
              <label>Fecha</label>
              <input type="date" className={styles.input} value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>

            <div className={styles.field}>
              <label>Cliente</label>
              <select
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

            <div className={styles.field}>
              <label>Moneda / Tipo de Cambio</label>
              <select
                className={styles.selector}
                value={monSel.mon_codigo && monSel.mtca_codigo ? comboValue(monSel) : ""}
                onChange={(e) => setMonSel(parseCombo(e.target.value))}
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

            <div className={`${styles.field} ${tcEditable ? styles.editing : ""}`}>
              <label>Tipo de Cambio</label>
              <div className={styles.tcWrapper}>
                <input
                  ref={tcRef}
                  className={`${styles.input} ${tcEditable ? styles.tcEditable : ""}`}
                  type="number"
                  step="0.0001"
                  min="0"
                  value={tc}
                  onChange={(e) => setTc(e.target.value)}
                  disabled={!readySaldoFact || !monEditable}
                />
                <button
                  type="button"
                  className={`${styles.tcEditBtn} ${!readySaldoFact || !monEditable ? styles.tcEditBtnDisabled : ""}`}
                  onClick={toggleTcEdit}
                  title={monEditable ? (tcEditable ? "Bloquear" : "Editar TC") : "TC fijo"}
                  disabled={!readySaldoFact || !monEditable}
                >
                  <img className={styles.tcEditImg} src={edit.src || edit} alt="edit" />
                </button>
              </div>
              {monEditable && (
                <span className={styles.tcHint}>{tcEditable ? "Modo edición activo" : "TC editable"}</span>
              )}
            </div>

            <div className={styles.field}>
              <label>Saldo del cliente</label>
              <input className={styles.input} readOnly value={`$ ${nfmt(saldoMostrado)}`} />
            </div>
          </div>

          <div className={styles.toggleContainer}>
            <button
              className={`${styles.toggleButton} ${activeTab === "facturas" ? styles.active : ""}`}
              onClick={() => setActiveTab("facturas")}
            >
              Facturas
            </button>
            <button
              className={`${styles.toggleButton} ${activeTab === "medios" ? styles.active : ""}`}
              onClick={() => setActiveTab("medios")}
            >
              Medios de Cobro
            </button>
          </div>
        </div>

        {/* ======================= FACTURAS ======================= */}
        {activeTab === "facturas" && (
          <div className={styles.tabInner}>
            <div className={styles.saldoHeader}>
              <div>
                <strong>Saldo Disponible:</strong> $ {nfmt(saldoMostrado)}
              </div>
              <div className={styles.favorRow}>
                <span>
                  <strong>Valor Facturas:</strong> $ {nfmt(valorFacturas)} {" "}·{" "}
                  Restante: <strong className={restanteVsFact < 0 ? styles.saldoFavor : ""}>$ {nfmt(saldoMostrado)}</strong>
                </span>
              </div>
            </div>

            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.cardTitle}>Facturas</span>
                <div className={styles.cardHeaderRight}>
                  <span className={styles.muted}>
                    Seleccionado: <strong>$ {nfmt(seleccionadoFacturas)}</strong>
                  </span>
                  <button
                    className={styles.smallBtn}
                    onClick={aplicarFacturas}
                    disabled={seleccionadoFacturas <= 0}
                  >
                    Aplicar selección
                  </button>
                </div>
              </div>

              <div className={`${styles.cardBody} ${styles.tableContainer}`}>
                <table className={styles.table}>
                  <thead className={styles.headerRow}>
                    <tr>
                      <th className={styles.checkCell}>Sel</th>
                      <th>Comprobante</th>
                      <th>Emisión</th>
                      <th className={styles.tdRight}>Importe Original</th>
                      <th className={styles.tdRight}>Saldo</th>
                      <th className={styles.tdRight}>Monto a aplicar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!facturas?.length ? (
                      <tr>
                        <td className={styles.noResults} colSpan={6}>
                          No hay facturas con saldo.
                        </td>
                      </tr>
                    ) : (
                      facturas.map((f, idx) => {
                        const st = aplicaFact[idx] || { checked: false, monto: 0 };
                        return (
                          <tr key={idx} className={styles.row}>
                            <td className={styles.checkCell}>
                              <input
                                type="checkbox"
                                checked={!!st.checked}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  if (!checked) {
                                    setAplicaFact((p) => ({ ...p, [idx]: { checked: false, monto: 0 } }));
                                    return;
                                  }
                                  const otros = totalSeleccionadoExcept(idx);
                                  const restanteCliente = Math.max(0, saldoBase - otros);
                                  const maxFila = Math.min(Number(f["Saldo"]) || 0, restanteCliente);
                                  setAplicaFact((p) => ({ ...p, [idx]: { checked: true, monto: maxFila } }));
                                }}
                              />
                            </td>
                            <td>{f.Comprobante}</td>
                            <td>{dfmt(f["Fecha Emision"])}</td>
                            <td className={styles.tdRight}>$ {nfmt(f["Importe Original"])}</td>
                            <td className={styles.tdRight}>$ {nfmt(f["Saldo"])}</td>
                            <td className={styles.tdRight}>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                className={styles.input}
                                disabled={!st.checked}
                                value={st.monto ?? ""}
                                onFocus={(e) => {
                                  if ((e.target.value || "") === "0") e.target.select();
                                }}
                                onChange={(e) => {
                                  const val = Number(e.target.value) || 0;
                                  const topeFactura = Number(f["Saldo"]) || 0;
                                  const otros = totalSeleccionadoExcept(idx);
                                  const restanteCliente = Math.max(0, saldoBase - otros);
                                  const cap = Math.max(0, Math.min(val, topeFactura, restanteCliente));
                                  setAplicaFact((prev) => ({ ...prev, [idx]: { checked: true, monto: cap } }));
                                }}
                              />
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ======================= MEDIOS DE COBRO ======================= */}
        {activeTab === "medios" && (
          <div className={styles.tabInner}>
            <div className={styles.saldoHeader}>
              <div className={styles.favorRow}>
                {facturasaplic >= 0 ? (
                  <span>
                    <strong>Facturas a pagar:</strong> $ {nfmt(facturasaplic)}
                  </span>
                ) : (
                  <span className={styles.parenGreen}><strong>Facturas a pagar</strong> (a favor): {nfmt(excedentePos)} </span>
                )}
              </div>
              <div>
                Aplicado: <strong>$ {nfmt(aplicadoMedios)}</strong> ·{" "}
                Restante:{" "}
                <strong className={restanteVsFact < 0 ? styles.saldoFavor : ""}>$ {nfmt(saldoMostrado)}</strong>
              </div>
            </div>

            {/* Cheques */}
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
                  {/* NUEVO: botón Cancelar al lado */}
                  <div className={styles.filterItem}>
                    <label className={styles.label}>&nbsp;</label>
                    <button className={styles.btn} onClick={cancelarCheques} disabled={!cheques.length}>
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
                          <input
                            type="checkbox"
                            checked={allChequesChecked}
                            disabled={!cheques.length}
                            onChange={toggleAllCheques}
                          />
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

            {/* Transferencias */}
            <div className={styles.card}>
              <button className={styles.cardHeader}>
                <span className={styles.cardTitle}>Transferencias bancarias</span>
              </button>
              <div className={styles.cardBody}>
                <div className={styles.filtersGrid}>
                  <div className={styles.filterItem}>
                    <label className={styles.label}>Cuenta</label>
                    <select className={styles.select} value={transfSel} onChange={(e) => setTransfSel(e.target.value)}>
                      <option value="">(Seleccione)</option>
                      {optsTransf.map((o) => (
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

                {aplicTransf.length > 0 && (
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

            {/* Cajas */}
            <div className={styles.card}>
              <button className={styles.cardHeader}>
                <span className={styles.cardTitle}>Cajas</span>
              </button>
              <div className={styles.cardBody}>
                <div className={styles.filtersGrid}>
                  <div className={styles.filterItem}>
                    <label className={styles.label}>Caja</label>
                    <select className={styles.select} value={cajaSel} onChange={(e) => setCajaSel(e.target.value)}>
                      <option value="">(Seleccione)</option>
                      {optsCajas.map((o) => (
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

                {aplicCajas.length > 0 && (
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

            {/* Aplicaciones */}
            <div className={styles.card}>
              <button className={styles.cardHeader}>
                <span className={styles.cardTitle}>Aplicaciones</span>
              </button>
              <div className={styles.cardBody}>
                <div className={styles.filtersGrid}>
                  <div className={styles.filterItem}>
                    <label className={styles.label}>Aplicación</label>
                    <select className={styles.select} value={apSel} onChange={(e) => setApSel(e.target.value)}>
                      <option value="">(Seleccione)</option>
                      {optsAp.map((o) => (
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

                {aplicAps.length > 0 && (
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
