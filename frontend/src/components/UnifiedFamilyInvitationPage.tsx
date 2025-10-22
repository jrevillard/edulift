import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useFamily } from '../contexts/FamilyContext';
import { unifiedInvitationService, type FamilyRole } from '../services/unifiedInvitationService';
import { authService } from '../services/authService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Loader2, AlertCircle, CheckCircle, Users } from 'lucide-react';

interface SignupFormData {
  email: string;
  name: string;
}

interface InvitationData {
  valid: boolean;
  familyName?: string;
  role?: FamilyRole;
  personalMessage?: string;
  error?: string;
  errorCode?: string;
  email?: string;
  existingUser?: boolean;
  userCurrentFamily?: {
    id: string;
    name: string;
  };
  canLeaveCurrentFamily?: boolean;
  cannotLeaveReason?: string;
}

export const UnifiedFamilyInvitationPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isAuthenticated, isLoading } = useAuth();
  const { currentFamily } = useFamily();
  
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [isValidating, setIsValidating] = useState(true);
  const [showSignupForm, setShowSignupForm] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [signupData, setSignupData] = useState<SignupFormData>({ email: '', name: '' });
  const [manualCode, setManualCode] = useState('');

  const inviteCode = searchParams.get('code');

  useEffect(() => {
    if (inviteCode) {
      validateInvitation();
    } else {
      // No invite code provided, stop validation and allow manual input
      setIsValidating(false);
    }
  }, [inviteCode]); // eslint-disable-line react-hooks/exhaustive-deps

  const validateInvitation = async () => {
    if (!inviteCode) {
      return;
    }
    
    setIsValidating(true);
    setError(null);
    
    try {
      const result = await unifiedInvitationService.validateFamilyInvitation(inviteCode);
      setInvitation(result);
      
      if (!result.valid) {
        setError(result.error || 'Invalid invitation');
      } else {
        setError(null);
      }
    } catch {
      setError('Failed to validate invitation');
    } finally {
      setIsValidating(false);
    }
  };

  const handleSignInExistingUser = async () => {
    if (!invitation?.email || !inviteCode) return;

    try {
      // Send magic link directly for existing user
      await authService.requestMagicLink(invitation.email, {
        inviteCode,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString()
      });
      
      // Redirect to standard magic link sent page with invitation context
      const returnUrl = encodeURIComponent(`/families/join?code=${inviteCode}`);
      navigate(`/login?email=${encodeURIComponent(invitation.email)}&returnTo=${returnUrl}&success=true`);
    } catch {
      setError('Failed to send magic link');
    }
  };

  const handleSignupSubmit = async () => {
    if (!inviteCode || !signupData.email || !signupData.name) return;

    try {
      // Request magic link with invitation context directly
      await authService.requestMagicLink(signupData.email, {
        inviteCode,
        name: signupData.name,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString()
      });
      
      // Redirect to standard magic link sent page with invitation context
      const returnUrl = encodeURIComponent(`/families/join?code=${inviteCode}`);
      navigate(`/login?email=${encodeURIComponent(signupData.email)}&returnTo=${returnUrl}&success=true`);
    } catch {
      setError('Failed to send magic link');
    }
  };

  const handleJoinFamily = async () => {
    if (!inviteCode || !user?.id) return;

    setIsJoining(true);
    setError(null);
    setNetworkError(null);

    try {
      let result;
      if (currentFamily) {
        result = await unifiedInvitationService.acceptFamilyInvitation(inviteCode, { leaveCurrentFamily: true });
      } else {
        result = await unifiedInvitationService.acceptFamilyInvitation(inviteCode);
      }
      
      if (result.success) {
        navigate('/dashboard');
      }
    } catch (err: unknown) {
      const error = err as { status?: number; message?: string };
      if (error.status === 409) {
        // Special handling for concurrent modification errors
        if (error.message?.includes('cancelled')) {
          setError(error.message);
        } else {
          setError(error.message || 'Conflict error');
        }
      } else if (error.message?.includes('last administrator')) {
        setError(error.message);
      } else {
        setNetworkError(error.message || 'Network error');
      }
    } finally {
      setIsJoining(false);
    }
  };

  const handleLeaveAndJoin = () => {
    setShowConfirmDialog(true);
  };

  const handleConfirmLeaveAndJoin = async () => {
    setShowConfirmDialog(false);
    await handleJoinFamily();
  };

  const handleRetry = () => {
    setNetworkError(null);
    handleJoinFamily();
  };

  const handleManualCodeValidation = () => {
    if (manualCode.trim()) {
      // Navigate to the URL with the manually entered code
      navigate(`/families/join?code=${encodeURIComponent(manualCode.trim())}`);
    }
  };

  // Show manual code input form when no invite code is provided in URL
  if (!inviteCode && !isValidating) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md" data-testid="UnifiedFamilyInvitationPage-Container-main">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Users className="h-12 w-12 text-blue-600" />
            </div>
            <CardTitle className="text-blue-600">Enter Invitation Code</CardTitle>
            <CardDescription>
              Please enter your family invitation code to continue
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="inviteCode">Invitation Code</Label>
              <Input
                id="inviteCode"
                data-testid="UnifiedFamilyInvitationPage-Input-inviteCode"
                type="text"
                placeholder="Enter invitation code"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && manualCode.trim()) {
                    handleManualCodeValidation();
                  }
                }}
              />
            </div>
            <Button
              data-testid="UnifiedFamilyInvitationPage-Button-validateCode"
              onClick={handleManualCodeValidation}
              disabled={!manualCode.trim()}
              className="w-full"
            >
              Validate Code
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isValidating) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center space-y-4" data-testid="UnifiedFamilyInvitationPage-Loading-validation">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <p className="text-gray-600">Validating invitation...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!invitation || !invitation.valid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md" data-testid="UnifiedFamilyInvitationPage-Container-main">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Users className="h-12 w-12 text-blue-600" />
            </div>
            <CardTitle className="text-blue-600" data-testid="UnifiedFamilyInvitationPage-Title-invalidInvitation">Invalid Invitation</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription data-testid={
                (invitation?.errorCode === 'CANCELLED') ? "UnifiedFamilyInvitationPage-Alert-cancelled" :
                (invitation?.errorCode === 'EMAIL_MISMATCH') ? "UnifiedFamilyInvitationPage-Alert-emailMismatch" :
                "UnifiedFamilyInvitationPage-Alert-error"
              }>
                {error || invitation?.error || 'Invalid invitation code'}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md" data-testid="UnifiedFamilyInvitationPage-Container-main">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Users className="h-12 w-12 text-blue-600" />
          </div>
          <CardTitle className="text-blue-600" data-testid="UnifiedFamilyInvitationPage-Title-familyInvitation">
            Family Invitation
          </CardTitle>
          <CardDescription>
            <span>You've been invited to join</span> <strong data-testid="UnifiedFamilyInvitationPage-Text-familyName">{invitation.familyName}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              This invitation is valid and ready to use.
            </AlertDescription>
          </Alert>

          {/* Role Information */}
          {invitation.role && (
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-sm text-blue-800" data-testid="UnifiedFamilyInvitationPage-Text-role">
                You've been invited to join {invitation.role === 'ADMIN' ? 'as an administrator' : 'as a member'}.
                {invitation.role === 'ADMIN' && (
                  <span className="block text-xs mt-1 text-blue-600">
                    As an administrator, you'll be able to manage family members and resources.
                  </span>
                )}
              </p>
            </div>
          )}

          {/* Personal Message */}
          {invitation.personalMessage && (
            <div className="bg-green-50 p-3 rounded-lg">
              <p className="text-sm text-green-800 font-medium">Personal Message:</p>
              <p className="text-sm text-green-700 mt-1" data-testid="UnifiedFamilyInvitationPage-Text-personalMessage">{invitation.personalMessage}</p>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription data-testid={
                (invitation?.errorCode === 'CANCELLED') ? "UnifiedFamilyInvitationPage-Alert-cancelled" :
                (invitation?.errorCode === 'EMAIL_MISMATCH') ? "UnifiedFamilyInvitationPage-Alert-emailMismatch" :
                "UnifiedFamilyInvitationPage-Alert-error"
              }>
                {error}
              </AlertDescription>
            </Alert>
          )}

          {networkError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription data-testid="UnifiedFamilyInvitationPage-Alert-networkError">
                {networkError}
              </AlertDescription>
              <div className="mt-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleRetry}
                  data-testid="UnifiedFamilyInvitationPage-Button-retry"
                >
                  Try Again
                </Button>
              </div>
            </Alert>
          )}

          {!isAuthenticated && (
            <div className="space-y-4">
              {/* Show different UI based on whether user exists */}
              {invitation.email && invitation.existingUser && invitation.userCurrentFamily ? (
                // Existing user with family - show family conflict without requiring auth
                <div className="space-y-4">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription data-testid="UnifiedFamilyInvitationPage-Text-existingUserWithFamily">
                      This invitation is for <strong>{invitation.email}</strong>, who already belongs to <strong>{invitation.userCurrentFamily.name}</strong>.
                    </AlertDescription>
                  </Alert>
                  <div className="bg-gray-50 p-3 rounded-lg space-y-2">
                    <p className="text-sm text-gray-600">Current family:</p>
                    <p className="text-sm font-medium" data-testid="UnifiedFamilyInvitationPage-Text-userCurrentFamily">{invitation.userCurrentFamily.name}</p>
                    <p className="text-sm text-gray-600">New invitation:</p>
                    <p className="text-sm font-medium" data-testid="UnifiedFamilyInvitationPage-Text-invitationFamily">{invitation.familyName}</p>
                  </div>
                  
                  {invitation.canLeaveCurrentFamily === false ? (
                    // User cannot leave current family (last admin)
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription data-testid="UnifiedFamilyInvitationPage-Alert-cannotLeave">
                        {invitation.cannotLeaveReason}
                      </AlertDescription>
                    </Alert>
                  ) : (
                    // User can leave current family
                    <Button 
                      onClick={handleSignInExistingUser}
                      className="w-full"
                      variant="destructive"
                      data-testid="UnifiedFamilyInvitationPage-Button-signInToChangeFamily"
                    >
                      Sign In to Leave {invitation.userCurrentFamily.name} and Join {invitation.familyName}
                    </Button>
                  )}
                </div>
              ) : invitation.email && invitation.existingUser ? (
                // Existing user without family - send magic link directly
                <div className="space-y-4">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription data-testid="UnifiedFamilyInvitationPage-Text-existingUserMessage">
                      This invitation is for <strong>{invitation.email}</strong>. We'll send you a magic link to join the family.
                    </AlertDescription>
                  </Alert>
                  <Button 
                    onClick={handleSignInExistingUser}
                    className="w-full"
                    data-testid="UnifiedFamilyInvitationPage-Button-sendMagicLink"
                  >
                    Send Magic Link
                  </Button>
                </div>
              ) : invitation.email && !invitation.existingUser ? (
                // New user with known email - show sign in button that opens name-only form
                <div className="space-y-4">
                  {!showSignupForm ? (
                    <div className="space-y-4">
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription data-testid="UnifiedFamilyInvitationPage-Text-newUserMessage">
                          This invitation is for <strong>{invitation.email}</strong>.
                        </AlertDescription>
                      </Alert>
                      <Button 
                        onClick={() => {
                          setShowSignupForm(true);
                          setSignupData({...signupData, email: invitation.email || ''});
                        }}
                        className="w-full"
                        data-testid="UnifiedFamilyInvitationPage-Button-signInToJoin"
                      >
                        Sign In to join {invitation.familyName}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4" data-testid="SignupForm-Container-form">
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-sm text-gray-700" data-testid="UnifiedFamilyInvitationPage-Text-emailPreset">
                          Email: <strong>{invitation.email}</strong>
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="name">Your Name</Label>
                        <Input
                          id="name"
                          data-testid="SignupForm-Input-name"
                          type="text"
                          placeholder="Your name"
                          value={signupData.name}
                          onChange={(e) => setSignupData({...signupData, name: e.target.value})}
                        />
                      </div>
                      <Button 
                        onClick={handleSignupSubmit}
                        disabled={!signupData.name}
                        className="w-full"
                        data-testid="SignupForm-Button-submit"
                      >
                        Send Magic Link
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                // All invitations should have email according to the new proposal
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription data-testid="UnifiedFamilyInvitationPage-Alert-noEmailError">
                    Invalid invitation format. All invitations must be email-based.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {isAuthenticated && !currentFamily && (
            <div className="space-y-4">
              <Button 
                onClick={handleJoinFamily}
                disabled={isJoining}
                className="w-full"
                data-testid="UnifiedFamilyInvitationPage-Button-joinFamily"
              >
                {isJoining ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Joining family...
                  </>
                ) : (
                  `Join ${invitation.familyName}`
                )}
              </Button>
            </div>
          )}

          {isAuthenticated && currentFamily && (
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription data-testid="UnifiedFamilyInvitationPage-Alert-alreadyInFamily">
                  You already belong to a family
                </AlertDescription>
              </Alert>
              <div className="bg-gray-50 p-3 rounded-lg space-y-2">
                <p className="text-sm text-gray-600">Current family:</p>
                <p className="text-sm font-medium" data-testid="UnifiedFamilyInvitationPage-Text-currentFamily">{currentFamily.name}</p>
                <p className="text-sm text-gray-600">New invitation:</p>
                <p className="text-sm font-medium" data-testid="UnifiedFamilyInvitationPage-Text-newFamily">{invitation.familyName}</p>
              </div>
              
              {invitation.canLeaveCurrentFamily === false ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription data-testid="UnifiedFamilyInvitationPage-Alert-cannotLeave">
                    {invitation.cannotLeaveReason}
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-2">
                  <Button 
                    onClick={handleLeaveAndJoin}
                    disabled={isJoining}
                    variant="destructive"
                    className="w-full"
                    data-testid="UnifiedFamilyInvitationPage-Button-leaveAndJoin"
                  >
                    {isJoining ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      'Leave current family and join'
                    )}
                  </Button>
                  
                  <Button 
                    onClick={() => navigate('/dashboard')}
                    variant="outline"
                    className="w-full"
                    data-testid="UnifiedFamilyInvitationPage-Button-cancel"
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          )}

          {showConfirmDialog && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" data-testid="ConfirmDialog-Modal-container">
              <Card className="w-full max-w-md">
                <CardHeader>
                  <CardTitle className="text-red-600">Confirm Family Change</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription data-testid="ConfirmDialog-Text-warning">
                      You are about to leave your current family (<strong>{currentFamily?.name}</strong>) and join <strong>{invitation.familyName}</strong>. This action cannot be undone.
                    </AlertDescription>
                  </Alert>
                  
                  <div className="space-y-2">
                    <Button 
                      onClick={handleConfirmLeaveAndJoin}
                      variant="destructive"
                      className="w-full"
                      data-testid="ConfirmDialog-Button-confirm"
                    >
                      Confirm
                    </Button>
                    <Button 
                      onClick={() => setShowConfirmDialog(false)}
                      variant="outline"
                      className="w-full"
                      data-testid="ConfirmDialog-Button-cancel"
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};