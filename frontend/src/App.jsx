import { useState } from 'react'
import Navbar from './components/Navbar'
import ActionGrid from './components/ActionGrid'
import Feed from './components/Feed'
import CreatePostModal from './components/CreatePostModal'

function App() {
    const [modalOpen, setModalOpen] = useState(false)

    const abrirAuth = (mode) => {
        console.log("Abrir Auth en modo:", mode)
        // TODO: Implementar AuthModal
    }

    return (
        <>
            <Navbar abrirAuth={abrirAuth} />

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

                <ActionGrid />

                <Feed />

            </div>
        </>
    )
}

export default App
