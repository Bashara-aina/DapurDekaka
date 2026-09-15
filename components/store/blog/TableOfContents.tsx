'use client';
import { useEffect, useState } from 'react';

interface TocItem {
  id: string;
  text: string;
  level: 2 | 3;
}

export function TableOfContents({ contentHtml }: { contentHtml: string }) {
  const [activeId, setActiveId] = useState<string>('');
  const [items, setItems] = useState<TocItem[]>([]);

  useEffect(() => {
    // Parse headings from rendered HTML
    const headings = document.querySelectorAll('article h2, article h3');
    const tocItems: TocItem[] = [];

    headings.forEach((heading) => {
      if (!heading.id) {
        // Auto-generate ID from text
        heading.id = heading.textContent
          ?.toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .substring(0, 50) || '';
      }
      tocItems.push({
        id: heading.id,
        text: heading.textContent || '',
        level: heading.tagName === 'H2' ? 2 : 3,
      });
    });

    setItems(tocItems);
  }, [contentHtml]);

  useEffect(() => {
    if (items.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: '-20% 0px -70% 0px' }
    );

    items.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [items]);

  if (items.length < 3) return null; // Only show ToC if there are 3+ headings

  return (
    <nav aria-label="Daftar isi artikel">
      <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
        Daftar Isi
      </p>
      <ul className="space-y-1 border-l-2 border-brand-cream-dark">
        {items.map((item) => (
          <li key={item.id} className={item.level === 3 ? 'pl-4' : ''}>
            <a
              href={`#${item.id}`}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' });
              }}
              className={`-ml-0.5 block border-l-2 py-1 pl-3 pr-2 text-sm leading-relaxed transition-colors ${
                activeId === item.id
                  ? 'border-brand-red text-brand-red font-medium'
                  : 'border-transparent text-text-secondary hover:border-brand-cream-darker hover:text-text-primary'
              }`}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
