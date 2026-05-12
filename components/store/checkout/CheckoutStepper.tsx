'use client';

import { CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface CheckoutStepItem {
  id: string;
  label: string;
}

interface CheckoutStepperProps {
  steps: CheckoutStepItem[];
  currentStepId: string;
  className?: string;
}

export function CheckoutStepper({ steps, currentStepId, className }: CheckoutStepperProps) {
  const currentIndex = steps.findIndex((s) => s.id === currentStepId);

  return (
    <div className={cn('flex items-center justify-between', className)}>
      {steps.map((step, idx) => {
        const isActive = idx === currentIndex;
        const isCompleted = idx < currentIndex;

        return (
          <div key={step.id} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
                  isCompleted
                    ? 'bg-success text-white'
                    : isActive
                      ? 'bg-brand-red text-white'
                      : 'bg-brand-cream-dark text-text-secondary'
                )}
              >
                {isCompleted ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <span>{idx + 1}</span>
                )}
              </div>
              <span
                className={cn(
                  'text-xs mt-1 whitespace-nowrap',
                  isActive ? 'text-brand-red font-medium' : 'text-text-secondary'
                )}
              >
                {step.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={cn(
                  'h-0.5 flex-1 mx-1',
                  idx < currentIndex ? 'bg-success' : 'bg-brand-cream-dark'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}