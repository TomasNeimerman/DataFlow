// back/modulesService/Articulos.js
const sql = require('mssql');
const { getAdminDbConfig } = require('../userDbConfig.js');

async function getArticulos() {
  let pool;
  try {
    const dbConfig = getAdminDbConfig();
    console.log('Conectando a la base de datos con la configuración:', dbConfig);
    pool = await sql.connect(dbConfig);
    const result = await pool.request()
      .query(`SELECT art_CodGen, art_DescGen FROM Articulos`);
    console.log('Artículos obtenidos:', result.recordset);
    return {
      success: true,
      articulos: result.recordset || [],
    };
  }
  catch (err) {
      console.error('❌ Error obteniendo Artículos:', err);
      return { success: false, message: err.message };
    }finally {
    if (pool) await pool.close();
}
async function getClases() {
   let pool;
    try {
      const dbConfig = getAdminDbConfig();
      console.log('Conectando a la base de datos con la configuración:', dbConfig);
      pool = await sql.connect(dbConfig);
      const result = await pool.request()
        .query(`SELECT cla_Cod, cla_Desc FROM ClasArt`);
      console.log('Clases obtenidas:', result.recordset);
      return {
        success: true,
        clases: result.recordset || [],
      };
    } catch (err) {
      console.error('❌ Error obteniendo Clases:', err);
      return { success: false, message: err.message };
    } finally {
      if (pool) await pool.close();
    }
}
async function getProveedores() {
  let pool;
  try {
    const dbConfig = getAdminDbConfig();
    console.log('Conectando a la base de datos con la configuración:', dbConfig);
    pool = await sql.connect(dbConfig);
    const result = await pool.request()
      .query(`SELECT pro_Cod, pro_RazSoc FROM Proveed`);
    console.log('Proveedores obtenidos:', result.recordset);
    return {
      success: true,
      proveedores: result.recordset || [],
    };
  } catch (err) {
    console.error('❌ Error obteniendo Proveedores:', err);
    return { success: false, message: err.message };
  } finally {
    if (pool) await pool.close();
  }
}

module.exports = { getClases, getProveedores };