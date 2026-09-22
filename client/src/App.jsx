import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import AdminShell from './components/layout/AdminShell';
import LoginPage from './pages/LoginPage';
import CatalogPage from './pages/CatalogPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public login page */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Admin Shell routes */}
          <Route path="/admin" element={<AdminShell />}>
            <Route index element={<Navigate to="/admin/catalog" replace />} />
            <Route path="catalog" element={<CatalogPage />} />
            {/* Backward-compatible redirects */}
            <Route path="document-types" element={<Navigate to="/admin/catalog?tab=documents" replace />} />
            <Route path="car-categories" element={<Navigate to="/admin/catalog?tab=categories" replace />} />
          </Route>

          {/* Root redirect */}
          <Route path="/" element={<Navigate to="/admin/catalog" replace />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/admin/catalog" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
