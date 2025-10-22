/**
 * FAMILY INVITATION PROPOSAL MODAL
 * 
 * Shown after successful authentication when a user has a pending family invitation.
 * Gives the user a choice to either join the invited family or create their own.
 * 
 * Features:
 * - Clear proposal with family name and inviter info
 * - Two distinct action options
 * - Accessible modal design
 * - Loading states for actions
 */

import React, { useState } from 'react';
import { Users, UserPlus, PlusCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';

interface FamilyInvitationProposalProps {
  isOpen: boolean;
  familyName: string;
  inviterName?: string;
  onAccept: () => Promise<void>;
  onDecline: () => void;
  error?: string;
}

export const FamilyInvitationProposal: React.FC<FamilyInvitationProposalProps> = ({
  isOpen,
  familyName,
  inviterName,
  onAccept,
  onDecline,
  error
}) => {
  const [isJoining, setIsJoining] = useState(false);

  const handleAccept = async () => {
    setIsJoining(true);
    try {
      await onAccept();
    } catch (err) {
      // Error will be handled by parent component
      console.error('Failed to join family:', err);
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => !isJoining && onDecline()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center pb-4">
          <div className="flex justify-center mb-4">
            <div className="bg-blue-100 rounded-full p-3">
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          <DialogTitle className="text-xl">You're Invited!</DialogTitle>
          <DialogDescription>
            {inviterName ? (
              <>
                <strong>{inviterName}</strong> has invited you to join the family{' '}
                <strong>{familyName}</strong>
              </>
            ) : (
              <>
                You've been invited to join the family{' '}
                <strong>{familyName}</strong>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-3">
            <Button
              onClick={handleAccept}
              disabled={isJoining}
              className="w-full h-12 text-base"
              size="lg"
            >
              <UserPlus className="mr-2 h-5 w-5" />
              {isJoining ? 'Joining...' : `Join ${familyName}`}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or
                </span>
              </div>
            </div>

            <Button
              onClick={onDecline}
              disabled={isJoining}
              variant="outline"
              className="w-full h-12 text-base"
              size="lg"
            >
              <PlusCircle className="mr-2 h-5 w-5" />
              Create My Own Family
            </Button>
          </div>

          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              You can change your mind later and join or leave families at any time.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};