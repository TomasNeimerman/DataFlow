"use client";
import { useState, useEffect } from 'react';
import Image from 'next/image';
import * as XLSX from 'xlsx';
import styles from './styles.module.css';
import logo from '../../../public/logo_cone.png';
import ModuleForm from '@/app/components/ModulesForm';
import ChequesActualizados from '@/app/components/CuadroChequesActualizados';

export default function Cheques() {
  const [valoresActuales, setValoresActuales] = useState([]);
  const [cheques, setCheques] = useState([]);
  const [idCliente, setIdCliente] = useState(null);
  const [huboActualizaciones, setHuboActualizaciones] = useState(false);

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

      setCheques(parsed);

      let huboCambios = false;

      for (const cheque of parsed) {
        const res = await window.api.obtenerCheques(cheque.idCheque);

        if (res?.cheque?.chp_ID === cheque.idCheque) {
          const yaExiste = valoresActuales.some(c => c.chp_ID === res.cheque.chp_ID);
          if (!yaExiste) {
            setValoresActuales(prev => [...prev, res.cheque]);
            huboCambios = true;
            await window.api.updateCheques(cheque);
            console.log(`🔁 Actualizando cheque ID ${cheque.idCheque}`);
          } else {
            console.log(`✅ Cheque ID ${cheque.idCheque} ya actualizado previamente.`);
          }
        } else if (!res?.cheque) {
          await window.api.importarCheques(cheque);
          console.log(`🆕 Insertando cheque ID ${cheque.idCheque}`);
        } else {
          console.log(`🔍 Cheque ID ${cheque.idCheque} ya existe sin cambios.`);
        }
      }

      setHuboActualizaciones(huboCambios);
    };

    reader.readAsArrayBuffer(file);
  };

  return (
    <div className={styles.body}>
      <Image alt='CONE ERP' className={styles.img} src={logo} />
      <ModuleForm 
        nombreModulo="Cheques" 
        onImportar={handleImportar} 
        idCliente={idCliente}
      />
      <ChequesActualizados 
        cheques={cheques} 
        valoresActuales={valoresActuales} 
        validar={huboActualizaciones}
      />
    </div>
  );
}
