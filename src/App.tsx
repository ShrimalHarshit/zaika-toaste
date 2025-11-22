// src/App.tsx (updated parts)
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AdminAuthProvider } from "@/contexts/AdminAuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { useSupabaseConnection } from "@/hooks/useSupabaseConnection";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminProtectedRoute from "@/components/AdminProtectedRoute";
import Navbar from "./components/Navbar";
import Index from "./pages/Index";
import Products from "./pages/Products";
import ProductDetail from "./pages/ProductDetail";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Auth from "./pages/Auth";
import Account from "./pages/Account";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminLayout from "./pages/admin/AdminLayout";
import Dashboard from "./pages/admin/Dashboard";
import AdminProducts from "./pages/admin/Products";
import AdminOrders from "./pages/admin/Orders";
import AdminUsers from "./pages/admin/Users";
import AdminCoupons from "./pages/admin/Coupons";
import AdminCategories from "./pages/admin/Categories";
import AdminMessages from "./pages/admin/Messages";
import AdminSettings from "./pages/admin/Settings";
import NotFound from "./pages/NotFound";
import AuthConfirm from "./pages/AuthConfirm";
import ResetPassword from '@/pages/ResetPassword';
import { AlertCircle, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { ProfileProvider } from "./contexts/ProfileContext";
import 'leaflet/dist/leaflet.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes - data stays fresh
      gcTime: 1000 * 60 * 10, // 10 minutes cache
      retry: 2, // Only 2 retries
      retryDelay: 1000, // Fixed 1 second delay
      refetchOnWindowFocus: 'always', // Always check on focus
      refetchOnMount: false, // Don't refetch if data is fresh
      refetchInterval: false, // No automatic polling
    },
  },
});

// Connection Monitor Component
const ConnectionMonitor = () => {
  const { isConnected, reconnect } = useSupabaseConnection();
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (!isConnected) {
      setShowBanner(true);
    } else {
      // Hide banner after reconnection with a delay
      const timer = setTimeout(() => setShowBanner(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isConnected]);

  if (!showBanner) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 ${
        isConnected ? 'bg-green-500' : 'bg-red-500'
      } text-white px-4 py-3 shadow-lg transition-all duration-300`}
    >
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5" />
          <span className="font-medium">
            {isConnected
              ? 'Connection restored!'
              : 'Connection lost. Some features may not work properly.'}
          </span>
        </div>
        {!isConnected && (
          <button
            onClick={reconnect}
            className="flex items-center gap-2 px-4 py-1.5 bg-white text-red-600 rounded-lg hover:bg-gray-100 transition-colors text-sm font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            Reconnect
          </button>
        )}
      </div>
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ProfileProvider>
            <CartProvider>
              <ConnectionMonitor />
              <Routes>
                {/* Admin Login Route - wrapped with AdminAuthProvider */}
                <Route
                  path="/admin/login"
                  element={
                    <AdminAuthProvider>
                      <AdminLogin />
                    </AdminAuthProvider>
                  }
                />
                
                {/* Admin Routes - Protected for Admin Only */}
                <Route
                  path="/admin/*"
                  element={
                    <AdminAuthProvider>
                      <AdminProtectedRoute>
                        <AdminLayout />
                      </AdminProtectedRoute>
                    </AdminAuthProvider>
                  }
                >
                  <Route index element={<Dashboard />} />
                  <Route path="products" element={<AdminProducts />} />
                  <Route path="orders" element={<AdminOrders />} />
                  <Route path="users" element={<AdminUsers />} />
                  <Route path="coupons" element={<AdminCoupons />} />
                  <Route path="categories" element={<AdminCategories />} />
                  <Route path="messages" element={<AdminMessages />} />
                  <Route path="settings" element={<AdminSettings />} />
                </Route>

                {/* Auth Confirmation Route (No Navbar) */}
                <Route path="/auth/confirm" element={<AuthConfirm />} />
                
                {/* Reset Password Route (No Navbar) */}
                <Route path="/reset-password" element={<ResetPassword />} />

                {/* Public Routes with Navbar and Footer */}
                <Route
                  path="/*"
                  element={
                    <div className="flex flex-col min-h-screen">
                      <Navbar />
                      <main className="flex-1 pb-16 md:pb-0">
                        <Routes>
                          {/* Public Routes */}
                          <Route path="/" element={<Index />} />
                          <Route path="/products" element={<Products />} />
                          <Route path="/products/:id" element={<ProductDetail />} />
                          <Route path="/cart" element={<Cart />} />
                          <Route path="/about" element={<About />} />
                          <Route path="/contact" element={<Contact />} />
                          <Route path="/auth" element={<Auth />} />
                          
                          {/* Protected User Routes */}
                          <Route
                            path="/checkout"
                            element={
                              <ProtectedRoute>
                                <Checkout />
                              </ProtectedRoute>
                            }
                          />
                          <Route
                            path="/account"
                            element={
                              <ProtectedRoute>
                                <Account />
                              </ProtectedRoute>
                            }
                          />

                          {/* 404 Page */}
                          <Route path="*" element={<NotFound />} />
                        </Routes>
                      </main>
                    </div>
                  }
                />
              </Routes>
            </CartProvider>
          </ProfileProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;