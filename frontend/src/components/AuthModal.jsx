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
    const [ciFile, setCiFile] = useState(null);
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
        setCiFile(null);
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
                setNombre(data.nombre);
                setStep(2); // Ir a Biometría/Continuar
            } else {
                // Registro
                if (data.exists) {
                    alert("Esta cédula ya está registrada. Por favor inicia sesión.");
                    setLoading(false);
                    return;
                }
                setStep(1.5); // Estado intermedio "Ingresa Nombre"
            }
        } catch (e) {
            console.error(e);
            alert("Error de conexión");
        }
        setLoading(false);
    };

    const handleRegisterSimple = async () => {
        if (!nombre) return alert("Ingresa tu nombre");
        setLoading(true);

        try {
            // Crear usuario en BD
            const res = await fetch('/api/auth/register-simple', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cedula, nombre })
            });

            if (res.ok) {
                // Registro OK, ir a verificación
                setStep(1.8);
            } else {
                alert("Error creando usuario");
            }
        } catch (e) {
            console.error(e);
            alert("Error de registro");
        }
        setLoading(false);
    };

    const handleVerifyCI = async () => {
        if (!ciFile) return alert("Sube una foto de tu cédula");
        setLoading(true);

        try {
            // Convertir a Base64
            const reader = new FileReader();
            reader.readAsDataURL(ciFile);
            reader.onload = async () => {
                const fotoBase64 = reader.result;

                const res = await fetch('/api/user/verify-ci', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        cedula,
                        fotoCI: fotoBase64,
                        nombreExtraido: nombre // Simulamos OCR exitoso con el nombre ingresado
                    })
                });

                if (res.ok) {
                    alert("¡Identidad Verificada Correctamente!");
                    finishLogin();
                } else {
                    alert("Error verificando identidad");
                }
                setLoading(false);
            };
        } catch (e) {
            console.error(e);
            alert("Error procesando imagen");
            setLoading(false);
        }
    };

    const finishLogin = () => {
        login({
            email: `${cedula}@ciudadano.uy`,
            nombre: nombre || checkData?.nombre || 'Usuario',
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
                        <button className="btn-register" style={{ width: '100%', marginTop: 20 }} onClick={handleRegisterSimple}>
                            {loading ? 'Registrando...' : 'Crear Identidad'}
                        </button>
                    </>
                )}

                {step === 1.8 && (
                    <>
                        <h2>Verifica tu Identidad 🛡️</h2>
                        <p style={{ fontSize: '0.9rem', color: '#666' }}>Sube una foto de tu Cédula para validar tu cuenta (Opcional por ahora).</p>

                        <div style={{ margin: '20px 0', border: '2px dashed #ccc', padding: 20, borderRadius: 10 }}>
                            <i className="fas fa-camera" style={{ fontSize: '2rem', color: '#ccc', marginBottom: 10 }}></i>
                            <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                onChange={(e) => setCiFile(e.target.files[0])}
                                style={{ display: 'block', margin: '10px auto' }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: 10 }}>
                            <button className="btn-cancel" style={{ flex: 1 }} onClick={finishLogin}>Omitir</button>
                            <button className="btn-submit" style={{ flex: 1 }} onClick={handleVerifyCI} disabled={!ciFile || loading}>
                                {loading ? 'Validando...' : 'Verificar Ahora'}
                            </button>
                        </div>
                    </>
                )}

                {step === 2 && (
                    <>
                        <h2>Bienvenido de vuelta</h2>
                        <p style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#0056b3' }}>{checkData?.nombre}</p>
                        <div style={{ fontSize: '4rem', color: '#0056b3', margin: '20px 0' }}>
                            <i className="fas fa-fingerprint"></i>
                        </div>
                        <button className="btn-submit" style={{ width: '100%' }} onClick={finishLogin}>
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
