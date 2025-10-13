//components/BDSelect
"use client";
import React, { useState, useEffect, useCallback } from "react";
import styles from "./styles.module.css";

const BDSelect = () => {
  // Empresas locales: [{ Codigo, RazonSocial, Cuit }]
  const [empresas, setEmpresas] = useState([]);
  const [selectedCodigo, setSelectedCodigo] = useState("");
  const [isConfigured, setIsConfigured] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const cargarEmpresas = useCallback(async () => {
    setLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      if (!window.api) throw new Error("La API de Electron (window.api) no está disponible.");

      // 0) Verificar que exista la BD local "manager"
      const chk = await window.api.hasManager?.();
      if (!chk?.ok) {
        setError("No se encuentra sistema Bejerman ERP instalado");
        setEmpresas([]);
        return;
      }

      // 1) Traer empresas locales habilitadas (manager.dbo.emp WHERE emp_habili = 1)
      const res = await window.api.listEmpresasLocal?.();
      if (!res?.success) throw new Error(res?.message || "No se pudieron cargar las empresas locales.");
      const data = Array.isArray(res.data) ? res.data : [];
      setEmpresas(data);

      // 2) Restaurar selección previa (si existe)
      const savedCode = await window.api.getStoreValue("selectedEmpresaCodigo");
      const savedName = await window.api.getStoreValue("selectedEmpresaNombre");

      if (savedCode) {
        setSelectedCodigo(String(savedCode));
        setIsConfigured(true);
        setSuccessMessage(`Empresa seleccionada: ${savedName || savedCode}`);
      }
    } catch (err) {
      console.error("Error al cargar empresas:", err);
      setError(err.message || "Error al cargar empresas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarEmpresas();
  }, [cargarEmpresas]);

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

      // 1) Id del cliente (guardado en el login)
      const idCliente = await window.api.getStoreValue("idCliente");
      if (!idCliente) throw new Error("No se encontró idCliente. Inicie sesión.");

      // 2) Verificar en nube si está habilitado (Nombre == emp_codigo) y escribir properties si corresponde
const verify = await window.api.verifyEmpresaForUser?.({ idCliente, empCodigo: selectedCodigo });
if (!verify?.success) throw new Error(verify?.message || "El usuario no esta habilitado...");

const empLocal = empresas.find((x) => x.Codigo === selectedCodigo);
const razon = verify?.data?.razonSocial || empLocal?.RazonSocial || selectedCodigo;

// guardá también la DB activa
await window.api.setStoreValue({ key: "selectedEmpresaCodigo", value: selectedCodigo });
await window.api.setStoreValue({ key: "selectedEmpresaNombre", value: razon });
await window.api.setStoreValue({ key: "selectedInstanciaBD", value: verify?.data?.instanciaBD }); // 👈 NUEVO

      setIsConfigured(true);
      setSuccessMessage("¡Configuración guardada exitosamente!");

      // 4) Notificar a otros componentes (EmpresaSelected)
      try {
        window.dispatchEvent(
          new CustomEvent("empresa:selected", { detail: { id: selectedCodigo, nombre: razon } })
        );
      } catch {}
    } catch (err) {
      console.error("BDSelect handleGuardar:", err);
      setError(err.message || "El usuario no esta habilitado para operar esa empresa");
    } finally {
      setSaving(false);
    }
  };

  const handleModificar = async () => {
    try {
      setSaving(true);
      setError("");
      setSuccessMessage("");

      await window.api.setStoreValue("selectedEmpresaCodigo", "");
      await window.api.setStoreValue("selectedEmpresaNombre", "");

      setIsConfigured(false);
      setSelectedCodigo("");
      setSuccessMessage("Selección borrada. Elegí otra empresa y guardá.");

      try {
        window.dispatchEvent(new CustomEvent("empresa:selected", { detail: { id: "", nombre: "" } }));
      } catch {}
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
