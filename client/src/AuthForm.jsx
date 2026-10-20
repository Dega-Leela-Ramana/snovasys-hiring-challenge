import { useState } from 'react';
import { api, ApiError } from './api.js';

export default function AuthForm({ onAuthenticated }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const data = mode === 'login' ? await api.login(email, password) : await api.register(email, name, password);
      onAuthenticated(data.user);
    } catch (err) {
      if (err instanceof ApiError && err.details?.length) {
        setError(err.details.map((d) => `${d.field}: ${d.message}`).join(' · '));
      } else {
        setError(err.message || 'Something went wrong');
      }
    } finally {
      setBusy(false);
    }
  }

  const input = 'mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 focus:border-slate-500 focus:outline-none';

  return (
    <form onSubmit={submit} className="mx-auto mt-16 w-full max-w-sm space-y-4 rounded-lg bg-white p-6 shadow">
      <h1 className="text-2xl font-semibold">TrustVault</h1>
      <p className="text-sm text-slate-600">{mode === 'login' ? 'Log in to your account' : 'Create an account'}</p>

      {error && (
        <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {mode === 'register' && (
        <label className="block text-sm">
          Name
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} autoComplete="name" />
        </label>
      )}
      <label className="block text-sm">
        Email
        <input className={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
      </label>
      <label className="block text-sm">
        Password {mode === 'register' && <span className="text-slate-500">(at least 12 characters)</span>}
        <input
          className={input}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={mode === 'register' ? 12 : 1}
          maxLength={128}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        />
      </label>

      <button disabled={busy} className="w-full rounded bg-slate-900 px-3 py-2 text-white disabled:opacity-50">
        {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
      </button>

      <button
        type="button"
        className="w-full text-sm text-slate-600 underline"
        onClick={() => {
          setError(null);
          setMode(mode === 'login' ? 'register' : 'login');
        }}
      >
        {mode === 'login' ? 'Need an account? Register' : 'Already registered? Log in'}
      </button>
    </form>
  );
}
