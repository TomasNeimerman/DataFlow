"use client";
import { useState, useEffect } from "react";
<<<<<<< HEAD
import CuadroPrecios from "../../../components/Precios/CuadroPrecios";
import PreciosActualizados from "../../../components/PreciosActualizados";
=======
import Script from "../../../components/Precios/Script";
import ScriptUpdated from "../../../components/ScriptUpdated";
>>>>>>> 915c66909684db098d8351c18a29db2455c4a985
import pageStyles from "./styles.module.css";

export default function ScriptSQL() {
  const [precios, setPrecios] = useState([]);
  const [preciosActualizados, setPreciosActualizados] = useState([]);
  const [showActualizados, setShowActualizados] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [progress, setProgress] = useState(null); // { percent, stage, message }
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");

  // ✅ NUEVO: info / descripción del script (sale del SQL)
  const [scriptInfo, setScriptInfo] = useState(null);

  const loadPrecios = async () => {
    setError(null);
    try {
      const r = await window.api.getPrecios();
      if (r?.success) setPrecios(r.precios || r.data || []);
      else setError(r?.message || "No se pudieron obtener los precios.");
    } catch {
      setError("Error de conexión al inicializar la página.");
    }
  };

  const loadScriptInfo = async () => {
    try {
      const r = await window.api.getPreciosScriptInfo?.();
      if (r?.success) setScriptInfo(r);
    } catch {
      // silencioso
    }
  };

  useEffect(() => {
    loadPrecios();
    loadScriptInfo();
  }, []);

  // ⬇️ progreso en vivo
  useEffect(() => {
    const off = window.api.onPreciosProgress((p) => setProgress(p));
    return () => off && off();
  }, []);

  const handleUpdatePrices = async () => {
    setIsUpdating(true);
    setError(null);
    setSuccessMessage("");
    setProgress({ percent: 0, stage: "Preparando", message: "Iniciando…" });

    try {
      const res = await window.api.actualizarPrecios({ mode: "progressive" });
      if (!res?.success) throw new Error(res?.message || "Ocurrió un error durante la actualización.");

      const updated = await window.api.getPreciosActualizados();
      if (updated?.success) {
        setPreciosActualizados(updated.preciosActualizados || updated.data || []);
        setShowActualizados(true);
        setSuccessMessage(res.message || "Precios actualizados.");
      } else {
        throw new Error(updated?.message || "No se pudieron obtener los precios actualizados.");
      }
    } catch (e) {
      setError(e.message || "Error de conexión al actualizar los precios.");
    } finally {
      setIsUpdating(false);
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
          <ScriptUpdated
            precios={preciosActualizados}
            onVolver={handleVolver}
            successMessage={successMessage}
            error={error}
          />
        ) : (
          <Script
            precios={precios}
            scriptInfo={scriptInfo}
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
