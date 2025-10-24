"use client";

import React, { useEffect, useState, useCallback } from "react";
import styles from "./styles.module.css";

export default function ModulosGrid({ modules: _unused, onNavigate }) {
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [empresaOk, setEmpresaOk] = useState(false);
  const [demo, setDemo] = useState({ open: false, title: "", url: "" });

  // ---------------- Helpers de subscripción ----------------
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

  // ---------------- Helpers de video ----------------
  const toEmbedUrl = (url) => {
    if (!url) return null;
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./, "");
      if (host === "youtube.com" || host === "m.youtube.com") {
        const v = u.searchParams.get("v");
        return v ? `https://www.youtube.com/embed/${v}` : url;
      }
      if (host === "youtu.be") {
        const id = u.pathname.split("/").filter(Boolean)[0];
        return id ? `https://www.youtube.com/embed/${id}` : url;
      }
      return url; // http(s) no-YouTube
    } catch {
      return url; // ruta local
    }
  };

  // Convierte rutas del proyecto a /public (sirve Next)
  const resolveLocalPublicPath = (raw) => {
    if (!raw) return null;
    let p = String(raw).trim().replace(/\\/g, "/"); // Windows → /
    const idx = p.toLowerCase().lastIndexOf("/public/");
    if (idx >= 0) p = p.slice(idx + "/public".length + 1); // saca "public/"
    if (!p.includes("/")) p = `video/${p}`; // nombre suelto → /video
    if (!p.startsWith("/")) p = `/${p}`;
    return p;
  };

  // URL final: embed si YouTube, si no /video/xxx.mp4 (o la ruta mapeada)
  const resolveVideoSrc = (raw) => {
    if (!raw) return null;
    const embedOrRaw = toEmbedUrl(raw);
    if (/^https?:\/\//i.test(String(raw))) return embedOrRaw;
    return resolveLocalPublicPath(raw);
  };

  // Si por alguna razón el main no envía "habilitado", lo calculamos acá
  const mergeHabilitadosFallback = async (list, idCliente) => {
    try {
      if (!list?.length) return list || [];
      if (list.some(m => Object.prototype.hasOwnProperty.call(m, "habilitado"))) return list;

      const ref = await window.api.getModulosXCliente?.(idCliente);
      const setIds = ref?.success
        ? new Set(
            Array.isArray(ref.idsHabilitados)
              ? ref.idsHabilitados
              : (ref.modulosXCliente || []).map(r => r.IdModulo)
          )
        : new Set();
      return list.map(m => ({ ...m, habilitado: setIds.has(m.id) }));
    } catch {
      return list;
    }
  };

  // ---------------- Fetch principal (con gate de empresa) ----------------
  const fetchModules = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      if (!window?.api) throw new Error("API no disponible (preload).");

      const [idCliente, instanciaBD] = await Promise.all([
        window.api.getStoreValue?.("idCliente"),
        window.api.getStoreValue?.("selectedInstanciaBD"),
      ]);

      const ok = !!(idCliente && instanciaBD);
      setEmpresaOk(ok);

      // Gate: sin empresa seleccionada NO mostramos módulos (solo mostramos el cartel rojo)
      if (!ok) {
        setModules([]);
        return;
      }

      const res = await window.api.getModules?.(idCliente);
      if (!res?.success) throw new Error(res?.message || "No se pudieron obtener los módulos.");

      let list = await mergeHabilitadosFallback(res.modulos || [], idCliente);
      list = list.map(m => ({ ...m, video: resolveVideoSrc(m.video) }));
      setModules(list);
    } catch (err) {
      setError(err.message || "Error al cargar módulos.");
      setModules([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // ---------------- Efectos / suscripciones ----------------
  useEffect(() => { fetchModules(); }, [fetchModules]);

  // Actualización push desde main, con gate de empresa
  useEffect(() => {
    const handler = async ({ modulos }) => {
      const [idCliente, instanciaBD] = await Promise.all([
        window.api.getStoreValue?.("idCliente"),
        window.api.getStoreValue?.("selectedInstanciaBD"),
      ]);
      const ok = !!(idCliente && instanciaBD);
      setEmpresaOk(ok);
      if (!ok) { setModules([]); return; }

      let list = await mergeHabilitadosFallback(Array.isArray(modulos) ? modulos : [], idCliente);
      list = list.map(m => ({ ...m, video: resolveVideoSrc(m.video) }));
      setModules(list);
      setLoading(false);
      if (!list.length) setError("");
    };
    return subscribe("menu:modules-updated", handler);
  }, [subscribe]);

  // Login / logout
  useEffect(() => {
    const unsub = subscribe("session:state", (s) => {
      if (s?.status === "logged-out") {
        setModules([]);
        setError("Sesión finalizada. Iniciá sesión para ver módulos.");
        setLoading(false);
        setEmpresaOk(false);
      } else if (s?.status === "logged-in") {
        fetchModules();
      }
    });
    return unsub;
  }, [subscribe, fetchModules]);

  // Selección de empresa (push) → refrescar
  useEffect(() => {
    const unsub = subscribe("empresa:selected", () => { fetchModules(); });
    return unsub;
  }, [subscribe, fetchModules]);

  // Cambios en store: idCliente o selectedInstanciaBD
  useEffect(() => {
    const unsub = subscribe("store:any-change", (delta) => {
      if (!delta) return;
      if (
        Object.prototype.hasOwnProperty.call(delta, "idCliente") ||
        Object.prototype.hasOwnProperty.call(delta, "selectedInstanciaBD")
      ) {
        fetchModules();
      }
    });
    return unsub;
  }, [subscribe, fetchModules]);

  // ---------------- Interacciones ----------------
  const openDemo = (m) => {
    const src = resolveVideoSrc(m.video);
    if (!src) {
      alert("No hay video de demostración disponible para este módulo.");
      return;
    }
    setDemo({ open: true, title: m.nombre || "Demostración", url: src });
  };

  const closeDemo = () => setDemo({ open: false, title: "", url: "" });

  const goTo = async (mod) => {
    if (mod?.habilitado) {
      if (onNavigate) return onNavigate(mod);
      const target = `${mod.link}?modulo=${encodeURIComponent(mod.nombre)}`;
      window.location.href = target;
      return;
    }
    const ok = window.confirm(
      "Usted no tiene habilitado el módulo. ¿Desea ver una demostración del funcionamiento del módulo?"
    );
    if (ok) openDemo(mod);
  };

  // ---------------- Render ----------------
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

  // Cartel rojo cuando no hay empresa seleccionada
  if (!empresaOk) {
    return (
      <div>
        
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.wrapper}>
        <h3 className={styles.title}>Tus Módulos</h3>
        <div className={styles.error}>⚠ {error}</div>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <h3 className={styles.title}>Tus Módulos</h3>

      <div
        className={styles.grid}
      >
        {(modules || []).map((m) => {
          const icono = (m.icono ?? "").toString().trim();
          const isImg =
            icono.startsWith("http") || icono.startsWith("data:") || icono.startsWith("/");

          const iconText = icono || (m.nombre || "?").trim().charAt(0).toUpperCase();

          return (
            <button
              key={m.id || m.nombre}
              className={` ${!m.habilitado ? styles.cardDisabled : styles.card}`}
              onClick={() => goTo(m)}
              title={m.texto || m.nombre}
              aria-label={`Abrir módulo ${m.nombre}`}
            >
              <div className={styles.circle}>
                {isImg ? (
                  <img src={icono} alt={m.nombre} className={styles.iconImg} />
                ) : (
                  <span className={styles.initial}>{iconText}</span>
                )}
              </div>
              <div className={styles.name} title={m.nombre}>
                {m.nombre}
              </div>
            </button>
          );
        })}
      </div>

      {/* Modal de demo */}
      {demo.open && (
        <div
          role="dialog"
          aria-modal="true"
          className={styles.modalOverlay}
          onClick={closeDemo}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h4 className={styles.modalTitle}>{demo.title}</h4>
              <button className={styles.modalClose} onClick={closeDemo}>✕</button>
            </div>

            {typeof demo.url === "string" &&
            (demo.url.includes("youtube.com/embed/") ||
              demo.url.includes("youtu.be/")) ? (
              <iframe
                src={demo.url}
                title={demo.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className={styles.modalFrame}
              />
            ) : (
              <video src={demo.url} controls className={styles.modalVideo} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
