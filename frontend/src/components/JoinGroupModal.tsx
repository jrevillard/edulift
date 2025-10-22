import React, { useState } from 'react';
import { Alert, AlertDescription } from './ui/alert';
import { AlertCircle } from 'lucide-react';

interface JoinGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (inviteCode: string) => Promise<void>;
}

const JoinGroupModal: React.FC<JoinGroupModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [inviteCode, setInviteCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;

    setIsLoading(true);
    setError('');

    try {
      await onSubmit(inviteCode.trim().toUpperCase());
      setInviteCode('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join group');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4" data-testid="join-group-modal-title">Join Group</h3>
          
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="inviteCode" className="block text-sm font-medium text-gray-700 mb-1">
                Invite Code
              </label>
              <input
                type="text"
                id="inviteCode"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-mono"
                placeholder="Enter invite code"
                disabled={isLoading}
                required
                data-testid="invite-code-input"
              />
              <p className="mt-1 text-xs text-gray-500">
                Enter the invite code provided by the group admin
              </p>
            </div>

            {error && (
              <div className="mb-4">
                <Alert variant="destructive" data-testid="join-group-error">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {error}
                  </AlertDescription>
                </Alert>
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                disabled={isLoading || !inviteCode.trim()}
                data-testid="join-group-submit"
              >
                {isLoading ? 'Joining...' : 'Join Group'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default JoinGroupModal;