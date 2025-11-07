"use client";

import React, { useEffect, useMemo, useRef } from "react";
import styles from "./styles.module.css";

/** Devuelve { type: 'youtube'|'video', src, embedUrl?, ytTitle? } */
function classifySource(raw) {
  if (!raw) return { type: "video", src: "" };
  let url = String(raw).trim();

  // Normalizar paths locales tipo "video/cheques3.mp4" -> "/video/cheques3.mp4"
  if (!/^https?:\/\//i.test(url) && !url.startsWith("/")) {
    url = "/" + url.replace(/^\.?\//, "");
  }

  try {
    const u = new URL(url, typeof window !== "undefined" ? window.location.origin : "http://localhost");
    const host = u.hostname.replace(/^www\./, "");

    // YouTube normal
    if (host === "youtube.com" || host === "m.youtube.com") {
      const v = u.searchParams.get("v");
      if (v) {
        return {
          type: "youtube",
          src: url,
          embedUrl: `https://www.youtube.com/embed/${v}?autoplay=1&mute=1&rel=0&playsinline=1&enablejsapi=1`,
        };
      }
    }
    // YouTube corto
    if (host === "youtu.be") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      if (id) {
        return {
          type: "youtube",
          src: url,
          embedUrl: `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&rel=0&playsinline=1&enablejsapi=1`,
        };
      }
    }

    // Otros -> video HTML5 (mp4/webm/ogg, o m3u8 si el navegador lo soporta)
    return { type: "video", src: url };
  } catch {
    // Si no pudo parsear, tratamos como ruta local
    return { type: "video", src: url };
  }
}

function guessMime(src) {
  const s = src.toLowerCase();
  if (s.endsWith(".mp4")) return "video/mp4";
  if (s.endsWith(".webm")) return "video/webm";
  if (s.endsWith(".ogg") || s.endsWith(".ogv")) return "video/ogg";
  if (s.includes(".m3u8")) return "application/x-mpegURL"; // HLS
  return "video/mp4";
}

export default function Video({ open = false, title = "Demostración", src = "", onClose = () => {} }) {
  const cls = useMemo(() => classifySource(src), [src]);
  const videoRef = useRef(null);

  // Cerrar con ESC
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onDown);
    return () => document.removeEventListener("keydown", onDown);
  }, [open, onClose]);

  // Autoplay para HTML5 <video> (muted + playsInline para sortear políticas)
  useEffect(() => {
    if (!open || cls.type !== "video") return;

    const v = videoRef.current;
    if (!v) return;

    // Si es HLS (.m3u8) y no lo soporta nativamente, probamos hls.js si está disponible
    const needsHls = /m3u8/i.test(cls.src);
    const canNativeHls = v.canPlayType("application/vnd.apple.mpegURL") || v.canPlayType("application/x-mpegURL");

    let hlsInstance = null;

    (async () => {
      try {
        if (needsHls && !canNativeHls) {
          // Carga opcional (sólo si el paquete existe). No falla si no está instalado.
          let Hls;
          try {
            Hls = (await import("hls.js")).default;
          } catch {
            Hls = null;
          }
          if (Hls && Hls.isSupported()) {
            hlsInstance = new Hls({ enableWorker: true });
            hlsInstance.loadSource(cls.src);
            hlsInstance.attachMedia(v);
          } else {
            // El navegador intentará reproducirlo igual; si no puede, quedará en pausa con controles.
            v.src = cls.src;
          }
        } else {
          v.src = cls.src;
        }

        v.muted = true;
        v.playsInline = true;
        v.autoplay = true;
        await v.play().catch(() => {});
      } catch {}
    })();

    return () => {
      try {
        if (hlsInstance) {
          hlsInstance.destroy();
          hlsInstance = null;
        }
      } catch {}
    };
  }, [open, cls]);

  if (!open) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h4 className={styles.modalTitle}>{title}</h4>
          <button className={styles.modalClose} aria-label="Cerrar" onClick={onClose}>✕</button>
        </div>

        {/* Player */}
        {cls.type === "youtube" ? (
          <iframe
            className={styles.modalFrame}
            src={cls.embedUrl}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
<video
  ref={videoRef}
  className={styles.modalVideo}
  controls
  muted
  playsInline
  autoPlay
  preload="auto"
  onError={(e) => {
    const err = e?.currentTarget?.error;
    console.warn("Video error:", cls.src, err);
  }}
>
  <source src={cls.src} type={guessMime(cls.src)} />
  {/\.m3u8/i.test(cls.src) && <source src={cls.src} type="application/vnd.apple.mpegURL" />}
</video>
        )}
      </div>
    </div>
  );
}
