import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth-check', {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
          toast({
            title: "Authentication Required",
            description: "Please log in to access this page",
            variant: "destructive",
          });
          navigate('/auth');
        }
      } catch (error) {
        console.error('Auth check error:', error);
        setIsAuthenticated(false);
        toast({
          title: "Authentication Error",
          description: "Please log in to access this page",
          variant: "destructive",
        });
        navigate('/auth');
      }
    };

    checkAuth();
  }, [navigate, toast]);

  if (isAuthenticated === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Verifying authentication...</span>
      </div>
    );
  }

  return isAuthenticated ? <>{children}</> : null;
};

export default ProtectedRoute;