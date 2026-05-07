const isDev = import.meta.env.DEV;

export const logger = {
  log: (message: string, ...args: unknown[]) => {
    if (isDev) console.log(`[API] ${message}`, ...args);
  },
  error: (message: string, ...args: unknown[]) => {
    if (isDev) console.error(`[API] ${message}`, ...args);
  },
};