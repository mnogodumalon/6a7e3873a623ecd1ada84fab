import '@/lib/sentry';
import '@/lib/stale-bundle';
import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ActionsProvider } from '@/context/ActionsContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorBusProvider } from '@/components/ErrorBus';
import { Layout } from '@/components/Layout';
import DashboardOverview from '@/pages/DashboardOverview';
import AdminPage from '@/pages/AdminPage';
import PublicPagesAdmin from '@/pages/PublicPagesAdmin';
import KlareErfassungPage from '@/pages/KlareErfassungPage';
import KlareErfassungDetailPage from '@/pages/KlareErfassungDetailPage';
// <custom:imports>
const IntentSchnellErfassenPage = lazy(() => import('@/pages/intents/SchnellErfassenPage'));
const IntentAufgabeAbschliessenPage = lazy(() => import('@/pages/intents/AufgabeAbschliessenPage'));
// </custom:imports>

// Lazy: public pages live outside <Layout> and only load on /#/public/:slug —
// dashboard users never pay for them, anonymous visitors skip the dashboard.
const PublicPage = lazy(() => import('@/pages/public/PublicPage'));

export default function App() {
  return (
    <ErrorBoundary>
      <ErrorBusProvider>
        <HashRouter>
          <ActionsProvider>
            <Routes>
              <Route path="public/:slug" element={<Suspense fallback={null}><PublicPage /></Suspense>} />
              <Route element={<Layout />}>
                <Route index element={<DashboardOverview />} />
                <Route path="klare-erfassung" element={<KlareErfassungPage />} />
                <Route path="klare-erfassung/:id" element={<KlareErfassungDetailPage />} />
                <Route path="admin" element={<AdminPage />} />
                <Route path="verwaltung/oeffentliche-seiten" element={<PublicPagesAdmin />} />
                {/* <custom:routes> */}
                <Route path="intents/schnell-erfassen" element={<Suspense fallback={null}><IntentSchnellErfassenPage /></Suspense>} />
                <Route path="intents/aufgabe-abschliessen" element={<Suspense fallback={null}><IntentAufgabeAbschliessenPage /></Suspense>} />
                {/* </custom:routes> */}
              </Route>
            </Routes>
          </ActionsProvider>
        </HashRouter>
      </ErrorBusProvider>
    </ErrorBoundary>
  );
}
