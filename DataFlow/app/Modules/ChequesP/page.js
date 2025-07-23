// app/ChequesP/page.js
"use client";

import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx'; // Necesitamos XLSX para leer el archivo y obtener los encabezados
import styles from './styles.module.css';
import ModuleForm from '@/app/components/ModulesForm';
import ChequesActualizados from '@/app/components/CuadroChequesActualizados';
import useChequesError from '@/app/hooks/chequesPError'; // Importa el hook

export default function ChequesP() {
  const [cheques, setCheques] = useState([]);
  const [idCliente, setIdCliente] = useState(null);
  const [validar, setValidar] = useState(false);
  const [mostrarChequesActualizados, setMostrarChequesActualizados] = useState(false);

  // Obtén los estados y las funciones del hook
  const { importStatus, importMessage, validateExcelColumns, processChequeUpdates } = useChequesError();

  useEffect(() => {
    // <-- MODIFICADO
    const fetchIdCliente = async () => {
      if (window.api) {
        const storedId = await window.api.getStoreValue("idCliente");
        setIdCliente(storedId);
      }
    };
    fetchIdCliente();
  }, []);

  const formatFecha = (excelDateStr) => {
    if (!excelDateStr || typeof excelDateStr !== 'string') return '';
    const [d, m, y] = excelDateStr.split('/');
    if (!d || !m || !y) return '';
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  };

  // Función específica para parsear las filas de ChequesP
  const parseChequePRow = (row, idCliente) => ({
    codEmp: row[0],
    emp: row[1],
    idCheque: parseInt(row[2] || 0, 10),
    fechaEmision: formatFecha(row[3]),
    movimiento: row[4],
    tipoCheque: row[5],
    estado: row[6],
    fechaVenc: formatFecha(row[7]),
    chequeCodigo: row[8],
    nroDefinitivo: row[9],
    importe: row[10],
    idCliente: idCliente
  });

  const handleImportar = async (file) => {
    setMostrarChequesActualizados(false); // Ocultar la tabla de actualizados al iniciar una nueva importación

    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });

        if (!json || json.length === 0) {
          // Si el archivo está vacío, llama a validateExcelColumns con un array vacío para que establezca el mensaje de error.
          validateExcelColumns([]);
          return;
        }

        const headers = json[0]; // Obtener los encabezados del archivo
        if (!validateExcelColumns(headers)) { // Validar las columnas usando la función del hook
          return; // Si la validación falla, el hook ya estableció el estado de error y el mensaje.
        }

        const rows = json.slice(1).filter(row => row.length > 0 && row[0]);
        const parsedCheques = rows.map(row => parseChequePRow(row, idCliente));

        // Procesar las actualizaciones de cheques usando la función del hook
        const updateSummary = await processChequeUpdates(
          parsedCheques,
          window.api.obtenerCheques, // Función API para obtener cheque
          window.api.updateCheques,  // Función API para actualizar cheque
          idCliente
        );

        // Actualizar los estados locales basados en el resumen del hook
        setCheques(updateSummary.chequesProcesados);
        setValidar(updateSummary.huboCambios);
        setMostrarChequesActualizados(true);

      } catch (error) {
        console.error("Error al procesar el archivo en ChequesP:", error);
        // Establecer un mensaje de error genérico si ocurre un error inesperado durante la lectura/parseo
        // El hook processChequeUpdates ya maneja sus propios errores internos.
        // Aquí se manejan errores antes de que los datos lleguen a processChequeUpdates.
        // Puedes usar setImportStatus y setImportMessage directamente si quieres un mensaje específico aquí.
        setCheques([]);
        setValidar(false);
        setMostrarChequesActualizados(false);
      }
    };

    reader.onerror = (error) => {
      console.error("Error al leer el archivo:", error);
      // Establecer un mensaje de error si la lectura del archivo falla.
      // Puedes usar setImportStatus y setImportMessage directamente si quieres un mensaje específico aquí.
      setCheques([]);
      setValidar(false);
      setMostrarChequesActualizados(false);
    };

    reader.readAsArrayBuffer(file);
  };

  return (
    <div className={styles.body}>
      <ModuleForm
        nombreModulo="ChequesP"
        onImportar={handleImportar}
        estadoImportar={importStatus} // Pasa el estado del hook
        mensajeImportacion={importMessage} // Pasa el mensaje detallado del hook
      />
      {mostrarChequesActualizados && (
        <ChequesActualizados cheques={cheques} validar={validar} />
      )}
    </div>
  );
}