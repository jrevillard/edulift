import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
// import { Textarea } from '@/components/ui/textarea'; // Not available
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Loader2, 
  Search, 
  Users, 
  Mail, 
  AlertCircle,
  Check
} from 'lucide-react';
import { groupApiService } from '../services/groupApiService';
import type { FamilySearchResult } from '@/types/api';

interface FamilySearchInvitationProps {
  groupId: string;
  onInvitationSent: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export function FamilySearchInvitation({ 
  groupId, 
  onInvitationSent, 
  isOpen, 
  onClose 
}: FamilySearchInvitationProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<FamilySearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isInviting, setIsInviting] = useState<string | null>(null); // family id being invited
  const [personalMessage, setPersonalMessage] = useState('');
  const [role, setRole] = useState<'MEMBER' | 'ADMIN'>('MEMBER');

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;

    setIsSearching(true);
    setSearchError(null);
    
    try {
      const results = await groupApiService.searchFamiliesForInvitation(groupId, searchTerm.trim());
      setSearchResults(results);
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : 'Search failed');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleInviteFamily = async (familyId: string) => {
    setIsInviting(familyId);
    
    try {
      await groupApiService.inviteFamilyToGroup(
        groupId, 
        familyId, 
        role,
        personalMessage.trim() || undefined
      );
      
      onInvitationSent();
      onClose();
      
      // Reset form
      setSearchTerm('');
      setSearchResults([]);
      setPersonalMessage('');
      setRole('MEMBER');
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : 'Failed to send invitation');
    } finally {
      setIsInviting(null);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2" data-testid="FamilySearchInvitation-Title-inviteFamilyModalTitle">
            <Users className="h-5 w-5" />
            <span>Invite Family to Group</span>
          </DialogTitle>
          <DialogDescription>
            Search for families to invite to this group. Only family administrators can accept group invitations.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Input */}
          <div className="space-y-2">
            <Label htmlFor="family-search">Search Families</Label>
            <div className="flex space-x-2">
              <Input
                id="family-search"
                placeholder="Search families by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isSearching}
                data-testid="FamilySearchInvitation-Input-familySearch"
              />
              <Button 
                onClick={handleSearch} 
                disabled={isSearching || !searchTerm.trim()}
                size="default"
                data-testid="FamilySearchInvitation-Button-searchFamilies"
              >
                {isSearching ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    <span data-testid="FamilySearchInvitation-Text-searching">Searching...</span>
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    <span data-testid="FamilySearchInvitation-Text-search">Search</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Role Selection */}
          <div className="space-y-2">
            <Label htmlFor="role-select">Family Role in Group</Label>
            <Select value={role} onValueChange={(value: 'MEMBER' | 'ADMIN') => setRole(value)}>
              <SelectTrigger id="role-select" data-testid="FamilySearchInvitation-Select-role">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MEMBER">Member - Can participate in group activities</SelectItem>
                <SelectItem value="ADMIN">Admin - Can manage group and invite other families</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Personal Message */}
          <div className="space-y-2">
            <Label htmlFor="personal-message">Personal Message (Optional)</Label>
            <Input
              id="personal-message"
              placeholder="Add a personal message to your invitation..."
              value={personalMessage}
              onChange={(e) => setPersonalMessage(e.target.value)}
            />
          </div>

          {/* Error Message */}
          {searchError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription data-testid="FamilySearchInvitation-AlertDescription-searchError">{searchError}</AlertDescription>
            </Alert>
          )}

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-medium text-sm text-gray-700">Search Results</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {searchResults.map((family) => (
                  <Card key={family.id} className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h4 className="font-medium" data-testid={`family-name-${family.id}`}>{family.name}</h4>
                          <Badge variant="outline" data-testid={`family-member-count-${family.id}`}>
                            {family.memberCount} members
                          </Badge>
                        </div>
                        
                        {family.adminContacts.length > 0 && (
                          <div className="mt-1 text-sm text-gray-600">
                            <div className="flex items-center space-x-1">
                              <Mail className="h-3 w-3" />
                              <span>Admin: {family.adminContacts[0].name}</span>
                              <span className="text-gray-400" data-testid={`family-admin-email-${family.id}`}>({family.adminContacts[0].email})</span>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <Button
                        onClick={() => handleInviteFamily(family.id)}
                        disabled={!family.canInvite || isInviting === family.id}
                        size="sm"
                        data-testid={`invite-family-button-${family.id}`}
                      >
                        {isInviting === family.id ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Inviting...
                          </>
                        ) : (
                          <>
                            <Check className="h-4 w-4 mr-2" />
                            Invite Family
                          </>
                        )}
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* No Results */}
          {!isSearching && searchResults.length === 0 && searchTerm && !searchError && (
            <div className="text-center py-6 text-gray-500">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p data-testid="FamilySearchInvitation-Text-noFamiliesFound">No families found matching "{searchTerm}"</p>
              <p className="text-sm">Try a different search term.</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}