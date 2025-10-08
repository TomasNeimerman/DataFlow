"use client";

import React, { useEffect, useState, useCallback } from "react";
import styles from "./styles.module.css";

export default function ModulosGrid({ modules: modulesProp, onNavigate }) {
  const [modules, setModules] = useState(modulesProp || []);
  const [loading, setLoading] = useState(!modulesProp);
  const [error, setError] = useState("");

  const fetchModules = useCallback(async () => {
    if (modulesProp && modulesProp.length) return;
    try {
      setLoading(true);
      setError("");

      if (!window?.api) throw new Error("API no disponible (preload).");

      // Gate: exigimos empresa seleccionada
      const selectedCode = await window.api.getStoreValue?.("selectedEmpresaCodigo");
      if (!selectedCode) {
        setModules([]);
        setError("Debes seleccionar una empresa para habilitar los módulos.");
        return;
      }

      const idCliente = await window.api.getStoreValue?.("idCliente");
      if (!idCliente) throw new Error("No se encontró idCliente en el store.");

      const res = await window.api.getModules?.(idCliente);
      if (!res?.success) throw new Error(res?.message || "No se pudieron obtener los módulos.");
      setModules(res.modulos || []);
    } catch (err) {
      setError(err.message || "Error al cargar módulos.");
    } finally {
      setLoading(false);
    }
  }, [modulesProp]);

  useEffect(() => { fetchModules(); }, [fetchModules]);

  // Reaccionar cuando cambia la empresa
  useEffect(() => {
    const onEmpresaSelected = (e) => {
      const code = e?.detail?.id || "";
      if (code) fetchModules();
      else {
        setModules([]);
        setError("Debes seleccionar una empresa para habilitar los módulos.");
      }
    };
    window.addEventListener("empresa:selected", onEmpresaSelected);
    return () => window.removeEventListener("empresa:selected", onEmpresaSelected);
  }, [fetchModules]);

  const goTo = async (mod) => {
    const selectedCode = await window.api.getStoreValue?.("selectedEmpresaCodigo");
    if (!selectedCode) {
      setError("Debes seleccionar una empresa para habilitar los módulos.");
      return;
    }
    if (onNavigate) return onNavigate(mod);
    const target = `${mod.link}?modulo=${encodeURIComponent(mod.nombre)}`;
    window.location.href = target;
  };

  if (loading) {
    return (
      <div className={styles.wrapper}>
        <h3 className={styles.title}>Tus módulos</h3>
        <div className={styles.grid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`${styles.card} ${styles.skeleton}`} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.wrapper}>
        <h3 className={styles.title}>Tus módulos</h3>
        <div className={styles.error}>⚠ {error}</div>
      </div>
    );
  }

  if (!modules?.length) {
    return (
      <div className={styles.wrapper}>
        <h3 className={styles.title}>Tus módulos</h3>
        <div className={styles.empty}>No tenés módulos asignados.</div>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <h3 className={styles.title}>Tus módulos</h3>

      <div
        className={styles.grid}
        style={{ "--cols": Math.max(1, Math.min(modules.length, 8)) }}
      >
        {modules.map((m) => {
          const icono = (m.icono ?? "").toString().trim();
          const isImg =
            icono.startsWith("http") ||
            icono.startsWith("data:") ||
            icono.startsWith("/");

          // Si no es imagen, usamos todo el valor de `icono` (letra, sigla, emoji, etc.)
          const iconText = icono || (m.nombre || "?").trim().charAt(0).toUpperCase();

          return (
            <button
              key={m.id || m.nombre}
              className={styles.card}
              onClick={() => goTo(m)}
              title={m.texto || m.nombre}
              aria-label={`Abrir módulo ${m.nombre}`}
            >
              <div className={styles.circle}>
                {isImg ? (
                  <img src={icono} alt={m.nombre} className={styles.iconImg} />
                ) : (
                  <span className={styles.initial} style={{ letterSpacing: 0 }}>
                    {iconText}
                  </span>
                )}
              </div>
              <div className={styles.name} title={m.nombre}>
                {m.nombre}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
