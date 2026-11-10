import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

interface LoginPageProps {
  onLoginSuccess: () => void;
  onGoRegister: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, onGoRegister }) => {
  const { login } = useAuth();
  const { t } = useLanguage();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForgotNotice, setShowForgotNotice] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setErrorMsg('');
    setShowForgotNotice(false);

    if (!email.trim() || !password.trim()) {
      setErrorMsg(t.invalidCredentials);
      return;
    }

    setIsSubmitting(true);
    try {
      login(email.trim(), password);
      setIsSubmitting(false);
      onLoginSuccess();
    } catch (err) {
      setIsSubmitting(false);
      setErrorMsg(t.invalidCredentials);
    }
  };

  return (
    <div className="w-full flex flex-col items-center justify-center min-h-[65vh] px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-lg p-8 shadow-sm border border-gray-100">
        <h1 className="text-3xl font-normal text-center mb-8 tracking-tight">{t.loginTitle}</h1>

        {errorMsg && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded text-center">{errorMsg}</div>
        )}

        {showForgotNotice && (
          <div className="mb-6 p-3 bg-blue-50 border border-blue-200 text-blue-700 text-xs rounded text-center">{t.forgotPasswordNotice}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between">
            <label className="text-sm font-medium text-gray-700 w-24 mb-1 md:mb-0">{t.emailLabel}</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="flex-grow border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-black" required />
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between">
            <label className="text-sm font-medium text-gray-700 w-24 mb-1 md:mb-0">{t.passwordLabel}</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="flex-grow border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-black" required />
          </div>

          <div className="pt-4 flex justify-center">
            <button type="submit" disabled={isSubmitting} className="w-full md:w-48 py-3 bg-gray-300 hover:bg-gray-400 text-black font-semibold rounded-full shadow transition-all uppercase tracking-wider text-sm disabled:opacity-50">
              {isSubmitting ? '...' : t.loginBtn}
            </button>
          </div>
        </form>

        <div className="mt-8 flex flex-col items-center space-y-3 text-sm">
          <button type="button" onClick={() => setShowForgotNotice(true)} className="text-gray-700 hover:underline transition-colors">{t.forgotPasswordLink}</button>
          <button type="button" onClick={onGoRegister} className="text-gray-700 hover:underline font-medium transition-colors">{t.signUpForFreeLink}</button>
        </div>
      </div>
    </div>
  );
};
