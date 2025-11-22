import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';

const AuthConfirm = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const confirmUser = async () => {
      const token_hash = searchParams.get('token_hash');
      const type = searchParams.get('type');
      const next = searchParams.get('next') || '/';

      console.log('🔍 Auth confirm params:', { 
        token_hash: token_hash?.substring(0, 20) + '...', 
        type, 
        next 
      });

      if (!token_hash || !type) {
        console.error('❌ Missing required parameters');
        toast.error('Invalid confirmation link');
        navigate('/auth');
        return;
      }

      try {
        console.log('🔄 Verifying OTP...');
        
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash,
          type: type as any,
        });

        if (error) {
          console.error('❌ Verification error:', error);
          
          if (error.message?.includes('expired')) {
            toast.error('This link has expired. Please request a new one.');
          } else if (error.message?.includes('already been used')) {
            toast.error('This link has already been used. Please request a new one.');
          } else {
            toast.error(`Verification failed: ${error.message}`);
          }
          
          navigate('/auth');
          return;
        }

        console.log('✅ Verification successful');
        console.log('User:', data.session?.user?.email);
        
        // Small delay to ensure session is fully established
        setTimeout(() => {
          console.log('📍 Redirecting to:', next);
          navigate(next);
        }, 100);
        
      } catch (err) {
        console.error('❌ Unexpected error:', err);
        toast.error('An unexpected error occurred');
        navigate('/auth');
      }
    };

    confirmUser();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Verifying your link...</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthConfirm;