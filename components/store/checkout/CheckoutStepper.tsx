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
  onStepClick?: (stepId: string) => void;
  className?: string;
}

export function CheckoutStepper({ steps, currentStepId, onStepClick, className }: CheckoutStepperProps) {
  const currentIndex = steps.findIndex((s) => s.id === currentStepId);

  return (
    <div className={cn('flex items-center justify-between', className)}>
      {steps.map((step, idx) => {
        const isActive = idx === currentIndex;
        const isCompleted = idx < currentIndex;

        return (
          <div key={step.id} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <button
                type="button"
                onClick={() => onStepClick && isCompleted && onStepClick(step.id)}
                disabled={!onStepClick || (!isCompleted && !isActive)}
                className={cn(
                  'w-11 h-11 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
                  isCompleted && onStepClick
                    ? 'bg-success text-white cursor-pointer hover:opacity-80'
                    : isActive
                      ? 'bg-brand-red text-white cursor-default'
                      : 'bg-brand-cream-dark text-text-secondary',
                  (!isCompleted && !isActive) && 'cursor-not-allowed'
                )}
                aria-label={`Langkah ${idx + 1}: ${step.label}`}
              >
                {isCompleted ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <span>{idx + 1}</span>
                )}
              </button>
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