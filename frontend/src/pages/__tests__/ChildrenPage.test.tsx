import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render, mockChild, createMockApiService, createMockFamilyContext } from '../../test/test-utils'
import ChildrenPage from '../ChildrenPage'
import * as apiService from '../../services/apiService'
import * as usePageStateModule from '../../hooks/usePageState'
import { useFamily } from '../../contexts/FamilyContext'
import '@testing-library/jest-dom'

// Mock the API service
vi.mock('../../services/apiService')
const mockApiService = apiService.apiService as unknown;

// Mock the connection store
vi.mock('../../stores/connectionStore', () => {
  const mockStore = {
    apiStatus: 'connected',
    isConnected: () => true,
    hasConnectionIssues: () => false,
    setApiStatus: vi.fn(),
    setConnected: vi.fn()
  };
  
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

describe('ChildrenPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Apply comprehensive API service mocks
    const comprehensiveMocks = createMockApiService();
    Object.assign(mockApiService, comprehensiveMocks);
    
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

  it('renders children page correctly', async () => {
    mockApiService.getChildren.mockResolvedValueOnce([])
    
    render(<ChildrenPage />)
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.getByTestId('ChildrenPage-Title-pageTitle')).toBeInTheDocument()
    })
    
    expect(screen.getByTestId('ChildrenPage-Title-pageTitle')).toBeInTheDocument()
    const addButton = screen.getByTestId('ChildrenPage-Button-addChild')
    expect(addButton).toBeInTheDocument()
  })

  it('displays loading state', () => {
    mockUsePageState.mockReturnValue({
      data: [],
      isLoading: true,
      error: null,
      isEmpty: false,
      shouldShowLoading: true,
      shouldShowError: false,
      shouldShowEmpty: false,
    })
    
    render(<ChildrenPage />)
    
    expect(screen.getByTestId('ChildrenPage-Container-loading')).toBeInTheDocument()
  })

  it('displays empty state when no children', async () => {
    mockApiService.getChildren.mockResolvedValueOnce([])
    
    render(<ChildrenPage />)
    
    await waitFor(() => {
      expect(screen.getByTestId('ChildrenPage-Container-emptyState')).toBeInTheDocument()
    })
  })

  it('displays children list when children exist', async () => {
    const children = [
      { ...mockChild, id: '1', name: 'Alice', age: 8, groupMemberships: [] },
      { ...mockChild, id: '2', name: 'Bob', age: 10, groupMemberships: [] },
    ]
    mockUsePageState.mockReturnValue({
      data: children,
      isLoading: false,
      error: null,
      isEmpty: false,
      shouldShowLoading: false,
      shouldShowError: false,
      shouldShowEmpty: false,
    })
    
    render(<ChildrenPage />)
    
    await waitFor(() => {
      // Look for child names in card titles specifically
      expect(screen.getByTestId('ChildrenPage-Text-childName-1')).toHaveTextContent('Alice')
      expect(screen.getByTestId('ChildrenPage-Text-childName-2')).toHaveTextContent('Bob')
      expect(screen.getByTestId('ChildrenPage-Text-childAge-1')).toHaveTextContent('Age: 8')
      expect(screen.getByTestId('ChildrenPage-Text-childAge-2')).toHaveTextContent('Age: 10')
    })
  })

  it('displays children without age correctly', async () => {
    const children = [
      { ...mockChild, id: '1', name: 'Alice', age: undefined, groupMemberships: [] },
    ]
    mockUsePageState.mockReturnValue({
      data: children,
      isLoading: false,
      error: null,
      isEmpty: false,
      shouldShowLoading: false,
      shouldShowError: false,
      shouldShowEmpty: false,
    })
    
    render(<ChildrenPage />)
    
    await waitFor(() => {
      expect(screen.getByTestId('ChildrenPage-Text-childName-1')).toHaveTextContent('Alice')
      expect(screen.queryByTestId('ChildrenPage-Text-childAge-1')).not.toBeInTheDocument()
    })
  })

  it('opens add child modal when add button is clicked', async () => {
    const user = userEvent.setup()
    mockApiService.getChildren.mockResolvedValueOnce([])
    
    render(<ChildrenPage />)
    
    // Wait for loading to complete and find the button
    await waitFor(() => {
      expect(screen.getByTestId('ChildrenPage-Button-addChild')).toBeInTheDocument()
    })
    
    // Get the Add Child button
    const addButton = screen.getByTestId('ChildrenPage-Button-addChild')
    await user.click(addButton)
    
    expect(screen.getByTestId('ChildrenPage-Title-childModalTitle')).toBeInTheDocument()
    expect(screen.getByTestId('ChildrenPage-Input-childName')).toBeInTheDocument()
    expect(screen.getByTestId('ChildrenPage-Input-childAge')).toBeInTheDocument()
  })

  it('creates a new child successfully', async () => {
    const user = userEvent.setup()
    mockApiService.getChildren.mockResolvedValue([])
    mockApiService.createChild.mockResolvedValueOnce(mockChild)
    
    render(<ChildrenPage />)
    
    // Wait for loading to complete and find the button
    await waitFor(() => {
      expect(screen.getByTestId('ChildrenPage-Button-addChild')).toBeInTheDocument()
    })
    
    // Get the Add Child button
    const addButton = screen.getByTestId('ChildrenPage-Button-addChild')
    await user.click(addButton)
    
    const nameInput = screen.getByTestId('ChildrenPage-Input-childName')
    const ageInput = screen.getByTestId('ChildrenPage-Input-childAge')
    const submitButton = screen.getByTestId('ChildrenPage-Button-submitChild')
    
    await user.type(nameInput, 'Test Child')
    await user.type(ageInput, '10')
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(mockApiService.createChild).toHaveBeenCalledWith('Test Child', 10)
    })
  })

  it('creates a child without age', async () => {
    const user = userEvent.setup()
    mockApiService.getChildren.mockResolvedValue([])
    mockApiService.createChild.mockResolvedValueOnce({ ...mockChild, age: undefined })
    
    render(<ChildrenPage />)
    
    // Wait for loading to complete and find the button
    await waitFor(() => {
      expect(screen.getByTestId('ChildrenPage-Button-addChild')).toBeInTheDocument()
    })
    
    // Get the Add Child button
    const addButton = screen.getByTestId('ChildrenPage-Button-addChild')
    await user.click(addButton)
    
    const nameInput = screen.getByTestId('ChildrenPage-Input-childName')
    const submitButton = screen.getByTestId('ChildrenPage-Button-submitChild')
    
    await user.type(nameInput, 'Test Child')
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(mockApiService.createChild).toHaveBeenCalledWith('Test Child', undefined)
    })
  })

  it('validates child form inputs', async () => {
    const user = userEvent.setup()
    mockApiService.getChildren.mockResolvedValueOnce([])
    
    render(<ChildrenPage />)
    
    // Wait for loading to complete and find the button
    await waitFor(() => {
      expect(screen.getByTestId('ChildrenPage-Button-addChild')).toBeInTheDocument()
    })
    
    // Get the Add Child button
    const addButton = screen.getByTestId('ChildrenPage-Button-addChild')
    await user.click(addButton)
    
    const submitButton = screen.getByTestId('ChildrenPage-Button-submitChild')
    await user.click(submitButton)
    
    // Form should require name
    const nameInput = screen.getByTestId('ChildrenPage-Input-childName')
    expect(nameInput).toBeRequired()
  })

  it('opens edit modal when edit button is clicked', async () => {
    const user = userEvent.setup()
    const children = [{ ...mockChild, groupMemberships: [] }]
    mockUsePageState.mockReturnValue({
      data: children,
      isLoading: false,
      error: null,
      isEmpty: false,
      shouldShowLoading: false,
      shouldShowError: false,
      shouldShowEmpty: false,
    })
    
    render(<ChildrenPage />)
    
    await waitFor(() => {
      expect(screen.getByTestId(`ChildrenPage-Text-childName-${mockChild.id}`)).toHaveTextContent(mockChild.name)
    })
    
    const editButton = screen.getByTestId(`ChildrenPage-Button-editChild-${mockChild.id}`)
    await user.click(editButton)
    
    expect(screen.getByTestId('ChildrenPage-Title-childModalTitle')).toBeInTheDocument()
    expect(screen.getByDisplayValue(mockChild.name)).toBeInTheDocument()
    if (mockChild.age) {
      expect(screen.getByDisplayValue(mockChild.age.toString())).toBeInTheDocument()
    }
  })

  it('updates child successfully', async () => {
    const user = userEvent.setup()
    const children = [{ ...mockChild, groupMemberships: [] }]
    mockUsePageState.mockReturnValue({
      data: children,
      isLoading: false,
      error: null,
      isEmpty: false,
      shouldShowLoading: false,
      shouldShowError: false,
      shouldShowEmpty: false,
    })
    mockApiService.updateChild.mockResolvedValueOnce({ ...mockChild, name: 'Updated Child' })
    
    render(<ChildrenPage />)
    
    await waitFor(() => {
      expect(screen.getByTestId(`ChildrenPage-Text-childName-${mockChild.id}`)).toHaveTextContent(mockChild.name)
    })
    
    const editButton = screen.getByTestId(`ChildrenPage-Button-editChild-${mockChild.id}`)
    await user.click(editButton)
    
    const nameInput = screen.getByDisplayValue(mockChild.name)
    const updateButton = screen.getByTestId('ChildrenPage-Button-submitChild')
    
    await user.clear(nameInput)
    await user.type(nameInput, 'Updated Child')
    await user.click(updateButton)
    
    await waitFor(() => {
      expect(mockApiService.updateChild).toHaveBeenCalledWith(
        mockChild.id,
        { name: 'Updated Child', age: mockChild.age }
      )
    })
  })

  it('deletes child with confirmation', async () => {
    const user = userEvent.setup()
    const children = [{ ...mockChild, groupMemberships: [] }]
    mockUsePageState.mockReturnValue({
      data: children,
      isLoading: false,
      error: null,
      isEmpty: false,
      shouldShowLoading: false,
      shouldShowError: false,
      shouldShowEmpty: false,
    })
    mockApiService.deleteChild.mockResolvedValueOnce(undefined)
    
    render(<ChildrenPage />)
    
    await waitFor(() => {
      expect(screen.getByTestId(`ChildrenPage-Text-childName-${mockChild.id}`)).toHaveTextContent(mockChild.name)
    })
    
    const deleteButton = screen.getByTestId(`ChildrenPage-Button-deleteChild-${mockChild.id}`)
    await user.click(deleteButton)
    
    // Confirm dialog should appear
    await waitFor(() => {
      expect(screen.getByTestId('ConfirmationDialog-Title-dialog')).toHaveTextContent('Delete Child')
      expect(screen.getByTestId('ConfirmationDialog-Description-dialog')).toHaveTextContent(`Are you sure you want to delete ${mockChild.name}? This action cannot be undone.`)
    })
    
    // Click confirm button
    const confirmButton = screen.getByTestId('ConfirmationDialog-Button-confirm')
    await user.click(confirmButton)
    
    await waitFor(() => {
      expect(mockApiService.deleteChild).toHaveBeenCalledWith(mockChild.id)
    })
  })

  it('handles age input validation', async () => {
    const user = userEvent.setup()
    mockApiService.getChildren.mockResolvedValueOnce([])
    
    render(<ChildrenPage />)
    
    // Wait for loading to complete and find the button
    await waitFor(() => {
      expect(screen.getByTestId('ChildrenPage-Button-addChild')).toBeInTheDocument()
    })
    
    // Get the Add Child button
    const addButton = screen.getByTestId('ChildrenPage-Button-addChild')
    await user.click(addButton)
    
    const ageInput = screen.getByTestId('ChildrenPage-Input-childAge')
    
    expect(ageInput).toHaveAttribute('min', '0')
    expect(ageInput).toHaveAttribute('max', '18')
  })
})