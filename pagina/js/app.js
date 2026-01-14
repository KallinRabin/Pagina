// --- CONFIGURACIÓN E INICIO ---
// Si estamos en local usa localhost, si estamos en Render usa la URL del servidor
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? "http://localhost:3000/api"
    : "/api"; // En producción usa la ruta relativa si el frontend y backend están en el mismo server
const DEPTOS = ["Artigas", "Canelones", "Cerro Largo", "Colonia", "Durazno", "Flores", "Florida", "Lavalleja", "Maldonado", "Montevideo", "Paysandú", "Río Negro", "Rivera", "Rocha", "Salto", "San José", "Soriano", "Tacuarembó", "Treinta y Tres"];

let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
let currentDept = 'todos';
let currentCategory = 'todas';
let publicaciones = []; // Se llena desde el backend

document.addEventListener('DOMContentLoaded', () => {
    init();
    actualizarInterfazUsuario();
});

async function init() {
    // Selectores de departamentos
    const mainF = document.getElementById('main-dept-filter');
    const postF = document.getElementById('post-dept');

    if (mainF) {
        mainF.innerHTML = '<option value="todos">Todo el Uruguay</option>';
        DEPTOS.forEach(d => {
            mainF.innerHTML += `<option value="${d}">${d}</option>`;
            if (postF) postF.innerHTML += `<option value="${d}">${d}</option>`;
        });
    }

    // Formulario de publicación
    const postForm = document.getElementById('postForm');
    if (postForm) postForm.onsubmit = guardarPost;

    await cargarPublicaciones();
}

// =========================================
// 1. SISTEMA DE USUARIOS (PASSWORDLESS)
// =========================================

function abrirAuth() {
    const modal = document.getElementById('authModal');
    modal.style.display = 'block';
    setTimeout(() => modal.classList.add('show'), 10);
    resetAuth();
}

function cerrarAuth() {
    const modal = document.getElementById('authModal');
    modal.classList.remove('show');
    setTimeout(() => modal.style.display = 'none', 300);
}

function resetAuth() {
    document.getElementById('auth-step-1').style.display = 'block';
    document.getElementById('auth-step-2').style.display = 'none';
    document.getElementById('auth-cedula').value = '';
    document.getElementById('auth-nombre').value = '';
    document.getElementById('auth-name-group').style.display = 'none';
}

// VALIDADOR CI URUGUAYA (Front)
function validarCI(ci) {
    const ciClean = ci.toString().replace(/\D/g, '');
    if (ciClean.length < 7 || ciClean.length > 8) return false;
    const arrCI = ciClean.split('').map(Number);
    if (arrCI.length === 7) arrCI.unshift(0);
    const factores = [2, 9, 8, 7, 6, 3, 4];
    let suma = 0;
    for (let i = 0; i < 7; i++) suma += arrCI[i] * factores[i];
    const digitoVerificadorCalculado = (10 - (suma % 10)) % 10;
    return digitoVerificadorCalculado === arrCI[7];
}

async function procesarCI() {
    const cedula = document.getElementById('auth-cedula').value.trim();
    if (!validarCI(cedula)) return showToast("Cédula uruguaya inválida", "error");

    try {
        const res = await fetch(`${API_URL}/auth/check-ci/${cedula}`);
        const data = await res.json();

        if (data.exists && data.hasPasskey) {
            prepararPaso2(cedula, "login");
        } else if (data.exists && !data.hasPasskey) {
            showToast("Vimos que existes, pero necesitas enrolar tu biometría.", "info");
            document.getElementById('auth-name-group').style.display = 'block';
            document.getElementById('auth-nombre').value = data.nombre;
            document.getElementById('btn-auth-next').onclick = () => prepararPaso2(cedula, "register");
        } else {
            showToast("Primera vez en Voz Ciudadana. ¡Bienvenido!", "info");
            document.getElementById('auth-name-group').style.display = 'block';
            document.getElementById('btn-auth-next').onclick = () => {
                const nombre = document.getElementById('auth-nombre').value.trim();
                if (!nombre) return showToast("Dinos tu nombre para continuar", "error");
                prepararPaso2(cedula, "register", nombre);
            };
        }
    } catch (e) {
        showToast("Error al verificar identidad", "error");
    }
}

function prepararPaso2(cedula, modo, nombre = "") {
    document.getElementById('auth-step-1').style.display = 'none';
    document.getElementById('auth-step-2').style.display = 'block';

    const btn = document.getElementById('btn-biometric');
    if (modo === 'register') {
        btn.onclick = () => iniciarRegistroBiometrico(cedula, nombre);
        btn.innerText = "Registrar Huella/Cara";
    } else {
        btn.onclick = () => iniciarLoginBiometrico(cedula);
        btn.innerText = "Usar Mi Huella/Cara";
    }
}

async function iniciarRegistroBiometrico(cedula, nombre) {
    try {
        const resOptions = await fetch(`${API_URL}/auth/register-options`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cedula, nombre })
        });
        const options = await resOptions.json();

        // startRegistration es parte de @simplewebauthn/browser (umd bundle)
        const attestation = await SimpleWebAuthnBrowser.startRegistration(options);

        const resVerify = await fetch(`${API_URL}/auth/register-verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cedula, nombre, body: attestation })
        });
        const data = await resVerify.json();

        if (data.verified) {
            loginExitoso(data.user);
            showToast("¡Identidad Ciudadana Creada!", "success");
        } else {
            showToast("Fallo al crear la llave de seguridad", "error");
        }
    } catch (e) {
        console.error(e);
        showToast("Biometría cancelada o no soportada", "error");
    }
}

async function iniciarLoginBiometrico(cedula) {
    try {
        const resOptions = await fetch(`${API_URL}/auth/login-options`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cedula })
        });
        const options = await resOptions.json();

        const assertion = await SimpleWebAuthnBrowser.startAuthentication(options);

        const resVerify = await fetch(`${API_URL}/auth/login-verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cedula, body: assertion })
        });
        const data = await resVerify.json();

        if (data.verified) {
            loginExitoso(data.user);
            showToast("Bienvenido de vuelta", "success");
        } else {
            showToast("Verificación de identidad fallida", "error");
        }
    } catch (e) {
        console.error(e);
        showToast("Error en biometría", "error");
    }
}

function loginExitoso(user) {
    currentUser = user;
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    cerrarAuth();
    actualizarInterfazUsuario();
    cargarPublicaciones();
}

// Eliminadas funciones de código por email

function logout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    location.reload();
}

function actualizarInterfazUsuario() {
    const authZone = document.getElementById('auth-zone');
    if (!authZone) return;

    if (currentUser) {
        const avatarSrc = currentUser.foto_perfil || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.nombre)}&background=random`;
        authZone.innerHTML = `
            <div class="user-profile-nav" onclick="abrirPerfil()" style="cursor:pointer; display:flex; align-items:center; gap:10px;">
                <img src="${avatarSrc}" class="user-avatar-sm" style="width:36px; height:36px; border-radius:50%; object-fit:cover; border:2px solid var(--primary);">
                <span>${currentUser.insignia || '🌱'} ${currentUser.nombre}</span>
            </div>
            <button class="btn-logout" onclick="logout()" style="margin-left:10px;">Salir</button>
        `;

        if (currentUser.rol === 'admin') {
            document.body.classList.add('is-admin');
        }
    } else {
        authZone.innerHTML = `
            <button class="btn-login" onclick="abrirAuth()">Ingreso / Registro</button>
        `;
    }
}

// Perfil Profesional
function abrirPerfil() {
    if (!currentUser) return;
    document.getElementById('profile-name').value = currentUser.nombre || '';
    document.getElementById('profile-email').value = currentUser.cedula || ''; // Mostramos cédula en el campo bloqueado
    document.getElementById('profile-dept').value = currentUser.departamento || '';

    // Mostrar foto actual o inicial de nombre
    const preview = document.getElementById('profile-preview');
    if (currentUser.foto_perfil) {
        preview.src = currentUser.foto_perfil;
        document.getElementById('btn-delete-pfp').style.display = 'block';
    } else {
        preview.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.nombre)}&background=random`;
        document.getElementById('btn-delete-pfp').style.display = 'none';
    }

    // Actualizar sección de nivel y XP
    if (currentUser.nivel || currentUser.xpActual !== undefined) {
        document.getElementById('profile-insignia').textContent = currentUser.insignia || '🌱';
        document.getElementById('profile-nivel-nombre').textContent = currentUser.nombre_nivel || currentUser.nombre || 'Ciudadano Novato';
        document.getElementById('profile-nivel-num').textContent = currentUser.nivel || 1;
        document.getElementById('profile-xp-actual').textContent = currentUser.xpActual || 0;
        document.getElementById('profile-xp-siguiente').textContent = currentUser.xpSiguiente || 40;
        document.getElementById('profile-xp-bar').style.width = (currentUser.progreso || 0) + '%';
    }

    // Estado Verificación CI
    const statusBox = document.getElementById('verify-status-box');
    const prompt = document.getElementById('verify-prompt');
    const success = document.getElementById('verify-success');

    if (currentUser.ci_verified) {
        prompt.style.display = 'none';
        success.style.display = 'block';
        statusBox.className = 'status-box-verified';
    } else {
        prompt.style.display = 'block';
        success.style.display = 'none';
        statusBox.className = 'status-box-pending';
    }

    const modal = document.getElementById('profileModal');
    modal.style.display = 'block';
}

let cropper = null;

function initCropper(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const image = document.getElementById('cropper-image');
            image.src = e.target.result;

            document.getElementById('cropperModal').style.display = 'block';

            if (cropper) cropper.destroy();

            cropper = new Cropper(image, {
                aspectRatio: 1,
                viewMode: 1,
                guides: true,
                center: true,
                highlight: false,
                cropBoxMovable: true,
                cropBoxResizable: true,
                toggleDragModeOnDblclick: false,
            });
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function cerrarCropper() {
    document.getElementById('cropperModal').style.display = 'none';
    if (cropper) cropper.destroy();
    document.getElementById('profile-file').value = ''; // Reset input
}

function recortarYGuardar() {
    if (!cropper) return;

    const canvas = cropper.getCroppedCanvas({
        width: 400,
        height: 400
    });

    document.getElementById('profile-preview').src = canvas.toDataURL('image/jpeg', 0.8);
    document.getElementById('btn-delete-pfp').style.display = 'block';
    cerrarCropper();
}

let fotoEliminadaFlag = false;

function eliminarFotoPerfil() {
    const defaultImg = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.nombre)}&background=random`;
    document.getElementById('profile-preview').src = defaultImg;
    document.getElementById('btn-delete-pfp').style.display = 'none';
    fotoEliminadaFlag = true;
}

function cerrarProfile() {
    document.getElementById('profileModal').style.display = 'none';
}

function previewProfileImage(input) {
    // Esta función ahora solo llama a initCropper
    initCropper(input);
}

async function guardarPerfil() {
    const nuevoNombre = document.getElementById('profile-name').value.trim();
    const nuevoDepto = document.getElementById('profile-dept').value;

    console.log("=== GUARDANDO PERFIL ===");
    console.log("Nombre:", nuevoNombre);
    console.log("Departamento:", nuevoDepto);

    if (!nuevoNombre) return showToast("El nombre no puede estar vacío", "error");

    const imgPreview = document.getElementById('profile-preview').src;
    const dataFoto = imgPreview.startsWith('data:') ? imgPreview : null;

    console.log("Tiene foto nueva:", !!dataFoto);
    console.log("Eliminar foto:", fotoEliminadaFlag);

    const payload = {
        cedula: currentUser.cedula,
        nombre: nuevoNombre,
        departamento: nuevoDepto,
        foto: dataFoto,
        eliminarFoto: fotoEliminadaFlag
    };

    console.log("Payload a enviar:", { ...payload, foto: payload.foto ? '(base64)' : null });

    try {
        const res = await fetch(`${API_URL}/user/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        console.log("Respuesta HTTP:", res.status);

        const data = await res.json();
        console.log("Datos recibidos:", data);

        if (data.success && data.user) {
            console.log("Usuario actualizado:", data.user);
            currentUser = data.user;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            fotoEliminadaFlag = false;
            actualizarInterfazUsuario();
            cerrarProfile();
            showToast("Perfil Actualizado", "success");
            cargarPublicaciones();
        } else {
            console.error("Error en respuesta:", data);
            showToast(data.error || "Error al guardar", "error");
        }
    } catch (e) {
        console.error("Error de red:", e);
        showToast("Error al guardar perfil", "error");
    }
}

async function procesarVerificacionCI(input) {
    if (!input.files || !input.files[0]) return;

    const file = input.files[0];
    const loading = document.getElementById('verify-loading');
    const prompt = document.getElementById('verify-prompt');

    loading.style.display = 'block';
    prompt.style.display = 'none';

    try {
        // Tesseract OCR Procesamiento
        const { data: { text } } = await Tesseract.recognize(file, 'spa', {
            logger: m => console.log("[OCR]", m.status, Math.round(m.progress * 100) + "%")
        });

        console.log("Texto extraído:", text);

        // Limpiar la cédula para comparar (quitar puntos y guiones)
        const ciLimpia = currentUser.cedula.replace(/\D/g, '');
        const textoLimpio = text.replace(/\D/g, '');

        if (textoLimpio.includes(ciLimpia)) {
            // ¡ÉXITO LOCAL! Ahora enviar al backend para persistir y marcar como verificado
            showToast("OCR: Cédula detectada correctamente.", "success");

            // Convertir a base64 para envío
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64 = reader.result;
                const res = await fetch(`${API_URL}/user/verify-ci`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ cedula: currentUser.cedula, fotoCI: base64 })
                });
                const data = await res.json();

                if (data.success) {
                    currentUser.ci_verified = 1;
                    localStorage.setItem('currentUser', JSON.stringify(currentUser));
                    loading.style.display = 'none';
                    document.getElementById('verify-success').style.display = 'block';
                    showToast("¡Ya eres Ciudadano Verificado!", "success");
                    actualizarInterfazUsuario();
                } else {
                    throw new Error(data.error);
                }
            };
            reader.readAsDataURL(file);
        } else {
            loading.style.display = 'none';
            prompt.style.display = 'block';
            showToast("No pudimos leer tu cédula claramente. Intenta con más luz.", "error");
        }
    } catch (e) {
        console.error(e);
        loading.style.display = 'none';
        prompt.style.display = 'block';
        showToast("Error en el escaneo: " + e.message, "error");
    }
}


// =========================================
// 2. PUBLICACIONES (API)
// =========================================

async function cargarPublicaciones() {
    try {
        const res = await fetch(`${API_URL}/posts`);
        publicaciones = await res.json();
        actualizarFeed();
    } catch (e) {
        console.error("Error cargando posts", e);
        document.getElementById('feed-container').innerHTML = '<p style="text-align:center">Error de conexión con el servidor.</p>';
    }
}

function abrirModal(tipo) {
    if (!currentUser) {
        showToast("Debes iniciar sesión para publicar.", "warning");
        abrirAuth();
        return;
    }
    if (!currentUser.ci_verified) {
        showToast("Debes verificar tu identidad con tu Cédula para publicar.", "warning");
        abrirPerfil();
        return;
    }
    document.getElementById('post-type').value = tipo;
    document.getElementById('modal-title').innerText = `Publicar ${tipo}`;
    const modal = document.getElementById('postModal');
    modal.style.display = 'block';

    // Alerta visual de uso
    const advertencia = document.createElement('div');
    advertencia.className = 'upload-warning';
    advertencia.innerHTML = `
        <div class="warning-box">
            <i class="fas fa-exclamation-triangle"></i>
            <p>Recuerda mantener el respeto. No subas contenido ofensivo, violento o ilegal. Tu cuenta puede ser suspendida.</p>
        </div>
    `;
    // Insertar advertencia antes del form si no existe
    const content = modal.querySelector('.modal-content');
    if (!content.querySelector('.upload-warning')) {
        content.insertBefore(advertencia, content.querySelector('form'));
    }
}

function cerrarModal() {
    document.getElementById('postModal').style.display = 'none';
}

async function guardarPost(e) {
    e.preventDefault();

    const files = document.getElementById('post-files').files;
    let multimedia = [];
    if (files.length > 0) multimedia = await procesarArchivos(files);

    const nuevoPost = {
        tipo: document.getElementById('post-type').value,
        titulo: document.getElementById('post-titulo').value,
        contenido: document.getElementById('post-contenido').value,
        dept: document.getElementById('post-dept').value,
        multimedia: multimedia,
        fecha: new Date().toLocaleDateString(),
        autor: currentUser.nombre,
        cedulaAutor: currentUser.cedula,
        anonimo: document.getElementById('post-anonimo').checked,
        votos: 0,
        estado: 'Pendiente',
        comentarios: []
    };

    try {
        const res = await fetch(`${API_URL}/posts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(nuevoPost)
        });
        const data = await res.json();
        if (data.success) {
            showToast("Publicación creada con éxito", "success");
            cerrarModal();
            e.target.reset();
            cargarPublicaciones();
        }
    } catch (e) {
        showToast("Error al publicar", "error");
    }
}

function actualizarFeed() {
    const container = document.getElementById('feed-container');
    if (!container) return;

    const isAdmin = currentUser && currentUser.rol === 'admin';

    const filtrados = publicaciones.filter(p => {
        const matchDepto = currentDept === 'todos' || p.dept === currentDept;
        const matchCat = currentCategory === 'todas' || p.tipo === currentCategory;
        const esVisible = isAdmin || p.estado !== 'Rechazado';
        return matchDepto && matchCat && esVisible;
    }); // El ordenamiento ya viene del backend

    container.innerHTML = filtrados.length ? '' : '<p style="text-align:center; padding:50px;">No hay publicaciones.</p>';

    filtrados.forEach(p => {
        const esNoticia = p.tipo === 'Noticia';
        const autorNombre = p.anonimo ? "Ciudadano Anónimo" : p.autor;

        const badgeEstado = esNoticia ? '' :
            `<span class="status-badge status-${p.estado.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')}">${p.estado}</span>`;

        let mediaHtml = p.multimedia?.map(m => {
            if (m.tipo.startsWith('image')) return `<img src="${m.data}" class="post-img" loading="lazy">`;
            if (m.tipo.startsWith('video')) return `<video controls class="post-video"><source src="${m.data}"></video>`;
            if (m.tipo.includes('pdf')) return `<a href="${m.data}" download="${m.nombre}" class="pdf-link">📄 PDF: ${m.nombre}</a>`;
            return '';
        }).join('') || '';

        // Verificar si usuario votó
        const userVoted = currentUser && p.votosIds && p.votosIds.includes(currentUser.cedula);

        // Formateo de fecha seguro
        let fechaStr = p.fecha;
        try {
            // Asumiendo formato YYYY-MM-DD del backend
            const partes = p.fecha.split('-');
            if (partes.length === 3) {
                fechaStr = `${partes[2]}/${partes[1]}/${partes[0]}`;
            }
        } catch (e) { }

        container.innerHTML += `
            <div class="post ${esNoticia ? 'post-noticia' : ''}">
                <div class="post-main">
                    <div class="vote-section">
                        <button class="vote-btn ${userVoted ? 'active' : ''}" onclick="votarPost(${p.id})">▲</button>
                        <div class="vote-count">${p.votos || 0}</div>
                        
                    </div>
                    <div class="post-content">
                        <div class="post-meta">
                            ${badgeEstado}
                            <span class="post-author"><i class="fas fa-user-circle"></i> ${autorNombre} ${p.ci_verified ? '<i class="fas fa-check-circle" style="color:var(--secondary); font-size:0.8rem;" title="Ciudadano Verificado"></i>' : ''}</span>
                            <small>• ${p.tipo || 'General'} • ${p.dept || 'Uruguay'} • ${fechaStr}</small>
                            ${isAdmin ? `<span class="admin-only" onclick="borrarPost(${p.id})">Borrar</span>` : ''}
                        </div>
                        <h3>${p.titulo}</h3>
                        <p>${p.contenido}</p>
                        <div class="post-media-container">${mediaHtml}</div>
                        ${isAdmin && !esNoticia ? renderAdminSelector(p.id, p.estado) : ''}
                    </div>
                </div>
                <div class="comment-section">
                    <div id="coms-${p.id}">${renderComentarios(p.comentarios || [], p.id)}</div>
                    <div class="comment-form">
                        <input type="text" placeholder="${currentUser ? 'Escribe un comentario...' : 'Inicia sesión para comentar'}" 
                               class="comment-input"
                               ${!currentUser ? 'disabled onclick="abrirAuth()"' : ''}
                               onkeydown="if(event.key==='Enter') comentar(${p.id}, this)">
                        <button class="btn-send-comment" onclick="comentar(${p.id}, this.previousElementSibling)"><i class="fas fa-paper-plane"></i></button>
                    </div>
                </div>
            </div>`;
    });
}

// =========================================
// 3. COMENTARIOS Y VOTOS
// =========================================

async function votarPost(id) {
    if (!currentUser) {
        showToast("Debes iniciar sesión para votar", "warning");
        return abrirAuth();
    }
    if (!currentUser.ci_verified) {
        showToast("Debes verificar tu identidad para votar.", "warning");
        return abrirPerfil();
    }

    try {
        const res = await fetch(`${API_URL}/posts/${id}/vote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cedula: currentUser.cedula })
        });
        const data = await res.json();
        if (data.success) {
            cargarPublicaciones(); // Recargar para actualizar orden y UI
        }
    } catch (e) {
        showToast("Error al votar", "error");
    }
}

async function comentar(postId, inputElement) {
    if (!currentUser) {
        showToast("Debes iniciar sesión para comentar", "warning");
        return abrirAuth();
    }

    let texto = inputElement.value.trim();
    const malasPalabras = ["tonto", "idiota", "estupido", "mierda"];
    if (malasPalabras.some(m => texto.toLowerCase().includes(m))) {
        showToast("Lenguaje inapropiado detectado.", "warning");
        texto = texto.replace(new RegExp(malasPalabras.join("|"), "gi"), "****");
    }

    if (!texto) return;

    try {
        const res = await fetch(`${API_URL}/posts/${postId}/comment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ texto, autor: currentUser.nombre, cedula: currentUser.cedula })
        });
        if ((await res.json()).success) {
            inputElement.value = '';
            cargarPublicaciones();
        }
    } catch (e) {
        showToast("Error al comentar", "error");
    }
}

async function votarComentario(postId, comId) {
    if (!currentUser) return showToast("Debes iniciar sesión para votar", "warning");

    try {
        const res = await fetch(`${API_URL}/posts/${postId}/comment/${comId}/vote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cedula: currentUser.cedula })
        });
        if ((await res.json()).success) {
            cargarPublicaciones();
        }
    } catch (e) { console.error(e); }
}

async function responder(postId, comId, containerId) {
    if (!currentUser) return showToast("Inicia sesión para responder", "warning");

    // Buscamos el input dentro del contenedor
    const container = document.getElementById(containerId);
    const input = container.querySelector('input');
    const texto = input.value.trim();

    if (!texto) return;

    try {
        const res = await fetch(`${API_URL}/posts/${postId}/comment/${comId}/reply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ texto, autor: currentUser.nombre, email: currentUser.email })
        });
        if ((await res.json()).success) {
            input.value = ''; // Limpiar input
            // Ocultar caja de respuesta
            container.style.display = 'none';
            cargarPublicaciones();
        }
    } catch (e) { showToast("Error al responder", "error"); }
}

function toggleReply(id) {
    const el = document.getElementById(id);
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
    if (el.style.display === 'block') el.querySelector('input').focus();
}

// --- LOGICA HOVER CARD (TOOLTIP) ---
function showUserCard(event, nombre, foto, rol, depto, nivel, insignia) {
    const card = document.getElementById('user-hover-card');
    const defaultFoto = `https://ui-avatars.com/api/?name=${encodeURIComponent(nombre)}&background=random`;
    const nivelNombre = nivel || 'Ciudadano Novato';
    const nivelInsignia = insignia || '🌱';

    card.innerHTML = `
        <div class="user-card-header">
            <img src="${foto || defaultFoto}" class="user-card-img">
            <h3 class="user-card-name">${nombre}</h3>
            <span class="user-card-role ${rol === 'admin' ? 'admin' : ''}">${rol || 'Usuario'}</span>
        </div>
        <div class="user-card-stats">
            <div class="stat-item">
                <h4><i class="fas fa-location-dot"></i></h4>
                <p>${depto || 'Uruguay'}</p>
            </div>
            <div class="stat-item nivel-badge">
                <h4>${nivelInsignia}</h4>
                <p>${nivelNombre}</p>
            </div>
        </div>
    `;

    // Posicionamiento
    const rect = event.target.getBoundingClientRect();
    card.style.left = `${rect.left + window.scrollX}px`;
    card.style.top = `${rect.top + window.scrollY - card.offsetHeight - 10}px`;

    card.classList.add('show');
}

function hideUserCard() {
    document.getElementById('user-hover-card').classList.remove('show');
}

function renderComentarios(lista, postId) {
    const isAdmin = currentUser && currentUser.rol === 'admin';
    return lista.map((c) => {
        const userVoted = currentUser && c.votosIds && c.votosIds.includes(currentUser.email);
        const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(c.autor)}&background=random`;

        const repliesHtml = c.respuestas ? c.respuestas.map(r => `
            <div class="comment reply" style="display:flex; gap:10px; align-items:flex-start;">
                <img src="${r.foto_perfil || `https://ui-avatars.com/api/?name=${encodeURIComponent(r.autor)}&background=random`}" 
                     class="user-avatar-sm"
                     onmouseenter="showUserCard(event, '${r.autor}', '${r.foto_perfil || ''}', '${r.autor_rol || ''}', '${r.autor_depto || ''}', '${r.autor_nivel || ''}', '${r.autor_insignia || ''}')"
                     onmouseleave="hideUserCard()">
                <div><b>${r.autor}:</b> ${r.texto}</div>
            </div>
        `).join('') : '';

        return `
        <div class="comment">
            <div style="display:flex; justify-content:space-between; align-items:start;">
                <div style="display:flex; gap:12px;">
                    <img src="${c.autor_foto || defaultAvatar}" 
                         class="user-avatar"
                         onmouseenter="showUserCard(event, '${c.autor}', '${c.autor_foto || ''}', '${c.autor_rol || ''}', '${c.autor_depto || ''}', '${c.autor_nivel || ''}', '${c.autor_insignia || ''}')"
                         onmouseleave="hideUserCard()">
                    <div>
                        <b onmouseenter="showUserCard(event, '${c.autor}', '${c.autor_foto || ''}', '${c.autor_rol || ''}', '${c.autor_depto || ''}', '${c.autor_nivel || ''}', '${c.autor_insignia || ''}')" 
                           onmouseleave="hideUserCard()" 
                           style="cursor:pointer">${c.autor}:</b> 
                        <span class="comment-text">${c.texto}</span>
                    </div>
                </div>
                <div style="display:flex; gap:10px; align-items:center;">
                   <div class="comment-votes">
                        <small>${c.votos || 0}</small>
                        <i class="fas fa-heart" style="cursor:pointer; color: ${userVoted ? 'red' : '#ccc'}" onclick="votarComentario(${postId}, ${c.id})"></i>
                   </div>
                   ${isAdmin ? `<button onclick="borrarCom(${postId}, ${c.id})" class="text-danger" style="background:none; border:none; color:red; cursor:pointer; font-size:1.2rem;">&times;</button>` : ''}
                </div>
            </div>
            
            <button class="reply-btn" style="margin-left:52px;" onclick="toggleReply('reply-box-${c.id}')">Responder</button>
            <div id="reply-box-${c.id}" style="display:none; margin-top:5px; margin-left:52px;">
                <div style="display:flex; gap:5px;">
                    <input type="text" placeholder="Escribe una respuesta..." style="flex:1; padding:8px 15px; border-radius:20px; border:1px solid #ddd;">
                    <button class="btn-send-comment" onclick="responder(${postId}, ${c.id}, 'reply-box-${c.id}')"><i class="fas fa-check"></i></button>
                </div>
            </div>

            <div class="replies-container" style="margin-left:52px;">
                ${repliesHtml}
            </div>
        </div>
    `}).join('');
}


// =========================================
// 4. UTILIDADES (TOAST, ARCHIVOS, ETC)
// =========================================

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-times-circle' : 'fa-info-circle'}"></i>
        <span>${message}</span>
    `;
    container.appendChild(toast);

    // Animación entrada
    setTimeout(() => toast.classList.add('show'), 10);

    // Salida
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function cambiarDepartamento() {
    currentDept = document.getElementById('main-dept-filter').value;
    actualizarFeed();
}

function filtrarCategoria(cat) {
    currentCategory = cat;
    document.querySelectorAll('.cat-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.cat === cat);
    });
    actualizarFeed();
}

async function procesarArchivos(files) {
    return await Promise.all(Array.from(files).map(file => {
        return new Promise(resolve => {
            const reader = new FileReader();
            reader.onload = (e) => resolve({ nombre: file.name, tipo: file.type, data: e.target.result });
            reader.readAsDataURL(file);
        });
    }));
}

// --- ADMIN Y UTILIDADES AVANZADAS ---

async function cambiarEstado(id, nuevo) {
    try {
        await fetch(`${API_URL}/posts/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estado: nuevo })
        });
        showToast("Estado actualizado", "success");
        cargarPublicaciones();
    } catch (e) { console.error(e); }
}

// NUEVO: Modal de Confirmación Genérico
let confirmAction = null;

function abrirConfirm(titulo, msg, action) {
    document.getElementById('confirm-title').innerText = titulo;
    document.getElementById('confirm-msg').innerText = msg;
    confirmAction = action;

    const modal = document.getElementById('confirmModal');
    modal.style.display = 'block';
    setTimeout(() => modal.classList.add('show'), 10);

    // Configurar botón SI
    const btnYes = document.getElementById('confirm-btn-yes');
    btnYes.onclick = () => {
        if (confirmAction) confirmAction();
        cerrarConfirm();
    };
}

function cerrarConfirm() {
    confirmAction = null;
    const modal = document.getElementById('confirmModal');
    modal.classList.remove('show');
    setTimeout(() => modal.style.display = 'none', 300);
}

// Borrar Post con Modal
function borrarPost(id) {
    abrirConfirm(
        "¿Eliminar Publicación?",
        "Se borrará la propuesta y todos sus comentarios permanentemente.",
        async () => {
            try {
                await fetch(`${API_URL}/posts/${id}`, { method: 'DELETE' });
                showToast("Publicación eliminada", "success");
                cargarPublicaciones();
            } catch (e) { showToast("Error al eliminar", "error"); }
        }
    );
}

// Borrar Comentario con Modal (NUEVO)
function borrarCom(pId, cId) {
    abrirConfirm(
        "¿Eliminar Comentario?",
        "Esta acción es irreversible.",
        async () => {
            try {
                await fetch(`${API_URL}/posts/${pId}/comment/${cId}`, { method: 'DELETE' });
                showToast("Comentario eliminado", "success");
                cargarPublicaciones();
            } catch (e) { showToast("Error al eliminar comentario", "error"); }
        }
    );
}

function renderAdminSelector(id, estadoActual) {
    const estados = ["Pendiente", "En Revisión", "Completado", "Rechazado"];
    return `
        <div style="margin-top:15px; padding-top:10px; border-top:1px dashed #ccc;">
            <small><b>GESTIÓN ADMIN:</b></small><br>
            <select onchange="cambiarEstado(${id}, this.value)" style="padding:5px; margin-top:5px; border-radius:5px;">
                ${estados.map(e => `<option value="${e}" ${e === estadoActual ? 'selected' : ''}>${e}</option>`).join('')}
            </select>
        </div>`;
}

// CERRAR MODALES AL CLIC FUERA (GLOBAL)
window.onclick = function (event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('show');
        setTimeout(() => event.target.style.display = 'none', 300);
    }
}

// --- AJUSTE FEED PARA BADGES CORRECTOS ---

function getStatusClass(estado) {
    const map = {
        'Pendiente': 'status-pendiente',
        'En Revisión': 'status-en-revision',
        'Completado': 'status-completado',
        'Rechazado': 'status-rechazado'
    };
    return map[estado] || 'status-pendiente';
}

function actualizarFeed() {
    const container = document.getElementById('feed-container');
    if (!container) return;

    const isAdmin = currentUser && currentUser.rol === 'admin';

    // Normalizar datos para evitar inconsistencias
    const publicacionesNormalizadas = publicaciones.map(p => ({
        ...p,
        dept: p.dept || p.departamento || 'Uruguay', // Fallback robusto
        tipo: p.tipo || 'General',
        fecha: p.fecha || 'Fecha desconocida'
    }));

    const filtrados = publicacionesNormalizadas.filter(p => {
        const matchDepto = currentDept === 'todos' || p.dept === currentDept;
        const matchCat = currentCategory === 'todas' || p.tipo === currentCategory;
        const esVisible = isAdmin || p.estado !== 'Rechazado';
        return matchDepto && matchCat && esVisible;
    });

    container.innerHTML = filtrados.length ? '' : '<p style="text-align:center; padding:50px;">No hay publicaciones disponibles.</p>';

    filtrados.forEach(p => {
        const esNoticia = p.tipo === 'Noticia';
        const autorNombre = p.anonimo ? "Ciudadano Anónimo" : p.autor;

        // Badge Estado
        // CORRECCIÓN COLOR BADGE ESTADO
        const badgeClass = getStatusClass(p.estado);
        const statusPill = esNoticia ? '' : `<span class="status-pill ${badgeClass}">Estado: ${p.estado}</span>`;

        // Multimedia
        let mediaHtml = p.multimedia?.map(m => {
            if (m.tipo.startsWith('image')) return `<img src="${m.data}" class="post-img" loading="lazy">`;
            if (m.tipo.startsWith('video')) return `<video controls class="post-video"><source src="${m.data}"></video>`;
            if (m.tipo.includes('pdf')) return `<a href="${m.data}" download="${m.nombre}" class="pdf-link">📄 PDF: ${m.nombre}</a>`;
            return '';
        }).join('') || '';

        const userVoted = currentUser && p.votosIds && p.votosIds.includes(currentUser.email);

        // Formateo de fecha DD/MM/YYYY
        let fechaStr = p.fecha;
        try {
            if (p.fecha.includes('-')) {
                const parts = p.fecha.split('-'); // YYYY-MM-DD
                if (parts.length === 3) fechaStr = `${parts[2]}/${parts[1]}/${parts[0]}`;
            }
        } catch (e) { }

        // Renderizado Final
        // Layout: [Votos] [Contenido]

        container.innerHTML += `
            <div class="post type-${p.tipo || 'General'}">
                <div class="post-layout">
                    <!-- Columna Izquierda: Votos -->
                    <div class="vote-column">
                         <button class="vote-btn-vertical ${userVoted ? 'active' : ''}" onclick="votarPost(${p.id})">
                            <i class="fas fa-caret-up"></i>
                         </button>
                         <span class="vote-count-vertical">${p.votos || 0}</span>
                    </div>

                    <!-- Columna Derecha: Contenido Principal -->
                    <div class="post-main-content">
                        
                        <!-- Header Fila: Badge | Meta Info | Estado -->
                        <div class="post-header-row">
                            <div class="post-meta-group">
                                <span class="type-badge ${p.tipo || 'General'}">${p.tipo || 'General'}</span>
                                <span class="meta-divider">|</span>
                                <div style="display:flex; align-items:center; gap:8px;">
                                    <img src="${p.autor_foto || `https://ui-avatars.com/api/?name=${encodeURIComponent(autorNombre)}&background=random`}" 
                                         class="user-avatar-sm"
                                         onmouseenter="showUserCard(event, '${autorNombre}', '${p.autor_foto || ''}', '${p.autor_rol || ''}', '${p.autor_depto || ''}', '${p.autor_nivel || ''}', '${p.autor_insignia || ''}')"
                                         onmouseleave="hideUserCard()">
                                    <span class="post-author" 
                                          onmouseenter="showUserCard(event, '${autorNombre}', '${p.autor_foto || ''}', '${p.autor_rol || ''}', '${p.autor_depto || ''}', '${p.autor_nivel || ''}', '${p.autor_insignia || ''}')"
                                          onmouseleave="hideUserCard()"
                                          style="cursor:pointer">${autorNombre}</span>
                                </div>
                                <span class="meta-dot">•</span>
                                <span class="post-dept">${p.dept}</span>
                                <span class="meta-dot">•</span>
                                <span class="post-date">${fechaStr}</span>
                            </div>
                            
                            <!-- Estado a la derecha -->
                            ${statusPill}
                        </div>

                        <h3 class="post-title">${p.titulo}</h3>
                        <p class="post-body">${p.contenido}</p>
                        
                        <div class="post-media-container">${mediaHtml}</div>
                        
                        ${isAdmin ? `<div style="margin-top:10px; text-align:right;"><small class="text-danger" style="cursor:pointer" onclick="borrarPost(${p.id})">eliminar publicación</small></div>` : ''}
                        ${isAdmin && !esNoticia ? renderAdminSelector(p.id, p.estado) : ''}
                        
                        <!-- Sección de Comentarios -->
                        <div class="comment-section">
                            <h4 style="margin-bottom:15px; color:#444; font-size:1rem;">Comentarios</h4>
                            <div id="coms-${p.id}">${renderComentarios(p.comentarios || [], p.id)}</div>
                            
                            <div class="comment-input-container">
                                <input type="text" placeholder="${currentUser ? 'Escribe un comentario...' : 'Inicia sesión para comentar'}" 
                                    class="comment-input"
                                    ${!currentUser ? 'disabled onclick="abrirAuth()"' : ''}
                                    onkeydown="if(event.key==='Enter') comentar(${p.id}, this)">
                                <button class="btn-send-round" onclick="comentar(${p.id}, this.previousElementSibling)"><i class="fas fa-paper-plane"></i></button>
                            </div>
                        </div>

                    </div>
                </div>
            </div>`;
    });
}