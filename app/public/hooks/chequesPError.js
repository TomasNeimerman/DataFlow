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

  /** Intenta traer todos los cheques y construir un índice: nro -> Set(ids) */
  const fetchExistingNumbersIndex = async () => {
    const byNumber = new Map(); // "1234" -> Set(IDs)
    try {
      const res = await window.api?.chequespPreview?.();
      if (res?.success && Array.isArray(res.data)) {
        for (const row of res.data) {
          const num = toTrim(row?.NumeroActual);
          const id  = Number(row?.ID_Cheque);
          if (!num || !Number.isFinite(id)) continue;
          if (!byNumber.has(num)) byNumber.set(num, new Set());
          byNumber.get(num).add(id);
        }
      }
    } catch {
      // si falla, seguimos sin índice (no bloquea el flujo)
    }
    return byNumber;
  };

  /**
   * Procesa cheques ya parseados desde el Excel.
   * - Solo ACTUALIZA y DEVUELVE cheques con "Nro Definitivo" NO vacío y diferente al actual.
   * - Antes de actualizar, valida que NO exista otro cheque en la base (o dentro del mismo Excel)
   *   con ese "Nro Definitivo". Si hay repetidos, se cancela la importación con error.
   */
  const processChequeUpdates = async (parsedCheques, obtenerChequeApiFn, updateChequeApiFn, idCliente) => {
    setImportStatus('');
    setImportMessage('');

    const actualizadosSolo = [];

    let huboCambios = false;
    let errorEnActualizacion = false;

    let chequesActualizadosCount = 0;
    let chequesNoEncontradosCount = 0;
    let chequesSinCambiosCount = 0;
    let chequesSinNroDefinitivoCount = 0;

    // 1) Traemos el índice de números existentes en DB (si está disponible)
    const dbIndex = await fetchExistingNumbersIndex();

    // 2) Detectamos duplicados dentro del propio Excel
    const seenInFile = new Map(); // nro -> idCheque (primera aparición)
    const duplicatesInFile = [];  // mensajes de conflicto
    for (const cheque of parsedCheques) {
      const nroNuevoStr = toTrim(cheque?.nroDefinitivo);
      if (!nroNuevoStr || !/^\d+$/.test(nroNuevoStr)) continue;

      const id = Number(cheque?.idCheque);
      if (!Number.isFinite(id)) continue;

      if (seenInFile.has(nroNuevoStr) && seenInFile.get(nroNuevoStr) !== id) {
        duplicatesInFile.push(`nº ${nroNuevoStr} (IDs ${seenInFile.get(nroNuevoStr)} y ${id})`);
      } else {
        seenInFile.set(nroNuevoStr, id);
      }
    }

    // 3) Si hay duplicados dentro del Excel, abortamos
    if (duplicatesInFile.length > 0) {
      setImportStatus("hubo un error en la importacion");
      setImportMessage(`ID repetido: ${duplicatesInFile.join(', ')}.`);
      return {
        chequesProcesados: [],
        huboCambios: false,
        errorEnActualizacion: true,
        chequesActualizadosCount: 0,
        chequesNoEncontradosCount: 0,
        chequesSinCambiosCount: 0,
        chequesSinNroDefinitivoCount,
        duplicatesInFile,
        duplicatesInDb: [],
      };
    }

    // 4) Recorremos cheques y validamos contra la base + actualizamos
    const duplicatesInDb = [];
    for (const cheque of parsedCheques) {
      const nroNuevoRaw = toTrim(cheque?.nroDefinitivo);

      if (!nroNuevoRaw) {
        chequesSinNroDefinitivoCount++;
        continue;
      }

      const nroNuevoInt = parseIntSafe(nroNuevoRaw);
      if (!Number.isFinite(nroNuevoInt)) {
        chequesSinCambiosCount++;
        continue;
      }

      const idCheque = Number(cheque?.idCheque);
      if (!Number.isFinite(idCheque)) {
        chequesNoEncontradosCount++;
        continue;
      }

      try {
        const res = await obtenerChequeApiFn(idCheque);
        const chequeIdFromDb = res?.cheque?.chp_ID ?? res?.cheque?.ch3_ID;
        const nroActualFromDb = res?.cheque?.chp_NroCheq ?? res?.cheque?.ch3_NroDefinitivo ?? '';

        if (chequeIdFromDb !== idCheque) {
          chequesNoEncontradosCount++;
          continue;
        }

        // Si es igual, no hay cambio
        if (String(nroActualFromDb) === String(nroNuevoInt)) {
          chequesSinCambiosCount++;
          continue;
        }

        // 4.a) Verificar repetido en DB (mismo número en otro ID)
        const idsWithThisNumber = dbIndex.get(String(nroNuevoInt));
        if (idsWithThisNumber && (idsWithThisNumber.size > 1 || !idsWithThisNumber.has(idCheque))) {
          // Ya existe ese número para otro cheque -> es un conflicto
          const otros = Array.from(idsWithThisNumber).filter(x => x !== idCheque);
          duplicatesInDb.push(`nº ${nroNuevoInt} (ya existe en ID${otros.length>1?'s':''} ${otros.join(', ')})`);
          continue; // no intentamos actualizar este
        }

        // 4.b) Actualiza usando el Nro Definitivo como nuevo chp_NroCheq
        const payload = { ...cheque, nroDefinitivo: nroNuevoInt };
        const updateResult = await updateChequeApiFn(payload);

        if (!updateResult?.success) {
          errorEnActualizacion = true;
          continue;
        }

        // OK
        huboCambios = true;
        chequesActualizadosCount++;
        actualizadosSolo.push({ cheque: payload, actualizado: true });

        // Actualizamos el índice local para evitar colisiones dentro del mismo run
        if (!dbIndex.has(String(nroNuevoInt))) dbIndex.set(String(nroNuevoInt), new Set());
        dbIndex.get(String(nroNuevoInt)).add(idCheque);
      } catch (_e) {
        errorEnActualizacion = true;
      }
    }

    // Si hubo conflictos de repetidos en DB, cancelamos con error y NO abrimos resultados
    if (duplicatesInDb.length > 0) {
      setImportStatus("hubo un error en la importacion");
      setImportMessage(`ID repetido: ${duplicatesInDb.join(', ')}.`);
      return {
        chequesProcesados: [],
        huboCambios: false,                   // <- esto mantiene la solapa de resultados cerrada
        errorEnActualizacion: true,
        chequesActualizadosCount: 0,
        chequesNoEncontradosCount,
        chequesSinCambiosCount,
        chequesSinNroDefinitivoCount,
        duplicatesInFile: [],
        duplicatesInDb,
      };
    }

    // Mensajería final (sin repetidos)
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
      duplicatesInFile: [],
      duplicatesInDb: [],
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
