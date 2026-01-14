const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const { initDB, openDB } = require('./db');

const app = express();
const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, '..', 'pagina')));

// Servir uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Inicializar DB al arrancar
initDB();

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
  let nivelActual = NIVELES[0];
  for (const n of NIVELES) {
    if (xp >= n.xpRequerido) nivelActual = n;
  }
  const siguiente = NIVELES.find(n => n.xpRequerido > xp) || nivelActual;
  const xpParaSiguiente = siguiente.xpRequerido - nivelActual.xpRequerido;
  const xpProgreso = xp - nivelActual.xpRequerido;
  const progreso = xpParaSiguiente > 0 ? Math.min(100, Math.floor((xpProgreso / xpParaSiguiente) * 100)) : 100;

  return {
    ...nivelActual,
    xpActual: xp,
    xpSiguiente: siguiente.xpRequerido,
    progreso,
    esMaximo: nivelActual.nivel === 7
  };
}

async function modificarXP(email, cantidad) {
  const db = await openDB();
  await db.run('UPDATE users SET xp = MAX(0, COALESCE(xp, 0) + ?) WHERE email = ?', [cantidad, email]);
  const user = await db.get('SELECT xp FROM users WHERE email = ?', [email]);
  return user?.xp || 0;
}

// AUTH STATES (Memoria)
const pendingCodes = {}; // { email: { code, expires } }

// ==========================================
// AUTH UTILS
// ==========================================
// Simulación de envío
function simularEmail(email, code) {
  console.log(`\n📧 [EMAIL SIMULADO] Para: ${email} | Código: ${code}\n`);
  try {
    fs.writeFileSync(path.join(__dirname, 'codigo_login.txt'), `El código para ${email} es: ${code}`);
  } catch (e) { console.error(e); }
}

// ==========================================
// ENDPOINTS AUTH
// ==========================================

app.post('/api/auth/code', (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) return res.json({ error: "Correo inválido" });

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  pendingCodes[email] = {
    code,
    expires: Date.now() + 5 * 60 * 1000
  };

  simularEmail(email, code);
  res.json({ success: true, message: "Código enviado" });
});

app.post('/api/auth/verify', async (req, res) => {
  const { email, code } = req.body;
  const pending = pendingCodes[email];

  if (!pending) return res.json({ error: "No hay código pendiente" });
  if (Date.now() > pending.expires) return res.json({ error: "Expirado" });
  if (pending.code !== code) return res.json({ error: "Incorrecto" });

  delete pendingCodes[email];

  try {
    const db = await openDB();
    // Buscar usuario activo
    let user = await db.get('SELECT * FROM users WHERE email = ? AND deleted_at IS NULL', [email]);
    let isNew = false;

    if (!user) {
      isNew = true;
      const rol = email === 'admin@vozciudadana.uy' ? 'admin' : 'user';
      const nombre = email.split('@')[0];
      const result = await db.run(
        'INSERT INTO users (email, nombre, rol) VALUES (?, ?, ?)',
        [email, nombre, rol]
      );
      user = await db.get('SELECT * FROM users WHERE id = ?', [result.lastID]);
    }

    // Enriquecer con nivel
    const nivelInfo = calcularNivel(user.xp || 0);
    const userConNivel = { ...user, ...nivelInfo };

    res.json({ success: true, user: userConNivel, isNew });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error en DB" });
  }
});

app.post('/api/user/update', async (req, res) => {
  const { email, nombre, foto, departamento, eliminarFoto } = req.body;
  console.log("=== ACTUALIZACION DE PERFIL ===");
  console.log("Email:", email);
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
        const filename = `pfp_${email.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.${ext}`;
        const filepath = path.join(__dirname, 'uploads', filename);
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

    const query = `UPDATE users SET ${setClauses.join(', ')} WHERE email = ?`;
    params.push(email);

    console.log("-> Query:", query);
    console.log("-> Params:", params);

    const result = await db.run(query, params);
    console.log("-> Resultado UPDATE:", result);

    const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    console.log("-> Usuario final:", user);
    console.log("=== FIN ACTUALIZACION ===");

    // Añadir información de nivel
    const nivelInfo = calcularNivel(user.xp || 0);
    const userConNivel = { ...user, ...nivelInfo };

    res.json({ success: true, user: userConNivel });
  } catch (e) {
    console.error("!!! ERROR EN UPDATE:", e);
    res.status(500).json({ error: e.message });
  }
});


// ==========================================
// ENDPOINTS POSTS
// ==========================================

// GET POSTS
app.get('/api/posts', async (req, res) => {
  try {
    const db = await openDB();
    // Obtener posts activos con información del autor (JOIN)
    // Usamos LEFT JOIN users para traer la foto actual y nombre oficial
    const posts = await db.all(`
        SELECT p.*, u.foto_perfil, u.rol as autor_rol, u.departamento as autor_depto, u.xp as autor_xp
        FROM posts p 
        LEFT JOIN users u ON p.email_autor = u.email 
        WHERE p.deleted_at IS NULL 
        ORDER BY p.votos_count DESC, p.id DESC
    `);

    // Cargar detalles (multimedia, comentarios, votos)
    const enrichedPosts = await Promise.all(posts.map(async (p) => {
      // Multimedia
      const media = await db.all('SELECT tipo, data, id as mid FROM attachments WHERE post_id = ? AND deleted_at IS NULL', [p.id]);

      const comments = await db.all(`
        SELECT c.*, u.foto_perfil, u.rol as autor_rol, u.departamento as autor_depto, u.xp as autor_xp
        FROM comments c
        LEFT JOIN users u ON c.autor_nombre = u.nombre /* Fallback simple */
        WHERE c.post_id = ? AND c.deleted_at IS NULL 
        ORDER BY c.votos_count DESC
      `, [p.id]);

      // Adjuntar respuestas a comentarios
      /* Lógica simplificada: en app.js ya maneja respuestas anidadas si hacemos un buen query, 
         pero por ahora mandamos lista plana y el front lo arma si tienen parent_id,
         o mejor, anidamos aquí. */

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

      // Cargar votosIds para comentarios (para saber si user votó)
      for (let c of commentsMap) {
        const votes = await db.all("SELECT user_email FROM votes WHERE target_type='comment' AND target_id = ? AND deleted_at IS NULL", [c.id]);
        c.votosIds = votes.map(v => v.user_email);
        c.votos = c.votos_count;
      }

      // Jerarquía básica para compatibilidad con código frontend anterior
      const rootComments = commentsMap.filter(c => !c.parent_id);
      const replies = commentsMap.filter(c => c.parent_id);

      replies.forEach(r => {
        const parent = rootComments.find(rc => rc.id === r.parent_id);
        if (parent) parent.respuestas.push(r);
      });

      // Votos del Post
      const postVotes = await db.all("SELECT user_email FROM votes WHERE target_type='post' AND target_id = ? AND deleted_at IS NULL", [p.id]);

      // Calcular nivel del autor
      const autorNivel = calcularNivel(p.autor_xp || 0);

      return {
        ...p,
        id: p.id,
        dept: p.departamento,
        autor: p.autor_nombre,
        autor_foto: p.foto_perfil,
        autor_depto: p.autor_depto,
        autor_nivel: autorNivel.nombre_nivel,
        autor_insignia: autorNivel.insignia,
        multimedia: media.map(m => ({ tipo: m.tipo, data: m.data, nombre: 'archivo' })),
        comentarios: rootComments,
        votosIds: postVotes.map(v => v.user_email),
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
  const { titulo, contenido, tipo, dept, autor, emailAutor, anonimo, multimedia } = req.body;
  const db = await openDB();

  try {
    const result = await db.run(
      `INSERT INTO posts (titulo, contenido, tipo, departamento, autor_nombre, email_autor, anonimo, fecha) 
             VALUES (?, ?, ?, ?, ?, ?, ?, date('now'))`,
      [titulo, contenido, tipo, dept, autor, emailAutor, anonimo ? 1 : 0]
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
            const filepath = path.join(__dirname, 'uploads', filename);

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
      const post = await db.get("SELECT estado, email_autor FROM posts WHERE id = ?", [req.params.id]);
      const estadoAnterior = post?.estado;
      const emailAutor = post?.email_autor;

      // Actualizar estado
      await db.run("UPDATE posts SET estado = ? WHERE id = ?", [nuevoEstado, req.params.id]);

      // Calcular cambio de XP
      if (emailAutor && estadoAnterior !== nuevoEstado) {
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
          await modificarXP(emailAutor, xpCambio);
          console.log(`XP: ${emailAutor} ${xpCambio > 0 ? '+' : ''}${xpCambio} (${estadoAnterior} -> ${nuevoEstado})`);
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
  const { email } = req.body;
  const id = req.params.id;
  const db = await openDB();

  try {
    // Obtener autor del post para darle XP
    const post = await db.get("SELECT email_autor FROM posts WHERE id = ?", [id]);
    const emailAutor = post?.email_autor;

    if (existing) {
      if (existing.deleted_at) {
        await db.run("UPDATE votes SET deleted_at = NULL WHERE user_email = ? AND target_id = ? AND target_type = 'post'", [email, id]);
        if (emailAutor) await modificarXP(emailAutor, 1);
      } else {
        await db.run("UPDATE votes SET deleted_at = CURRENT_TIMESTAMP WHERE user_email = ? AND target_id = ? AND target_type = 'post'", [email, id]);
        if (emailAutor) await modificarXP(emailAutor, -1);
      }
    } else {
      await db.run("INSERT INTO votes (user_email, target_id, target_type) VALUES (?, ?, 'post')", [email, id]);
      if (emailAutor) await modificarXP(emailAutor, 1);
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
  const { texto, autor, email } = req.body;
  try {
    const db = await openDB();
    await db.run(
      "INSERT INTO comments (post_id, autor_nombre, texto) VALUES (?, ?, ?)",
      [req.params.id, autor, texto]
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
  const { texto, autor } = req.body;
  try {
    const db = await openDB();
    await db.run(
      "INSERT INTO comments (post_id, parent_id, autor_nombre, texto) VALUES (?, ?, ?, ?)",
      [req.params.id, req.params.comId, autor, texto]
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/posts/:id/comment/:comId/vote', async (req, res) => {
  const { email } = req.body;
  const cId = req.params.comId;
  try {
    const db = await openDB();
    const existing = await db.get(
      "SELECT * FROM votes WHERE user_email = ? AND target_id = ? AND target_type = 'comment'",
      [email, cId]
    );

    if (existing) {
      if (existing.deleted_at) {
        await db.run("UPDATE votes SET deleted_at = NULL WHERE user_email = ? AND target_id = ? AND target_type = 'comment'", [email, cId]);
      } else {
        await db.run("UPDATE votes SET deleted_at = CURRENT_TIMESTAMP WHERE user_email = ? AND target_id = ? AND target_type = 'comment'", [email, cId]);
      }
    } else {
      await db.run("INSERT INTO votes (user_email, target_id, target_type) VALUES (?, ?, 'comment')", [email, cId]);
    }

    // Recalcular
    const count = await db.get("SELECT COUNT(*) as c FROM votes WHERE target_id = ? AND target_type = 'comment' AND deleted_at IS NULL", [cId]);
    await db.run("UPDATE comments SET votos_count = ? WHERE id = ?", [count.c, cId]);

    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});


app.listen(PORT, () => {
  console.log(`Servidor SQL Lite corriendo en http://localhost:${PORT}`);
});
