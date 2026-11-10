import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

interface RegisterPageProps {
  onRegisterSuccess: () => void;
  onGoLogin: () => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ onRegisterSuccess, onGoLogin }) => {
  const { register } = useAuth();
  const { t } = useLanguage();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setErrorMsg('');
    if (!name.trim() || !email.trim() || !password.trim()) {
      setErrorMsg(t.registrationFailed);
      return;
    }

    setIsSubmitting(true);
    try {
      register(name.trim(), email.trim(), password, phone.trim());
      setIsSubmitting(false);
      onRegisterSuccess();
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMsg(err.message === 'Email already registered' ? t.emailAlreadyRegistered : t.registrationFailed);
    }
  };

  return (
    <div className="w-full flex flex-col items-center justify-center min-h-[70vh] px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-lg p-8 shadow-sm border border-gray-100">
        <h1 className="text-3xl font-normal text-center mb-8 tracking-tight">{t.signUpTitle}</h1>

        {errorMsg && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded text-center">{errorMsg}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between">
            <label className="text-sm font-medium text-gray-700 w-28 mb-1 md:mb-0">{t.fullNameLabel}</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="flex-grow border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-black" required />
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between">
            <label className="text-sm font-medium text-gray-700 w-28 mb-1 md:mb-0">{t.emailLabel}</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="flex-grow border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-black" required />
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between">
            <label className="text-sm font-medium text-gray-700 w-28 mb-1 md:mb-0">{t.phoneLabel}</label>
            <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className="flex-grow border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-black" />
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between">
            <label className="text-sm font-medium text-gray-700 w-28 mb-1 md:mb-0">{t.addressLabel}</label>
            <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="flex-grow border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-black" />
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between">
            <label className="text-sm font-medium text-gray-700 w-28 mb-1 md:mb-0">{t.passwordLabel}</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="flex-grow border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-black" required />
          </div>

          <div className="pt-4 flex justify-center">
            <button type="submit" disabled={isSubmitting} className="w-full md:w-48 py-3 bg-gray-300 hover:bg-gray-400 text-black font-semibold rounded-full shadow transition-all uppercase tracking-wider text-sm disabled:opacity-50">
              {isSubmitting ? '...' : t.signUpBtn}
            </button>
          </div>
        </form>

        <div className="mt-8 text-center text-sm">
          <button type="button" onClick={onGoLogin} className="text-gray-700 hover:underline transition-colors font-medium">
            Already have an account? Log in
          </button>
        </div>
      </div>
    </div>
  );
};
