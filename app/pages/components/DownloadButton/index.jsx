import React from "react";

/**
 * DownloadIcon – icono puro (sin fondo, sin interacción). Pensado como "emoticon".
 *
 * Variants:
 *  - 'unicode' (default): usa un carácter, p.ej. ⤓ o ↓
 *  - 'ascii': arte ASCII monoespaciado
 *  - 'svg': vector ajustable (recomendado si querés controlar proporciones)
 *
 * Props comunes:
 *  - size?: number          → Tamaño (font-size o ancho/alto). Default: 24.
 *  - color?: string         → Color (hereda por default con 'currentColor').
 *  - label?: string         → aria-label. Default: 'icono descarga'.
 *  - className?: string     → Clases extra.
 *
 * Props unicode:
 *  - char?: string          → Símbolo unicode. Default: '⤓'.
 *
 * Props ascii:
 *  - ascii?: string         → Arte ASCII custom. Default provisto.
 *
 * Props svg:
 *  - stroke?: number        → Grosor de línea. Default: 2.5.
 *  - headSpread?: number    → Ancho de la cabeza (distancia desde el centro). Default: 5.
 *  - pointDepth?: number    → Qué tanto baja la punta desde la línea de la cabeza. Default: 4.
 *  - compact?: boolean      → Acorta el vástago. Default: true.
 */
export default function DownloadIcon({
  variant = 'unicode',
  char = '⤓',
  ascii,
  size = 24,
  color = 'currentColor',
  label = 'icono descarga',
  className = '',
  // SVG-only tuning
  stroke = 2.5,
  headSpread = 5,
  pointDepth = 4,
  compact = true,
}) {
  const defaultAscii = [
    '  \
 |  /  ',
    '   v   ',
    '  ___  ',
  ].join('');

  if (variant === 'ascii') {
    return (
      <span
        role="img"
        aria-label={label}
        className={className}
        style={{
          display: 'inline-block',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          whiteSpace: 'pre',
          fontSize: size,
          lineHeight: 1,
          color,
          userSelect: 'none',
          pointerEvents: 'none',
        }}
      >
        {ascii || defaultAscii}
      </span>
    );
  }

  if (variant === 'svg') {
    const hs = Math.max(3, Math.min(6, headSpread));
    const pd = Math.max(2, Math.min(6, pointDepth));
    const shaftTop = compact ? 5 : 4;
    const shaftBottom = compact ? 11 : 12; // línea de la cabeza
    const xLeft = 12 - hs;
    const xRight = 12 + hs;
    const yHead = shaftBottom;
    const yApex = shaftBottom + pd; // punta de la flecha
    const baseY = 19;

    const d = [
      `M12 ${shaftTop} V ${shaftBottom}`,
      `M${xLeft} ${yHead} L12 ${yApex} L${xRight} ${yHead}`,
      `M5 ${baseY} H19`,
    ].join(' ');

    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        aria-label={label}
        role="img"
        className={className}
        style={{ display: 'inline-block', color, userSelect: 'none', pointerEvents: 'none' }}
      >
        <path d={d} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  // UNICODE (default)
  return (
    <span
      role="img"
      aria-label={label}
      className={className}
      tabIndex={-1}
      style={{
        display: 'inline-block',
        fontSize: size,
        lineHeight: 1,
        color,
        userSelect: 'none',
        pointerEvents: 'none',
      }}
    >
      {char}
    </span>
  );
}

/*
USO RÁPIDO:

import DownloadIcon from './DownloadIcon';

// A) SVG con flecha más ancha y menos larga
<DownloadIcon variant="svg" size={28} stroke={2.6} headSpread={5} pointDepth={4} compact />

// B) Unicode (simple)
<DownloadIcon size={28} />

// C) ASCII
<DownloadIcon variant="ascii" />
*/
