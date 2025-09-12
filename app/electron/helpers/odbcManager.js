// helpers/odbcManager.js
// Requiere: npm i odbc
const odbc = require('odbc');

const DSN      = 'SQL Server 2';
const DATABASE = 'manager';
const TABLE    = 'emp';

// Armado de connection string.
// Si el DSN ya tiene auth, esto alcanza. Si necesitás user/pass, podés setear
// ODBC_UID y ODBC_PWD como variables de entorno.
function buildConnStr() {
  const parts = [`DSN=${DSN}`, `DATABASE=${DATABASE}`];
  if (process.env.ODBC_UID) parts.push(`UID=${process.env.ODBC_UID}`);
  if (process.env.ODBC_PWD) parts.push(`PWD=${process.env.ODBC_PWD}`);
  // Trusted_Connection no hace daño si el DSN ya lo define
  parts.push('Trusted_Connection=Yes');
  return parts.join(';');
}

async function connectManagerODBC() {
  const connStr = buildConnStr();
  return odbc.connect(connStr);
}

// Mapeo tolerante de columnas comunes de la tabla EMP
// Intentamos descubrir: código, nombre y base de datos
function mapEmpRow(row) {
  const keys = Object.keys(row || {}).reduce((acc, k) => {
    acc[k.toLowerCase()] = k;
    return acc;
  }, {});

  const pick = (candidates, def = null) => {
    for (const c of candidates) {
      const realKey = keys[c.toLowerCase()];
      if (realKey && row[realKey] != null) return String(row[realKey]).trim();
    }
    return def;
  };

  // posibles nombres de columnas (cubrimos variantes típicas)
  const code   = pick(['cod', 'codigo', 'cod_emp', 'emp_cod', 'id', 'idemp']);
  const name   = pick(['nombre', 'name', 'razon', 'razon_social', 'emp_nom', 'empresa']);
  const dbname = pick([
    'base', 'bd', 'dbname', 'database', 'db', 'emp_bd', 'emp_base', 'basedatos'
  ]);

  return {
    code: code || name || dbname || null,
    name: name || code || null,
    dbName: dbname || null,
    raw: row
  };
}

function normalizeDbName(v) {
  return String(v ?? '')
    .replace(/\[|\]/g, '')
    .trim()
    .toLowerCase();
}

/**
 * Lee todos los registros de manager.dbo.emp
 */
async function getLocalEmpresasODBC() {
  let connection;
  try {
    connection = await connectManagerODBC();
    // Forzamos el contexto por las dudas
    await connection.query(`USE ${DATABASE}`);
    const result = await connection.query(`SELECT * FROM ${TABLE}`);
    const rows = Array.isArray(result) ? result : result?.rows || [];
    const mapped = rows.map(mapEmpRow);
    return { success: true, rows: mapped, count: mapped.length };
  } catch (err) {
    return { success: false, message: err.message };
  } finally {
    try { await connection?.close(); } catch {}
  }
}

/**
 * Compara las empresas locales (ODBC manager.emp) con las de la nube (modulesService/Empresa)
 * fetchCloud: fn(idCliente) -> { success, data: [...] }
 * Opcionalmente podés pasar idCliente, de lo contrario se compara sin él.
 */
async function compareEmpresasAgainstCloud(fetchCloud, idCliente) {
  const local = await getLocalEmpresasODBC();
  if (!local.success) {
    return { success: false, stage: 'local', message: local.message };
  }

  let cloud;
  try {
    cloud = await fetchCloud(idCliente);
  } catch (e) {
    return { success: false, stage: 'cloud', message: e.message };
  }

  const cloudList = (cloud?.data || cloud?.empresas || cloud?.rows || [])
    .map((e) => {
      // Intentamos leer dbName y nombre en la respuesta del service
      // Campos comunes esperados: BaseDatos, Base, DBName, Database, Nombre, Descripcion
      const low = Object.keys(e || {}).reduce((acc, k) => {
        acc[k.toLowerCase()] = k; return acc;
      }, {});
      const pick = (cands) => {
        for (const c of cands) if (low[c.toLowerCase()]) return String(e[low[c.toLowerCase()]]).trim();
        return null;
      };
      return {
        dbName: pick(['BaseDatos','Base','DBName','Database','bd','dbname','db']),
        name:   pick(['Nombre','Razon','Descripcion','Desc','Empresa','name'])
      };
    });

  const localDbSet = new Map();
  for (const r of local.rows) {
    const key = normalizeDbName(r.dbName);
    if (key) localDbSet.set(key, r);
  }

  const cloudDbSet = new Map();
  for (const r of cloudList) {
    const key = normalizeDbName(r.dbName);
    if (key) cloudDbSet.set(key, r);
  }

  const inCloudNotLocal = [];
  const inLocalNotCloud = [];
  const matched = [];

  // En nube pero no en local
  for (const [dbKey, c] of cloudDbSet.entries()) {
    if (!localDbSet.has(dbKey)) {
      inCloudNotLocal.push(c);
    } else {
      matched.push({ cloud: c, local: localDbSet.get(dbKey) });
    }
  }
  // En local pero no en nube
  for (const [dbKey, l] of localDbSet.entries()) {
    if (!cloudDbSet.has(dbKey)) {
      inLocalNotCloud.push(l);
    }
  }

  return {
    success: true,
    totals: {
      local: local.rows.length,
      cloud: cloudList.length,
      matched: matched.length,
      inCloudNotLocal: inCloudNotLocal.length,
      inLocalNotCloud: inLocalNotCloud.length
    },
    matched,
    inCloudNotLocal,
    inLocalNotCloud,
    raw: {
      local: local.rows,
      cloud: cloudList
    }
  };
}

module.exports = {
  getLocalEmpresasODBC,
  compareEmpresasAgainstCloud,
};
