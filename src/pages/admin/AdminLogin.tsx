// src/pages/admin/AdminLogin.tsx
import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { Shield, Loader2, EyeOff, Eye } from 'lucide-react';

const AdminLogin = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const { login, adminUser, loading } = useAdminAuth();

  // Effect to handle navigation after successful login
  useEffect(() => {
    // This effect will trigger when `adminUser` is set by the context
    if (adminUser) {
      console.log("AdminLogin component detected adminUser, navigating...");
      // Navigation is handled here, not in the submit function
      window.location.href = '/admin'; 
    }
  }, [adminUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    
    const success = await login(formData.email, formData.password);
    
    if (!success) {
      // The context now handles showing the error toast, but we can keep one as a fallback
      // The error is also logged to the console.
    }
    
    // We set isSubmitting to false regardless, as the navigation is handled by the useEffect
    setIsSubmitting(false);
  };

  // Show a loader while the initial auth state is being checked
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If already logged in as admin, redirect immediately
  if (adminUser) {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <CardTitle>Admin Login</CardTitle>
          <CardDescription>
            Enter your admin credentials to access the admin panel
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                autoComplete="email"
                disabled={isSubmitting}
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  autoComplete="current-password"
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  disabled={isSubmitting}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Please wait...
                </>
              ) : (
                'Sign In'
              )}
            </Button>

            <div className="text-center text-sm mt-4">
              <a href="/" className="text-primary hover:underline">
                Back to website
              </a>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminLogin;