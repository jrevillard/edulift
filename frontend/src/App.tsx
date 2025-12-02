import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { FamilyProvider } from './contexts/FamilyContext';
import { SocketProvider } from './contexts/SocketContext';
import ProtectedRoute from './components/ProtectedRoute';
import { FamilyRequiredRoute } from './components/family/FamilyRequiredRoute';
import OnboardingPage from './pages/OnboardingPage';
import { ResponsiveLayout } from './components/layout/ResponsiveLayout';
import { Toaster } from './components/ui/sonner';
import { ConnectionStatusBanner } from './components/ConnectionStatusBanner';
import BackendConnectionAlert from './components/common/BackendConnectionAlert';
import { ErrorBoundary } from './components/ErrorBoundary';
import LoginPage from './pages/LoginPage';
import VerifyMagicLinkPage from './pages/VerifyMagicLinkPage';
import TermsOfServicePage from './pages/TermsOfServicePage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import AccountDeletionPage from './pages/AccountDeletionPage';
import { UnifiedFamilyInvitationPage } from './components/UnifiedFamilyInvitationPage';
import { UnifiedGroupInvitationPage } from './components/UnifiedGroupInvitationPage';
import DashboardPage from './pages/DashboardPage';
import GroupsPage from './pages/GroupsPage';
import ChildrenPage from './pages/ChildrenPage';
import VehiclesPage from './pages/VehiclesPage';
import SchedulePage from './pages/SchedulePage';
import ManageGroupPage from './pages/ManageGroupPage';
import ManageFamilyPage from './pages/ManageFamilyPage';
import ProfilePage from './pages/ProfilePage';
import { useTimezoneAutoSync } from './hooks/useTimezoneAutoSync';

// Create a client for React Query with enhanced error handling
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: unknown) => {
        // Don't retry if the backend is not running
        const errorObj = error as { code?: string; message?: string };
        if (errorObj?.code === 'ECONNREFUSED' || errorObj?.message === 'Network Error') {
          return false;
        }
        // Retry other errors up to 2 times
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes
    },
    mutations: {
      retry: (failureCount, error: unknown) => {
        // Don't retry mutations if the backend is not running
        const errorObj = error as { code?: string; message?: string };
        if (errorObj?.code === 'ECONNREFUSED' || errorObj?.message === 'Network Error') {
          return false;
        }
        // Only retry mutations once for other errors
        return failureCount < 1;
      },
    },
  },
});

/**
 * AppContent wrapper component
 *
 * Required to use useTimezoneAutoSync hook which needs AuthContext.
 * Must be inside AuthProvider to access user data.
 *
 * This wrapper exists because:
 * - useTimezoneAutoSync needs access to AuthContext (user, updateUser)
 * - Hooks can only be used inside components that are children of their provider
 * - We need to call the hook at the app level to ensure timezone auto-sync works globally
 */
function AppContent() {
  // Auto-sync timezone with browser when enabled
  useTimezoneAutoSync();

  return (
    <FamilyProvider>
      <SocketProvider>
        <Router>
          <BackendConnectionAlert />
          <ConnectionStatusBanner />
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/auth/verify" element={<VerifyMagicLinkPage />} />
            <Route path="/terms-of-service" element={<TermsOfServicePage />} />
            <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
            <Route path="/account-deletion" element={<AccountDeletionPage />} />
            <Route path="/families/join" element={<UnifiedFamilyInvitationPage />} />
            <Route path="/groups/join" element={<UnifiedGroupInvitationPage />} />
            
            {/* Onboarding route for new users */}
            <Route path="/onboarding" element={
              <ProtectedRoute>
                <OnboardingPage />
              </ProtectedRoute>
            } />
            
            {/* Protected routes with mandatory family requirement */}
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <FamilyRequiredRoute>
                  <ResponsiveLayout>
                    <DashboardPage />
                  </ResponsiveLayout>
                </FamilyRequiredRoute>
              </ProtectedRoute>
            } />
            
            <Route path="/groups" element={
              <ProtectedRoute>
                <FamilyRequiredRoute>
                  <ResponsiveLayout>
                    <GroupsPage />
                  </ResponsiveLayout>
                </FamilyRequiredRoute>
              </ProtectedRoute>
            } />
            
            <Route path="/groups/:groupId/manage" element={
              <ProtectedRoute>
                <FamilyRequiredRoute>
                  <ResponsiveLayout>
                    <ManageGroupPage />
                  </ResponsiveLayout>
                </FamilyRequiredRoute>
              </ProtectedRoute>
            } />
            
            <Route path="/family/manage" element={
              <ProtectedRoute>
                <FamilyRequiredRoute>
                  <ResponsiveLayout>
                    <ManageFamilyPage />
                  </ResponsiveLayout>
                </FamilyRequiredRoute>
              </ProtectedRoute>
            } />
            
            <Route path="/profile" element={
              <ProtectedRoute>
                <ResponsiveLayout>
                  <ProfilePage />
                </ResponsiveLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/children" element={
              <ProtectedRoute>
                <FamilyRequiredRoute>
                  <ResponsiveLayout>
                    <ChildrenPage />
                  </ResponsiveLayout>
                </FamilyRequiredRoute>
              </ProtectedRoute>
            } />
            
            <Route path="/vehicles" element={
              <ProtectedRoute>
                <FamilyRequiredRoute>
                  <ResponsiveLayout>
                    <VehiclesPage />
                  </ResponsiveLayout>
                </FamilyRequiredRoute>
              </ProtectedRoute>
            } />
            
            <Route path="/schedule" element={
              <ProtectedRoute>
                <FamilyRequiredRoute>
                  <ResponsiveLayout fullWidth={true}>
                    <SchedulePage />
                  </ResponsiveLayout>
                </FamilyRequiredRoute>
              </ProtectedRoute>
            } />
            
            {/* Default redirect */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Router>
      </SocketProvider>
    </FamilyProvider>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
        <Toaster />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;