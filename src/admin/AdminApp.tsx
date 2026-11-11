import React, { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type Access = { is_admin: boolean; is_owner: boolean; permissions: string[] };

export function AdminApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [access, setAccess] = useState<Access | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!alive) return;
      if (error) setError(error.message);
      setSession(data.session);
      setBusy(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setAccess(null);
    });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!session) { setAccess(null); return; }
    let alive = true;
    supabase.rpc('get_my_admin_access').then(({ data, error }) => {
      if (!alive) return;
      if (error) setError(error.message);
      else setAccess(data as Access);
    });
    return () => { alive = false; };
  }, [session]);

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setBusy(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setSession(null); setAccess(null);
  }

  if (busy) return <main className="min-h-screen grid place-items-center">Loading Admin Portal…</main>;
  if (!session) return (
    <main className="min-h-screen bg-slate-100 grid place-items-center p-6">
      <form onSubmit={signIn} className="w-full max-w-md bg-white rounded-xl border p-8 space-y-4 shadow-sm">
        <p className="text-xs uppercase tracking-[.25em] text-slate-500">Separate Admin Portal</p>
        <h1 className="text-2xl font-semibold">Administrator Sign In</h1>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <label className="block text-sm">Email<input className="mt-1 w-full border rounded-lg p-3" type="email" required value={email} onChange={e=>setEmail(e.target.value)} /></label>
        <label className="block text-sm">Password<input className="mt-1 w-full border rounded-lg p-3" type="password" required value={password} onChange={e=>setPassword(e.target.value)} /></label>
        <button disabled={busy} className="w-full rounded-lg bg-slate-900 text-white p-3 disabled:opacity-50">Sign in</button>
        <p className="text-xs text-slate-500">Customer accounts do not automatically have Admin access.</p>
      </form>
    </main>
  );

  if (!access) return <main className="min-h-screen grid place-items-center p-6"><div className="max-w-md text-center space-y-3"><h1 className="text-xl font-semibold">Checking administrator access</h1>{error && <p className="text-red-600 text-sm">{error}</p>}<p className="text-sm text-slate-500">Your account must be explicitly registered as an active Admin or Owner.</p><button onClick={signOut} className="underline text-sm">Sign out</button></div></main>;
  if (!access.is_admin && !access.is_owner) return <main className="min-h-screen grid place-items-center p-6"><div className="text-center space-y-3"><h1 className="text-xl font-semibold">Access denied</h1><p className="text-sm text-slate-500">This account is not authorized to use the Admin Portal.</p><button onClick={signOut} className="underline text-sm">Sign out</button></div></main>;

  const can = (permission: string) => access.is_owner || access.permissions.includes(permission);
  return (
    <main className="min-h-screen bg-slate-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between"><div><p className="text-xs uppercase tracking-widest text-slate-500">Independent application</p><h1 className="text-xl font-semibold">Admin Dashboard</h1></div><div className="flex items-center gap-4"><span className="text-xs text-slate-500">{session.user.email}</span><button onClick={signOut} className="text-sm underline">Sign out</button></div></header>
      <section className="max-w-7xl mx-auto p-6 space-y-6">
        <div><h2 className="text-lg font-semibold">Dashboard overview</h2><p className="text-sm text-slate-500">Your live access is checked against Supabase on sign-in.</p></div>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ['Products','products.view'],['Orders','orders.view'],['Payments','payments.review'],
            ['Inventory','inventory.view'],['Shipments','shipments.manage'],['Customers','customers.view'],
            ['Content','content.manage'],['Shipping Rates','shipping_rates.manage'],['Admin & Roles','admins.manage']
          ].map(([label, permission]) => <article key={permission} className="bg-white border rounded-xl p-5"><h3 className="font-medium">{label}</h3><p className="text-xs text-slate-500 mt-2">{can(permission) ? 'Access granted' : 'No permission assigned'}</p></article>)}
        </div>
        <p className="text-xs text-slate-500">Management screens and transactional actions are being connected to the secured database functions. Do not use this portal for live order processing until those workflows have been tested.</p>
      </section>
    </main>
  );
}
