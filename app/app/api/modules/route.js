// app/api/modules/route.js
import { NextResponse } from 'next/server';
const sql = require('mssql');
const { getDbConfig } = require('../../../back/dbConfig');

export async function GET(request) {
  const url = new URL(request.url);
  const idCliente = url.searchParams.get('idCliente');

  if (!idCliente) {
    return NextResponse.json({ success: false, message: 'Falta idCliente' }, { status: 400 });
  }

  try {
    const dbConfig = getDbConfig();
    let pool = await sql.connect(dbConfig);

    let modulesResult = await pool.request()
      .input('idCliente', sql.Int, idCliente)
      .query(`
        SELECT m.Id AS ModuloId, m.Nombre AS ModuloNombre, m.Texto, m.Icono, m.Link
        FROM ModulosXCliente mx
        JOIN Modulos m ON mx.IdModulo = m.Id
        WHERE mx.IdCliente = @idCliente
      `);

    const modulos = modulesResult.recordset.map(modulo => ({
      id: modulo.ModuloId,
      nombre: modulo.ModuloNombre,
      texto: modulo.Texto,
      icono: modulo.Icono,
      link: modulo.Link
    }));

    return NextResponse.json({ success: true, modulos });

  } catch (error) {
    console.error('Error al obtener módulos:', error);
    return NextResponse.json({ success: false, message: 'Error en la base de datos.' }, { status: 500 });
  }
}
