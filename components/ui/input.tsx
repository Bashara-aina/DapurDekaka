import * as React from 'react';

import { cn } from '@/lib/utils';

export interface InputProps extends React.ComponentProps<'input'> {
  error?: string;
}

/**
 * Native input with ref forwarding for react-hook-form.
 * Keep the native <input> as the forwarded target so register() tracks values.
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    const inputErrorId = error
      ? `input-error-${props.name || 'field'}`
      : undefined;

    return (
      <div className="relative">
        <input
          ref={ref}
          type={type}
          data-slot="input"
          className={cn(
            'h-10 w-full min-w-0 rounded-button border border-brand-cream-dark bg-transparent px-3 py-1.5 text-base transition-colors outline-none placeholder:text-text-disabled focus-visible:border-brand-red focus-visible:ring-2 focus-visible:ring-brand-red/10 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-error md:text-sm',
            error && 'border-error focus-visible:border-error focus-visible:ring-error/10',
            className
          )}
          aria-invalid={!!error}
          aria-describedby={inputErrorId}
          {...props}
        />
        {error && (
          <p id={inputErrorId} className="mt-1 text-xs text-error" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };
