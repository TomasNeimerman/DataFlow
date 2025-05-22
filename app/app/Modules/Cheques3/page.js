// app/Cheques3/page.js
"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import * as XLSX from 'xlsx'; // Necesitamos XLSX para leer el archivo y obtener los encabezados
import styles from './styles.module.css';
import logo from '../../../public/logo_cone.png';
import ModuleForm from '@/app/components/ModulesForm';
import ChequesActualizados from '@/app/components/CuadroChequesActualizados';
import useChequesError from '@/app/hooks/chequesError'; // Importa el hook

export default function Cheques3() {
  const [cheques, setCheques] = useState([]);
  const [idCliente, setIdCliente] = useState(null);
  const [validar, setValidar] = useState(false);
  const [mostrarChequesActualizados, setMostrarChequesActualizados] = useState(false);

  // Obtén los estados y las funciones del hook
  const { importStatus, importMessage, validateExcelColumns, processChequeUpdates } = useChequesError();

  useEffect(() => {
    const storedIdCliente = localStorage.getItem("idCliente");
    setIdCliente(storedIdCliente);
  }, []);

  const formatFecha = (excelDateStr) => {
    if (!excelDateStr || typeof excelDateStr !== 'string') return '';
    const [d, m, y] = excelDateStr.split('/');
    if (!d || !m || !y) return '';
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  };

  // Función específica para parsear las filas de Cheques3
  const parseCheque3Row = (row, idCliente) => ({
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
        const parsedCheques = rows.map(row => parseCheque3Row(row, idCliente));

        // Procesar las actualizaciones de cheques usando la función del hook
        const updateSummary = await processChequeUpdates(
          parsedCheques,
          window.api.obtenerCheque3, // Función API para obtener cheque
          window.api.updateCheque3,  // Función API para actualizar cheque
          idCliente
        );

        // Actualizar los estados locales basados en el resumen del hook
        setCheques(updateSummary.chequesProcesados);
        setValidar(updateSummary.huboCambios);
        setMostrarChequesActualizados(true);

      } catch (error) {
        console.error("Error al procesar el archivo en Cheques3:", error);
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
      <Image alt='CONE ERP' className={styles.img} src={logo} />
      <ModuleForm
        nombreModulo="Cheques3"
        onImportar={handleImportar}
        estadoImportar={importStatus}
        mensajeImportacion={importMessage}
      />
      {mostrarChequesActualizados && (
        <ChequesActualizados cheques={cheques} validar={validar} />
      )}
    </div>
  );
}