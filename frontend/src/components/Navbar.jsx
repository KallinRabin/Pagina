export default function Navbar({ currentUser, abrirAuth }) {
    return (
        <header>
            <div className="header-container">
                <div className="logo" onClick={() => window.location.reload()}>
                    <i className="fas fa-bullhorn"></i> Voz<b>Ciudadana</b>
                </div>

                <nav className="nav-links">
                    {currentUser ? (
                        <div className="user-profile-nav">
                            <div className="user-avatar">
                                {currentUser.foto_perfil ? (
                                    <img src={currentUser.foto_perfil} className="user-avatar" style={{ width: 35, height: 35 }} />
                                ) : (
                                    currentUser.nombre.charAt(0)
                                )}
                            </div>
                            <span style={{ fontWeight: 'bold', color: '#555' }}>{currentUser.nombre}</span>
                            <button className="btn-logout" onClick={() => window.location.reload()}>Salir</button>
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
