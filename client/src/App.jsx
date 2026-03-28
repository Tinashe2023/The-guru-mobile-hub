import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Analytics } from "@vercel/analytics/react";
import { useAuth } from './contexts/AuthContext';
import Layout from './components/Layout/Layout';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import TicketsPage from './pages/TicketsPage';
import ChatPage from './pages/ChatPage';
import ProfilePage from './pages/ProfilePage';
import DocumentsPage from './pages/DocumentsPage';
import ServicesPage from './pages/ServicesPage';
import ProductsPage from './pages/ProductsPage';
import DynamicBackground from './components/DynamicBackground';
import './App.css';

const SkeletonLoader = () => (
  <div className="page-loader">
    <div className="skeleton-page">
      <div className="skeleton skeleton-header" />
      <div className="skeleton-row">
        <div className="skeleton skeleton-card" />
        <div className="skeleton skeleton-card" />
      </div>
      <div className="skeleton skeleton-block" />
      <div className="skeleton skeleton-block" style={{ width: '60%' }} />
    </div>
  </div>
);

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <SkeletonLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <SkeletonLoader />;
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
};

function App() {
  const location = useLocation();
  const isPublicView = ["/", "/login", "/register"].includes(location.pathname);
  const blurValue = location.pathname === "/" ? 0 : 2.5;

  return (
    <>
      {isPublicView && <DynamicBackground blur={blurValue} />}
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="tickets" element={<TicketsPage />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="services" element={<ServicesPage />} />
          <Route path="products" element={<ProductsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Analytics />
    </>
  );
}

export default App;
