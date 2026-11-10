import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { authService } from '../services/auth';

interface AccountPageProps {
  onNavigateTab: (tab: 'account' | 'order') => void;
  onLogout: () => void;
}

export const AccountPage: React.FC<AccountPageProps> = ({ onNavigateTab, onLogout }) => {
  const { user } = useAuth();
  const { t } = useLanguage();

  const [isEditMode, setIsEditMode] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || user?.whatsapp || '');
  const [address, setAddress] = useState(user?.address || '');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  if (!user) return null;

  const handleEditSubmit = () => {
    if (!isEditMode) {
      setIsEditMode(true);
      setMessage(null);
    } else {
      try {
        if (!name.trim()) {
          setMessage({ text: t.updateError, type: 'error' });
          return;
        }

        const users = authService.getUsers();
        const updatedUsers = users.map((u) => {
          if (u.id === user.id) {
            return {
              ...u,
              name,
              phone,
              whatsapp: phone,
              address,
              ...(password ? { passwordHash: authService.hashPassword(password) } : {}),
            };
          }
          return u;
        });

        authService.saveUsers(updatedUsers);
        const updatedUser = updatedUsers.find((u) => u.id === user.id);
        if (updatedUser) {
          authService.setCurrentUser(updatedUser);
        }

        setIsEditMode(false);
        setMessage({ text: t.updateSuccess, type: 'success' });
      } catch (err) {
        setMessage({ text: t.updateError, type: 'error' });
      }
    }
  };

  return (
    <div className="w-full flex flex-col md:flex-row min-h-[70vh]">
      {/* 桌面端左侧子导航 */}
      <aside className="hidden md:flex flex-col w-64 bg-black text-white p-8 space-y-6">
        <button
          onClick={() => onNavigateTab('account')}
          className="text-left text-sm tracking-wide border-b-2 border-white font-semibold pb-1"
        >
          {t.myAccount}
        </button>
        <button
          onClick={() => onNavigateTab('order')}
          className="text-left text-sm tracking-wide text-gray-400 hover:text-white transition-colors"
        >
          {t.myOrder}
        </button>
        <button
          onClick={onLogout}
          className="text-left text-sm tracking-wide text-gray-400 hover:text-white transition-colors pt-4"
        >
          {t.logOut}
        </button>
      </aside>

      {/* 移动端 C003-P 按钮与账户菜单浮层 */}
      <div className="md:hidden flex items-center justify-between px-6 py-4 bg-transparent relative">
        <h1 className="text-xl font-bold">{t.myAccount}</h1>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Account Menu"
          className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-xs font-bold shadow"
        >
          C003-P
        </button>

        {mobileMenuOpen && (
          <div className="absolute top-16 right-6 w-48 bg-gray-700 bg-opacity-50 backdrop-blur-md text-white shadow-xl rounded-lg py-3 px-4 z-50 flex flex-col space-y-3">
            <button
              onClick={() => { onNavigateTab('account'); setMobileMenuOpen(false); }}
              className="text-left text-sm border-b border-white font-bold pb-1"
            >
              {t.myAccount}
            </button>
            <button
              onClick={() => { onNavigateTab('order'); setMobileMenuOpen(false); }}
              className="text-left text-sm"
            >
              {t.myOrder}
            </button>
            <button
              onClick={() => { setMobileMenuOpen(false); onLogout(); }}
              className="text-left text-sm text-red-300 hover:text-white"
            >
              {t.logOut}
            </button>
          </div>
        )}
      </div>

      {/* 右侧主内容区域 */}
      <main className="flex-grow p-6 md:p-12 max-w-2xl">
        <h1 className="hidden md:block text-3xl font-normal mb-8">{t.myAccount}</h1>

        {message && (
          <div className={`mb-6 p-3 text-sm rounded ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'}`}>
            {message.text}
          </div>
        )}

        <div className="space-y-6 text-sm">
          <div className="flex flex-col md:flex-row md:items-center py-2 border-b border-gray-300/50">
            <span className="w-32 font-medium text-gray-700">{t.fullName}:</span>
            {isEditMode ? (
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="mt-1 md:mt-0 flex-grow bg-white border border-gray-400 rounded px-3 py-1.5 focus:outline-none" />
            ) : (
              <span className="mt-1 md:mt-0 text-gray-900">{name}</span>
            )}
          </div>

          <div className="flex flex-col md:flex-row md:items-center py-2 border-b border-gray-300/50">
            <span className="w-32 font-medium text-gray-700">{t.email}:</span>
            <span className="mt-1 md:mt-0 text-gray-900 opacity-80">{user.email} (Read-only)</span>
          </div>

          <div className="flex flex-col md:flex-row md:items-center py-2 border-b border-gray-300/50">
            <span className="w-32 font-medium text-gray-700">{t.phone}:</span>
            {isEditMode ? (
              <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 md:mt-0 flex-grow bg-white border border-gray-400 rounded px-3 py-1.5 focus:outline-none" />
            ) : (
              <span className="mt-1 md:mt-0 text-gray-900">{phone || '-'}</span>
            )}
          </div>

          <div className="flex flex-col md:flex-row md:items-center py-2 border-b border-gray-300/50">
            <span className="w-32 font-medium text-gray-700">{t.address}:</span>
            {isEditMode ? (
              <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="mt-1 md:mt-0 flex-grow bg-white border border-gray-400 rounded px-3 py-1.5 focus:outline-none" />
            ) : (
              <span className="mt-1 md:mt-0 text-gray-900">{address || '-'}</span>
            )}
          </div>

          <div className="flex flex-col md:flex-row md:items-center py-2 border-b border-gray-300/50">
            <span className="w-32 font-medium text-gray-700">{t.password}:</span>
            {isEditMode ? (
              <input type="password" placeholder="Leave blank to keep current" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 md:mt-0 flex-grow bg-white border border-gray-400 rounded px-3 py-1.5 focus:outline-none" />
            ) : (
              <span className="mt-1 md:mt-0 text-gray-900">••••••••</span>
            )}
          </div>
        </div>

        <div className="mt-12 flex justify-center md:justify-start">
          <button
            onClick={handleEditSubmit}
            className="px-10 py-3 bg-gray-300 hover:bg-gray-400 text-black font-semibold rounded-full shadow transition-all uppercase tracking-wider text-sm"
          >
            {isEditMode ? t.submit : t.edit}
          </button>
        </div>
      </main>
    </div>
  );
};
