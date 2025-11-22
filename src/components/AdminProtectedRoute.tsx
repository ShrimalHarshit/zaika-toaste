// src/components/AdminProtectedRoute.tsx
import { Navigate } from "react-router-dom";
import { useAdminAuth } from "@/contexts/AdminAuthContext";

interface AdminProtectedRouteProps {
  children: React.ReactNode;
}

const AdminProtectedRoute = ({ children }: AdminProtectedRouteProps) => {
  const { adminUser, loading, logout } = useAdminAuth();

  // Show a loader while the initial authentication check is in progress
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If the user is not logged in as an admin, redirect to the login page
  if (!adminUser) {
    return <Navigate to="/admin/login" replace />;
  }

  // If the user is an admin, render the protected components
  return <>{children}</>;
};

export default AdminProtectedRoute;