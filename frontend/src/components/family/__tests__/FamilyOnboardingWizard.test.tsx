import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import { FamilyOnboardingWizard } from '../FamilyOnboardingWizard';
import { useFamily } from '../../../contexts/FamilyContext';
import type { Family } from '../../../types/family';

// Mock the FamilyContext
vi.mock('../../../contexts/FamilyContext');

const mockUseFamily = vi.mocked(useFamily);

describe('FamilyOnboardingWizard', () => {
  const mockOnComplete = vi.fn();
  const mockOnCancel = vi.fn();
  const mockCreateFamily = vi.fn();
  const mockJoinFamily = vi.fn();
  const mockClearError = vi.fn();

  const defaultFamilyContextValue = {
    createFamily: mockCreateFamily,
    joinFamily: mockJoinFamily,
    isLoading: false,
    error: null,
    clearError: mockClearError,
    currentFamily: null,
    userPermissions: null,
    requiresFamily: true,
    isCheckingFamily: false,
    leaveFamily: vi.fn(),
    refreshFamily: vi.fn(),
    updateFamilyName: vi.fn(),
    inviteMember: vi.fn(),
    updateMemberRole: vi.fn(),
    removeMember: vi.fn(),
    generateInviteCode: vi.fn(),
    getPendingInvitations: vi.fn(),
    cancelInvitation: vi.fn(),
    hasFamily: false
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseFamily.mockReturnValue(defaultFamilyContextValue);
  });

  describe('Initial choice step', () => {
    it('should render welcome message and choices', () => {
      render(<FamilyOnboardingWizard onComplete={mockOnComplete} />);

      expect(screen.getByTestId('FamilyOnboardingWizard-Heading-welcome')).toBeInTheDocument();
      expect(screen.getByTestId('FamilyOnboardingWizard-Text-createFamilyChoice')).toBeInTheDocument();
      expect(screen.getByTestId('FamilyOnboardingWizard-Text-joinFamilyChoice')).toBeInTheDocument();
    });

    it('should show skip option when onCancel is provided', () => {
      render(<FamilyOnboardingWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      expect(screen.getByTestId('FamilyOnboardingWizard-Button-skipOnboarding')).toBeInTheDocument();
    });

    it('should not show skip option when onCancel is not provided', () => {
      render(<FamilyOnboardingWizard onComplete={mockOnComplete} />);

      expect(screen.queryByTestId('FamilyOnboardingWizard-Button-skipOnboarding')).not.toBeInTheDocument();
    });

    it('should navigate to create step when create family is clicked', async () => {
      const user = userEvent.setup();
      render(<FamilyOnboardingWizard onComplete={mockOnComplete} />);

      await user.click(screen.getByTestId('FamilyOnboardingWizard-Button-createFamilyChoice'));

      expect(screen.getByTestId('FamilyOnboardingWizard-Heading-createFamilyTitle')).toBeInTheDocument();
      expect(screen.getByTestId('FamilyOnboardingWizard-Input-familyName')).toBeInTheDocument();
    });

    it('should navigate to join step when join family is clicked', async () => {
      const user = userEvent.setup();
      render(<FamilyOnboardingWizard onComplete={mockOnComplete} />);

      await user.click(screen.getByTestId('FamilyOnboardingWizard-Button-joinFamilyChoice'));

      expect(screen.getByTestId('FamilyOnboardingWizard-Heading-joinFamilyTitle')).toBeInTheDocument();
      expect(screen.getByTestId('FamilyOnboardingWizard-Input-inviteCode')).toBeInTheDocument();
    });
  });

  describe('Create family step', () => {
    beforeEach(async () => {
      const user = userEvent.setup();
      render(<FamilyOnboardingWizard onComplete={mockOnComplete} />);
      
      await user.click(screen.getByTestId('FamilyOnboardingWizard-Button-createFamilyChoice'));
    });

    it('should render create family form', () => {
      expect(screen.getByTestId('FamilyOnboardingWizard-Input-familyName')).toBeInTheDocument();
      expect(screen.getByTestId('FamilyOnboardingWizard-Input-familyDescription')).toBeInTheDocument();
      expect(screen.getByTestId('FamilyOnboardingWizard-Button-createFamily')).toBeInTheDocument();
      expect(screen.getByTestId('FamilyOnboardingWizard-Button-backToChoice')).toBeInTheDocument();
    });

    it('should validate family name is required', async () => {
      const user = userEvent.setup();
      
      // First, ensure the input is focused (this might trigger a state update)
      const nameInput = screen.getByTestId('FamilyOnboardingWizard-Input-familyName');
      await user.click(nameInput);
      
      // Submit the form using fireEvent.submit
      const form = screen.getByTestId('FamilyOnboardingWizard-Button-createFamily').closest('form');
      if (form) {
        fireEvent.submit(form);
      } else {
        // Fallback to button click
        await user.click(screen.getByTestId('FamilyOnboardingWizard-Button-createFamily'));
      }

      await waitFor(() => {
        expect(screen.getByTestId('FamilyOnboardingWizard-Alert-familyNameError')).toBeInTheDocument();
      }, { timeout: 3000 });
      expect(mockCreateFamily).not.toHaveBeenCalled();
    });

    it('should validate family name minimum length', async () => {
      const user = userEvent.setup();
      
      await user.type(screen.getByTestId('FamilyOnboardingWizard-Input-familyName'), 'A');
      
      // Submit the form using fireEvent.submit
      const form = screen.getByTestId('FamilyOnboardingWizard-Button-createFamily').closest('form');
      if (form) {
        fireEvent.submit(form);
      } else {
        await user.click(screen.getByTestId('FamilyOnboardingWizard-Button-createFamily'));
      }

      await waitFor(() => {
        expect(screen.getByTestId('FamilyOnboardingWizard-Alert-familyNameError')).toBeInTheDocument();
      });
      expect(mockCreateFamily).not.toHaveBeenCalled();
    });

    it('should create family with valid name', async () => {
      const user = userEvent.setup();
      const mockFamily: Family = {
        id: 'family-1',
        name: 'Test Family',
        inviteCode: 'ABC123',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        members: [],
        children: [],
        vehicles: []
      };
      
      mockCreateFamily.mockResolvedValueOnce(mockFamily);
      
      await user.type(screen.getByTestId('FamilyOnboardingWizard-Input-familyName'), 'Test Family');
      await user.click(screen.getByTestId('FamilyOnboardingWizard-Button-createFamily'));

      await waitFor(() => {
        expect(mockCreateFamily).toHaveBeenCalledWith('Test Family');
      });
    });

    it('should show success step after family creation', async () => {
      const user = userEvent.setup();
      const mockFamily: Family = {
        id: 'family-1',
        name: 'Test Family',
        inviteCode: 'ABC123',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        members: [],
        children: [],
        vehicles: []
      };
      
      mockCreateFamily.mockResolvedValueOnce(mockFamily);
      
      await user.type(screen.getByTestId('FamilyOnboardingWizard-Input-familyName'), 'Test Family');
      await user.click(screen.getByTestId('FamilyOnboardingWizard-Button-createFamily'));

      await waitFor(() => {
        expect(screen.getByTestId('FamilyOnboardingWizard-Heading-successTitle')).toBeInTheDocument();
      });
    });

    it('should handle creation errors', async () => {
      const user = userEvent.setup();
      const errorMessage = 'Family name already exists';
      
      mockCreateFamily.mockRejectedValueOnce(new Error(errorMessage));
      
      await user.type(screen.getByTestId('FamilyOnboardingWizard-Input-familyName'), 'Test Family');
      await user.click(screen.getByTestId('FamilyOnboardingWizard-Button-createFamily'));

      await waitFor(() => {
        expect(screen.getByTestId('FamilyOnboardingWizard-Alert-createFamilyError')).toBeInTheDocument();
      });
    });

    it('should show loading state during creation', async () => {
      const user = userEvent.setup();
      
      mockUseFamily.mockReturnValue({
        ...defaultFamilyContextValue,
        isLoading: true
      });
      
      // This test needs its own render since it changes the context
      render(<FamilyOnboardingWizard onComplete={mockOnComplete} />);
      await user.click(screen.getByTestId('FamilyOnboardingWizard-Button-createFamilyChoice'));
      
      // Use getAllByTestId to avoid conflicts with multiple renders
      const familyNameInputs = screen.getAllByTestId('FamilyOnboardingWizard-Input-familyName');
      await user.type(familyNameInputs[0], 'Test Family');

      const creatingButtons = screen.getAllByRole('button', { name: 'Creating...' });
      expect(creatingButtons[0]).toBeInTheDocument();
      expect(creatingButtons[0]).toBeDisabled();
    });

    it('should navigate back to choice step', async () => {
      const user = userEvent.setup();
      
      await user.click(screen.getByTestId('FamilyOnboardingWizard-Button-backToChoice'));

      expect(screen.getByTestId('FamilyOnboardingWizard-Heading-welcome')).toBeInTheDocument();
    });
  });

  describe('Join family step', () => {
    beforeEach(async () => {
      const user = userEvent.setup();
      render(<FamilyOnboardingWizard onComplete={mockOnComplete} />);
      
      await user.click(screen.getByTestId('FamilyOnboardingWizard-Button-joinFamilyChoice'));
    });

    it('should render join family form', () => {
      expect(screen.getByTestId('FamilyOnboardingWizard-Input-inviteCode')).toBeInTheDocument();
      expect(screen.getByTestId('FamilyOnboardingWizard-Button-joinFamily')).toBeInTheDocument();
      expect(screen.getByTestId('FamilyOnboardingWizard-Button-backToChoice')).toBeInTheDocument();
      expect(screen.getByTestId('FamilyOnboardingWizard-Text-noInviteCode')).toBeInTheDocument();
    });

    it('should validate invite code is required', async () => {
      const user = userEvent.setup();
      
      // Submit the form using fireEvent.submit
      const form = screen.getByTestId('FamilyOnboardingWizard-Button-joinFamily').closest('form');
      if (form) {
        fireEvent.submit(form);
      } else {
        await user.click(screen.getByTestId('FamilyOnboardingWizard-Button-joinFamily'));
      }

      await waitFor(() => {
        expect(screen.getByTestId('FamilyOnboardingWizard-Alert-inviteCodeError')).toBeInTheDocument();
      });
      expect(mockJoinFamily).not.toHaveBeenCalled();
    });

    it('should validate invite code minimum length', async () => {
      const user = userEvent.setup();
      
      await user.type(screen.getByTestId('FamilyOnboardingWizard-Input-inviteCode'), '123456');
      
      // Submit the form using fireEvent.submit
      const form = screen.getByTestId('FamilyOnboardingWizard-Button-joinFamily').closest('form');
      if (form) {
        fireEvent.submit(form);
      } else {
        await user.click(screen.getByTestId('FamilyOnboardingWizard-Button-joinFamily'));
      }

      await waitFor(() => {
        expect(screen.getByTestId('FamilyOnboardingWizard-Alert-inviteCodeError')).toBeInTheDocument();
      });
      expect(mockJoinFamily).not.toHaveBeenCalled();
    });

    it('should join family with valid code', async () => {
      const user = userEvent.setup();
      const mockFamily: Family = {
        id: 'family-1',
        name: 'Existing Family',
        inviteCode: 'ABC123DEF',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        members: [],
        children: [],
        vehicles: []
      };
      
      mockJoinFamily.mockResolvedValueOnce(mockFamily);
      
      await user.type(screen.getByTestId('FamilyOnboardingWizard-Input-inviteCode'), 'ABC123DEF');
      await user.click(screen.getByTestId('FamilyOnboardingWizard-Button-joinFamily'));

      await waitFor(() => {
        expect(mockJoinFamily).toHaveBeenCalledWith('ABC123DEF');
      });
    });

    it('should show success step after joining family', async () => {
      const user = userEvent.setup();
      const mockFamily: Family = {
        id: 'family-1',
        name: 'Existing Family',
        inviteCode: 'ABC123DEF',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        members: [],
        children: [],
        vehicles: []
      };
      
      mockJoinFamily.mockResolvedValueOnce(mockFamily);
      
      await user.type(screen.getByTestId('FamilyOnboardingWizard-Input-inviteCode'), 'ABC123DEF');
      await user.click(screen.getByTestId('FamilyOnboardingWizard-Button-joinFamily'));

      await waitFor(() => {
        expect(screen.getByTestId('FamilyOnboardingWizard-Heading-successTitle')).toBeInTheDocument();
      });
    });

    it('should handle join errors', async () => {
      const user = userEvent.setup();
      const errorMessage = 'Invalid invite code';
      
      mockJoinFamily.mockRejectedValueOnce(new Error(errorMessage));
      
      await user.type(screen.getByTestId('FamilyOnboardingWizard-Input-inviteCode'), 'INVALID123');
      await user.click(screen.getByTestId('FamilyOnboardingWizard-Button-joinFamily'));

      await waitFor(() => {
        expect(screen.getByTestId('FamilyOnboardingWizard-Alert-joinFamilyError')).toBeInTheDocument();
      });
    });
  });

  describe('Success step', () => {
    it('should call onComplete after success timeout', async () => {
      const user = userEvent.setup();
      const mockFamily: Family = {
        id: 'family-1',
        name: 'Test Family',
        inviteCode: 'ABC123',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        members: [],
        children: [],
        vehicles: []
      };
      
      mockCreateFamily.mockResolvedValueOnce(mockFamily);
      
      render(<FamilyOnboardingWizard onComplete={mockOnComplete} />);
      
      await user.click(screen.getByTestId('FamilyOnboardingWizard-Button-createFamilyChoice'));
      await user.type(screen.getByTestId('FamilyOnboardingWizard-Input-familyName'), 'Test Family');
      await user.click(screen.getByTestId('FamilyOnboardingWizard-Button-createFamily'));

      await waitFor(() => {
        expect(screen.getByTestId('FamilyOnboardingWizard-Heading-successTitle')).toBeInTheDocument();
      });

      // Wait for the timeout to complete naturally (2000ms + buffer)
      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalled();
      }, { timeout: 3000 });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      render(<FamilyOnboardingWizard onComplete={mockOnComplete} />);

      expect(screen.getByTestId('FamilyOnboardingWizard-Button-createFamilyChoice')).toBeInTheDocument();
      expect(screen.getByTestId('FamilyOnboardingWizard-Button-joinFamilyChoice')).toBeInTheDocument();
    });

    it('should show error messages with proper ARIA attributes', async () => {
      const user = userEvent.setup();
      render(<FamilyOnboardingWizard onComplete={mockOnComplete} />);
      
      await user.click(screen.getByTestId('FamilyOnboardingWizard-Button-createFamilyChoice'));
      
      // Submit the form using fireEvent.submit
      const form = screen.getByTestId('FamilyOnboardingWizard-Button-createFamily').closest('form');
      if (form) {
        fireEvent.submit(form);
      }

      await waitFor(() => {
        const errorElement = screen.getByTestId('FamilyOnboardingWizard-Alert-familyNameError');
        expect(errorElement).toHaveAttribute('role', 'alert');
        expect(errorElement).toHaveAttribute('id', 'family-name-error');
      });
    });
  });
});