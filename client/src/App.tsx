import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import NotFound from "@/pages/not-found";
import Navbar from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";
import Home from "@/pages/home";
import Menu from "@/pages/menu";
import About from "@/pages/about";
import Articles from "@/pages/articles";
import ArticleDetail from "@/pages/article/[id]";
import Contact from "@/pages/contact";
import { HalalLogo } from "@/components/HalalLogo";
import AuthPage from "@/pages/auth";
import AdminBlog from "@/pages/admin/blog";
import AdminPages from "@/pages/admin/pages";
import AdminMenuPage from "@/pages/admin/pages/menu";
import AdminDashboard from "@/pages/admin/index";
import HomePageEditor from "@/pages/admin/pages/home";
import AboutPageEditor from "@/pages/admin/pages/about";
import ContactPageEditor from "@/pages/admin/pages/contact";
import FooterEditor from "@/pages/admin/pages/footer";
import CustomersPageEditor from "@/pages/admin/pages/customers";
import ProtectedRoute from "@/components/auth/ProtectedRoute";

function Router() {
  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col">
        <HalalLogo />
        <Switch>
          <Route path="/">
            <div className="min-h-screen flex flex-col">
              <Navbar />
              <main className="flex-1">
                <ErrorBoundary>
                  <Home />
                </ErrorBoundary>
              </main>
              <Footer />
            </div>
          </Route>
          <Route path="/menu">
            <div className="min-h-screen flex flex-col">
              <Navbar />
              <main className="flex-1">
                <ErrorBoundary>
                  <Menu />
                </ErrorBoundary>
              </main>
              <Footer />
            </div>
          </Route>
          <Route path="/about">
            <div className="min-h-screen flex flex-col">
              <Navbar />
              <main className="flex-1">
                <ErrorBoundary>
                  <About />
                </ErrorBoundary>
              </main>
              <Footer />
            </div>
          </Route>
          <Route path="/articles">
            <div className="min-h-screen flex flex-col">
              <Navbar />
              <main className="flex-1">
                <ErrorBoundary>
                  <Articles />
                </ErrorBoundary>
              </main>
              <Footer />
            </div>
          </Route>
          <Route path="/article/:id">
            <div className="min-h-screen flex flex-col">
              <Navbar />
              <main className="flex-1">
                <ErrorBoundary>
                  <ArticleDetail />
                </ErrorBoundary>
              </main>
              <Footer />
            </div>
          </Route>
          <Route path="/contact">
            <div className="min-h-screen flex flex-col">
              <Navbar />
              <main className="flex-1">
                <ErrorBoundary>
                  <Contact />
                </ErrorBoundary>
              </main>
              <Footer />
            </div>
          </Route>
          <Route path="/auth">
            <ErrorBoundary>
              <AuthPage />
            </ErrorBoundary>
          </Route>
          <Route path="/admin">
            <ErrorBoundary>
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            </ErrorBoundary>
          </Route>
          <Route path="/admin/blog">
            <ErrorBoundary>
              <ProtectedRoute>
                <AdminBlog />
              </ProtectedRoute>
            </ErrorBoundary>
          </Route>
          <Route path="/admin/pages">
            <ErrorBoundary>
              <ProtectedRoute>
                <AdminPages />
              </ProtectedRoute>
            </ErrorBoundary>
          </Route>
          <Route path="/admin/pages/:pageId">
            {(params) => {
              switch (params.pageId) {
                case 'menu':
                  return (
                    <ErrorBoundary>
                      <ProtectedRoute>
                        <AdminMenuPage />
                      </ProtectedRoute>
                    </ErrorBoundary>
                  );
                case 'home':
                  return (
                    <ErrorBoundary>
                      <ProtectedRoute>
                        <HomePageEditor />
                      </ProtectedRoute>
                    </ErrorBoundary>
                  );
                case 'about':
                  return (
                    <ErrorBoundary>
                      <ProtectedRoute>
                        <AboutPageEditor />
                      </ProtectedRoute>
                    </ErrorBoundary>
                  );
                case 'contact':
                  return (
                    <ErrorBoundary>
                      <ProtectedRoute>
                        <ContactPageEditor />
                      </ProtectedRoute>
                    </ErrorBoundary>
                  );
                case 'footer':
                  return (
                    <ErrorBoundary>
                      <ProtectedRoute>
                        <FooterEditor />
                      </ProtectedRoute>
                    </ErrorBoundary>
                  );
                case 'customers':
                  return (
                    <ErrorBoundary>
                      <ProtectedRoute>
                        <CustomersPageEditor />
                      </ProtectedRoute>
                    </ErrorBoundary>
                  );
                default:
                  return (
                    <ErrorBoundary>
                      <ProtectedRoute>
                        <div className="container mx-auto p-6">
                          <h1 className="text-3xl font-bold mb-6">
                            Edit {params.pageId.charAt(0).toUpperCase() + params.pageId.slice(1)} Page
                          </h1>
                          <p>Page editor for {params.pageId} will be implemented here</p>
                        </div>
                      </ProtectedRoute>
                    </ErrorBoundary>
                  );
              }
            }}
          </Route>
          <Route>
            <div className="min-h-screen flex flex-col">
              <Navbar />
              <main className="flex-1">
                <ErrorBoundary>
                  <NotFound />
                </ErrorBoundary>
              </main>
              <Footer />
            </div>
          </Route>
        </Switch>
      </div>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <Router />
          <Toaster />
        </LanguageProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;