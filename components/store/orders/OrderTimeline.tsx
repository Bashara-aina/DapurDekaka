'use client';

import { CheckCircle, Circle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface TimelineStep {
  label: string;
  description?: string;
}

interface OrderTimelineProps {
  steps: TimelineStep[];
  currentStepIndex: number;
  className?: string;
}

export function OrderTimeline({ steps, currentStepIndex, className }: OrderTimelineProps) {
  return (
    <div className={cn('flex flex-col gap-0', className)}>
      {steps.map((step, idx) => {
        const isCompleted = idx < currentStepIndex;
        const isActive = idx === currentStepIndex;
        const isPending = idx > currentStepIndex;

        return (
          <div key={idx} className="flex gap-4">
            {/* Icon column */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                  isCompleted
                    ? 'bg-success text-white'
                    : isActive
                      ? 'bg-brand-red text-white'
                      : 'bg-brand-cream-dark text-text-secondary'
                )}
              >
                {isCompleted ? (
                  <CheckCircle className="w-4 h-4" />
                ) : isActive ? (
                  <Clock className="w-4 h-4 animate-pulse" />
                ) : (
                  <Circle className="w-4 h-4" />
                )}
              </div>
              {idx < steps.length - 1 && (
                <div
                  className={cn(
                    'w-0.5 flex-1 min-h-[40px]',
                    idx < currentStepIndex ? 'bg-success' : 'bg-brand-cream-dark'
                  )}
                />
              )}
            </div>

            {/* Content */}
            <div className={cn('pb-8', idx === steps.length - 1 && 'pb-0')}>
              <p
                className={cn(
                  'font-medium',
                  isActive
                    ? 'text-brand-red'
                    : isCompleted
                      ? 'text-text-primary'
                      : 'text-text-secondary'
                )}
              >
                {step.label}
              </p>
              {step.description && (
                <p className="text-xs text-text-secondary mt-0.5">
                  {step.description}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}