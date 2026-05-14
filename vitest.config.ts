import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8' as const,
      reporter: ['text', 'json', 'html'] as const,
      include: [
        'lib/utils/**/*.ts',
        'lib/services/midtrans/**/*.ts',
        'app/api/checkout/**/*.ts',
        'app/api/webhooks/**/*.ts',
        'app/api/coupons/**/*.ts',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});