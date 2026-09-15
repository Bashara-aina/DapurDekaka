# AI Slop Patterns: Comprehensive Reference for Next.js 14, React, TypeScript, Drizzle ORM & PostgreSQL

> Compiled from scanaislop.com, dev.to/bzprchny, futurecraft.pro, managed-code.com, grcengineering.substack.com, github.com/mcclowes (nextjs-anti-patterns), github.com/honra-io (drizzle-best-practices), nextjs.org docs, and direct production experience.

AI slop is code that compiles, passes review at a glance, and quietly degrades the codebase: near-duplicate helpers, unnecessary abstraction, pattern drift, swallowed exceptions, hollow tests, ceremonial comments. It is hard to catch by reading because each piece looks reasonable in isolation. The damage is cumulative.

---

## Table of Contents

1. [Universal AI Slop Patterns (14 named)](#1-universal-ai-slop-patterns)
2. [Hallucination & Stale-API Patterns](#2-hallucination--stale-api-patterns)
3. [TypeScript & Type-Safety Patterns](#3-typescript--type-safety-patterns)
4. [React Component Patterns](#4-react-component-patterns)
5. [Next.js 14 App Router Patterns](#5-nextjs-14-app-router-patterns)
6. [Drizzle ORM Patterns](#6-drizzle-orm-patterns)
7. [PostgreSQL Patterns](#7-postgresql-patterns)
8. [E-commerce / Food-Ordering Patterns](#8-ecommerce--food-ordering-patterns)
9. [Testing & Quality Patterns](#9-testing--quality-patterns)
10. [Security Patterns](#10-security-patterns)
11. [Project Hygiene Patterns](#11-project-hygiene-patterns)

---

## 1. Universal AI Slop Patterns

These are the 14 named, machine-detectable patterns from the aislop standard. They cover the highest-signal slop that survives a casual review.

### P-001 — Narrative Comment

**Looks like:**
```ts
// This function takes a user ID and a list of orders,
// filters the orders to only those belonging to the user,
// then sums the total amount across them and returns it.
function sumUserOrders(userId: string, orders: Order[]): number {
  return orders
    .filter(o => o.userId === userId)
    .reduce((sum, o) => sum + o.amount, 0);
}
```

**Why bad:** The signature already says what it does. The prose adds volume without information. Humans write the signature or a comment about *why*; agents pad with prose.

**Fix:** Delete the prose. Keep only comments that explain intent, a constraint, or an external contract.

**Detect:** `rg -B1 "^function|^const \w+ = " -A2` to see comment-block-then-declaration shapes; ESLint rule `no-multi-comment-restate`.

---

### P-002 — Trivial Comment

**Looks like:**
```ts
// Increment counter
count++;
// Get user by ID
const user = await getUser(id);
// Return result
return result;
```

**Why bad:** Removing it changes nothing. The line is already self-evident.

**Fix:** Delete or replace with the *why* (e.g., "skip the sentinel value, the loader pre-fills 0").

**Detect:** ESLint `no-restricted-syntax` matching `// <verb> <noun>` patterns above trivial statements.

---

### P-003 — Swallowed Exception

**Looks like:**
```ts
try {
  await processPayment(order);
} catch (e) {
  // ignore
}

try {
  const r = await fetch(url);
  return r.json();
} catch (e) {
  return null;
}
```

**Why bad:** Failures vanish. Outage at 3 AM with no log line anywhere.

**Fix:** Log with context (`log.error('payment failed', { orderId, error })`), rethrow, or return a typed failure result the caller can branch on.

**Detect:** `rg "} catch" -A2 | rg -e "^\s*//" -e "^\s*$"`.

---

### P-004 — Unsafe Type Assertion (`as any`)

**Looks like:**
```ts
const user = res.data as any;
user.profile.preferences.theme = 'dark';

function handleSubmit(e: any) { ... }
const data: any[] = [];
```

**Why bad:** Bypasses the type system entirely. Every guarantee downstream is gone.

**Fix:** Validate at the boundary (`UserSchema.parse(res.data)`); model the shape; use a type guard.

**Detect:** `rg " as any\b" --type ts --type tsx`; ESLint `@typescript-eslint/no-explicit-any: error`.

---

### P-005 — Double Type Assertion (`as unknown as X`)

**Looks like:**
```ts
const config = data as unknown as Config;
```

**Why bad:** Smuggles types past the compiler when a direct cast is refused. Hides the real shape mismatch.

**Fix:** Validate and parse; do not chain unknown-then-assert. Use a Zod schema.

**Detect:** `rg " as unknown as " --type ts`.

---

### P-006 — Unexplained TypeScript Directive

**Looks like:**
```ts
// @ts-ignore
legacyClient.createSubscription(payload);

// @ts-nocheck
```

**Why bad:** Silences the type checker forever. Without a reason + ticket, no one can remove it safely.

**Fix:** Fix the type error, or write the narrowest directive with a reason and ticket: `// @ts-expect-error SDK-421 legacy client types lag retryPolicy`.

**Detect:** `rg "@ts-(ignore|expect-error|nocheck)" -A1`.

---

### P-007 — Orphan TODO Stub

**Looks like:**
```ts
// TODO: handle error case
function process() { ... }

// TODO: optimize this query
```

**Why bad:** TODOs without owner, ticket, or plan survive for years.

**Fix:** Every TODO must include `@owner` + ticket: `// TODO(@alice): PROJ-321 handle currency rounding`. Or open the issue immediately.

**Detect:** `rg "TODO[: ]" -B0 | rg -v "TODO\(@\w+\):"`.

---

### P-008 — Generic Naming

**Looks like:**
```ts
function process(data: any) {
  const result = data.map((item: any) => item.value * 2);
  return result;
}
```

**Why bad:** Names that say "this is a noun" without saying which noun. The reader has to infer role from context — every time.

**Fix:** `function doublePrices(products: Product[]): number[]`.

**Detect:** AST rule flagging identifiers `data|result|value|temp|obj|info|item|response` on declarations, scoped to safe-to-rename.

---

### P-009 — Unused Import

**Looks like:**
```ts
import { useEffect, useState, useMemo } from 'react';
import { formatDate } from '../utils/dates';

export function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}
```

**Why bad:** Lingers after a refactor the agent forgot to follow through on. Suggests a partial edit.

**Fix:** Delete. Enable `no-unused-imports` ESLint rule as error.

**Detect:** `rg "^import" | rg -v "^\s*//"` then grep each binding against the file.

---

### P-010 — Console Leftover

**Looks like:**
```ts
function reconcile(orders: Order[]) {
  console.log('reconciling', orders.length);
  for (const o of orders) {
    console.log('processing', o.id, o);
    process(o);
  }
}
```

**Why bad:** Debug output shipped to production. Noisy, untyped, ungrep-able.

**Fix:** Remove or replace with structured logger (`log.debug('reconciling', { count })`).

**Detect:** `rg "console\.(log|debug|info)" --type ts --type tsx`; ESLint `no-console` (warn in prod).

---

### P-011 — Empty Function

**Looks like:**
```ts
async function onSubmit() {
  // TODO
}

const noopHandler = () => {};
```

**Why bad:** Placeholder the agent stubbed to make a signature compile and forgot to fill in. Or a no-op handler that hides missing wiring.

**Fix:** Implement, or return a typed rejection so the gap is loud.

**Detect:** AST match: arrow/function bodies with only whitespace/comments.

---

### P-012 — Unreachable Code

**Looks like:**
```ts
function getStatus(order: Order) {
  return order.status;
  console.log('done');
}

for (const x of items) {
  if (x.bad) continue;
  return x;
  process(x);
}
```

**Why bad:** Code after a `return`, `throw`, `break`, `continue` that can never execute. A refactor half-done.

**Fix:** Delete.

**Detect:** AST control-flow analysis; ESLint `no-unreachable` and `no-fallthrough`.

---

### P-013 — Constant Condition

**Looks like:**
```ts
if (true) doWork();
if (1) doOther();
while (false) { /* never runs */ }
```

**Why bad:** A dead branch left in source. Indicates a feature-flag stub the agent forgot to remove.

**Fix:** Replace with a real condition or delete the branch.

**Detect:** AST match: conditionals whose test is a literal boolean or numeric constant.

---

### P-014 — Thin Wrapper

**Looks like:**
```ts
// users.ts
export function getUser(id: string) {
  return userService.getUser(id);
}

// profile.ts
import { getUser } from './some/file';
const user = await getUser(id);
```

**Why bad:** A function that exists only to forward arguments unchanged. Doubles the import surface, hides the actual call.

**Fix:** Delete the wrapper. Call `userService.getUser` directly.

**Detect:** AST match: function whose body is a single `return <expr>(<params>)` with identical arguments.

---

## 2. Hallucination & Stale-API Patterns

### P-015 — Hallucinated Import

**Looks like:**
```ts
import { validateSchema } from 'express-validator-utils';
import { ensureDir } from 'fs-extra-native';
```

**Why bad:** Plausible-sounding package names that don't exist on npm. Builds fail (or, worse, install typosquats).

**Fix:** Use `npm view <pkg>` to verify, or rely on TypeScript type-check on import. Use package-lock as ground truth.

**Detect:** Diff package-lock against imports; `npx depcheck` plus a name-coverage check.

---

### P-016 — Stale/Deprecated API (Node)

**Looks like:**
```ts
const buf = new Buffer('hello');           // deprecated since Node 6
const parsed = url.parse(req.url);         // deprecated since Node 11
app.use(bodyParser.json());                // built into Express 4.16+
```

**Fix:** `Buffer.from`, `new URL(req.url, base)`, `express.json()`.

**Detect:** `rg "new Buffer\b|require\('url'\)\.parse|bodyParser" --type js --type ts`.

---

### P-017 — Stale/Deprecated API (React)

**Looks like:**
```ts
import PropTypes from 'prop-types';
import { render } from 'react-dom';
componentWillMount() { ... }
```

**Fix:** Use TypeScript instead of PropTypes; `react-dom/client` `createRoot`; hooks for lifecycle.

**Detect:** `rg "react-dom(?!/client)|PropTypes|componentWill(Mount|Receive|Update)" --type ts --type tsx`.

---

### P-018 — Stale/Deprecated API (Next.js)

**Looks like:**
```ts
import { getServerSideProps } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router'; // Pages Router only
```

**Why bad:** Pages-Router APIs don't exist in App Router. In App Router, async Server Components replace `getServerSideProps`; `next/head` doesn't exist; `next/router` is wrong.

**Fix:** Async Server Component for `getServerSideProps`; `export const metadata` for `<Head>`; `next/navigation` `useRouter`.

**Detect:** `rg "from 'next/router'|next/head|getServerSideProps|getStaticProps" --type ts`.

---

### P-019 — Wrong Enum Case (AI guesses language convention not library)

**Looks like:**
```ts
const marker = await manager.create({
  iconAnchor: IconAnchor.bottom, // Should be IconAnchor.BOTTOM in this SDK
});
```

**Fix:** Check the installed SDK version's enums; rely on TypeScript to catch the wrong case.

**Detect:** Manual review when an enum value is being written.

---

### P-020 — Confident Comment Lie

**Looks like:**
```ts
// On rate limit error, Supabase automatically retries after 5 seconds
await supabase.from('x').select();

// bcrypt automatically salts — no need to call genSalt
const hash = await bcrypt.hash(pw, 1);
```

**Why bad:** The model fabricates library behavior. Comments are not verified. Users believe them.

**Fix:** Delete comments describing "automatic" / "built-in" / "by default" behavior. Verify against docs and `cmd+click`.

**Detect:** `rg "(automatic|by default|built-in|out of the box)" --type ts --type tsx`; cross-check against library docs.

---

### P-021 — Phantom Module Path

**Looks like:**
```ts
import { UserService } from '@/services/user-service';
// File actually at /services/users.ts or /data/user.ts
```

**Fix:** Use TypeScript path resolution and IDE go-to-definition; CI step that resolves every import.

**Detect:** `tsc --noEmit` with `noUnusedLocals` plus `tsc-alias` to catch phantom paths.

---

## 3. TypeScript & Type-Safety Patterns

### P-022 — `any` for User Input

**Looks like:**
```ts
export async function POST(req: Request) {
  const body: any = await req.json();
  return db.insert(orders).values(body);
}
```

**Why bad:** Disables validation, opens SQL injection (when passed to raw SQL) or wrong-shape errors (when passed to ORM).

**Fix:** `const body = OrderInputSchema.parse(await req.json())` (Zod).

**Detect:** `rg ": any[>;,)]|as any\b|: any\[\]" --type ts`.

---

### P-023 — `any` in Generic Position

**Looks like:**
```ts
function identity<T = any>(x: T): T { return x; }
const list: Array<any> = [];
```

**Fix:** Default to `unknown` or an actual type; never `any`.

**Detect:** `@typescript-eslint/no-explicit-any: error`; banned-imports list.

---

### P-024 — Non-null Assertion (`!`) Abuse

**Looks like:**
```ts
const user = await db.users.findUnique({ where: { id } })!;
user.email; // runtime NPE risk
```

**Why bad:** Silences TS but the value can still be null. The narrowest claim (`!`) is rarely true.

**Fix:** Handle the null branch explicitly. `const user = await ...; if (!user) throw new NotFoundError();`.

**Detect:** `rg "![\.\)\],;]" --type ts` (rough); ESLint `no-non-null-assertion: warn`.

---

### P-025 — Type Predicate Never Used

**Looks like:**
```ts
function isString(x: unknown): x is string {
  return typeof x === 'string';
}
// Never called anywhere; intent was to narrow but agent forgot
```

**Fix:** Either call the predicate at the boundary or delete it.

**Detect:** Cross-reference each predicate with call sites; `knip` or similar dead-code tool.

---

### P-026 — Object Spread to Merge Loses Type

**Looks like:**
```ts
const merged = { ...defaults, ...overrides } as Config;
```

**Fix:** Let inference work; add `satisfies Config` so the merged shape is validated.

**Detect:** Spot-check `as ...` after spread expressions.

---

### P-027 — `as const` Missing

**Looks like:**
```ts
const STATUSES = ['pending', 'paid', 'shipped'];
// Later: if (status === 'Pending') // typo, never matches
```

**Fix:** `const STATUSES = ['pending', 'paid', 'shipped'] as const;`.

**Detect:** Lint rule requiring `as const` on enum-like arrays.

---

### P-028 — String-Literal Unions Without Validation

**Looks like:**
```ts
type Status = 'pending' | 'paid' | 'shipped';
// No zod parser; comes from req.body, could be anything
```

**Fix:** `z.enum(['pending','paid','shipped'])`; the runtime value is validated.

**Detect:** Diff between `type X =` declarations and Zod schema declarations.

---

### P-029 — Promise<any> Return

**Looks like:**
```ts
async function fetchOrder(id: string): Promise<any> { ... }
```

**Fix:** Concrete type. For unknown shapes, use `Promise<unknown>` and validate at boundary.

**Detect:** `rg "Promise<any>"`.

---

### P-030 — Empty Interface

**Looks like:**
```ts
interface UserProps {}
interface OrderFilters {}
```

**Why bad:** Either meaningless or a placeholder for future extension. AI loves them.

**Fix:** Use a type alias `type UserProps = Record<string, never>` if you really need it; otherwise delete.

**Detect:** `@typescript-eslint/no-empty-interface: error`.

---

## 4. React Component Patterns

### P-031 — `useEffect` for Data Fetching

**Looks like:**
```tsx
'use client';
import { useEffect, useState } from 'react';

export default function BlogPosts() {
  const [posts, setPosts] = useState([]);
  useEffect(() => {
    fetch('/api/posts').then(r => r.json()).then(setPosts);
  }, []);
  // ...
}
```

**Why bad:** Adds client JS, causes loading flicker, hydration mismatch risk, doesn't work without JS.

**Fix:** Async Server Component.

**Detect:** `rg "useEffect" -A4 | rg "fetch\|axios"`.

---

### P-032 — `useEffect` for Browser Detection

**Looks like:**
```tsx
'use client';
const [isSafari, setIsSafari] = useState(false);
useEffect(() => { setIsSafari(/Safari/.test(navigator.userAgent)); }, []);
```

**Fix:** Direct detection in component body with `typeof navigator !== 'undefined'` guard, or use CSS.

**Detect:** `rg "useEffect" -A3 | rg "navigator\.|window\."`.

---

### P-033 — `useEffect` for URL Access

**Looks like:**
```tsx
useEffect(() => { setUrl(window.location.href); }, []);
```

**Fix:** Read `window.location` directly inside the handler.

**Detect:** `rg "useEffect" -A3 | rg "window\.location"`.

---

### P-034 — `useState` for Server Data

**Looks like:**
```tsx
const [user, setUser] = useState(null);
useEffect(() => { fetch(`/api/users/${id}`).then(r => r.json()).then(setUser); }, [id]);
if (!user) return <div>Loading...</div>;
```

**Fix:** Async Server Component.

**Detect:** `rg "useState<.+>\(\)|useState\(\)" -B1 -A6 | rg "useEffect\|fetch"`.

---

### P-035 — `useState` for Derived Value

**Looks like:**
```tsx
const [total, setTotal] = useState(0);
useEffect(() => { setTotal(products.reduce((s, p) => s + p.price, 0)); }, [products]);
```

**Fix:** Calculate directly, or `useMemo` if expensive.

**Detect:** Same as P-034, with `.reduce|filter|map` in the effect.

---

### P-036 — Inline Object as Dependency

**Looks like:**
```tsx
useEffect(() => { ... }, [{ id: 1 }]); // new ref every render
```

**Fix:** Move to a stable reference, or omit the dep if it's effectively constant.

**Detect:** Lint `react-hooks/exhaustive-deps` already flags this.

---

### P-037 — Missing `key` Prop in Lists

**Looks like:**
```tsx
{items.map(item => <Card>{item.name}</Card>)}
```

**Why bad:** Triggers React warnings, breaks reconciliation when reordering.

**Fix:** `<Card key={item.id}>`.

**Detect:** `rg "\.map\(" -A2 | rg -v "key="`.

---

### P-038 — Index Used as `key`

**Looks like:**
```tsx
{items.map((item, i) => <Card key={i}>{item.name}</Card>)}
```

**Why bad:** Defeats reconciliation when items reorder; UI glitches.

**Fix:** Use a stable id.

**Detect:** `rg "key={i[)}\s,]"`.

---

### P-039 — `'use client'` on a Pure Render Component

**Looks like:**
```tsx
'use client';
export function Header({ title }: { title: string }) {
  return <h1>{title}</h1>;
}
```

**Why bad:** Ships JS to the client for a static tree. Removes SSR benefit.

**Fix:** Remove the directive.

**Detect:** `rg "['\"]use client['\"]" --type tsx` then review each for genuine interactivity.

---

### P-040 — `'use client'` at the Top of a Tree

**Looks like:**
```tsx
// app/page.tsx
'use client';
export default function Page() {
  return <div><Header /><StaticContent /><InteractiveButton /></div>;
}
```

**Why bad:** Forces the entire subtree client-side. Defeats RSC.

**Fix:** Server Component `Page`; push `'use client'` down to `InteractiveButton` only.

**Detect:** Review top-of-tree `'use client'` files.

---

### P-041 — Server Component Imported into Client Component

**Looks like:**
```tsx
'use client';
import ServerComp from './ServerComp'; // silently becomes a client component
```

**Why bad:** The "Server" component is actually rendered as a client component; loses server benefits.

**Fix:** Composition: parent Server Component renders `<ClientComp><ServerComp/></ClientComp>`.

**Detect:** AST rule: client-file importing non-client sibling.

---

### P-042 — Prop Drilling with No Context

**Looks like:**
```tsx
<Layout user={user}><Sidebar user={user}><List user={user}>...</List></Sidebar></Layout>
```

**Fix:** Use `React.Context` or, in App Router, fetch user in a Server Component and pass via composition.

**Detect:** Count identical props passed through 3+ layers.

---

### P-043 — Memoizing Without Need

**Looks like:**
```tsx
const fn = useCallback(() => doWork(x), [x]);
const Comp = React.memo(<Greeting name="World"/>);
```

**Fix:** Remove premature optimization; profile first.

**Detect:** Lint rule flagging `useCallback`/`useMemo` whose body is trivial.

---

### P-044 — `<button>` Without `type`

**Looks like:**
```tsx
<button onClick={submit}>Send</button>
```

**Why bad:** Defaults to `submit` inside a form, triggering submit unexpectedly.

**Fix:** `<button type="button" onClick={submit}>`.

**Detect:** `rg "<button" --type tsx | rg -v "type="`.

---

### P-045 — Form Submit Without `preventDefault`

**Looks like:**
```tsx
<form onSubmit={handleSubmit}>
```

**Fix:** `e.preventDefault()` first inside `handleSubmit`.

**Detect:** Form handlers without `preventDefault`.

---

### P-046 — Loading Spinner Without `aria-busy` / `aria-live`

**Looks like:**
```tsx
{loading && <Spinner />}
```

**Fix:** `role="status"` `aria-live="polite"` for screen readers.

**Detect:** Review loaders.

---

### P-047 — Inline Styles for Theming

**Looks like:**
```tsx
<div style={{ color: brand.primary, padding: 16 }}>
```

**Fix:** Tailwind / CSS variables / design tokens.

**Detect:** `rg "style=\{\{" --type tsx`.

---

### P-048 — Duplicated Handler With One Field Changed

**Looks like:**
```ts
async function createOrder(input) { ... }
async function createOrderV2(input) { ... }
async function createOrderNew(input) { ... }
```

**Why bad:** Three near-duplicates because the agent doesn't see them in context.

**Fix:** Extract `createOrder(input: CreateOrderInput)`; pass a versioned input if behavior differs.

**Detect:** Cross-file similarity (`jscpd`).

---

## 5. Next.js 14 App Router Patterns

### P-049 — `'use client'` Placed in `app/layout.tsx`

**Looks like:**
```tsx
// app/layout.tsx
'use client';
export default function RootLayout({ children }) {
  return <html><body>{children}</body></html>;
}
```

**Why bad:** Makes the entire app client-side. Defeats the App Router.

**Fix:** Server Component by default. Push `'use client'` to leaves.

**Detect:** `rg "use client" app/layout.tsx`.

---

### P-050 — `getServerSideProps` / `getStaticProps` in App Router

**Looks like:**
```tsx
export async function getServerSideProps() { ... }
```

**Why bad:** Pages-Router API; doesn't run in App Router.

**Fix:** Async Server Component with `cache: 'no-store'` or `revalidate`.

**Detect:** `rg "get(ServerSide|Static)Props"`.

---

### P-051 — `next/head` in App Router

**Looks like:**
```tsx
import Head from 'next/head';
```

**Fix:** `export const metadata: Metadata = { title, description }`.

**Detect:** `rg "next/head"`.

---

### P-052 — `next/router` (Pages Router) Used in App Router

**Looks like:**
```tsx
import { useRouter } from 'next/router';
```

**Fix:** `import { useRouter } from 'next/navigation';`.

**Detect:** `rg "from 'next/router'"`.

---

### P-053 — `useRouter` in a Server Component

**Looks like:**
```tsx
// Server Component
import { useRouter } from 'next/navigation';
const router = useRouter();
```

**Fix:** `redirect()` for declarative; or push `'use client'` only to the leaf that needs it.

**Detect:** `rg "useRouter" -B5 | rg "export default async function"`.

---

### P-054 — Serial `await` (Waterfall)

**Looks like:**
```tsx
export default async function Dashboard() {
  const user = await fetchUser();
  const posts = await fetchPosts();
  const comments = await fetchComments();
  // takes sum of all three, not max
  return ...
}
```

**Fix:** `Promise.all([fetchUser(), fetchPosts(), fetchComments()])`; or `<Suspense>` boundaries per child.

**Detect:** `rg "await" --type tsx | rg -v "Promise\.all"`.

---

### P-055 — Unnecessary API Route + Client Fetch

**Looks like:**
```ts
// app/api/posts/route.ts
export async function GET() { return Response.json(await db.posts.findMany()); }
// app/posts/page.tsx
'use client';
useEffect(() => fetch('/api/posts').then(r => r.json()).then(setPosts), []);
```

**Fix:** Server Component imports DB; no API route, no client fetch.

**Detect:** `rg "fetch\('/api" --type tsx` paired with `app/api/**/route.ts` for simple reads.

---

### P-056 — `window.location` for Navigation

**Looks like:**
```tsx
const handleClick = () => { window.location.href = '/cart'; };
```

**Fix:** `<Link href="/cart">` or `router.push('/cart')`.

**Detect:** `rg "window\.location\.(href|assign|replace)" --type tsx`.

---

### P-057 — `searchParams` Used Without Validation

**Looks like:**
```tsx
export default async function Page({ searchParams }) {
  const isAdmin = (await searchParams).isAdmin === 'true';
  if (isAdmin) return <AdminPanel />;
}
```

**Why bad:** Trusts client input for authorization.

**Fix:** Re-verify against server-side session in DAL; never trust client flag.

**Detect:** AST rule: `searchParams` access without an auth check.

---

### P-058 — Passing Whole DB Row to Client Component

**Looks like:**
```tsx
const [rows] = await sql`SELECT * FROM users WHERE id = ${id}`;
return <Profile user={rows[0]} />; // Profile is a Client Component
```

**Why bad:** Whole DB row serializes, including sensitive fields.

**Fix:** DAL returns a DTO with only safe fields; or pass through a `server-only` mapper.

**Detect:** Review every prop crossing the server/client boundary; Next.js docs recommend DTOs.

---

### P-059 — Server Action Without Auth Check Inside the Action

**Looks like:**
```tsx
// page-level auth only
export default async function Page() {
  const session = await auth();
  if (!session?.user.isAdmin) redirect('/login');
  return (
    <form action={async () => {
      'use server';
      await db.record.deleteMany(); // no re-check!
    }}>
      <button>Delete</button>
    </form>
  );
}
```

**Why bad:** Server Actions are reachable directly via POST. Page-level redirect doesn't gate them.

**Fix:** Re-call `auth()` and ownership check inside the action; delegate to DAL.

**Detect:** Review every `'use server'` body for an auth/authz check.

---

### P-060 — Mutation During Render

**Looks like:**
```tsx
export default async function Page({ searchParams }) {
  if ((await searchParams).logout) {
    (await cookies()).delete('AUTH_TOKEN');
  }
  return <UserProfile />;
}
```

**Fix:** Use a Server Action triggered by a `<form action={logout}>`.

**Detect:** Side effects (cookie writes, db writes, cache invalidations) inside component body.

---

### P-061 — No `Suspense` Boundary Around Slow Data

**Looks like:**
```tsx
export default async function Dashboard() {
  const data = await fetchSlowData(); // 5s
  return <div>{data.content}</div>;
}
```

**Fix:** Wrap slow subtree in `<Suspense fallback={<Skeleton/>}>`; render rest of page immediately.

**Detect:** Pages without any `<Suspense>` over async children.

---

### P-062 — `next/dynamic` Without `ssr: false` Reason

**Looks like:**
```tsx
const Chart = dynamic(() => import('./Chart'));
```

**Why bad:** May force client load with no benefit. `ssr: false` should be explicit when needed.

**Fix:** Default to SSR; opt out only when the component truly cannot SSR.

**Detect:** Manual review of `dynamic` calls.

---

### P-063 — `metadata` Re-exported Wrong

**Looks like:**
```tsx
export const metadata = generateMetadata(); // function called at module load
```

**Fix:** `export async function generateMetadata({ params }) { ... }`.

**Detect:** `rg "export const metadata = " --type tsx`.

---

### P-064 — Direct DB Access Without DAL in New Project

**Looks like:**
```tsx
// app/products/page.tsx
import { db } from '@/lib/db';
export default async function Page() {
  const products = await db.select().from(productsTable);
  return <List items={products} />;
}
```

**Why bad:** For new projects, Next.js docs recommend a Data Access Layer that performs auth, returns DTOs, and centralizes queries. Component-level access makes leaking private fields easier.

**Fix:** DAL function returns safe DTOs; component imports DAL, not DB.

**Detect:** Count `import { db } from '@/lib/db'` outside `data/` or `lib/dal/`.

---

### P-065 — `process.env` Outside DAL/Server Module

**Looks like:**
```tsx
const stripeKey = process.env.STRIPE_SECRET_KEY;
```

**Fix:** Only DAL reads env vars. Other modules import typed config from DAL.

**Detect:** `rg "process\.env" --type ts --type tsx`.

---

## 6. Drizzle ORM Patterns

### P-066 — N+1 via `for ... await`

**Looks like:**
```ts
const users = await db.select().from(usersTable);
for (const u of users) {
  const orders = await db.select().from(ordersTable).where(eq(ordersTable.userId, u.id));
  u.orders = orders; // each iteration = 1 query, N+1 total
}
```

**Why bad:** A list of N users triggers N+1 queries. Latency and connection pressure both balloon.

**Fix:** Use `db.query.users.findMany({ with: { orders: true } })` or `inArray(ordersTable.userId, ids)`.

**Detect:** `rg "for .* await\|forEach.*async\|for await" --type ts -A4`; enable `pg-mem` or `drizzle-orm-debug` log; count queries.

---

### P-067 — `select()` Without Partial Columns

**Looks like:**
```ts
const users = await db.select().from(usersTable);
```

**Why bad:** Fetches every column including large ones (JSONB, text, blobs). No benefit on the wire.

**Fix:** `db.select({ id: users.id, email: users.email }).from(usersTable)`.

**Detect:** Lint rule matching bare `db.select()` or `db.query.*.findMany()` without `columns:` or a `select({...})` projection.

---

### P-068 — `count(*)` Without `.mapWith(Number)`

**Looks like:**
```ts
const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(usersTable);
// count is "42" (string) at runtime despite type
```

**Fix:** `sql<number>\`count(*)\`.mapWith(Number)`.

**Detect:** ESLint rule or grep `count(\*)` and check absence of `.mapWith(Number)`.

---

### P-069 — `serial()` Instead of Identity

**Looks like:**
```ts
id: serial('id').primaryKey(),
```

**Why bad:** Postgres legacy. Identity columns (`generatedAlwaysAsIdentity()`) are the modern standard.

**Fix:** `id: integer().primaryKey().generatedAlwaysAsIdentity()`.

**Detect:** `rg "serial\(" --type ts`.

---

### P-070 — Schema File with Inconsistent Column Naming

**Looks like:**
```ts
firstName: varchar('firstName'),  // camelCase in DB
last_name: varchar('last_name'),  // snake_case in DB
```

**Fix:** Snake_case in DB, camelCase in TS for every column.

**Detect:** ESLint rule that matches string column names against a snake_case pattern.

---

### P-071 — Table Not Exported (Breaks Migration Generation)

**Looks like:**
```ts
const posts = pgTable('posts', { ... }); // not exported
```

**Fix:** Always `export const`.

**Detect:** `rg "pgTable\(" -B1 | rg -v "export"`.

---

### P-072 — Missing Foreign Key Reference

**Looks like:**
```ts
authorId: integer('author_id').notNull(),
// no .references(() => users.id)
```

**Fix:** Add `.references(() => users.id, { onDelete: 'cascade' })`.

**Detect:** Lint rule flagging integer columns named `*_id` without `.references`.

---

### P-073 — Missing Index on FK

**Looks like:**
```ts
authorId: integer('author_id').references(() => users.id).notNull(),
// no index on author_id
```

**Fix:** Add an index in the second argument: `index('posts_author_idx').on(table.authorId)`.

**Detect:** SQL `EXPLAIN` on common joins; lint rule for FK columns without index.

---

### P-074 — `db.select().leftJoin` for Nested Data

**Looks like:**
```ts
const postsWithAuthors = await db
  .select()
  .from(postsTable)
  .leftJoin(usersTable, eq(postsTable.authorId, usersTable.id));
// flat shape, not nested
```

**Fix:** Use the relational API: `db.query.posts.findMany({ with: { author: true } })`.

**Detect:** `rg "leftJoin\|rightJoin\|innerJoin" -B1` near `db.select()`.

---

### P-075 — Missing `with` Limit on Relations

**Looks like:**
```ts
const user = await db.query.users.findFirst({
  where: { id },
  with: { orders: true }, // returns ALL orders
});
```

**Why bad:** Loads every related row; one user with 10k orders crashes the request.

**Fix:** `{ with: { orders: { limit: 10, orderBy: { createdAt: 'desc' } } } }`.

**Detect:** ESLint warning when `with:` has no `limit:`.

---

### P-076 — Manual SQL String Concatenation

**Looks like:**
```ts
await db.execute(sql.raw(`SELECT * FROM users WHERE id = ${id}`));
```

**Why bad:** SQL injection. Even if `id` is typed, an upstream mistake is fatal.

**Fix:** Use parameterized: `sql\`SELECT * FROM users WHERE id = ${id}\``.

**Detect:** `rg "sql\.raw\`" --type ts`.

---

### P-077 — JSON Field Without `$type<>()`

**Looks like:**
```ts
preferences: jsonb('preferences'),
```

**Why bad:** Returns `unknown`. Consumers cast and lose type safety.

**Fix:** `preferences: jsonb('preferences').$type<{ theme: 'light'|'dark' }>()`.

**Detect:** Lint rule: `jsonb(` without adjacent `$type<`.

---

### P-078 — Mutation Without `.returning()`

**Looks like:**
```ts
await db.update(ordersTable).set({ status: 'shipped' }).where(eq(ordersTable.id, id));
```

**Why bad:** Caller can't tell if anything changed; can't echo the new state to client.

**Fix:** `.returning()` or `.returning({ id: ordersTable.id })`.

**Detect:** Lint rule for `db.update|insert|delete` without `.returning()`.

---

### P-079 — `prepare()` Inline (Loses Cache Benefit)

**Looks like:**
```ts
const user = await db.select().from(usersTable).where(eq(usersTable.email, sql.placeholder('email'))).prepare('getUserByEmail');
```

**Why bad:** Calling `.prepare()` inside a request handler creates a new prepared statement each time.

**Fix:** Prepare once at module top-level.

**Detect:** `.prepare(` inside request handlers; `rg "\.prepare\(" --type ts -B2 | rg "await\|async function"`.

---

### P-080 — `enumToPgEnum` Missing Helper

**Looks like:**
```ts
export const userRoleEnum = pgEnum('user_role', ['admin', 'user', 'moderator']);
// hardcoded array instead of TS enum
```

**Fix:** Single helper: `enumToPgEnum(UserRole)` keeps enum and DB in sync.

**Detect:** Manual review of enum declarations.

---

### P-081 — Mixed Naming (Camel in DB)

**Looks like:**
```ts
orderId: uuid('orderId').notNull(),
```

**Fix:** `orderId: uuid('order_id').notNull()`.

**Detect:** Lint rule against non-snake column names.

---

### P-082 — Timestamp Without Timezone

**Looks like:**
```ts
createdAt: timestamp('created_at').defaultNow().notNull(),
```

**Why bad:** `timestamp` without `withTimezone: true` stores naive timestamps; cross-region bugs inevitable.

**Fix:** `timestamp('created_at', { mode: 'date', precision: 3, withTimezone: true }).defaultNow().notNull()`.

**Detect:** Lint rule flagging `timestamp(` without `withTimezone: true`.

---

### P-083 — Timestamp `mode: 'string'`

**Looks like:**
```ts
createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
```

**Why bad:** 10–15% slower than `mode: 'date'`. Use `'date'` unless you specifically need formatted strings.

**Fix:** `mode: 'date'`.

**Detect:** `rg "mode: 'string'" --type ts`.

---

### P-084 — `push` in Production Migration

**Looks like:** `drizzle-kit push` used in CI/prod.

**Fix:** Use `drizzle-kit generate` for prod migrations; `push` only for dev/prototyping.

**Detect:** CI scripts referencing `drizzle-kit push` against prod DB.

---

### P-085 — Missing Transaction on Multi-Step Write

**Looks like:**
```ts
await db.insert(ordersTable).values(order);
await db.insert(orderItemsTable).values(items);
await db.update(inventoryTable).set({ qty: sql`qty - 1` }).where(...);
// if step 2 fails, order is orphaned
```

**Fix:** `await db.transaction(async (tx) => { ... })`.

**Detect:** Multiple `db.insert|update|delete` calls in sequence without `transaction`.

---

### P-086 — UUID v4 for Primary Key

**Looks like:**
```ts
id: uuid('id').primaryKey().defaultRandom(), // UUIDv4
```

**Why bad:** ~33% the performance of bigserial / UUIDv7 for PK inserts.

**Fix:** `integer().primaryKey().generatedAlwaysAsIdentity()` for internal use; UUIDv7 for external IDs.

**Detect:** `rg "defaultRandom\|uuid.*primaryKey" --type ts`.

---

### P-087 — `pgTable` Return Not Used By `db.query`

**Looks like:** Using `relations()` legacy on Drizzle v1; `db.query` won't populate.

**Fix:** Use `defineRelations()` for v1 RC.

**Detect:** `rg "from 'drizzle-orm/_relations'"` on a project claiming v1.

---

### P-088 — `'@latest'` Mistaken for v1

**Looks like:** `npm i drizzle-orm` resolves to 0.45.x, not v1 RC. Code uses v1 syntax.

**Fix:** `npm i drizzle-orm@rc` for v1.

**Detect:** `rg "drizzle-orm@1\|defineRelations" package.json` vs installed version.

---

### P-089 — Select All Columns Through Rel API

**Looks like:**
```ts
db.query.posts.findMany({ with: { author: true } });
// returns every column of every related row
```

**Fix:** Specify `columns: { id: true, name: true }` on relations.

**Detect:** `.findMany({ with: ... })` without `columns:` on either level.

---

### P-090 — `'@ts-ignore'` on Drizzle Type Errors

**Looks like:**
```ts
// @ts-ignore drizzle type lag
db.select({ ... }).from(...);
```

**Fix:** Update Drizzle version or use the workaround described in Drizzle issues; do not silence.

**Detect:** `rg "@ts-ignore" --type ts` near `db\.|drizzle`.

---

## 7. PostgreSQL Patterns

### P-091 — Storing Money as Float

**Looks like:**
```ts
total: doublePrecision('total'),
// then: 0.1 + 0.2 !== 0.3
```

**Fix:** `decimal('total', { precision: 10, scale: 2 })` for currency; integer cents if simple.

**Detect:** `rg "doublePrecision\|float" --type ts` in financial columns.

---

### P-092 — Over-Indexing

**Looks like:**
```ts
index('a').on(a), index('a_b').on(a,b), index('a_b_c').on(a,b,c), index('a_b_c_d').on(a,b,c,d),
```

**Why bad:** Slows writes, bloats storage.

**Fix:** Index only what your `EXPLAIN` justifies.

**Detect:** Compare indexes vs query plans.

---

### P-093 — `SELECT *` in Production Queries

**Looks like:**
```sql
SELECT * FROM orders WHERE ...
```

**Fix:** Name columns explicitly.

**Detect:** `rg "SELECT \*" --type sql --type ts`.

---

### P-094 — Missing Composite Index for Hot Path

**Looks like:**
```ts
// Query: WHERE customer_id = ? AND status = ? ORDER BY order_date DESC
// Index only on customer_id
```

**Fix:** Composite index with correct column order: `(customer_id, status, order_date DESC)`.

**Detect:** `EXPLAIN ANALYZE` on common queries.

---

### P-095 — UUID Without `pgcrypto` / `gen_random_uuid`

**Looks like:** Generating UUIDs in app code without DB-side function.

**Fix:** `defaultRandom()` uses `gen_random_uuid()` (pgcrypto). Ensure migration enables extension if not using Drizzle's helper.

**Detect:** Migration files without `CREATE EXTENSION` for `pgcrypto` if UUIDs are generated in triggers.

---

### P-096 — `ILIKE '%foo%'` on Indexed Column

**Looks like:**
```sql
SELECT * FROM products WHERE name ILIKE '%tea%';
```

**Fix:** `pg_trgm` GIN index + `gin_trgm_ops` for fuzzy search; or full-text search for word search.

**Detect:** Look for `ILIKE '%...%'` and check whether index supports it.

---

### P-097 — `count(*)` Without Filter When You Want Filtered Count

**Looks like:**
```ts
const all = await db.select().from(ordersTable);
const active = all.filter(o => o.status === 'active').length; // loads every row
```

**Fix:** `db.select({ c: sql<number>\`count(*) filter (where status='active')\`.mapWith(Number) })`.

**Detect:** `.filter(` on DB results for counting.

---

### P-098 — Order Without Limit

**Looks like:**
```ts
db.select().from(eventsTable).orderBy(eventsTable.createdAt);
// potential unbounded result
```

**Fix:** Always `.limit(N)`.

**Detect:** Lint rule for `.orderBy(` without `.limit(`.

---

## 8. E-commerce / Food-Ordering Patterns

### P-099 — Inventory Deduction Without Row Lock

**Looks like:**
```ts
await db.update(inventoryTable).set({ qty: sql`qty - 1` }).where(eq(inventoryTable.id, id));
// Race: two concurrent orders both pass the "stock > 0" check
```

**Fix:** `SELECT ... FOR UPDATE` inside a transaction, or use `qty >= 1` in WHERE and check affected rows.

**Detect:** Any update that decrements stock without `transaction` + lock.

---

### P-100 — Price Computed in App Instead of DB Transaction

**Looks like:**
```ts
const product = await db.query.products.findFirst({ where: { id } });
const total = product.price * qty; // client-side, can be tampered
```

**Fix:** Server-computed inside a `server-only` DAL from DB columns, never trust client `qty` for unit price.

**Detect:** Math on `price * qty` outside DAL.

---

### P-101 — Cart Total from Client-Side Sum

**Looks like:**
```tsx
const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
// sent to checkout as the amount to charge
```

**Fix:** Server recomputes total from authoritative DB prices; client total is display-only.

**Detect:** Search for `total` derived client-side and used in payment request.

---

### P-102 — Discount/Voucher Logic Without Server Re-verify

**Looks like:**
```tsx
const finalPrice = cartTotal * (1 - voucher.discount); // client computed
await fetch('/api/checkout', { body: { finalPrice } });
```

**Fix:** Server re-applies discount against authoritative cart and returns final amount; client only shows what server returned.

**Detect:** Payment body containing a precomputed total.

---

### P-103 — Hardcoded Indonesian Rupiah / Currency Format

**Looks like:**
```ts
const format = (n) => `Rp ${n.toLocaleString('id-ID')}`;
```

**Why bad:** Indonesian context is fine, but coupling one locale into utilities blocks multi-locale (i18n) and ignores `Intl.NumberFormat`.

**Fix:** `new Intl.NumberFormat(locale, { style: 'currency', currency: 'IDR' }).format(n)`.

**Detect:** `rg "toLocaleString\(['\"]id" --type ts --type tsx`.

---

### P-104 — Phone Number Validation Without Library

**Looks like:**
```ts
if (phone.startsWith('+62') && phone.length >= 10) { ... }
```

**Fix:** Use `libphonenumber-js` or `zod` with `z.string().regex(...)` for the country.

**Detect:** Hand-written phone validators.

---

### P-105 — Idempotency Key Missing on Payment Submission

**Looks like:**
```ts
async function submitPayment(req) {
  await fetch('https://payment-gateway/charge', { ... });
}
```

**Why bad:** Network retries double-charge.

**Fix:** Generate UUID idempotency key per submit attempt, send as header.

**Detect:** Payment integration without `Idempotency-Key`.

---

### P-106 — Webhook Without Signature Verification

**Looks like:**
```ts
export async function POST(req: Request) {
  const body = await req.json();
  await updateOrderStatus(body.orderId, body.status);
}
```

**Fix:** Verify HMAC signature header (`X-Signature`) against a server secret.

**Detect:** Any webhook route without signature verification.

---

### P-107 — Saving Card Details (PCI)

**Looks like:**
```ts
await db.insert(paymentsTable).values({ cardNumber, cvv, exp });
```

**Why bad:** PCI-DSS scope violation.

**Fix:** Use tokenization (Stripe/Midtrans/Xendit) — never touch PAN/CVV.

**Detect:** `rg "cardNumber|cvv|cvc" --type ts` (excluding tokenized gateway responses).

---

### P-108 — Delivery ETA Without Server Authority

**Looks like:**
```tsx
const eta = Date.now() + 45 * 60_000; // 45 min
```

**Fix:** Compute from courier distance, kitchen load, prep time — server-side.

**Detect:** ETA math in components.

---

### P-109 — Menu/Product Availability Race

**Looks like:**
```ts
if (product.isAvailable) await addToCart(product);
```

**Why bad:** Between read and write, stock flips.

**Fix:** DB constraint + transactional re-check.

**Detect:** Availability check separated from write.

---

### P-110 — Loyalty Points Computed on Client

**Looks like:**
```tsx
const points = cart.reduce((s, i) => s + i.points, 0);
```

**Fix:** Server-side recompute from order lines; never trust.

**Detect:** Loyalty logic in components.

---

### P-111 — Order Number Generated with Insecure PRNG

**Looks like:**
```ts
const orderNo = Math.random().toString(36).slice(2);
```

**Fix:** `nanoid` / `cuid2` / DB sequence.

**Detect:** `rg "Math\.random" --type ts -A2 | rg "order\|invoice"`.

---

### P-112 — Address Sent Without Validation

**Looks like:**
```ts
const { address } = await req.json();
await db.insert(addressesTable).values(address);
```

**Fix:** Zod schema for Indonesian postal codes, lat/lng ranges, etc.

**Detect:** Direct insert from `req.json()`.

---

## 9. Testing & Quality Patterns

### P-113 — Test Asserting Nothing

**Looks like:**
```ts
test('creates order', async () => {
  const order = await createOrder(input);
  expect(order).toBeDefined();
});
```

**Fix:** Assert on outcome: `expect(order.status).toBe('pending'); expect(order.items).toHaveLength(2);`.

**Detect:** Tests with `toBeDefined()` only.

---

### P-114 — Test Asserting on Mocks Not Behavior

**Looks like:**
```ts
expect(mockDb.insert).toHaveBeenCalled();
```

**Fix:** Mock at the boundary, assert on output.

**Detect:** `toHaveBeenCalled` without `toBe`/`toEqual`.

---

### P-115 — Snapshot Test on Whole Page

**Looks like:**
```ts
expect(container.innerHTML).toMatchSnapshot();
```

**Why bad:** Locks in slop; a single regression slips through.

**Fix:** Targeted snapshots of pure functions; behavior assertions for components.

**Detect:** `rg "toMatchSnapshot" --type ts`.

---

### P-116 — Test That Mirrors Production Logic

**Looks like:**
```ts
test('sums correctly', () => {
  const result = items.reduce((s, i) => s + i.amount, 0);
  expect(result).toBe(items.reduce((s, i) => s + i.amount, 0));
});
```

**Fix:** Assert against a hand-computed expected value.

**Detect:** Pattern matching same expression in `test` and `expect`.

---

### P-117 — Coverage Padding via Trivial Tests

**Looks like:**
```ts
test.each([null, undefined, 0, '', false])('handles %s', (v) => {
  expect(doSomething(v)).toBeUndefined();
});
```

**Why bad:** Coverage rises; confidence should not.

**Fix:** Real edge cases with real assertions.

**Detect:** Bulk test.each with no semantic input.

---

### P-118 — Test That Never Runs (Async forgotten)

**Looks like:**
```ts
test('fetches', () => {
  fetch(...).then(...); // forgot await or return; test passes silently
});
```

**Fix:** Mark test `async`, `await` or `return` the promise.

**Detect:** Vitest/Jest detect floating promises.

---

## 10. Security Patterns

### P-119 — Hardcoded Secret

**Looks like:**
```ts
const STRIPE_KEY = 'sk_live_xxx';
```

**Fix:** `process.env.STRIPE_SECRET_KEY` from env, validated with Zod.

**Detect:** `rg -e "sk_live_|sk_test_|AKIA|ghp_|xox[baprs]-" --type ts`.

---

### P-120 — `'use server'` Action Without Auth Re-Check

See P-059. Re-listed: every Server Action must verify caller.

---

### P-121 — Returning Sensitive Fields from Server Action

**Looks like:**
```ts
return db.user.update({ where: { id }, data: { phone } });
// returns full row including internal flags
```

**Fix:** Return DTO: `return { success: true }`; or a mapped class that omits secret fields.

**Detect:** Server Actions returning raw ORM results.

---

### P-122 — Missing Input Validation on Server Action

**Looks like:**
```ts
'use server';
export async function updateProfile(formData: FormData) {
  await db.update(...).set({ name: formData.get('name') as string });
}
```

**Fix:** Zod-parse `formData`; never `as string` without validation.

**Detect:** `rg "formData\.get\(.+\) as " --type ts`.

---

### P-123 — Logging Sensitive Data

**Looks like:**
```ts
console.log('login attempt', { email, password });
log.info('token', token);
```

**Fix:** Strip PII / secrets before logging; structured logger with allow-list of fields.

**Detect:** Lint rule against logging `password|token|secret|otp|cvv|cardNumber`.

---

### P-124 — Missing CSRF on Custom Mutation Endpoint

**Looks like:**
```ts
export async function POST(req: Request) {
  await db.update(...).values(await req.json());
}
```

**Fix:** Origin check (Next.js does this for Server Actions); for raw route handlers, verify Origin/Referer.

**Detect:** POST route handler with no auth/Origin/CSRF check.

---

### P-125 — File Upload Without Type/Size Limit

**Looks like:**
```ts
const buf = Buffer.from(await req.arrayBuffer());
await put('avatars/' + filename, buf);
```

**Fix:** Validate MIME (magic bytes, not `file.type`), size limit, randomized filename.

**Detect:** Upload code without size/MIME checks.

---

### P-126 — SQL via Raw String

**Looks like:** P-076 again — always use parameterized SQL.

---

## 11. Project Hygiene Patterns

### P-127 — Mixed Naming Conventions

**Looks like:**
```ts
const user_name = ...;
const userId = ...;
const User_Profile = ...;
```

**Fix:** Single ESLint config enforcing one convention (camelCase for variables, PascalCase for components/types).

**Detect:** `eslint-plugin-unicorn` or custom naming rule.

---

### P-128 — Barrel File That Re-exports Everything

**Looks like:**
```ts
// index.ts
export * from './a';
export * from './b';
export * from './c';
```

**Why bad:** Defeats tree-shaking; ties unrelated modules.

**Fix:** Explicit named re-exports.

**Detect:** `rg "^export \* from" --type ts`.

---

### P-129 — Magic Strings Everywhere

**Looks like:**
```ts
if (order.status === 'pending') ...
```

**Fix:** `if (order.status === OrderStatus.Pending) ...` — single source of truth.

**Detect:** Count string literals in business logic.

---

### P-130 — Inconsistent Error Type

**Looks like:**
```ts
function parse(): Order { return JSON.parse(s); } // throws generic Error
function parseSafe(): Order | null { try { return parse(); } catch { return null; } }
```

**Fix:** Custom error class (`OrderParseError`) with consistent shape.

**Detect:** Manual review of error returns.

---

### P-131 — Configuration Scattered Across Files

**Looks like:**
```ts
const TAX = 0.11;          // file A
const FREE_SHIPPING = 50_000; // file B
const DELIVERY_HOURS = 24; // file C
```

**Fix:** One `config.ts` validated with Zod.

**Detect:** `rg "const [A-Z_]+ =" --type ts -B1`.

---

### P-132 — Premature Feature Flag Stub

**Looks like:**
```ts
if (featureFlags.newCheckout) {
  // TODO: implement
} else {
  legacyCheckout();
}
```

**Why bad:** Dead branch in production.

**Fix:** Implement the flag or remove it.

**Detect:** `if (featureFlags\..*)` with empty/short body.

---

### P-133 — Inconsistent Casing in Routes

**Looks like:**
```ts
/app/Products/[id]/page.tsx
/app/cart/page.tsx
/app/Order-History/page.tsx
```

**Fix:** Lowercase, kebab-case route folders; canonical URL strategy.

**Detect:** `rg "/[A-Z]" app/`.

---

### P-134 — Missing `package.json` Pinning

**Looks like:**
```json
"drizzle-orm": "^1.0.0-rc.3"
```

**Why bad:** RC tags drift; v1 vs 0.45 syntax diverges. Either pin exactly or move off RC.

**Fix:** Pin or stabilize.

**Detect:** `rg "\^|~" package.json`.

---

### P-135 — README Drift

**Looks like:** README describes an architecture the code no longer matches.

**Fix:** CI check that detects stale paths in docs vs filesystem.

**Detect:** Manual; `actionlint` for GH Actions; `markdown-link-check` for relative paths.

---

## Detection Cheat-Sheet

```bash
# Universal slop
rg -t ts -t tsx " as any\b| as unknown as "
rg -t ts -t tsx "} catch" -A2 | rg -e "^\s*//" -e "^\s*$"
rg -t ts -t tsx "@ts-(ignore|expect-error|nocheck)" -A1
rg -t ts -t tsx "console\.(log|debug|info)"
rg -t ts -t tsx "^// TODO" | rg -v "TODO\(@"
rg -t ts -t tsx "data|result|value|temp|obj|info|item" -t ts

# Next.js specific
rg -t ts -t tsx "next/router|next/head|getServerSideProps|getStaticProps"
rg "use client' app/layout.tsx"
rg -t ts -t tsx "useRouter" -B5 | rg "export default async"
rg -t ts -t tsx "window\.location\.(href|assign|replace)"
rg -t ts -t tsx "fetch\('/api"

# Drizzle specific
rg -t ts "for .* await|forEach.*async" -A4
rg -t ts "serial\("
rg -t ts "sql\.raw\`"
rg -t ts "count\(\*\)" | rg -v "mapWith\(Number\)"
rg -t ts "doublePrecision|float\("
rg -t ts "defaultRandom|uuid.*primaryKey"

# React specific
rg -t tsx "useEffect" -A3 | rg "navigator\.|window\."
rg -t tsx "useState" -A6 | rg "useEffect|fetch"
rg -t tsx "<button" | rg -v "type="

# Cross-file duplication
npx jscpd app/ lib/ components/

# Type safety
npx tsc --noEmit
```

## Recommended Tooling Stack

| Concern | Tool |
|---|---|
| Universal slop patterns | `npx aislop scan`, `npx @bzprchny/vibe-check` |
| Type safety | `tsc --noEmit`, `@typescript-eslint/strict-type-checked` |
| React hooks | `eslint-plugin-react-hooks` |
| Code complexity | `eslint-plugin-complexity`, `eslint-crap` |
| Duplication | `jscpd` |
| Dead code | `knip`, `ts-prune` |
| Security | `eslint-plugin-security`, `secretlint` |
| Drizzle | `drizzle-kit check`, `pg-mem` snapshot tests |
| Test quality | Mutation testing (`stryker`, `mutmut`) |
| CI gate | `npx aislop scan --fail-on=error` block in PR |

## References

- https://scanaislop.com/patterns/ — 14 named universal slop patterns
- https://managed-code.com/blog-post/ai-slop-in-code — production analysis of AI slop
- https://dev.to/bzprchny/5-code-smells-only-ai-creates-and-how-to-detect-them-1e3l — hallucinated imports, copy-paste, empty catches, stale APIs, overengineering
- https://futurecraft.pro/blog/ai-slop-code-review-methodology/ — 4 production patterns + 10-point checklist
- https://grcengineering.substack.com/p/sloppy-ai-code-and-how-to-avoid-it — vibe-coding vs AI-driven engineering
- https://github.com/mcclowes/puzzles/tree/main/.claude/skills/nextjs-anti-patterns — full Next.js App Router anti-pattern list
- https://github.com/honra-io/drizzle-best-practices — Drizzle v1 RC best practices
- https://gist.github.com/productdevbook/7c9ce3bbeb96b3fabc3c7c2aa2abc717 — Drizzle PostgreSQL 2025 guide
- https://nextjs.org/docs/app/guides/data-security — Data Access Layer, DTOs, auth
- https://arxiv.org/html/2401.14176v1 — academic study of Copilot-generated code smells