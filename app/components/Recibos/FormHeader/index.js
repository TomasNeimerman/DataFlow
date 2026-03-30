// app/components/Recibos/FormHeader/index.js
"use client";
import React from "react";
import styles from "../../../pages/Modules/Recibos/styles.module.css";

export default function FormHeader({
  tipos, monMtca, clientes,
  tipoComprobante, setTipoComprobante,
  fecha, setFecha,
  cliente, setCliente,
  monSel, setMonSel,
  tc, setTc,
  readySaldoFact, monEditable, tcEditable, toggleTcEdit, tcRef,
  saldoMostrado, nfmt
}) {
  const comboValue = (m) => `${m.mon_codigo}||${m.mtca_codigo}`;
  const parseCombo = (v) => {
    const [mon_codigo = "", mtca_codigo = ""] = String(v || "").split("||");
    return { mon_codigo, mtca_codigo };
  };

  // ✅ FILTRAR: Solo Pesos (mon_codigo === "PES")
  const monMtcaFiltered = (monMtca || []).filter(m => {
    const cod = String(m.mon_codigo || "").trim().toUpperCase();
    return cod === "PES" || cod === "PESOS";
  });

  return (
    <>
      <div className={styles.formGrid}>
        <div className={styles.field}>
          <label>Tipo de Comprobante</label>
          <select
            className={styles.selector}
            value={tipoComprobante}
            onChange={(e) => setTipoComprobante(e.target.value)}
            disabled={!tipos?.length}
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
          <input
            type="date"
            className={styles.input}
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label>Cliente</label>
          <select
            className={styles.selector}
            value={cliente}
            onChange={(e) => setCliente(e.target.value)}
            disabled={!clientes?.length}
          >
            <option value="">Seleccione un cliente</option>
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
            disabled={!monMtcaFiltered?.length}
          >
            <option value="">Seleccione moneda / tipo</option>
            {monMtcaFiltered.map((m, i) => (
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
              <img className={styles.tcEditImg} src="/icons/edit.png" alt="edit" />
            </button>
          </div>
          {monEditable && (
            <span className={styles.tcHint}>{tcEditable ? "Modo edición activo" : "TC editable"}</span>
          )}
        </div>

        <div className={styles.field}>
          <label>Saldo del cliente</label>
          {/* ✅ MOSTRAR NEGATIVO: Sin Math.max, mostrar valor real (positivo o negativo) */}
          <input 
            className={styles.input} 
            readOnly 
            value={`$ ${nfmt(saldoMostrado)}`}
            style={saldoMostrado < 0 ? { color: "#c00", fontWeight: "bold" } : {}}
          />
        </div>
      </div>
    </>
  );
}