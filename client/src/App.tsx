import { Switch, Route } from "wouter";
import { lazy, Suspense } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { HelmetProvider } from "react-helmet-async";
import Navbar from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";
import { HalalLogo } from "@/components/HalalLogo";
import { SkipLink } from "@/components/ui/skip-link";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";

// Lazy-loaded public pages
const NotFound = lazy(() => import("@/pages/not-found"));
const Home = lazy(() => import("@/pages/home"));
const Menu = lazy(() => import("@/pages/menu"));
const About = lazy(() => import("@/pages/about"));
const Articles = lazy(() => import("@/pages/articles"));
const ArticleDetail = lazy(() => import("@/pages/article/[id]"));
const Contact = lazy(() => import("@/pages/contact"));
const AuthPage = lazy(() => import("@/pages/auth"));

// Lazy-loaded admin pages (TinyMCE is heavy ~500KB)
const AdminBlog = lazy(() => import("@/pages/admin/blog"));
const AdminPages = lazy(() => import("@/pages/admin/pages"));
const AdminMenuPage = lazy(() => import("@/pages/admin/pages/menu"));
const AdminDashboard = lazy(() => import("@/pages/admin/index"));
const HomePageEditor = lazy(() => import("@/pages/admin/pages/home"));
const AboutPageEditor = lazy(() => import("@/pages/admin/pages/about"));
const ContactPageEditor = lazy(() => import("@/pages/admin/pages/contact"));
const FooterEditor = lazy(() => import("@/pages/admin/pages/footer"));
const CustomersPageEditor = lazy(() => import("@/pages/admin/pages/customers"));

function PublicRoute({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main id="main-content" className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

function Router() {
  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col">
        <HalalLogo />
        <SkipLink />
        <Switch>
          <Route path="/">
            <PublicRoute>
              <Suspense fallback={<LoadingSkeleton />}>
                <ErrorBoundary>
                  <Home />
                </ErrorBoundary>
              </Suspense>
            </PublicRoute>
          </Route>
          <Route path="/menu">
            <PublicRoute>
              <Suspense fallback={<LoadingSkeleton />}>
                <ErrorBoundary>
                  <Menu />
                </ErrorBoundary>
              </Suspense>
            </PublicRoute>
          </Route>
          <Route path="/about">
            <PublicRoute>
              <Suspense fallback={<LoadingSkeleton />}>
                <ErrorBoundary>
                  <About />
                </ErrorBoundary>
              </Suspense>
            </PublicRoute>
          </Route>
          <Route path="/articles">
            <PublicRoute>
              <Suspense fallback={<LoadingSkeleton />}>
                <ErrorBoundary>
                  <Articles />
                </ErrorBoundary>
              </Suspense>
            </PublicRoute>
          </Route>
          <Route path="/article/:id">
            <PublicRoute>
              <Suspense fallback={<LoadingSkeleton />}>
                <ErrorBoundary>
                  <ArticleDetail />
                </ErrorBoundary>
              </Suspense>
            </PublicRoute>
          </Route>
          <Route path="/contact">
            <PublicRoute>
              <Suspense fallback={<LoadingSkeleton />}>
                <ErrorBoundary>
                  <Contact />
                </ErrorBoundary>
              </Suspense>
            </PublicRoute>
          </Route>
          <Route path="/auth">
            <Suspense fallback={<LoadingSkeleton />}>
              <ErrorBoundary>
                <AuthPage />
              </ErrorBoundary>
            </Suspense>
          </Route>
          <Route path="/admin">
            <Suspense fallback={<LoadingSkeleton />}>
              <ErrorBoundary>
                <ProtectedRoute>
                  <AdminDashboard />
                </ProtectedRoute>
              </ErrorBoundary>
            </Suspense>
          </Route>
          <Route path="/admin/blog">
            <Suspense fallback={<LoadingSkeleton />}>
              <ErrorBoundary>
                <ProtectedRoute>
                  <AdminBlog />
                </ProtectedRoute>
              </ErrorBoundary>
            </Suspense>
          </Route>
          <Route path="/admin/pages">
            <Suspense fallback={<LoadingSkeleton />}>
              <ErrorBoundary>
                <ProtectedRoute>
                  <AdminPages />
                </ProtectedRoute>
              </ErrorBoundary>
            </Suspense>
          </Route>
          <Route path="/admin/pages/:pageId">
            {(params) => (
              <Suspense fallback={<LoadingSkeleton />}>
                <ErrorBoundary>
                  <ProtectedRoute>
                    <PageEditor pageId={params.pageId} />
                  </ProtectedRoute>
                </ErrorBoundary>
              </Suspense>
            )}
          </Route>
          <Route>
            <PublicRoute>
              <Suspense fallback={<LoadingSkeleton />}>
                <ErrorBoundary>
                  <NotFound />
                </ErrorBoundary>
              </Suspense>
            </PublicRoute>
          </Route>
        </Switch>
      </div>
    </ErrorBoundary>
  );
}

function PageEditor({ pageId }: { pageId: string }) {
  switch (pageId) {
    case "menu":
      return <AdminMenuPage />;
    case "home":
      return <HomePageEditor />;
    case "about":
      return <AboutPageEditor />;
    case "contact":
      return <ContactPageEditor />;
    case "footer":
      return <FooterEditor />;
    case "customers":
      return <CustomersPageEditor />;
    default:
      return (
        <div className="container mx-auto p-6">
          <h1 className="text-3xl font-bold mb-6">
            Edit {pageId.charAt(0).toUpperCase() + pageId.slice(1)} Page
          </h1>
          <p>Page editor for {pageId} will be implemented here</p>
        </div>
      );
  }
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <HelmetProvider>
          <LanguageProvider>
            <Router />
            <Toaster />
          </LanguageProvider>
        </HelmetProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;