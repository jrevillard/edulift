import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import ProfilePage from '../ProfilePage';
import { useAuth } from '../../contexts/AuthContext';
import { authService } from '../../services/authService';
import type { ApiError } from '../../types/errors';

// Mock the AuthContext
vi.mock('../../contexts/AuthContext');
const mockUseAuth = useAuth as vi.MockedFunction<typeof useAuth>;

// Mock the auth service
vi.mock('../../services/authService', () => ({
  authService: {
    updateProfile: vi.fn()
  }
}));

// Mock react-router-dom useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

const renderProfilePage = () => {
  return render(
    <MemoryRouter>
      <ProfilePage />
    </MemoryRouter>
  );
};

describe('ProfilePage', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    timezone: 'UTC',
  };

  const mockRefreshToken = vi.fn();
  const mockUpdateUser = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: mockUser,
      logout: vi.fn(),
      isAuthenticated: true,
      isLoading: false,
      family: null,
      login: vi.fn(),
      verifyMagicLink: vi.fn(),
      refreshToken: mockRefreshToken,
      updateUser: mockUpdateUser
    });
  });

  describe('Rendering', () => {
    it('should render profile page with user information', () => {
      renderProfilePage();

      expect(screen.getByTestId('ProfilePage-Heading-title')).toHaveTextContent('Profile Settings');
      expect(screen.getByTestId('ProfilePage-Text-name')).toHaveTextContent('Test User');
      expect(screen.getByTestId('ProfilePage-Text-email')).toHaveTextContent('test@example.com');
      expect(screen.getByTestId('ProfilePage-Text-userId')).toHaveTextContent('user-123');
    });

    it('should render buttons in view mode', () => {
      renderProfilePage();

      expect(screen.getByTestId('ProfilePage-Button-edit')).toBeInTheDocument();
      expect(screen.getByTestId('ProfilePage-Button-backToDashboard')).toBeInTheDocument();
    });

    it('should display user information in read-only mode by default', () => {
      renderProfilePage();

      expect(screen.getByTestId('ProfilePage-Text-name')).toBeInTheDocument();
      expect(screen.getByTestId('ProfilePage-Text-email')).toBeInTheDocument();
      expect(screen.getByTestId('ProfilePage-Text-userId')).toBeInTheDocument();
      
      // Edit mode elements should not be present
      expect(screen.queryByTestId('ProfilePage-Input-name')).not.toBeInTheDocument();
      expect(screen.queryByTestId('ProfilePage-Input-email')).not.toBeInTheDocument();
    });
  });

  describe('Edit Mode Toggle', () => {
    it('should enter edit mode when Edit button is clicked', async () => {
      const user = userEvent.setup();
      renderProfilePage();

      const editButton = screen.getByTestId('ProfilePage-Button-edit');
      await user.click(editButton);

      // Should show save and cancel buttons
      expect(screen.getByTestId('ProfilePage-Button-save')).toBeInTheDocument();
      expect(screen.getByTestId('ProfilePage-Button-cancel')).toBeInTheDocument();
      
      // Should not show edit button
      expect(screen.queryByTestId('ProfilePage-Button-edit')).not.toBeInTheDocument();
      
      // Should show input fields
      expect(screen.getByTestId('ProfilePage-Input-name')).toBeInTheDocument();
      expect(screen.getByTestId('ProfilePage-Input-email')).toBeInTheDocument();
    });

    it('should show input fields with correct values in edit mode', async () => {
      const user = userEvent.setup();
      renderProfilePage();

      const editButton = screen.getByTestId('ProfilePage-Button-edit');
      await user.click(editButton);

      const nameInput = screen.getByTestId('ProfilePage-Input-name');
      const emailInput = screen.getByTestId('ProfilePage-Input-email');

      expect(nameInput).toHaveValue('Test User');
      expect(emailInput).toHaveValue('test@example.com');
      expect(nameInput).not.toBeDisabled();
      expect(emailInput).not.toBeDisabled();
    });

    it('should exit edit mode when Cancel button is clicked', async () => {
      const user = userEvent.setup();
      renderProfilePage();

      // Enter edit mode
      const editButton = screen.getByTestId('ProfilePage-Button-edit');
      await user.click(editButton);

      // Modify a field
      const nameInput = screen.getByTestId('ProfilePage-Input-name');
      await user.clear(nameInput);
      await user.type(nameInput, 'Modified Name');

      // Cancel
      const cancelButton = screen.getByTestId('ProfilePage-Button-cancel');
      await user.click(cancelButton);

      // Should be back in view mode
      expect(screen.getByTestId('ProfilePage-Button-edit')).toBeInTheDocument();
      expect(screen.queryByTestId('ProfilePage-Button-save')).not.toBeInTheDocument();
      
      // Should reset form data - back to displaying original values
      expect(screen.getByTestId('ProfilePage-Text-name')).toHaveTextContent('Test User');
    });
  });

  describe('Profile Update', () => {
    it('should call authService.updateProfile with correct data', async () => {
      const user = userEvent.setup();
      vi.mocked(authService.updateProfile).mockResolvedValue({
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User'
      });
      renderProfilePage();

      // Enter edit mode
      const editButton = screen.getByTestId('ProfilePage-Button-edit');
      await user.click(editButton);

      // Modify fields
      const nameInput = screen.getByTestId('ProfilePage-Input-name');
      const emailInput = screen.getByTestId('ProfilePage-Input-email');
      
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated Name');
      await user.clear(emailInput);
      await user.type(emailInput, 'updated@example.com');

      // Save
      const saveButton = screen.getByTestId('ProfilePage-Button-save');
      await user.click(saveButton);

      await waitFor(() => {
        expect(authService.updateProfile).toHaveBeenCalledWith({
          name: 'Updated Name',
          email: 'updated@example.com'
        });
      });
    });

    it('should exit edit mode after successful update', async () => {
      const user = userEvent.setup();
      vi.mocked(authService.updateProfile).mockResolvedValue({
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User'
      });
      renderProfilePage();

      // Enter edit mode and save
      const editButton = screen.getByTestId('ProfilePage-Button-edit');
      await user.click(editButton);

      const saveButton = screen.getByTestId('ProfilePage-Button-save');
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByTestId('ProfilePage-Button-edit')).toBeInTheDocument();
        expect(screen.queryByTestId('ProfilePage-Button-save')).not.toBeInTheDocument();
      });
    });

    it('should show success message after update', async () => {
      const user = userEvent.setup();
      vi.mocked(authService.updateProfile).mockResolvedValue({
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User'
      });
      renderProfilePage();

      // Enter edit mode and save
      const editButton = screen.getByTestId('ProfilePage-Button-edit');
      await user.click(editButton);

      const saveButton = screen.getByTestId('ProfilePage-Button-save');
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByTestId('ProfilePage-Alert-success')).toBeInTheDocument();
        expect(screen.getByTestId('ProfilePage-Alert-success')).toHaveTextContent(/profile updated successfully/i);
      });
    });

    it('should call updateUser after successful update', async () => {
      const user = userEvent.setup();
      vi.mocked(authService.updateProfile).mockResolvedValue({
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User'
      });
      renderProfilePage();

      // Enter edit mode and save
      const editButton = screen.getByTestId('ProfilePage-Button-edit');
      await user.click(editButton);

      const saveButton = screen.getByTestId('ProfilePage-Button-save');
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockUpdateUser).toHaveBeenCalledTimes(1);
      });
    });

    it('should show loading state during update', async () => {
      const user = userEvent.setup();
      let resolveUpdate: () => void;
      const updatePromise = new Promise((resolve) => {
        resolveUpdate = () => resolve({});
      });
      vi.mocked(authService.updateProfile).mockReturnValue(updatePromise);
      
      renderProfilePage();

      // Enter edit mode
      const editButton = screen.getByTestId('ProfilePage-Button-edit');
      await user.click(editButton);

      // Click save
      const saveButton = screen.getByTestId('ProfilePage-Button-save');
      await user.click(saveButton);

      // Should show loading state
      expect(screen.getByTestId('ProfilePage-Button-save')).toHaveTextContent('Saving...');
      expect(screen.getByTestId('ProfilePage-Button-save')).toBeDisabled();

      // Resolve the promise
      resolveUpdate!();
      
      await waitFor(() => {
        expect(screen.getByTestId('ProfilePage-Button-edit')).toBeInTheDocument();
      });
    });
  });

  describe('Email Validation', () => {
    it('should validate email format before submission', async () => {
      const user = userEvent.setup();
      renderProfilePage();

      // Enter edit mode
      const editButton = screen.getByTestId('ProfilePage-Button-edit');
      await user.click(editButton);

      // Enter invalid email
      const emailInput = screen.getByTestId('ProfilePage-Input-email');
      await user.clear(emailInput);
      await user.type(emailInput, 'invalid-email');

      // Try to save
      const saveButton = screen.getByTestId('ProfilePage-Button-save');
      await user.click(saveButton);

      // Should show error immediately without calling API
      await waitFor(() => {
        expect(screen.getByTestId('ProfilePage-Alert-error')).toBeInTheDocument();
        expect(screen.getByTestId('ProfilePage-Alert-error')).toHaveTextContent(/please enter a valid email address/i);
        expect(authService.updateProfile).not.toHaveBeenCalled();
      });
    });

    it('should validate empty name before submission', async () => {
      const user = userEvent.setup();
      renderProfilePage();

      // Enter edit mode
      const editButton = screen.getByTestId('ProfilePage-Button-edit');
      await user.click(editButton);

      // Clear name field
      const nameInput = screen.getByTestId('ProfilePage-Input-name');
      await user.clear(nameInput);

      // Try to save
      const saveButton = screen.getByTestId('ProfilePage-Button-save');
      await user.click(saveButton);

      // Should show error immediately without calling API
      await waitFor(() => {
        expect(screen.getByTestId('ProfilePage-Alert-error')).toBeInTheDocument();
        expect(screen.getByTestId('ProfilePage-Alert-error')).toHaveTextContent(/name cannot be empty/i);
        expect(authService.updateProfile).not.toHaveBeenCalled();
      });
    });

    it('should trim whitespace from email and name', async () => {
      const user = userEvent.setup();
      vi.mocked(authService.updateProfile).mockResolvedValue({
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User'
      });
      renderProfilePage();

      // Enter edit mode
      const editButton = screen.getByTestId('ProfilePage-Button-edit');
      await user.click(editButton);

      // Enter values with whitespace
      const nameInput = screen.getByTestId('ProfilePage-Input-name');
      const emailInput = screen.getByTestId('ProfilePage-Input-email');
      
      await user.clear(nameInput);
      await user.type(nameInput, '  Trimmed Name  ');
      await user.clear(emailInput);
      await user.type(emailInput, '  trimmed@example.com  ');

      // Save
      const saveButton = screen.getByTestId('ProfilePage-Button-save');
      await user.click(saveButton);

      await waitFor(() => {
        expect(authService.updateProfile).toHaveBeenCalledWith({
          name: 'Trimmed Name',
          email: 'trimmed@example.com'
        });
      });
    });

    it('should clear error when user starts typing', async () => {
      const user = userEvent.setup();
      renderProfilePage();

      // Enter edit mode
      const editButton = screen.getByTestId('ProfilePage-Button-edit');
      await user.click(editButton);

      // Enter invalid email to trigger error
      const emailInput = screen.getByTestId('ProfilePage-Input-email');
      await user.clear(emailInput);
      await user.type(emailInput, 'invalid');

      // Try to save
      const saveButton = screen.getByTestId('ProfilePage-Button-save');
      await user.click(saveButton);

      // Should show error
      expect(screen.getByTestId('ProfilePage-Alert-error')).toBeInTheDocument();

      // Start typing to fix the error
      await user.type(emailInput, '@example.com');

      // Error should be cleared
      expect(screen.queryByTestId('ProfilePage-Alert-error')).not.toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should show error message when update fails', async () => {
      const user = userEvent.setup();
      vi.mocked(authService.updateProfile).mockRejectedValue(new Error('Server error'));
      renderProfilePage();

      // Enter edit mode
      const editButton = screen.getByTestId('ProfilePage-Button-edit');
      await user.click(editButton);

      // Try to save
      const saveButton = screen.getByTestId('ProfilePage-Button-save');
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByTestId('ProfilePage-Alert-error')).toBeInTheDocument();
        expect(screen.getByTestId('ProfilePage-Alert-error')).toHaveTextContent(/server error/i);
      });
    });

    it('should handle backend validation errors', async () => {
      const user = userEvent.setup();
      const axiosError: ApiError = new Error('Request failed') as ApiError;
      axiosError.response = {
        status: 400,
        data: {
          success: false,
          error: 'Invalid input data',
          validationErrors: [
            { field: 'email', message: 'Valid email required' }
          ]
        }
      };
      vi.mocked(authService.updateProfile).mockRejectedValue(axiosError);
      renderProfilePage();

      // Enter edit mode
      const editButton = screen.getByTestId('ProfilePage-Button-edit');
      await user.click(editButton);

      // Try to save with valid data (so it passes frontend validation)
      const saveButton = screen.getByTestId('ProfilePage-Button-save');
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByTestId('ProfilePage-Alert-error')).toBeInTheDocument();
      });
      
      // Since authService passes through the axios error, the ProfilePage should extract validationErrors
      const errorText = screen.getByTestId('ProfilePage-Alert-error').textContent;
      expect(errorText).toMatch(/valid email required/i);
    });

    it('should handle duplicate email error from backend', async () => {
      const user = userEvent.setup();
      const axiosError: ApiError = new Error('Request failed') as ApiError;
      axiosError.response = {
        status: 400,
        data: {
          success: false,
          error: 'Email is already in use by another account'
        }
      };
      vi.mocked(authService.updateProfile).mockRejectedValue(axiosError);
      renderProfilePage();

      // Enter edit mode
      const editButton = screen.getByTestId('ProfilePage-Button-edit');
      await user.click(editButton);

      // Change email
      const emailInput = screen.getByTestId('ProfilePage-Input-email');
      await user.clear(emailInput);
      await user.type(emailInput, 'existing@example.com');

      // Try to save
      const saveButton = screen.getByTestId('ProfilePage-Button-save');
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByTestId('ProfilePage-Alert-error')).toBeInTheDocument();
        expect(screen.getByTestId('ProfilePage-Alert-error')).toHaveTextContent(/email is already in use by another account/i);
      });
    });

    it('should show frontend validation for invalid email', async () => {
      const user = userEvent.setup();
      renderProfilePage();

      // Enter edit mode
      const editButton = screen.getByTestId('ProfilePage-Button-edit');
      await user.click(editButton);

      // Enter invalid email
      const emailInput = screen.getByTestId('ProfilePage-Input-email');
      await user.clear(emailInput);
      await user.type(emailInput, 'invalid-email');

      // Try to save
      const saveButton = screen.getByTestId('ProfilePage-Button-save');
      await user.click(saveButton);

      // Should show frontend validation error, not call API
      await waitFor(() => {
        expect(screen.getByTestId('ProfilePage-Alert-error')).toHaveTextContent(/please enter a valid email address/i);
        expect(authService.updateProfile).not.toHaveBeenCalled();
      });
    });

    it('should stay in edit mode when update fails', async () => {
      const user = userEvent.setup();
      vi.mocked(authService.updateProfile).mockRejectedValue(new Error('Update failed'));
      renderProfilePage();

      // Enter edit mode
      const editButton = screen.getByTestId('ProfilePage-Button-edit');
      await user.click(editButton);

      // Try to save
      const saveButton = screen.getByTestId('ProfilePage-Button-save');
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByTestId('ProfilePage-Alert-error')).toBeInTheDocument();
      });

      // Should stay in edit mode
      expect(screen.getByTestId('ProfilePage-Button-save')).toBeInTheDocument();
      expect(screen.queryByTestId('ProfilePage-Button-edit')).not.toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('should navigate to dashboard when Back button is clicked', async () => {
      const user = userEvent.setup();
      renderProfilePage();

      const backButton = screen.getByTestId('ProfilePage-Button-backToDashboard');
      await user.click(backButton);

      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });

    it('should navigate even when in edit mode', async () => {
      const user = userEvent.setup();
      renderProfilePage();

      // Enter edit mode
      const editButton = screen.getByTestId('ProfilePage-Button-edit');
      await user.click(editButton);

      // Modify a field
      const nameInput = screen.getByTestId('ProfilePage-Input-name');
      await user.clear(nameInput);
      await user.type(nameInput, 'Modified Name');

      // Navigate back
      const backButton = screen.getByTestId('ProfilePage-Button-backToDashboard');
      await user.click(backButton);

      // Should navigate (ProfilePage doesn't prevent navigation)
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  describe('No User State', () => {
    it('should show login message when no user is logged in', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        logout: vi.fn(),
        isAuthenticated: false,
        isLoading: false,
        family: null,
        login: vi.fn(),
        verifyMagicLink: vi.fn(),
        refreshToken: vi.fn(),
        updateUser: vi.fn()
      });

      renderProfilePage();

      expect(screen.getByTestId('ProfilePage-Alert-noUser')).toBeInTheDocument();
      expect(screen.getByTestId('ProfilePage-Alert-noUser')).toHaveTextContent(/please log in to view your profile/i);
    });

    it('should not show profile content when no user is logged in', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        logout: vi.fn(),
        isAuthenticated: false,
        isLoading: false,
        family: null,
        login: vi.fn(),
        verifyMagicLink: vi.fn(),
        refreshToken: vi.fn(),
        updateUser: vi.fn()
      });

      renderProfilePage();

      expect(screen.queryByTestId('ProfilePage-Heading-title')).not.toBeInTheDocument();
      expect(screen.queryByTestId('ProfilePage-Button-edit')).not.toBeInTheDocument();
    });
  });

  describe('Form State Management', () => {
    it('should preserve form data during edit session', async () => {
      const user = userEvent.setup();
      renderProfilePage();

      // Enter edit mode
      const editButton = screen.getByTestId('ProfilePage-Button-edit');
      await user.click(editButton);

      // Modify fields
      const nameInput = screen.getByTestId('ProfilePage-Input-name');
      await user.clear(nameInput);
      await user.type(nameInput, 'Temporary Name');

      // Field should keep the value
      expect(nameInput).toHaveValue('Temporary Name');
    });

    it('should reset form when switching between edit modes', async () => {
      const user = userEvent.setup();
      renderProfilePage();

      // Enter edit mode
      const editButton = screen.getByTestId('ProfilePage-Button-edit');
      await user.click(editButton);

      // Modify field
      const nameInput = screen.getByTestId('ProfilePage-Input-name');
      await user.clear(nameInput);
      await user.type(nameInput, 'Modified Name');

      // Cancel
      const cancelButton = screen.getByTestId('ProfilePage-Button-cancel');
      await user.click(cancelButton);

      // Enter edit mode again
      await user.click(screen.getByTestId('ProfilePage-Button-edit'));

      // Should show original data
      expect(screen.getByTestId('ProfilePage-Input-name')).toHaveValue('Test User');
    });
  });

  describe('Alert Messages', () => {
    it('should clear error messages when entering edit mode', async () => {
      const user = userEvent.setup();
      vi.mocked(authService.updateProfile).mockRejectedValue(new Error('Test error'));
      renderProfilePage();

      // Enter edit mode and cause an error
      let editButton = screen.getByTestId('ProfilePage-Button-edit');
      await user.click(editButton);

      const saveButton = screen.getByTestId('ProfilePage-Button-save');
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByTestId('ProfilePage-Alert-error')).toBeInTheDocument();
      });

      // Cancel and re-enter edit mode
      const cancelButton = screen.getByTestId('ProfilePage-Button-cancel');
      await user.click(cancelButton);

      editButton = screen.getByTestId('ProfilePage-Button-edit');
      await user.click(editButton);

      // Error should be cleared
      expect(screen.queryByTestId('ProfilePage-Alert-error')).not.toBeInTheDocument();
    });

    it('should keep success message when entering edit mode again', async () => {
      const user = userEvent.setup();
      vi.mocked(authService.updateProfile).mockResolvedValue({
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User'
      });
      renderProfilePage();

      // Save successfully
      let editButton = screen.getByTestId('ProfilePage-Button-edit');
      await user.click(editButton);

      const saveButton = screen.getByTestId('ProfilePage-Button-save');
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByTestId('ProfilePage-Alert-success')).toBeInTheDocument();
      });

      // Enter edit mode again
      editButton = screen.getByTestId('ProfilePage-Button-edit');
      await user.click(editButton);

      // Success message should still be there (ProfilePage doesn't clear it automatically)
      expect(screen.getByTestId('ProfilePage-Alert-success')).toBeInTheDocument();
    });
  });
});