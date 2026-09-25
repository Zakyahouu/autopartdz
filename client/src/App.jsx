import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import AdminShell from './components/layout/AdminShell';
import LoginPage from './pages/LoginPage';
import CatalogPage from './pages/CatalogPage';
import OrdersQueuePage from './pages/OrdersQueuePage';
import OrderDetailPage from './pages/OrderDetailPage';
import DesignPreviewPage from './pages/DesignPreviewPage';
import ClientPortalPage from './pages/ClientPortalPage';
import PublicTrackingPage from './pages/PublicTrackingPage';
import ChinaPortalPage from './pages/ChinaPortalPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Client Clearance Portal (Moment Tier) */}
          <Route path="/" element={<ClientPortalPage />} />
          <Route path="/track" element={<PublicTrackingPage />} />

          {/* China Associate Portal */}
          <Route path="/china" element={<ChinaPortalPage />} />

          {/* Public login page */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Admin Shell routes */}
          <Route path="/admin" element={<AdminShell />}>
            <Route index element={<Navigate to="/admin/orders" replace />} />
            <Route path="orders" element={<OrdersQueuePage />} />
            <Route path="orders/:id" element={<OrderDetailPage />} />
            <Route path="catalog" element={<CatalogPage />} />
            <Route path="design-preview" element={<DesignPreviewPage />} />
            {/* Backward-compatible redirects */}
            <Route path="document-types" element={<Navigate to="/admin/catalog?tab=documents" replace />} />
            <Route path="car-categories" element={<Navigate to="/admin/catalog?tab=categories" replace />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
