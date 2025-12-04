import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render, mockVehicle, createMockOpenAPIClient, createMockFamilyContext } from '../../test/test-utils'
import VehiclesPage from '../VehiclesPage'
import { api } from '../../services/api'
import * as usePageStateModule from '../../hooks/usePageState'
import { useFamily } from '../../contexts/FamilyContext'
import '@testing-library/jest-dom'

// Mock the API service
vi.mock('../../services/api')
const mockApi = api as unknown;

// Mock the connection store
vi.mock('../../stores/connectionStore', () => {
  const mockStore = {
    apiStatus: 'connected',
    isConnected: () => true,
    hasConnectionIssues: () => false,
    setApiStatus: vi.fn(),
    setConnected: vi.fn()
  };
  
  // Create a function that acts like both a hook and has getState
  const mockUseConnectionStore = vi.fn(() => mockStore);
  mockUseConnectionStore.getState = vi.fn(() => mockStore);
  
  return {
    useConnectionStore: mockUseConnectionStore
  };
})

// Mock the shared hook
vi.mock('../../hooks/usePageState', () => ({
  usePageState: vi.fn(),
}))

// Mock the FamilyContext to prevent real API calls
vi.mock('../../contexts/FamilyContext', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useFamily: vi.fn(),
  }
})

const mockUsePageState = vi.mocked(usePageStateModule.usePageState)
const mockUseFamily = vi.mocked(useFamily)

describe('VehiclesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Apply comprehensive OpenAPI client mocks
    const comprehensiveMocks = createMockOpenAPIClient();
    Object.assign(mockApi, comprehensiveMocks);
    
    // Setup FamilyContext mock
    mockUseFamily.mockReturnValue(createMockFamilyContext());
    
    // Default mock for usePageState
    mockUsePageState.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      isEmpty: true,
      shouldShowLoading: false,
      shouldShowError: false,
      shouldShowEmpty: true,
    })
  })

  it('renders vehicles page correctly', async () => {
    render(<VehiclesPage />)
    
    await waitFor(() => {
      expect(screen.getByTestId('VehiclesPage-Title-pageTitle')).toBeInTheDocument()
    })
    
    expect(screen.getByTestId('VehiclesPage-Title-pageTitle-title')).toBeInTheDocument()
    // Should have Add Vehicle button in header
    expect(screen.getByTestId('VehiclesPage-Button-addVehicle')).toBeInTheDocument()
  })

  it('displays loading state', () => {
    mockUsePageState.mockReturnValue({
      data: [],
      isLoading: true,
      error: null,
      isEmpty: true,
      shouldShowLoading: true,
      shouldShowError: false,
      shouldShowEmpty: false,
    })
    
    render(<VehiclesPage />)
    
    expect(screen.getByTestId('VehiclesPage-Container-loading')).toBeInTheDocument()
  })

  it('displays empty state when no vehicles', async () => {
    // Default mock already returns shouldShowEmpty: true
    render(<VehiclesPage />)
    
    await waitFor(() => {
      expect(screen.getByTestId('EmptyVehicles-content')).toBeInTheDocument()
    })
  })

  it('displays vehicles list when vehicles exist', async () => {
    const vehicles = [
      { ...mockVehicle, id: '1', name: 'Car 1', capacity: 5 },
      { ...mockVehicle, id: '2', name: 'Car 2', capacity: 7 },
    ]
    
    mockUsePageState.mockReturnValue({
      data: vehicles,
      isLoading: false,
      error: null,
      isEmpty: false,
      shouldShowLoading: false,
      shouldShowError: false,
      shouldShowEmpty: false,
    })
    
    render(<VehiclesPage />)
    
    await waitFor(() => {
      expect(screen.getByTestId('VehiclesPage-Text-vehicleName-1')).toBeInTheDocument()
      expect(screen.getByTestId('VehiclesPage-Text-vehicleName-2')).toBeInTheDocument()
      expect(screen.getByTestId('VehiclesPage-Text-vehicleCapacity-1')).toBeInTheDocument()
      expect(screen.getByTestId('VehiclesPage-Text-vehicleCapacity-2')).toBeInTheDocument()
    })
  })

  it('opens add vehicle modal when add button is clicked', async () => {
    const user = userEvent.setup()
    
    render(<VehiclesPage />)
    
    // Get the Add Vehicle button from header
    const addButton = screen.getByTestId('VehiclesPage-Button-addVehicle')
    await user.click(addButton)
    
    expect(screen.getByTestId('VehiclesPage-Title-vehicleModalTitle')).toBeInTheDocument()
    expect(screen.getByTestId('VehiclesPage-Input-vehicleName')).toBeInTheDocument()
    expect(screen.getByTestId('VehiclesPage-Input-vehicleCapacity')).toBeInTheDocument()
  })

  it('creates a new vehicle successfully', async () => {
    const user = userEvent.setup()
    mockApi.POST.mockResolvedValueOnce({ data: mockVehicle })
    
    render(<VehiclesPage />)
    
    const addButton = screen.getByTestId('VehiclesPage-Button-addVehicle')
    await user.click(addButton)
    
    const nameInput = screen.getByTestId('VehiclesPage-Input-vehicleName')
    const capacityInput = screen.getByTestId('VehiclesPage-Input-vehicleCapacity')
    const submitButton = screen.getByTestId('VehiclesPage-Button-submitVehicle')
    
    await user.type(nameInput, 'Test Vehicle')
    await user.clear(capacityInput)
    await user.type(capacityInput, '5')
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(mockApi.POST).toHaveBeenCalledWith('/vehicles', { body: { name: 'Test Vehicle', capacity: 5 } })
    })
  })

  it('validates vehicle form inputs', async () => {
    const user = userEvent.setup()
    
    render(<VehiclesPage />)
    
    const addButton = screen.getByTestId('VehiclesPage-Button-addVehicle')
    await user.click(addButton)
    
    const submitButton = screen.getByTestId('VehiclesPage-Button-submitVehicle')
    await user.click(submitButton)
    
    // Form should require name and capacity
    const nameInput = screen.getByTestId('VehiclesPage-Input-vehicleName')
    const capacityInput = screen.getByTestId('VehiclesPage-Input-vehicleCapacity')
    
    expect(nameInput).toBeRequired()
    expect(capacityInput).toBeRequired()
  })

  it('opens edit modal when edit button is clicked', async () => {
    const user = userEvent.setup()
    const vehicles = [mockVehicle]
    
    mockUsePageState.mockReturnValue({
      data: vehicles,
      isLoading: false,
      error: null,
      isEmpty: false,
      shouldShowLoading: false,
      shouldShowError: false,
      shouldShowEmpty: false,
    })
    
    render(<VehiclesPage />)
    
    await waitFor(() => {
      expect(screen.getByTestId(`VehiclesPage-Text-vehicleName-${mockVehicle.id}`)).toBeInTheDocument()
    })
    
    const editButton = screen.getByTestId(`VehiclesPage-Button-editVehicle-${mockVehicle.id}`)
    await user.click(editButton)
    
    expect(screen.getByTestId('VehiclesPage-Title-vehicleModalTitle')).toBeInTheDocument()
    expect(screen.getByTestId('VehiclesPage-Input-vehicleName')).toHaveValue(mockVehicle.name)
    expect(screen.getByTestId('VehiclesPage-Input-vehicleCapacity')).toHaveValue(mockVehicle.capacity)
  })

  it('updates vehicle successfully', async () => {
    const user = userEvent.setup()
    const vehicles = [mockVehicle]
    
    mockUsePageState.mockReturnValue({
      data: vehicles,
      isLoading: false,
      error: null,
      isEmpty: false,
      shouldShowLoading: false,
      shouldShowError: false,
      shouldShowEmpty: false,
    })
    
    mockApi.PATCH.mockResolvedValueOnce({ data: { ...mockVehicle, name: 'Updated Vehicle' } })
    
    render(<VehiclesPage />)
    
    await waitFor(() => {
      expect(screen.getByTestId(`VehiclesPage-Text-vehicleName-${mockVehicle.id}`)).toBeInTheDocument()
    })
    
    const editButton = screen.getByTestId(`VehiclesPage-Button-editVehicle-${mockVehicle.id}`)
    await user.click(editButton)
    
    const nameInput = screen.getByTestId('VehiclesPage-Input-vehicleName')
    const updateButton = screen.getByTestId('VehiclesPage-Button-submitVehicle')
    
    await user.clear(nameInput)
    await user.type(nameInput, 'Updated Vehicle')
    await user.click(updateButton)
    
    await waitFor(() => {
      expect(mockApi.PATCH).toHaveBeenCalledWith(
        '/vehicles/{vehicleId}',
        {
          params: { path: { vehicleId: mockVehicle.id } },
          body: { name: 'Updated Vehicle', capacity: mockVehicle.capacity }
        }
      )
    })
  })

  it('deletes vehicle with confirmation', async () => {
    const user = userEvent.setup()
    const vehicles = [mockVehicle]
    
    mockUsePageState.mockReturnValue({
      data: vehicles,
      isLoading: false,
      error: null,
      isEmpty: false,
      shouldShowLoading: false,
      shouldShowError: false,
      shouldShowEmpty: false,
    })
    
    mockApi.DELETE.mockResolvedValueOnce({})
    
    render(<VehiclesPage />)
    
    await waitFor(() => {
      expect(screen.getByTestId(`VehiclesPage-Text-vehicleName-${mockVehicle.id}`)).toBeInTheDocument()
    })
    
    const deleteButton = screen.getByTestId(`VehiclesPage-Button-deleteVehicle-${mockVehicle.id}`)
    await user.click(deleteButton)
    
    // Confirm dialog should appear
    await waitFor(() => {
      expect(screen.getByTestId('ConfirmationDialog-Title-dialog')).toHaveTextContent('Delete Vehicle')
      expect(screen.getByTestId('ConfirmationDialog-Description-dialog')).toHaveTextContent(`Are you sure you want to delete ${mockVehicle.name}? This action cannot be undone.`)
    })
    
    // Click confirm button
    const confirmButton = screen.getByTestId('ConfirmationDialog-Button-confirm')
    await user.click(confirmButton)
    
    await waitFor(() => {
      expect(mockApi.DELETE).toHaveBeenCalledWith('/vehicles/{vehicleId}', {
      params: { path: { vehicleId: mockVehicle.id } }
    })
    })
  })

  it('cancels delete when user declines confirmation', async () => {
    const user = userEvent.setup()
    const vehicles = [mockVehicle]
    
    mockUsePageState.mockReturnValue({
      data: vehicles,
      isLoading: false,
      error: null,
      isEmpty: false,
      shouldShowLoading: false,
      shouldShowError: false,
      shouldShowEmpty: false,
    })
    
    render(<VehiclesPage />)
    
    await waitFor(() => {
      expect(screen.getByTestId(`VehiclesPage-Text-vehicleName-${mockVehicle.id}`)).toBeInTheDocument()
    })
    
    const deleteButton = screen.getByTestId(`VehiclesPage-Button-deleteVehicle-${mockVehicle.id}`)
    await user.click(deleteButton)
    
    // Confirm dialog should appear
    await waitFor(() => {
      expect(screen.getByTestId('ConfirmationDialog-Title-dialog')).toHaveTextContent('Delete Vehicle')
    })
    
    // Click cancel button
    const cancelButton = screen.getByTestId('ConfirmationDialog-Button-cancel')
    await user.click(cancelButton)
    
    // Dialog should disappear and delete should not be called
    await waitFor(() => {
      expect(screen.queryByTestId('ConfirmationDialog-Title-dialog')).not.toBeInTheDocument()
    })
    expect(mockApi.DELETE).not.toHaveBeenCalled()
  })

  it('closes modal when cancel button is clicked', async () => {
    const user = userEvent.setup()
    
    render(<VehiclesPage />)
    
    const addButton = screen.getByTestId('VehiclesPage-Button-addVehicle')
    await user.click(addButton)
    
    expect(screen.getByTestId('VehiclesPage-Title-vehicleModalTitle')).toBeInTheDocument()
    
    const cancelButton = screen.getByTestId('VehiclesPage-Button-cancelVehicle')
    await user.click(cancelButton)
    
    expect(screen.queryByTestId('vehicle-modal-title')).not.toBeInTheDocument()
  })
})