"use client";

import React, { useEffect, useState, useCallback } from "react";
import styles from "./styles.module.css";
import Video from "../Video";

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
  // Convierte rutas locales del proyecto a /public (sirve Next)
const resolveLocalPublicPath = (raw) => {
  if (!raw) return null;
  let p = String(raw).trim().replace(/\\/g, "/"); // Windows -> /

  // Recortar TODO lo que esté antes de "public/"
  // matches: "public/foo", "/public/foo", "C:/app/public/foo", etc.
  const m = p.match(/(?:^|\/)public\/(.*)$/i);
  if (m && m[1]) p = m[1]; // nos quedamos con "foo"

  // Si quedó sólo el filename -> mandarlo a /video/<file>
  if (!/^https?:\/\//i.test(p)) {
    if (!p.includes("/")) p = `video/${p}`;
    if (!p.startsWith("/")) p = `/${p}`;
  }
  return p;
};

  // URL final: si es http(s) la dejo tal cual (YouTube u otro),
  // si es local la normalizo a /public. (NO convertimos a /embed aquí)
const resolveVideoSrc = (raw) => {
  if (!raw) return null;
  const s = String(raw).trim();
  if (/^https?:\/\//i.test(s)) return s;   // YouTube/MP4 remoto
  return resolveLocalPublicPath(s);        // local -> /video/...
};

  // Si el main no envía "habilitado", lo calculamos acá
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
      return list.map(m => ({
        ...m,
        habilitado: setIds.has(m.id ?? m.ModuloId ?? m.Id)
      }));
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

      // Gate: sin empresa seleccionada NO mostramos módulos (solo el cartel rojo)
      if (!ok) {
        setModules([]);
        return;
      }

      const res = await window.api.getModules?.(idCliente);
      if (!res?.success) throw new Error(res?.message || "No se pudieron obtener los módulos.");

      let list = await mergeHabilitadosFallback(res.modulos || [], idCliente);
      list = list.map(m => ({ ...m, video: resolveVideoSrc(m.video ?? m.Video) }));
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
      list = list.map(m => ({ ...m, video: resolveVideoSrc(m.video ?? m.Video) }));
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
  const src = m.video || m.Video || m.demoUrl || "";
  if (!src) { alert("No hay video de demostración disponible para este módulo."); return; }
  console.log("[Demo video src]", src);
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
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className={`${styles.card} ${styles.skeleton}`} />
          ))}
        </div>
      </div>
    );
  }

  // Cartel rojo cuando no hay empresa seleccionada
  if (!empresaOk) {
    return (
      <div className={styles.wrapper}>
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

      <div className={styles.grid}>
        {(modules || []).map((m) => {
          const icono = (m.icono ?? "").toString().trim();
          const isImg =
            icono.startsWith("http") || icono.startsWith("data:") || icono.startsWith("/");

          const iconText = icono || (m.nombre || "?").trim().charAt(0).toUpperCase();

          return (
            <button
              key={m.id || m.nombre}
              className={`${styles.card} ${!m.habilitado ? styles.cardDisabled : ""}`}
              onClick={() => goTo(m)}
              title={!m.habilitado ? `No habilitado` : m.texto || m.nombre}
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
      <Video
        open={demo.open}
        title={demo.title}
        src={demo.url}
        onClose={closeDemo}
      />
    </div>
  );
}
