// components/HamburgerMenu.jsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import styles from "./styles.module.css";

export default function HamburgerMenu() {
  const [open, setOpen] = useState(false);
  const [modules, setModules] = useState([]);
  const [loadingMods, setLoadingMods] = useState(false);
  const [errorMods, setErrorMods] = useState(null);
  const [filter, setFilter] = useState("");
  const [isDev, setIsDev] = useState(false); 
  const panelRef = useRef(null);

  // --- Fetch módulos desde Electron usando la función del preload ---
  const fetchModules = async () => {
    setLoadingMods(true);
    setErrorMods(null);
    try {
      const idCliente = await window.api.getStoreValue("idCliente");

      if (!idCliente) {
        setModules([]);
        setLoadingMods(false);
        return;
      }

      // *** ACA usamos la función que mostraste ***
      const res = await window.api.getModules(idCliente);

      // Soportar dos formatos: array plano o { success, modulos }
      const list = Array.isArray(res) ? res : res?.modulos || [];

      // Normalizar shape por si vienen otras keys
      const mapped = (list || []).map((m, i) => ({
        id: m.id ?? m.Id ?? m.ID ?? i,
        nombre: m.nombre ?? m.texto ?? "Módulo",
        texto: m.texto ?? m.nombre ?? "",
        link: m.link ?? "/Index",
        icono: m.icono,
        countClientesPorModulo: m.countClientesPorModulo,
      }));

      setModules(mapped);
    } catch (err) {
      setErrorMods(err?.message || "No se pudieron cargar los módulos.");
      setModules([]);
    } finally {
      setLoadingMods(false);
    }
  };
   useEffect(() => {
    (async () => {
      try { setIsDev(!!(await window?.api?.isDev?.())); } catch { setIsDev(false); }
    })();
  }, []);
  // Prefetch al montar (para que ya estén cuando abras)
  useEffect(() => {
    fetchModules();
  }, []);

  // Si abrís y no hay módulos (o falló antes), reintenta
  useEffect(() => {
    if (open && !loadingMods && modules.length === 0 && !errorMods) {
      fetchModules();
    }
  }, [open]);

  // Cerrar con clic afuera o ESC
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => e.key === "Escape" && setOpen(false);
    const onClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("keydown", onDown);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onDown);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const goToModule = (m) => {
    try {
      const nombre = m?.nombre ?? m?.texto ?? "Modulo";
      const link = m?.link ?? "/Index";
      window.location.href = `${link}?modulo=${encodeURIComponent(nombre)}`;
      setOpen(false);
    } catch {}
  };

  const filtered = modules.filter((m) => {
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    const s = `${m?.nombre ?? ""} ${m?.texto ?? ""}`.toLowerCase();
    return s.includes(q);
  });

  return (
    <>
      {/* Botón flotante */}
      <button
        className={`${styles.hamburgerBtn} ${open ? styles.btnDisabled : ""}`}
        aria-label="Abrir menú"
        title="Menú"
        aria-expanded={open}
        aria-controls="hm-panel"
        onClick={() => setOpen((v) => !v)}
        disabled={open}
      >
        <svg width="22" height="16" viewBox="0 0 22 16" aria-hidden="true">
          <line x1="1" y1="2"  x2="21" y2="2"  stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          <line x1="1" y1="8"  x2="21" y2="8"  stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          <line x1="1" y1="14" x2="21" y2="14" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </button>

      {/* Overlay transparente para captar click afuera */}
      <div className={`${styles.overlay} ${open ? styles.show : ""}`}>
        <aside
          id="hm-panel"
          ref={panelRef}
          className={`${styles.panel} ${open ? styles.dropIn : ""}`}
          role="dialog"
          aria-modal="true"
          aria-label="Menú"
        >
          {/* Header */}
          <div className={styles.panelHeader}>
            <span className={styles.title}>Menú</span>
            <button className={styles.close} aria-label="Cerrar" onClick={() => setOpen(false)}>✕</button>
          </div>

          {/* Contenido scroll */}
          <div className={styles.scroll}>
            {/* Grupo: Módulos */}
            <div className={styles.group}>
              <div className={styles.groupHeader}>
                <span className={styles.groupTitle}>Módulos</span>
                <input
                  className={styles.search}
                  placeholder="Buscar módulo…"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
              </div>

              {/* Estados: loading / error / lista */}
              {loadingMods && <div className={styles.info}>Cargando módulos…</div>}
              {errorMods && <div className={styles.error}>⚠ {errorMods}</div>}

              {!loadingMods && !errorMods && (
                <ul className={styles.list}>
                  {filtered.length === 0 && (
                    <li className={styles.empty}>No hay módulos para mostrar</li>
                  )}
                  {filtered.map((m) => (
                    <li
                      key={m.id ?? m.nombre ?? m.texto}
                      className={styles.item}
                      onClick={() => goToModule(m)}
                    >
                      <div className={styles.bullet}>
                        {(m?.nombre ?? m?.texto ?? "M")[0]?.toUpperCase()}
                      </div>
                      <div className={styles.itemBody}>
                        <div className={styles.itemTitle}>{m?.nombre ?? m?.texto}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Grupo: Otros — full-width */}
            <div className={styles.group}>
              <div className={styles.groupHeader}>
                <span className={styles.groupTitle}>Otros</span>
              </div>

              <div className={styles.actionsColumn}>
                <button
                  className={styles.actionWide}
                  onClick={() => (window?.api?.reload ? window.api.reload() : window.location.reload())}
                >
                  (F5) Recargar
                </button>

                  <button
                    className={styles.actionWide}
                    onClick={() => window?.api?.toggleDevTools?.()}>
                  (F12) DevTools
                </button>
            
                <button
                  className={styles.actionWide}
                  onClick={async () => {
                    try { await window?.api?.logout?.(); } catch {}
                    window.location.href = "/Login";
                  }}
                >
                  Cerrar sesión
                </button>
                <button
                  className={styles.actionDangerWide}
                  onClick={() => window?.api?.quit?.()}
                >
                  (Esc) Salir al escritorio
                </button>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
