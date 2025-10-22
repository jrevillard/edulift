import { render, screen, fireEvent, waitFor } from '../../test/test-utils';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { FamilySearchInvitation } from '../FamilySearchInvitation';
import { groupApiService } from '../../services/groupApiService';

// Mock the groupApiService
vi.mock('../../services/groupApiService', () => ({
  groupApiService: {
    searchFamiliesForInvitation: vi.fn(),
    inviteFamilyToGroup: vi.fn(),
  }
}));

// Get the mocked functions
const mockSearchFamilies = vi.mocked(groupApiService.searchFamiliesForInvitation);
const mockInviteFamily = vi.mocked(groupApiService.inviteFamilyToGroup);

describe('FamilySearchInvitation', () => {
  const defaultProps = {
    groupId: 'group-123',
    onInvitationSent: vi.fn(),
    isOpen: true,
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render search input and search button', () => {
    render(<FamilySearchInvitation {...defaultProps} />);
    
    expect(screen.getByTestId('FamilySearchInvitation-Input-familySearch')).toBeInTheDocument();
    expect(screen.getByTestId('FamilySearchInvitation-Button-searchFamilies')).toBeInTheDocument();
  });

  it('should search families when search button is clicked', async () => {
    const mockFamilies = [
      {
        id: 'family-1',
        name: 'Famille Martin',
        adminContacts: [{ name: 'Pierre Martin', email: 'pierre@martin.com' }],
        memberCount: 4,
        canInvite: true,
      },
    ];

    mockSearchFamilies.mockResolvedValue(mockFamilies);

    render(<FamilySearchInvitation {...defaultProps} />);
    
    const searchInput = screen.getByTestId('FamilySearchInvitation-Input-familySearch');
    const searchButton = screen.getByTestId('FamilySearchInvitation-Button-searchFamilies');

    await userEvent.type(searchInput, 'Martin');
    fireEvent.click(searchButton);

    await waitFor(() => {
      expect(mockSearchFamilies).toHaveBeenCalledWith('group-123', 'Martin');
    });

    await waitFor(() => {
      expect(screen.getByTestId('family-name-family-1')).toHaveTextContent('Famille Martin');
      expect(screen.getByTestId('family-member-count-family-1')).toHaveTextContent('4 members');
      expect(screen.getByTestId('family-admin-email-family-1')).toHaveTextContent(/pierre@martin\.com/);
    });
  });

  it('should invite family when invite button is clicked', async () => {
    const mockFamilies = [
      {
        id: 'family-1',
        name: 'Famille Martin',
        adminContacts: [{ name: 'Pierre Martin', email: 'pierre@martin.com' }],
        memberCount: 4,
        canInvite: true,
      },
    ];

    mockSearchFamilies.mockResolvedValue(mockFamilies);
    mockInviteFamily.mockResolvedValue({
      invitationsSent: 1,
      familyName: 'Famille Martin',
      groupName: 'Test Group',
    });

    render(<FamilySearchInvitation {...defaultProps} />);
    
    const searchInput = screen.getByTestId('FamilySearchInvitation-Input-familySearch');
    const searchButton = screen.getByTestId('FamilySearchInvitation-Button-searchFamilies');

    await userEvent.type(searchInput, 'Martin');
    fireEvent.click(searchButton);

    await waitFor(() => {
      expect(screen.getByTestId('family-name-family-1')).toHaveTextContent('Famille Martin');
    });

    const inviteButton = screen.getByTestId('invite-family-button-family-1');
    fireEvent.click(inviteButton);

    await waitFor(() => {
      expect(mockInviteFamily).toHaveBeenCalledWith('group-123', 'family-1', 'MEMBER', undefined);
    });

    await waitFor(() => {
      expect(defaultProps.onInvitationSent).toHaveBeenCalled();
    });
  });

  it('should show loading state while searching', async () => {
    mockSearchFamilies.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

    render(<FamilySearchInvitation {...defaultProps} />);
    
    const searchInput = screen.getByTestId('FamilySearchInvitation-Input-familySearch');
    const searchButton = screen.getByTestId('FamilySearchInvitation-Button-searchFamilies');

    await userEvent.type(searchInput, 'Martin');
    fireEvent.click(searchButton);

    expect(screen.getByTestId('FamilySearchInvitation-Text-searching')).toBeInTheDocument();
  });

  it('should show error message when search fails', async () => {
    mockSearchFamilies.mockRejectedValue(new Error('Search failed'));

    render(<FamilySearchInvitation {...defaultProps} />);
    
    const searchInput = screen.getByTestId('FamilySearchInvitation-Input-familySearch');
    const searchButton = screen.getByTestId('FamilySearchInvitation-Button-searchFamilies');

    await userEvent.type(searchInput, 'Martin');
    fireEvent.click(searchButton);

    await waitFor(() => {
      expect(screen.getByTestId('FamilySearchInvitation-AlertDescription-searchError')).toHaveTextContent(/search failed/i);
    });
  });

  it('should show no results message when no families found', async () => {
    mockSearchFamilies.mockResolvedValue([]);

    render(<FamilySearchInvitation {...defaultProps} />);
    
    const searchInput = screen.getByTestId('FamilySearchInvitation-Input-familySearch');
    const searchButton = screen.getByTestId('FamilySearchInvitation-Button-searchFamilies');

    await userEvent.type(searchInput, 'NonExistent');
    fireEvent.click(searchButton);

    await waitFor(() => {
      expect(screen.getByTestId('FamilySearchInvitation-Text-noFamiliesFound')).toHaveTextContent(/no families found/i);
    });
  });
});