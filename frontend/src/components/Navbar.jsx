import { useAuth } from '../context/AuthContext';

export default function Navbar({ currentUser, abrirAuth, abrirPerfil }) {
    const { logout } = useAuth(); // Use logout from context

    return (
        <header>
            <div className="header-container">
                <div className="logo" onClick={() => window.location.reload()}>
                    <i className="fas fa-bullhorn"></i> Voz<b>Ciudadana</b>
                </div>

                <nav className="nav-links">
                    {currentUser ? (
                        <div className="user-profile-nav">
                            <div className="user-avatar" onClick={abrirPerfil} style={{ cursor: 'pointer' }}>
                                {currentUser.foto_perfil ? (
                                    <img src={currentUser.foto_perfil} className="user-avatar" style={{ width: 35, height: 35 }} />
                                ) : (
                                    <div style={{ width: 35, height: 35, borderRadius: '50%', background: '#ccc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {currentUser.nombre ? currentUser.nombre.charAt(0) : 'U'}
                                    </div>
                                )}
                            </div>
                            <span onClick={abrirPerfil} style={{ fontWeight: 'bold', color: '#555', cursor: 'pointer' }}>
                                {currentUser.nombre}
                            </span>
                            <button className="btn-logout" onClick={logout}>Salir</button>
                        </div>
                    ) : (
                        <div className="auth-buttons">
                            <button className="btn-login" onClick={() => abrirAuth('log')}>Iniciar Sesión</button>
                            <button className="btn-register" onClick={() => abrirAuth('reg')}>Registrarse</button>
                        </div>
                    )}
                </nav>
            </div>
        </header>
    );
}
