// pages/Login/index.js
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import styles from "./styles.module.css";

export default function Login() {
  const router = useRouter();

  const [usuario, setUsuario] = useState("");
  const [contraseña, setContraseña] = useState("");
  const [remember, setRemember] = useState(true);        // ✅ toggle local
  const [rememberPersisted, setRememberPersisted] = useState(false);
  const [autoTrying, setAutoTrying] = useState(false);   // ✅ loader autologin
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

  // 🚀 Arranque: sincroniza remember + intenta autologin si corresponde
  useEffect(() => {
    (async () => {
      try {
        // ✅ Preferí el IPC remember:status (cae a store si no existe)
        let status = null;
        try { status = await window.api?.['remember:status']?.(); } catch {}
        if (!status) {
          const enabled = await window.api?.getStoreValue?.("remember.enabled");
          status = { enabled: !!enabled, user: "" };
        }

        setRemember(!!status.enabled);
        setRememberPersisted(!!status.enabled);
        // Prefill de usuario si lo tenemos (nice UX)
        if (status?.user) setUsuario(status.user);

        if (status?.enabled) {
          setAutoTrying(true);
          const r = await window.api?.attemptAutoLogin?.();
          setAutoTrying(false);
          if (r?.success) {
            router.replace("/Index");
            setTimeout(hardRefresh, 60);
            return;
          }
        }
      } catch {}

      // fallback: si ya hay idCliente, redirige igual
      try {
        const idCliente = await window.api?.getStoreValue?.("idCliente");
        if (idCliente) {
          router.replace("/Index");
          setTimeout(hardRefresh, 60);
        }
      } catch {}
    })();
  }, [router]);

  // Redirigir cuando el main confirma login
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

      // ────────────────────────────────────────────────
      // PASO ODBC (getServer + save + connect) + DEBUG
      // ────────────────────────────────────────────────
      try {
        console.log("[LOGIN] Paso ODBC: getServerForLogin...");
        const srv = await window.api.getServerForLogin(usuario, contraseña);
        console.log("[LOGIN] getServerForLogin resp:", srv);

        let serverToUse;
        if (srv?.ok && srv?.server) {
          serverToUse = srv.server;
        } else {
          const msg = srv?.message || "No se pudo determinar el servidor del cliente.";
          alert(`Atención\n\n${msg}\n\nSe usará "localhost" de manera automática.`);
          serverToUse = "localhost";
        }

        console.log("[LOGIN] saveServerForOdbc:", serverToUse);
        const sv = await window.api.saveServerForOdbc(serverToUse);
        console.log("[LOGIN] saveServerForOdbc resp:", sv);
        if (!sv?.ok) {
          setError(sv?.message || "No se pudo guardar el servidor");
          setLoading(false);
          return;
        }

        console.log("[LOGIN] odbcConnectAndSave...");
        const pre = await window.api.odbcConnectAndSave();
        console.log("[LOGIN] odbcConnectAndSave resp:", pre);

        // 🔦 Diagnóstico ODBC ——— (restaurado)
        if (pre?.debug) {
          const d = pre.debug || {};
          const lines = [
            `Paso: ${d.step || "desconocido"}`,
            d.code ? `Código: ${d.code}` : "",
            d.error?.message ? `Error: ${d.error.message}` : "",
            d.driverChosen ? `Driver elegido: ${d.driverChosen}` : "",
            d.usedVariant
              ? `Variante: server=${d.usedVariant.server} db=${d.usedVariant.database} enc=${d.usedVariant.encrypt} trust=${d.usedVariant.trust}`
              : "",
            d.connStrPreview ? `Conn: ${d.connStrPreview}` : "",
            d.drivers?.length ? `Drivers (x64): ${d.drivers.join(" | ")}` : "(no se detectaron drivers)",
            d.dsn64 ? `DSN64: exists=${d.dsn64.exists} server=${d.dsn64.server || "-"} driver=${d.dsn64.driverPath || "-"}` : "",
            d.dsn32 ? `DSN32: exists=${d.dsn32.exists} server=${d.dsn32.server || "-"} driver=${d.dsn32.driverPath || "-"}` : "",
            typeof d.managerDbExists === "boolean" ? `BD manager existe: ${d.managerDbExists ? "sí" : "no"}` : "",
            d.connPropsError ? `ConnProps error: ${d.connPropsError}` : "",
            d.persistError ? `Persist error: ${d.persistError}` : "",
            d.managerCheckError ? `Manager check error: ${d.managerCheckError?.message || d.managerCheckError}` : "",
            d.timings ? `Timings: ${JSON.stringify(d.timings)}` : "",
          ].filter(Boolean);

          if (!pre?.success) {
            alert(`ODBC falló\n\n${lines.join("\n")}`);
          } else if (pre?.skipped) {
            console.log("[LOGIN] ODBC salteado (dev-skip). debug:", d);
          }
        }

        if (!pre?.success) {
          setError(pre?.message || "No se pudo conectar con la configuración del ODBC");
          setLoading(false);
          return;
        }
      } catch (e) {
        console.error("[LOGIN] Error en bloque ODBC:", e);
        setError("No se pudo conectar al servidor");
        setLoading(false);
        return;
      }

      // ────────────────────────────────
      // PASO LOGIN contra el main/DB
      // ────────────────────────────────
      console.log("[LOGIN] llamando window.api.login...");
      const response = await window.api?.login?.({ usuario, contraseña, remember }); // ✅ remember via payload
      console.log("[LOGIN] respuesta login:", response);

      if (!response?.success) {
        setError(response?.message || "Error al iniciar sesión.");
        setLoading(false);
        return;
      }

      // Compat localStorage
      localStorage.setItem("fechaInicio", new Date().toISOString());
      localStorage.setItem("jwtToken", response.token || "");

      // Refresca el badge (lee remember:status)
      try {
        const st = await window.api?.['remember:status']?.();
        setRememberPersisted(!!st?.enabled);
      } catch {
        const enabled = await window.api?.getStoreValue?.("remember.enabled");
        setRememberPersisted(!!enabled);
      }

      console.log("[LOGIN] router.push('/Index')");
      router.push("/Index");
    } catch (err) {
      console.error("[LOGIN] catch general:", err);
      setError("Error al iniciar sesión.");
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter") handleLogin();
  };

  // 🧹 Olvidar este dispositivo (deshabilita auto-login y borra credenciales seguras)
  const handleForgetThisDevice = async () => {
    try {
      if (window.api?.['remember:disable']) {
        await window.api['remember:disable']();                 // ✅ borra keytar + flags
      } else {
        // fallback viejo
        await window.api?.setStoreValue?.({ key: "remember.enabled", value: false });
        await window.api?.setStoreValue?.({ key: "remember.user", value: "" });
        await window.api?.setStoreValue?.({ key: "remember.deviceId", value: "" });
      }
      setRemember(false);
      setRememberPersisted(false);
      alert("Listo. Este dispositivo no auto-iniciará sesión.");
    } catch (e) {
      console.warn("No se pudo desactivar 'Recordar' local:", e);
    }
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
            autoFocus
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

        {/* ✅ Recordar contraseña (auto-login) */}
        <div className={styles.inputgroup} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            id="remember"
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          <label htmlFor="remember" className={styles.label} style={{ margin: 0 }}>
            Recordar contraseña
          </label>
        </div>


        {error && <p className={styles.error}>{error}</p>}

        <button className={styles.btn} onClick={handleLogin} disabled={loading || autoTrying}>
          {autoTrying ? "Verificando..." : "Ingresar"}
        </button>

        {(loading || autoTrying) ? (
          <div className={styles.loadingWrapper}>
            <span className={styles.loadingText}>{autoTrying ? "Verificando..." : "Ingresando..."}</span>
            <div className={styles.loaderBar}></div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
