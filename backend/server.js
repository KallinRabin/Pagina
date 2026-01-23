const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');
const { isoBase64URL } = require('@simplewebauthn/server/helpers');
const cloudinary = require('cloudinary').v2;
const { initDB, openDB } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
// En Render no podemos usar localhost para las imágenes, necesitamos la URL real
// Esta BASE_URL se usará para guardar la ruta completa de las fotos de perfil
const BASE_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;

// Configuración Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

// Middleware de log para depurar en Render
app.use((req, res, next) => {
  if (req.url.startsWith('/api')) {
    console.log(`[API REQUEST] ${req.method} ${req.url}`);
  }
  next();
});

// Inicializar DB al arrancar
initDB();

// Servir uploads (fotos)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// NOTA: Los archivos estáticos del frontend se cargarán al FINAL para no interferir con la API


// ==========================================
// SISTEMA DE GAMIFICACIÓN - NIVELES Y XP
// ==========================================
const NIVELES = [
  { nivel: 1, nombre_nivel: 'Ciudadano Novato', xpRequerido: 0, insignia: '🌱', color: '#a8e6cf' },
  { nivel: 2, nombre_nivel: 'Vecino Activo', xpRequerido: 40, insignia: '🏘️', color: '#88d8b0' },
  { nivel: 3, nombre_nivel: 'Voz del Barrio', xpRequerido: 120, insignia: '📢', color: '#ffd93d' },
  { nivel: 4, nombre_nivel: 'Líder Comunitario', xpRequerido: 240, insignia: '🏅', color: '#ffb347' },
  { nivel: 5, nombre_nivel: 'Defensor Cívico', xpRequerido: 400, insignia: '🛡️', color: '#ff6b6b' },
  { nivel: 6, nombre_nivel: 'Héroe Ciudadano', xpRequerido: 600, insignia: '⭐', color: '#c9b1ff' },
  { nivel: 7, nombre_nivel: 'Leyenda Nacional', xpRequerido: 1000, insignia: '👑', color: '#ffd700' }
];

function calcularNivel(xp) {
  const safeXp = Number(xp) || 0;
  let nivelActual = NIVELES[0];
  for (const n of NIVELES) {
    if (safeXp >= n.xpRequerido) nivelActual = n;
  }
  const siguiente = NIVELES.find(n => n.xpRequerido > safeXp) || nivelActual;
  const xpParaSiguiente = siguiente.xpRequerido - nivelActual.xpRequerido;
  const xpProgreso = safeXp - nivelActual.xpRequerido;
  const progreso = xpParaSiguiente > 0 ? Math.min(100, Math.floor((xpProgreso / xpParaSiguiente) * 100)) : 100;

  return {
    ...nivelActual,
    xpActual: safeXp,
    xpSiguiente: siguiente.xpRequerido,
    progreso,
    esMaximo: nivelActual.nivel === 7
  };
}

// Función para modificar XP por ID de usuario
async function modificarXPById(id, cantidad) {
  const db = await openDB();
  await db.run('UPDATE users SET xp = MAX(0, COALESCE(xp, 0) + ?) WHERE id = ?', [cantidad, id]);
  const user = await db.get('SELECT xp FROM users WHERE id = ?', [id]);
  return user?.xp || 0;
}

// CONFIGURACIÓN DE ACCESO MAESTRO
const ADMIN_CEDULAS = ["1.234.567-8", "4.123.456-7", "1111111-1"]; // 1111111-1 como ejemplo de admin
const PIN_MAESTRO = "20252025"; // PIN Secreto para emergencias

// Email y códigos eliminados (migración a CI)
const challenges = {}; // { userId/session: challenge }

// ==========================================
// VALIDACIÓN CI URUGUAYA
// ==========================================
function validarCI(ci) {
  // Limpiar caracteres no numéricos
  const ciClean = ci.toString().replace(/\D/g, '');
  if (ciClean.length < 7 || ciClean.length > 8) return false;

  const arrCI = ciClean.split('').map(Number);

  // Si tiene 7 dígitos, rellenamos con 0 al inicio para el cálculo
  if (arrCI.length === 7) arrCI.unshift(0);

  const factores = [2, 9, 8, 7, 6, 3, 4];
  let suma = 0;
  for (let i = 0; i < 7; i++) {
    suma += arrCI[i] * factores[i];
  }

  const digitoVerificadorCalculado = (10 - (suma % 10)) % 10;
  return digitoVerificadorCalculado === arrCI[7];
}

// ==========================================
// ENDPOINTS AUTH (CI + WEBAUTHN)
// ==========================================

// 1. Verificar si la CI existe y si tiene Passkey
app.get('/api/auth/check-ci/:cedula', async (req, res) => {
  const { cedula } = req.params;
  if (!validarCI(cedula)) return res.json({ error: "Cédula inválida" });

  try {
    const db = await openDB();
    const user = await db.get('SELECT id, public_key, nombre FROM users WHERE cedula = ? AND deleted_at IS NULL', [cedula]);

    res.json({
      exists: !!user,
      hasPasskey: !!(user && user.public_key),
      nombre: user?.nombre || ""
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Opciones para registrar una nueva Passkey (Registro)
app.post('/api/auth/register-options', async (req, res) => {
  const { cedula, nombre } = req.body;

  if (!validarCI(cedula)) return res.json({ error: "Cédula inválida" });

  const options = await generateRegistrationOptions({
    rpName: 'Voz Ciudadana Uruguay',
    rpID: process.env.RENDER_EXTERNAL_URL ? new URL(process.env.RENDER_EXTERNAL_URL).hostname : 'localhost',
    userID: Buffer.from(`user-${cedula}`),
    userName: nombre || `Usuario ${cedula}`,
    attestationType: 'none',
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred', // 'preferred' permite PIN si no hay biometría
    },
    attestationType: 'none',
  });

  challenges[cedula] = options.challenge;
  res.json(options);
});

// 3. Verificar y Guardar la nueva Passkey
app.post('/api/auth/register-verify', async (req, res) => {
  const { cedula, nombre, body } = req.body;
  const expectedChallenge = challenges[cedula];

  if (!expectedChallenge) return res.json({ error: "Desafío no encontrado" });

  try {
    const db = await openDB();
    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: ['http://localhost:3000', 'https://' + (process.env.RENDER_EXTERNAL_URL ? new URL(process.env.RENDER_EXTERNAL_URL).hostname : 'localhost')],
      expectedRPID: process.env.RENDER_EXTERNAL_URL ? new URL(process.env.RENDER_EXTERNAL_URL).hostname : 'localhost',
    });

    if (verification.verified) {
      const { registrationInfo } = verification;
      const { credentialPublicKey, credentialID, counter } = registrationInfo;

      // Guardar o Actualizar Usuario
      let user = await db.get('SELECT id FROM users WHERE cedula = ?', [cedula]);

      if (!user) {
        const rol = ADMIN_CEDULAS.includes(cedula) ? 'admin' : 'user';
        await db.run(
          'INSERT INTO users (cedula, nombre, rol, public_key, webauthn_id, sign_count) VALUES (?, ?, ?, ?, ?, ?)',
          [cedula, nombre, rol, isoBase64URL.fromBuffer(credentialPublicKey), isoBase64URL.fromBuffer(credentialID), counter]
        );
      } else {
        await db.run(
          'UPDATE users SET public_key = ?, webauthn_id = ?, sign_count = ? WHERE cedula = ?',
          [isoBase64URL.fromBuffer(credentialPublicKey), isoBase64URL.fromBuffer(credentialID), counter, cedula]
        );
      }

      delete challenges[cedula];
      const newUser = await db.get('SELECT * FROM users WHERE cedula = ?', [cedula]);
      res.json({ verified: true, user: { ...newUser, nivelInfo: calcularNivel(newUser.xp || 0) } });
    } else {
      res.json({ verified: false, error: "Fallo en la verificación" });
    }
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error.message });
  }
});

// 3.5 CHEQUEO DE CÉDULA (Nombre y Existencia)
app.get('/api/auth/check-ci/:ci', async (req, res) => {
  const { ci } = req.params;
  try {
    const db = await openDB();
    const user = await db.get('SELECT nombre, webauthn_id FROM users WHERE cedula = ?', [ci]);
    if (user) {
      res.json({ exists: true, nombre: user.nombre, hasPasskey: !!user.webauthn_id });
    } else {
      res.json({ exists: false });
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error interno" });
  }
});

// 4. Opciones para Login (Autenticación)
app.post('/api/auth/login-options', async (req, res) => {
  const { cedula } = req.body;
  const db = await openDB();
  const user = await db.get('SELECT webauthn_id FROM users WHERE cedula = ?', [cedula]);

  if (!user || !user.webauthn_id) return res.json({ error: "Usuario sin Passkey" });

  const options = await generateAuthenticationOptions({
    rpID: process.env.RENDER_EXTERNAL_URL ? new URL(process.env.RENDER_EXTERNAL_URL).hostname : 'localhost',
    allowCredentials: [{
      id: user.webauthn_id,
      type: 'public-key',
      transports: ['internal', 'usb', 'nfc', 'ble', 'hybrid'],
    }],
    userVerification: 'preferred', // Permite mayor flexibilidad en dispositivos antiguos
  });

  challenges[cedula] = options.challenge;
  res.json(options);
});

// 5. Verificar Login
app.post('/api/auth/login-verify', async (req, res) => {
  const { cedula, body } = req.body;
  const expectedChallenge = challenges[cedula];

  try {
    const db = await openDB();
    const user = await db.get('SELECT * FROM users WHERE cedula = ?', [cedula]);

    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: ['http://localhost:3000', 'https://' + (process.env.RENDER_EXTERNAL_URL ? new URL(process.env.RENDER_EXTERNAL_URL).hostname : 'localhost')],
      expectedRPID: process.env.RENDER_EXTERNAL_URL ? new URL(process.env.RENDER_EXTERNAL_URL).hostname : 'localhost',
      authenticator: {
        credentialID: user.webauthn_id,
        credentialPublicKey: isoBase64URL.toBuffer(user.public_key),
        counter: user.sign_count,
      },
    });

    if (verification.verified) {
      const { authenticationInfo } = verification;
      await db.run('UPDATE users SET sign_count = ? WHERE id = ?', [authenticationInfo.newCounter, user.id]);
      delete challenges[cedula];
      res.json({ verified: true, user: { ...user, nivelInfo: calcularNivel(user.xp || 0) } });
    } else {
      console.log("Fallo verificación:", verification);
      res.json({ verified: false, error: "La biometría no pudo ser verificada por el servidor." });
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 6. LOGIN MAESTRO (BACKDOOR PARA ADMIN)
app.post('/api/auth/master-login', async (req, res) => {
  const { cedula, pin } = req.body;

  if (cedula && pin === PIN_MAESTRO) {
    try {
      const db = await openDB();
      // Buscamos si el usuario existe
      let user = await db.get('SELECT * FROM users WHERE cedula = ?', [cedula]);

      // Si es admin y no existe, lo creamos (opcional, pero útil para el primer inicio)
      if (!user && ADMIN_CEDULAS.includes(cedula)) {
        await db.run('INSERT INTO users (cedula, nombre, rol) VALUES (?, ?, ?)', [cedula, "Admin Maestro", "admin"]);
        user = await db.get('SELECT * FROM users WHERE cedula = ?', [cedula]);
      }

      if (user) {
        return res.json({ verified: true, user: { ...user, nivelInfo: calcularNivel(user.xp || 0) } });
      }
    } catch (e) {
      console.error(e);
    }
  }

  res.status(401).json({ error: "Acceso denegado" });
});

app.post('/api/user/update', async (req, res) => {
  const { cedula, nombre, foto, departamento, eliminarFoto } = req.body;
  console.log("=== ACTUALIZACION DE PERFIL ===");
  console.log("Cédula:", cedula);
  console.log("Nombre:", nombre);
  console.log("Departamento:", departamento);
  console.log("Tiene foto Base64:", foto ? foto.substring(0, 50) + "..." : "NO");
  console.log("Eliminar foto:", eliminarFoto);

  const db = await openDB();

  try {
    let fotoUrl = undefined;

    if (eliminarFoto === true) {
      fotoUrl = null;
      console.log("-> Se eliminará la foto");
    } else if (foto && typeof foto === 'string' && foto.startsWith('data:')) {
      console.log("-> Procesando imagen Base64...");
      const matches = foto.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const type = matches[1];
        const buffer = Buffer.from(matches[2], 'base64');
        const ext = type.split('/')[1] || 'png';
        const filename = `pfp_${cedula}_${Date.now()}.${ext}`;
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        const filepath = path.join(uploadDir, filename);
        fs.writeFileSync(filepath, buffer);
        fotoUrl = `${BASE_URL}/uploads/${filename}`;
        console.log("-> Imagen guardada:", fotoUrl);
      }
    }

    // Construir query SQL
    let setClauses = ['nombre = ?', 'departamento = ?'];
    let params = [nombre, departamento || null];

    if (fotoUrl !== undefined) {
      setClauses.push('foto_perfil = ?');
      params.push(fotoUrl);
    }

    const query = `UPDATE users SET ${setClauses.join(', ')} WHERE cedula = ?`;
    params.push(cedula);

    console.log("-> Query:", query);
    console.log("-> Params:", params);

    const result = await db.run(query, params);
    console.log("-> Resultado UPDATE:", result);

    const user = await db.get('SELECT * FROM users WHERE cedula = ?', [cedula]);
    console.log("-> Usuario final:", user);
    console.log("=== FIN ACTUALIZACION ===");

    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado tras la actualización" });
    }

    // Añadir información de nivel de forma segura
    const nivelInfo = calcularNivel(user.xp || 0);
    const userConNivel = { ...user, nivelInfo };

    res.json({ success: true, user: userConNivel });
  } catch (e) {
    console.error("!!! ERROR EN UPDATE:", e);
    res.status(500).json({ error: e.message });
  }
});


// ==========================================
// ENDPOINTS POSTS
// ==========================================

// GET POSTS (CON FILTROS REAL-TIME)
app.get('/api/posts', async (req, res) => {
  try {
    const { departamento, tipo } = req.query;
    const db = await openDB();

    let query = `
      SELECT p.*, u.nombre as autor_nombre, u.rol as autor_rol, 
             u.foto_perfil as autor_foto, u.departamento as autor_depto,
             u.xp as autor_xp
      FROM posts p 
      LEFT JOIN users u ON p.email_autor = u.email 
      WHERE p.deleted_at IS NULL
    `;

    // Filtros Dinámicos (Solo si no es "todos" / "todas")
    const params = [];

    if (departamento && departamento !== 'todos') {
      query += ' AND p.departamento = ?';
      params.push(departamento);
    }

    if (tipo && tipo !== 'todas') {
      query += ' AND p.tipo = ?';
      params.push(tipo);
    }

    // Ordenar por votos y fecha
    query += ' ORDER BY p.votos_count DESC, p.id DESC';

    const posts = await db.all(query, params);

    // Cargar detalles (multimedia, comentarios, votos) y enriquecer
    const enrichedPosts = await Promise.all(posts.map(async (p) => {
      // Multimedia
      const media = await db.all('SELECT tipo, data, id as mid FROM attachments WHERE post_id = ? AND deleted_at IS NULL', [p.id]);

      const comments = await db.all(`
        SELECT c.*, u.foto_perfil, u.rol as autor_rol, u.departamento as autor_depto, u.xp as autor_xp, u.cedula as autor_cedula
        FROM comments c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.post_id = ? AND c.deleted_at IS NULL 
        ORDER BY c.votos_count DESC
      `, [p.id]);

      // Mapeo detallado de comentarios
      const commentsMap = comments.map(c => {
        const nivelInfo = calcularNivel(c.autor_xp || 0);
        return {
          ...c,
          respuestas: [],
          votosIds: [],
          autor: c.autor_nombre,
          autor_foto: c.foto_perfil,
          autor_depto: c.autor_depto,
          autor_nivel: nivelInfo.nombre_nivel,
          autor_insignia: nivelInfo.insignia
        };
      });

      // Cargar votosIds para comentarios
      for (let c of commentsMap) {
        const votes = await db.all("SELECT u.cedula FROM votes v JOIN users u ON v.user_id = u.id WHERE v.target_type='comment' AND v.target_id = ? AND v.deleted_at IS NULL", [c.id]);
        c.votosIds = votes.map(v => v.cedula);
        c.votos = c.votos_count;
      }

      // Jerarquía básica
      const rootComments = commentsMap.filter(c => !c.parent_id);
      const replies = commentsMap.filter(c => c.parent_id);

      replies.forEach(r => {
        const parent = rootComments.find(rc => rc.id === r.parent_id);
        if (parent) parent.respuestas.push(r);
      });

      // Votos del Post
      const postVotes = await db.all("SELECT u.cedula FROM votes v JOIN users u ON v.user_id = u.id WHERE v.target_type='post' AND v.target_id = ? AND v.deleted_at IS NULL", [p.id]);

      // Calcular nivel del autor del post
      const autorNivel = calcularNivel(p.autor_xp || 0);

      return {
        ...p,
        id: p.id, // Ensure ID is passed down
        dept: p.departamento, // Aliasing para consistencia
        autor: p.autor_nombre || p.autor, // Fallback
        autor_foto: p.foto_perfil,
        autor_depto: p.autor_depto,
        autor_nivel: autorNivel.nombre_nivel,
        autor_insignia: autorNivel.insignia,
        multimedia: media.map(m => ({ tipo: m.tipo, data: m.data, nombre: 'archivo' })),
        comentarios: rootComments,
        votosIds: postVotes.map(v => v.cedula),
        votos: p.votos_count
      };
    }));

    res.json(enrichedPosts);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error load posts" });
  }
});

// Servir archivos estáticos (imágenes subidas)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// CREATE POST
app.post('/api/posts', async (req, res) => {
  const { titulo, contenido, tipo, dept, autor, cedulaAutor, anonimo, multimedia } = req.body;
  const db = await openDB();

  try {
    const user = await db.get("SELECT id FROM users WHERE cedula = ?", [cedulaAutor]);
    const result = await db.run(
      `INSERT INTO posts (titulo, contenido, tipo, departamento, autor_nombre, user_id, anonimo, fecha) 
             VALUES (?, ?, ?, ?, ?, ?, ?, date('now'))`,
      [titulo, contenido, tipo, dept, autor, user?.id || null, anonimo ? 1 : 0]
    );
    const postId = result.lastID;

    if (multimedia && multimedia.length > 0) {
      for (let m of multimedia) {
        let fileUrl = m.data; // Por defecto (si fuese URL externa)

        // Si es Base64, guardar en disco
        if (m.data && m.data.match(/^data:/)) {
          // Extraer extensión y datos
          const matches = m.data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
          if (matches && matches.length === 3) {
            const type = matches[1];
            const buffer = Buffer.from(matches[2], 'base64');
            const ext = type.split('/')[1] || 'bin';
            const filename = `file_${postId}_${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`;
            const uploadDir = path.join(__dirname, 'uploads');
            if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
            const filepath = path.join(uploadDir, filename);

            try {
              fs.writeFileSync(filepath, buffer);
              fileUrl = `/uploads/${filename}`; // URL pública relativo al dominio
              // console.log("Archivo guardado:", fileUrl);
            } catch (err) {
              console.error("Error guardando archivo:", err);
            }
          }
        }

        await db.run('INSERT INTO attachments (post_id, tipo, data) VALUES (?, ?, ?)', [postId, m.tipo, fileUrl]);
      }
    }

    res.json({ success: true, id: postId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error creando post" });
  }
});

// ENDPOINT: VERIFICACIÓN DE CI (OCR + CLOUD)
app.post('/api/user/verify-ci', async (req, res) => {
  const { cedula, fotoCI, nombreExtraido } = req.body;
  const db = await openDB();

  try {
    let cloudUrl = null;
    let localFilePath = null;

    // 1. Intentar subir a Cloudinary si está configurado
    if (process.env.CLOUDINARY_API_KEY) {
      const uploadRes = await cloudinary.uploader.upload(fotoCI, {
        folder: 'voz_ciudadana/ci_verifications',
        public_id: `ci_${cedula}_${Date.now()}`
      });
      cloudUrl = uploadRes.secure_url;
    } else {
      // Fallback local
      const matches = fotoCI.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches) {
        const buffer = Buffer.from(matches[2], 'base64');
        const filename = `ci_verify_${cedula}_${Date.now()}.jpg`;
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        localFilePath = path.join(uploadDir, filename);
        fs.writeFileSync(localFilePath, buffer);
        cloudUrl = `${BASE_URL}/uploads/${filename}`;
      }
    }

    // 2. Marcar como verificado y actualizar nombre si se proporcionó
    await db.run(
      'UPDATE users SET ci_verified = 1, ci_photo_url = ?, nombre = COALESCE(?, nombre) WHERE cedula = ?',
      ["VERIFICADO_Y_ELIMINADO", nombreExtraido || null, cedula]
    );

    // 3. AUTO-BORRADO DE PRIVACIDAD: Eliminar la evidencia física inmediatamente
    try {
      if (localFilePath && fs.existsSync(localFilePath)) {
        fs.unlinkSync(localFilePath);
        console.log("-> Foto de CI local eliminada por privacidad.");
      }
    } catch (err) {
      console.error("Error al borrar foto CI:", err);
    }

    res.json({ success: true, nombreOficial: nombreExtraido });
  } catch (error) {
    console.error("Error en verify-ci:", error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE POST (Soft Delete)
app.delete('/api/posts/:id', async (req, res) => {
  try {
    const db = await openDB();
    await db.run("UPDATE posts SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// UPDATE POST (Estado) + Sistema de XP
app.put('/api/posts/:id', async (req, res) => {
  try {
    const db = await openDB();
    const nuevoEstado = req.body.estado;

    if (nuevoEstado) {
      // Obtener estado anterior y autor
      const post = await db.get("SELECT estado, user_id FROM posts WHERE id = ?", [req.params.id]);
      const estadoAnterior = post?.estado;

      // Actualizar estado
      await db.run("UPDATE posts SET estado = ? WHERE id = ?", [nuevoEstado, req.params.id]);

      // Calcular cambio de XP
      if (post?.user_id && estadoAnterior !== nuevoEstado) {
        let xpCambio = 0;

        // Revertir XP del estado anterior
        if (estadoAnterior === 'Completado') xpCambio -= 3;
        else if (estadoAnterior === 'En Revisión') xpCambio -= 1;
        else if (estadoAnterior === 'Rechazado') xpCambio += 2;

        // Aplicar XP del nuevo estado
        if (nuevoEstado === 'Completado') xpCambio += 3;
        else if (nuevoEstado === 'En Revisión') xpCambio += 1;
        else if (nuevoEstado === 'Rechazado') xpCambio -= 2;

        if (xpCambio !== 0) {
          await modificarXPById(post.user_id, xpCambio);
          console.log(`XP: ID ${post.user_id} ${xpCambio > 0 ? '+' : ''}${xpCambio} (${estadoAnterior} -> ${nuevoEstado})`);
        }
      }
    }
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// VOTE POST
app.post('/api/posts/:id/vote', async (req, res) => {
  const { cedula } = req.body;
  const id = req.params.id;
  const db = await openDB();

  try {
    // Obtener autor del post para darle XP
    const post = await db.get("SELECT user_id FROM posts WHERE id = ?", [id]);
    const userVotante = await db.get("SELECT id FROM users WHERE cedula = ?", [req.body.cedula]);
    if (!userVotante) return res.json({ error: "Usuario no encontrado" });

    const existing = await db.get(
      "SELECT * FROM votes WHERE user_id = ? AND target_id = ? AND target_type = 'post'",
      [userVotante.id, id]
    );

    if (existing) {
      if (existing.deleted_at) {
        await db.run("UPDATE votes SET deleted_at = NULL WHERE user_id = ? AND target_id = ? AND target_type = 'post'", [userVotante.id, id]);
        if (post?.user_id) await modificarXPById(post.user_id, 1);
      } else {
        await db.run("UPDATE votes SET deleted_at = CURRENT_TIMESTAMP WHERE user_id = ? AND target_id = ? AND target_type = 'post'", [userVotante.id, id]);
        if (post?.user_id) await modificarXPById(post.user_id, -1);
      }
    } else {
      await db.run("INSERT INTO votes (user_id, target_id, target_type) VALUES (?, ?, 'post')", [userVotante.id, id]);
      if (post?.user_id) await modificarXPById(post.user_id, 1);
    }

    // Recalcular contador
    const count = await db.get("SELECT COUNT(*) as c FROM votes WHERE target_id = ? AND target_type = 'post' AND deleted_at IS NULL", [id]);
    await db.run("UPDATE posts SET votos_count = ? WHERE id = ?", [count.c, id]);

    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error voting" });
  }
});

// ==========================================
// ENDPOINTS COMENTARIOS
// ==========================================

app.post('/api/posts/:id/comment', async (req, res) => {
  const { texto, autor, cedula } = req.body;
  try {
    const db = await openDB();
    const user = await db.get("SELECT id FROM users WHERE cedula = ?", [cedula]);
    await db.run(
      "INSERT INTO comments (post_id, user_id, autor_nombre, texto) VALUES (?, ?, ?, ?)",
      [req.params.id, user?.id || null, autor, texto]
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/posts/:id/comment/:comId', async (req, res) => {
  try {
    const db = await openDB();
    await db.run("UPDATE comments SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?", [req.params.comId]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/posts/:id/comment/:comId/reply', async (req, res) => {
  const { texto, autor, cedula } = req.body;
  try {
    const db = await openDB();
    const user = await db.get("SELECT id FROM users WHERE cedula = ?", [cedula]);
    await db.run(
      "INSERT INTO comments (post_id, parent_id, user_id, autor_nombre, texto) VALUES (?, ?, ?, ?, ?)",
      [req.params.id, req.params.comId, user?.id || null, autor, texto]
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/posts/:id/comment/:comId/vote', async (req, res) => {
  const { cedula } = req.body;
  const cId = req.params.comId;
  try {
    const db = await openDB();
    const user = await db.get("SELECT id FROM users WHERE cedula = ?", [cedula]);
    if (!user) return res.json({ error: "Usuario no encontrado" });

    const existing = await db.get(
      "SELECT * FROM votes WHERE user_id = ? AND target_id = ? AND target_type = 'comment'",
      [user.id, cId]
    );

    if (existing) {
      if (existing.deleted_at) {
        await db.run("UPDATE votes SET deleted_at = NULL WHERE user_id = ? AND target_id = ? AND target_type = 'comment'", [user.id, cId]);
      } else {
        await db.run("UPDATE votes SET deleted_at = CURRENT_TIMESTAMP WHERE user_id = ? AND target_id = ? AND target_type = 'comment'", [user.id, cId]);
      }
    } else {
      await db.run("INSERT INTO votes (user_id, target_id, target_type) VALUES (?, ?, 'comment')", [user.id, cId]);
    }

    // Recalcular
    const count = await db.get("SELECT COUNT(*) as c FROM votes WHERE target_id = ? AND target_type = 'comment' AND deleted_at IS NULL", [cId]);
    await db.run("UPDATE comments SET votos_count = ? WHERE id = ?", [count.c, cId]);

    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Servir frontend al final
app.use(express.static(path.join(__dirname, '..', 'frontend', 'dist')));

app.listen(PORT, () => {
  console.log(`Servidor SQL Lite corriendo en http://localhost:${PORT}`);
});
