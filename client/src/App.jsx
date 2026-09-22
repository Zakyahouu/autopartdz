import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import AdminShell from './components/layout/AdminShell';
import LoginPage from './pages/LoginPage';
import DocumentTypesPage from './pages/DocumentTypesPage';
import CarCategoriesPage from './pages/CarCategoriesPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public login page within admin shell context */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Admin Shell routes */}
          <Route path="/admin" element={<AdminShell />}>
            <Route index element={<Navigate to="/admin/document-types" replace />} />
            <Route path="document-types" element={<DocumentTypesPage />} />
            <Route path="car-categories" element={<CarCategoriesPage />} />
          </Route>

          {/* Root redirect */}
          <Route path="/" element={<Navigate to="/admin/document-types" replace />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/admin/document-types" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
