// back/modulesService/Login.js
const sql = require('mssql');
const fs = require('fs').promises; // Usamos la API de promesas para async/await
const path = require('path');
const { generarToken } = require('../jwtService');
const logger = require('../logger');

// Función para obtener la configuración de la base de datos de la empresa
async function obtenerConfiguracionEmpresa(idCliente) {
    try {
        const dbConfigAdmin = require('../dbConfig').getDbConfig();
        const poolAdmin = await sql.connect(dbConfigAdmin);

        const empresaResult = await poolAdmin.request()
            .input('idCliente', sql.Int, idCliente)
            .query(`
                SELECT Server, Port, InstanciaBD , Usuario, Contraseña
                FROM Empresa
                WHERE IdCliente = @idCliente
            `);

        

        if (empresaResult.recordset.length > 0) {
            const empresaData = empresaResult.recordset[0];
            const configContent = `DB_USER=${empresaData.Usuario}\nDB_PASSWORD=${empresaData.Contraseña}\nDB_SERVER=${empresaData.Server}\nDB_PORT=${empresaData.Port || 1433}\nDB_DATABASE=${empresaData.InstanciaBD}\n`;
            const configPath = path.join(__dirname, '../../fileConfigUpdater/userDbConfig.properties'); // Nombre de archivo diferente para evitar confusión

            try {
                await fs.writeFile(configPath, configContent, 'utf-8');
                console.log(`Archivo de configuración creado para el cliente ${idCliente} en: ${configPath}`);
            } catch (err) {
                console.error('Error al escribir el archivo de configuración:', err);
            }

            return {
                server: empresaData.Server,
                port: empresaData.Port ? parseInt(empresaData.Port, 10) : 1433,
                database: empresaData.Database,
                user: empresaData.Usuario,
                password: empresaData.Contraseña,
                options: {
                    encrypt: false,
                    trustServerCertificate: true
                }
            };
        } else {
            return null;
        }
    } catch (error) {
        console.error('Error al obtener configuración de la empresa:', error);
        return null;
    }
}

async function iniciarSesion({ usuario, contraseña }) {
    try {
        const dbConfigAdmin = require('../dbConfig').getDbConfig();
        const poolAdmin = await sql.connect(dbConfigAdmin);

        const loginResult = await poolAdmin.request()
            .input('usuario', sql.NVarChar, usuario)
            .input('contraseña', sql.NVarChar, contraseña)
            .query(`
                SELECT Id, Nombre, Apellido, Email, IdCliente
                FROM Usuarios
                WHERE Usuario = @usuario AND Contraseña = @contraseña
            `);

        if (loginResult.recordset.length === 0) {
            await poolAdmin.close();
            return { success: false, message: 'Usuario o contraseña incorrectos.' };
        }

        const user = loginResult.recordset[0];
        const idCliente = user.IdCliente;

        const empresaConfig = await obtenerConfiguracionEmpresa(idCliente);
        if (!empresaConfig) {
            await poolAdmin.close();
            return { success: false, message: 'No se encontró la configuración de la base de datos para su empresa.' };
        }

        let fechaActual = new Date();
        fechaActual.setHours(fechaActual.getHours() - 3);

        await poolAdmin.request()
            .input('fecha', sql.DateTime, fechaActual)
            .input('usuario', sql.NVarChar, usuario)
            .query('UPDATE Usuarios SET FechaUltAcceso = @fecha WHERE Usuario = @usuario');

        const token = generarToken(user);

        await poolAdmin.close();

        return { success: true, user, token, empresaConfig };
    } catch (error) {
        console.error('Error en iniciarSesion:', error);
        return { success: false, message: error.message };
    }
}

async function obtenerModulos(idCliente) {
    if (!idCliente) return { success: false, message: 'Falta idCliente' };
    const dbConfigAdmin = require('../dbConfig').getDbConfig();
    if (!dbConfigAdmin) return { success: false, message: 'No se pudo obtener la configuración de la base de datos.' };    

    try {
        const poolEmpresa = await sql.connect(dbConfigAdmin);

        let result = await poolEmpresa.request()
            .input('idCliente', sql.Int, idCliente)
            .query(`
                SELECT
                    m.Id AS ModuloId,
                    m.Nombre AS ModuloNombre,
                    m.Texto,
                    m.Icono,
                    m.Link,
                    m.PathExcelModelo,
                    (
                        SELECT COUNT(*)
                        FROM ModulosXCliente mx2
                        WHERE mx2.IdModulo = m.Id
                    ) AS countClientesPorModulo
                FROM ModulosXCliente mx
                JOIN Modulos m ON mx.IdModulo = m.Id
                WHERE mx.IdCliente = @idCliente
            `);
        const modulos = result.recordset.map(modulo => ({
            id: modulo.ModuloId,
            nombre: modulo.ModuloNombre,
            texto: modulo.Texto,
            icono: modulo.Icono,
            link: modulo.Link,
            pathExcel: modulo.PathExcelModelo,
            countClientesPorModulo: modulo.countClientesPorModulo
        }));
        await poolEmpresa.close();
        return { success: true, modulos };

    } catch (error) {
        console.error('Error en obtenerModulos:', error);
        return { success: false, message: 'Error en la base de datos de la empresa.' };
    }
}

module.exports = { iniciarSesion, obtenerModulos };