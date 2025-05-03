"use client";
import { useState, useEffect } from 'react';
import Image from 'next/image';
import * as XLSX from 'xlsx';
import styles from './styles.module.css';
import logo from '../../../public/logo_cone.png';
import ModuleForm from '@/app/components/ModulesForm';
import ChequesActualizados from '@/app/components/CuadroChequesActualizados';

export default function Cheques() {
  const [cheques, setCheques] = useState([]);
  const [idCliente, setIdCliente] = useState(null);
  const [validar, setValidar] = useState(false);

  const columnasEsperadas = [
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
    "IMPORTE",
  ];

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

  const handleImportar = async (file) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });

      const rows = json.slice(1).filter(row => row.length > 0 && row[0]);

      const parsed = rows.map(row => ({
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
      }));

      const chequesProcesados = [];
      let huboCambios = false;

      for (const cheque of parsed) {
        const res = await window.api.obtenerCheques(cheque.idCheque);

        if (res?.cheque?.chp_ID === cheque.idCheque) {
          const importeActual = Number(res.cheque.chp_Importe).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          });
          const importeActualFinal = `-${importeActual}   `
          const importeNuevo = cheque.importe;
          const actualizado = importeActualFinal !== importeNuevo;

          console.log('📄 Comparación importes:', { importeActualFinal, importeNuevo });

          if (actualizado) {
            await window.api.updateCheques(cheque);
            console.log(`🔁 Actualizado cheque ID ${cheque.idCheque}`);
            huboCambios = true;
          } else {
            console.log(`✅ Cheque ID ${cheque.idCheque} no necesita cambios.`);
          }

          chequesProcesados.push({
            cheque,
            actualizado
          });
        } else {
          console.log(`⛔ Cheque ID ${cheque.idCheque} no encontrado.`);
        }
      }

      setCheques(chequesProcesados);
      setValidar(huboCambios);
      console.log()
    };

    reader.readAsArrayBuffer(file);
  };

  return (
    <div className={styles.body}>
      <Image alt='CONE ERP' className={styles.img} src={logo} />
      <ModuleForm
        nombreModulo="Cheques"
        onImportar={handleImportar}
        excelRows={columnasEsperadas} // Pasar columnasEsperadas como prop
      />
      <ChequesActualizados cheques={cheques} validar={validar} />
    </div>
  );
}