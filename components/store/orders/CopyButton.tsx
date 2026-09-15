'use client';

import { useState } from 'react';
import { Copy, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface CopyButtonProps {
  text: string;
  className?: string;
}

export function CopyButton({ text, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={cn(
        'min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md transition-colors',
        copied ? 'text-success' : 'text-text-secondary hover:text-brand-red',
        className
      )}
      title={copied ? 'Tersalin!' : 'Salin'}
      aria-label={copied ? 'Tersalin!' : 'Salin'}
    >
      {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
    </button>
  );
}