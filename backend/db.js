const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

// Inicializar DB
async function openDB() {
    return open({
        filename: path.join(__dirname, 'database.db'),
        driver: sqlite3.Database
    });
}

async function initDB() {
    const db = await openDB();

    // 1. USUARIOS
    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            nombre TEXT NOT NULL,
            rol TEXT DEFAULT 'user',
            foto_perfil TEXT, /* Columna nueva */
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            deleted_at DATETIME
        )
    `);

    // Migración manual por si la tabla ya existía sin las columnas nuevas
    try {
        await db.run("ALTER TABLE users ADD COLUMN foto_perfil TEXT");
    } catch (e) { }
    try {
        await db.run("ALTER TABLE users ADD COLUMN departamento TEXT");
    } catch (e) { }
    try {
        await db.run("ALTER TABLE users ADD COLUMN xp INTEGER DEFAULT 0");
    } catch (e) { }

    // 2. PUBLICACIONES (POSTS)
    await db.exec(`
        CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            titulo TEXT NOT NULL,
            contenido TEXT NOT NULL,
            tipo TEXT NOT NULL,
            departamento TEXT,
            estado TEXT DEFAULT 'Pendiente',
            anonimo INTEGER DEFAULT 0,
            fecha TEXT,
            email_autor TEXT, /* Legacy/Facilidad: guardamos email tb */
            autor_nombre TEXT,
            votos_count INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            deleted_at DATETIME,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    `);

    // 3. MULTIMEDIA
    await db.exec(`
        CREATE TABLE IF NOT EXISTS attachments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            post_id INTEGER NOT NULL,
            tipo TEXT,
            data TEXT,
            deleted_at DATETIME,
            FOREIGN KEY(post_id) REFERENCES posts(id)
        )
    `);

    // 4. COMENTARIOS
    await db.exec(`
        CREATE TABLE IF NOT EXISTS comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            post_id INTEGER NOT NULL,
            user_id INTEGER, /* Logueado */
            autor_nombre TEXT,
            texto TEXT NOT NULL,
            votos_count INTEGER DEFAULT 0,
            parent_id INTEGER, /* Para respuestas */
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            deleted_at DATETIME,
            FOREIGN KEY(post_id) REFERENCES posts(id),
            FOREIGN KEY(parent_id) REFERENCES comments(id)
        )
    `);

    // 5. VOTOS (Tabla de relación N:M para unicidad)
    // target_type: 'post' o 'comment'
    await db.exec(`
        CREATE TABLE IF NOT EXISTS votes (
            user_email TEXT NOT NULL,
            target_id INTEGER NOT NULL,
            target_type TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            deleted_at DATETIME,
            PRIMARY KEY (user_email, target_id, target_type)
        )
    `);

    console.log("Base de datos inicializada y tablas verificadas.");
    return db;
}

module.exports = { openDB, initDB };
