"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import styles from "./styles.module.css";

export default function HamburgerMenu() {
  const [open, setOpen] = useState(false);
  const [modules, setModules] = useState([]);
  const [loadingMods, setLoadingMods] = useState(false);
  const [errorMods, setErrorMods] = useState(null);
  const [filter, setFilter] = useState("");
  const [isDev, setIsDev] = useState(false);
  const panelRef = useRef(null);

  // --- helper: fetch módulos con gate de empresa
  const fetchModules = useCallback(async () => {
    setLoadingMods(true);
    setErrorMods(null);
    try {
      if (!window?.api) throw new Error("API no disponible (preload).");

      // Gate: exigir empresa seleccionada
      const selectedCode = await window.api.getStoreValue?.("selectedEmpresaCodigo");
      if (!selectedCode) {
        setModules([]);
        setErrorMods("Debes seleccionar una empresa para habilitar tus módulos.");
        return;
      }

      const idCliente = await window.api.getStoreValue?.("idCliente");
      if (!idCliente) throw new Error("No se encontró idCliente en el store.");

      const res = await window.api.getModules?.(idCliente);
      const list = Array.isArray(res) ? res : res?.modulos || [];
      const mapped = (list || []).map((m, i) => ({
        id: m.id ?? m.Id ?? m.ID ?? i,
        nombre: m.nombre ?? m.texto ?? "Módulo",
        texto: m.texto ?? m.nombre ?? "",
        link: m.link ?? "/Index",
        icono: (m.icono ?? "").toString().trim(),
        countClientesPorModulo: m.countClientesPorModulo,
      }));

      setModules(mapped);
    } catch (err) {
      setErrorMods(err?.message || "No se pudieron cargar los módulos.");
      setModules([]);
    } finally {
      setLoadingMods(false);
    }
  }, []);

  // saber si es dev (opcional)
  useEffect(() => {
    (async () => {
      try { setIsDev(!!(await window?.api?.isDev?.())); } catch { setIsDev(false); }
    })();
  }, []);

  // prefetch al montar
  useEffect(() => {
    fetchModules();
  }, [fetchModules]);

  // refrescar cuando se guarda/borra empresa (evento global)
  useEffect(() => {
    const onEmpresaSelected = (e) => {
      const code = e?.detail?.id || "";
      if (code) fetchModules();
      else {
        setModules([]);
        setErrorMods("Debes seleccionar una empresa para habilitar tus módulos.");
      }
    };
    window.addEventListener("empresa:selected", onEmpresaSelected);
    return () => window.removeEventListener("empresa:selected", onEmpresaSelected);
  }, [fetchModules]);

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

  const goToModule = async (m) => {
    const selectedCode = await window.api.getStoreValue?.("selectedEmpresaCodigo");
    if (!selectedCode) {
      setErrorMods("Debes seleccionar una empresa para habilitar tus módulos.");
      return;
    }
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
        <p className={styles.bold}>Menú</p>
      </button>

      {/* Overlay */}
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

          {/* Contenido */}
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

              {loadingMods && <div className={styles.info}>Cargando módulos…</div>}
              {errorMods && <div className={styles.error}>⚠ {errorMods}</div>}

              {!loadingMods && !errorMods && (
                <ul className={styles.list}>
                  {filtered.length === 0 && (
                    <li className={styles.empty}>No hay módulos para mostrar</li>
                  )}
                  {filtered.map((m) => {
                    const icono = (m.icono || "").trim();
                    const isImg =
                      icono.startsWith("http") ||
                      icono.startsWith("data:") ||
                      icono.startsWith("/");

                    const iconText =
                      icono || (m.nombre || "?").trim().charAt(0).toUpperCase();

                    return (
                      <li
                        key={m.id ?? m.nombre ?? m.texto}
                        className={styles.item}
                        onClick={() => goToModule(m)}
                      >
                        <div className={styles.bullet}>
                          {isImg ? (
                            <img
                              src={icono}
                              alt={m.nombre}
                              className={styles.iconImg}
                              style={{ width: 24, height: 24, objectFit: "contain" }}
                            />
                          ) : (
                            <span className={styles.initial} style={{ letterSpacing: 0 }}>
                              {iconText}
                            </span>
                          )}
                        </div>
                        <div className={styles.itemBody}>
                          <div className={styles.itemTitle}>{m?.nombre ?? m?.texto}</div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Grupo: Otros */}
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
                  onClick={() => window?.api?.toggleDevTools?.()}
                >
                  (F12) DevTools
                </button>
                <button
                  className={styles.actionWide}
                  onClick={() => { window.location.href = "/Index"; }}
                >
                  Inicio
                </button>
                <button
                  className={styles.actionDangerWide}
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
