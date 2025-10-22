import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CreateGroupModal from '../CreateGroupModal';

describe('CreateGroupModal', () => {
  const mockOnClose = vi.fn();
  const mockOnSubmit = vi.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
    mockOnSubmit.mockClear();
  });

  it('does not render when closed', () => {
    render(
      <CreateGroupModal
        isOpen={false}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders modal when open', () => {
    render(
      <CreateGroupModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    );

    expect(screen.getByTestId('CreateGroupModal-Title-modalTitle')).toBeInTheDocument();
    expect(screen.getByTestId('CreateGroupModal-Title-modalTitle')).toBeInTheDocument();
    expect(screen.getByTestId('CreateGroupModal-Description-modalDescription')).toBeInTheDocument();
  });

  it('renders form elements correctly', () => {
    render(
      <CreateGroupModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    );

    expect(screen.getByTestId('CreateGroupModal-Input-groupName')).toBeInTheDocument();
    expect(screen.getByTestId('CreateGroupModal-Input-groupName')).toBeInTheDocument();
    expect(screen.getByTestId('CreateGroupModal-Button-cancel')).toBeInTheDocument();
    expect(screen.getByTestId('CreateGroupModal-Button-submit')).toBeInTheDocument();
  });

  it('submits form with valid data', async () => {
    const user = userEvent.setup();
    mockOnSubmit.mockResolvedValue(undefined);

    render(
      <CreateGroupModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    );

    const input = screen.getByTestId('CreateGroupModal-Input-groupName');
    const submitButton = screen.getByTestId('CreateGroupModal-Button-submit');

    await user.type(input, 'Test Group');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith('Test Group');
    });
  });

  it('prevents submission with empty or whitespace-only name', async () => {
    const user = userEvent.setup();

    render(
      <CreateGroupModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    );

    const submitButton = screen.getByTestId('CreateGroupModal-Button-submit');
    
    // Should be disabled initially
    expect(submitButton).toBeDisabled();

    // Type whitespace
    const input = screen.getByTestId('CreateGroupModal-Input-groupName');
    await user.type(input, '   ');
    
    // Should still be disabled
    expect(submitButton).toBeDisabled();
  });

  it('enables submit button when valid text is entered', async () => {
    const user = userEvent.setup();

    render(
      <CreateGroupModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    );

    const input = screen.getByTestId('CreateGroupModal-Input-groupName');
    const submitButton = screen.getByTestId('CreateGroupModal-Button-submit');

    expect(submitButton).toBeDisabled();

    await user.type(input, 'Valid Group Name');
    
    expect(submitButton).not.toBeDisabled();
  });

  it('shows loading state during submission', async () => {
    const user = userEvent.setup();
    let resolveSubmit: () => void;
    const submitPromise = new Promise<void>((resolve) => {
      resolveSubmit = resolve;
    });
    mockOnSubmit.mockReturnValue(submitPromise);

    render(
      <CreateGroupModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    );

    const input = screen.getByTestId('CreateGroupModal-Input-groupName');
    const submitButton = screen.getByTestId('CreateGroupModal-Button-submit');

    await user.type(input, 'Test Group');
    await user.click(submitButton);

    // Should show loading state
    expect(screen.getByTestId('CreateGroupModal-Button-submit')).toHaveTextContent(/creating.../i);
    expect(submitButton).toBeDisabled();
    expect(screen.getByTestId('CreateGroupModal-Button-cancel')).toBeDisabled();

    // Complete the submission
    resolveSubmit!();
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalled();
    });
  });

  it('displays error message when submission fails', async () => {
    const user = userEvent.setup();
    const errorMessage = 'Group name already exists';
    mockOnSubmit.mockRejectedValue(new Error(errorMessage));

    render(
      <CreateGroupModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    );

    const input = screen.getByTestId('CreateGroupModal-Input-groupName');
    const submitButton = screen.getByTestId('CreateGroupModal-Button-submit');

    await user.type(input, 'Test Group');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByTestId('CreateGroupModal-Alert-error')).toHaveTextContent(errorMessage);
    });
  });

  it('closes modal when cancel button is clicked', async () => {
    const user = userEvent.setup();

    render(
      <CreateGroupModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    );

    const cancelButton = screen.getByTestId('CreateGroupModal-Button-cancel');
    await user.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('clears form and closes modal on successful submission', async () => {
    const user = userEvent.setup();
    mockOnSubmit.mockResolvedValue(undefined);

    render(
      <CreateGroupModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    );

    const input = screen.getByTestId('CreateGroupModal-Input-groupName');
    const submitButton = screen.getByTestId('CreateGroupModal-Button-submit');

    await user.type(input, 'Test Group');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('clears error when modal is reopened', () => {
    const { rerender } = render(
      <CreateGroupModal
        isOpen={false}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    );

    // Open modal, should not show error initially
    rerender(
      <CreateGroupModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    );

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('prevents closing modal during submission', async () => {
    const user = userEvent.setup();
    let resolveSubmit: () => void;
    const submitPromise = new Promise<void>((resolve) => {
      resolveSubmit = resolve;
    });
    mockOnSubmit.mockReturnValue(submitPromise);

    render(
      <CreateGroupModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    );

    const input = screen.getByTestId('CreateGroupModal-Input-groupName');
    const submitButton = screen.getByTestId('CreateGroupModal-Button-submit');

    await user.type(input, 'Test Group');
    await user.click(submitButton);

    // Try to close via cancel button - should be disabled
    const cancelButton = screen.getByTestId('CreateGroupModal-Button-cancel');
    expect(cancelButton).toBeDisabled();

    // Complete submission
    resolveSubmit!();
    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('trims whitespace from group name before submission', async () => {
    const user = userEvent.setup();
    mockOnSubmit.mockResolvedValue(undefined);

    render(
      <CreateGroupModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    );

    const input = screen.getByTestId('CreateGroupModal-Input-groupName');
    const submitButton = screen.getByTestId('CreateGroupModal-Button-submit');

    await user.type(input, '  Test Group  ');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith('Test Group');
    });
  });
});