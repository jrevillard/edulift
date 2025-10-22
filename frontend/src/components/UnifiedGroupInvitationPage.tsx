import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useFamily } from '../contexts/FamilyContext';
import { authService } from '../services/authService';
import { unifiedInvitationService } from '../services/unifiedInvitationService';
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

interface GroupInvitationData {
  valid: boolean;
  groupName?: string;
  description?: string;
  ownerFamily?: string;
  requiresAuth?: boolean;
  error?: string;
  errorCode?: string;
  email?: string;
  existingUser?: boolean;
}

interface AcceptResult {
  success?: boolean;
  familyJoined?: boolean;
  membersAdded?: number;
  alreadyMember?: boolean;
  alreadyAccepted?: boolean;
  acceptedBy?: string;
  message?: string;
}

export const UnifiedGroupInvitationPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isAuthenticated, isLoading } = useAuth();
  const { currentFamily } = useFamily();
  
  const [invitation, setInvitation] = useState<GroupInvitationData | null>(null);
  const [isValidating, setIsValidating] = useState(true);
  const [showSignupForm, setShowSignupForm] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [signupData, setSignupData] = useState<SignupFormData>({ email: '', name: '' });
  const [shareMessage, setShareMessage] = useState('');
  const [messageSent, setMessageSent] = useState(false);
  const [acceptResult, setAcceptResult] = useState<AcceptResult | null>(null);

  const inviteCode = searchParams.get('code');
  console.log('🔍 DEBUG: UnifiedGroupInvitationPage - extracted inviteCode from URL:', inviteCode);

  useEffect(() => {
    if (inviteCode) {
      validateInvitation();
    }
  }, [inviteCode]); // eslint-disable-line react-hooks/exhaustive-deps

  const validateInvitation = async () => {
    if (!inviteCode) return;
    
    setIsValidating(true);
    setError(null);
    
    try {
      const result = await unifiedInvitationService.validateGroupInvitation(inviteCode);
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
    console.log('🔍 DEBUG: handleSignInExistingUser - inviteCode:', inviteCode, 'invitation.email:', invitation?.email);
    if (!invitation?.email || !inviteCode) return;

    try {
      // Send magic link directly for existing user
      console.log('🔍 DEBUG: Calling requestMagicLink with inviteCode:', inviteCode);
      await authService.requestMagicLink(invitation.email, {
        inviteCode,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString()
      });
      
      // Redirect to standard magic link sent page with invitation context
      const returnUrl = encodeURIComponent(`/groups/join?code=${inviteCode}`);
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
      const returnUrl = encodeURIComponent(`/groups/join?code=${inviteCode}`);
      navigate(`/login?email=${encodeURIComponent(signupData.email)}&returnTo=${returnUrl}&success=true`);
    } catch {
      setError('Failed to send magic link');
    }
  };

  const handleAcceptForFamily = async () => {
    if (!inviteCode || !user?.id) return;

    setIsAccepting(true);
    setError(null);
    setNetworkError(null);

    try {
      const result = await unifiedInvitationService.acceptGroupInvitation(inviteCode);
      setAcceptResult(result);
      
      if (result.success && result.familyJoined) {
        navigate('/dashboard');
      }
    } catch (err: unknown) {
      const error = err as { status?: number; message?: string };
      setNetworkError(error.message || 'Network error');
    } finally {
      setIsAccepting(false);
    }
  };

  const handleShareWithAdmin = () => {
    setShowShareDialog(true);
  };

  const handleSendMessage = async () => {
    try {
      // Mock sending message to admin
      setMessageSent(true);
      setShowShareDialog(false);
    } catch {
      setError('Failed to send message');
    }
  };

  const handleCreateFamily = () => {
    const returnUrl = encodeURIComponent(`/groups/join?code=${inviteCode}`);
    navigate(`/families/onboarding?returnTo=${returnUrl}`);
  };

  const handleGoToGroup = () => {
    if (invitation?.groupName) {
      const groupSlug = invitation.groupName.toLowerCase().replace(/\\s+/g, '-');
      navigate(`/groups/${groupSlug}`);
    }
  };

  const handleRetry = () => {
    setNetworkError(null);
    handleAcceptForFamily();
  };

  if (isValidating) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center space-y-4" data-testid="GroupInvitationPage-Loading-validation">
              <Loader2 className="h-8 w-8 animate-spin text-green-600" />
              <p className="text-gray-600">Validating invitation...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!invitation || !invitation.valid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md" data-testid="UnifiedGroupInvitationPage-Container-main">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Users className="h-12 w-12 text-green-600" />
            </div>
            <CardTitle className="text-green-600" data-testid="UnifiedGroupInvitationPage-Title-invalidInvitation">Invalid Invitation</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription data-testid={
                (invitation?.errorCode === 'EMAIL_MISMATCH') ? "UnifiedGroupInvitationPage-Alert-emailMismatch" :
                "UnifiedGroupInvitationPage-Alert-error"
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
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
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
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md" data-testid="UnifiedGroupInvitationPage-Container-main">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Users className="h-12 w-12 text-green-600" />
          </div>
          <CardTitle className="text-green-600" data-testid="UnifiedGroupInvitationPage-Title-groupInvitation">
            Group Invitation
          </CardTitle>
          <CardDescription>
            <span>You've been invited to join</span> <strong data-testid="UnifiedGroupInvitationPage-Text-groupName">{invitation.groupName}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              This invitation is valid and ready to use.
            </AlertDescription>
          </Alert>

          {invitation.description && (
            <div className="bg-green-50 p-3 rounded-lg">
              <p className="text-sm text-green-800 font-medium">Description:</p>
              <p className="text-sm text-green-700 mt-1" data-testid="GroupInvitationPage-Text-description">{invitation.description}</p>
            </div>
          )}

          {invitation.ownerFamily && (
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-sm text-blue-800 font-medium">Managed by:</p>
              <p className="text-sm text-blue-700 mt-1" data-testid="GroupInvitationPage-Text-ownerFamily">{invitation.ownerFamily}</p>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription data-testid={
                (invitation?.errorCode === 'EMAIL_MISMATCH') ? "GroupInvitationPage-Alert-emailMismatch" :
                "GroupInvitationPage-Alert-error"
              }>
                {error}
              </AlertDescription>
            </Alert>
          )}

          {networkError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription data-testid="GroupInvitationPage-Alert-networkError">
                {networkError}
              </AlertDescription>
              <div className="mt-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleRetry}
                  data-testid="GroupInvitationPage-Button-retry"
                >
                  Try Again
                </Button>
              </div>
            </Alert>
          )}

          {!isAuthenticated && (
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription data-testid="GroupInvitationPage-Alert-requiresAuth">
                  Sign in required to join this group. Groups are joined by families, not individual users.
                </AlertDescription>
              </Alert>
              
              {/* Show different UI based on whether user exists */}
              {invitation.email && invitation.existingUser ? (
                // Existing user with known email - send magic link directly
                <div className="space-y-4">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription data-testid="GroupInvitationPage-Text-existingUserMessage">
                      This invitation is for <strong>{invitation.email}</strong>. After signing in, check if you can accept this invitation for your family.
                    </AlertDescription>
                  </Alert>
                  <Button 
                    onClick={handleSignInExistingUser}
                    className="w-full"
                    data-testid="GroupInvitationPage-Button-sendMagicLink"
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
                        <AlertDescription data-testid="GroupInvitationPage-Text-newUserMessage">
                          This invitation is for <strong>{invitation.email}</strong>. You'll need to create an account and set up a family first.
                        </AlertDescription>
                      </Alert>
                      <Button 
                        onClick={() => {
                          setShowSignupForm(true);
                          setSignupData({...signupData, email: invitation.email || ''});
                        }}
                        className="w-full"
                        data-testid="GroupInvitationPage-Button-signInToJoin"
                      >
                        Sign In to join {invitation.groupName}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4" data-testid="SignupForm-Container-form">
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-sm text-gray-700" data-testid="GroupInvitationPage-Text-emailPreset">
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
                // Invitation without email (shouldn't happen normally, but handle gracefully)
                <div className="space-y-4">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription data-testid="GroupInvitationPage-Text-genericInvitation">
                      You need to sign in to join this group with your family.
                    </AlertDescription>
                  </Alert>
                  <Button 
                    onClick={() => {
                      const returnUrl = encodeURIComponent(`/groups/join?code=${inviteCode}`);
                      navigate(`/login?returnTo=${returnUrl}`);
                    }}
                    className="w-full"
                    data-testid="GroupInvitationPage-Button-signInToJoin"
                  >
                    Sign In to Join {invitation.groupName}
                  </Button>
                </div>
              )}
            </div>
          )}

          {isAuthenticated && !currentFamily && (
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription data-testid="GroupInvitationPage-Alert-requiresFamily">
                  Groups are joined by families. You need to create or join a family first.
                </AlertDescription>
              </Alert>
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-sm text-blue-800 font-medium">Next Steps:</p>
                <p className="text-sm text-blue-700 mt-1">Create a family and you'll automatically become the admin, allowing you to accept this group invitation.</p>
              </div>
              <Button 
                onClick={handleCreateFamily}
                className="w-full"
                data-testid="GroupInvitationPage-Button-createFamily"
              >
                Create Your Family First
              </Button>
            </div>
          )}

          {isAuthenticated && currentFamily && user?.id && currentFamily.members?.some((member: any) => member.userId === user.id && member.role === 'ADMIN') && !acceptResult && (
            <div className="space-y-4">
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription data-testid="GroupInvitationPage-Heading-acceptForFamily">
                  As a family admin, you can accept this invitation for your entire family.
                </AlertDescription>
              </Alert>
              
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">Family: <strong>{currentFamily.name}</strong></p>
                <p className="text-sm text-gray-600 mb-2">All family members will join the group:</p>
                {currentFamily.members && (
                  <div className="space-y-1" data-testid="GroupInvitationPage-List-familyMembers">
                    {currentFamily.members.map((member: any, index: number) => (
                      <div 
                        key={member.id || index}
                        className="text-sm text-gray-700"
                        data-testid={`GroupInvitationPage-ListItem-${member.id || `member-${index}`}`}
                      >
                        • {member.user?.name || member.name || `Member ${index + 1}`} {member.user?.id === user?.id ? '(you)' : ''}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <Button 
                onClick={handleAcceptForFamily}
                disabled={isAccepting}
                className="w-full"
                data-testid="GroupInvitationPage-Button-acceptForFamily"
              >
                {isAccepting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Accepting for family...
                  </>
                ) : (
                  `Accept for ${currentFamily.name}`
                )}
              </Button>
            </div>
          )}

          {isAuthenticated && currentFamily && user?.id && !currentFamily.members?.some((member: any) => member.userId === user.id && member.role === 'ADMIN') && (
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription data-testid="GroupInvitationPage-Alert-requiresAdmin">
                  Only your family admin can accept group invitations. You are a member of <strong>{currentFamily.name}</strong>.
                </AlertDescription>
              </Alert>
              
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">Your family administrators:</p>
                {currentFamily.members && (
                  <div className="space-y-1">
                    {currentFamily.members
                      .filter((member: any) => member.role === 'ADMIN')
                      .map((admin: any, index: number) => (
                        <div key={admin.id || index} className="text-sm font-medium" data-testid="GroupInvitationPage-Text-adminContact">
                          • {admin.user?.name || admin.name || `Admin ${index + 1}`}
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>
              
              <div className="space-y-2">
                <Button 
                  onClick={handleShareWithAdmin}
                  variant="outline"
                  className="w-full"
                  data-testid="GroupInvitationPage-Button-shareWithAdmin"
                >
                  Share Invitation with Admin
                </Button>
                
                <Button 
                  variant="outline"
                  className="w-full"
                  data-testid="GroupInvitationPage-Button-requestAdminRole"
                >
                  Request Admin Role
                </Button>
              </div>
            </div>
          )}

          {acceptResult?.alreadyMember && (
            <div className="space-y-4">
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription data-testid="GroupInvitationPage-Alert-alreadyMember">
                  Your family is already a member of this group
                </AlertDescription>
              </Alert>
              <Button 
                onClick={handleGoToGroup}
                className="w-full"
                data-testid="GroupInvitationPage-Button-goToGroup"
              >
                Go to Group
              </Button>
            </div>
          )}

          {acceptResult?.alreadyAccepted && (
            <div className="space-y-4">
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription data-testid="GroupInvitationPage-Alert-alreadyAccepted">
                  {acceptResult.acceptedBy} already accepted this invitation for your family
                </AlertDescription>
              </Alert>
              <Button 
                onClick={handleGoToGroup}
                className="w-full"
                data-testid="GroupInvitationPage-Button-goToGroup"
              >
                Go to Group
              </Button>
            </div>
          )}

          {messageSent && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription data-testid="GroupInvitationPage-Alert-messageSent">
                Message sent to Family Admin
              </AlertDescription>
            </Alert>
          )}

          {showShareDialog && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" data-testid="ShareDialog-Modal-container">
              <Card className="w-full max-w-md">
                <CardHeader>
                  <CardTitle className="text-green-600">Share with Admin</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="message">Message</Label>
                    <textarea
                      id="message"
                      className="w-full p-3 border rounded-lg"
                      data-testid="ShareDialog-Input-message"
                      placeholder="Message to admin..."
                      value={shareMessage}
                      onChange={(e) => setShareMessage(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-600">Invitation link:</p>
                    <p className="text-sm font-mono" data-testid="ShareDialog-Text-invitationLink">
                      /groups/join?code={inviteCode}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Button 
                      onClick={handleSendMessage}
                      className="w-full"
                      data-testid="ShareDialog-Button-send"
                    >
                      Send
                    </Button>
                    <Button 
                      onClick={() => setShowShareDialog(false)}
                      variant="outline"
                      className="w-full"
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