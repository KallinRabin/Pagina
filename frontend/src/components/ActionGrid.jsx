export default function ActionGrid() {
    return (
        <div className="action-grid">
            <div className="card card-queja">
                <div className="card-icon">📢</div>
                <h3>Denunciar</h3>
                <p>¿Algo no funciona? Repórtalo aquí.</p>
            </div>
            <div className="card card-idea">
                <div className="card-icon">💡</div>
                <h3>Proponer</h3>
                <p>Comparte una idea para mejorar tu zona.</p>
            </div>
            <div className="card card-noticia">
                <div className="card-icon">📰</div>
                <h3>Informar</h3>
                <p>Publica una noticia o evento local.</p>
            </div>
        </div>
    );
}
