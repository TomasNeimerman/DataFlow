// Modules/Precios/Actualizador/index.js
"use client";

import styles from "./styles.module.css";
import ListaPreciosForm from "../../../components/ListaPreciosForm";
import usePreciosActualizador from "../../../../public/hooks/preciosActualizador";

export default function Actualizador() {
  const {
    estadoImportar,
    mensajeImportacion,
    handleDescargarLista,
    handleImportar,
    resultados,
    puedeVerResultados,
  } = usePreciosActualizador();

  // Si manejás idCliente acá, pasalo como prop. Lo dejo opcional.
  const idCliente = undefined;

  return (
    <div className={styles.body}>
      <ListaPreciosForm
        nombreModulo="Actualizador de Lista de Precios"
        idCliente={idCliente}
        onDescargarLista={handleDescargarLista}
        onImportar={handleImportar}
        estadoImportar={estadoImportar}
        mensajeImportacion={mensajeImportacion}
        resultados={resultados}
        puedeVerResultados={puedeVerResultados}
      />
    </div>
  );
}
