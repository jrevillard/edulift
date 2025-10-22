import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService, type ScheduleSlot, type Child, type GroupChildMembership, type ScheduleSlotVehicle } from '../services/apiService';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { SOCKET_EVENTS } from '../shared/events';
import { toast } from 'sonner';
import { getWeekdayInTimezone, getTimeInTimezone } from '../utils/timezoneUtils';

interface ChildAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  scheduleSlot: ScheduleSlot;
  preSelectedVehicleAssignmentId?: string; // Optional pre-selected vehicle
}

const ChildAssignmentModal: React.FC<ChildAssignmentModalProps> = ({
  isOpen,
  onClose,
  scheduleSlot,
  preSelectedVehicleAssignmentId
}) => {
  const { user } = useAuth(); // Get user for timezone
  const { socket } = useSocket();
  const queryClient = useQueryClient();
  
  const [selectedChild, setSelectedChild] = useState<string>('');
  const [selectedVehicleAssignment, setSelectedVehicleAssignment] = useState<string>('');
  const [currentScheduleSlotId, setCurrentScheduleSlotId] = useState<string | null>(null);
  const [slotWasDeleted, setSlotWasDeleted] = useState<boolean>(false);

  // Fetch all user's children (will be filtered for group membership)
  const { data: children = [], isLoading: loadingChildren, error: childrenError } = useQuery({
    queryKey: ['children'],
    queryFn: () => apiService.getChildren(),
    enabled: isOpen,
  });

  // Fetch fresh schedule slot details if we have a slot ID
  const { data: freshSlotData, isLoading: isFreshSlotLoading, error: freshSlotError, refetch: refetchSlotData } = useQuery({
    queryKey: ['schedule-slot', currentScheduleSlotId],
    queryFn: () => apiService.getScheduleSlotDetails(currentScheduleSlotId!),
    enabled: !!currentScheduleSlotId && 
             currentScheduleSlotId !== '' && 
             currentScheduleSlotId !== null &&
             !slotWasDeleted,
    retry: (failureCount, error) => {
      // Don't retry if slot was deleted (404)
      const axiosError = error as { response?: { status: number } };
      if (axiosError?.response?.status === 404) {
        setSlotWasDeleted(true);
        return false;
      }
      return failureCount < 3;
    },
    staleTime: 0, // Always refetch to get latest data
    refetchOnMount: true, // Allow automatic refetch when component mounts
  });

  // Initialize state when modal opens
  useEffect(() => {
    if (isOpen && scheduleSlot) {
      setCurrentScheduleSlotId(scheduleSlot.id);
    }
    setSelectedChild('');
    
    // Pre-select vehicle if provided
    if (preSelectedVehicleAssignmentId) {
      setSelectedVehicleAssignment(preSelectedVehicleAssignmentId);
    } else {
      setSelectedVehicleAssignment('');
    }
    
    setSlotWasDeleted(false); // Reset deleted state when modal opens
  }, [isOpen, scheduleSlot, preSelectedVehicleAssignmentId]);

  // Assign child mutation
  const assignChildMutation = useMutation({
    mutationFn: ({ scheduleSlotId, childId, vehicleAssignmentId }: { scheduleSlotId: string; childId: string; vehicleAssignmentId: string }) =>
      apiService.assignChildToScheduleSlot(scheduleSlotId, childId, vehicleAssignmentId),
    onSuccess: async () => {
      // Invalidate ALL weekly schedule queries for this group (all weeks)
      queryClient.invalidateQueries({ queryKey: ['weekly-schedule', scheduleSlot.groupId] });
      queryClient.invalidateQueries({ queryKey: ['schedule-slot', currentScheduleSlotId] });
      queryClient.invalidateQueries({ queryKey: ['children'] }); // Refresh children list

      // Manually refetch the schedule slot data to ensure modal updates immediately
      if (currentScheduleSlotId) {
        await refetchSlotData();
      }

      if (socket) {
        socket.emit(SOCKET_EVENTS.SCHEDULE_SLOT_UPDATED, { groupId: scheduleSlot.groupId, scheduleSlotId: currentScheduleSlotId });
      }
      setSelectedChild(''); // Reset child selection after successful assignment
      // Only reset vehicle selection if not in vehicle-specific mode
      if (!preSelectedVehicleAssignmentId) {
        setSelectedVehicleAssignment('');
      }
    },
    onError: (error) => {
      // Specific handling for 409 Conflict
      if (error.name === 'ConflictError') {
        toast.error(error.message, {
          duration: 6000,
          action: {
            label: 'Refresh',
            onClick: () => {
              // Refresh schedule data
              queryClient.invalidateQueries({ queryKey: ['weekly-schedule', scheduleSlot.groupId] });
              queryClient.invalidateQueries({ queryKey: ['schedule-slot', currentScheduleSlotId] });
              onClose();
            },
          },
        });
      } else {
        toast.error('Failed to assign children. Please try again.');
      }
    },
  });

  // Remove child mutation
  const removeChildMutation = useMutation({
    mutationFn: ({ scheduleSlotId, childId }: { scheduleSlotId: string; childId: string }) => 
      apiService.removeChildFromScheduleSlot(scheduleSlotId, childId),
    onSuccess: async (_, { scheduleSlotId }) => {
      // Invalidate ALL weekly schedule queries for this group (all weeks)
      queryClient.invalidateQueries({ queryKey: ['weekly-schedule', scheduleSlot.groupId] });
      // Also invalidate specific week queries
      queryClient.invalidateQueries({ queryKey: ['weekly-schedule', scheduleSlot.groupId] });
      queryClient.invalidateQueries({ queryKey: ['schedule-slot', currentScheduleSlotId] });
      queryClient.invalidateQueries({ queryKey: ['children'] }); // Refresh children list
      
      // Manually refetch the schedule slot data to ensure modal updates immediately
      if (currentScheduleSlotId) {
        await refetchSlotData();
      }
      
      if (socket) {
        socket.emit(SOCKET_EVENTS.SCHEDULE_SLOT_UPDATED, { groupId: scheduleSlot.groupId, scheduleSlotId });
      }
    },
  });

  const handleAddChild = async () => {
    if (!selectedChild || !currentScheduleSlotId || !selectedVehicleAssignment) {
      return;
    }

    try {
      const assignmentData = { 
        scheduleSlotId: currentScheduleSlotId, 
        childId: selectedChild,
        vehicleAssignmentId: selectedVehicleAssignment
      };
      
      await assignChildMutation.mutateAsync(assignmentData);
    } catch (error) {
      console.error('Failed to add child:', error);
    }
  };

  const handleRemoveChild = async (childId: string) => {
    if (!currentScheduleSlotId) return;

    try {
      await removeChildMutation.mutateAsync({ scheduleSlotId: currentScheduleSlotId, childId });
    } catch (error) {
      console.error('Failed to remove child:', error);
    }
  };

  // Handle schedule slot deletion (404 error) - use our state variable
  const axiosError = freshSlotError as { response?: { status: number } } | null;
  const isSlotDeleted = slotWasDeleted || axiosError?.response?.status === 404;
  
  // Get the current schedule slot data (fresh data takes precedence over scheduleSlot prop)
  const shouldWaitForFreshData = currentScheduleSlotId && !freshSlotData && isFreshSlotLoading && !isSlotDeleted;
  const currentSlot = isSlotDeleted ? null : (shouldWaitForFreshData ? null : (freshSlotData || scheduleSlot));

  // Reset slot ID when slot gets deleted
  useEffect(() => {
    if (isSlotDeleted) {
      setCurrentScheduleSlotId(null);
    }
  }, [isSlotDeleted]);


  // Get available children (not already assigned to this schedule slot and are members of the group)
  const getAvailableChildren = () => {
    if (!currentSlot || !scheduleSlot?.groupId) return [];
    
    // Filter children who are members of the current group
    const groupChildren = children.filter((child: Child) => 
      child.groupMemberships?.some((membership: GroupChildMembership) => membership.groupId === scheduleSlot.groupId)
    );
    
    // Filter out children already assigned to this schedule slot
    const assignedChildIds = currentSlot.childAssignments?.map((ca) => ca.child.id) || [];
    return groupChildren.filter((child: Child) => !assignedChildIds.includes(child.id));
  };

  const availableChildren = getAvailableChildren();
  
  // Calculate capacity based on whether we're in vehicle-specific mode or not
  let totalCapacity = 0;
  let currentOccupancy = 0;
  
  if (preSelectedVehicleAssignmentId && currentSlot) {
    // Vehicle-specific mode: show capacity for the selected vehicle only
    const selectedVehicleAssignment = currentSlot.vehicleAssignments?.find(
      (va: ScheduleSlotVehicle) => va.id === preSelectedVehicleAssignmentId
    );
    
    if (selectedVehicleAssignment) {
      totalCapacity = selectedVehicleAssignment.vehicle.capacity;
      // Count only children assigned to this specific vehicle
      currentOccupancy = currentSlot.childAssignments?.filter(
        (ca) => ca.vehicleAssignmentId === preSelectedVehicleAssignmentId
      ).length || 0;
    }
  } else {
    // General mode: show total capacity for all vehicles
    totalCapacity = currentSlot?.totalCapacity || 0;
    currentOccupancy = currentSlot?.childAssignments?.length || 0;
  }
  
  const remainingCapacity = totalCapacity - currentOccupancy;


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" data-testid="ChildAssignmentModal-Container-modal">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold flex items-center space-x-2" data-testid="ChildAssignmentModal-Title-modalTitle">
            {currentSlot?.vehicleAssignments?.length === 1 ? (
              <>
                <span className="text-blue-600">🚗</span>
                <div>
                  <div className="flex items-center space-x-2">
                    <span data-testid="ChildAssignmentModal-Text-singleVehicleName">{currentSlot.vehicleAssignments[0].vehicle.name}</span>
                    <span className="text-sm text-gray-500">- {getWeekdayInTimezone(scheduleSlot.datetime, user?.timezone)} at {getTimeInTimezone(scheduleSlot.datetime, user?.timezone)}</span>
                  </div>
                  {currentSlot.vehicleAssignments[0].driver && (
                    <div className="text-sm font-normal text-gray-600" data-testid="ChildAssignmentModal-Text-singleVehicleDriver">
                      Driver: {currentSlot.vehicleAssignments[0].driver.name}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <span className="text-blue-600">👥</span>
                <span data-testid="ChildAssignmentModal-Text-manageChildrenTitle">Manage Children - {getWeekdayInTimezone(scheduleSlot.datetime, user?.timezone)} at {getTimeInTimezone(scheduleSlot.datetime, user?.timezone)}</span>
              </>
            )}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
            data-testid="ChildAssignmentModal-Button-closeModal"
          >
            ✕
          </button>
        </div>

        {/* Vehicle Selection or Display - Moved to very top */}
        {preSelectedVehicleAssignmentId && currentSlot && (
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-700 mb-1" data-testid="ChildAssignmentModal-Label-addingToVehicle">Adding to Vehicle</label>
            {(() => {
              const selectedVehicle = currentSlot.vehicleAssignments?.find((va: ScheduleSlotVehicle) => 
                va.id === preSelectedVehicleAssignmentId
              );
              if (!selectedVehicle) return null;
              
              return (
                <div className="w-full p-3 border border-gray-200 rounded">
                  <div className="flex items-center justify-between text-base">
                    <div className="flex items-center space-x-2">
                      <span>🚗</span>
                      <span className="font-medium" data-testid="ChildAssignmentModal-Text-selectedVehicleName">{selectedVehicle.vehicle.name}</span>
                    </div>
                    {selectedVehicle.driver && (
                      <div className="text-gray-600" data-testid="ChildAssignmentModal-Text-selectedVehicleDriver">
                        Driver: {selectedVehicle.driver.name}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Capacity info */}
        {totalCapacity > 0 && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded" data-testid="ChildAssignmentModal-Container-capacityIndicator">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-blue-800" data-testid="ChildAssignmentModal-Text-capacityText">{currentOccupancy}/{totalCapacity} seats</span>
              <span className="text-xs text-blue-600" data-testid="ChildAssignmentModal-Text-remainingCapacity">{remainingCapacity} remaining</span>
            </div>
            <div className="w-full bg-white/50 rounded-full h-2">
              <div 
                className="bg-blue-400 h-2 rounded-full transition-all"
                style={{ width: `${Math.min((currentOccupancy / totalCapacity) * 100, 100)}%` }}
                data-testid="ChildAssignmentModal-Bar-capacityBar"
              ></div>
            </div>
          </div>
        )}

        {/* Error handling */}
        {childrenError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
            <div className="text-sm text-red-800">
              ⚠️ Failed to load available children. Please try again.
            </div>
          </div>
        )}

        {/* Capacity warning */}
        {remainingCapacity <= 0 && availableChildren.length > 0 && (
          <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded" data-testid="ChildAssignmentModal-Alert-capacityWarning">
            <div className="text-sm text-orange-800">
              ⚠️ No remaining capacity. Remove children before adding new ones.
            </div>
          </div>
        )}

        {/* Loading indicator for fresh slot data */}
        {shouldWaitForFreshData && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-sm text-gray-600">Loading schedule slot details...</span>
          </div>
        )}

        {loadingChildren && (
          <div className="flex items-center justify-center py-8" data-testid="ChildAssignmentModal-Container-loadingChildren">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-sm text-gray-600">Loading children...</span>
          </div>
        )}

        {!shouldWaitForFreshData && !loadingChildren && (
          <div className="space-y-6">
            {/* Currently Assigned Children */}
            {(() => {
              // Filter children based on whether we're in vehicle-specific mode
              const displayedChildAssignments = preSelectedVehicleAssignmentId && currentSlot
                ? currentSlot.childAssignments?.filter(
                    (ca) => ca.vehicleAssignmentId === preSelectedVehicleAssignmentId
                  ) || []
                : currentSlot?.childAssignments || [];
              
              return displayedChildAssignments.length > 0 && (
                <div data-testid="ChildAssignmentModal-List-assignedChildren">
                  <h4 className="text-sm font-medium text-gray-700 mb-3" data-testid="ChildAssignmentModal-Heading-assignedChildren">Currently Assigned Children</h4>
                  <div className="space-y-2">
                    {displayedChildAssignments.map((childAssignment) => (
                    <div key={childAssignment.child.id} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded" data-testid={`assigned-child-${childAssignment.child.id}`}>
                      <div className="flex items-center space-x-3">
                        <span className="text-blue-600">👥</span>
                        <div>
                          <div className="font-medium text-sm" data-testid={`child-name-${childAssignment.child.id}`}>{childAssignment.child.name}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveChild(childAssignment.child.id)}
                        disabled={removeChildMutation.isPending}
                        className="px-3 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200 disabled:opacity-50"
                        data-testid={`remove-child-button-${childAssignment.child.id}`}
                      >
                        {removeChildMutation.isPending ? 'Removing...' : 'Remove'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              );
            })()}


            {/* Add Child Section */}
            {availableChildren.length > 0 && currentSlot?.vehicleAssignments && currentSlot.vehicleAssignments.length > 0 && (
              <div data-testid="ChildAssignmentModal-Section-addChild">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Add Child</h4>
                <div className="space-y-3">
                  {/* Child Selection */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Select Child</label>
                    <select
                      value={selectedChild}
                      onChange={(e) => setSelectedChild(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      data-testid="ChildAssignmentModal-Select-child"
                      role="combobox"
                    >
                      <option value="">Choose a child...</option>
                      {availableChildren.map((child: Child) => (
                        <option key={child.id} value={child.id} data-testid={`child-option-${child.id}`}>
                          👥 {child.name} {child.age && `(${child.age} years old)`}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Vehicle Selection - Only show if no vehicle is pre-selected */}
                  {!preSelectedVehicleAssignmentId && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1" data-testid="ChildAssignmentModal-Label-vehicleSelect">Select Vehicle</label>
                      <select
                        value={selectedVehicleAssignment}
                        onChange={(e) => setSelectedVehicleAssignment(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        data-testid="ChildAssignmentModal-Select-vehicle"
                      >
                        <option value="">Choose a vehicle...</option>
                        {currentSlot.vehicleAssignments.map((vehicleAssignment: ScheduleSlotVehicle) => {
                          const vehicleChildren = currentSlot.childAssignments.filter((ca) => 
                            ca.vehicleAssignmentId === vehicleAssignment.id
                          );
                          const availableSeats = vehicleAssignment.vehicle.capacity - vehicleChildren.length;
                          const isVehicleFull = availableSeats <= 0;
                          
                          return (
                            <option 
                              key={vehicleAssignment.id} 
                              value={vehicleAssignment.id}
                              disabled={isVehicleFull}
                              data-testid={`vehicle-option-${vehicleAssignment.id}`}
                            >
                              🚗 {vehicleAssignment.vehicle.name} 
                              {isVehicleFull ? ' (Full)' : ` (${availableSeats} seats available)`}
                              {vehicleAssignment.driver && ` - Driver: ${vehicleAssignment.driver.name}`}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}
                  
                  <button
                    onClick={handleAddChild}
                    disabled={!selectedChild || !selectedVehicleAssignment || assignChildMutation.isPending || remainingCapacity <= 0}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    data-testid="ChildAssignmentModal-Button-addChild"
                  >
                    {assignChildMutation.isPending ? 'Adding Child...' : 
                     preSelectedVehicleAssignmentId ? 'Add Child to This Vehicle' : 'Add Child to Vehicle'}
                  </button>
                </div>
              </div>
            )}

            {/* No Available Children */}
            {availableChildren.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                {children.length === 0 ? (
                  <div>
                    <p className="mb-2">You haven't added any children yet.</p>
                    <p className="text-sm">Add children in the Children page and add them to this group.</p>
                  </div>
                ) : children.filter((child: Child) => child.groupMemberships?.some((membership: GroupChildMembership) => membership.groupId === scheduleSlot?.groupId)).length === 0 ? (
                  <div>
                    <p className="mb-2">No children are members of this group.</p>
                    <p className="text-sm">Add your children to this group to assign them to trips.</p>
                  </div>
                ) : (
                  <p>All children in this group are already assigned to this time slot.</p>
                )}
              </div>
            )}

            {/* No capacity */}
            {remainingCapacity <= 0 && currentOccupancy > 0 && (
              <div className="text-center py-8 text-gray-500">
                <p>No remaining capacity. Remove children to add new ones.</p>
              </div>
            )}
          </div>
        )}

        {/* Close button */}
        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
            data-testid="ChildAssignmentModal-Button-close"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChildAssignmentModal;