import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useFamily } from '../contexts/FamilyContext';
import { FamilyInvitationProposal } from '../components/family/FamilyInvitationProposal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle } from 'lucide-react';

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
  }>({
    isVerifying: true,
    error: null,
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

  const token = searchParams.get('token');
  const inviteCode = searchParams.get('inviteCode');

  useEffect(() => {
    const handleVerification = async () => {
      if (!token) {
        setVerificationState({
          isVerifying: false,
          error: 'No verification token provided'
        });
        return;
      }

      // If user is already authenticated, don't verify again
      if (isAuthenticated) {
        return;
      }

      try {
        setVerificationState({ isVerifying: true, error: null });
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
              error: invitationResult.reason || 'Failed to process invitation'
            });
            return;
          }
        }
        
        // No invitation processing needed, auth successful
        setVerificationState({ isVerifying: false, error: null });
        // User will be redirected by the Navigate component below
      } catch (error) {
        console.error('Magic link verification failed:', error);
        setVerificationState({
          isVerifying: false,
          error: error instanceof Error ? error.message : 'Verification failed'
        });
      }
    };

    // Only proceed if auth context is not loading
    if (!authLoading) {
      handleVerification();
    }
  }, [token, inviteCode, navigate, verifyMagicLink, isAuthenticated, authLoading]);

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