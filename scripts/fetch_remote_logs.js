const https = require('https');

const fetchCrashLogs = async () => {
  try {
    const loginData = JSON.stringify({ password: 'AYUSHSLS' });
    
    console.log('Logging in to developer endpoint...');
    
    // Step 1: Login to get token
    const token = await new Promise((resolve, reject) => {
      const req = https.request('https://server.nightbusjourney.com/api/developer/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': loginData.length
        }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            if (parsed.success) resolve(parsed.token);
            else reject(new Error('Login failed: ' + body));
          } catch(e) { reject(e); }
        });
      });
      req.on('error', reject);
      req.write(loginData);
      req.end();
    });

    console.log('Successfully logged in. Fetching logs...');

    // Step 2: Fetch logs
    const logs = await new Promise((resolve, reject) => {
      const req = https.request('https://server.nightbusjourney.com/api/developer/logs?limit=5', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            resolve(parsed.logs);
          } catch(e) { reject(e); }
        });
      });
      req.on('error', reject);
      req.end();
    });

    console.log('\n=== LATEST CRASH LOGS ===');
    if (!logs || logs.length === 0) {
      console.log('No logs found.');
      return;
    }
    
    logs.forEach(log => {
      console.log(`\n[${log.timestamp}] ${log.level.toUpperCase()} - ${log.source}`);
      console.log(`Message: ${log.message}`);
      if (log.meta && log.meta.stack) {
        console.log(`Stack:\n${log.meta.stack}`);
      }
    });
    
  } catch(e) {
    console.error('Error:', e.message);
  }
};

fetchCrashLogs();
