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

      const ids = parsed.map(c => c.idCheque);
      const respActuales = await window.api.obtenerCheques(ids);
      setValoresActuales(respActuales.cheques || []);
      console.log(parsed.length)
      for(const cheque of parsed){
        const response = await window.api.obtenerCheques(cheque.idCheque)
        console.log(response)
        if(cheque.idCheque = response.idCheque){
          await window.api.updateCheques(cheque)
          console.log(`Existe el cheque con el id ${cheque.idCheque}, actualizando resultados: ${response}`)
        }else{
          console.log(`No existe el cheque con el id ${cheque.idCheque}, importando resultados`)
          await window.api.importarCheques(cheque);
      };
      }
      
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
      
    </div>
  );
}
