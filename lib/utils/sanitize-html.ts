import DOMPurify from 'isomorphic-dompurify';

/**
 * Centralized HTML sanitization policies (isomorphic-dompurify).
 *
 * WHY: five call sites each carried their own inline allowlist (blog write,
 * blog render, CMS write, CMS render, excerpts). Divergent policies mean a tag
 * stripped in one place but allowed in another — and any future policy change
 * requires touching N files. All HTML that reaches `dangerouslySetInnerHTML`
 * or the database must go through one of the helpers below.
 *
 * Policies:
 * - `sanitizeRichText` — TipTap blog output (write-time AND render-time).
 * - `sanitizeCmsHtml`  — CMS page sections (allows `class` for layout hooks).
 * - `sanitizePlainText` — titles, slugs-adjacent text, meta, excerpts-as-text.
 *
 * Hardening applied on top of DOMPurify defaults:
 * - `target="_blank"` links always get `rel="noopener noreferrer"` (reverse
 *   tabnabbing) via an `afterSanitizeAttributes` hook.
 * - `javascript:` / `data:text/html` URLs are rejected by DOMPurify's default
 *   `ALLOWED_URI_REGEXP` — we do not widen it.
 */

const RICH_TEXT_TAGS = [
  'p', 'br',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'em', 'u', 's',
  'ul', 'ol', 'li',
  'a', 'img',
  'blockquote', 'code', 'pre', 'hr',
];

const RICH_TEXT_ATTR = ['href', 'src', 'alt', 'title', 'target', 'rel'];

const CMS_TAGS = RICH_TEXT_TAGS;

const CMS_ATTR = [...RICH_TEXT_ATTR, 'class'];

/** Excerpts: rich text minus `img` (matches the historical write policy). */
const EXCERPT_TAGS = RICH_TEXT_TAGS.filter((t) => t !== 'img');

const EXCERPT_ATTR = ['href', 'class', 'target', 'rel'];

let hookInstalled = false;

/**
 * Install the reverse-tabnabbing hook once per process. The hook is global to
 * the DOMPurify instance, so guard against double-registration (HMR / tests).
 */
function ensureHook(): void {
  if (hookInstalled) return;
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      const target = node.getAttribute('target');
      if (target === '_blank') {
        const rel = (node.getAttribute('rel') ?? '').split(/\s+/).filter(Boolean);
        for (const required of ['noopener', 'noreferrer']) {
          if (!rel.includes(required)) rel.push(required);
        }
        node.setAttribute('rel', rel.join(' '));
      }
    }
    // Defence in depth: never allow inline event handlers or style that
    // could carry `expression()` / `url(javascript:)` in legacy clients.
    if (node.hasAttribute('style')) node.removeAttribute('style');
  });
  hookInstalled = true;
}

/** TipTap blog HTML — use at write-time (admin API) and render-time (page). */
export function sanitizeRichText(html: string | null | undefined): string {
  if (!html) return '';
  ensureHook();
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: RICH_TEXT_TAGS,
    ALLOWED_ATTR: RICH_TEXT_ATTR,
  });
}

/** CMS section HTML — same base policy plus `class` for layout hooks. */
export function sanitizeCmsHtml(html: string | null | undefined): string {
  if (!html) return '';
  ensureHook();
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: CMS_TAGS,
    ALLOWED_ATTR: CMS_ATTR,
  });
}

/**
 * Nullable variant preserving the CMS route's null semantics:
 * empty/missing input stays `null` instead of becoming `''`.
 */
export function sanitizeNullableCmsHtml(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === '') return null;
  return sanitizeCmsHtml(value);
}

/** Blog excerpts — rich text without images. */
export function sanitizeExcerpt(html: string | null | undefined): string {
  if (!html) return '';
  ensureHook();
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: EXCERPT_TAGS,
    ALLOWED_ATTR: EXCERPT_ATTR,
  });
}

/** Strip ALL tags — titles, meta, slugs-adjacent text. Keeps inner text. */
export function sanitizePlainText(text: string | null | undefined): string {
  if (!text) return '';
  ensureHook();
  return DOMPurify.sanitize(text, { ALLOWED_TAGS: [] });
}

export const SANITIZE_POLICIES = {
  RICH_TEXT_TAGS,
  RICH_TEXT_ATTR,
  CMS_TAGS,
  CMS_ATTR,
  EXCERPT_TAGS,
  EXCERPT_ATTR,
} as const;