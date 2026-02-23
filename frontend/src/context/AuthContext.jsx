import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";

const AuthContext = createContext();
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(() => {
        const stored = localStorage.getItem("user");
        return stored ? JSON.parse(stored) : null;
    });

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) {
            setUser(null);
        }
    }, []);

    const sendPresenceUpdate = useCallback(async (isOnline) => {
        const token = localStorage.getItem("token");
        if (!token) return;
        try {
            await fetch(`${API_URL}/users/me/presence`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ isOnline }),
                keepalive: true,
            });
        } catch {
            // ignore presence update failures
        }
    }, []);

    const login = useCallback((userData, token) => {
        setUser(userData);
        localStorage.setItem("token", token);
        localStorage.setItem("user", JSON.stringify(userData));
    }, []);

    const updateUser = useCallback((userData) => {
        setUser(userData);
        localStorage.setItem("user", JSON.stringify(userData));
    }, []);

    const logout = useCallback(() => {
        sendPresenceUpdate(false);
        setUser(null);
        localStorage.removeItem("token");
        localStorage.removeItem("user");
    }, [sendPresenceUpdate]);

    useEffect(() => {
        if (!user) return;

        // Logged-in user with an open tab should be considered online.
        sendPresenceUpdate(true);

        const heartbeatInterval = setInterval(() => {
            sendPresenceUpdate(true);
        }, 30000);

        const onBeforeUnload = () => {
            sendPresenceUpdate(false);
        };

        window.addEventListener("beforeunload", onBeforeUnload);

        return () => {
            clearInterval(heartbeatInterval);
            window.removeEventListener("beforeunload", onBeforeUnload);
            sendPresenceUpdate(false);
        };
    }, [user, sendPresenceUpdate]);

    const value = useMemo(
        () => ({ user, login, updateUser, logout }),
        [user, login, updateUser, logout]
    );

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
