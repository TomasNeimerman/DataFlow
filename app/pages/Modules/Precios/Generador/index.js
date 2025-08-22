"use client";

import { useState, useEffect } from "react";
import CuadroPrecios from "../../../components/CuadroPrecios";
import PreciosActualizados from "../../../components/PreciosActualizados";
import pageStyles from "./styles.module.css";

export default function Generador() {
  const [precios, setPrecios] = useState([]);
  const [preciosActualizados, setPreciosActualizados] = useState([]);
  const [showActualizados, setShowActualizados] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [progress, setProgress] = useState(null); // {percent, stage, message}
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");

  const loadPrecios = async () => {
    setError(null);
    try {
      const r = await window.api.getPrecios();
      if (r?.success) setPrecios(r.precios || r.data || []);
      else setError(r?.message || "No se pudieron obtener los precios.");
    } catch (e) {
      console.error(e);
      setError("Error de conexión al inicializar la página.");
    }
  };

  useEffect(() => {
    loadPrecios();
  }, []);

  // Hook a los eventos de progreso enviados por main
  useEffect(() => {
    const off = window.preciosProgress?.on?.((p) => setProgress(p));
    return () => off && off();
  }, []);

  const handleUpdatePrices = async () => {
    setIsUpdating(true);
    setError(null);
    setSuccessMessage("");
    setProgress({ percent: 0, stage: 'Preparando', message: 'Iniciando…' });

    try {
      const updateResponse = await window.api.actualizarPrecios(); // invoke('actualizar-precios')
      if (!updateResponse?.success) {
        throw new Error(updateResponse?.message || "Ocurrió un error durante la actualización.");
      }

      const updated = await window.api.getPreciosActualizados();
      if (updated?.success) {
        setPreciosActualizados(updated.preciosActualizados || updated.data || []);
        setShowActualizados(true);
        setSuccessMessage(updateResponse.message || "Precios actualizados.");
      } else {
        throw new Error(updated?.message || "No se pudieron obtener los precios actualizados.");
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Error de conexión al actualizar los precios.");
    } finally {
      setIsUpdating(false);
      // Limpio la barra unos ms después de terminar (si ya estamos en 100)
      setTimeout(() => setProgress(null), 800);
    }
  };

  const handleVolver = async () => {
    setShowActualizados(false);
    setPreciosActualizados([]);
    await loadPrecios();
  };

  return (
    <div className={pageStyles.body}>
      <div className={pageStyles.contentContainer}>
        {showActualizados ? (
          <PreciosActualizados
            precios={preciosActualizados}
            onVolver={handleVolver}
            successMessage={successMessage}
            error={error}
          />
        ) : (
          <CuadroPrecios
            precios={precios}
            onActualizar={handleUpdatePrices}
            isUpdating={isUpdating}
            progress={progress}          
            error={error}
            successMessage={successMessage}
          />
        )}
      </div>
    </div>
  );
}
