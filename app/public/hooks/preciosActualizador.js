// app/hooks/preciosActualizador.js
import { useState } from 'react';

const normalize = (s) =>
  (s ?? '')
    .toString()
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const EXPECTED = [
  'Lista de Precios - Cód.',
  'Lista de Precios',
  'Artículo - Cód. Genérico',
  'Artículo - Cód. Elemento 1',
  'Artículo - Cód. Elemento 2',
  'Artículo - Cód. Elemento 3',
  'Artículo - Desc.Genérica',
  'Artículo - Elemento 1',
  'Artículo - Elemento 2',
  'Artículo - Elemento 3',
  'Precio',
];

const wantedMap = {
  lprdlp_Cod: 'Lista de Precios - Cód.',
  lprart_CodGen: 'Artículo - Cód. Genérico',
  lprart_CodEle1: 'Artículo - Cód. Elemento 1',
  lprart_CodEle2: 'Artículo - Cód. Elemento 2',
  lprart_CodEle3: 'Artículo - Cód. Elemento 3',
  precio: 'Precio',
};

function buildIndexMap(headers) {
  const normHeaders = headers.map(normalize);
  const map = {};
  for (const [key, label] of Object.entries(wantedMap)) {
    map[key] = normHeaders.indexOf(normalize(label));
  }
  const missingKeys = Object.entries(map)
    .filter(([, idx]) => idx < 0)
    .map(([k]) => `${k} (${wantedMap[k]})`);
  return { map, missingKeys };
}

function parsePrecioCell(value) {
  if (value === null || value === undefined || value === '') return null;
  let str = String(value).trim();
  // limpiar símbolos de moneda y espacios
  str = str.replace(/[^\d.,\-]/g, '');
  // si hay . y , => . miles, , decimal
  if (str.includes('.') && str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes(',')) {
    str = str.replace(',', '.');
  }
  const num = Number(str);
  return Number.isFinite(num) ? num : null;
}

export default function usePreciosActualizador() {
  const [importStatus, setImportStatus] = useState('');
  const [importMessage, setImportMessage] = useState('');

  const validateExcelColumns = (headers) => {
    const { missingKeys } = buildIndexMap(headers);
    if (missingKeys.length) {
      setImportStatus('hubo un error en la importacion');
      setImportMessage(
        `Faltan columnas: ${missingKeys.join(', ')}`
      );
      return false;
    }
    return true;
  };

  const processPriceUpdates = async (rows, obtenerPrecioApiFn, updatePrecioApiFn) => {
    setImportStatus('');
    setImportMessage('');

    if (!rows?.length) {
      setImportStatus('hubo un error en la importacion');
      setImportMessage('No hay filas para procesar.');
      return { preciosProcesados: [], huboCambios: false };
    }

    const headers = rows[0];
    const body = rows.slice(1).filter((r) => r && r.length > 0);

    const { map: idx } = buildIndexMap(headers);

    const preciosProcesados = [];
    let huboCambios = false;
    let countActualizados = 0;
    let countSinCambios = 0;
    let countNoEncontrados = 0;
    let countPrecioInvalido = 0;

    for (const r of body) {
      const obj = {
        lprdlp_Cod: r[idx.lprdlp_Cod] ?? '',
        lprart_CodGen: r[idx.lprart_CodGen] ?? '',
        lprart_CodEle1: r[idx.lprart_CodEle1] ?? '',
        lprart_CodEle2: r[idx.lprart_CodEle2] ?? '',
        lprart_CodEle3: r[idx.lprart_CodEle3] ?? '',
        precio: parsePrecioCell(r[idx.precio]),
      };

      if (obj.precio === null) {
        countPrecioInvalido++;
        preciosProcesados.push({ precio: obj, actualizado: false, motivo: 'precio inválido' });
        continue;
      }

      const lookup = await obtenerPrecioApiFn({
        lprdlp_Cod: obj.lprdlp_Cod,
        lprart_CodGen: obj.lprart_CodGen,
        lprart_CodEle1: obj.lprart_CodEle1,
        lprart_CodEle2: obj.lprart_CodEle2,
        lprart_CodEle3: obj.lprart_CodEle3,
      });

      const current = lookup?.precio || null;

      // si no se encontró la fila, intentamos igual actualizar y contamos como no encontrado si falla
      if (!current) {
        const upd = await updatePrecioApiFn({
          lprdlp_Cod: obj.lprdlp_Cod,
          lprart_CodGen: obj.lprart_CodGen,
          lprart_CodEle1: obj.lprart_CodEle1,
          lprart_CodEle2: obj.lprart_CodEle2,
          lprart_CodEle3: obj.lprart_CodEle3,
          precio: obj.precio, // 👈👈 MANDAMOS PRECIO
        });
        if (upd?.success) {
          huboCambios = true;
          countActualizados++;
          preciosProcesados.push({ precio: obj, actualizado: true });
        } else {
          countNoEncontrados++;
          preciosProcesados.push({ precio: obj, actualizado: false, motivo: 'no encontrado' });
        }
        continue;
      }

      const precioActual = Number(current.lpr_Precio ?? current.lpr_precio ?? current.precio ?? NaN);
      if (Number.isFinite(precioActual) && Math.abs(precioActual - obj.precio) < 1e-9) {
        countSinCambios++;
        preciosProcesados.push({ precio: obj, actualizado: false });
        continue;
      }

      const upd = await updatePrecioApiFn({
        lprdlp_Cod: obj.lprdlp_Cod,
        lprart_CodGen: obj.lprart_CodGen,
        lprart_CodEle1: obj.lprart_CodEle1,
        lprart_CodEle2: obj.lprart_CodEle2,
        lprart_CodEle3: obj.lprart_CodEle3,
        precio: obj.precio, // 👈👈 MANDAMOS PRECIO
      });

      if (upd?.success) {
        huboCambios = true;
        countActualizados++;
        preciosProcesados.push({ precio: obj, actualizado: true });
      } else {
        countNoEncontrados++;
        preciosProcesados.push({ precio: obj, actualizado: false, motivo: 'update falló' });
      }
    }

    let msg = '';
    if (huboCambios) {
      msg = `Importado correctamente. ${countActualizados} precio(s) actualizado(s).`;
      if (countSinCambios) msg += ` ${countSinCambios} sin cambios.`;
      if (countNoEncontrados) msg += ` ${countNoEncontrados} no encontrado(s).`;
      if (countPrecioInvalido) msg += ` ${countPrecioInvalido} con precio inválido.`;
      setImportStatus('Importado correctamente');
    } else {
      msg = `Importación completada. Sin cambios.`;
      if (countNoEncontrados) msg += ` ${countNoEncontrados} no encontrado(s).`;
      if (countPrecioInvalido) msg += ` ${countPrecioInvalido} con precio inválido.`;
      setImportStatus('Importación sin cambios');
    }
    setImportMessage(msg);

    return { preciosProcesados, huboCambios };
  };

  return { importStatus, importMessage, validateExcelColumns, processPriceUpdates };
}
