import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function ProfileModal({ isOpen, onClose }) {
    const { currentUser, login } = useAuth();
    const [nombre, setNombre] = useState('');
    const [departamento, setDepartamento] = useState('');
    const [fotoPreview, setFotoPreview] = useState('');
    const [fotoFile, setFotoFile] = useState(null);
    const [loading, setLoading] = useState(false);

    // Gamificacion placeholders (o data real del user si existe)
    const nivelInfo = currentUser?.nivelInfo || {
        nivel: 1,
        nombre_nivel: 'Ciudadano Novato',
        insignia: '🌱',
        xpActual: 0,
        xpSiguiente: 40,
        progreso: 0
    };

    useEffect(() => {
        if (currentUser) {
            setNombre(currentUser.nombre || '');
            setDepartamento(currentUser.departamento || '');
            setFotoPreview(currentUser.foto_perfil || `https://ui-avatars.com/api/?name=${currentUser.nombre}&background=random`);
        }
    }, [currentUser, isOpen]);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setFotoFile(file);
            // Preview local instantáneo
            const reader = new FileReader();
            reader.onloadend = () => {
                setFotoPreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            let fotoBase64 = null;
            if (fotoFile) {
                // Convertir a Base64 si hay archivo nuevo
                fotoBase64 = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.readAsDataURL(fotoFile);
                });
            } else if (fotoPreview && fotoPreview.startsWith('data:')) {
                // Ya es base64 (casos raros)
                fotoBase64 = fotoPreview;
            }

            const payload = {
                cedula: currentUser.cedula,
                nombre,
                departamento,
                foto: fotoBase64,
                eliminarFoto: false // TODO: BTN eliminar
            };

            const res = await fetch('/api/user/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (data.success) {
                // Actualizar contexto
                login(data.user); // Esto actualiza el estado global y sessionStorage
                alert("Perfil actualizado correctamente");
                onClose();
            } else {
                alert("Error actualizando perfil: " + data.error);
            }

        } catch (e) {
            console.error(e);
            alert("Error de conexión");
        }
        setLoading(false);
    };

    if (!isOpen || !currentUser) return null;

    return (
        <div className="modal show" style={{ display: 'block' }}>
            <div className="modal-content">
                <div style={{ textAlign: 'right' }}>
                    <span style={{ cursor: 'pointer', fontSize: '1.5rem' }} onClick={onClose}>&times;</span>
                </div>

                <h2 style={{ textAlign: 'center', marginBottom: 20 }}>Gestionar Perfil</h2>

                <div style={{ textAlign: 'center', marginBottom: 25, position: 'relative' }}>
                    <img
                        src={fotoPreview}
                        style={{ width: 120, height: 120, borderRadius: '50%', objectFit: 'cover', border: '4px solid #0056b3', margin: '0 auto', display: 'block' }}
                    />

                    <div style={{ marginTop: 15, display: 'flex', justifyContent: 'center', gap: 10 }}>
                        <div style={{ position: 'relative', overflow: 'hidden' }}>
                            <button className="btn-submit" style={{ padding: '8px 15px', borderRadius: 20, fontSize: '0.85rem' }}>
                                <i className="fas fa-camera"></i> Cambiar Foto
                            </button>
                            <input type="file" accept="image/*" onChange={handleFileChange} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
                        </div>
                    </div>
                </div>

                {/* Sección Nivel */}
                <div style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    borderRadius: 12, padding: 20, margin: '15px 0', textAlign: 'center', color: 'white'
                }}>
                    <div style={{ fontSize: '2.5rem' }}>{nivelInfo.insignia}</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', margin: '5px 0' }}>{nivelInfo.nombre_nivel}</div>
                    <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Nivel {nivelInfo.nivel}</div>

                    <div style={{ marginTop: 15 }}>
                        <div style={{ background: 'rgba(255,255,255,0.3)', borderRadius: 10, height: 12, overflow: 'hidden' }}>
                            <div style={{ background: '#fff', height: '100%', width: `${nivelInfo.progreso}%`, transition: 'width 0.5s ease' }}></div>
                        </div>
                        <div style={{ fontSize: '0.8rem', marginTop: 5 }}>
                            {nivelInfo.xpActual} / {nivelInfo.xpSiguiente} XP
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSave}>
                    <div className="input-group">
                        <label>Nombre Público</label>
                        <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} />
                    </div>

                    <div className="input-group">
                        <label>Departamento de Residencia</label>
                        <select value={departamento} onChange={e => setDepartamento(e.target.value)}>
                            <option value="">Selecciona tu departamento</option>
                            <option value="Montevideo">Montevideo</option>
                            <option value="Canelones">Canelones</option>
                            <option value="Maldonado">Maldonado</option>
                            <option value="Rocha">Rocha</option>
                            <option value="Salto">Salto</option>
                            {/* ... Resto */}
                        </select>
                    </div>

                    <div className="modal-footer" style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                        <button type="button" className="btn-cancel" onClick={onClose}>Cancelar</button>
                        <button type="submit" className="btn-submit" disabled={loading}>
                            {loading ? 'Guardando...' : 'Guardar Cambios'}
                        </button>
                    </div>
                </form>

            </div>
        </div>
    );
}
