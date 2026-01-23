import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function AuthModal({ isOpen, mode, onClose, switchMode }) {
    const { login } = useAuth();
    const [step, setStep] = useState(1);
    const [cedula, setCedula] = useState('');
    const [nombre, setNombre] = useState('');
    const [masterPin, setMasterPin] = useState('');
    const [clicksTitle, setClicksTitle] = useState(0);
    const [showMaster, setShowMaster] = useState(false);
    const [checkData, setCheckData] = useState(null); // Data del check-ci
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleTitleClick = () => {
        const newClicks = clicksTitle + 1;
        setClicksTitle(newClicks);
        if (newClicks >= 5) {
            setShowMaster(true);
        }
    };

    const resetInternal = () => {
        setStep(1);
        setCedula('');
        setNombre('');
        setMasterPin('');
        setClicksTitle(0);
        setShowMaster(false);
        setCheckData(null);
    }

    const handleClose = () => {
        resetInternal();
        onClose();
    };

    // Paso 1: Verificar Cédula
    const handleStep1 = async () => {
        if (!cedula) return alert("Ingresa tu cédula");

        // Master Bypass
        if (showMaster && masterPin === '12345') {
            login({
                email: 'admin@uruguay.uy',
                nombre: 'Master Admin',
                rol: 'admin',
                cedula: '0000000-0',
                foto_perfil: null
            });
            handleClose();
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`/api/auth/check-ci/${cedula}`);
            const data = await res.json();
            setCheckData(data); // { exists, nombre, hasPasskey }

            // Lógica de Modos (Ported from app.js)
            if (mode === 'log') {
                if (!data.exists) {
                    alert("Esta cédula no está registrada. Cambia a 'Registrarse'.");
                    setLoading(false);
                    return;
                }
                // Si existe, pre-llenar nombre (aunque no se pide en login directo, se usa para display)
                setNombre(data.nombre);
                setStep(2); // Ir a Biometría/Continuar
            } else {
                // Registro
                if (data.exists) {
                    alert("Esta cédula ya está registrada. Por favor inicia sesión.");
                    // switchMode('log') // Opcional
                    setLoading(false);
                    return;
                }
                // Nuevo usuario: Mostrar campo nombre
                // En este diseño simplificado, pedimos nombre aquí mismo si es nuevo
                if (!nombre && !document.getElementById('auth-nombre-input')) {
                    // Hack rápido: forzar UI de nombre si no estaba visible (manejado por render abajo)
                }
                setStep(1.5); // Estado intermedio "Ingresa Nombre"
            }
        } catch (e) {
            console.error(e);
            alert("Error de conexión");
        }
        setLoading(false);
    };

    const handleRegistroSubmit = async () => {
        if (!nombre) return alert("Ingresa tu nombre");
        // Simular paso a biometría o registro directo (Simplificado React Beta)
        // En producción real portaríamos WebAuthn aquí. 
        // Por ahora: Registro Exitoso Mock

        const newUser = {
            email: `${cedula}@ciudadano.uy`,
            nombre: nombre,
            cedula: cedula,
            rol: 'ciudadano',
            foto_perfil: null,
            fecha_registro: new Date().toISOString()
        };

        // Enviar a backend real de registro (pendiente portar endpoint completo passwordless)
        // Por ahora simulamos login directo
        login(newUser);
        handleClose();
    };

    const handleLoginSubmit = async () => {
        // Login exitoso mock (sin biometría real en este paso aún)
        login({
            email: `${cedula}@ciudadano.uy`,
            nombre: checkData?.nombre || 'Usuario',
            cedula: cedula,
            rol: 'ciudadano',
            foto_perfil: null
        });
        handleClose();
    };

    return (
        <div className="modal show" style={{ display: 'block' }}>
            <div className="modal-content" style={{ maxWidth: 400, textAlign: 'center' }}>
                <div style={{ textAlign: 'right' }}>
                    <span style={{ cursor: 'pointer', fontSize: '1.5rem' }} onClick={handleClose}>&times;</span>
                </div>

                {step === 1 && (
                    <>
                        <h2 onClick={handleTitleClick} style={{ cursor: 'default', userSelect: 'none' }}>Identidad Ciudadana</h2>
                        <p style={{ color: '#666', marginBottom: 20 }}>Ingresa tu Cédula de Identidad</p>

                        <div className="input-group">
                            <input
                                type="text"
                                placeholder="1.234.567-8"
                                value={cedula}
                                onChange={(e) => setCedula(e.target.value)}
                                style={{ textAlign: 'center', fontSize: '1.5rem', borderRadius: 12 }}
                            />
                        </div>

                        {showMaster && (
                            <div style={{ marginTop: 15, padding: 10, background: '#f0faff', border: '1px dashed #0056b3' }}>
                                <p style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>🔑 MODO MAESTRO</p>
                                <input type="password" placeholder="PIN" value={masterPin} onChange={e => setMasterPin(e.target.value)} />
                            </div>
                        )}

                        <button className="btn-submit" style={{ width: '100%', marginTop: 20 }} onClick={handleStep1}>
                            {loading ? 'Verificando...' : 'Continuar'}
                        </button>
                    </>
                )}

                {step === 1.5 && (
                    <>
                        <h2>Hola! 👋</h2>
                        <p>Parece que eres nuevo. ¿Cómo te llamas?</p>
                        <div className="input-group">
                            <input
                                type="text"
                                placeholder="Nombre y Apellido"
                                value={nombre}
                                onChange={(e) => setNombre(e.target.value)}
                                style={{ textAlign: 'center' }}
                            />
                        </div>
                        <button className="btn-register" style={{ width: '100%', marginTop: 20 }} onClick={handleRegistroSubmit}>
                            Crear Identidad
                        </button>
                    </>
                )}

                {step === 2 && (
                    <>
                        <h2>Bienvenido de vuelta</h2>
                        <p style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#0056b3' }}>{checkData?.nombre}</p>
                        <div style={{ fontSize: '4rem', color: '#0056b3', margin: '20px 0' }}>
                            <i className="fas fa-fingerprint"></i>
                        </div>
                        <button className="btn-submit" style={{ width: '100%' }} onClick={handleLoginSubmit}>
                            Biometría (Simulada)
                        </button>
                    </>
                )}

                <div style={{ marginTop: 20 }}>
                    <small style={{ cursor: 'pointer', textDecoration: 'underline', color: '#666' }}
                        onClick={() => { resetInternal(); switchMode(mode === 'log' ? 'reg' : 'log'); }}>
                        {mode === 'log' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia Sesión'}
                    </small>
                </div>

            </div>
        </div>
    );
}
