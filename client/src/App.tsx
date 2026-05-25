// ============================================================
// App.tsx — Routes et configuration globale Evaplant
// ============================================================

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AppProvider } from "./contexts/AppContext";

// Pages
import Home from "./pages/Home";
import Operations from "./pages/Operations";
import SuiviMenu from "./pages/SuiviMenu";
import SuiviNouveau from "./pages/SuiviNouveau";
import SuiviWizard from "./pages/SuiviWizard";
import PompageMenu from "./pages/PompageMenu";
import PompageNouveau from "./pages/PompageNouveau";
import PompageWizard from "./pages/PompageWizard";
import Contacts from "./pages/Contacts";
import Parametres from "./pages/Parametres";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/operations" component={Operations} />
      {/* Suivi terrain */}
      <Route path="/suivi" component={SuiviMenu} />
      <Route path="/suivi/nouveau" component={SuiviNouveau} />
      <Route path="/suivi/:id" component={SuiviWizard} />
      {/* Tests de pompage */}
      <Route path="/pompage" component={PompageMenu} />
      <Route path="/pompage/nouveau" component={PompageNouveau} />
      <Route path="/pompage/:id" component={PompageWizard} />
      {/* Contacts */}
      <Route path="/contacts" component={Contacts} />
      {/* Paramètres */}
      <Route path="/parametres" component={Parametres} />
      {/* 404 */}
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <AppProvider>
          <TooltipProvider>
            <Toaster position="top-center" richColors />
            <Router />
          </TooltipProvider>
        </AppProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
