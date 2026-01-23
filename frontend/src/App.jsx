import { useState } from 'react'
import Navbar from './components/Navbar'
import ActionGrid from './components/ActionGrid'
import Feed from './components/Feed'
import CreatePostModal from './components/CreatePostModal'
import AuthModal from './components/AuthModal'
import ProfileModal from './components/ProfileModal'
import { useAuth } from './context/AuthContext'

function App() {
    const [authOpen, setAuthOpen] = useState(false)
    const [authMode, setAuthMode] = useState('log') // 'log' or 'reg'
    const [createOpen, setCreateOpen] = useState(false)
    const [initialPostType, setInitialPostType] = useState('Queja')
    const [profileOpen, setProfileOpen] = useState(false)

    // Get currentUser from Context to pass to Navbar
    const { currentUser } = useAuth();

    // Auth Helper
    const abrirAuth = (mode) => {
        setAuthMode(mode)
        setAuthOpen(true)
    }

    // Action Helper
    // Called from ActionGrid with 'Queja', 'Idea', 'Noticia'
    const abrirCrearPost = (tipo) => {
        // Optional: Force auth? Modal handles it inside submit, but we can check here.
        setInitialPostType(tipo)
        setCreateOpen(true)
    }

    return (
        <>
            <Navbar
                currentUser={currentUser}
                abrirAuth={abrirAuth}
                abrirPerfil={() => setProfileOpen(true)}
            />

            <section className="hero">
                <h1>Tu voz transforma tu comunidad</h1>
                <p>Reporta quejas, propone ideas o comparte noticias de tu departamento.</p>
            </section>

            <div className="container">

                {/* Filtros Zone - Placeholder */}
                <div className="filter-zone">
                    <div className="selector-group">
                        <i className="fas fa-map-marker-alt"></i>
                        <select id="main-dept-filter" defaultValue="todos">
                            <option value="todos">Todo el Uruguay</option>
                        </select>
                    </div>
                </div>

                <ActionGrid onAction={abrirCrearPost} />

                <Feed />

            </div>

            {/* MODALES GLOBALES */}

            <AuthModal
                isOpen={authOpen}
                mode={authMode}
                onClose={() => setAuthOpen(false)}
                switchMode={(m) => setAuthMode(m)}
            />

            <CreatePostModal
                isOpen={createOpen}
                onClose={() => setCreateOpen(false)}
                initialType={initialPostType}
            />

            <ProfileModal
                isOpen={profileOpen}
                onClose={() => setProfileOpen(false)}
            />
        </>
    )
}

export default App
