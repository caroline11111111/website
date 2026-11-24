import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { applySiteFavicon } from '../lib/siteFavicon';
type FaviconScope = 'storefront' | 'admin';

type FaviconValue = { storage_path?: string | null; mime_type?: string | null };

export function FaviconSettings({ userId, scope }: { userId: string; scope: FaviconScope }) {
  const settingKey = scope === 'storefront' ? 'storefront_favicon' : 'admin_favicon';
  const title = scope === 'storefront' ? 'Storefront Favicon' : 'Admin Favicon';
  const label = scope === 'storefront' ? 'storefront' : 'Admin Portal';
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async () => {
    const { data, error: queryError } = await supabase
      .from('site_settings')
      .select('setting_value')
      .eq('setting_key', settingKey)
      .maybeSingle();
    if (queryError) {
      setError(queryError.message);
      return;
    }
    const value = (data?.setting_value || {}) as FaviconValue;
    const path = value.storage_path || null;
    setCurrentPath(path);
    if (path) {
      const { data: publicData } = supabase.storage.from('homepage-media').getPublicUrl(path);
      setPreviewUrl(publicData.publicUrl);
    } else {
      setPreviewUrl('');
    }
  };

  useEffect(() => { void load(); }, []);

  const save = async () => {
    if (!file || busy) return;
    setError('');
    setNotice('');
    if (file.type !== 'image/png' || file.size > 5 * 1024 * 1024) {
      setError('Please choose a PNG favicon no larger than 5 MB.');
      return;
    }
    setBusy(true);
    const path = `branding/favicon/${scope}/${crypto.randomUUID()}.png`;
    const { error: uploadError } = await supabase.storage.from('homepage-media').upload(path, file, {
      contentType: 'image/png',
      cacheControl: '3600',
      upsert: false,
    });
    if (uploadError) {
      setBusy(false);
      setError(uploadError.message);
      return;
    }
    const { error: saveError } = await supabase.from('site_settings').upsert({
      setting_key: settingKey,
      setting_value: { storage_path: path, mime_type: 'image/png' },
      updated_by: userId,
    }, { onConflict: 'setting_key' });
    if (saveError) {
      const { error: cleanupError } = await supabase.storage.from('homepage-media').remove([path]);
      setBusy(false);
      setError(cleanupError
        ? `Could not save the favicon setting: ${saveError.message}. The new file also could not be cleaned up: ${cleanupError.message}`
        : `Could not save the favicon setting: ${saveError.message}. The uploaded file was removed.`);
      return;
    }
    if (currentPath && currentPath !== path) {
      const { error: removeError } = await supabase.storage.from('homepage-media').remove([currentPath]);
      if (removeError) setError(`Favicon saved, but the previous file could not be removed: ${removeError.message}`);
    }
    setCurrentPath(path);
    const { data: publicData } = supabase.storage.from('homepage-media').getPublicUrl(path);
    setPreviewUrl(publicData.publicUrl);
    setFile(null);
    setNotice('{scope === 'storefront' ? 'Storefront' : 'Admin'} favicon updated. Refresh that site tab to see the new icon.');
    setBusy(false);
    await applySiteFavicon(scope);
  };

  const remove = async () => {
    if (!currentPath || busy || !window.confirm('Remove the custom favicon and return to the default icon?')) return;
    setError('');
    setNotice('');
    setBusy(true);
    const { error: saveError } = await supabase.from('site_settings').upsert({
      setting_key: 'storefront_favicon',
      setting_value: { storage_path: null, mime_type: null },
      updated_by: userId,
    }, { onConflict: 'setting_key' });
    if (saveError) {
      setBusy(false);
      setError(saveError.message);
      return;
    }
    const { error: removeError } = await supabase.storage.from('homepage-media').remove([currentPath]);
    setCurrentPath(null);
    setPreviewUrl('');
    setBusy(false);
    if (removeError) setError(`The default favicon is restored, but the old file could not be removed: ${removeError.message}`);
    else setNotice('Custom {scope === 'storefront' ? 'storefront' : 'Admin'} favicon removed. The default icon is now active.');
    await applySiteFavicon();
  };

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">Change the small icon shown in the browser tab for the {label} only. This setting does not affect the other site. Owner access only.</p>
      </div>
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
      <div className="flex items-center gap-5 rounded-xl border bg-white p-5">
        <div className="grid h-20 w-20 place-items-center rounded-lg border bg-slate-50">
          <img src={previewUrl || '/favicon.svg'} alt={`Current ${label} favicon preview`} className="h-12 w-12 object-contain" />
        </div>
        <div className="min-w-0">
          <p className="font-medium">{currentPath ? 'Custom favicon active' : 'Default favicon active'}</p>
          <p className="mt-1 text-xs text-slate-500">Recommended: square PNG, 32×32 or 48×48 pixels. Maximum file size: 5 MB.</p>
        </div>
      </div>
      <div className="rounded-xl border bg-white p-5 space-y-4">
        <label className="block text-sm font-medium text-slate-700">
          Upload a new favicon (PNG)
          <input className="mt-2 block w-full text-sm" type="file" accept="image/png,.png" onChange={(event) => setFile(event.target.files?.[0] || null)} />
        </label>
        {file && <p className="text-xs text-slate-500">Selected: {file.name} · {(file.size / 1024).toFixed(1)} KB</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={!file || busy} onClick={() => void save()} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save favicon'}</button>
          {currentPath && <button type="button" disabled={busy} onClick={() => void remove()} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50">Restore default icon</button>}
        </div>
      </div>
    </div>
  );
}
