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
            // Convertir archivos a Base64
            const mediaPromises = Array.from(mediaFiles).map(file => {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve({
                        tipo: file.type.startsWith('video/') ? 'video' : 'image', // Simplificado
                        data: reader.result
                    });
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
            });

            const multimedia = await Promise.all(mediaPromises);

            const payload = {
                tipo,
                titulo,
                contenido,
                dept: departamento,
                departamento: departamento,
                autor: currentUser.nombre,
                cedulaAutor: currentUser.cedula,
                email_autor: currentUser.email, // Updated to match server expectation if needed
                autor_rol: currentUser.rol || 'ciudadano',
                anonimo,
                multimedia
            };

            const res = await fetch('/api/posts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                alert("Publicación creada con éxito");
                onClose();
                window.location.reload();
            } else {
                const err = await res.json();
                alert("Error al crear publicación: " + (err.error || "Desconocido"));
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
                            <option value="Artigas">Artigas</option>
                            <option value="Canelones">Canelones</option>
                            <option value="Cerro Largo">Cerro Largo</option>
                            <option value="Colonia">Colonia</option>
                            <option value="Durazno">Durazno</option>
                            <option value="Flores">Flores</option>
                            <option value="Florida">Florida</option>
                            <option value="Lavalleja">Lavalleja</option>
                            <option value="Maldonado">Maldonado</option>
                            <option value="Montevideo">Montevideo</option>
                            <option value="Paysandú">Paysandú</option>
                            <option value="Río Negro">Río Negro</option>
                            <option value="Rivera">Rivera</option>
                            <option value="Rocha">Rocha</option>
                            <option value="Salto">Salto</option>
                            <option value="San José">San José</option>
                            <option value="Soriano">Soriano</option>
                            <option value="Tacuarembó">Tacuarembó</option>
                            <option value="Treinta y Tres">Treinta y Tres</option>
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
