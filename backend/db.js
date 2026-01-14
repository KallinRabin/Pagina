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
            cedula TEXT UNIQUE,
            email TEXT,
            nombre TEXT NOT NULL,
            rol TEXT DEFAULT 'user',
            foto_perfil TEXT,
            departamento TEXT,
            xp INTEGER DEFAULT 0,
            webauthn_id TEXT,
            public_key TEXT,
            sign_count INTEGER DEFAULT 0,
            ci_verified INTEGER DEFAULT 0,
            ci_photo_url TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            deleted_at DATETIME
        )
    `);

    // Migración manual por si la tabla ya existía sin las columnas nuevas
    // Migración manual por si la tabla ya existía
    const columns = [
        "ALTER TABLE users ADD COLUMN cedula TEXT UNIQUE",
        "ALTER TABLE users ADD COLUMN departamento TEXT",
        "ALTER TABLE users ADD COLUMN xp INTEGER DEFAULT 0",
        "ALTER TABLE users ADD COLUMN webauthn_id TEXT",
        "ALTER TABLE users ADD COLUMN public_key TEXT",
        "ALTER TABLE users ADD COLUMN sign_count INTEGER DEFAULT 0",
        "ALTER TABLE users ADD COLUMN ci_verified INTEGER DEFAULT 0",
        "ALTER TABLE users ADD COLUMN ci_photo_url TEXT"
    ];
    for (const sql of columns) {
        try { await db.run(sql); } catch (e) { }
    }

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
            user_id INTEGER NOT NULL,
            target_id INTEGER NOT NULL,
            target_type TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            deleted_at DATETIME,
            PRIMARY KEY (user_id, target_id, target_type),
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    `);

    console.log("Base de datos inicializada y tablas verificadas.");

    // AUTO-SEEDING: Si no hay publicaciones, crear una de bienvenida
    const postCount = await db.get("SELECT COUNT(*) as c FROM posts WHERE deleted_at IS NULL");
    if (postCount.c === 0) {
        console.log("🌱 Base de datos vacía detectada. Creando post de bienvenida...");

        // Crear usuario admin virtual
        const adminEmail = 'vciudadanauy@gmail.com';
        let admin = await db.get("SELECT id FROM users WHERE email = ?", [adminEmail]);
        if (!admin) {
            await db.run("INSERT INTO users (email, nombre, rol, xp) VALUES (?, ?, ?, ?)",
                [adminEmail, 'Administrador Supremo', 'admin', 5000]);
        }

        // Crear post
        await db.run(`
            INSERT INTO posts (titulo, contenido, tipo, departamento, autor_nombre, email_autor, estado, fecha)
            VALUES (?, ?, ?, ?, ?, ?, ?, date('now'))`,
            [
                "¡Bienvenidos a Voz Ciudadana! 🗳️",
                "Esta es una plataforma para que todos los ciudadanos de Uruguay puedan expresar sus ideas, quejas y propuestas para mejorar el país.\n\nComo acabas de entrar a un servidor nuevo, hemos creado este post automáticamente. ¡Siéntete libre de crear el primer reporte real de tu comunidad!",
                "General",
                "Montevideo",
                "Administrador",
                adminEmail,
                "Completado"
            ]
        );
        console.log("✅ Post de bienvenida creado con éxito.");
    }

    return db;
}

module.exports = { openDB, initDB };
