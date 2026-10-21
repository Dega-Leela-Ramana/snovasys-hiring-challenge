
 // All API requests go through this file.
export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request(method, path, body) {
  const isFormData = body instanceof FormData;

  const res = await fetch(`/api${path}`, {
    method,
    headers: body && !isFormData
      ? { 'Content-Type': 'application/json' }
      : {},
    body: body
      ? isFormData
        ? body
        : JSON.stringify(body)
      : undefined,
    credentials: 'same-origin',
  });

  if (res.status === 204) return null;

  let data = null;
  try {
    data = await res.json();
  } catch {
    // The response was not JSON.
  }

  if (!res.ok) {
    const e = data?.error;
    throw new ApiError(
      res.status,
      e?.code ?? 'ERROR',
      e?.message ?? 'Request failed',
      e?.details,
    );
  }

  return data;
}

async function downloadDocument(id) {
  const res = await fetch(
    `/api/documents/${encodeURIComponent(id)}/download`,
    { credentials: 'same-origin' },
  );

  if (!res.ok) {
    let data = null;
    try {
      data = await res.json();
    } catch {
      // Ignore non-JSON error responses.
    }

    const e = data?.error;
    throw new ApiError(
      res.status,
      e?.code ?? 'ERROR',
      e?.message ?? 'Download failed',
      e?.details,
    );
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = 'document';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export const api = {
  // Existing authentication
  me: () => request('GET', '/auth/me'),
  login: (email, password) =>
    request('POST', '/auth/login', { email, password }),
  register: (email, name, password) =>
    request('POST', '/auth/register', { email, name, password }),
  logout: () => request('POST', '/auth/logout'),

  // Documents
  listDocuments: () => request('GET', '/documents'),
  getDocument: (id) =>
    request('GET', `/documents/${encodeURIComponent(id)}`),

  uploadDocument: (file, title, description, category) => {
    const form = new FormData();
    form.append('file', file);
    form.append('title', title);
    form.append('description', description);
    form.append('category', category);
    return request('POST', '/documents', form);
  },

  downloadDocument,

  editDocument: (id, changes) =>
    request('PATCH', `/documents/${encodeURIComponent(id)}`, changes),

  deleteDocument: (id) =>
    request('DELETE', `/documents/${encodeURIComponent(id)}`),

  // Sharing
  listPermissions: (id) =>
    request('GET', `/documents/${encodeURIComponent(id)}/permissions`),

  grantPermission: (id, userId, level) =>
    request('POST', `/documents/${encodeURIComponent(id)}/permissions`, {
      userId,
      level,
    }),

  revokePermission: (id, userId) =>
    request(
      'DELETE',
      `/documents/${encodeURIComponent(id)}/permissions/${encodeURIComponent(userId)}`,
    ),
};
