import React, { useMemo, useState } from "react";
import styles from "./styles.module.css";

const PreciosActualizados = ({ precios = [], validar }) => {
  const [mostrarCuadro, setMostrarCuadro] = useState(false);
  const toggleMostrarCuadro = () => setMostrarCuadro((v) => !v);

  // ---- Helpers de número/moneda ----
  const toNumber = (v) => {
    if (v === null || v === undefined || v === "") return null;
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    const n = Number(String(v).replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  };

  const money = (v) => {
    const n = toNumber(v);
    if (n === null) return "—";
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  };

  // Normalización flexible: acepta {precio, actualizado, motivo, ...}
  // o bien objetos planos con alias (precioActual, lpr_Precio, etc.)
  const filas = useMemo(() => {
    const arr = Array.isArray(precios) ? precios : [];

    return arr.map((row, i) => {
      const p = row?.precio || row || {}; // soporta row.precio o row plano

      const lista = row?.lista ?? p?.lprdlp_Cod ?? "—";
      const cod   = row?.codArticulo ?? p?.lprart_CodGen ?? "—";
      const desc  = row?.descripcion ?? p?.descripcion ?? "";

      const anteriorVal =
        row?.precioAnterior ??
        p?.precioAnterior ??
        p?.precioActual ??   // lo que devuelve obtenerPrecioActualizador
        p?.lpr_Precio ??     // por si entra directo de ListaPrec
        null;

      const nuevoVal =
        row?.precioNuevo ??
        p?.precio ??         // nuevo precio propuesto/enviado a update
        p?.nuevo ??          // alias alternativo
        null;

      const actualizado = !!(row?.actualizado ?? p?.actualizado);
      const motivo      = row?.motivo ?? p?.motivo ?? null;

      return {
        key: `${lista}-${cod}-${i}`,
        lista,
        cod,
        desc,
        anterior: money(anteriorVal),
        nuevo: money(nuevoVal),
        actualizado,
        motivo,
      };
    });
  }, [precios]);

  const hayDatos = filas.length > 0;

  return (
    <div className={styles.container}>
      <div className={styles.headerContainer}>
        <h2 className={styles.title}>Precios Actualizados</h2>
        <button
          onClick={toggleMostrarCuadro}
          className={styles.toggleButton}
          title="Mostrar/ocultar precios actualizados"
          aria-label={mostrarCuadro ? "Ocultar precios" : "Mostrar precios"}
        >
          {mostrarCuadro ? "–" : "▭"}
        </button>
      </div>

      {!validar || !hayDatos ? (
        <p className={styles.noResults}>No hay precios para actualizar.</p>
      ) : (
        mostrarCuadro && (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr className={styles.headerRow}>
                  <th>Lista de Precios - Cód.</th>
                  <th>Art. - Cód. Genérico</th>
                  <th>Descripción</th>
                  <th>Precio Anterior</th>
                  <th>Precio Nuevo</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((r) => (
                  <tr key={r.key} className={r.actualizado ? styles.tractualizado : ""}>
                    <td>{r.lista}</td>
                    <td>{r.cod}</td>
                    <td>{r.desc || "—"}</td>
                    <td>{r.anterior}</td>
                    <td className={r.actualizado ? styles.ok : ""}>{r.nuevo}</td>
                    <td>
                      {r.actualizado
                        ? "Se actualizó correctamente ✅"
                        : r.motivo
                        ? `No se actualizó (${r.motivo})`
                        : "No se actualizó"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
};

export default PreciosActualizados;
