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
import EntranceScreen from "@/components/entrance-screen";

function Router() {
  return (
    <div className="min-h-screen flex flex-col">
      <Switch>
        <Route path="/" component={EntranceScreen} />
        <Route path="/home">
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