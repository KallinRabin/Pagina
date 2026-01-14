// Test directo del endpoint de actualización de perfil
const fetch = require('node-fetch');

async function testUpdate() {
    const testData = {
        email: 'admin@vozciudadana.uy',
        nombre: 'Admin Test',
        departamento: 'Montevideo',
        foto: null,
        eliminarFoto: false
    };

    console.log('Enviando datos:', testData);

    try {
        const res = await fetch('http://localhost:3000/api/user/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testData)
        });

        const data = await res.json();
        console.log('Respuesta del servidor:', JSON.stringify(data, null, 2));

        if (data.user) {
            console.log('Usuario actualizado:');
            console.log('  - Nombre:', data.user.nombre);
            console.log('  - Departamento:', data.user.departamento);
            console.log('  - Foto:', data.user.foto_perfil);
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

testUpdate();
