import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, User, Edit, Save, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { authService } from '../services/authService';
import type { User as UserType } from '../services/authService';
import { TimezoneSelector } from '../components/TimezoneSelector';

const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editedUser, setEditedUser] = useState<UserType | null>(user);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setEditedUser(user);
    }
  }, [user]);

  const handleSave = async () => {
    if (!editedUser) return;

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    // Validate email format before submission
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const trimmedEmail = editedUser.email.trim();
    
    if (!emailRegex.test(trimmedEmail)) {
      setError('Please enter a valid email address');
      setIsLoading(false);
      return;
    }

    // Validate name is not empty
    const trimmedName = editedUser.name.trim();
    if (trimmedName.length === 0) {
      setError('Name cannot be empty');
      setIsLoading(false);
      return;
    }

    try {
      // Update user profile with trimmed values
      await authService.updateProfile({
        name: trimmedName,
        email: trimmedEmail,
      });

      // Update the user state immediately
      updateUser();
      setSuccess('Profile updated successfully');
      setIsEditing(false);
    } catch (err: any) {
      // Handle specific error messages from backend
      if (err.response?.data?.validationErrors) {
        // Prioritize validation errors as they are more specific
        const validationError = err.response.data.validationErrors
          .map((ve: any) => ve.message)
          .join(', ');
        setError(validationError);
      } else if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else {
        setError(err.message || 'Failed to update profile');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setEditedUser(user);
    setIsEditing(false);
    setError(null);
    setSuccess(null);
  };

  const handleInputChange = (field: keyof UserType, value: string) => {
    if (editedUser) {
      setEditedUser({
        ...editedUser,
        [field]: value,
      });
      
      // Clear error message when user starts typing
      if (error) {
        setError(null);
      }
    }
  };

  if (!user) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex items-center justify-center h-96">
          <Alert className="w-full max-w-md" data-testid="ProfilePage-Alert-noUser">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Please log in to view your profile.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2"
            data-testid="ProfilePage-Button-backToDashboard"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
          <h1 className="text-2xl font-bold" data-testid="ProfilePage-Heading-title">Profile Settings</h1>
        </div>
      </div>

      {/* Alert Messages */}
      {error && (
        <Alert className="mb-4" variant="destructive" data-testid="ProfilePage-Alert-error">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-4" variant="default" data-testid="ProfilePage-Alert-success">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Profile Information Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Personal Information
          </CardTitle>
          <CardDescription>
            Manage your account details and preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Name Field */}
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            {isEditing ? (
              <Input
                id="name"
                type="text"
                value={editedUser?.name || ''}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Enter your full name"
                disabled={isLoading}
                data-testid="ProfilePage-Input-name"
              />
            ) : (
              <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded border" data-testid="ProfilePage-Text-name">
                {user.name || 'No name provided'}
              </div>
            )}
          </div>

          {/* Email Field */}
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            {isEditing ? (
              <>
                <Input
                  id="email"
                  type="email"
                  value={editedUser?.email || ''}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="Enter your email address"
                  disabled={isLoading}
                  data-testid="ProfilePage-Input-email"
                />
                <p className="text-sm text-gray-500">
                  Please enter a valid email address. Changing your email requires validation.
                </p>
              </>
            ) : (
              <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded border" data-testid="ProfilePage-Text-email">
                {user.email}
              </div>
            )}
          </div>

          {/* User ID (Read-only) */}
          <div className="space-y-2">
            <Label htmlFor="userId">User ID</Label>
            <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded border text-sm font-mono" data-testid="ProfilePage-Text-userId">
              {user.id}
            </div>
          </div>

          {/* Timezone Preference */}
          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <TimezoneSelector
              currentTimezone={user.timezone}
              onTimezoneChange={() => {
                // Timezone is updated via authService, no additional action needed
                // The updateUser() call in TimezoneSelector will refresh the user state
              }}
            />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              All times in the app will display in your selected timezone
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            {isEditing ? (
              <>
                <Button
                  onClick={handleSave}
                  disabled={isLoading}
                  className="flex items-center gap-2"
                  data-testid="ProfilePage-Button-save"
                >
                  <Save className="h-4 w-4" />
                  {isLoading ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isLoading}
                  className="flex items-center gap-2"
                  data-testid="ProfilePage-Button-cancel"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2"
                data-testid="ProfilePage-Button-edit"
              >
                <Edit className="h-4 w-4" />
                Edit Profile
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

    </div>
  );
};

export default ProfilePage;