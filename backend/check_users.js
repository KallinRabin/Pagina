const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

async function checkUsers() {
    const db = await open({
        filename: path.join(__dirname, 'database.db'),
        driver: sqlite3.Database
    });

    const users = await db.all('SELECT email, nombre, departamento, foto_perfil FROM users');

    console.log("=== USUARIOS EN BASE DE DATOS ===");
    users.forEach((u, i) => {
        console.log(`\n[${i + 1}] ${u.email}`);
        console.log(`    Nombre: ${u.nombre}`);
        console.log(`    Departamento: ${u.departamento || '(vacío)'}`);
        console.log(`    Foto: ${u.foto_perfil || '(ninguna)'}`);
    });

    await db.close();
}

checkUsers();
