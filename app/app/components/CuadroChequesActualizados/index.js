// app/components/ChequesActualizados.js

import React from "react";

// Función que compara propiedades y resalta diferencias
const renderCampo = (label, actual, nuevo) => {
  const diferente = actual !== nuevo;
  return (
    <tr key={label}>
      <td style={{ padding: "0.25rem", borderBottom: "1px solid #ddd" }}>{label}</td>
      <td style={{ padding: "0.25rem", color: "#555" }}>{actual ?? '-'}</td>
      <td style={{ padding: "0.25rem", color: diferente ? "#d00" : "#090", fontWeight: diferente ? "bold" : "normal" }}>
        {nuevo ?? '-'}
      </td>
    </tr>
  );
};

const ChequesActualizados = ({ cheques, valoresActuales }) => {
  const getNuevoCheque = (id) => cheques.find((c) => c.idCheque === id);

  return (
    <div style={{ padding: "1rem" }}>
      <h2 style={{ fontSize: "1.25rem", fontWeight: "bold", marginBottom: "1rem" }}>
        Actualización de Cheques Detectada
      </h2>

      {valoresActuales.length === 0 && (
        <p style={{ fontStyle: "italic", color: "#666" }}>No hay cheques para actualizar.</p>
      )}

      {valoresActuales.map((actual, index) => {
        const nuevo = getNuevoCheque(actual.chp_ID);
        if (!nuevo) return null;

        return (
          <div key={actual.chp_ID} style={{ marginBottom: "2rem", border: "1px solid #ccc", padding: "1rem", borderRadius: "8px" }}>
            <h4 style={{ marginBottom: "0.5rem" }}>Cheque ID: {actual.chp_ID}</h4>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
              <thead>
                <tr style={{ backgroundColor: "#f0f0f0" }}>
                  <th style={{ textAlign: "left", padding: "0.5rem" }}>Campo</th>
                  <th style={{ textAlign: "left", padding: "0.5rem" }}>Actual</th>
                  <th style={{ textAlign: "left", padding: "0.5rem" }}>Nuevo</th>
                </tr>
              </thead>
              <tbody>
                {renderCampo("Empresa", actual.chpemp_Codigo, nuevo.codEmp)}
                {renderCampo("Sucursal", actual.chpsuc_Cod, nuevo.emp)}
                {renderCampo("Fecha Emisión", actual.chp_FEnt?.split("T")[0], nuevo.fechaEmision)}
                {renderCampo("Movimiento", actual.chpbco_Suc, nuevo.movimiento)}
                {renderCampo("Tipo Cheque", actual.chptch_Cod, nuevo.tipoCheque)}
                {renderCampo("Estado", actual.chp_edo, nuevo.estado)}
                {renderCampo("Fecha Vencimiento", actual.chp_FVto?.split("T")[0], nuevo.fechaVenc)}
                {renderCampo("Código Cheque", actual.chp_NroCheq, nuevo.chequeCodigo)}
                {renderCampo("Nro Definitivo", actual.chp_NroDtvo, nuevo.nroDefinitivo)}
                {renderCampo("Importe", actual.chp_Importe?.toFixed(2), nuevo.importe)}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
};

export default ChequesActualizados;
