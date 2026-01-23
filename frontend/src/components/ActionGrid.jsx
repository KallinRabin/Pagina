export default function ActionGrid({ onAction }) {
    return (
        <div className="action-grid">
            <div className="card card-queja" onClick={() => onAction('Queja')}>
                <div className="card-icon">📢</div>
                <h3>Denunciar</h3>
                <p>¿Algo no funciona? Repórtalo aquí.</p>
            </div>
            <div className="card card-idea" onClick={() => onAction('Idea')}>
                <div className="card-icon">💡</div>
                <h3>Proponer</h3>
                <p>Comparte una idea para mejorar tu zona.</p>
            </div>
            <div className="card card-noticia" onClick={() => onAction('Noticia')}>
                <div className="card-icon">📰</div>
                <h3>Informar</h3>
                <p>Publica una noticia o evento local.</p>
            </div>
        </div>
    );
}
