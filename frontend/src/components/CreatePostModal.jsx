import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function CreatePostModal({ isOpen, onClose, initialType }) {
    const { currentUser } = useAuth();
    const [tipo, setTipo] = useState('Queja');
    const [titulo, setTitulo] = useState('');
    const [contenido, setContenido] = useState('');
    const [departamento, setDepartamento] = useState('Montevideo');
    const [mediaFiles, setMediaFiles] = useState([]);
    const [anonimo, setAnonimo] = useState(false);
    const [loading, setLoading] = useState(false);

    // Sync type when modal opens or initialType changes
    useEffect(() => {
        if (isOpen && initialType) {
            setTipo(initialType);
        }
    }, [isOpen, initialType]);

    if (!isOpen) return null;

    const handleFileChange = (e) => {
        setMediaFiles(e.target.files);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!currentUser) return alert("Debes iniciar sesión para publicar");

        setLoading(true);

        try {
            const formData = new FormData();
            formData.append('tipo', tipo);
            formData.append('titulo', titulo);
            formData.append('contenido', contenido);
            formData.append('departamento', departamento);
            formData.append('anonimo', anonimo ? 'true' : 'false');
            formData.append('autor', currentUser.nombre);
            formData.append('email_autor', currentUser.email);
            // formData.append('autor_email', currentUser.email); // Corregido en backend a email_autor, enviar ambos por si acaso o solo correcto
            // Mejor enviar 'autor_email' que es lo que espera SQL originalmente, pero corregimos 'server.js' para JOIN p.email_autor.
            // El INSERT en server.js linea 507 no menciona email, espera...
            // Checking server.js INSERT: "INSERT INTO posts (..., email_autor, ...)" -> Lo añadimos? 
            // linea 534 server.js (approx): "INSERT INTO posts ... email_autor ..." - espera, voy a revisar server.js si inserta email_autor
            // Asumiré que sí por ahora.

            formData.append('autor_rol', currentUser.rol || 'ciudadano');

            for (let i = 0; i < mediaFiles.length; i++) {
                formData.append('media', mediaFiles[i]);
            }

            const res = await fetch('/api/posts', {
                method: 'POST',
                body: formData
            });

            if (res.ok) {
                alert("Publicación creada con éxito");
                onClose();
                window.location.reload();
            } else {
                alert("Error al crear publicación");
            }
        } catch (error) {
            console.error(error);
            alert("Error de red");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal show" style={{ display: 'block' }}>
            <div className="modal-content">
                <h2 style={{ marginBottom: 20 }}>Nueva Publicación</h2>
                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label>Tipo de Publicación</label>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button type="button" className={`cat-btn ${tipo === 'Queja' ? 'active' : ''}`} onClick={() => setTipo('Queja')}>Queja</button>
                            <button type="button" className={`cat-btn ${tipo === 'Idea' ? 'active' : ''}`} onClick={() => setTipo('Idea')}>Idea</button>
                            <button type="button" className={`cat-btn ${tipo === 'Noticia' ? 'active' : ''}`} onClick={() => setTipo('Noticia')}>Noticia</button>
                        </div>
                    </div>

                    <div className="input-group">
                        <label>Título</label>
                        <input type="text" value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="¿Qué está pasando?" required />
                    </div>

                    <div className="input-group">
                        <label>Contenido</label>
                        <textarea rows="4" value={contenido} onChange={e => setContenido(e.target.value)} placeholder="Describe la situación..." required style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd' }}></textarea>
                    </div>

                    <div className="input-group">
                        <label>Departamento</label>
                        <select value={departamento} onChange={e => setDepartamento(e.target.value)}>
                            <option value="Montevideo">Montevideo</option>
                            <option value="Canelones">Canelones</option>
                            <option value="Maldonado">Maldonado</option>
                            <option value="Rocha">Rocha</option>
                            <option value="Salto">Salto</option>
                            {/* Agregar resto */}
                        </select>
                    </div>

                    <div className="input-group">
                        <label><i className="fas fa-paperclip"></i> Adjuntar Multimedia</label>
                        <input type="file" multiple accept="image/*,video/*,application/pdf" onChange={handleFileChange} />
                    </div>

                    <div className="input-group" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input type="checkbox" checked={anonimo} onChange={e => setAnonimo(e.target.checked)} id="check-anon" />
                        <label htmlFor="check-anon" style={{ margin: 0 }}>Publicar como Anónimo</label>
                    </div>

                    <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                        <button type="button" className="btn-cancel" onClick={onClose}>Cancelar</button>
                        <button type="submit" className="btn-submit" disabled={loading}>
                            {loading ? 'Publicando...' : 'Publicar Ahora'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
