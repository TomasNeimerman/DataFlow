"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import styles from "./styles.module.css";

export default function LoginPage() {
  const [usuario, setUsuario] = useState("");
  const [contraseña, setContraseña] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const hardRefresh = () => {
    try {
      if (window?.api?.reload) window.api.reload();
      else window.location.reload();
    } catch {}
  };

  // Suscripción compatible con window.api.on/off y CustomEvent fallback
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

  // Si ya hay sesión, ir a /Index
  useEffect(() => {
    (async () => {
      try {
        const idCliente = await window.api?.getStoreValue?.("idCliente");
        if (idCliente) router.replace("/Index");
      } catch {}
    })();
  }, [router]);

  // Redirigir/aplicar refresh cuando el main confirma login
  useEffect(() => {
    const unsub = subscribe("session:state", async (s) => {
      if (s?.status === "logged-in") {
        const idCliente = await window.api?.getStoreValue?.("idCliente");
        if (!idCliente) {
          setError("No se pudo recuperar el idCliente luego del login.");
          setLoading(false);
          return;
        }
        router.replace("/Index");
        // 🔁 pequeño refresh para que banner/módulos se pinten ya
        setTimeout(hardRefresh, 60);
      }
    });
    return unsub;
  }, [subscribe, router]);

  const handleLogin = async () => {
    try {
      setError("");
      setLoading(true);

      if (!usuario || !contraseña) {
        setError("Completá usuario y contraseña.");
        setLoading(false);
        return;
      }

      // 1) Debe existir la BD local "manager"
      const chk = await window.api?.hasManager?.();
      if (!chk?.ok) {
        setError("No se encuentra sistema Bejerman ERP instalado");
        setLoading(false);
        return;
      }

      // 2) Login (main persiste en electron-store y emite session:state)
      const response = await window.api?.login?.(usuario, contraseña);
      if (!response?.success) {
        setError(response?.message || "Error al iniciar sesión.");
        setLoading(false);
        return;
      }

      // Compat con legacy localStorage (si lo venís usando)
      localStorage.setItem("fechaInicio", new Date().toISOString());
      localStorage.setItem("jwtToken", response.token || "");

      // 3) Redirección inmediata (el refresh viene por el evento arriba)
      router.push("/Index");
    } catch (err) {
      console.error(err);
      setError("Error al iniciar sesión.");
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter") handleLogin();
  };

  return (
    <div className={styles.body}>
      <div className={styles.container} onKeyDown={onKeyDown}>
        <h1 className={styles.title}>Ingresar</h1>

        <div className={styles.inputgroup}>
          <label htmlFor="usuario" className={styles.label}>Usuario</label>
          <input
            type="text"
            id="usuario"
            className={styles.input}
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            required
          />
        </div>

        <div className={styles.inputgroup}>
          <label htmlFor="contraseña" className={styles.label}>Contraseña</label>
          <input
            className={styles.input}
            type="password"
            id="contraseña"
            value={contraseña}
            onChange={(e) => setContraseña(e.target.value)}
            required
          />
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <button className={styles.btn} onClick={handleLogin} disabled={loading}>
          {loading ? "Ingresando..." : "Ingresar"}
        </button>
      </div>
    </div>
  );
}
