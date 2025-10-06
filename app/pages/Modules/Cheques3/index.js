// app/Cheques3/page.js
"use client";

import { useState, useEffect, useCallback } from 'react';
import pageStyles from './styles.module.css';
import ChequesRechazados from '../../components/CuadroChequesEdoR';

export default function Cheques3() {
  const [idCliente, setIdCliente] = useState(null);
  const [chequesRechazados, setChequesRechazados] = useState([]);
  const [situaciones, setSituaciones] = useState([]);
  const [selectedChequesData, setSelectedChequesData] = useState({});
  const [importStatus, setImportStatus] = useState(null);
  const [importMessage, setImportMessage] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  // 🔵 logs y errores de la corrida (lo que querés arriba del botón)
  const [runLogs, setRunLogs] = useState([]);   // info + “no se requiere…”
  const [runErrors, setRunErrors] = useState([]); // errores reales

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
                fvto: fvtoDate ? fvtoDate.toLocaleDateString('es-AR') : '',
                fMod: ch.ch3_FCmbio ? new Date(ch.ch3_FCmbio).toLocaleDateString('es-AR') : '',
                importe: ch.ch3_Importe ? parseFloat(ch.ch3_Importe).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' }) : '',
              };
            });
            setChequesRechazados(chequesData);

            const initial = {};
            chequesData.forEach(cheque => {
              initial[cheque.idCheque] = { isSelected: false, situacionId: '', situacionLabel: '' };
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
        setSelectedChequesData({});
      }
    };

    fetchData();
  }, [idCliente]);

  // ✅ toggle individual
  const handleChequeToggle = useCallback((idCheque) => {
    setSelectedChequesData(prevData => {
      const curr = prevData[idCheque] || { isSelected: false, situacionId: '', situacionLabel: '' };
      const newState = !curr.isSelected;
      return {
        ...prevData,
        [idCheque]: {
          ...curr,
          isSelected: newState,
          situacionId: newState ? curr.situacionId : '',
          situacionLabel: newState ? curr.situacionLabel : ''
        }
      };
    });
  }, []);

  // (compatibilidad si querés usarlo por fila)
  const handleSituacionChange = useCallback((idCheque, selectedValue) => {
    setSelectedChequesData(prevData => {
      const sanitized = String(selectedValue || '');
      const selectedSit = situaciones.find(sit => String(sit.sit_Cod) === sanitized);
      const label = selectedSit ? selectedSit.sit_Desc : '';
      return {
        ...prevData,
        [idCheque]: {
          ...prevData[idCheque],
          situacionId: sanitized,
          situacionLabel: label
        }
      };
    });
  }, [situaciones]);

  // ✅ seleccionar TODOS desde el header
  const selectAllCheques = useCallback((checked) => {
    setSelectedChequesData(prev => {
      const newData = {};
      chequesRechazados.forEach(ch => {
        newData[ch.idCheque] = {
          isSelected: checked,
          situacionId: checked ? (prev[ch.idCheque]?.situacionId || '') : '',
          situacionLabel: checked ? (prev[ch.idCheque]?.situacionLabel || '') : ''
        };
      });
      return newData;
    });
  }, [chequesRechazados]);

  // ✅ un solo select global que aplica la situación a TODOS los seleccionados
  const handleGlobalSituacionChange = useCallback((selectedValue) => {
    const sanitized = String(selectedValue || '');
    const selectedSit = situaciones.find(sit => String(sit.sit_Cod) === sanitized);
    const label = selectedSit ? selectedSit.sit_Desc : '';

    setSelectedChequesData(prev => {
      const newData = {};
      Object.keys(prev).forEach(id => {
        const curr = prev[id] || {};
        newData[id] = {
          ...curr,
          situacionId: curr.isSelected ? sanitized : (curr.situacionId || ''),
          situacionLabel: curr.isSelected ? label : (curr.situacionLabel || '')
        };
      });
      return newData;
    });
  }, [situaciones]);

  // 🔁 recarga post-actualización
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
              fvto: fvtoDate ? fvtoDate.toLocaleDateString('es-AR') : '',
              fMod: ch.ch3_FCmbio ? new Date(ch.ch3_FCmbio).toLocaleDateString('es-AR') : '',
              importe: ch.ch3_Importe ? parseFloat(ch.ch3_Importe).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' }) : '',
            };
          });

          setChequesRechazados(chequesData);
          const initialSelected = {};
          chequesData.forEach(cheque => {
            initialSelected[cheque.idCheque] = { isSelected: false, situacionId: '', situacionLabel: '' };
          });
          setSelectedChequesData(initialSelected);
          setRefreshKey(k => k + 1); // fuerza relectura de “Fecha modificación”
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
    setRunLogs([]);   // limpiamos logs previos
    setRunErrors([]); // limpiamos errores previos

    const chequesParaActualizar = Object.keys(selectedChequesData)
      .filter(id => selectedChequesData[id]?.isSelected && selectedChequesData[id]?.situacionId)
      .map(id => ({
        idCheque: parseInt(id, 10),
        situacionId: selectedChequesData[id].situacionId
      }));

    if (chequesParaActualizar.length === 0) {
      setImportStatus('info');
      setImportMessage('No hay cheques seleccionados con situación para importar.');
      setTimeout(() => { setImportStatus(null); setImportMessage(''); }, 3000);
      return;
    }

    setImportStatus('loading');
    setImportMessage('Importando cheques seleccionados...');

    try {
      if (window.api?.updateCheque3) {
        const opLogs = [];
        const opErrors = [];

        await Promise.all(
          chequesParaActualizar.map(async (cheque) => {
            try {
              const upd = await window.api.updateCheque3(cheque.idCheque, cheque.situacionId);
              if (upd?.message) opLogs.push(`Cheque ${cheque.idCheque}: ${upd.message}`);
              if (!upd?.success) opErrors.push(`Cheque ${cheque.idCheque}: ${upd?.message || 'Fallo actualizando.'}`);

              const row = chequesRechazados.find(ch => String(ch.idCheque) === String(cheque.idCheque));
              const reg = await window.api.setRegistro(row?.emp, row?.suc, cheque.idCheque, cheque.situacionId, row?.situacion);
              if (reg?.message) opLogs.push(`Cheque ${cheque.idCheque}: ${reg.message}`);
              if (reg && reg.success === false) opErrors.push(`Cheque ${cheque.idCheque}: ${reg.message || 'Fallo registrando cambio.'}`);
            } catch (error) {
              opErrors.push(`Cheque ${cheque.idCheque}: ${error.message || 'Error desconocido.'}`);
            }
          })
        );

        setRunLogs(opLogs);
        setRunErrors(opErrors);

        if (opErrors.length === 0) {
          setImportStatus('success');
          setImportMessage('Todos los cheques procesados.');
        } else if (opErrors.length < chequesParaActualizar.length) {
          setImportStatus('info');
          setImportMessage(`Procesados con observaciones: ${opErrors.length} fallo(s).`);
        } else {
          setImportStatus('error');
          setImportMessage('No se pudo procesar ninguno.');
        }

        await reloadAfterUpdate();
      } else {
        setImportStatus('error');
        setImportMessage('API updateCheque3 no disponible.');
      }
    } catch (error) {
      console.error("Error al importar cheques:", error);
      setImportStatus('error');
      setImportMessage('Ocurrió un error inesperado al importar.');
    } finally {
      setTimeout(() => {
        setImportStatus(null);
        setImportMessage('');
      }, 3000);
    }
  };

  // botón deshabilitado solo si está cargando
  const isImportButtonDisabled = importStatus === 'loading';

  return (
    <div className={pageStyles.body}>
      <ChequesRechazados
        chequesRechazados={chequesRechazados}
        situaciones={situaciones}
        onChequeToggle={handleChequeToggle}
        onSituacionChange={handleSituacionChange}
        selectedChequesData={selectedChequesData}
        onImportarClick={handleImportarClick}
        isImportButtonDisabled={isImportButtonDisabled}
        importStatus={importStatus}
        importMessage={importMessage}
        // NUEVO
        onSelectAllChange={selectAllCheques}
        onGlobalSituacionChange={handleGlobalSituacionChange}
        refreshKey={refreshKey}
        runLogs={runLogs}
        runErrors={runErrors}
      />
    </div>
  );
}
