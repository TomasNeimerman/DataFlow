"use client";

import { useState, useEffect } from "react";
import CuadroPrecios from "../../components/CuadroPrecios";
import PreciosActualizados from "../../components/PreciosActualizados";
import pageStyles from "./styles.module.css";

export default function Precios() {
  const [precios, setPrecios] = useState([]);
  const [preciosActualizados, setPreciosActualizados] = useState([]);
  const [showActualizados, setShowActualizados] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");

  // Carga inicial: solo lista de precios base
  const loadPrecios = async () => {
    setError(null);
    try {
      const preciosResponse = await window.api.getPrecios();
      if (preciosResponse?.success) {
        setPrecios(preciosResponse.precios || preciosResponse.data || []);
      } else {
        setError(preciosResponse?.message || "No se pudieron obtener los precios.");
      }
    } catch (err) {
      console.error(err);
      setError("Error de conexión al inicializar la página.");
    }
  };

  useEffect(() => {
    loadPrecios();
  }, []);

  // Al hacer click en "Actualizar" -> ejecuta actualización y switchea a la vista de actualizados
  const handleUpdatePrices = async () => {
    setIsUpdating(true);
    setError(null);
    setSuccessMessage("");

    try {
      const updateResponse = await window.api.actualizarPrecios();
      if (!updateResponse?.success) {
        throw new Error(updateResponse?.message || "Ocurrió un error durante la actualización.");
      }

      // Traer precios actualizados
      const updated = await window.api.getPreciosActualizados();
      if (updated?.success) {
        setPreciosActualizados(updated.preciosActualizados || updated.data || []);
        setShowActualizados(true); // 👈 Cambiamos de vista
        setSuccessMessage(updateResponse.message || "Precios actualizados.");
      } else {
        throw new Error(updated?.message || "No se pudieron obtener los precios actualizados.");
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Error de conexión al actualizar los precios.");
    } finally {
      setIsUpdating(false);
    }
  };

  // Opcional: volver a la vista original y recargar lista base
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
            onVolver={handleVolver}   // si tu componente lo soporta; si no, podés agregar un botón acá
            successMessage={successMessage}
            error={error}
          />
        ) : (
          <CuadroPrecios
            precios={precios}
            onActualizar={handleUpdatePrices}
            isUpdating={isUpdating}
            error={error}
            successMessage={successMessage}
          />
        )}
      </div>
    </div>
  );
}
