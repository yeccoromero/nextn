'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

// ---------- Types ----------
export interface User {
    uid: string;
    email: string;
    displayName: string;
}

interface AuthContextValue {
    user: User | null;
    isUserLoading: boolean;
    login: (username: string, password: string) => boolean;
    logout: () => void;
}

// ---------- Context ----------
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEY = 'vectoria-auth-user';

const ADMIN_USER: User = {
    uid: 'local-admin',
    email: 'admin@local',
    displayName: 'Admin',
};

// ---------- Provider ----------
export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isUserLoading, setIsUserLoading] = useState(true);

    // Restore session from localStorage on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                setUser(JSON.parse(stored));
            }
        } catch {
            // ignore
        }
        setIsUserLoading(false);
    }, []);

    const login = useCallback((username: string, password: string): boolean => {
        if (username === 'admin' && password === 'admin') {
            setUser(ADMIN_USER);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(ADMIN_USER));
            return true;
        }
        return false;
    }, []);

    const logout = useCallback(() => {
        setUser(null);
        localStorage.removeItem(STORAGE_KEY);
    }, []);

    return (
        <AuthContext.Provider value={{ user, isUserLoading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

// ---------- Hooks ----------
export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
    return ctx;
}

export function useUser() {
    const { user, isUserLoading } = useAuth();
    return { user, isUserLoading };
}
