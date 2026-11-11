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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const success = login(email, password);
    if (success) {
      onLoginSuccess();
    } else {
      setError('Invalid email or password');
    }
  };

  return (
    <div className="max-w-md mx-auto px-6 py-16">
      <h1 className="text-3xl font-light mb-8 text-center">Log In</h1>
      
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 bg-white p-8 rounded-lg border border-gray-200 shadow-sm">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Email Address</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-gray-300 rounded p-3 text-sm focus:outline-none focus:border-black"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-300 rounded p-3 text-sm focus:outline-none focus:border-black"
          />
        </div>

        <button
          type="submit"
          className="w-full py-4 bg-black text-white text-xs font-semibold uppercase tracking-widest rounded-full hover:bg-gray-800 transition-all cursor-pointer shadow-md"
        >
          Log In
        </button>

        <div className="text-center pt-4 text-xs text-gray-500 space-y-2">
          <p>Forgot your password? <a href="#reset" className="underline">Reset Password</a></p>
          <p>Don't have an account? <button type="button" onClick={onNavigateRegister} className="text-black underline font-semibold cursor-pointer">Sign Up</button></p>
        </div>
      </form>
    </div>
  );
};

export default LoginPage;
