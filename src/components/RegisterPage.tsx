import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

interface RegisterPageProps {
  onRegisterSuccess: () => void;
  onNavigateLogin: () => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ onRegisterSuccess, onNavigateLogin }) => {
  const { register } = useAuth();
  const { t } = useLanguage();
  const translations = t as any;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const result = await register({ name, email, phone, address, password });
      if (result.confirmationRequired) {
        setNotice('Your account has been created. Please check your email and confirm your address before logging in.');
      } else {
        onRegisterSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : (translations.registrationFailed || 'Registration failed. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-6 py-16">
      <h1 className="text-3xl font-light mb-8 text-center">{translations.signUpTitle || 'Create Account'}</h1>
      {error && <div role="alert" className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded">{error}</div>}
      {notice && <div role="status" className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 text-xs rounded">{notice}</div>}
      <form onSubmit={handleSubmit} className="space-y-4 bg-white p-8 rounded-lg border border-gray-200 shadow-sm">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">{translations.fullNameLabel || 'Full Name'}</label>
          <input type="text" required autoComplete="name" value={name} onChange={e => setName(e.target.value)} className="w-full border border-gray-300 rounded p-3 text-sm focus:outline-none focus:border-black" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">{translations.emailLabel || 'Email Address'}</label>
          <input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full border border-gray-300 rounded p-3 text-sm focus:outline-none focus:border-black" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">{translations.phoneLabel || 'Phone Number'}</label>
          <input type="tel" required autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full border border-gray-300 rounded p-3 text-sm focus:outline-none focus:border-black" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">{translations.addressLabel || 'Address'}</label>
          <textarea required rows={2} autoComplete="street-address" value={address} onChange={e => setAddress(e.target.value)} className="w-full border border-gray-300 rounded p-3 text-sm focus:outline-none focus:border-black" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">{translations.passwordLabel || 'Password'}</label>
          <input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} className="w-full border border-gray-300 rounded p-3 text-sm focus:outline-none focus:border-black" />
          <p className="text-xs text-gray-400 mt-1">Use at least 8 characters.</p>
        </div>
        <button type="submit" disabled={busy} className="w-full py-4 bg-black text-white text-xs font-semibold uppercase tracking-widest rounded-full hover:bg-gray-800 disabled:opacity-50">
          {busy ? 'Creating account…' : (translations.signUpBtn || 'Sign Up')}
        </button>
        <div className="text-center pt-4 text-xs text-gray-500">
          <p>Already have an account? <button type="button" onClick={onNavigateLogin} className="text-black underline font-semibold">Log In</button></p>
        </div>
      </form>
    </div>
  );
};

export default RegisterPage;
