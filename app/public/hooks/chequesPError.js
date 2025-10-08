// app/hooks/useChequesError.js
import { useState } from 'react';
import * as XLSX from 'xlsx'; // reservado para usos futuros

const useChequesError = () => {
  const [importStatus, setImportStatus] = useState('');   // "Importado correctamente" | "hubo un error en la importacion" | "Importación sin cambios"
  const [importMessage, setImportMessage] = useState(''); // Mensaje detallado

  // Encabezados esperados EXACTOS (fila 1 de la plantilla chequesp.xlsx)
  const expectedColumns = [
    "CodEmpresa",
    "Emp.",
    "ID Cheque",
    "Mov. - F. Emisión",
    "Mov.",
    "Cheque - Tipo Valor - Cód.",
    "Cheq. / Doc. / Obl. - Estado",
    "Cheq. / Doc. / Obl. - F. Vto.",
    "Cheq. / Doc. / Obl. - Nro.",
    "Nro Definitivo",
    "IMPORTE"
  ];

  /** Valida encabezados vs la plantilla. */
  const validateExcelColumns = (actualHeaders = []) => {
    setImportStatus('');
    setImportMessage('');

    const missingColumns = expectedColumns.filter(col => !actualHeaders.includes(col));
    if (missingColumns.length > 0) {
      setImportStatus("hubo un error en la importacion");
      setImportMessage(`Faltan las siguientes columnas en el archivo: ${missingColumns.join(', ')}.`);
      return false;
    }
    return true;
  };

  // Helpers
  const toTrim = (v) => (v == null ? '' : String(v)).trim();
  const parseIntSafe = (v) => {
    if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v);
    const s = toTrim(v);
    if (!s) return NaN;
    const n = Number.parseInt(s, 10);
    return Number.isFinite(n) ? n : NaN;
  };

  /**
   * Procesa cheques ya parseados desde el Excel.
   * - Solo ACTUALIZA y DEVUELVE cheques con "Nro Definitivo" NO vacío y diferente al actual.
   * - El array `chequesProcesados` contiene **solo** los que fueron actualizados.
   */
  const processChequeUpdates = async (parsedCheques, obtenerChequeApiFn, updateChequeApiFn, idCliente) => {
    setImportStatus('');
    setImportMessage('');

    const actualizadosSolo = []; // <- lo que vamos a devolver

    let huboCambios = false;
    let errorEnActualizacion = false;

    let chequesActualizadosCount = 0;
    let chequesNoEncontradosCount = 0;
    let chequesSinCambiosCount = 0;
    let chequesSinNroDefinitivoCount = 0;

    for (const cheque of parsedCheques) {
      const nroNuevoRaw = toTrim(cheque?.nroDefinitivo);

      // Requisito: Nro Definitivo debe venir con valor
      if (!nroNuevoRaw) {
        chequesSinNroDefinitivoCount++;
        continue;
      }

      const nroNuevoInt = parseIntSafe(nroNuevoRaw);
      if (!Number.isFinite(nroNuevoInt)) {
        chequesSinCambiosCount++;
        continue;
      }

      try {
        const res = await obtenerChequeApiFn(cheque.idCheque);
        const chequeIdFromDb = res?.cheque?.chp_ID ?? res?.cheque?.ch3_ID;
        const nroActualFromDb = res?.cheque?.chp_NroCheq ?? res?.cheque?.ch3_NroDefinitivo ?? '';

        if (chequeIdFromDb !== cheque.idCheque) {
          chequesNoEncontradosCount++;
          continue;
        }

        // Si es igual, no hay cambio
        if (String(nroActualFromDb) === String(nroNuevoInt)) {
          chequesSinCambiosCount++;
          continue;
        }

        // Actualiza usando el Nro Definitivo como nuevo chp_NroCheq
        const payload = { ...cheque, nroDefinitivo: nroNuevoInt };
        const updateResult = await updateChequeApiFn(payload);

        if (!updateResult?.success) {
          errorEnActualizacion = true;
          continue;
        }

        // OK: sólo pusheamos los actualizados
        huboCambios = true;
        chequesActualizadosCount++;
        actualizadosSolo.push({ cheque: payload, actualizado: true });
      } catch (_e) {
        errorEnActualizacion = true;
      }
    }

    // Mensajería final coherente con tu UI
    let finalMessage = '';
    if (errorEnActualizacion) {
      setImportStatus('hubo un error en la importacion');
      finalMessage = 'Hubo errores al actualizar algunos cheques.';
    } else if (huboCambios) {
      setImportStatus('Importado correctamente');
      finalMessage = `Importado correctamente. ${chequesActualizadosCount} cheque(s) actualizado(s).`;
    } else {
      setImportStatus('Importación sin cambios');
      finalMessage = 'Importación completada. No se encontraron cambios para actualizar.';
    }

    if (chequesSinNroDefinitivoCount > 0) {
      finalMessage += ` ${chequesSinNroDefinitivoCount} fila(s) sin "Nro Definitivo" — no se actualizaron.`;
    }
    if (chequesSinCambiosCount > 0) {
      finalMessage += ` ${chequesSinCambiosCount} fila(s) sin cambios.`;
    }
    if (chequesNoEncontradosCount > 0) {
      finalMessage += ` ${chequesNoEncontradosCount} cheque(s) no encontrado(s).`;
    }

    setImportMessage(finalMessage);

    return {
      chequesProcesados: actualizadosSolo,   // <- SOLO los actualizados
      huboCambios,
      errorEnActualizacion,
      chequesActualizadosCount,
      chequesNoEncontradosCount,
      chequesSinCambiosCount,
      chequesSinNroDefinitivoCount,
    };
  };

  return {
    importStatus,
    importMessage,
    validateExcelColumns,
    processChequeUpdates,
  };
};

export default useChequesError;
