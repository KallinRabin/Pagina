
const http = require('http');

console.log("Probando conexión a http://localhost:3000/api/posts...");

const req = http.request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/posts',
    method: 'GET'
}, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        console.log('BODY:', data.substring(0, 500));
    });
});

req.on('error', (e) => {
    console.error(`PROBLEMA CON LA PETICIÓN: ${e.message}`);
});

req.end();
