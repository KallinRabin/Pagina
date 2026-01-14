const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

async function checkDB() {
    const db = await open({
        filename: path.join(__dirname, 'database.db'),
        driver: sqlite3.Database
    });

    console.log("--- ESTRUCTURA TABLA USERS ---");
    const cols = await db.all("PRAGMA table_info(users)");
    console.table(cols);

    console.log("\n--- DATOS USERS (TOP 5) ---");
    const users = await db.all("SELECT email, nombre, departamento, foto_perfil FROM users LIMIT 5");
    console.table(users);

    await db.close();
}

checkDB().catch(console.error);
