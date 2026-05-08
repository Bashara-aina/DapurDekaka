import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,   // 5 min for static pages
      gcTime: 10 * 60 * 1000,      // 10 min garbage collection
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export const queryKeys = {
  pages: {
    all: ["pages"],
    home: ["pages", "home"],
    menu: ["pages", "menu"],
    blog: ["pages", "blog"],
    homepage: ["pages", "homepage"],
    contact: ["pages", "contact"],
    about: ["pages", "about"],
    customers: ["pages", "customers"],
  },
  admin: {
    blog: ["/api/blog"],
    menu: {
      items: ["/api/menu/items"],
      sauces: ["/api/menu/sauces"],
    },
    pages: {
      home: ["/api/pages/homepage"],
      contact: ["/api/pages/contact"],
      about: ["/api/pages/about"],
      footer: ["/api/pages/footer"],
      customers: ["/api/pages/customers"],
    },
  },
  menu: {
    all: ["menu"],
    items: ["menu", "items"],
    sauces: ["menu", "sauces"],
    item: (id: number) => ["menu", "items", id],
    sauce: (id: number) => ["menu", "sauces", id],
  },
  articles: {
    all: ["articles"],
    detail: (id: string) => ["articles", id],
  },
};

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
  meta?: Record<string, unknown>;
}

export function apiRequest<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const { body, ...rest } = options || {};
  const isFormData = body instanceof FormData;

  return fetch(endpoint, {
    ...rest,
    body,
    credentials: 'include',
    headers: isFormData
      ? rest?.headers
      : {
          ...rest?.headers,
          'Content-Type': 'application/json',
        },
  }).then(response => {
    if (!response.ok) {
      return response.text().then(text => {
        let errorData;
        try {
          errorData = JSON.parse(text);
        } catch {
          throw new Error(`API request failed: ${response.status} ${response.statusText}. Response: ${text}`);
        }
        throw new Error(errorData.message || errorData.error?.message || `API request failed: ${response.statusText}`);
      });
    }

    return response.text().then(text => {
      if (!text) return {} as T;

      const parsed = JSON.parse(text);

      // Handle { success: true, data: T } format
      if (parsed && typeof parsed === 'object' && 'success' in parsed && parsed.success === true && 'data' in parsed) {
        return parsed.data as T;
      }

      return parsed as T;
    });
  });
}

/**
 * Fetch with automatic unwrapping of { success: true, data: T } response format.
 * Use this for endpoints that use the ok()/created() helpers.
 */
export async function fetchData<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const result = await apiRequest<ApiResponse<T>>(endpoint, options);
  if (!result.success || result.data === undefined) {
    throw new Error(result.error?.message || 'Failed to fetch data');
  }
  return result.data;
}