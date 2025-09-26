"use client";
import React, { useState, useEffect, useCallback } from "react";
import styles from "./styles.module.css";

const BDSelect = () => {
  const [empresas, setEmpresas] = useState([]);
  const [selectedEmpresaId, setSelectedEmpresaId] = useState("");
  const [selectedEmpresaNombre, setSelectedEmpresaNombre] = useState("");
  const [isConfigured, setIsConfigured] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");

  // comparación (siempre ejecuta; el panel solo se muestra en DEV)
  const [cmpLoading, setCmpLoading] = useState(false);
  const [cmpError, setCmpError] = useState(null);
  const [cmpResult, setCmpResult] = useState(null);

  // flag DEV para mostrar/ocultar panel
  const [isDev, setIsDev] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const dev = await window?.api?.isDev?.();
        setIsDev(!!dev);
      } catch {
        setIsDev(false);
      }
    })();
  }, []);

  // Box visual sin inline styles
  const Box = ({ children, tone = "neutral" }) => {
    const toneClass =
      tone === "warn"
        ? styles.boxWarn
        : tone === "ok"
        ? styles.boxOk
        : tone === "err"
        ? styles.boxErr
        : styles.boxNeutral;

    return <div className={`${styles.box} ${toneClass}`}>{children}</div>;
  };

  const cargarEmpresas = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuccessMessage("");
    setCmpLoading(true);
    setCmpError(null);
    setCmpResult(null);

    try {
      if (!window.api) throw new Error("La API de Electron (window.api) no está disponible.");

      const idCliente = await window.api.getStoreValue("idCliente");
      if (!idCliente) throw new Error("No se encontró 'idCliente'. Por favor, inicie sesión.");

      // 1) Traer lista nube
      const nube = await window.api.getListadoEmpresas(idCliente);
      const nubeArray = Array.isArray(nube) ? nube : Array.isArray(nube?.data) ? nube.data : [];
      if (!nubeArray.length) throw new Error("No se pudo cargar la lista de empresas.");

      // 2) Comparar y filtrar (UI del panel solo en DEV)
      let filtered = nubeArray;
      try {
        const cmp = await window.api.filterEmpresasByLocal(idCliente);
        if (cmp?.success) {
          setCmpResult(cmp);
          filtered = Array.isArray(cmp.filtered) && cmp.filtered.length ? cmp.filtered : nubeArray;

          // Logs para depuración
          try {
            console.groupCollapsed("%cComparación BD nube vs local", "color:#555;font-weight:bold;");
            console.log("totals:", cmp.totals);
            console.table(cmp.matched?.slice(0, 10) || []);
            console.table(cmp.inCloudNotLocal?.slice(0, 10) || []);
            console.table(cmp.inLocalNotCloud?.slice(0, 10) || []);
            console.groupEnd();
          } catch {}
        } else {
          setCmpError(cmp?.message || "No se pudo verificar BDs locales.");
        }
      } catch (e) {
        setCmpError(e?.message || "No se pudo verificar BDs locales.");
      } finally {
        setCmpLoading(false);
      }

      // 3) Usar lista (filtrada si hubo match)
      setEmpresas(filtered);

      // Restaurar selección
      const savedId = await window.api.getStoreValue("selectedEmpresaId");
      const savedName = await window.api.getStoreValue("selectedEmpresaNombre");

      if (savedId) {
        setSelectedEmpresaId(String(savedId));
        const emp = filtered.find((e) => String(e.Id) === String(savedId));
        const nombre = savedName || emp?.RazonSocial || emp?.nombreEmpresa || "";
        setSelectedEmpresaNombre(nombre);
        setIsConfigured(true);
        setSuccessMessage(`Empresa seleccionada: ${nombre || savedId}`);
      }
    } catch (err) {
      console.error("Error al cargar empresas:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarEmpresas();
  }, [cargarEmpresas]);

  const handleGuardarConfiguracion = async (e) => {
    e.preventDefault();
    if (!selectedEmpresaId) {
      setError("Debes seleccionar una empresa antes de guardar.");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccessMessage("");

    try {
      const detalles = await window.api.getDatosEmpresaById(selectedEmpresaId);
      if (!detalles?.success || !detalles.data) {
        throw new Error(detalles?.message || "No se pudieron obtener los detalles de la empresa.");
      }

      const guardar = await window.api.guardarConfiguracion(detalles.data);
      if (!guardar?.success) throw new Error(guardar?.message || "Error al guardar la configuración.");

     const emp = empresas.find((e) => String(e.Id) === String(selectedEmpresaId));

const nombre =
  emp?.RazonSocial ||
  detalles.data?.RazonSocial ||  // por si la nube también trae el campo
  detalles.data?.razonSocial ||
  emp?.nombreEmpresa ||
  detalles.data?.nombreEmpresa ||
  "";

await window.api.setStoreValue("selectedEmpresaId", String(selectedEmpresaId));
await window.api.setStoreValue("selectedEmpresaNombre",
  emp?.RazonSocial || detalles.data?.RazonSocial || detalles.data?.razonSocial || emp?.nombreEmpresa || ""
);

      setSelectedEmpresaNombre(nombre);
      setIsConfigured(true);
      setSuccessMessage("¡Configuración guardada exitosamente!");

      try {
        window.dispatchEvent(new CustomEvent("empresa:selected", { detail: { id: String(selectedEmpresaId), nombre } }));
      } catch {}
    } catch (err) {
      console.error("Error en el proceso de guardado:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleModificar = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccessMessage("");
      await window.api.setStoreValue("selectedEmpresaId", "");
      await window.api.setStoreValue("selectedEmpresaNombre", "");
      setIsConfigured(false);
      setSelectedEmpresaId("");
      setSelectedEmpresaNombre("");
      setSuccessMessage("Selección borrada. Elegí otra empresa y guardá.");

      try {
        window.dispatchEvent(new CustomEvent("empresa:selected", { detail: { id: "", nombre: "" } }));
      } catch {}
    } catch (err) {
      console.error("Error al limpiar selección:", err);
      setError(err.message || "No se pudo limpiar la selección guardada.");
    } finally {
      setLoading(false);
    }
  };

  const onSelectChange = (e) => {
    setSelectedEmpresaId(e.target.value);
    setError(null);
    setSuccessMessage("");
  };

  // Panel de comparación: SOLO visible en DEV
  const renderComparisonInfo = () => {
    if (!isDev) return null;
    if (cmpLoading) return <Box tone="neutral">Verificando bases locales vs nube…</Box>;
    if (cmpError) return <Box tone="err">No se pudo verificar BDs locales: {cmpError}</Box>;
    if (!cmpResult) return null;

    const t = cmpResult.totals || {};
    const hasDiff = (t.inCloudNotLocal || 0) > 0 || (t.inLocalNotCloud || 0) > 0;

    return (
      <Box tone={hasDiff ? "warn" : "ok"}>
        <div className={styles.cmpTitle}>
          Verificación de BDs locales vs nube {hasDiff ? "— hay diferencias." : "— todo OK."}
        </div>
        <div>
          Total en nube: <b>{t.cloud ?? 0}</b> · Local: <b>{t.local ?? 0}</b> · Coinciden: <b>{t.matched ?? 0}</b>
        </div>
        <div>
          Solo nube: <b>{t.inCloudNotLocal ?? 0}</b> · Solo local: <b>{t.inLocalNotCloud ?? 0}</b>
        </div>
      </Box>
    );
  };

  if (loading && empresas.length === 0) {
    return <div className={styles.formCardContainer}>Cargando empresas...</div>;
  }

  return (
    <div className={styles.formCardContainer}>
      <h2>Seleccionar Empresa</h2>
      <form onSubmit={handleGuardarConfiguracion}>
        <div className={styles.field}>
          <label htmlFor="empresa-select" className={styles.label}>
            Empresa:
          </label>

          <select
  id="empresa-select"
  value={selectedEmpresaId}
  onChange={onSelectChange}
  className={styles.select}
  disabled={loading || isConfigured}
>
  <option value="">-- Seleccione una empresa --</option>
  {empresas.map((emp) => {
    // emp viene de cmp.filtered con: { Id, RazonSocial, InstanciaBD, EmpCodigoLocal, nombreEmpresa }
    const codigo = emp.EmpCodigoLocal || emp.InstanciaBD || "";
const label  = `${codigo} - ${emp.RazonSocial || emp.nombreEmpresa || ""}`.trim();
    return (
      <option key={emp.Id} value={emp.Id}>
        {label}
      </option>
    );
  })}
</select>

          {isConfigured && selectedEmpresaNombre && (
            <div className={styles.infoSmall}>
              Usando: <strong>{selectedEmpresaNombre}</strong>
            </div>
          )}
        </div>

        {isConfigured ? (
          <button type="button" className={styles.btn} onClick={handleModificar} disabled={loading}>
            {loading ? "Procesando..." : "Modificar"}
          </button>
        ) : (
          <button type="submit" className={styles.btn} disabled={loading || !selectedEmpresaId}>
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        )}

        {error && <div className={styles.statusError}>Error: {error}</div>}
        {successMessage && <div className={styles.statusSuccess}>{successMessage}</div>}

        {/* Panel de verificación (solo DEV) */}
        {renderComparisonInfo()}
      </form>
    </div>
  );
};

export default BDSelect;
