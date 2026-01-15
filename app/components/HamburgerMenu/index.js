"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import styles from "./styles.module.css";
import Image from 'next/image';
import menu from '../../public/icons/menu.png'

export default function HamburgerMenu() {
  const [open, setOpen] = useState(false);
  const [modules, setModules] = useState([]);
  const [loadingMods, setLoadingMods] = useState(false);
  const [errorMods, setErrorMods] = useState(null);
  const [filter, setFilter] = useState("");
  const [showBtn, setShowBtn] = useState(false); // 👈 visibilidad del botón según idCliente
  const panelRef = useRef(null);

  // Helper de subscripción (api.on / CustomEvent fallback)
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

  // Chequea idCliente y muestra/oculta el botón
  const refreshShowBtn = useCallback(async () => {
    try {
      const idCliente = await window?.api?.getStoreValue?.("idCliente");
      const ok = !!idCliente;
      setShowBtn(ok);
      if (!ok) setOpen(false); // si desaparece, cerramos el panel
    } catch {
      setShowBtn(false);
      setOpen(false);
    }
  }, []);

  // Montaje: estado inicial del botón
  useEffect(() => { refreshShowBtn(); }, [refreshShowBtn]);

  // Reaccionar a cambios del store y de la sesión
  useEffect(() => {
    const unsubStore = subscribe("store:any-change", (delta) => {
      if (delta && Object.prototype.hasOwnProperty.call(delta, "idCliente")) {
        refreshShowBtn();
      }
    });
    const unsubSession = subscribe("session:state", (s) => {
      if (s?.status === "logged-out") {
        setShowBtn(false);
        setOpen(false);
      } else if (s?.status === "logged-in") {
        refreshShowBtn();
      }
    });
    return () => { unsubStore?.(); unsubSession?.(); };
  }, [subscribe, refreshShowBtn]);

  // Trae SOLO los módulos asignados al usuario
  const fetchModules = useCallback(async (force = false) => {
    setLoadingMods(true);
    setErrorMods(null);
    try {
      if (!window?.api) throw new Error("API no disponible (preload).");

      // Gate: exigir empresa seleccionada (cualquiera de los dos flags)
      if (!force) {
        const [selectedCode, instanciaBD] = await Promise.all([
          window.api.getStoreValue?.("selectedEmpresaCodigo"),
          window.api.getStoreValue?.("selectedInstanciaBD"),
        ]);
        if (!selectedCode && !instanciaBD) {
          setModules([]);
          setErrorMods("Debes seleccionar una empresa para habilitar tus módulos.");
          return;
        }
      }

      const idCliente = await window.api.getStoreValue?.("idCliente");
      if (!idCliente) throw new Error("No se encontró idCliente en el store.");

      // 1) Obtener lista general
      const res = await window.api.getModules?.(idCliente);
      let list = Array.isArray(res) ? res : res?.modulos || [];

      // 2) Filtrar SOLO habilitados
      const hasHabilitado = list.some((m) => Object.prototype.hasOwnProperty.call(m, "habilitado"));
      if (hasHabilitado) {
        list = list.filter((m) => !!m.habilitado);
      } else {
        // Fallback: pedir ids habilitados y filtrar por IdModulo
        const ref = await window.api.getModulosXCliente?.(idCliente);
        const idsSet = ref?.success
          ? new Set(
              Array.isArray(ref.idsHabilitados)
                ? ref.idsHabilitados
                : (ref.modulosXCliente || []).map((r) => r.IdModulo)
            )
          : new Set();
        list = list.filter((m) => {
          const id = m.id ?? m.ModuloId ?? m.Id;
          return idsSet.has(id);
        });
      }

      // 3) Map a forma de menú
      const mapped = (list || []).map((m, i) => ({
        id: m.id ?? m.ModuloId ?? m.Id ?? i,
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

  // Prefetch al montar
  useEffect(() => { fetchModules(); }, [fetchModules]);

  // Reaccionar al elegir/limpiar empresa desde BDSelect (evento DOM)
  useEffect(() => {
    const onEmpresaSelected = (e) => {
      const code = e?.detail?.id || "";
      if (code) {
        setErrorMods(null);
        setModules([]);
        fetchModules(true); // fuerza recarga
      } else {
        setModules([]);
        setErrorMods("Debes seleccionar una empresa para habilitar tus módulos.");
      }
    };
    window.addEventListener("empresa:selected", onEmpresaSelected);
    return () => window.removeEventListener("empresa:selected", onEmpresaSelected);
  }, [fetchModules]);

  // Reintenta cada vez que se abre el panel
  useEffect(() => { if (open) fetchModules(); }, [open, fetchModules]);

  // Cerrar con clic afuera o ESC
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => e.key === "Escape" && setOpen(false);
    const onClick = (e) => { if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("keydown", onDown);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onDown);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const goToModule = async (m) => {
    const [selectedCode, instanciaBD] = await Promise.all([
      window.api.getStoreValue?.("selectedEmpresaCodigo"),
      window.api.getStoreValue?.("selectedInstanciaBD"),
    ]);
    if (!selectedCode && !instanciaBD) {
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

  // 👇 Si no hay idCliente, no mostramos botón ni panel
  if (!showBtn) return null;

  return (
    <>
      {/* Botón flotante (se muestra solo si showBtn === true) */}
      <button
        className={`${styles.hamburgerBtn} ${open ? styles.btnDisabled : ""}`}
        aria-label="Abrir menú"
        title="Menú"
        aria-expanded={open}
        aria-controls="hm-panel"
        onClick={() => setOpen((v) => !v)}
        disabled={open}
      >
       <Image src={menu} alt="Hamburger Menu" width={24} height={24} />
      </button>

      {/* Overlay / Panel */}
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
                    const iconText = icono || (m.nombre || "?").trim().charAt(0).toUpperCase();
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
                  onClick={() => window.location.href = "/Index"}
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
