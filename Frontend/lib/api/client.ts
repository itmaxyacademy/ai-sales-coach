import { useAuthStore } from '../../store/authStore';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export async function fetchClient(endpoint: string, options: RequestInit = {}) {
  const token = useAuthStore.getState().token;
  
  const headers = new Headers(options.headers);
  const isFormData = options.body instanceof FormData;
  if (!isFormData) {
    headers.set('Content-Type', 'application/json');
  }
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    useAuthStore.getState().logout();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }

  const data = response.headers.get('content-type')?.includes('text/csv')
    ? await response.blob()
    : await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || 'Something went wrong');
  }

  return data;
}

export const apiClient = {
  get: (endpoint: string, options?: RequestInit) => 
    fetchClient(endpoint, { ...options, method: 'GET' }),
    
  post: (endpoint: string, body: any, options?: RequestInit) => 
    fetchClient(endpoint, { ...options, method: 'POST', body: JSON.stringify(body) }),

  upload: (endpoint: string, body: FormData, options?: RequestInit) =>
    fetchClient(endpoint, { ...options, method: 'POST', body }),
    
  patch: (endpoint: string, body: any, options?: RequestInit) => 
    fetchClient(endpoint, { ...options, method: 'PATCH', body: JSON.stringify(body) }),
    
  delete: (endpoint: string, options?: RequestInit) => 
    fetchClient(endpoint, { ...options, method: 'DELETE' }),
};
