// app/Cheques3/page.js
"use client";

import { useState, useEffect, useCallback } from 'react';
import pageStyles from './styles.module.css';
import ChequesRechazados from '../../components/CuadroChequesEdoR';

const fmtYYYYMMDD = (d) => {
  if (!(d instanceof Date) || isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export default function Cheques3() {
  const [idCliente, setIdCliente] = useState(null);
  const [chequesRechazados, setChequesRechazados] = useState([]);
  const [situaciones, setSituaciones] = useState([]);
  const [selectedChequesData, setSelectedChequesData] = useState({});
  const [importStatus, setImportStatus] = useState(null);
  const [importMessage, setImportMessage] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const [runLogs, setRunLogs] = useState([]);
  const [runErrors, setRunErrors] = useState([]);

  // 👇 NUEVO: campo elegido para actualizar
  const [fieldMode, setFieldMode] = useState('situacion'); // 'situacion' | 'fvto' | 'numero'

  useEffect(() => {
    const fetchIdCliente = async () => {
      if (window.api) {
        const storedId = await window.api.getStoreValue("idCliente");
        setIdCliente(storedId);
      }
    };
    fetchIdCliente();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!idCliente) return;

      setImportStatus('loading');
      setImportMessage('Cargando datos...');

      try {
        if (window.api?.getSituacion) {
          const response = await window.api.getSituacion();
          setSituaciones(response.success ? response.data : []);
        }

        if (window.api?.obtenerCheque3Rechazado) {
          const chequesResponse = await window.api.obtenerCheque3Rechazado(idCliente);
          if (chequesResponse.success) {
            const chequesData = chequesResponse.cheque.map(ch => {
              const idChequeString = String(ch.ch3_ID);
              let fvtoDate = null;

              if (ch.ch3_FVto) {
                let parsedDate = new Date(ch.ch3_FVto);
                if (!isNaN(parsedDate.getTime())) {
                  fvtoDate = parsedDate;
                } else {
                  const parts = String(ch.ch3_FVto).split('/');
                  if (parts.length === 3) {
                    const day = parseInt(parts[0], 10);
                    const month = parseInt(parts[1], 10) - 1;
                    const year = parseInt(parts[2], 10);
                    const customDate = new Date(year, month, day);
                    if (!isNaN(customDate.getTime())) fvtoDate = customDate;
                  }
                }
              }

              return {
                idCheque: idChequeString,
                emp: ch.ch3emp_Codigo,
                nroDefinitivo: ch.ch3_NroCheq,
                estado: ch.ch3_Edo,
                situacion: ch.ch3sit_Cod,
                suc: ch.ch3suc_Cod,
                fvtoRaw: fvtoDate,
                fvto: fvtoDate ? fvtoDate.toLocaleDateString() : '',
                fMod: ch.ch3_FCmbio || '',
                importe: ch.ch3_Importe ? parseFloat(ch.ch3_Importe).toLocaleString(undefined, { style: 'currency', currency: 'ARS' }) : '',
              };
            });
            setChequesRechazados(chequesData);

            const initial = {};
            chequesData.forEach(cheque => {
              initial[cheque.idCheque] = {
                isSelected: false,
                situacionId: '',
                situacionLabel: '',
                newValue: '',       // valor nuevo para el campo elegido
                newValueLabel: ''   // label si es situación
              };
            });
            setSelectedChequesData(initial);
          } else {
            setChequesRechazados([]);
            setSelectedChequesData({});
          }
        }

        setImportStatus(null);
        setImportMessage('');
      } catch (error) {
        console.error("Error en la carga inicial de datos:", error);
        setImportStatus('error');
        setImportMessage('Error general al cargar los datos.');
        setChequesRechazados([]);
        setSituaciones([]);
        setSelectedChequesData([]);
      }
    };

    fetchData();
  }, [idCliente]);

  const primeDefaultsForField = useCallback((row, mode) => {
    if (!row) return { value: '', label: '' };
    if (mode === 'situacion') {
      const code = row.situacion ? String(row.situacion) : '';
      const s = situaciones.find(x => String(x.sit_Cod) === code);
      return { value: code, label: s ? s.sit_Desc : '' };
    }
    if (mode === 'fvto') {
      return { value: fmtYYYYMMDD(row.fvtoRaw), label: '' };
    }
    if (mode === 'numero') {
      return { value: row.nroDefinitivo ? String(row.nroDefinitivo) : '', label: '' };
    }
    return { value: '', label: '' };
  }, [situaciones]);

  const handleChequeToggle = useCallback((idCheque) => {
    setSelectedChequesData(prevData => {
      const curr = prevData[idCheque] || { isSelected: false, situacionId: '', situacionLabel: '', newValue: '', newValueLabel: '' };
      const newState = !curr.isSelected;

      const row = chequesRechazados.find(ch => String(ch.idCheque) === String(idCheque));
      const defaults = newState ? primeDefaultsForField(row, fieldMode) : { value: '', label: '' };

      const baseSit = row?.situacion ? String(row.situacion) : '';
      const found = situaciones.find(s => String(s.sit_Cod) === baseSit);
      const baseLabel = found ? found.sit_Desc : '';

      return {
        ...prevData,
        [idCheque]: {
          ...curr,
          isSelected: newState,
          situacionId: newState ? (curr.situacionId || baseSit) : '',
          situacionLabel: newState ? (curr.situacionLabel || baseLabel) : '',
          newValue: defaults.value,
          newValueLabel: defaults.label
        }
      };
    });
  }, [chequesRechazados, situaciones, fieldMode, primeDefaultsForField]);

  const handleFieldModeChange = useCallback((mode) => {
    setFieldMode(mode);
    // Pre-cargar valores por defecto del nuevo campo para los seleccionados
    setSelectedChequesData(prev => {
      const clone = { ...prev };
      Object.keys(clone).forEach(id => {
        if (!clone[id]?.isSelected) return;
        const row = chequesRechazados.find(ch => String(ch.idCheque) === String(id));
        const d = primeDefaultsForField(row, mode);
        clone[id].newValue = d.value;
        clone[id].newValueLabel = d.label;
      });
      return clone;
    });
  }, [chequesRechazados, primeDefaultsForField]);

  const handleRowValueChange = useCallback((idCheque, value) => {
    setSelectedChequesData(prev => {
      const curr = prev[idCheque] || {};
      let nv = String(value || '');
      let nvl = '';
      if (fieldMode === 'situacion') {
        const s = situaciones.find(x => String(x.sit_Cod) === nv);
        nvl = s ? s.sit_Desc : '';
      }
      return {
        ...prev,
        [idCheque]: { ...curr, newValue: nv, newValueLabel: nvl }
      };
    });
  }, [fieldMode, situaciones]);

  const handleGlobalValueChange = useCallback((value) => {
    const nv = String(value || '');
    const s = fieldMode === 'situacion'
      ? situaciones.find(x => String(x.sit_Cod) === nv)
      : null;
    const nvl = s ? s.sit_Desc : '';

    setSelectedChequesData(prev => {
      const out = {};
      Object.keys(prev).forEach(id => {
        const curr = prev[id] || {};
        out[id] = {
          ...curr,
          newValue: curr.isSelected ? nv : curr.newValue,
          newValueLabel: curr.isSelected ? nvl : curr.newValueLabel,
          // Para mantener compatibilidad visual de columna Situación:
          situacionId: fieldMode === 'situacion' && curr.isSelected ? nv : curr.situacionId,
          situacionLabel: fieldMode === 'situacion' && curr.isSelected ? nvl : curr.situacionLabel
        };
      });
      return out;
    });
  }, [fieldMode, situaciones]);

  const selectAllCheques = useCallback((checked) => {
    setSelectedChequesData(prev => {
      const newData = {};
      chequesRechazados.forEach(ch => {
        const defaults = checked ? primeDefaultsForField(ch, fieldMode) : { value: '', label: '' };
        newData[ch.idCheque] = {
          isSelected: checked,
          situacionId: checked ? (prev[ch.idCheque]?.situacionId || (ch.situacion ? String(ch.situacion) : '')) : '',
          situacionLabel: checked ? (prev[ch.idCheque]?.situacionLabel || '') : '',
          newValue: defaults.value,
          newValueLabel: defaults.label
        };
      });
      return newData;
    });
  }, [chequesRechazados, fieldMode, primeDefaultsForField]);

  const reloadAfterUpdate = useCallback(async () => {
    try {
      if (window.api?.obtenerCheque3Rechazado && idCliente) {
        const chequesResponse = await window.api.obtenerCheque3Rechazado(idCliente);
        if (chequesResponse.success) {
          const chequesData = chequesResponse.cheque.map(ch => {
            const idChequeString = String(ch.ch3_ID);
            let fvtoDate = null;
            if (ch.ch3_FVto) {
              let parsedDate = new Date(ch.ch3_FVto);
              if (!isNaN(parsedDate.getTime())) {
                fvtoDate = parsedDate;
              } else {
                const parts = String(ch.ch3_FVto).split('/');
                if (parts.length === 3) {
                  const day = parseInt(parts[0], 10);
                  const month = parseInt(parts[1], 10) - 1;
                  const year = parseInt(parts[2], 10);
                  const customDate = new Date(year, month, day);
                  if (!isNaN(customDate.getTime())) fvtoDate = customDate;
                }
              }
            }
            return {
              idCheque: idChequeString,
              emp: ch.ch3emp_Codigo,
              nroDefinitivo: ch.ch3_NroCheq,
              estado: ch.ch3_Edo,
              situacion: ch.ch3sit_Cod,
              suc: ch.ch3suc_Cod,
              fvtoRaw: fvtoDate,
              fvto: fvtoDate ? fvtoDate.toLocaleDateString() : '',
              fMod: ch.ch3_FCmbio || '',
              importe: ch.ch3_Importe ? parseFloat(ch.ch3_Importe).toLocaleString(undefined, { style: 'currency', currency: 'ARS' }) : '',
            };
          });

          setChequesRechazados(chequesData);
          const initialSelected = {};
          chequesData.forEach(cheque => {
            initialSelected[cheque.idCheque] = { isSelected: false, situacionId: '', situacionLabel: '', newValue: '', newValueLabel: '' };
          });
          setSelectedChequesData(initialSelected);
          setRefreshKey(k => k + 1);
        } else {
          setChequesRechazados([]);
          setSelectedChequesData({});
        }
      }
    } catch (e) {
      console.error("Error al recargar datos:", e);
    }
  }, [idCliente]);

  const handleImportarClick = async () => {
    setRunLogs([]);
    setRunErrors([]);

    const items = Object.keys(selectedChequesData)
      .filter(id => selectedChequesData[id]?.isSelected && selectedChequesData[id]?.newValue !== '')
      .map(id => ({
        idCheque: parseInt(id, 10),
        value: selectedChequesData[id].newValue
      }));

    if (items.length === 0) {
      setImportStatus('info');
      setImportMessage('Seleccioná al menos un cheque y cargá el valor para actualizar.');
      setTimeout(() => { setImportStatus(null); setImportMessage(''); }, 2500);
      return;
    }

    setImportStatus('loading');
    setImportMessage('Actualizando cheques...');

    try {
      if (window.api?.updateCheque3Field) {
        const logs = [];
        const errs = [];

        await Promise.all(items.map(async (it) => {
          try {
            const res = await window.api.updateCheque3Field(it.idCheque, fieldMode, it.value);
            if (!res?.success) {
              errs.push(`Cheque ${it.idCheque}: ${res?.message || 'Fallo al actualizar.'}`);
            } else {
              logs.push(`Cheque ${it.idCheque}: ${res.message || 'Actualizado.'}`);
              // Si es situación => escribir registro histórico
              if (fieldMode === 'situacion') {
                const row = chequesRechazados.find(ch => String(ch.idCheque) === String(it.idCheque));
                const reg = await window.api.setRegistro(row?.emp, row?.suc, it.idCheque, it.value, row?.situacion);
                if (reg?.success === false) {
                  errs.push(`Registro situación ${it.idCheque}: ${reg?.message || 'Fallo registrando.'}`);
                } else if (reg?.message) {
                  logs.push(`Registro situación ${it.idCheque}: ${reg.message}`);
                }
              }
            }
          } catch (e) {
            errs.push(`Cheque ${it.idCheque}: ${e?.message || 'Error inesperado.'}`);
          }
        }));

        setRunLogs(logs);
        setRunErrors(errs);
        if (errs.length === 0) {
          setImportStatus('success');
          setImportMessage('Actualización completada.');
        } else if (errs.length < items.length) {
          setImportStatus('info');
          setImportMessage(`Con advertencias: ${errs.length} error(es).`);
        } else {
          setImportStatus('error');
          setImportMessage('No se pudo actualizar ninguno.');
        }

        await reloadAfterUpdate();
      } else {
        setImportStatus('error');
        setImportMessage('API no disponible.');
      }
    } catch (error) {
      console.error("Error al importar cheques:", error);
      setImportStatus('error');
      setImportMessage('Error inesperado al actualizar.');
    } finally {
      setTimeout(() => { setImportStatus(null); setImportMessage(''); }, 3000);
    }
  };

  const isImportButtonDisabled = importStatus === 'loading';

  return (
    <div className={pageStyles.body}>
      <ChequesRechazados
        chequesRechazados={chequesRechazados}
        situaciones={situaciones}
        onChequeToggle={handleChequeToggle}
        selectedChequesData={selectedChequesData}
        onImportarClick={handleImportarClick}
        isImportButtonDisabled={isImportButtonDisabled}
        importStatus={importStatus}
        importMessage={importMessage}
        onSelectAllChange={selectAllCheques}
        refreshKey={refreshKey}
        runLogs={runLogs}
        runErrors={runErrors}

        fieldMode={fieldMode}
        onFieldModeChange={handleFieldModeChange}
        onRowValueChange={handleRowValueChange}
        onGlobalValueChange={handleGlobalValueChange}
      />
    </div>
  );
}
