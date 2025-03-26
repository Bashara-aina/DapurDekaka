import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
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
    homepage: ["pages", "homepage"],  // Added homepage key
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

export const apiRequest = async (
  endpoint: string,
  options: RequestInit = {}
) => {
  const response = await fetch(endpoint, {
    ...options,
    credentials: 'include', // Always include credentials for sessions to work
    headers: {
      ...options.headers,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `API request failed: ${response.statusText}`);
  }

  return response.json();
};