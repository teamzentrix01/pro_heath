const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? '';

export const apiUrl = (path: string) => {
  if (!apiBaseUrl || /^https?:\/\//i.test(path)) {
    return path;
  }

  return `${apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
};

export const apiFetch = (path: string, init?: RequestInit) =>
  fetch(apiUrl(path), {
    ...init,
    credentials: 'include',
    headers: {
      ...init?.headers,
    },
  });
