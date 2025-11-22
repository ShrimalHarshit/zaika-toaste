import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Eye, EyeOff } from 'lucide-react';

const Auth = () => {
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get('mode') === 'register' ? 'register' : 
                     searchParams.get('mode') === 'forgot' ? 'forgot' : 'login';
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });

  const { login, register, loginWithGoogle, resetPassword } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent double submission
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    
    try {
      if (mode === 'forgot') {
        // Handle forgot password
        const success = await resetPassword(formData.email);
        
        if (success) {
          setEmailSent(true);
          toast.success('Password reset link sent to your email');
        } else {
          toast.error('Failed to send reset link. Please check your email and try again.');
        }
      } else if (mode === 'register') {
        if (formData.password !== formData.confirmPassword) {
          toast.error('Passwords do not match');
          return;
        }
        if (formData.password.length < 6) {
          toast.error('Password must be at least 6 characters');
          return;
        }

        
        const success = await register({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          password: formData.password,
        });
        
        if (success) {
          toast.success('Account created! Redirecting...');
          setTimeout(() => navigate('/'), 500);
        } else {
          toast.error('Registration failed. Email may already exist.');
        }
      } else {
        
        const success = await login(formData.email, formData.password);
        
        if (success) {
          toast.success('Welcome back!');
          setTimeout(() => navigate('/'), 500);
        } else {
          toast.error('Invalid email or password');
        }
      }
    } catch (error) {
      console.error('Submit error:', error);
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
    });
    setEmailSent(false);
  };

  const switchMode = (newMode: 'login' | 'register' | 'forgot') => {
    resetForm();
    setMode(newMode);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
            {mode === 'login' ? 'Welcome Back' : 
             mode === 'register' ? 'Create Account' : 
             'Reset Password'}
          </CardTitle>
          <CardDescription>
            {mode === 'login'
              ? 'Enter your credentials to access your account'
              : mode === 'register'
              ? 'Fill in your details to create a new account'
              : emailSent 
              ? 'Check your email for reset instructions'
              : 'Enter your email to receive a password reset link'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!emailSent ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      required
                      autoComplete="given-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      required
                      autoComplete="family-name"
                    />
                  </div>
                </div>
              )}
              {mode === 'register' && (
                <div>
                  <Label htmlFor="phone">Mobile Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    required
                    autoComplete="tel"
                  />
                </div>
              )}
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  autoComplete="email"
                />
              </div>
              {mode !== 'forgot' && (
                <div>
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}
              {mode === 'register' && (
                <div>
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    required
                    autoComplete="new-password"
                  />
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting 
                  ? 'Please wait...' 
                  : mode === 'login' ? 'Sign In' 
                  : mode === 'register' ? 'Create Account'
                  : 'Send Reset Link'}
              </Button>

              {mode !== 'forgot' && (
                <>
                  <div className="relative my-4">
                    <Separator />
                    <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-xs text-muted-foreground">
                      OR
                    </span>
                  </div>

                  <Button type="button" variant="outline" className="w-full" onClick={loginWithGoogle}>
                    Continue with Google
                  </Button>
                </>
              )}

              <div className="text-center text-sm mt-4">
                {mode === 'login' ? (
                  <>
                    Don't have an account?{' '}
                    <button type="button" className="text-primary hover:underline" onClick={() => switchMode('register')}>
                      Sign up
                    </button>
                    <div className="mt-2">
                      <button type="button" className="text-primary hover:underline" onClick={() => switchMode('forgot')}>
                        Forgot your password?
                      </button>
                    </div>
                  </>
                ) : mode === 'register' ? (
                  <>
                    Already have an account?{' '}
                    <button type="button" className="text-primary hover:underline" onClick={() => switchMode('login')}>
                      Sign in
                    </button>
                  </>
                ) : (
                  <div>
                    Remember your password?{' '}
                    <button type="button" className="text-primary hover:underline" onClick={() => switchMode('login')}>
                      Back to login
                    </button>
                  </div>
                )}
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="text-center py-4">
                <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-muted-foreground">
                  We've sent a password reset link to <strong>{formData.email}</strong>
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Please check your email and follow the instructions to reset your password.
                </p>
              </div>
              
              <div className="text-center text-sm">
                <p>Didn't receive the email?</p>
                <button 
                  type="button" 
                  className="text-primary hover:underline" 
                  onClick={() => setEmailSent(false)}
                >
                  Try again
                </button>
                <span className="mx-2">or</span>
                <button 
                  type="button" 
                  className="text-primary hover:underline" 
                  onClick={() => switchMode('login')}
                >
                  Back to login
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;