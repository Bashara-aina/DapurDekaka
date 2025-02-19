
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

export const queryKeys = {
  pages: {
    all: ["pages"],
    home: ["pages", "home"],
    menu: ["pages", "menu"],
    blog: ["pages", "blog"],
  },
  articles: {
    all: ["articles"],
    detail: (id: string) => ["articles", id],
  },
};
