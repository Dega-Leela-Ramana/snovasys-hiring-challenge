// All calls to the server go through here.
// REMINDER: the browser UI is only a convenience. Hiding a button protects nothing;
// the server re-checks every request. Never add security decisions to the client.
export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request(method, path, body) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  if (res.status === 204) return null;

  let data = null;
  try {
    data = await res.json();
  } catch {
    // not JSON; fall through to the generic error below
  }
  if (!res.ok) {
    const e = data?.error;
    throw new ApiError(res.status, e?.code ?? 'ERROR', e?.message ?? 'Request failed', e?.details);
  }
  return data;
}

export const api = {
  me: () => request('GET', '/auth/me'),
  login: (email, password) => request('POST', '/auth/login', { email, password }),
  register: (email, name, password) => request('POST', '/auth/register', { email, name, password }),
  logout: () => request('POST', '/auth/logout'),
};
