# AUDIT 07 — UI COMPONENT ISSUES & DESIGN VIOLATIONS
**Project:** DapurDekaka.com
**Date:** May 22, 2026
**Scope:** All `components/` files, `app/` pages with inline styles
**Severity Scale:** 🔴 CRITICAL · 🟠 HIGH · 🟡 MEDIUM · 🟢 LOW

---

## The Problem

CURSOR_RULES.md Section 15.3 mandates: "Always use shadcn/ui components. Never raw HTML inputs or inline styles." The audit found **extensive violations** across admin pages, blog forms, testimonials, and carousel components.

---

## 🔴 CRITICAL

### C-01: Raw `<textarea>` Used Instead of shadcn/ui `Textarea` — Blog Forms

**Files:**
- `app/(admin)/admin/blog/[id]/BlogEditClient.tsx` lines 213–226
- `app/(admin)/admin/blog/new/BlogNewClient.tsx` lines 175–188

```typescript
<textarea
 id="contentId"
 {...form.register('contentId')}
 className="w-full min-h-[80px] px-3 py-2 rounded-md border border-admin-border bg-white text-sm"
/textarea>
```

**Issue:** Native `<textarea>` with hardcoded className instead of shadcn/ui `Textarea` component. The project rules explicitly mandate shadcn/ui components exclusively.

**Fix:** Replace with:
```typescript
import { Textarea } from '@/components/ui/textarea';
// ...
<Textarea
 id="contentId"
 {...form.register('contentId')}
 className="w-full min-h-[80px]"
/>
```

---

### C-02: Raw `<textarea>` Used Instead of shadcn/ui `Textarea` — Testimonials Modal

**File:** `app/(admin)/admin/testimonials/page.tsx` lines 213–226

**Issue:** Same as C-01. Native `<textarea>` elements in the testimonial modal.

**Fix:** Same replacement with shadcn/ui `Textarea`.

---

## 🟠 HIGH

### H-01: Raw `<select>` Instead of shadcn/ui `Select` — Users Page Role Selector

**File:** `app/(admin)/admin/users/page.tsx` lines 202–212, 323–333

**Issue:** Two raw `<select>` elements for role editing and invite modal role selection. Project rules mandate shadcn/ui components.

**Fix:** Replace with shadcn/ui `Select`, `SelectTrigger`, `SelectContent`, `SelectItem` components.

---

### H-02: Raw `<select>` Instead of shadcn/ui `Select` — Coupon Form Type Selector

**File:** `components/admin/coupons/CouponForm.tsx` lines 111–119

**Fix:** Replace with shadcn/ui `Select` component.

---

### H-03: Raw `<select>` Instead of shadcn/ui `Select` — Carousel Form Type Selector

**File:** `components/admin/carousel/CarouselForm.tsx` lines 88–96

**Fix:** Replace with shadcn/ui `Select` component.

---

### H-04: Raw `<select>` Instead of shadcn/ui `Select` — B2B Inquiry Status Select

**File:** `app/(admin)/admin/b2b-inquiries/page.tsx` lines 56–57

```typescript
style={{ backgroundColor: 'inherit' }}
```

**Fix:** Replace with shadcn/ui `Select`. Remove inline style.

---

### H-05: Native `confirm()` Instead of Styled Modal — Products Bulk Delete

**File:** `app/(admin)/admin/products/ProductsClient.tsx` line 71

**Issue:** `confirm()` is a browser native dialog — not a styled modal. Inconsistent with the Points Adjust modal which uses a proper shadcn/ui Dialog.

**Fix:** Replace with a shadcn/ui `AlertDialog` component:
```typescript
import {
 AlertDialog,
 AlertDialogAction,
 AlertDialogCancel,
 AlertDialogContent,
 AlertDialogDescription,
 AlertDialogFooter,
 AlertDialogHeader,
 AlertDialogTitle,
 AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
```

---

### H-06: Inline Style Hack — B2B Inquiry Status Select Background

**File:** `app/(admin)/admin/b2b-inquiries/page.tsx` lines 56–57

```typescript
style={{ backgroundColor: 'inherit' }}
```

**Issue:** Inline style override. Should be a CSS class.

**Fix:** Remove inline style, use appropriate Tailwind class.

---

### H-07: Hardcoded `#0F172A` and `#1E293B` Instead of Design Tokens — Users Page

**File:** `app/(admin)/admin/users/page.tsx` lines 169, 351

**Issue:** Uses `bg-[#0F172A]` and `bg-[#1E293B]` — not using design system tokens. Project rules: "Never use arbitrary Tailwind color values."

**Fix:** Use CSS variable `--admin-sidebar` or a dedicated admin color token. Add to Tailwind config if needed:
```typescript
// tailwind.config.ts
theme: {
 extend: {
  colors: {
   'admin-sidebar': '#0F172A',
   'admin-sidebar-hover': '#1E293B',
  }
 }
}
```

---

### H-08: Inline Style in Order Tracking Timeline Colors

**File:** `app/(store)/orders/[orderNumber]/OrderTrackingClient.tsx` lines 47–64

**Issue:** `TIMELINE_STEPS` array uses hardcoded color strings (e.g., `'#22c55e'`) stored in data, not CSS custom properties. These inline colors are applied via inline styles in the JSX.

**Fix:** Use CSS custom properties or design system color tokens:
```typescript
const stepStyles = {
 pending: 'border-slate-300 text-slate-400',
 active: 'border-brand-red text-brand-red',
 completed: 'border-green-500 text-green-500',
};
```

---

## 🟡 MEDIUM

### M-01: Raw `<textarea>` — Any Others in Codebase?

**Files:** Potentially other un-audited admin pages

**Action:** Run a grep for `<textarea` across the codebase and replace all with shadcn/ui `Textarea`.

---

### M-02: Native `<input type="number">` for Points Redeem Value

**File:** `components/store/checkout/PointsRedeemer.tsx` (if using native input)

**Action:** Verify all form inputs use shadcn/ui components, not native HTML elements with className overrides.

---

### M-03: Plain Text Loading Fallback — Settings Page

**File:** `app/(admin)/admin/settings/page.tsx` line 127

```typescript
return <div className="p-6 text-gray-500">Memuat...</div>;
```

**Issue:** Not a skeleton, just plain text.

**Fix:** Create `app/(admin)/admin/settings/loading.tsx` using `Skeleton` component from shadcn/ui.

---

### M-04: Plain Text Loading Fallback — Users Page

**File:** `app/(admin)/admin/users/page.tsx` line 158

**Fix:** Create `loading.tsx` with skeleton.

---

### M-05: Emoji in Empty State — ProductCatalog

**File:** `components/store/products/ProductCatalog.tsx` line 197

```typescript
<p className="text-5xl mb-4">😕</p>
```

**Issue:** Emoji in production UI. The tone and style rules say: "Only use emojis if the user explicitly requests it."

**Fix:** Replace with a proper SVG empty state illustration (sad bowl, empty box, etc.).

---

### M-06: Emoji in Account Orders Empty State

**File:** `app/(store)/account/orders/page.tsx` (empty state rendering)

**Issue:** Potentially emoji-based empty state.

**Fix:** Replace with branded SVG illustration.

---

### M-07: Emoji in Cart Empty State

**File:** `app/(store)/cart/page.tsx` (empty state)

**Issue:** Potentially emoji-based empty state.

**Fix:** Replace with branded SVG illustration.

---

### M-08: WhatsApp Button — Hardcoded `#25D366`

**File:** `components/store/layout/WhatsAppButton.tsx` line 42

```typescript
className="bg-[#25D366] hover:bg-[#1DA851]"
```

**Issue:** Arbitrary hex value `#25D366`. Should be a design token.

**Fix:** Add to Tailwind config:
```typescript
colors: {
 'whatsapp-green': '#25D366',
 'whatsapp-green-dark': '#1DA851',
}
```

---

### M-09: InquiryStatusUpdate — Button Variant + Custom ClassName Mix

**File:** `components/admin/b2b/InquiryStatusUpdate.tsx` lines 51–55

```typescript
variant={status === option.value ? 'default' : 'outline'}
className={status === option.value ? 'bg-brand-red text-white' : ''}
```

**Issue:** Mixing `variant` prop with custom `className` for active state. Fragile — changing the `default` variant would break the active state styling.

**Fix:** Use conditional className only, without relying on variant state for active appearance:
```typescript
className={cn(
 'text-sm px-3 py-1 rounded-full transition-colors',
 status === option.value
 ? 'bg-brand-red text-white'
 : 'bg-white text-text-primary border border-admin-border'
)}
```

---

## 🟢 LOW

### L-01: Order Detail — Plain Text `←` for Back Button

**File:** `app/(admin)/admin/orders/[id]/page.tsx` line 234

**Issue:** Uses `←` plain text instead of `ChevronLeft` from lucide-react.

**Fix:** Import and use `ChevronLeft` icon.

---

### L-02: Hardcoded Color Values in Admin Testimonials

**File:** `app/(admin)/admin/testimonials/page.tsx` (if inline color values in status badges)

**Action:** Audit all admin pages for raw hex values in className attributes.

---

### L-03: Loading States — Use Skeleton Component Not Div

**File:** Multiple pages

**General rule:** Replace `<div className="p-6 text-gray-500">Memuat...</div>` with shadcn/ui `Skeleton` components.

---

## QUICK FIX CHECKLIST

Run this grep to find all violations:
```bash
grep -rn "<textarea\|<select\|className=\"bg-\[#\|style={{\|confirm(" components/ app/(admin)/
```

Then fix each one:
1. `<textarea` → shadcn/ui `Textarea`
2. `<select` → shadcn/ui `Select`
3. `bg-[#` → design token or CSS variable
4. `style={{` → CSS class
5. `confirm(` → shadcn/ui `AlertDialog`
6. Emoji `😕` → SVG illustration

---

## SUMMARY

| ID | Severity | File | Issue | Fix Action |
|----|----------|------|-------|------------|
| C-01 | 🔴 CRITICAL | `BlogEditClient.tsx:213`, `BlogNewClient.tsx:175` | Raw `<textarea>` instead of shadcn/ui Textarea | Replace with Textarea component |
| C-02 | 🔴 CRITICAL | `testimonials/page.tsx:213` | Raw `<textarea>` instead of shadcn/ui Textarea | Replace with Textarea component |
| H-01 | 🟠 HIGH | `users/page.tsx:202,323` | Raw `<select>` instead of shadcn/ui Select | Replace with Select component |
| H-02 | 🟠 HIGH | `CouponForm.tsx:111` | Raw `<select>` instead of shadcn/ui Select | Replace with Select component |
| H-03 | 🟠 HIGH | `CarouselForm.tsx:88` | Raw `<select>` instead of shadcn/ui Select | Replace with Select component |
| H-04 | 🟠 HIGH | `b2b-inquiries/page.tsx:56` | Raw `<select>` instead of shadcn/ui Select | Replace with Select component |
| H-05 | 🟠 HIGH | `ProductsClient.tsx:71` | Native `confirm()` instead of AlertDialog | Replace with AlertDialog |
| H-06 | 🟠 HIGH | `b2b-inquiries/page.tsx:56` | Inline style override | Remove inline style |
| H-07 | 🟠 HIGH | `users/page.tsx:169,351` | Hardcoded `#0F172A` | Add to design tokens |
| H-08 | 🟠 HIGH | `OrderTrackingClient.tsx:47` | Inline hardcoded colors in timeline | Use CSS custom properties |
| M-01 | 🟡 MEDIUM | All pages | Audit all `<textarea` occurrences | Grep and replace all |
| M-02 | 🟡 MEDIUM | Checkout components | Audit `<input` occurrences | Replace with shadcn/ui Input |
| M-03 | 🟡 MEDIUM | `settings/page.tsx:127` | Plain text loading fallback | Create loading.tsx with Skeleton |
| M-04 | 🟡 MEDIUM | `users/page.tsx:158` | Plain text loading fallback | Create loading.tsx with Skeleton |
| M-05 | 🟡 MEDIUM | `ProductCatalog.tsx:197` | Emoji 😕 in empty state | Replace with SVG |
| M-06 | 🟡 MEDIUM | Account orders | Emoji in empty state | Replace with SVG |
| M-07 | 🟡 MEDIUM | Cart page | Emoji in empty state | Replace with SVG |
| M-08 | 🟡 MEDIUM | `WhatsAppButton.tsx:42` | Hardcoded `#25D366` | Add to design tokens |
| M-09 | 🟡 MEDIUM | `InquiryStatusUpdate.tsx:51` | Variant + className mix for active | Use className only |
| L-01 | 🟢 LOW | `orders/[id]/page.tsx:234` | Plain text back button | Use ChevronLeft icon |
| L-02 | 🟢 LOW | Various admin pages | Audit hardcoded hex values | Replace with design tokens |
| L-03 | 🟢 LOW | Multiple pages | Loading div vs Skeleton | Replace with Skeleton component |

**Total: 2 CRITICAL · 9 HIGH · 11 MEDIUM · 3 LOW**