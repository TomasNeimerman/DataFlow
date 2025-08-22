// components/EmpresaSelected.jsx
"use client";
import React, { useState, useEffect, useCallback } from 'react';
import styles from './styles.module.css';

const BDSelect = () => {
  const [empresas, setEmpresas] = useState([]);
  const [selectedEmpresaId, setSelectedEmpresaId] = useState('');
  const [selectedEmpresaNombre, setSelectedEmpresaNombre] = useState('');
  const [isConfigured, setIsConfigured] = useState(false); // <-- NUEVO: modo bloqueado (ya guardado)
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

      // Id del cliente desde electron-store
      const idCliente = await window.api.getStoreValue('idCliente');
      if (!idCliente) {
        throw new Error("No se encontró 'idCliente'. Por favor, inicie sesión.");
      }

      // Traer listado de empresas
      const resultado = await window.api.getListadoEmpresas(idCliente);
      if (!(resultado?.success) || !Array.isArray(resultado.data)) {
        throw new Error(resultado?.message || "No se pudo cargar la lista de empresas.");
      }
      setEmpresas(resultado.data);

      // Intentar restaurar la selección previa desde el store
      const savedId = await window.api.getStoreValue('selectedEmpresaId');
      const savedName = await window.api.getStoreValue('selectedEmpresaNombre'); // opcional
      if (savedId) {
        setSelectedEmpresaId(String(savedId));
        // si no hay nombre guardado, lo buscamos del listado
        const emp = resultado.data.find(e => String(e.Id) === String(savedId));
        const nombre = savedName || emp?.nombreEmpresa || '';
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

  // Guardar selección (bloquea selector y persiste)
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
      // Traer detalles de la empresa elegida
      const detallesResultado = await window.api.getDatosEmpresaById(selectedEmpresaId);
      if (!detallesResultado?.success || !detallesResultado.data) {
        throw new Error(detallesResultado?.message || "No se pudieron obtener los detalles de la empresa.");
      }

      const datosEmpresaCompletos = detallesResultado.data;

      // Guardar configuración en backend/local según tu IPC
      const guardarResultado = await window.api.guardarConfiguracion(datosEmpresaCompletos);
      if (!guardarResultado?.success) {
        throw new Error(guardarResultado?.message || "Error al guardar la configuración.");
      }

      // Persistir en electron-store (ID + nombre para mostrar)
      const emp = empresas.find(e => String(e.Id) === String(selectedEmpresaId));
      const nombre = emp?.nombreEmpresa || datosEmpresaCompletos?.nombreEmpresa || '';
      await window.api.setStoreValue('selectedEmpresaId', String(selectedEmpresaId));
      await window.api.setStoreValue('selectedEmpresaNombre', nombre);

      setSelectedEmpresaNombre(nombre);
      setIsConfigured(true);
      setSuccessMessage("¡Configuración guardada exitosamente!");
    } catch (err) {
      console.error("Error en el proceso de guardado:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Modificar: limpia selección guardada y habilita nuevamente el selector
  const handleModificar = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccessMessage('');
      // Si tenés un IPC específico para delete, usalo; aquí usamos set a vacío/null
      await window.api.setStoreValue('selectedEmpresaId', '');
      await window.api.setStoreValue('selectedEmpresaNombre', '');

      setIsConfigured(false);
      setSelectedEmpresaId('');
      setSelectedEmpresaNombre('');
      setSuccessMessage('Selección borrada. Elegí otra empresa y guardá.');
    } catch (err) {
      console.error("Error al limpiar selección:", err);
      setError(err.message || 'No se pudo limpiar la selección guardada.');
    } finally {
      setLoading(false);
    }
  };

  const onSelectChange = (e) => {
    setSelectedEmpresaId(e.target.value);
    setError(null);
    setSuccessMessage('');
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
            onChange={onSelectChange}
            className={styles.select}
            disabled={loading || isConfigured}     
          >
            <option value="">-- Seleccione una empresa --</option>
            {empresas.map((emp) => (
              <option key={emp.Id} value={emp.Id}>
                {emp.nombreEmpresa}
              </option>
            ))}
          </select>

          {/* Texto auxiliar cuando está bloqueado */}
          {isConfigured && selectedEmpresaNombre && (
            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
              Usando: <strong>{selectedEmpresaNombre}</strong>
            </div>
          )}
        </div>

        {/* Botón único que cambia de comportamiento */}
        {isConfigured ? (
          <button
            type="button"
            className={styles.btn}
            onClick={handleModificar}
            disabled={loading}
          >
            {loading ? 'Procesando...' : 'Modificar'}
          </button>
        ) : (
          <button
            type="submit"
            className={styles.btn}
            disabled={loading || !selectedEmpresaId}
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        )}

        {/* Mensajes de estado */}
        {error && <div style={{ color: 'red', marginTop: '10px' }}>Error: {error}</div>}
        {successMessage && <div style={{ color: 'green', marginTop: '10px' }}>{successMessage}</div>}
      </form>
    </div>
  );
};

export default BDSelect;
