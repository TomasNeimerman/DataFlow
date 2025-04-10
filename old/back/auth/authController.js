const sql = require('mssql');
const { generarToken } = require('./jwtService');
const { getDbConfig } = require('../../dbConfig');

async function login(usuario, contraseña) {
    try {
        const dbConfig = getDbConfig();
        let pool = await sql.connect(dbConfig);

        let result = await pool.request()
            .input('usuario', sql.NVarChar, usuario)
            .input('contraseña', sql.NVarChar, contraseña)
            .query('SELECT * FROM Usuarios WHERE Usuario = @usuario AND Contraseña = @contraseña');

        if (result.recordset.length > 0) {
            const user = result.recordset[0];

            // Actualizar FechaUltAcceso restando 6 horas
            let fechaActual = new Date();
            fechaActual.setHours(fechaActual.getHours() - 3);

            await pool.request()
                .input('fecha', sql.DateTime, fechaActual)
                .input('usuario', sql.NVarChar, usuario)
                .query('UPDATE Usuarios SET FechaUltAcceso = @fecha WHERE Usuario = @usuario');

            // Generar token JWT
            const token = generarToken(user);
            return { success: true, user, token };
        } else {
            return { success: false, message: 'Usuario o contraseña incorrectos.' };
        }
    } catch (error) {
        console.error('Error en la autenticación:', error);
        return { success: false, message: 'Error en la base de datos.' };
    }
}

module.exports = { login };
