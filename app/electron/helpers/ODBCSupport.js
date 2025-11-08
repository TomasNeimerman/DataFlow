const { execFile } = require('child_process');

function queryReg(path, arch = '64') {
  return new Promise((resolve) => {
    // /reg:64 usa vista 64-bit; /reg:32 usa WOW6432Node
    const args = ['QUERY', path, '/s', arch === '32' ? '/reg:32' : '/reg:64'];
    execFile('reg', args, { windowsHide: true }, (err, stdout) => {
      if (err || !stdout) return resolve(null);
      resolve(stdout.toString());
    });
  });
}

// Lee Server/Database del DSN "SQL SERVER" en 64 y 32 bits
async function readDsnConfigBothArches() {
  const keyBase64 = 'HKLM\\SOFTWARE\\ODBC\\ODBC.INI\\SQL SERVER';
  const keyBase32 = 'HKLM\\SOFTWARE\\WOW6432Node\\ODBC\\ODBC.INI\\SQL SERVER';

  const out64 = await queryReg(keyBase64, '64');
  const out32 = await queryReg(keyBase32, '32');

  const parse = (txt) => {
    if (!txt) return null;
    const get = (k) => {
      const m = txt.match(new RegExp(`\\s${k}\\s+REG_[A-Z_]+\\s+(.+)`));
      return m ? m[1].trim() : null;
    };
    return { server: get('Server'), database: get('Database') };
  };

  return {
    x64: parse(out64),
    x32: parse(out32),
  };
}

// Elige Driver instalado (17 o 18) para DSN-less
function pickSqlOdbcDriver(odbc) {
  try {
    const list = odbc.drivers?.() || [];
    // Busca 18 primero, luego 17, luego "SQL Server"
    const want = list.find(d => /ODBC Driver 18 for SQL Server/i.test(d))
              || list.find(d => /ODBC Driver 17 for SQL Server/i.test(d))
              || '{SQL Server}';
    return typeof want === 'string' ? want : want?.name || '{SQL Server}';
  } catch { return '{ODBC Driver 17 for SQL Server}'; }
}

async function connectViaDsnOrDsnless(odbc, user, pass) {
  // 1) Intento con DSN x64
  const connStrDsn =
    `DSN=SQL SERVER;UID=${user};PWD=${pass};DATABASE=master;` +
    `Trusted_Connection=No;Encrypt=Yes;TrustServerCertificate=Yes;Connection Timeout=6;`;
  try {
    const c = await odbc.connect(connStrDsn);
    return { cn: c, used: 'dsn64', connStrPreview: 'DSN=SQL SERVER;...x64' };
  } catch (e1) {
    // 2) Fallback: leer DSN 32-bit y armar cadena DSN-less con driver x64
    const both = await readDsnConfigBothArches();
    const from32 = both?.x32?.server || both?.x64?.server; // si hay 64 lo usamos igual
    if (!from32) throw Object.assign(new Error('DSN not found in registry'), { inner: e1 });

    const driver = pickSqlOdbcDriver(odbc);
    const serverPart = from32.includes(',') ? from32 : `${from32}`; // si trae puerto, lo respetamos
    const connStrDsnless =
      `Driver=${driver};Server=${serverPart};Uid=${user};Pwd=${pass};` +
      `Database=master;Encrypt=Yes;TrustServerCertificate=Yes;Connection Timeout=6;`;

    const c2 = await odbc.connect(connStrDsnless);
    return { cn: c2, used: 'dsnless', connStrPreview: `Driver=${driver};Server=...;` };
  }
}

module.exports = {queryReg, readDsnConfigBothArches, connectViaDsnOrDsnless}