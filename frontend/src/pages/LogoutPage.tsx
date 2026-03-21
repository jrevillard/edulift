import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';

/**
 * Logout Page
 *
 * Handles user logout by clearing authentication and redirecting to login.
 * Uses synchronous state clearing to prevent React Router navigation race conditions.
 */
function LogoutPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const performLogout = async () => {
      // Clear auth state IMMEDIATELY and synchronously
      // This prevents other routes from seeing authenticated state
      authService.clearAuthState();

      // Navigate to login BEFORE async logout API call
      // This ensures browser is on /login even if API call is slow
      navigate('/login', { replace: true });

      // Call logout API in background (fire and forget)
      // Even if this fails, user is already logged out from local state
      try {
        await authService.logout();
      } catch (error) {
        console.error('Logout API call failed:', error);
        // Don't need to handle this - user is already logged out locally
      }
    };

    performLogout();
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-lg text-muted-foreground">Logging out...</p>
      </div>
    </div>
  );
}

export default LogoutPage;
