'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

export interface AreaSuggestion {
  id: string;
  name: string;
  postal_code?: number;
}

interface AreaSearchInputProps {
  onSelect: (area: AreaSuggestion) => void;
}

/**
 * Biteship area search — works without Google Maps so delivery UX stays usable
 * when Maps JS fails to load.
 */
export function AreaSearchInput({ onSelect }: AreaSearchInputProps): React.ReactElement {
  const t = useTranslations('checkout');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AreaSuggestion[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (query.trim().length < 3) {
      setResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(
          `/api/shipping/maps/autocomplete?query=${encodeURIComponent(query.trim())}`
        );
        const json = (await res.json()) as {
          success: boolean;
          data?: { areas?: AreaSuggestion[] };
          error?: string;
        };
        if (!json.success) {
          setError(json.error ?? t('addressSearchFailed'));
          setResults([]);
          return;
        }
        setResults(json.data?.areas ?? []);
      } catch {
        setError(t('addressSearchFailed'));
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(handle);
  }, [query, t]);

  return (
    <div className="space-y-2">
      <Label htmlFor="area-search">{t('addressSearchPlaceholder')}</Label>
      <div className="relative">
        <Input
          id="area-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('addressSearchPlaceholder')}
          className="pr-9"
          autoComplete="off"
        />
        {loading ? (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-text-muted" />
        ) : null}
      </div>
      {error ? <p className="text-xs text-error">{error}</p> : null}
      {results.length > 0 ? (
        <ul className="border border-brand-cream-dark rounded-lg max-h-40 overflow-y-auto bg-white divide-y divide-brand-cream-dark">
          {results.slice(0, 8).map((area) => (
            <li key={area.id}>
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-brand-cream-dark/40"
                onClick={() => {
                  onSelect(area);
                  setQuery(area.name);
                  setResults([]);
                }}
              >
                {area.name}
                {area.postal_code ? ` (${area.postal_code})` : ''}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
