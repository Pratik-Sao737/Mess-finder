// test/verify_server.js - Probes live running HTTP server
const http = require('node:http');

// Set port for test probe
process.env.PORT = 3001;
const { server } = require('../server');

function makeRequest(path, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: 3001,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    };

    const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', err => reject(err));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function verify() {
  console.log('Probing live server on port 3001...');

  // 1. Probe static index.html
  const home = await makeRequest('/');
  console.log('Static Home response status:', home.status);
  if (home.status !== 200) throw new Error('Static index failed');

  // 2. Probe GET /api/messes
  const messesRes = await makeRequest('/api/messes');
  console.log('Messes API status:', messesRes.status, 'Count:', messesRes.data.count);
  if (messesRes.status !== 200 || messesRes.data.count < 4) throw new Error('Messes API failed');

  // 3. Probe Login as Student
  const loginRes = await makeRequest('/api/auth/login', 'POST', {
    email: 'student@messmate.com',
    password: 'password123'
  });
  console.log('Login status:', loginRes.status, 'User:', loginRes.data.user.name);
  if (loginRes.status !== 200 || !loginRes.data.token) throw new Error('Login failed');

  const token = loginRes.data.token;

  // 4. Probe My Orders
  const ordersRes = await makeRequest('/api/orders/my-orders', 'GET', null, token);
  console.log('My Orders status:', ordersRes.status, 'Orders count:', ordersRes.data.orders.length);
  if (ordersRes.status !== 200 || ordersRes.data.orders.length < 1) throw new Error('My Orders failed');

  // 5. Probe Mess Details by ID
  const detailRes = await makeRequest('/api/messes/1');
  console.log('Mess Detail status:', detailRes.status, 'Name:', detailRes.data.mess.name);
  if (detailRes.status !== 200 || !detailRes.data.plans) throw new Error('Mess detail failed');

  console.log('\nLIVE HTTP SERVER VERIFICATION SUCCESSFUL!');
  server.close();
  process.exit(0);
}

// Allow server to listen before probing
setTimeout(() => {
  verify().catch(err => {
    console.error('Server probe failed:', err);
    server.close();
    process.exit(1);
  });
}, 500);
