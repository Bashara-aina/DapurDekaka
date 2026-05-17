import { Resend } from 'resend';

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'noreply@dapurdekaka.com';
const FROM_NAME = 'Dapur Dekaka 德卡';

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }
    _resend = new Resend(apiKey);
  }
  return _resend;
}

// Proxy to enable lazy initialization without changing import usage
export const resend = new Proxy({} as Resend, {
  get(_target, prop: string) {
    const instance = getResend();
    const value = (instance as unknown as Record<string, unknown>)[prop];
    if (typeof value === 'function') {
      return value.bind(instance);
    }
    return value;
  },
});

export { FROM_EMAIL, FROM_NAME };