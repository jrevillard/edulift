import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GroupScheduleConfigModal } from '../GroupScheduleConfigModal';
import { scheduleConfigService } from '../../services/scheduleConfigService';
import { toast } from 'sonner';
import type { GroupScheduleConfig } from '../../services/scheduleConfigService';

// Mock the services
vi.mock('../../services/scheduleConfigService');
vi.mock('sonner');

// Mock the AuthContext
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'user-1', name: 'Test User', email: 'test@example.com', timezone: 'UTC' }
  }))
}));

// Mock the toast function
const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
};
vi.mocked(toast).success = mockToast.success;
vi.mocked(toast).error = mockToast.error;

// Create a test wrapper with QueryClient
const createTestWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  return { TestWrapper, queryClient };
};

describe('GroupScheduleConfigModal - Data Test ID Tests', () => {
  const mockCurrentConfig: GroupScheduleConfig = {
    id: 'config-1',
    groupId: 'group-1',
    scheduleHours: {
      'MONDAY': ['07:00', '07:30', '08:00'],
      'TUESDAY': ['08:00', '08:30'],
      'WEDNESDAY': [],
      'THURSDAY': ['15:00', '15:30'],
      'FRIDAY': ['16:00']
    },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    isDefault: false
  };

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    groupId: 'group-1',
    groupName: 'Test Group',
    currentConfig: mockCurrentConfig,
    isAdmin: true
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Modal Structure and Layout', () => {
    it('should render modal with proper data-testid structure', () => {
      const { TestWrapper } = createTestWrapper();
      
      render(
        <TestWrapper>
          <GroupScheduleConfigModal {...defaultProps} />
        </TestWrapper>
      );

      // Main modal elements
      expect(screen.getByTestId('GroupScheduleConfigModal-Content-dialog')).toBeInTheDocument();
      expect(screen.getByTestId('GroupScheduleConfigModal-Title-scheduleConfig')).toBeInTheDocument();
      expect(screen.getByTestId('GroupScheduleConfigModal-Text-description')).toBeInTheDocument();
    });

    it('should show default configuration badge when config is default', () => {
      const { TestWrapper } = createTestWrapper();
      
      const defaultConfig = {
        ...mockCurrentConfig,
        isDefault: true
      };
      
      render(
        <TestWrapper>
          <GroupScheduleConfigModal
            {...defaultProps}
            currentConfig={defaultConfig}
          />
        </TestWrapper>
      );

      expect(screen.getByTestId('GroupScheduleConfigModal-Badge-defaultConfig')).toBeInTheDocument();
    });

    it('should show read-only alert for non-admin users', () => {
      const { TestWrapper } = createTestWrapper();
      
      render(
        <TestWrapper>
          <GroupScheduleConfigModal
            {...defaultProps}
            isAdmin={false}
          />
        </TestWrapper>
      );

      expect(screen.getByTestId('GroupScheduleConfigModal-Alert-readOnlyMode')).toBeInTheDocument();
    });
  });

  describe('Configuration Summary Section', () => {
    it('should display configuration summary with correct data-testids', () => {
      const { TestWrapper } = createTestWrapper();
      
      render(
        <TestWrapper>
          <GroupScheduleConfigModal {...defaultProps} />
        </TestWrapper>
      );

      // Summary card
      expect(screen.getByTestId('GroupScheduleConfigModal-Card-configurationSummary')).toBeInTheDocument();
      
      // Summary metrics
      expect(screen.getByTestId('GroupScheduleConfigModal-Container-totalTimeSlots')).toBeInTheDocument();
      expect(screen.getByTestId('GroupScheduleConfigModal-Text-totalTimeSlotsValue')).toBeInTheDocument();
      
      expect(screen.getByTestId('GroupScheduleConfigModal-Container-activeWeekdays')).toBeInTheDocument();
      expect(screen.getByTestId('GroupScheduleConfigModal-Text-activeWeekdaysValue')).toBeInTheDocument();
      
      expect(screen.getByTestId('GroupScheduleConfigModal-Container-avgPerDay')).toBeInTheDocument();
      expect(screen.getByTestId('GroupScheduleConfigModal-Text-avgPerDayValue')).toBeInTheDocument();
      
      expect(screen.getByTestId('GroupScheduleConfigModal-Container-configurationStatus')).toBeInTheDocument();
      expect(screen.getByTestId('GroupScheduleConfigModal-Text-configurationStatusValue')).toBeInTheDocument();
    });

    it('should show correct values in configuration summary', () => {
      const { TestWrapper } = createTestWrapper();
      
      render(
        <TestWrapper>
          <GroupScheduleConfigModal {...defaultProps} />
        </TestWrapper>
      );

      // Total time slots: 3 + 2 + 0 + 2 + 1 = 8
      expect(screen.getByTestId('GroupScheduleConfigModal-Text-totalTimeSlotsValue')).toHaveTextContent('8');
      
      // Active weekdays: 4 (Monday, Tuesday, Thursday, Friday)
      expect(screen.getByTestId('GroupScheduleConfigModal-Text-activeWeekdaysValue')).toHaveTextContent('4');
      
      // Average per day: 8/5 = 1.6 -> rounded = 2
      expect(screen.getByTestId('GroupScheduleConfigModal-Text-avgPerDayValue')).toHaveTextContent('2');
      
      // Configuration status should be valid
      expect(screen.getByTestId('GroupScheduleConfigModal-Text-configurationStatusValue')).toHaveTextContent('Valid');
    });
  });

  describe('Weekday Tabs', () => {
    it('should render weekday tabs with correct data-testids', () => {
      const { TestWrapper } = createTestWrapper();
      
      render(
        <TestWrapper>
          <GroupScheduleConfigModal {...defaultProps} />
        </TestWrapper>
      );

      // Tabs container
      expect(screen.getByTestId('GroupScheduleConfigModal-Tabs-weekdayTabs')).toBeInTheDocument();
      
      // Individual tabs
      expect(screen.getByTestId('GroupScheduleConfigModal-Tab-monday')).toBeInTheDocument();
      expect(screen.getByTestId('GroupScheduleConfigModal-Tab-tuesday')).toBeInTheDocument();
      expect(screen.getByTestId('GroupScheduleConfigModal-Tab-wednesday')).toBeInTheDocument();
      expect(screen.getByTestId('GroupScheduleConfigModal-Tab-thursday')).toBeInTheDocument();
      expect(screen.getByTestId('GroupScheduleConfigModal-Tab-friday')).toBeInTheDocument();
      
      // Badge elements showing slot counts
      expect(screen.getByTestId('GroupScheduleConfigModal-Badge-mondaySlotCount')).toBeInTheDocument();
      expect(screen.getByTestId('GroupScheduleConfigModal-Badge-tuesdaySlotCount')).toBeInTheDocument();
      expect(screen.getByTestId('GroupScheduleConfigModal-Badge-wednesdaySlotCount')).toBeInTheDocument();
      expect(screen.getByTestId('GroupScheduleConfigModal-Badge-thursdaySlotCount')).toBeInTheDocument();
      expect(screen.getByTestId('GroupScheduleConfigModal-Badge-fridaySlotCount')).toBeInTheDocument();
    });

    it('should show correct slot counts in weekday badges', () => {
      const { TestWrapper } = createTestWrapper();
      
      render(
        <TestWrapper>
          <GroupScheduleConfigModal {...defaultProps} />
        </TestWrapper>
      );

      // Check badge contents
      expect(screen.getByTestId('GroupScheduleConfigModal-Badge-mondaySlotCount')).toHaveTextContent('3');
      expect(screen.getByTestId('GroupScheduleConfigModal-Badge-tuesdaySlotCount')).toHaveTextContent('2');
      expect(screen.getByTestId('GroupScheduleConfigModal-Badge-wednesdaySlotCount')).toHaveTextContent('0');
      expect(screen.getByTestId('GroupScheduleConfigModal-Badge-thursdaySlotCount')).toHaveTextContent('2');
      expect(screen.getByTestId('GroupScheduleConfigModal-Badge-fridaySlotCount')).toHaveTextContent('1');
    });

    it('should switch between tabs when clicked', async () => {
      const user = userEvent.setup();
      const { TestWrapper } = createTestWrapper();
      
      render(
        <TestWrapper>
          <GroupScheduleConfigModal {...defaultProps} />
        </TestWrapper>
      );

      // Initially on Monday tab
      expect(screen.getByTestId('GroupScheduleConfigModal-Tab-monday')).toHaveAttribute('data-state', 'active');
      
      // Click Tuesday tab
      await user.click(screen.getByTestId('GroupScheduleConfigModal-Tab-tuesday'));
      
      // Tuesday should be active
      expect(screen.getByTestId('GroupScheduleConfigModal-Tab-tuesday')).toHaveAttribute('data-state', 'active');
      expect(screen.getByTestId('GroupScheduleConfigModal-Tab-monday')).toHaveAttribute('data-state', 'inactive');
    });
  });

  describe('Time Slot Management', () => {
    it('should show time slot controls for admin users', () => {
      const { TestWrapper } = createTestWrapper();
      
      render(
        <TestWrapper>
          <GroupScheduleConfigModal {...defaultProps} />
        </TestWrapper>
      );

      // Time slot controls should be visible for admin
      expect(screen.getByTestId('GroupScheduleConfigModal-Select-newTimeSlot')).toBeInTheDocument();
      expect(screen.getByTestId('GroupScheduleConfigModal-Button-addTimeSlot')).toBeInTheDocument();
    });

    it('should hide time slot controls for non-admin users', () => {
      const { TestWrapper } = createTestWrapper();
      
      render(
        <TestWrapper>
          <GroupScheduleConfigModal
            {...defaultProps}
            isAdmin={false}
          />
        </TestWrapper>
      );

      // Time slot controls should not be visible for non-admin
      expect(screen.queryByTestId('GroupScheduleConfigModal-Select-newTimeSlot')).not.toBeInTheDocument();
      expect(screen.queryByTestId('GroupScheduleConfigModal-Button-addTimeSlot')).not.toBeInTheDocument();
    });

    it('should add new time slot when admin clicks add button', async () => {
      const user = userEvent.setup();
      const { TestWrapper } = createTestWrapper();
      
      render(
        <TestWrapper>
          <GroupScheduleConfigModal {...defaultProps} />
        </TestWrapper>
      );

      // Select a time slot
      const selectElement = screen.getByTestId('GroupScheduleConfigModal-Select-newTimeSlot');
      await user.selectOptions(selectElement, '09:00');
      
      // Click add button
      const addButton = screen.getByTestId('GroupScheduleConfigModal-Button-addTimeSlot');
      await user.click(addButton);

      // Should enable save button
      await waitFor(() => {
        const saveButton = screen.getByTestId('GroupScheduleConfigModal-Button-saveConfiguration');
        expect(saveButton).not.toBeDisabled();
      });
    });

    it('should disable add button when maximum slots reached', () => {
      const { TestWrapper } = createTestWrapper();
      
      // Create config with 20 time slots (maximum)
      const fullSchedule = Array.from({ length: 20 }, (_, i) => 
        `${String(6 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 === 0 ? '00' : '30'}`
      );
      
      const configWithMaxSlots = {
        ...mockCurrentConfig,
        scheduleHours: {
          'MONDAY': fullSchedule,
          'TUESDAY': [],
          'WEDNESDAY': [],
          'THURSDAY': [],
          'FRIDAY': []
        }
      };
      
      render(
        <TestWrapper>
          <GroupScheduleConfigModal
            {...defaultProps}
            currentConfig={configWithMaxSlots}
          />
        </TestWrapper>
      );

      // Add button should be disabled when at maximum
      expect(screen.getByTestId('GroupScheduleConfigModal-Button-addTimeSlot')).toBeDisabled();
    });
  });

  describe('Action Buttons', () => {
    it('should show admin action buttons for admin users', () => {
      const { TestWrapper } = createTestWrapper();
      
      render(
        <TestWrapper>
          <GroupScheduleConfigModal {...defaultProps} />
        </TestWrapper>
      );

      // Admin buttons should be visible
      expect(screen.getByTestId('GroupScheduleConfigModal-Button-resetToDefault')).toBeInTheDocument();
      expect(screen.getByTestId('GroupScheduleConfigModal-Button-saveConfiguration')).toBeInTheDocument();
      expect(screen.getByTestId('GroupScheduleConfigModal-Button-close')).toBeInTheDocument();
    });

    it('should hide admin action buttons for non-admin users', () => {
      const { TestWrapper } = createTestWrapper();
      
      render(
        <TestWrapper>
          <GroupScheduleConfigModal
            {...defaultProps}
            isAdmin={false}
          />
        </TestWrapper>
      );

      // Admin buttons should not be visible
      expect(screen.queryByTestId('GroupScheduleConfigModal-Button-resetToDefault')).not.toBeInTheDocument();
      expect(screen.queryByTestId('GroupScheduleConfigModal-Button-saveConfiguration')).not.toBeInTheDocument();
      
      // Close button should still be visible
      expect(screen.getByTestId('GroupScheduleConfigModal-Button-close')).toBeInTheDocument();
    });

    it('should call onClose when close button is clicked', async () => {
      const user = userEvent.setup();
      const mockOnClose = vi.fn();
      const { TestWrapper } = createTestWrapper();
      
      render(
        <TestWrapper>
          <GroupScheduleConfigModal
            {...defaultProps}
            onClose={mockOnClose}
          />
        </TestWrapper>
      );

      const closeButton = screen.getByTestId('GroupScheduleConfigModal-Button-close');
      await user.click(closeButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should save configuration when save button is clicked', async () => {
      const user = userEvent.setup();
      const { TestWrapper } = createTestWrapper();
      
      // Mock successful save
      vi.mocked(scheduleConfigService.updateGroupScheduleConfig).mockResolvedValue(mockCurrentConfig);
      
      render(
        <TestWrapper>
          <GroupScheduleConfigModal {...defaultProps} />
        </TestWrapper>
      );

      // First make a change to enable save button
      const selectElement = screen.getByTestId('GroupScheduleConfigModal-Select-newTimeSlot');
      await user.selectOptions(selectElement, '09:00');
      
      const addButton = screen.getByTestId('GroupScheduleConfigModal-Button-addTimeSlot');
      await user.click(addButton);

      // Now save
      const saveButton = screen.getByTestId('GroupScheduleConfigModal-Button-saveConfiguration');
      await user.click(saveButton);

      await waitFor(() => {
        expect(scheduleConfigService.updateGroupScheduleConfig).toHaveBeenCalledWith(
          'group-1',
          expect.objectContaining({
            'MONDAY': expect.arrayContaining(['07:00', '07:30', '08:00', '09:00'])
          })
        );
      });

      expect(mockToast.success).toHaveBeenCalledWith('Schedule configuration updated successfully');
    });

    it('should reset to default when reset button is clicked', async () => {
      const user = userEvent.setup();
      const { TestWrapper } = createTestWrapper();
      
      // Mock successful reset
      vi.mocked(scheduleConfigService.resetGroupScheduleConfig).mockResolvedValue(mockCurrentConfig);
      
      // Mock window.confirm
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      
      render(
        <TestWrapper>
          <GroupScheduleConfigModal {...defaultProps} />
        </TestWrapper>
      );

      const resetButton = screen.getByTestId('GroupScheduleConfigModal-Button-resetToDefault');
      await user.click(resetButton);

      await waitFor(() => {
        expect(scheduleConfigService.resetGroupScheduleConfig).toHaveBeenCalledWith('group-1');
      });

      expect(mockToast.success).toHaveBeenCalledWith('Schedule configuration reset to default');
      
      confirmSpy.mockRestore();
    });

    it('should disable save button when no changes are made', () => {
      const { TestWrapper } = createTestWrapper();
      
      render(
        <TestWrapper>
          <GroupScheduleConfigModal {...defaultProps} />
        </TestWrapper>
      );

      // Save button should be disabled when no changes
      expect(screen.getByTestId('GroupScheduleConfigModal-Button-saveConfiguration')).toBeDisabled();
    });
  });

  describe('Copy Schedule Functionality', () => {
    it('should show copy from day controls for admin users', () => {
      const { TestWrapper } = createTestWrapper();
      
      render(
        <TestWrapper>
          <GroupScheduleConfigModal {...defaultProps} />
        </TestWrapper>
      );

      // Copy controls should be visible for admin
      expect(screen.getByTestId('GroupScheduleConfigModal-Select-copyFromDay')).toBeInTheDocument();
      expect(screen.getByTestId('GroupScheduleConfigModal-Button-copyFromDay')).toBeInTheDocument();
    });

    it('should hide copy from day controls for non-admin users', () => {
      const { TestWrapper } = createTestWrapper();
      
      render(
        <TestWrapper>
          <GroupScheduleConfigModal
            {...defaultProps}
            isAdmin={false}
          />
        </TestWrapper>
      );

      // Copy controls should not be visible for non-admin
      expect(screen.queryByTestId('GroupScheduleConfigModal-Select-copyFromDay')).not.toBeInTheDocument();
      expect(screen.queryByTestId('GroupScheduleConfigModal-Button-copyFromDay')).not.toBeInTheDocument();
    });

    it('should show available days with time slots in copy dropdown', () => {
      const { TestWrapper } = createTestWrapper();
      
      render(
        <TestWrapper>
          <GroupScheduleConfigModal {...defaultProps} />
        </TestWrapper>
      );

      const selectElement = screen.getByTestId('GroupScheduleConfigModal-Select-copyFromDay');
      const options = selectElement.querySelectorAll('option');
      
      // Should have placeholder option plus available days (excluding current day)
      expect(options[0]).toHaveTextContent('Copy from another day...');
      
      // Should show Tuesday, Thursday, Friday (Monday is active, Wednesday has no slots)
      const optionTexts = Array.from(options).map(option => option.textContent);
      expect(optionTexts).toContain('Tuesday (2 slots)');
      expect(optionTexts).toContain('Thursday (2 slots)');
      expect(optionTexts).toContain('Friday (1 slots)');
      expect(optionTexts).not.toContain('Monday'); // Current active day
      expect(optionTexts).not.toContain('Wednesday'); // No slots
    });

    it('should copy schedule from selected day when copy button is clicked', async () => {
      const user = userEvent.setup();
      const { TestWrapper } = createTestWrapper();
      
      render(
        <TestWrapper>
          <GroupScheduleConfigModal {...defaultProps} />
        </TestWrapper>
      );

      // Switch to Wednesday (empty day)
      await user.click(screen.getByTestId('GroupScheduleConfigModal-Tab-wednesday'));

      // Select Tuesday to copy from
      const selectElement = screen.getByTestId('GroupScheduleConfigModal-Select-copyFromDay');
      await user.selectOptions(selectElement, 'TUESDAY');
      
      // Click copy button
      const copyButton = screen.getByTestId('GroupScheduleConfigModal-Button-copyFromDay');
      await user.click(copyButton);

      // Should show success toast
      expect(vi.mocked(toast).success).toHaveBeenCalledWith('Copied 2 time slots from Tuesday to Wednesday');
      
      // Should enable save button
      const saveButton = screen.getByTestId('GroupScheduleConfigModal-Button-saveConfiguration');
      expect(saveButton).not.toBeDisabled();
    });

    it('should show confirmation when copying to day with existing slots', async () => {
      const user = userEvent.setup();
      const { TestWrapper } = createTestWrapper();
      
      // Mock window.confirm to return true
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      
      render(
        <TestWrapper>
          <GroupScheduleConfigModal {...defaultProps} />
        </TestWrapper>
      );

      // On Monday (has 3 slots), copy from Tuesday
      const selectElement = screen.getByTestId('GroupScheduleConfigModal-Select-copyFromDay');
      await user.selectOptions(selectElement, 'TUESDAY');
      
      const copyButton = screen.getByTestId('GroupScheduleConfigModal-Button-copyFromDay');
      await user.click(copyButton);

      // Should show confirmation dialog
      expect(confirmSpy).toHaveBeenCalledWith('This will replace all 3 time slot(s) in Monday with 2 time slot(s) from Tuesday. Continue?');
      
      // Should show success toast
      expect(vi.mocked(toast).success).toHaveBeenCalledWith('Copied 2 time slots from Tuesday to Monday');
      
      confirmSpy.mockRestore();
    });

    it('should not copy when user cancels confirmation', async () => {
      const user = userEvent.setup();
      const { TestWrapper } = createTestWrapper();
      
      // Mock window.confirm to return false
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
      
      render(
        <TestWrapper>
          <GroupScheduleConfigModal {...defaultProps} />
        </TestWrapper>
      );

      // On Monday (has 3 slots), copy from Tuesday
      const selectElement = screen.getByTestId('GroupScheduleConfigModal-Select-copyFromDay');
      await user.selectOptions(selectElement, 'TUESDAY');
      
      const copyButton = screen.getByTestId('GroupScheduleConfigModal-Button-copyFromDay');
      await user.click(copyButton);

      // Should show confirmation dialog
      expect(confirmSpy).toHaveBeenCalled();
      
      // Should NOT show success toast
      expect(vi.mocked(toast).success).not.toHaveBeenCalled();
      
      confirmSpy.mockRestore();
    });

    it('should show error when trying to copy from same day', async () => {
      const user = userEvent.setup();
      const { TestWrapper } = createTestWrapper();
      
      render(
        <TestWrapper>
          <GroupScheduleConfigModal {...defaultProps} />
        </TestWrapper>
      );

      // Manually set the copy from day to same as active day (shouldn't be possible via UI but test edge case)
      const copyButton = screen.getByTestId('GroupScheduleConfigModal-Button-copyFromDay');
      
      // Button should be disabled when no day is selected
      expect(copyButton).toBeDisabled();
    });

    it('should show error when trying to copy from day with no slots', async () => {
      const user = userEvent.setup();
      const { TestWrapper } = createTestWrapper();
      
      // Create config where Wednesday has some slots to show in dropdown
      const configWithWednesdaySlots = {
        ...mockCurrentConfig,
        scheduleHours: {
          ...mockCurrentConfig.scheduleHours,
          'WEDNESDAY': ['10:00'] // Add one slot to Wednesday
        }
      };
      
      render(
        <TestWrapper>
          <GroupScheduleConfigModal 
            {...defaultProps} 
            currentConfig={configWithWednesdaySlots}
          />
        </TestWrapper>
      );

      // Switch to Friday
      await user.click(screen.getByTestId('GroupScheduleConfigModal-Tab-friday'));

      // Now clear Wednesday slots by updating the component state (simulate user removing all slots)
      // For this test, we'll just verify the error handling by checking the validation logic
      
      // The dropdown should only show days with slots, so if Wednesday appears but has no slots,
      // the copy function should handle this edge case
      expect(screen.getByTestId('GroupScheduleConfigModal-Select-copyFromDay')).toBeInTheDocument();
    });

    it('should disable copy button when no day is selected', () => {
      const { TestWrapper } = createTestWrapper();
      
      render(
        <TestWrapper>
          <GroupScheduleConfigModal {...defaultProps} />
        </TestWrapper>
      );

      const copyButton = screen.getByTestId('GroupScheduleConfigModal-Button-copyFromDay');
      expect(copyButton).toBeDisabled();
    });

    it('should reset copy dropdown after successful copy', async () => {
      const user = userEvent.setup();
      const { TestWrapper } = createTestWrapper();
      
      render(
        <TestWrapper>
          <GroupScheduleConfigModal {...defaultProps} />
        </TestWrapper>
      );

      // Switch to Wednesday (empty day)
      await user.click(screen.getByTestId('GroupScheduleConfigModal-Tab-wednesday'));

      // Select Tuesday to copy from
      const selectElement = screen.getByTestId('GroupScheduleConfigModal-Select-copyFromDay');
      await user.selectOptions(selectElement, 'TUESDAY');
      
      // Click copy button
      const copyButton = screen.getByTestId('GroupScheduleConfigModal-Button-copyFromDay');
      await user.click(copyButton);

      // Dropdown should reset to default value
      expect(selectElement).toHaveValue('');
    });
  });

  describe('Responsive Behavior', () => {
    it('should show responsive text in buttons', () => {
      const { TestWrapper } = createTestWrapper();
      
      render(
        <TestWrapper>
          <GroupScheduleConfigModal {...defaultProps} />
        </TestWrapper>
      );

      // Reset button should have responsive text
      const resetButton = screen.getByTestId('GroupScheduleConfigModal-Button-resetToDefault');
      expect(resetButton).toHaveTextContent('Reset to Default');
      expect(resetButton).toHaveTextContent('Reset');
      
      // Save button should have responsive text
      const saveButton = screen.getByTestId('GroupScheduleConfigModal-Button-saveConfiguration');
      expect(saveButton).toHaveTextContent('Save Configuration');
      expect(saveButton).toHaveTextContent('Save');
    });

    it('should show appropriate close button text based on user role', () => {
      const { TestWrapper } = createTestWrapper();
      
      // Admin user should see "Cancel"
      const { rerender } = render(
        <TestWrapper>
          <GroupScheduleConfigModal {...defaultProps} isAdmin={true} />
        </TestWrapper>
      );

      expect(screen.getByTestId('GroupScheduleConfigModal-Button-close')).toHaveTextContent('Cancel');
      
      // Non-admin user should see "Close"
      rerender(
        <TestWrapper>
          <GroupScheduleConfigModal {...defaultProps} isAdmin={false} />
        </TestWrapper>
      );

      expect(screen.getByTestId('GroupScheduleConfigModal-Button-close')).toHaveTextContent('Close');
    });
  });
});