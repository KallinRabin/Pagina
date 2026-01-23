import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function PostCard({ post }) {
    const { currentUser } = useAuth();
    const [votos, setVotos] = useState(post.votos || 0);
    const [hasVoted, setHasVoted] = useState(false); // Validacioón simple local
    const [showComments, setShowComments] = useState(false);
    const [comments, setComments] = useState(post.comentarios || []);
    const [newComment, setNewComment] = useState("");

    const handleVote = async (increment) => {
        if (!currentUser) return alert("Inicia sesión para votar");
        // Optimistic UI
        setVotos(votos + increment);
        setHasVoted(true); // Bloqueo simple por sesión

        try {
            await fetch(`/api/posts/${post.id}/vote`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ voto: increment, usuario: currentUser.email })
            });
        } catch (e) {
            console.error("Error votando", e);
            setVotos(votos - increment); // Rollback
        }
    };

    const renderMedia = () => {
        if (!post.media_urls || post.media_urls.length === 0) return null;

        // Convertir string JSON a array si es necesario (el backend a veces devuelve string)
        let mediaList = [];
        try {
            mediaList = typeof post.media_urls === 'string' ? JSON.parse(post.media_urls) : post.media_urls;
        } catch (e) {
            // Fallback si viene como string simple separado por comas o url única
            if (typeof post.media_urls === 'string') mediaList = [post.media_urls];
        }

        if (!Array.isArray(mediaList)) return null;

        return (
            <div className="post-media-container">
                {mediaList.map((url, idx) => {
                    const lowerUrl = url.toLowerCase();
                    const cleanUrl = url.startsWith('http') ? url : `/uploads/${url}`; // Fix path relativo

                    if (lowerUrl.endsWith('.mp4') || lowerUrl.endsWith('.webm')) {
                        return <video key={idx} src={cleanUrl} controls className="post-video" />;
                    } else if (lowerUrl.endsWith('.pdf')) {
                        return (
                            <a key={idx} href={cleanUrl} target="_blank" className="pdf-link">
                                <i className="fas fa-file-pdf" style={{ fontSize: '1.5rem', color: '#dc3545' }}></i>
                                Ver Documento PDF adjunto
                            </a>
                        );
                    } else {
                        return <img key={idx} src={cleanUrl} className="post-img" alt="Media" loading="lazy" />;
                    }
                })}
            </div>
        );
    };

    const handleDelete = async () => {
        if (!window.confirm("¿Seguro que quieres eliminar este post? Esta acción es irreversible.")) return;

        try {
            const res = await fetch(`/api/posts/${post.id}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                alert("Post eliminado");
                window.location.reload();
            } else {
                alert("Error eliminando post");
            }
        } catch (e) {
            console.error(e);
            alert("Error de conexión");
        }
    };

    return (
        <div className={`post type-${post.tipo || 'General'}`}>
            <div className="post-layout">
                {/* Columna Votos */}
                <div className="vote-column">
                    <button className="vote-btn-vertical" onClick={() => handleVote(1)}>
                        <i className="fas fa-caret-up"></i>
                    </button>
                    <div className="vote-count-vertical">{votos}</div>
                    <button className="vote-btn-vertical" onClick={() => handleVote(-1)}>
                        <i className="fas fa-caret-down"></i>
                    </button>
                </div>

                {/* Contenido Principal */}
                <div className="post-main-content">
                    <div className="post-header-row">
                        <div className="post-meta-group">
                            <span className={`type-badge ${post.tipo || 'General'}`}>{post.tipo || 'General'}</span>
                            <span className="meta-divider">|</span>
                            <span className="post-author">
                                {post.anonimo ? "Ciudadano Anónimo" : post.autor}
                            </span>
                            {/* Badges de Gamificación (Si existen) */}
                            {post.autor_nivel && (
                                <span className="status-badge" style={{ background: '#6c5ce7', fontSize: '0.7rem', marginLeft: 5 }}>
                                    {post.autor_insignia || 'Nivel ' + post.autor_nivel}
                                </span>
                            )}
                            <span className="meta-dot">•</span>
                            <span className="post-dept">{post.departamento}</span>
                        </div>

                        {/* Status Pill */}
                        {post.estado && (
                            <span className={`status-pill status-${post.estado.toLowerCase().replace(' ', '-')}`}>
                                {post.estado}
                            </span>
                        )}
                    </div>

                    <h3 className="post-title">{post.titulo}</h3>
                    <p className="post-body">{post.contenido}</p>

                    {renderMedia()}

                    {/* Footer Acciones */}
                    <div style={{ display: 'flex', gap: 15, marginTop: 15, color: '#666', fontSize: '0.9rem' }}>
                        <span onClick={() => setShowComments(!showComments)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                            <i className="far fa-comment-alt"></i> {comments.length} Comentarios
                        </span>
                        <span style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                            <i className="fas fa-share"></i> Compartir
                        </span>
                        {currentUser?.rol === 'admin' && (
                            <span onClick={handleDelete} style={{ color: 'red', cursor: 'pointer', marginLeft: 'auto' }} title="Eliminar como Admin">
                                <i className="fas fa-trash"></i>
                            </span>
                        )}
                    </div>

                    {/* Sección Comentarios */}
                    {showComments && (
                        <div className="comment-section" style={{ marginTop: 15, background: '#f9f9f9', padding: 15, borderRadius: 8 }}>
                            {comments.map((c, i) => (
                                <div key={i} className="comment">
                                    <b>{c.autor || c.usuario}:</b> {c.texto || c.contenido}
                                </div>
                            ))}
                            {comments.length === 0 && <p style={{ fontStyle: 'italic', opacity: 0.6 }}>Sé el primero en comentar.</p>}

                            <div className="comment-form" style={{ marginTop: 10 }}>
                                <input
                                    type="text"
                                    placeholder="Escribe un comentario..."
                                    value={newComment}
                                    onChange={e => setNewComment(e.target.value)}
                                />
                                <button className="btn-send-round">
                                    <i className="fas fa-paper-plane"></i>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
