// app/Cheques3/page.js
"use client";

import { useState, useEffect, useCallback } from 'react';
import pageStyles from './styles.module.css';
import ChequesRechazados from '../../components/CuadroChequesEdoR'; // Import the visual component

export default function Cheques3() {
  const [idCliente, setIdCliente] = useState(null);
  const [chequesRechazados, setChequesRechazados] = useState([]);
  const [situaciones, setSituaciones] = useState([]);
  const [selectedChequesData, setSelectedChequesData] = useState({});
  const [importStatus, setImportStatus] = useState(null);
  const [importMessage, setImportMessage] = useState('');


  useEffect(() => {
    const storedIdCliente = localStorage.getItem("idCliente");
    setIdCliente(storedIdCliente);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!idCliente) return;

      setImportStatus('loading');
      setImportMessage('Cargando datos...');

      try {
        if (window.api && window.api.getSituacion) {
          const response = await window.api.getSituacion();
          if (response.success) {
            setSituaciones(response.data);
          } else {
            console.error("Error al obtener situaciones:", response.message);
            setSituaciones([]);
          }
        } else {
          console.warn("window.api.getSituacion no está disponible.");
        }

        if (window.api && window.api.obtenerCheque3Rechazado) {
          const chequesResponse = await window.api.obtenerCheque3Rechazado(idCliente);
          console.log(`[Frontend] Respuesta de obtenerCheque3Rechazado:`, chequesResponse);
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
                    if (!isNaN(customDate.getTime())) {
                      fvtoDate = customDate;
                    }
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

            const initialSelectedChequesData = {};
            chequesData.forEach(cheque => {
              initialSelectedChequesData[cheque.idCheque] = {
                isSelected: false,
                situacionId: '',
                situacionLabel: ''
              };
            });
            setSelectedChequesData(initialSelectedChequesData);
          } else {
            console.error("Error al obtener cheques rechazados:", chequesResponse.message);
            setChequesRechazados([]);
            setSelectedChequesData({});
          }
        } else {
          console.warn("window.api.obtenerCheque3Rechazado no está disponible.");
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

  const handleChequeToggle = useCallback((idCheque) => {
    setSelectedChequesData(prevData => {
      const currentChequeData = prevData[idCheque] || { isSelected: false, situacionId: '', situacionLabel: '' };
      const newState = !currentChequeData.isSelected;

      return {
        ...prevData,
        [idCheque]: {
          ...currentChequeData,
          isSelected: newState,
          situacionId: newState ? currentChequeData.situacionId : '',
          situacionLabel: newState ? currentChequeData.situacionLabel : ''
        }
      };
    });
  }, []);

  const handleSituacionChange = useCallback((idCheque, selectedValue) => {
    setSelectedChequesData(prevData => {
      const sanitizedSelectedValue = String(selectedValue || '');
      const selectedSituacion = situaciones.find(sit => String(sit.sit_Cod) === sanitizedSelectedValue);
      const situacionLabel = selectedSituacion ? selectedSituacion.sit_Desc : '';

      return {
        ...prevData,
        [idCheque]: {
          ...prevData[idCheque],
          situacionId: sanitizedSelectedValue,
          situacionLabel: situacionLabel
        }
      };
    });
  }, [situaciones]);

  const handleImportarClick = async () => {
    const chequesParaActualizar = Object.keys(selectedChequesData)
      .filter(id => {
        const data = selectedChequesData[id];
        return data.isSelected && data.situacionId != null && data.situacionId !== '';
      })
      .map(id => {
        const idParsed = parseInt(id, 10);
        const situacion = selectedChequesData[id].situacionId;
        console.log(`[Frontend] Preparando para actualizar: idCheque=${idParsed} (Tipo: ${typeof idParsed}), situacionId=${situacion} (Tipo: ${typeof situacion})`);
        return {
          idCheque: idParsed,
          situacionId: situacion
        };
      });
      console.log("Cheques para actualizar:", chequesParaActualizar);

    if (chequesParaActualizar.length === 0) {
      setImportStatus('info');
      setImportMessage('No hay cheques seleccionados con situación para importar.');
      setTimeout(() => { setImportStatus(null); setImportMessage(''); }, 3000);
      return;
    }

    setImportStatus('loading');
    setImportMessage('Importando cheques seleccionados...');

    try {
      if (window.api && window.api.updateCheque3) {
        const updateResults = await Promise.all(
          chequesParaActualizar.map(async (cheque) => {
            console.log(`[Frontend] Llamando a window.api.actualizarCheque3 con ID: ${cheque.idCheque}, SIT: ${cheque.situacionId}, cheque completo : ${JSON.stringify(cheque)}`);
            try {
              const response = await window.api.updateCheque3(cheque.idCheque, cheque.situacionId);
              const valor =  chequesRechazados.filter(ch => String(ch.idCheque) === String(cheque.idCheque));
              console.log(valor);
              const res = await window.api.setRegistro(valor[0].emp, valor[0].suc, cheque.idCheque, cheque.situacionId, valor[0].situacion);
              console.log(`[Frontend] Respuesta de updateCheque3:`, response);
              return { idCheque: cheque.idCheque, success: response.success, message: response.message };
            } catch (error) {
              console.error(`[Frontend] Error al actualizar cheque ${cheque.idCheque}:`, error);
              return { idCheque: cheque.idCheque, success: false, message: error.message || 'Error desconocido al intentar actualizar este cheque.' };
            }
          })
        );

        const allSuccessful = updateResults.every(result => result.success);
        const successfulUpdates = updateResults.filter(result => result.success);
        const failedUpdates = updateResults.filter(result => !result.success);

        if (allSuccessful) {
          setImportStatus('success');
          setImportMessage('Todos los cheques actualizados correctamente.');
        } else if (successfulUpdates.length > 0) {
          setImportStatus('info');
          setImportMessage(`Algunos cheques actualizados. Errores en ${failedUpdates.length} de ${chequesParaActualizar.length} cheques.`);
        } else {
          setImportStatus('error');
          setImportMessage(`Fallo al actualizar cheques: ${failedUpdates[0]?.message || 'Error desconocido al intentar actualizar.'}`);
        }

        setChequesRechazados(prevCheques =>
          prevCheques.filter(ch => !successfulUpdates.some(updatedCh => String(updatedCh.idCheque) === String(ch.idCheque)))
        );
        setSelectedChequesData(prevData => {
          const newData = { ...prevData };
          successfulUpdates.forEach(updatedCh => {
            delete newData[String(updatedCh.idCheque)];
          });
          return newData;
        });

      } else {
        console.warn("window.api.actualizarCheque3 no está disponible. Simulando actualización.");
        const success = Math.random() > 0.3;
        if (success) {
          setImportStatus('success');
          setImportMessage('Simulación: Cheques actualizados correctamente.');
          console.log("Cheques que se intentarían actualizar (simulado):", chequesParaActualizar);
          setChequesRechazados(prevCheques => prevCheques.filter(ch => !chequesParaActualizar.some(updatedCh => String(updatedCh.idCheque) === String(ch.idCheque)))); // Corregido: updatedH a updatedCheque
          setSelectedChequesData(prevData => {
            const newData = { ...prevData };
            chequesParaActualizar.forEach(updatedCh => {
              delete newData[String(updatedCh.idCheque)];
            });
            return newData;
          });
        } else {
          setImportStatus('error');
          setImportMessage('Simulación: Fallo al actualizar cheques.');
        }
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



  const isImportButtonDisabled = importStatus === 'loading' ||
    Object.values(selectedChequesData).every(data => !data.isSelected || data.situacionId == null || data.situacionId === '');

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
      />
    </div>
  );
}
