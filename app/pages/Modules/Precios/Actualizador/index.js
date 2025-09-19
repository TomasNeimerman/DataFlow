// app/PreciosActualizador/page.js
"use client";

import styles from "./styles.module.css";
import ListaPreciosForm from "../../../components/ListaPreciosForm/index"; // ajustá ruta si tu form vive en otro archivo
import usePreciosActualizador from "../../../../public/hooks/preciosActualizador";
import { useState,useEffect } from "react";
export default function Actualizador() {
  const [idCliente,setIdCliente] = useState(null);
  const {
    estadoImportar,
    mensajeImportacion,
    handleDescargarLista,
    handleImportar,
  } = usePreciosActualizador();
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
  return (
    <div className={styles.body}>
      <ListaPreciosForm
        nombreModulo="Actualizador de listas de precios"
        idCliente={idCliente}
        onDescargarLista={handleDescargarLista}
        onImportar={handleImportar}
        estadoImportar={estadoImportar}
        mensajeImportacion={mensajeImportacion}
      />

    </div>
  );
}
