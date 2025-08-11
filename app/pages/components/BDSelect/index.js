// components/EmpresaSelected.jsx
"use client";
import React, { useState, useEffect, useCallback } from 'react';
import styles from './styles.module.css'; // Asegúrate de tener este archivo de estilos

const BDSelect = () => {
  const [empresas, setEmpresas] = useState([]);
  const [selectedEmpresaId, setSelectedEmpresaId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  const cargarEmpresas = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuccessMessage('');

    try {
      if (!window.api) {
        throw new Error("La API de Electron (window.api) no está disponible.");
      }

      // <-- MODIFICADO: Usar la API de store
      const idCliente = await window.api.getStoreValue('idCliente');
      if (!idCliente) {
        throw new Error("No se encontró 'idCliente'. Por favor, inicie sesión.");
      }

      const resultado = await window.api.getListadoEmpresas(idCliente);

      if (resultado.success && resultado.data) {
        setEmpresas(resultado.data);
      } else {
        throw new Error(resultado.message || "No se pudo cargar la lista de empresas.");
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

  const handleGuardarConfiguracion = async (event) => {
    event.preventDefault();

    if (!selectedEmpresaId) {
      setError("Debes seleccionar una empresa antes de guardar.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage('');

    try {
      const detallesResultado = await window.api.getDatosEmpresaById(selectedEmpresaId);

      if (!detallesResultado.success || !detallesResultado.data) {
        throw new Error(detallesResultado.message || "No se pudieron obtener los detalles de la empresa.");
      }

      const datosEmpresaCompletos = detallesResultado.data;
      const guardarResultado = await window.api.guardarConfiguracion(datosEmpresaCompletos);

      if (guardarResultado.success) {
        setSuccessMessage("¡Configuración guardada exitosamente!");
        
        // <-- MODIFICADO: Usar la API de store
        await window.api.setStoreValue('selectedEmpresaId', detallesResultado.data.nombreEmpresa);
      } else {
        throw new Error(guardarResultado.message || "Error al guardar la configuración.");
      }
    } catch (err) {
      console.error("Error en el proceso de guardado:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading && empresas.length === 0) {
    return <div className={styles['form-card-container']}>Cargando empresas...</div>;
  }
  return (
    <div className={styles['form-card-container']}>
      <h2>Seleccionar Empresa</h2>
      <form onSubmit={handleGuardarConfiguracion}>
        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="empresa-select" style={{ display: 'block', marginBottom: '5px' }}>
            Empresa:
          </label>
          <select
            id="empresa-select"
            value={selectedEmpresaId}
            onChange={(e) => {
              setSelectedEmpresaId(e.target.value);
              setError(null); // Limpia errores al cambiar la selección
              setSuccessMessage('');
            }}
            className={styles.select}
            disabled={loading}
          >
            <option value="">-- Seleccione una empresa --</option>
            {empresas.map((emp) => (
              // El `value` es el ID, pero el usuario ve el nombre
              <option key={emp.Id} value={emp.Id}>
                {emp.nombreEmpresa}
              </option>
            ))}
          </select>
        </div>

        {/* --- Botón para ejecutar la acción --- */}
        <button
          type="submit"
          className={styles.btn}
          disabled={loading || !selectedEmpresaId}
        >
          {loading ? 'Guardando...' : 'Guardar Configuración'}
        </button>

        {/* --- Mensajes de estado para el usuario --- */}
        {error && <div style={{ color: 'red', marginTop: '10px' }}>Error: {error}</div>}
        {successMessage && <div style={{ color: 'green', marginTop: '10px' }}>{successMessage}</div>}
      </form>
    </div>
  );
};

export default BDSelect;