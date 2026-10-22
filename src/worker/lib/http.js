// Small HTTP helpers for the API and /ops.

// A refusal with a status and a short code the app can switch on.
export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const fail = (status, code, message) => { throw new ApiError(status, code, message); };

export function json(body, status = 200, headers = {}) {
  const h = new Headers({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  for (const [k, v] of Object.entries(headers)) for (const one of [].concat(v)) h.append(k, one);
  return new Response(JSON.stringify(body), { status, headers: h });
}

export function readCookie(request, name) {
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return rest.join('=');
  }
  return null;
}

export const setCookie = (name, value, maxAge, path = '/') =>
  `${name}=${value}; Path=${path}; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;

export const clearCookie = (name, path = '/') => setCookie(name, '', 0, path);

export const now = () => new Date().toISOString();
