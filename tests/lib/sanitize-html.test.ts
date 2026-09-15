import { describe, it, expect } from 'vitest';
import {
  sanitizeRichText,
  sanitizeCmsHtml,
  sanitizeNullableCmsHtml,
  sanitizeExcerpt,
  sanitizePlainText,
} from '@/lib/utils/sanitize-html';

describe('sanitize-html (isomorphic-dompurify policies)', () => {
  it('strips <script> tags but keeps text', () => {
    expect(sanitizeRichText('<p>Hello</p><script>alert(1)</script>')).toBe('<p>Hello</p>');
  });

  it('strips event-handler attributes (img onerror)', () => {
    const out = sanitizeRichText('<img src="x.jpg" onerror="alert(1)" alt="x">');
    expect(out).not.toContain('onerror');
    expect(out).toContain('src="x.jpg"');
  });

  it('rejects javascript: URLs in anchors', () => {
    const out = sanitizeRichText('<a href="javascript:alert(1)">click</a>');
    expect(out).not.toContain('javascript:');
    expect(out).toContain('click');
  });

  it('strips svg/onload vectors entirely', () => {
    const out = sanitizeRichText('<svg onload="alert(1)"><circle r="10"/>');
    expect(out).not.toContain('onload');
    expect(out).not.toContain('<svg');
  });

  it('forces rel=noopener noreferrer on target=_blank links', () => {
    const out = sanitizeRichText('<a href="https://example.com" target="_blank">x</a>');
    expect(out).toContain('noopener');
    expect(out).toContain('noreferrer');
  });

  it('strips inline style attributes', () => {
    const out = sanitizeRichText('<p style="color:expression(alert(1))">x</p>');
    expect(out).not.toContain('style=');
    expect(out).toContain('x');
  });

  it('keeps legitimate TipTap formatting', () => {
    const html =
      '<h2>Title</h2><p><strong>Bold</strong> and <em>italic</em></p>' +
      '<ul><li>one</li></ul><blockquote>quote</blockquote><pre><code>code</code></pre>';
    expect(sanitizeRichText(html)).toBe(html);
  });

  it('sanitizePlainText strips all tags but keeps text', () => {
    expect(sanitizePlainText('<b>Hello</b> <script>alert(1)</script>world')).toBe('Hello world');
  });

  it('sanitizeExcerpt drops images', () => {
    const out = sanitizeExcerpt('<p>Hi</p><img src="x.jpg">');
    expect(out).toContain('Hi');
    expect(out).not.toContain('<img');
  });

  it('sanitizeCmsHtml allows class but still blocks XSS', () => {
    const out = sanitizeCmsHtml('<p class="lead">Hi</p><script>alert(1)</script>');
    expect(out).toContain('class="lead"');
    expect(out).not.toContain('<script');
  });

  it('sanitizeNullableCmsHtml preserves null semantics', () => {
    expect(sanitizeNullableCmsHtml(null)).toBeNull();
    expect(sanitizeNullableCmsHtml(undefined)).toBeNull();
    expect(sanitizeNullableCmsHtml('')).toBeNull();
    expect(sanitizeNullableCmsHtml('<p>x</p>')).toBe('<p>x</p>');
  });

  it('handles empty input without throwing', () => {
    expect(sanitizeRichText('')).toBe('');
    expect(sanitizeRichText(null)).toBe('');
    expect(sanitizePlainText(undefined)).toBe('');
  });
});