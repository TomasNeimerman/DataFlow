// components/EmpresaSelected.jsx
"use client";
import React, { useState, useEffect, useCallback } from 'react';
import styles from './styles.module.css';

const BDSelect = () => {
  const [empresas, setEmpresas] = useState([]);
  const [selectedEmpresaId, setSelectedEmpresaId] = useState('');
  const [selectedEmpresaNombre, setSelectedEmpresaNombre] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  // nuevo: flags/resultado de comparación ODBC vs Nube
  const [isDev, setIsDev] = useState(true);
  const [cmpLoading, setCmpLoading] = useState(false);
  const [cmpError, setCmpError] = useState(null);
  const [cmpResult, setCmpResult] = useState(null);

  // --- helpers visuales para el cuadro de comparación ---
  const Box = ({ children, tone = 'neutral' }) => {
    const tones = {
      neutral: { border: '#d0d7de', bg: '#f6f8fa' },
      warn: { border: '#ffb900', bg: '#fff8e1' },
      ok: { border: '#2da44e', bg: '#e9fbe9' },
      err: { border: '#d1242f', bg: '#fde8e8' },
    }[tone] || { border: '#d0d7de', bg: '#f6f8fa' };
    return (
      <div style={{
        marginTop: 12,
        padding: 10,
        border: `1px solid ${tones.border}`,
        background: tones.bg,
        borderRadius: 8,
        fontSize: 13,
        lineHeight: 1.35,
      }}>
        {children}
      </div>
    );
  };

  // Carga inicial: saber si es dev o distrib.
  useEffect(() => {
    (async () => {
      try {
        const dev = await window?.api?.isDev?.();
        setIsDev(!!dev);
      } catch {
        setIsDev(true);
      }
    })();
  }, []);

  const runComparison = useCallback(async (idCliente) => {
    if (isDev) return; // sólo comparar en distribuible (no dev)
    if (!window.api?.compareEmpresasCloud) return;

    setCmpLoading(true);
    setCmpError(null);
    setCmpResult(null);

    try {
      const res = await window.api.compareEmpresasCloud(idCliente);
      if (!res?.success) {
        setCmpError(res?.message || 'No se pudo comparar ODBC vs Nube.');
        console.error('[ODBC cmp] error:', res);
        return;
      }
      setCmpResult(res);

      // Debug rico en consola
      try {
        console.groupCollapsed('%cComparación ODBC vs Nube', 'color:#555;font-weight:bold;');
        console.log('totals:', res.totals);
        if (Array.isArray(res.inCloudNotLocal) && res.inCloudNotLocal.length) {
          console.log('En la nube pero NO en local (ODBC):', res.inCloudNotLocal.length);
          console.table(res.inCloudNotLocal.slice(0, 20));
        }
        if (Array.isArray(res.inLocalNotCloud) && res.inLocalNotCloud.length) {
          console.log('En local (ODBC) pero NO en la nube:', res.inLocalNotCloud.length);
          console.table(res.inLocalNotCloud.slice(0, 20));
        }
        if (Array.isArray(res.matched) && res.matched.length) {
          console.log('Coincidencias (muestras):', Math.min(res.matched.length, 10));
          console.table(res.matched.slice(0, 10).map(x => ({
            cloud_db: x.cloud?.dbName,
            local_db: x.local?.dbName,
            cloud_name: x.cloud?.name,
            local_name: x.local?.name,
          })));
        }
        console.groupEnd();
      } catch {}
    } catch (e) {
      setCmpError(e?.message || 'Fallo comparación ODBC vs Nube.');
      console.error('[ODBC cmp] exception:', e);
    } finally {
      setCmpLoading(false);
    }
  }, [isDev]);

  const cargarEmpresas = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuccessMessage('');

    try {
      if (!window.api) {
        throw new Error("La API de Electron (window.api) no está disponible.");
      }

      const idCliente = await window.api.getStoreValue('idCliente');
      if (!idCliente) {
        throw new Error("No se encontró 'idCliente'. Por favor, inicie sesión.");
      }

      const resultado = await window.api.getListadoEmpresas(idCliente);
      if (!(resultado?.success) || !Array.isArray(resultado.data)) {
        throw new Error(resultado?.message || "No se pudo cargar la lista de empresas.");
      }
      setEmpresas(resultado.data);

      // Restaurar selección
      const savedId = await window.api.getStoreValue('selectedEmpresaId');
      const savedName = await window.api.getStoreValue('selectedEmpresaNombre');
      if (savedId) {
        setSelectedEmpresaId(String(savedId));
        const emp = resultado.data.find(e => String(e.Id) === String(savedId));

        const nombre =
          savedName ||
          emp?.RazonSocial ||
          emp?.nombreEmpresa || '';

        setSelectedEmpresaNombre(nombre);
        setIsConfigured(true);
        setSuccessMessage(`Empresa seleccionada: ${nombre || savedId}`);
      }

      // 🔎 Comparación ODBC vs Nube solo si no es dev
      await runComparison(idCliente);
    } catch (err) {
      console.error("Error al cargar empresas:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [runComparison]);

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
      if (!detallesResultado?.success || !detallesResultado.data) {
        throw new Error(detallesResultado?.message || "No se pudieron obtener los detalles de la empresa.");
      }

      const datosEmpresaCompletos = detallesResultado.data;

      const guardarResultado = await window.api.guardarConfiguracion(datosEmpresaCompletos);
      if (!guardarResultado?.success) {
        throw new Error(guardarResultado?.message || "Error al guardar la configuración.");
      }

      const emp = empresas.find(e => String(e.Id) === String(selectedEmpresaId));
      const nombre =
        emp?.RazonSocial ||
        datosEmpresaCompletos?.RazonSocial ||
        datosEmpresaCompletos?.razonSocial ||
        emp?.nombreEmpresa ||
        datosEmpresaCompletos?.nombreEmpresa ||
        '';

      await window.api.setStoreValue('selectedEmpresaId', String(selectedEmpresaId));
      await window.api.setStoreValue('selectedEmpresaNombre', nombre);

      setSelectedEmpresaNombre(nombre);
      setIsConfigured(true);
      setSuccessMessage("¡Configuración guardada exitosamente!");

      try {
        window.dispatchEvent(new CustomEvent('empresa:selected', {
          detail: { id: String(selectedEmpresaId), nombre }
        }));
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
      setSuccessMessage('');
      await window.api.setStoreValue('selectedEmpresaId', '');
      await window.api.setStoreValue('selectedEmpresaNombre', '');
      setIsConfigured(false);
      setSelectedEmpresaId('');
      setSelectedEmpresaNombre('');
      setSuccessMessage('Selección borrada. Elegí otra empresa y guardá.');

      try {
        window.dispatchEvent(new CustomEvent('empresa:selected', {
          detail: { id: '', nombre: '' }
        }));
      } catch {}
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

  // ---- Info de comparación, solo si no es dev y ya corrió ---
  const renderComparisonInfo = () => {
    if (isDev) return null;
    if (cmpLoading) return <Box tone="neutral">Verificando bases locales (ODBC) vs nube…</Box>;
    if (cmpError) return <Box tone="err">Comparación ODBC falló: {cmpError}</Box>;
    if (!cmpResult) return null;

    const t = cmpResult.totals || {};
    const hasDiff = (t.inCloudNotLocal || 0) > 0 || (t.inLocalNotCloud || 0) > 0;

    return (
      <Box tone={hasDiff ? 'warn' : 'ok'}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>
          Verificación ODBC vs Nube {hasDiff ? '— hay diferencias' : '— todo OK'}.
        </div>
        <div>Total en nube: <b>{t.cloud ?? 0}</b> · En local (ODBC): <b>{t.local ?? 0}</b> · Coinciden: <b>{t.matched ?? 0}</b></div>
        <div>Solo nube: <b>{t.inCloudNotLocal ?? 0}</b> · Solo local: <b>{t.inLocalNotCloud ?? 0}</b></div>

        {/* Muestras cortas si hay diferencias */}
        {hasDiff && (
          <div style={{ marginTop: 6 }}>
            <div style={{ marginTop: 4 }}>
              {Array.isArray(cmpResult.inCloudNotLocal) && cmpResult.inCloudNotLocal.length > 0 && (
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>En la nube y NO en local (primeras 5):</div>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {cmpResult.inCloudNotLocal.slice(0, 5).map((x, i) => (
                      <li key={`cloud-miss-${i}`}>{x?.dbName || '(sin db)'} — {x?.name || ''}</li>
                    ))}
                  </ul>
                </div>
              )}
              {Array.isArray(cmpResult.inLocalNotCloud) && cmpResult.inLocalNotCloud.length > 0 && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>En local y NO en la nube (primeras 5):</div>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {cmpResult.inLocalNotCloud.slice(0, 5).map((x, i) => (
                      <li key={`local-miss-${i}`}>{x?.dbName || '(sin db)'} — {x?.name || ''}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
              Tip: abrí la consola para ver tablas completas de diferencias.
            </div>
          </div>
        )}
      </Box>
    );
  };

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

          {isConfigured && selectedEmpresaNombre && (
            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
              Usando: <strong>{selectedEmpresaNombre}</strong>
            </div>
          )}
        </div>

        {isConfigured ? (
          <button type="button" className={styles.btn} onClick={handleModificar} disabled={loading}>
            {loading ? 'Procesando...' : 'Modificar'}
          </button>
        ) : (
          <button type="submit" className={styles.btn} disabled={loading || !selectedEmpresaId}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        )}

        {error && <div style={{ color: 'red', marginTop: '10px' }}>Error: {error}</div>}
        {successMessage && <div style={{ color: 'green', marginTop: '10px' }}>{successMessage}</div>}

        {/* Bloque de verificación ODBC vs Nube (solo distribuible) */}
        {renderComparisonInfo()}
      </form>
    </div>
  );
};

export default BDSelect;
