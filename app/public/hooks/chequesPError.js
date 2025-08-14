// app/hooks/useChequesError.js
import { useState } from 'react';
import * as XLSX from 'xlsx'; // Se mantiene la importación de XLSX por si se usa en el futuro, aunque no se usa directamente en las funciones expuestas.

const useChequesError = () => {
    const [importStatus, setImportStatus] = useState(''); // Estado general de la importación (éxito/error/sin cambios)
    const [importMessage, setImportMessage] = useState(''); // Mensaje detallado (error o éxito)

    // Definición de las columnas esperadas del Excel
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

    /**
     * Verifica si los encabezados del archivo Excel coinciden con las columnas esperadas.
     * Establece el estado de error y el mensaje si faltan columnas.
     * @param {string[]} actualHeaders - Los encabezados reales leídos del archivo Excel.
     * @returns {boolean} - True si todas las columnas esperadas están presentes, false en caso contrario.
     */
    const validateExcelColumns = (actualHeaders) => {
        // Limpiar mensajes anteriores de validación de columnas
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

    /**
     * Procesa la lista de cheques parseados, los obtiene de la API y los actualiza si es necesario.
     * Actualiza los estados de importación (status y message) y retorna un resumen de los cambios.
     * Esta función NO lee el archivo Excel; solo procesa los datos ya parseados.
     * @param {Array<Object>} parsedCheques - Array de objetos de cheque parseados del Excel.
     * @param {Function} obtenerChequeApiFn - Función API para obtener un cheque (ej. window.api.obtenerCheques).
     * @param {Function} updateChequeApiFn - Función API para actualizar un cheque (ej. window.api.updateCheques).
     * @param {string} idCliente - ID del cliente actual.
     * @returns {Object} - Objeto con chequesProcesados y un resumen de los cambios.
     */
    const processChequeUpdates = async (parsedCheques, obtenerChequeApiFn, updateChequeApiFn, idCliente) => {
        // Limpiar mensajes anteriores de procesamiento de actualizaciones
        setImportStatus('');
        setImportMessage('');

        const chequesProcesados = [];
        let huboCambios = false;
        let errorEnActualizacion = false;
        let chequesActualizadosCount = 0;
        let chequesNoEncontradosCount = 0;
        let chequesSinCambiosCount = 0;

        for (const cheque of parsedCheques) {
            const res = await obtenerChequeApiFn(cheque.idCheque);
            console.log("Cheque obtenido de la API:", res);
            // Determinar si es ChequesP o Cheques3 por el nombre del campo ID
            const chequeIdFromDb = res?.cheque?.chp_ID || res?.cheque?.ch3_ID;
            const nroDefinitivoActualFromDb = res?.cheque?.chp_NroCheq || res?.cheque?.ch3_NroDefinitivo; // Ajustar según la base de datos

            if (chequeIdFromDb === cheque.idCheque) {
                const nroDefinitivoNuevo = cheque.nroDefinitivo;
                const actualizado = nroDefinitivoNuevo != nroDefinitivoActualFromDb;

                if (actualizado) {
                    const updateResult = await updateChequeApiFn(cheque);
                    if (updateResult?.error) {
                        console.error(`Error al actualizar el cheque ID ${cheque.idCheque}:`, updateResult.error);
                        errorEnActualizacion = true;
                    } else {
                        console.log(`🔁 Actualizado cheque ID ${cheque.idCheque}`);
                        huboCambios = true;
                        chequesActualizadosCount++;
                    }
                } else {
                    console.log(`✅ Cheque ID ${cheque.idCheque} no necesita cambios.`);
                    chequesSinCambiosCount++;
                }

                chequesProcesados.push({
                    cheque,
                    actualizado
                });
            } else {
                console.log(`⛔ Cheque ID ${cheque.idCheque} no encontrado.`);
                chequesNoEncontradosCount++;
            }
        }

        let finalMessage = "";
        if (errorEnActualizacion) {
            finalMessage = "Hubo errores al actualizar algunos cheques.";
            setImportStatus("hubo un error en la importacion");
        } else if (huboCambios) {
            finalMessage = `Importado correctamente. ${chequesActualizadosCount} cheque(s) actualizado(s).`;
            if (chequesSinCambiosCount > 0) {
                finalMessage += ` ${chequesSinCambiosCount} cheque(s) sin cambios.`;
            }
            if (chequesNoEncontradosCount > 0) {
                finalMessage += ` ${chequesNoEncontradosCount} cheque(s) no encontrado(s).`;
            }
            setImportStatus("Importado correctamente");
        } else {
            finalMessage = `Importación completada. No se encontraron cambios para actualizar.`;
            if (chequesNoEncontradosCount > 0) {
                finalMessage += ` ${chequesNoEncontradosCount} cheque(s) no encontrado(s).`;
            }
            setImportStatus("Importación sin cambios");
        }

        setImportMessage(finalMessage);

        return { chequesProcesados, huboCambios, errorEnActualizacion, chequesActualizadosCount, chequesNoEncontradosCount, chequesSinCambiosCount };
    };

    return {
        importStatus,
        importMessage,
        validateExcelColumns, // Expone la función de validación de columnas
        processChequeUpdates // Expone la función de procesamiento de actualizaciones
    };
};

export default useChequesError;
