import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

interface LoginPageProps {
  onLoginSuccess: () => void;
  onNavigateRegister: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, onNavigateRegister }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      onLoginSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to log in. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-6 py-16">
      <h1 className="text-3xl font-light mb-8 text-center">Log In</h1>
      {error && <div role="alert" className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4 bg-white p-8 rounded-lg border border-gray-200 shadow-sm">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Email Address</label>
          <input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full border border-gray-300 rounded p-3 text-sm focus:outline-none focus:border-black" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Password</label>
          <input type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className="w-full border border-gray-300 rounded p-3 text-sm focus:outline-none focus:border-black" />
        </div>
        <button type="submit" disabled={busy} className="w-full py-4 bg-black text-white text-xs font-semibold uppercase tracking-widest rounded-full hover:bg-gray-800 disabled:opacity-50">
          {busy ? 'Please wait…' : 'Log In'}
        </button>
        <div className="text-center pt-4 text-xs text-gray-500">
          <p>Don't have an account? <button type="button" onClick={onNavigateRegister} className="text-black underline font-semibold">Sign Up</button></p>
        </div>
      </form>
    </div>
  );
};

export default LoginPage;
