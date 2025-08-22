// components/ModulosGrid.jsx
"use client";

import React, { useEffect, useState } from "react";
import styles from "./styles.module.css";

/**
 * Muestra los módulos del usuario en “burbujas” circulares.
 * Si no se pasan por props, los busca con window.api.getModules(idCliente).
 *
 * Props opcionales:
 * - modules: [{ id, nombre, texto, icono, link, pathExcel, countClientesPorModulo }]
 * - onNavigate: (modulo) => void  (si querés sobreescribir la navegación)
 */
export default function ModulosGrid({ modules: modulesProp, onNavigate }) {
  const [modules, setModules] = useState(modulesProp || []);
  const [loading, setLoading] = useState(!modulesProp);
  const [error, setError] = useState("");

  useEffect(() => {
    if (modulesProp && modulesProp.length) return; // ya vinieron por props

    const fetchModules = async () => {
      try {
        setLoading(true);
        setError("");

        if (!window?.api) throw new Error("API no disponible (preload).");

        // Traemos el idCliente desde electron-store
        const idCliente = await window.api.getStoreValue?.("idCliente");
        if (!idCliente) throw new Error("No se encontró idCliente en el store.");

        // Llamado al IPC "get-modules"
        const res = await window.api.getModules?.(idCliente);
        if (!res?.success) throw new Error(res?.message || "No se pudieron obtener los módulos.");

        setModules(res.modulos || []);
      } catch (err) {
        setError(err.message || "Error al cargar módulos.");
      } finally {
        setLoading(false);
      }
    };

    fetchModules();
  }, [modulesProp]);

  const goTo = (mod) => {
    if (onNavigate) return onNavigate(mod);
    // Navegación simple en Next/Electron: igual que el menú (con query modulo=Nombre)
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

      {/* 👇 seteamos --cols dinámico */}
      <div
        className={styles.grid}
        style={{ "--cols": Math.max(1, Math.min(modules.length, 8)) }}
      >
        {modules.map((m) => {
          const isImg =
            typeof m.icono === "string" &&
            (m.icono.startsWith("http") || m.icono.startsWith("data:") || m.icono.startsWith("/"));

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
                  <img src={m.icono} alt={m.nombre} className={styles.iconImg} />
                ) : (
                  <span className={styles.initial}>
                    {(m.nombre || "?").trim().charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className={styles.name} title={m.nombre}>{m.nombre}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
