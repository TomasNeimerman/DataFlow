// back/modulesService/Articulos.js
const sql = require('mssql');
const { getAdminDbConfig } = require('../../userDbConfig.js');

// --- Funciones para obtener listas de datos (ej. para poblar dropdowns en el frontend) ---

/**
 * Obtiene una lista de artículos (código y descripción general).
 * @returns {Promise<{success: boolean, articulos?: Array, message?: string, error?: Error}>}
 */
async function getArticulos() {
    let pool;
    try {
        const dbConfig = getAdminDbConfig();
        console.log('[Articulos.js] Conectando para obtener lista de Artículos...');
        pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .query(`SELECT DISTINCT art_CodGen, art_DescGen FROM Articulos`);
        console.log(`[Articulos.js] ${result.recordset.length} Artículos obtenidos.`);
        return {
            success: true,
            articulos: result.recordset || [],
        };
    } catch (err) {
        console.error('❌ Error obteniendo Artículos:', err);
        return { success: false, message: err.message, error: err };
    } finally {
        if (pool) await pool.close();
    }
}

/**
 * Obtiene una lista de clases (código y descripción).
 * @returns {Promise<{success: boolean, clases?: Array, message?: string, error?: Error}>}
 */
async function getClases() {
    let pool;
    try {
        const dbConfig = getAdminDbConfig();
        console.log('[Articulos.js] Conectando para obtener lista de Clases...');
        pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .query(`SELECT cla_Cod, cla_Desc FROM ClasArt`);
        console.log(`[Articulos.js] ${result.recordset.length} Clases obtenidas.`);
        return {
            success: true,
            clases: result.recordset || [],
        };
    } catch (err) {
        console.error('❌ Error obteniendo Clases:', err);
        return { success: false, message: err.message, error: err };
    } finally {
        if (pool) await pool.close();
    }
}

/**
 * Obtiene una lista de proveedores (código y razón social).
 * @returns {Promise<{success: boolean, proveedores?: Array, message?: string, error?: Error}>}
 */
async function getProveedores() {
    let pool;
    try {
        const dbConfig = getAdminDbConfig();
        console.log('[Articulos.js] Conectando para obtener lista de Proveedores...');
        pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .query(`SELECT pro_Cod, pro_RazSoc FROM Proveed`);
        console.log(`[Articulos.js] ${result.recordset.length} Proveedores obtenidos.`);
        return {
            success: true,
            proveedores: result.recordset || [],
        };
    } catch (err) {
        console.error('❌ Error obteniendo Proveedores:', err);
        return { success: false, message: err.message, error: err };
    } finally {
        if (pool) await pool.close();
    }
}

/**
 * Obtiene una lista de rubros (código y descripción).
 * Se asume la tabla 'Rubros' con columnas 'rub_Cod' y 'rub_Desc'.
 * @returns {Promise<{success: boolean, rubros?: Array, message?: string, error?: Error}>}
 */
async function getRubros() { // ¡Esta es la función que faltaba!
    let pool;
    try {
        const dbConfig = getAdminDbConfig();
        console.log('[Articulos.js] Conectando para obtener lista de Rubros...');
        pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .query(`SELECT rub_Cod, rub_Desc FROM Rubro`); // Asume la tabla 'Rubros' y las columnas 'rub_Cod', 'rub_Desc'
        console.log(`[Articulos.js] ${result.recordset.length} Rubros obtenidos.`);
        return {
            success: true,
            rubros: result.recordset || [],
        };
    } catch (err) {
        console.error('❌ Error obteniendo Rubros:', err);
        return { success: false, message: err.message, error: err };
    } finally {
        if (pool) await pool.close();
    }
}

/**
 * Obtiene una lista de tasas de IVA de la tabla TIvaAFIP.
 * Se asumen las columnas 'tia_Cod', 'tia_Tasa' y 'tia_Tipo'.
 * @returns {Promise<{success: boolean, tasasIVA?: Array, message?: string, error?: Error}>}
 */
async function getTasasIVA() {
    let pool;
    try {
        const dbConfig = getAdminDbConfig();
        console.log('[Articulos.js] Conectando para obtener lista de Tasas IVA...');
        pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .query(`SELECT tia_Cod, tia_Tasa FROM TIvaAFIP`); // CONFIRMA 'tia_Tipo'
        console.log(`[Articulos.js] ${result.recordset.length} Tasas IVA obtenidas.`);
        return {
            success: true,
            tasasIVA: result.recordset || [],
        };
    } catch (err) {
        console.error('❌ Error obteniendo Tasas IVA:', err);
        return { success: false, message: err.message, error: err };
    } finally {
        if (pool) await pool.close();
    }
}

// --- Funciones específicas para validaciones (devuelven datos específicos o banderas de existencia) ---

/**
 * 1. Valida si un artículo existe y obtiene sus detalles (descripción y control de stock).
 * @param {string} codGenArticulo - Código general del artículo.
 * @returns {Promise<{success: boolean, articulo?: object, message?: string, error?: Error}>}
 */
async function getArticuloDetailsById(codGenArticulo) {
    let pool;
    try {
        const dbConfig = getAdminDbConfig();
        console.log(`[Articulos.js] Conectando para buscar detalles de artículo: ${codGenArticulo}`);
        pool = await sql.connect(dbConfig);
        const request = pool.request();
        request.input('CodGenArticulo', sql.NVarChar, codGenArticulo);

        const result = await request.query(`
            SELECT
                art_CodGen,
                art_DescGen,
                art_ControlaStock
            FROM Articulos
            WHERE art_CodGen = @CodGenArticulo;
        `);
        const articulo = result.recordset[0];
        console.log(`[Articulos.js] Artículo encontrado para detalles: ${articulo ? 'Sí' : 'No'}`);
        return {
            success: true,
            articulo: articulo || null
        };
    } catch (err) {
        console.error('❌ Error obteniendo detalles de Artículo:', err);
        return { success: false, message: err.message, error: err };
    } finally {
        if (pool) await pool.close();
    }
}

/**
 * 2. Valida si una clase existe en la tabla ClasArt.
 * @param {string} codigoClase - Código de la clase.
 * @returns {Promise<{success: boolean, existe?: boolean, message?: string, error?: Error}>}
 */
async function claseExiste(codigoClase) {
    let pool;
    try {
        const dbConfig = getAdminDbConfig();
        console.log(`[Articulos.js] Conectando para verificar existencia de clase: ${codigoClase}`);
        pool = await sql.connect(dbConfig);
        const request = pool.request();
        request.input('CodigoClase', sql.NVarChar, codigoClase);

        const result = await request.query(`
            SELECT COUNT(1) AS count
            FROM ClasArt
            WHERE cla_Cod = @CodigoClase;
        `);
        const existe = result.recordset[0].count > 0;
        console.log(`[Articulos.js] Clase con código ${codigoClase} existe: ${existe}`);
        return {
            success: true,
            existe: existe
        };
    } catch (err) {
        console.error('❌ Error verificando Clase:', err);
        return { success: false, message: err.message, error: err };
    } finally {
        if (pool) await pool.close();
    }
}

/**
 * 4. Valida si un rubro existe en la tabla Rubros.
 * @param {string} codigoRubro - Código del rubro.
 * @returns {Promise<{success: boolean, existe?: boolean, message?: string, error?: Error}>}
 */
async function rubroExiste(codigoRubro) {
    let pool;
    try {
        const dbConfig = getAdminDbConfig();
        console.log(`[Articulos.js] Conectando para verificar existencia de rubro: ${codigoRubro}`);
        pool = await sql.connect(dbConfig);
        const request = pool.request();
        request.input('CodigoRubro', sql.NVarChar, codigoRubro);

        const result = await request.query(`
            SELECT COUNT(1) AS count
            FROM Rubros
            WHERE rub_Cod = @CodigoRubro;
        `);
        const existe = result.recordset[0].count > 0;
        console.log(`[Articulos.js] Rubro con código ${codigoRubro} existe: ${existe}`);
        return {
            success: true,
            existe: existe
        };
    } catch (err) {
        console.error('❌ Error verificando Rubro:', err);
        return { success: false, message: err.message, error: err };
    } finally {
        if (pool) await pool.close();
    }
}

/**
 * 5. Valida si un proveedor existe o, si no se especifica, obtiene el "top 1".
 * @param {string|null} [codigoProveedor=null] - Código del proveedor o null para obtener el "top 1".
 * @returns {Promise<{success: boolean, proveedor?: object, message?: string, error?: Error}>}
 */
async function getProveedorDetails(codigoProveedor = null) {
    let pool;
    try {
        const dbConfig = getAdminDbConfig();
        console.log(`[Articulos.js] Conectando para buscar proveedor: ${codigoProveedor || 'TOP 1'}`);
        pool = await sql.connect(dbConfig);
        const request = pool.request();
        let query;

        if (codigoProveedor) {
            request.input('CodigoProveedor', sql.NVarChar, codigoProveedor);
            query = `
                SELECT pro_Cod, pro_RazSoc
                FROM Proveed
                WHERE pro_Cod = @CodigoProveedor;
            `;
        } else {
            query = `
                SELECT TOP 1 pro_Cod, pro_RazSoc
                FROM Proveed
                ORDER BY pro_Cod ASC;
            `;
        }

        const result = await request.query(query);
        const proveedor = result.recordset[0];
        console.log(`[Articulos.js] Proveedor encontrado: ${proveedor ? 'Sí' : 'No'}`);
        return {
            success: true,
            proveedor: proveedor || null
        };
    } catch (err) {
        console.error('❌ Error obteniendo Proveedor:', err);
        return { success: false, message: err.message, error: err };
    } finally {
        if (pool) await pool.close();
    }
}

/**
 * 6. Obtiene los detalles de una tasa de IVA específica de la tabla TIvaAFIP.
 * @param {string} codigoTasaIVA - Código de la tasa de IVA.
 * @returns {Promise<{success: boolean, tasaIVA?: object, message?: string, error?: Error}>}
 */
async function getTasaIVADetails(codigoTasaIVA) {
    let pool;
    try {
        const dbConfig = getAdminDbConfig();
        console.log(`[Articulos.js] Conectando para buscar tasa IVA: ${codigoTasaIVA}`);
        pool = await sql.connect(dbConfig);
        const request = pool.request();
        request.input('CodigoTasaIVA', sql.NVarChar, codigoTasaIVA);

        const result = await request.query(`
            SELECT
                tia_Cod,
                tia_Tasa,
            FROM TIvaAFIP

        `);
        const tasaIVA = result.recordset[0];
        console.log(`[Articulos.js] Tasa IVA encontrada: ${tasaIVA ? 'Sí' : 'No'}`);
        return {
            success: true,
            tasaIVA: tasaIVA || null
        };
    } catch (err) {
        console.error('❌ Error obteniendo Tasa IVA:', err);
        return { success: false, message: err.message, error: err };
    } finally {
        if (pool) await pool.close();
    }
}

// --- Exportar todas las funciones relevantes ---
module.exports = {
    getArticulos,
    getClases,
    getProveedores,
    getRubros, // ¡Ahora correctamente exportada!
    getTasasIVA,
    getArticuloDetailsById,
    claseExiste,
    rubroExiste,
    getProveedorDetails,
    getTasaIVADetails,
};