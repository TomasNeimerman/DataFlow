"use client";
import React, { useState, useEffect, useCallback } from "react";
import styles from "./styles.module.css";

const BDSelect = () => {
  const [empresas, setEmpresas] = useState([]);
  const [selectedCodigo, setSelectedCodigo] = useState("");
  const [isConfigured, setIsConfigured] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // === helpers de eventos (on/off + fallback a CustomEvent) ===
  const subscribe = useCallback((channel, handler) => {
    if (typeof window === "undefined") return () => {};
    if (window?.api?.on) {
      window.api.on(channel, handler);
      return () => window.api.off?.(channel, handler);
    } else {
      const h = (e) => handler(e.detail);
      window.addEventListener(channel, h);
      return () => window.removeEventListener(channel, h);
    }
  }, []);

  const emit = useCallback((channel, payload) => {
    try {
      if (window?.api?.emit) {
        window.api.emit(channel, payload);
      } else {
        window.dispatchEvent(new CustomEvent(channel, { detail: payload }));
      }
    } catch {}
  }, []);

  // 🔁 “refresh fino” post-selección: avisa a toda la app sin recargar
  const notifyLiveRefresh = useCallback(
    ({ idCliente, empCodigo, instanciaBD, nombre }) => {
      // Notificación semántica de selección de empresa
      emit("empresa:selected", { idCliente, empCodigo, instanciaBD, nombre });

      // Y broadcast de “cambios en store” para quien escuche del lado UI
      emit("store:any-change", {
        selectedEmpresaCodigo: empCodigo || "",
        selectedEmpresaNombre: nombre || "",
        selectedInstanciaBD: instanciaBD || "",
      });
    },
    [emit]
  );

  const cargarEmpresas = useCallback(async () => {
    setLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      if (!window.api) throw new Error("La API de Electron (window.api) no está disponible.");

      // 0) Verificar BD local “manager”
      const chk = await window.api.hasManager?.();
      if (!chk?.ok) {
        setError("No se encuentra sistema Bejerman ERP instalado");
        setEmpresas([]);
        return;
      }

      // 1) Empresas locales habilitadas
      const res = await window.api.listEmpresasLocal?.();
      if (!res?.success) throw new Error(res?.message || "No se pudieron cargar las empresas locales.");
      const data = Array.isArray(res.data) ? res.data : [];
      setEmpresas(data);

      // 2) Restaurar selección
      const savedCode  = await window.api.getStoreValue?.("selectedEmpresaCodigo");
      const savedName  = await window.api.getStoreValue?.("selectedEmpresaNombre");
      const instDB     = await window.api.getStoreValue?.("selectedInstanciaBD");

      if (savedCode || instDB) {
        setSelectedCodigo(String(savedCode || ""));
        setIsConfigured(Boolean(instDB));
        if (instDB) setSuccessMessage(`Empresa seleccionada: ${savedName || savedCode}`);
      }
    } catch (err) {
      console.error("Error al cargar empresas:", err);
      setError(err.message || "Error al cargar empresas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargarEmpresas(); }, [cargarEmpresas]);

  // Reaccionar a selección emitida por main u otros
  useEffect(() => {
    const unsub = subscribe("empresa:selected", (payload) => {
      if (payload?.instanciaBD) {
        setIsConfigured(true);
        if (payload?.empCodigo) setSelectedCodigo(payload.empCodigo);
        setSuccessMessage(`Empresa seleccionada: ${payload?.nombre || payload?.empCodigo || ""}`);
        setError("");
      }
    });
    return unsub;
  }, [subscribe]);

  // Cambios en “store” (limpieza, logout, etc.)
  useEffect(() => {
    const unsub = subscribe("store:any-change", (delta) => {
      if ("selectedInstanciaBD" in delta && !delta.selectedInstanciaBD) {
        setIsConfigured(false);
        setSuccessMessage("");
      }
      if ("selectedEmpresaNombre" in delta) {
        const nombre = delta.selectedEmpresaNombre || "";
        if (nombre) setSuccessMessage(`Empresa seleccionada: ${nombre}`);
      }
    });
    return unsub;
  }, [subscribe]);

  // Cierre de sesión
  useEffect(() => {
    const unsub = subscribe("session:state", (s) => {
      if (s?.status === "logged-out") {
        setIsConfigured(false);
        setSelectedCodigo("");
        setSuccessMessage("");
        setError("Sesión finalizada. Iniciá sesión para seleccionar empresa.");
      }
    });
    return unsub;
  }, [subscribe]);

  const onSelectChange = (e) => {
    setSelectedCodigo(e.target.value);
    setError("");
    setSuccessMessage("");
  };

  const handleGuardar = async (e) => {
    e.preventDefault();
    if (!selectedCodigo) {
      setError("Debes seleccionar una empresa antes de guardar.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccessMessage("");

      const idCliente = await window.api.getStoreValue?.("idCliente");
      if (!idCliente) throw new Error("No se encontró idCliente. Inicie sesión.");

      // Verifica habilitación en nube y fija DB en properties + store
      const verify = await window.api.verifyEmpresaForUser?.({ idCliente, empCodigo: selectedCodigo });
      if (!verify?.success) throw new Error(verify?.message || "El usuario no está habilitado...");

      // Persistir datos útiles en store para UI
      const empLocal = empresas.find((x) => x.Codigo === selectedCodigo);
      const nombre   = verify?.data?.razonSocial || empLocal?.RazonSocial || selectedCodigo;

      await window.api.setStoreValue?.("selectedEmpresaCodigo", selectedCodigo);
      await window.api.setStoreValue?.("selectedEmpresaNombre", nombre);
      // selectedInstanciaBD lo seteó el main

      setIsConfigured(true);
      setSuccessMessage("¡Configuración guardada exitosamente!");
      setError("");

      // ⬅️ refresco fino (no recarga la página)
      notifyLiveRefresh({
        idCliente,
        empCodigo: selectedCodigo,
        instanciaBD: verify?.data?.instanciaBD,
        nombre,
      });
    } catch (err) {
      console.error("BDSelect handleGuardar:", err);
      setError(err.message || "El usuario no está habilitado para operar esa empresa.");
    } finally {
      setSaving(false);
    }
  };

  const handleModificar = async () => {
    try {
      setSaving(true);
      setError("");
      setSuccessMessage("");

      await window.api.setStoreValue?.("selectedEmpresaCodigo", "");
      await window.api.setStoreValue?.("selectedEmpresaNombre", "");
      await window.api.setStoreValue?.("selectedInstanciaBD", "");

      setIsConfigured(false);
      setSelectedCodigo("");
      setSuccessMessage("Selección borrada. Elegí otra empresa y guardá.");

      // Notificación de limpieza (refresco fino)
      const idCliente = await window.api.getStoreValue?.("idCliente");
      notifyLiveRefresh({
        idCliente,
        empCodigo: "",
        instanciaBD: "",
        nombre: "",
      });
    } catch (err) {
      console.error("Error al limpiar selección:", err);
      setError(err.message || "No se pudo limpiar la selección.");
    } finally {
      setSaving(false);
    }
  };

  if (loading && empresas.length === 0) {
    return <div className={styles.formCardContainer}>Cargando empresas...</div>;
  }

  return (
    <div className={styles.formCardContainer}>
      <h2>Seleccionar Empresa</h2>
      <form onSubmit={handleGuardar}>
        <div className={styles.field}>
          <label htmlFor="empresa-select" className={styles.label}>
            Empresa:
          </label>

          <select
            id="empresa-select"
            value={selectedCodigo}
            onChange={onSelectChange}
            className={styles.select}
            disabled={loading || isConfigured || saving}
          >
            <option value="">-- Seleccione una empresa --</option>
            {empresas.map((emp) => (
              <option key={emp.Codigo} value={emp.Codigo}>
                {emp.Codigo} - {emp.RazonSocial}
              </option>
            ))}
          </select>

          {isConfigured && (
            <div className={styles.infoSmall}>
              Usando:{" "}
              <strong>
                {(empresas.find((e) => e.Codigo === selectedCodigo)?.RazonSocial) || selectedCodigo}
              </strong>
            </div>
          )}
        </div>

        {isConfigured ? (
          <button
            type="button"
            className={styles.btn}
            onClick={handleModificar}
            disabled={loading || saving}
          >
            {saving ? "Procesando..." : "Modificar"}
          </button>
        ) : (
          <button
            type="submit"
            className={styles.btn}
            disabled={loading || saving || !selectedCodigo}
          >
            {saving ? "Guardando..." : "Aceptar"}
          </button>
        )}

        {error && <div className={styles.statusError}>Error: {error}</div>}
        {successMessage && <div className={styles.statusSuccess}>{successMessage}</div>}
      </form>
    </div>
  );
};

export default BDSelect;
