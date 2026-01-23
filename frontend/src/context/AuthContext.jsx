import { createContext, useState, useEffect, useContext } from 'react';

const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Verificar sesión (simulando la lógica de sessionStorage de la Fase 6)
        const storedUser = sessionStorage.getItem('currentUser');
        if (storedUser) {
            try {
                setCurrentUser(JSON.parse(storedUser));
            } catch (e) {
                console.error("Error parsing stored user", e);
                sessionStorage.removeItem('currentUser');
            }
        }
        setLoading(false);
    }, []);

    const login = (userData) => {
        // Al login, guardamos en state y sessionStorage
        setCurrentUser(userData);
        sessionStorage.setItem('currentUser', JSON.stringify(userData));
    };

    const logout = () => {
        // Logout
        setCurrentUser(null);
        sessionStorage.removeItem('currentUser');
        window.location.reload();
    };

    const value = {
        currentUser,
        login,
        logout,
        loading
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}
