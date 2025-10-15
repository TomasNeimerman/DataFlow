"use client";

import React, { useEffect, useState, useCallback } from "react";
import styles from "./styles.module.css";

export default function ModulosGrid({ modules: modulesProp, onNavigate }) {
  const [modules, setModules] = useState(modulesProp || []);
  const [loading, setLoading] = useState(!modulesProp);
  const [error, setError] = useState("");

  // Helper para suscribirse tanto a window.api.on/off como a CustomEvent (fallback)
  const subscribe = useCallback((channel, handler) => {
    if (typeof window === "undefined") return () => {};
    if (window?.api?.on) {
      window.api.on(channel, handler);
      return () => window.api.off?.(channel, handler);
    } else {
      const h = (e) => handler(e.detail);
      window.addEventListener(channel, h);
      return () => window.removeEventListener(channel, h);
    }
  }, []);

  const fetchModules = useCallback(async () => {
    if (modulesProp && modulesProp.length) return;
    try {
      setLoading(true);
      setError("");

      if (!window?.api) throw new Error("API no disponible (preload).");

      // Gate: exigimos empresa seleccionada (aceptamos cualquiera de las 2 keys)
      const selectedInstancia =
        (await window.api.getStoreValue?.("selectedInstanciaBD")) ||
        (await window.api.getStoreValue?.("selectedEmpresaCodigo"));

      if (!selectedInstancia) {
        setModules([]);
        setError("Debes seleccionar una empresa para habilitar tus módulos.");
        return;
      }

      const idCliente = await window.api.getStoreValue?.("idCliente");
      if (!idCliente) throw new Error("No se encontró idCliente en el store.");

      // requiere que el preload exponga getModules (lo dejo abajo)
      const res = await window.api.getModules?.(idCliente);
      if (!res?.success) throw new Error(res?.message || "No se pudieron obtener los módulos.");
      setModules(res.modulos || []);
    } catch (err) {
      setError(err.message || "Error al cargar módulos.");
    } finally {
      setLoading(false);
    }
  }, [modulesProp]);

  // Primera carga
  useEffect(() => { fetchModules(); }, [fetchModules]);

  // 🔔 Actualizar en vivo cuando main emita los nuevos módulos
  useEffect(() => {
    const unsub = subscribe("menu:modules-updated", ({ modulos }) => {
      const list = Array.isArray(modulos) ? modulos : [];
      setModules(list);
      setLoading(false);
      if (!list.length) {
        // si el backend mandó vacío, no asumimos error; dejamos vacío con mensaje neutro
        setError("");
      }
    });
    return unsub;
  }, [subscribe]);

  // 🔔 Reaccionar cuando cambia la empresa (evento push desde main)
  useEffect(() => {
    const unsub = subscribe("empresa:selected", async (payload) => {
      // payload: { idCliente, empCodigo, instanciaBD, nombre }
      if (payload?.empCodigo || payload?.instanciaBD) {
        setError("");
        await fetchModules();
      } else {
        setModules([]);
        setError("Debes seleccionar una empresa para habilitar tus módulos.");
      }
    });
    return unsub;
  }, [subscribe, fetchModules]);

  // 🔔 Si cambia el store (p. ej. idCliente o selectedInstanciaBD), nos actualizamos
  useEffect(() => {
    const unsub = subscribe("store:any-change", async (delta) => {
      // Si limpiaron la selección de empresa o idCliente → vaciar
      if (
        ("selectedInstanciaBD" in delta && !delta.selectedInstanciaBD) ||
        ("idCliente" in delta && !delta.idCliente)
      ) {
        setModules([]);
        setError("Debes seleccionar una empresa para habilitar tus módulos.");
        setLoading(false);
        return;
      }
      // Si aparece idCliente/instancia, refrescamos
      if (delta.selectedInstanciaBD || delta.idCliente) {
        setError("");
        await fetchModules();
      }
    });
    return unsub;
  }, [subscribe, fetchModules]);

  // 🔔 Si la sesión se cierra remotamente, limpiar
  useEffect(() => {
    const unsub = subscribe("session:state", (s) => {
      if (s?.status === "logged-out") {
        setModules([]);
        setError("Sesión finalizada. Iniciá sesión y seleccioná una empresa.");
        setLoading(false);
      }
    });
    return unsub;
  }, [subscribe]);

  const goTo = async (mod) => {
    const selectedInstancia =
      (await window.api.getStoreValue?.("selectedInstanciaBD")) ||
      (await window.api.getStoreValue?.("selectedEmpresaCodigo"));
    if (!selectedInstancia) {
      setError("Debes seleccionar una empresa para habilitar tus módulos.");
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
