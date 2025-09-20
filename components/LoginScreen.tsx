import React, { useState } from 'react';
import type { User } from '../types.ts';
import { LogoIcon } from './Icons.tsx';

interface LoginScreenProps {
    users: User[];
    onLoginSuccess: (user: User) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ users, onLoginSuccess }) => {
    const [loginId, setLoginId] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        const user = users.find(u => u.loginId === loginId);

        // In a real application, never compare passwords in plaintext.
        // This would be a request to a backend that compares a salted hash.
        if (user && user.password === password) {
            if (user.isActive) {
                onLoginSuccess(user);
            } else {
                setError("Ce compte utilisateur est désactivé.");
            }
        } else {
            setError("Identifiant ou mot de passe incorrect.");
        }
    };

    return (
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-100 font-sans p-4">
            <div className="w-full max-w-sm">
                <div className="flex justify-center items-center mb-6">
                    <LogoIcon className="w-12 h-12 text-indigo-600"/>
                    <h1 className="text-2xl font-bold text-slate-800 ml-3">Architecte de Solutions</h1>
                </div>
                <div className="bg-white rounded-lg shadow-lg p-8">
                    <h2 className="text-xl font-semibold text-center text-slate-700 mb-1">Connexion</h2>
                    <p className="text-sm text-slate-500 text-center mb-6">Veuillez entrer vos identifiants.</p>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label htmlFor="loginId" className="block text-sm font-medium text-slate-700">
                                Identifiant / Extension
                            </label>
                            <div className="mt-1">
                                <input
                                    id="loginId"
                                    name="loginId"
                                    type="text"
                                    autoComplete="username"
                                    required
                                    value={loginId}
                                    onChange={(e) => setLoginId(e.target.value)}
                                    className="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="password"  className="block text-sm font-medium text-slate-700">
                                Mot de passe
                            </label>
                            <div className="mt-1">
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    autoComplete="current-password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                />
                            </div>
                        </div>
                        
                        {error && <p className="text-sm text-red-600 text-center">{error}</p>}

                        <div>
                            <button
                                type="submit"
                                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                                Entrer
                            </button>
                        </div>
                    </form>
                </div>
                <p className="text-center text-xs text-slate-500 mt-6">&copy; 2024 Solution Simplifiée Inc.</p>
            </div>
        </div>
    );
};

export default LoginScreen;
