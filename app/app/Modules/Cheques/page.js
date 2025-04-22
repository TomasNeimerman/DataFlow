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
  const [cheques, setCheques] = useState([]); // nuevos cheques del Excel
  const [idCliente, setIdCliente] = useState(null);
  let counter = 0;
  useEffect(() => {
    const storedIdCliente = localStorage.getItem("idCliente");
    setIdCliente(storedIdCliente);
  }, []);

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
        idCheque: parseInt(row[2] || 0),
        fechaEmision: row[3],
        movimiento: row[4],
        tipoCheque: row[5],
        estado: row[6],
        fechaVenc: row[7],
        chequeCodigo: row[8],
        nroDefinitivo: row[9],
        importe: row[10],
        idCliente: idCliente
      }));

      setCheques(parsed);

      
      
      console.log(parsed.length)
      for (const cheque of parsed) {
        const res = await window.api.obtenerCheques(cheque.idCheque);
        
        if (res?.cheque?.chp_ID === cheque.idCheque) {
          console.log(`🔁 Actualizando cheque ID ${cheque.idCheque}`);
          setValoresActuales((prev) => {
            const yaExiste = prev.some((c) => c.chp_ID === res.cheque.chp_ID);
            return yaExiste ? prev : [...prev, res.cheque];
          });
          await window.api.updateCheques(cheque);
        } else {
          console.log(`🆕 Insertando cheque ID ${cheque.idCheque}`);
          await window.api.importarCheques(cheque);
        }
      }
      
      
    };

    reader.readAsArrayBuffer(file);
  };

  return (
    <div className={styles.body}>
      <div className={styles.container}>
      <Image alt='CONE ERP' className={styles.img} src={logo} />
      <ModuleForm 
        nombreModulo="Cheques" 
        onImportar={handleImportar} 
        idCliente={idCliente}
      />
      <ChequesActualizados cheques={cheques} valoresActuales={valoresActuales} />
      </div>
    </div>
  );
}
