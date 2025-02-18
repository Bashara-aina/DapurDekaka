import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
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

function Router() {
  return (
    <div className="min-h-screen flex flex-col">
      <HalalLogo />
      <Switch>
        <Route path="/">
          <div className="min-h-screen flex flex-col">
            <Navbar />
            <main className="flex-1">
              <Home />
            </main>
            <Footer />
          </div>
        </Route>
        <Route path="/menu">
          <div className="min-h-screen flex flex-col">
            <Navbar />
            <main className="flex-1">
              <Menu />
            </main>
            <Footer />
          </div>
        </Route>
        <Route path="/about">
          <div className="min-h-screen flex flex-col">
            <Navbar />
            <main className="flex-1">
              <About />
            </main>
            <Footer />
          </div>
        </Route>
        <Route path="/articles">
          <div className="min-h-screen flex flex-col">
            <Navbar />
            <main className="flex-1">
              <Articles />
            </main>
            <Footer />
          </div>
        </Route>
        <Route path="/article/:id">
          <div className="min-h-screen flex flex-col">
            <Navbar />
            <main className="flex-1">
              <ArticleDetail />
            </main>
            <Footer />
          </div>
        </Route>
        <Route path="/contact">
          <div className="min-h-screen flex flex-col">
            <Navbar />
            <main className="flex-1">
              <Contact />
            </main>
            <Footer />
          </div>
        </Route>
        <Route path="/auth">
          <AuthPage />
        </Route>
        <Route path="/admin/blog">
          <AdminBlog />
        </Route>
        <Route path="/admin/pages">
          <AdminPages />
        </Route>
        <Route path="/admin/pages/:pageId">
          {(params) => {
            if (params.pageId === 'menu') {
              return <AdminMenuPage />;
            }
            return <div className="container mx-auto p-6">
              <h1 className="text-3xl font-bold mb-6">Edit {params.pageId.charAt(0).toUpperCase() + params.pageId.slice(1)} Page</h1>
              <p>Page editor for {params.pageId} will be implemented here</p>
            </div>;
          }}
        </Route>
        <Route>
          <div className="min-h-screen flex flex-col">
            <Navbar />
            <main className="flex-1">
              <NotFound />
            </main>
            <Footer />
          </div>
        </Route>
      </Switch>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;