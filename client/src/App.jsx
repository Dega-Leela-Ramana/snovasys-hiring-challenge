import { useEffect, useState } from 'react';
import { api } from './api.js';
import AuthForm from './AuthForm.jsx';

export default function App() {
  // undefined = still checking, null = logged out, object = logged in
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    api
      .me()
      .then((data) => setUser(data.user))
      .catch(() => setUser(null));
  }, []);

  async function logout() {
    try {
      await api.logout();
    } finally {
      setUser(null);
    }
  }

  if (user === undefined) return <p className="p-8 text-slate-600">Loading…</p>;
  if (user === null) return <AuthForm onAuthenticated={setUser} />;

  return (
    <main className="mx-auto mt-16 max-w-xl space-y-4 rounded-lg bg-white p-6 shadow">
      <h1 className="text-2xl font-semibold">TrustVault</h1>
      <p>
        Signed in as <strong>{user.name}</strong> ({user.email}){' '}
        <span className="rounded bg-slate-200 px-2 py-0.5 text-xs">{user.role}</span>
      </p>
      <p className="text-sm text-slate-600">
        Milestone 1: authentication works. Documents, sharing and the audit dashboard arrive in the next milestones.
      </p>
      <button onClick={logout} className="rounded border border-slate-300 px-3 py-2 text-sm">
        Log out
      </button>
    </main>
  );
}
