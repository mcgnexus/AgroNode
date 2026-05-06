const http = require('http');

const MAX_RETRIES = 30;
const RETRY_DELAY = 1000;

async function waitForServer(url, retries = MAX_RETRIES) {
  for (let i = 0; i < retries; i++) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(url, (res) => {
          resolve(true);
        });
        req.on('error', reject);
        req.setTimeout(2000, () => {
          req.destroy();
          reject(new Error('timeout'));
        });
      });
      return true;
    } catch {
      await new Promise(r => setTimeout(r, RETRY_DELAY));
    }
  }
  throw new Error('Server no disponible');
}

async function triggerSync() {
  console.log('🔄 Iniciando sincronización meteorológica...');
  
  try {
    const response = await new Promise((resolve, reject) => {
      const req = http.get('http://localhost:3000/api/cron/sync-weather', (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      });
      req.on('error', reject);
      req.setTimeout(60000, () => reject(new Error('timeout')));
    });

    if (response.status === 200) {
      const result = JSON.parse(response.body);
      console.log('✅ Sincronización completada:', result);
    } else {
      console.log('⚠️ Sync respondió con status:', response.status);
    }
  } catch (err) {
    console.log('⚠️ Error en sync:', err.message);
  }
}

(async () => {
  console.log('⏳ Esperando que Next.js esté listo...');
  await waitForServer('http://localhost:3000');
  console.log('✅ Next.js iniciado');
  
  await triggerSync();
})();