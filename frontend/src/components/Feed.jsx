import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Feed() {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const { currentUser } = useAuth();

    // Polling / Auto-Sync Logic (From Phase 4 & 5)
    useEffect(() => {
        const fetchPosts = async () => {
            try {
                const res = await fetch('/api/posts');
                const data = await res.json();

                // Simple Set for now, Deep Diff can be added later or here
                // React's state update batching handles simple diffs efficiently enough for now
                setPosts(data);
                setLoading(false);
            } catch (e) {
                console.error("Error fetching posts:", e);
            }
        };

        fetchPosts(); // Initial Load

        const interval = setInterval(() => {
            // Basic Polling - Todo: Implement hybrid sync check (scroll)
            // For now, let's just fetch silently
            fetchPosts();
        }, 4000);

        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return <div style={{ textAlign: 'center', padding: '40px' }}><i className="fas fa-spinner fa-spin"></i> Cargando...</div>;
    }

    return (
        <div id="feed-container">
            {posts.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '50px' }}>No hay publicaciones disponibles.</p>
            ) : (
                posts.map(p => (
                    <div key={p.id} className={`post type-${p.tipo || 'General'}`}>
                        <div className="post-header-row">
                            <div className="post-meta-group">
                                <span className={`type-badge ${p.tipo || 'General'}`}>{p.tipo || 'General'}</span>
                                <span className="meta-divider">|</span>
                                <span className="post-author">{p.anonimo ? "Ciudadano Anónimo" : p.autor}</span>
                                <span className="meta-dot">•</span>
                                <span className="post-dept">{p.dept || p.departamento}</span>
                            </div>
                            {/* Status Pill logic here */}
                        </div>

                        <h3 className="post-title">{p.titulo}</h3>
                        <p className="post-body">{p.contenido}</p>

                        <div className="post-media-container">
                            {/* Media render logic */}
                        </div>

                        {/* Votos y Comentarios Mock - Componentizar luego */}
                        <div style={{ marginTop: 15, borderTop: '1px solid #eee', paddingTop: 10 }}>
                            <small>Votos: {p.votos}</small>
                        </div>
                    </div>
                ))
            )}
        </div>
    );
}
