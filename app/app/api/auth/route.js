// app/api/auth/login.js
import { NextResponse } from 'next/server';
const sql = require('mssql');
const { generarToken } = require('../../../back/jwtService');
const { getDbConfig } = require('../../../back/dbConfig');

export async function POST(request) {
  try {
    const { usuario, contraseña } = await request.json();

    const dbConfig = getDbConfig();
    let pool = await sql.connect(dbConfig);

    let result = await pool.request()
      .input('usuario', sql.NVarChar, usuario)
      .input('contraseña', sql.NVarChar, contraseña)
      .query(`
        SELECT Id, Nombre, Apellido, Email, IdCliente
        FROM Usuarios
        WHERE Usuario = @usuario AND Contraseña = @contraseña
      `);

    if (result.recordset.length > 0) {
      const user = result.recordset[0];

      // 🔹 Actualizar FechaUltAcceso
      let fechaActual = new Date();
      fechaActual.setHours(fechaActual.getHours() - 3);

      await pool.request()
        .input('fecha', sql.DateTime, fechaActual)
        .input('usuario', sql.NVarChar, usuario)
        .query('UPDATE Usuarios SET FechaUltAcceso = @fecha WHERE Usuario = @usuario');

      // 🔹 Generar token y devolver IdCliente
      const token = generarToken(user);
      return NextResponse.json({ success: true, user: { 
        id: user.Id, 
        nombre: user.Nombre, 
        apellido: user.Apellido, 
        email: user.Email, 
        idCliente: user.IdCliente 
      }, token });
    } else {
      return NextResponse.json({ success: false, message: 'Usuario o contraseña incorrectos.' }, { status: 401 });
    }
  } catch (error) {
    console.error('Error en la autenticación:', error);
    return NextResponse.json({ success: false, message: 'Error en la base de datos.' }, { status: 500 });
  }
}
