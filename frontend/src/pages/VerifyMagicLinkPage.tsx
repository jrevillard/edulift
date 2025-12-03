import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useFamily } from '../contexts/FamilyContext';
import { FamilyInvitationProposal } from '../components/family/FamilyInvitationProposal';
import { useMobileDetection } from '../hooks/useMobileDetection';
import { attemptMobileAppOpen, parseSearchParams } from '../utils/mobileRedirection';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, Smartphone, ExternalLink } from 'lucide-react';
import { APP_STORE_URL, PLAY_STORE_URL } from '../config/runtime';

interface PendingInvitation {
  id: string;
  email: string;
  familyId: string;
  familyName: string;
  inviteCode: string;
  inviterName?: string;
  expiresAt: string;
  createdAt: string;
}

const VerifyMagicLinkPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { verifyMagicLink, isAuthenticated, isLoading: authLoading } = useAuth();
  const { joinFamily } = useFamily();
  const [verificationState, setVerificationState] = useState<{
    isVerifying: boolean;
    error: string | null;
    hasAttempted: boolean;
  }>({
    isVerifying: true,
    error: null,
    hasAttempted: false,
  });
  const [invitationState, setInvitationState] = useState<{
    showProposal: boolean;
    pendingInvitation: PendingInvitation | null;
    joinError: string | null;
  }>({
    showProposal: false,
    pendingInvitation: null,
    joinError: null,
  });

  // Mobile detection state
  const [mobileState, setMobileState] = useState<{
    hasAttemptedRedirect: boolean;
    mobileAppDetected: boolean;
    showMobileFallback: boolean;
    isRedirecting: boolean;
  }>({
    hasAttemptedRedirect: false,
    mobileAppDetected: false,
    showMobileFallback: false,
    isRedirecting: false,
  });

  const mobileDetection = useMobileDetection();
  const token = searchParams.get('token');
  const inviteCode = searchParams.get('inviteCode');

  // Wrap verification logic in useCallback to prevent stale closures
  const runVerification = React.useCallback(async () => {
    if (!token) {
      setVerificationState({
        isVerifying: false,
        error: 'No verification token provided',
        hasAttempted: true,
      });
      return;
    }

    // If user is already authenticated, don't verify again
    if (isAuthenticated) {
      return;
    }

    // Prevent re-attempting verification after an error
    if (verificationState.hasAttempted) {
      return;
    }

    try {
      setVerificationState({ isVerifying: true, error: null, hasAttempted: true });
      const result = await verifyMagicLink(token, inviteCode || undefined);

      // Check if invitation was processed automatically by backend
      if (result?.invitationResult) {
        const { invitationResult } = result;
        console.log('🔍 DEBUG: Frontend received invitationResult:', JSON.stringify(invitationResult, null, 2));

        if (invitationResult.processed) {
          // Invitation was successfully processed, redirect accordingly
          if (invitationResult.redirectUrl) {
            console.log('🔍 DEBUG: Redirecting to:', invitationResult.redirectUrl);
            navigate(invitationResult.redirectUrl, { replace: true });
            return;
          } else {
            // Default redirect for processed invitations
            console.log('🔍 DEBUG: Redirecting to dashboard (default)');
            navigate('/dashboard', { replace: true });
            return;
          }
        } else {
          // Invitation processing failed
          console.log('🔍 DEBUG: Invitation processing failed:', invitationResult.reason);
          setVerificationState({
            isVerifying: false,
            error: invitationResult.reason || 'Failed to process invitation',
            hasAttempted: true,
          });
          return;
        }
      }

      // No invitation processing needed, auth successful
      setVerificationState({ isVerifying: false, error: null, hasAttempted: true });
      // User will be redirected by the Navigate component below
    } catch (error) {
      console.error('Magic link verification failed:', error);
      setVerificationState({
        isVerifying: false,
        error: error instanceof Error ? error.message : 'Verification failed',
        hasAttempted: true,
      });
    }
  }, [token, inviteCode, verifyMagicLink, isAuthenticated, verificationState.hasAttempted, navigate]);

  useEffect(() => {
    // Only proceed if auth context is not loading
    if (authLoading) {
      return;
    }

    // Desktop flow: validate immediately
    if (!mobileDetection.isMobile) {
      runVerification();
      return;
    }

    // Mobile flow: attempt app open, then verify on fallback
    if (!mobileState.hasAttemptedRedirect) {
      setMobileState(prev => ({ ...prev, isRedirecting: true }));
      const params = parseSearchParams(searchParams);

      attemptMobileAppOpen(
        '/auth/verify',
        params,
        mobileDetection,
        {
          fallbackDelay: 2500,
          onAttempt: (customUrl, method) => {
            console.log(`📱 Attempting to open mobile app: ${customUrl} using ${method}`);
            setMobileState(prev => ({
              ...prev,
              hasAttemptedRedirect: true,
              isRedirecting: false
            }));
          },
          onFallback: (reason) => {
            console.log('📱 Mobile app not detected, continuing on web. Reason:', reason);
            setMobileState(prev => ({
              ...prev,
              mobileAppDetected: false,
              showMobileFallback: true,
              isRedirecting: false
            }));
            // IMPORTANT: Only run verification on fallback
            runVerification();
          }
        }
      );
    }
  }, [authLoading, mobileDetection, mobileState.hasAttemptedRedirect, runVerification, searchParams]);

  // Handle accepting the family invitation
  const handleAcceptInvitation = async () => {
    const { pendingInvitation } = invitationState;
    if (!pendingInvitation) return;

    try {
      setInvitationState(prev => ({ ...prev, joinError: null }));
      await joinFamily(pendingInvitation.inviteCode);
      navigate('/dashboard', { replace: true });
    } catch (error) {
      console.error('Failed to join family via invitation:', error);
      setInvitationState(prev => ({
        ...prev,
        joinError: error instanceof Error ? error.message : 'Failed to join family'
      }));
    }
  };

  // Handle declining the family invitation
  const handleDeclineInvitation = () => {
    setInvitationState({
      showProposal: false,
      pendingInvitation: null,
      joinError: null
    });
    navigate('/onboarding', { replace: true });
  };

  // If user is already authenticated and no invitation proposal, redirect to dashboard
  if (isAuthenticated && !invitationState.showProposal) {
    return <Navigate to="/dashboard" replace />;
  }

  // Show loading state while auth context is loading or while verifying
  if (authLoading || verificationState.isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold" data-testid="edu-lift-title">EduLift</CardTitle>
            <CardDescription data-testid="verifying-message">
              Verifying your magic link...
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" role="status" aria-label="Verifying magic link" data-testid="verification-loading-spinner" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show family invitation proposal if we have a pending invitation
  if (invitationState.showProposal && invitationState.pendingInvitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4">
        <FamilyInvitationProposal
          isOpen={invitationState.showProposal}
          familyName={invitationState.pendingInvitation.familyName}
          inviterName={invitationState.pendingInvitation.inviterName}
          onAccept={handleAcceptInvitation}
          onDecline={handleDeclineInvitation}
          error={invitationState.joinError || undefined}
        />
      </div>
    );
  }

  // Show redirecting state while attempting mobile app launch
  if (mobileState.isRedirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold" data-testid="edu-lift-title">EduLift</CardTitle>
            <CardDescription>
              Opening Mobile App...
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" role="status" aria-label="Opening mobile app" />
            <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
              Launching EduLift mobile application...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show mobile fallback UI when app is not detected
  if (mobileState.showMobileFallback) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold" data-testid="edu-lift-title">EduLift</CardTitle>
            <CardDescription id="mobile-fallback-description">
              Get the Mobile App
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center space-y-2">
              <Smartphone className="h-12 w-12 mx-auto text-muted-foreground" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">
                It looks like you're on a mobile device but the EduLift app isn't installed.
              </p>
              <p className="text-sm font-medium">
                Would you like to download it?
              </p>
            </div>

            <div className="space-y-3" role="group" aria-labelledby="mobile-fallback-description">
              <Button
                onClick={() => window.open(APP_STORE_URL, '_blank', 'noopener,noreferrer')}
                className="w-full"
                variant="outline"
                aria-label="Download EduLift from the App Store"
              >
                <ExternalLink className="h-4 w-4 mr-2" aria-hidden="true" />
                Download on App Store
              </Button>

              <Button
                onClick={() => window.open(PLAY_STORE_URL, '_blank', 'noopener,noreferrer')}
                className="w-full"
                variant="outline"
                aria-label="Download EduLift from Google Play Store"
              >
                <ExternalLink className="h-4 w-4 mr-2" aria-hidden="true" />
                Download on Google Play
              </Button>

              <Button
                onClick={() => {
                  setMobileState(prev => ({ ...prev, showMobileFallback: false }));
                }}
                className="w-full"
                aria-label="Continue using EduLift in web browser"
              >
                Continue in Browser
              </Button>
            </div>

            <div className="text-center text-xs text-muted-foreground">
              <p>
                You can also continue using EduLift in your web browser.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show error state and option to go back to login
  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold" data-testid="edu-lift-title">EduLift</CardTitle>
          <CardDescription>
            Magic Link Verification
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="font-medium" data-testid="verification-failed-title">Verification Failed</div>
              <div className="mt-1" data-testid="verification-error-message">{verificationState.error}</div>
            </AlertDescription>
          </Alert>

          <div className="flex flex-col space-y-4">
            <Button
              onClick={() => navigate('/login')}
              className="w-full"
              data-testid="back-to-login-button"
            >
              Back to Login
            </Button>
            
            <div className="text-center text-xs text-muted-foreground">
              <p data-testid="verification-help-text">
                The magic link may have expired or been used already.
                <br />
                Please request a new one from the login page.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VerifyMagicLinkPage;