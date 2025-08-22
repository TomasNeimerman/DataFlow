const http = require('http');

function waitForUrl(urlToPing, timeoutMs = 30000, intervalMs = 500) {
  const u = new URL(urlToPing);
  const opts = { method: 'GET', hostname: u.hostname, port: u.port, path: '/' };

  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      const req = http.request(opts, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) return reject(new Error('Dev server no respondió a tiempo'));
        setTimeout(tick, intervalMs);
      });
      req.end();
    };
    tick();
  });
}

module.exports = waitForUrl;
