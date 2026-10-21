
import { useEffect, useState } from 'react';
import { api } from './api.js';
import AuthForm from './AuthForm.jsx';

export default function App() {
  const [user, setUser] = useState(undefined);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('General');
  const [file, setFile] = useState(null);
  const [editing, setEditing] = useState(null);
  const [sharing, setSharing] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [recipientId, setRecipientId] = useState('');
  const [level, setLevel] = useState('READ');

  useEffect(() => {
    api.me()
      .then((data) => setUser(data.user))
      .catch(() => setUser(null));
  }, []);

  async function loadDocuments() {
    setLoading(true);
    try {
      const data = await api.listDocuments();
      setDocuments(data.documents ?? []);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user) loadDocuments();
  }, [user]);

  async function logout() {
    try {
      await api.logout();
      setUser(null);
      setDocuments([]);
    } catch (err) {
      setError(err.message);
    }
  }

  async function upload(event) {
    event.preventDefault();
    if (!file) {
      setError('Please select a file.');
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');

    try {
      await api.uploadDocument(file, title, description, category);
      setTitle('');
      setDescription('');
      setCategory('General');
      setFile(null);
      event.target.reset();
      setMessage('Document uploaded successfully.');
      await loadDocuments();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function download(doc) {
    try {
      await api.downloadDocument(doc.id);
      setMessage('Download started.');
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }

  async function edit(doc) {
    const newTitle = window.prompt('Document title:', doc.title);
    if (newTitle === null) return;

    const newCategory = window.prompt('Category:', doc.category || 'General');
    if (newCategory === null) return;

    const newDescription = window.prompt(
      'Description:',
      doc.description || '',
    );
    if (newDescription === null) return;

    try {
      await api.editDocument(doc.id, {
        title: newTitle,
        category: newCategory,
        description: newDescription,
      });
      setMessage('Document updated.');
      setError('');
      await loadDocuments();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(doc) {
    if (!window.confirm(`Permanently delete "${doc.title}"?`)) return;

    try {
      await api.deleteDocument(doc.id);
      setMessage('Document deleted.');
      setError('');
      await loadDocuments();
    } catch (err) {
      setError(err.message);
    }
  }

  async function openShare(doc) {
    setSharing(doc);
    setError('');
    setPermissions([]);

    try {
      const data = await api.listPermissions(doc.id);
      setPermissions(data.permissions ?? []);
    } catch (err) {
      setSharing(null);
      setError(err.message);
    }
  }

  async function grant(event) {
    event.preventDefault();
    setBusy(true);

    try {
      await api.grantPermission(sharing.id, recipientId.trim(), level);
      const data = await api.listPermissions(sharing.id);
      setPermissions(data.permissions ?? []);
      setRecipientId('');
      setMessage('Access granted.');
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function revoke(userId) {
    try {
      await api.revokePermission(sharing.id, userId);
      const data = await api.listPermissions(sharing.id);
      setPermissions(data.permissions ?? []);
      setMessage('Access revoked.');
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }

  if (user === undefined) {
    return <p className="p-8">Loading TrustVault...</p>;
  }

  if (user === null) {
    return <AuthForm onAuthenticated={setUser} />;
  }

  const visible = documents.filter((doc) =>
    [
      doc.title,
      doc.description,
      doc.category,
      doc.originalFilename,
    ].some((value) =>
      (value || '').toLowerCase().includes(search.toLowerCase().trim()),
    ),
  );

  const owned = documents.filter((doc) => doc.ownerId === user.id).length;
  const field =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';
  const button =
    'rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50';

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-xl font-bold text-white">
              T
            </div>
            <div>
              <h1 className="text-xl font-bold">TrustVault</h1>
              <p className="text-xs text-slate-500">Secure document management</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-semibold">{user.name}</p>
              <p className="text-xs text-slate-500">{user.email}</p>
            </div>
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs text-indigo-700">
              {user.role}
            </span>
            <button onClick={logout} className={`${button} border`}>
              Log out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-6 px-5 py-8">
        <section>
          <p className="text-sm font-medium text-indigo-600">YOUR WORKSPACE</p>
          <h2 className="mt-1 text-3xl font-bold">Document dashboard</h2>
          <p className="mt-2 text-sm text-slate-500">
            Upload, find, download and securely share documents.
          </p>
        </section>

        {error && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
            <button className="ml-3" onClick={() => setError('')}>Dismiss</button>
          </div>
        )}
        {message && (
          <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            {message}
            <button className="ml-3" onClick={() => setMessage('')}>Dismiss</button>
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            ['Visible documents', documents.length],
            ['My documents', owned],
            ['Shared with me', documents.length - owned],
          ].map(([label, count]) => (
            <div key={label} className="rounded-xl border bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">{label}</p>
              <p className="mt-2 text-3xl font-bold">{count}</p>
            </div>
          ))}
        </section>

        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold">Upload a document</h3>
          <p className="mb-4 text-sm text-slate-500">
            Supported formats: PDF, JPEG, PNG and TXT. Maximum 10 MB.
          </p>
          <form onSubmit={upload} className="grid gap-4 md:grid-cols-2">
            <label className="text-sm">
              Title *
              <input className={`${field} mt-1`} required maxLength={200}
                value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="Document title" />
            </label>
            <label className="text-sm">
              Category *
              <input className={`${field} mt-1`} required maxLength={100}
                value={category} onChange={(e) => setCategory(e.target.value)}
                placeholder="General" />
            </label>
            <label className="text-sm md:col-span-2">
              Description
              <textarea className={`${field} mt-1`} rows={2} maxLength={2000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description" />
            </label>
            <label className="text-sm md:col-span-2">
              Choose file *
              <input className={`${field} mt-1`} type="file" required
                accept=".pdf,.jpg,.jpeg,.png,.txt"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
            <div>
              <button disabled={busy} className={`${button} bg-indigo-600 text-white`}>
                {busy ? 'Please wait...' : 'Upload document'}
              </button>
            </div>
          </form>
        </section>

        <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
            <div>
              <h3 className="text-lg font-semibold">Your documents</h3>
              <p className="text-sm text-slate-500">Documents accessible to your account.</p>
            </div>
            <button disabled={loading} onClick={loadDocuments} className={`${button} border`}>
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          <div className="p-5">
            <input className={field} value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, category, description or filename..." />
          </div>

          {visible.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">
              {loading ? 'Loading documents...' : 'No documents found. Upload one to get started.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="p-4">Document</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Updated</th>
                    <th className="p-4">Access</th>
                    <th className="p-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {visible.map((doc) => {
                    const isOwner = doc.ownerId === user.id;
                    return (
                      <tr key={doc.id} className="hover:bg-slate-50">
                        <td className="p-4">
                          <p className="font-semibold">{doc.title}</p>
                          <p className="mt-1 text-xs text-slate-500">{doc.originalFilename}</p>
                        </td>
                        <td className="p-4">{doc.category || 'General'}</td>
                        <td className="p-4">
                          {doc.updatedAt ? new Date(doc.updatedAt).toLocaleDateString() : '—'}
                        </td>
                        <td className="p-4">{isOwner ? 'Owner' : 'Shared'}</td>
                        <td className="p-4">
                          <div className="flex flex-wrap gap-2">
                            <button onClick={() => download(doc)} className={`${button} bg-indigo-50 text-indigo-700`}>
                              Download
                            </button>
                            <button onClick={() => edit(doc)} className={`${button} border`}>
                              Edit
                            </button>
                            {isOwner && (
                              <>
                                <button onClick={() => openShare(doc)} className={`${button} border`}>
                                  Share
                                </button>
                                <button onClick={() => remove(doc)} className={`${button} bg-red-50 text-red-700`}>
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {sharing && (
          <section className="rounded-xl border border-indigo-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap justify-between gap-3">
              <h3 className="text-lg font-semibold">Sharing: {sharing.title}</h3>
              <button onClick={() => setSharing(null)} className={`${button} border`}>Close</button>
            </div>

            <form onSubmit={grant} className="mt-4 grid gap-3 md:grid-cols-[1fr_180px_auto]">
              <input className={field} required value={recipientId}
                onChange={(e) => setRecipientId(e.target.value)}
                placeholder="Recipient's user ID" />
              <select className={field} value={level}
                onChange={(e) => setLevel(e.target.value)}>
                <option value="READ">Read access</option>
                <option value="EDIT">Edit access</option>
              </select>
              <button disabled={busy} className={`${button} bg-indigo-600 text-white`}>
                Grant access
              </button>
            </form>

            <p className="mt-2 text-xs text-slate-500">
              Enter the recipient's actual TrustVault user ID.
            </p>
            <h4 className="mt-5 font-semibold">Current permissions</h4>
            {permissions.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No additional users have access.</p>
            ) : permissions.map((permission) => (
              <div key={permission.userId} className="flex flex-wrap items-center justify-between gap-3 border-b py-3">
                <div>
                  <p className="font-medium">{permission.user?.name || permission.user?.email || permission.userId}</p>
                  <p className="text-xs text-slate-500">
                    {permission.user?.email || permission.userId} · {permission.level}
                  </p>
                </div>
                <button onClick={() => revoke(permission.userId)} className={`${button} bg-red-50 text-red-700`}>
                  Revoke access
                </button>
              </div>
            ))}
          </section>
        )}

        <footer className="pb-4 text-center text-xs text-slate-400">
          TrustVault · Secure document access and sharing
        </footer>
      </div>
    </main>
  );
}
