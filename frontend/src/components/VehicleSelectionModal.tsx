import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../services/apiService';
import type { ScheduleSlot, Vehicle } from '../services/apiService';
import { getEffectiveCapacity, hasSeatOverride } from '../utils/capacity';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { VEHICLE_CONSTRAINTS } from '../constants/vehicle';
import { SOCKET_EVENTS } from '../shared/events';

interface VehicleSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  scheduleSlotId: string;
  existingScheduleSlot?: ScheduleSlot;
  groupId: string;
  day: string;
  time: string;
  week: string;
}

const VehicleSelectionModal: React.FC<VehicleSelectionModalProps> = ({
  isOpen,
  onClose,
  scheduleSlotId,
  existingScheduleSlot,
  groupId,
  day,
  time,
  week
}) => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const queryClient = useQueryClient();
  
  const [selectedVehicle, setSelectedVehicle] = useState<string>('');
  const [seatOverride, setSeatOverride] = useState<number | ''>('');
  const [currentScheduleSlotId, setCurrentScheduleSlotId] = useState<string | null>(null);
  const [slotWasDeleted, setSlotWasDeleted] = useState<boolean>(false);

  // Fetch user's vehicles
  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => apiService.getVehicles(),
  });

  // Fetch fresh schedule slot details if we have a slot ID
  const { data: freshSlotData, isLoading: isFreshSlotLoading, error: freshSlotError } = useQuery({
    queryKey: ['schedule-slot', currentScheduleSlotId],
    queryFn: () => apiService.getScheduleSlotDetails(currentScheduleSlotId!),
    enabled: !!currentScheduleSlotId && 
             currentScheduleSlotId !== '' && 
             currentScheduleSlotId !== null &&
             !slotWasDeleted,
    retry: (failureCount, error: unknown) => {
      // Don't retry if slot was deleted (404)
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { status?: number } };
        if (axiosError.response?.status === 404) {
          setSlotWasDeleted(true);
          return false;
        }
      }
      return failureCount < 3;
    },
    staleTime: 0, // Always refetch to get latest data
    refetchOnMount: false, // Don't automatically refetch when component mounts
  });

  // Initialize state when modal opens
  useEffect(() => {
    if (isOpen && existingScheduleSlot) {
      setCurrentScheduleSlotId(existingScheduleSlot.id);
    } else if (isOpen && scheduleSlotId) {
      setCurrentScheduleSlotId(scheduleSlotId);
    } else if (isOpen && !existingScheduleSlot) {
      setCurrentScheduleSlotId(null);
    }
    setSelectedVehicle('');
    setSeatOverride('');
    setSlotWasDeleted(false); // Reset deleted state when modal opens
  }, [isOpen, existingScheduleSlot, scheduleSlotId]);

  // Create schedule slot with vehicle mutation
  const createScheduleSlotWithVehicleMutation = useMutation({
    mutationFn: ({ vehicleId, seatOverride }: { vehicleId: string; seatOverride?: number }) => 
      apiService.createScheduleSlotWithVehicle(groupId, day, time, week, vehicleId, user!.id, seatOverride),
    onSuccess: async () => {
      // Invalidate and refetch ALL weekly schedule queries for this group
      await queryClient.invalidateQueries({ queryKey: ['weekly-schedule', groupId] });
      // Also invalidate and refetch specific week queries
      await queryClient.invalidateQueries({ queryKey: ['weekly-schedule', groupId, week] });
      // Force refetch to ensure data is updated
      await queryClient.refetchQueries({ queryKey: ['weekly-schedule', groupId, week] });
      
      if (socket) {
        socket.emit(SOCKET_EVENTS.SCHEDULE_SLOT_UPDATED, { groupId });
      }
      onClose();
    },
  });

  // Assign vehicle mutation
  const assignVehicleMutation = useMutation({
    mutationFn: ({ scheduleSlotId, vehicleId, seatOverride }: { scheduleSlotId: string; vehicleId: string; seatOverride?: number }) => 
      apiService.assignVehicleToScheduleSlot(scheduleSlotId, vehicleId, user!.id, seatOverride),
    onSuccess: () => {
      // Invalidate ALL weekly schedule queries for this group
      queryClient.invalidateQueries({ queryKey: ['weekly-schedule', groupId] });
      // Also invalidate specific week queries
      queryClient.invalidateQueries({ queryKey: ['weekly-schedule', groupId, week] });
      queryClient.invalidateQueries({ queryKey: ['schedule-slot', currentScheduleSlotId] });
      if (socket) {
        socket.emit(SOCKET_EVENTS.SCHEDULE_SLOT_UPDATED, { groupId, scheduleSlotId: currentScheduleSlotId });
      }
      onClose();
    },
  });

  // Remove vehicle mutation
  const removeVehicleMutation = useMutation({
    mutationFn: ({ scheduleSlotId, vehicleId }: { scheduleSlotId: string; vehicleId: string }) => 
      apiService.removeVehicleFromScheduleSlot(scheduleSlotId, vehicleId),
    onSuccess: (result, { scheduleSlotId }) => {
      // Invalidate ALL weekly schedule queries for this group
      queryClient.invalidateQueries({ queryKey: ['weekly-schedule', groupId] });
      // Also invalidate specific week queries
      queryClient.invalidateQueries({ queryKey: ['weekly-schedule', groupId, week] });
      
      // If slot was deleted, mark it as deleted and close modal
      if (result.slotDeleted) {
        setSlotWasDeleted(true);
        queryClient.removeQueries({ queryKey: ['schedule-slot', currentScheduleSlotId] });
        onClose();
      } else {
        // Schedule slot still exists, just refresh its data
        queryClient.invalidateQueries({ queryKey: ['schedule-slot', currentScheduleSlotId] });
      }
      
      if (socket) {
        socket.emit(SOCKET_EVENTS.SCHEDULE_SLOT_UPDATED, { groupId, scheduleSlotId });
      }
    },
  });

  const handleAddVehicle = async () => {
    if (!selectedVehicle) return;

    const seatOverrideValue = seatOverride === '' ? undefined : Number(seatOverride);

    try {
      if (!currentScheduleSlotId || currentScheduleSlotId === '') {
        // Create new schedule slot with vehicle
        await createScheduleSlotWithVehicleMutation.mutateAsync({ 
          vehicleId: selectedVehicle,
          seatOverride: seatOverrideValue
        });
      } else {
        // Add vehicle to existing schedule slot
        await assignVehicleMutation.mutateAsync({ 
          scheduleSlotId: currentScheduleSlotId, 
          vehicleId: selectedVehicle,
          seatOverride: seatOverrideValue
        });
      }
    } catch (error) {
      console.error('Failed to add vehicle:', error);
    }
  };

  const handleRemoveVehicle = async (vehicleId: string) => {
    if (!currentScheduleSlotId) return;

    try {
      await removeVehicleMutation.mutateAsync({ scheduleSlotId: currentScheduleSlotId, vehicleId });
    } catch (error) {
      console.error('Failed to remove vehicle:', error);
    }
  };

  // Handle schedule slot deletion (404 error) - use our state variable
  const isSlotDeleted = slotWasDeleted || (freshSlotError as { response?: { status?: number } })?.response?.status === 404;
  
  // Get the current schedule slot data (fresh data takes precedence over existingScheduleSlot prop)
  const shouldWaitForFreshData = currentScheduleSlotId && !freshSlotData && isFreshSlotLoading && !isSlotDeleted;
  const currentSlot = isSlotDeleted ? null : (shouldWaitForFreshData ? null : (freshSlotData || existingScheduleSlot));

  // Reset slot ID when slot gets deleted
  useEffect(() => {
    if (isSlotDeleted) {
      setCurrentScheduleSlotId(null);
    }
  }, [isSlotDeleted]);

  // Get available vehicles (not already assigned to this schedule slot)
  const getAvailableVehicles = (): Vehicle[] => {
    if (!currentSlot) return vehicles;
    
    const assignedVehicleIds = currentSlot.vehicleAssignments?.map(va => va.vehicle.id) || [];
    return vehicles.filter(vehicle => !assignedVehicleIds.includes(vehicle.id));
  };

  const availableVehicles = getAvailableVehicles();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="slot-detail-modal">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">
            Manage Vehicles - {day} at {time}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
            type="button"
          >
            ✕
          </button>
        </div>

        {/* Loading indicator for fresh slot data */}
        {shouldWaitForFreshData && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-sm text-gray-600">Loading schedule slot details...</span>
          </div>
        )}

        {!shouldWaitForFreshData && (
          <div className="space-y-6">
            {/* Currently Assigned Vehicles */}
            {currentSlot?.vehicleAssignments && currentSlot.vehicleAssignments.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Currently Assigned Vehicles</h4>
                <div className="space-y-2">
                  {currentSlot.vehicleAssignments.map((vehicleAssignment) => (
                    <div key={vehicleAssignment.id} className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded">
                      <div className="flex items-center space-x-3">
                        <span className="text-green-600">🚗</span>
                        <div>
                          <div className="font-medium text-green-800">
                            {vehicleAssignment.vehicle.name}
                            {hasSeatOverride(vehicleAssignment) && (
                              <span className="ml-2 text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                                Override: {vehicleAssignment.seatOverride} seats
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-green-600">
                            Capacity: {getEffectiveCapacity(vehicleAssignment)} seats
                            {hasSeatOverride(vehicleAssignment) && (
                              <span className="text-gray-500"> (original: {vehicleAssignment.vehicle.capacity})</span>
                            )}
                            {vehicleAssignment.driver && ` • Driver: ${vehicleAssignment.driver.name}`}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveVehicle(vehicleAssignment.vehicle.id)}
                        disabled={removeVehicleMutation.isPending}
                        className="px-3 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200 disabled:opacity-50"
                        type="button"
                      >
                        {removeVehicleMutation.isPending ? 'Removing...' : 'Remove'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Child Assignments Summary */}
            {currentSlot?.childAssignments && currentSlot.childAssignments.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Assigned Children</h4>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                  <div className="text-sm text-blue-800">
                    👥 {currentSlot.childAssignments.length} children assigned
                    {currentSlot.totalCapacity > 0 && (
                      <span className="ml-2">
                        ({currentSlot.availableSeats} seats remaining)
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-blue-600 mt-1">
                    {currentSlot.childAssignments.slice(0, 3).map(assignment => assignment.child.name).join(', ')}
                    {currentSlot.childAssignments.length > 3 && ` +${currentSlot.childAssignments.length - 3} more`}
                  </div>
                </div>
              </div>
            )}

            {/* Add Vehicle Section - Improved UX */}
            {availableVehicles.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Add Your Vehicle</h4>
                <div className="space-y-3">
                  {/* Vehicle Selection with inline customization */}
                  <div className="space-y-2">
                    {availableVehicles.map((vehicle) => (
                      <div
                        key={vehicle.id}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedVehicle === vehicle.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                        }`}
                        onClick={() => setSelectedVehicle(vehicle.id)}
                        data-testid={`vehicle-option-${vehicle.id}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <input
                              type="radio"
                              name="vehicle"
                              value={vehicle.id}
                              checked={selectedVehicle === vehicle.id}
                              onChange={() => setSelectedVehicle(vehicle.id)}
                              data-testid={`vehicle-radio-${vehicle.id}`}
                              className="text-blue-600"
                            />
                            <div>
                              <div className="font-medium text-gray-900">🚗 {vehicle.name}</div>
                              <div className="text-sm text-gray-600">
                                {vehicle.capacity} seats normally
                              </div>
                            </div>
                          </div>
                          
                          {selectedVehicle === vehicle.id && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSeatOverride(vehicle.capacity);
                                // Could expand inline customization here
                              }}
                              className="text-xs text-blue-600 hover:text-blue-800 underline"
                              data-testid={`customize-${vehicle.id}`}
                            >
                              Customize seats...
                            </button>
                          )}
                        </div>
                        
                        {/* Inline seat adjustment when vehicle is selected */}
                        {selectedVehicle === vehicle.id && (
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <div className="space-y-2">
                              <label className="block text-xs font-medium text-gray-700">
                                Seats for this trip:
                              </label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min={VEHICLE_CONSTRAINTS.MIN_CAPACITY}
                                  max={VEHICLE_CONSTRAINTS.MAX_CAPACITY}
                                  value={seatOverride || vehicle.capacity}
                                  onChange={(e) => setSeatOverride(e.target.value === '' ? '' : parseInt(e.target.value))}
                                  className="w-20 p-1 border border-gray-300 rounded text-sm"
                                  data-testid="seat-override-input"
                                />
                                <span className="text-xs text-gray-500">
                                  (default: {vehicle.capacity})
                                </span>
                                {seatOverride && seatOverride !== vehicle.capacity && (
                                  <button
                                    onClick={() => setSeatOverride('')}
                                    className="text-xs text-gray-500 hover:text-gray-700"
                                  >
                                    Reset
                                  </button>
                                )}
                              </div>
                              <p className="text-xs text-gray-500">
                                💡 Adjust if you need fewer seats due to cargo, child seats, or luggage
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  {selectedVehicle && (
                    <button
                      onClick={handleAddVehicle}
                      disabled={assignVehicleMutation.isPending}
                      className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      type="button"
                      data-testid="confirm-assignment"
                    >
                      {assignVehicleMutation.isPending 
                        ? 'Adding Vehicle...' 
                        : `Add ${availableVehicles.find(v => v.id === selectedVehicle)?.name || 'Vehicle'}`
                      }
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* No Available Vehicles */}
            {availableVehicles.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                {vehicles.length === 0 ? (
                  <div>
                    <p className="mb-2">You haven't added any vehicles yet.</p>
                    <p className="text-sm">Add vehicles in the Vehicles page to volunteer for trips.</p>
                  </div>
                ) : (
                  <p>All your vehicles are already assigned to this time slot.</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Close button */}
        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
            type="button"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default VehicleSelectionModal;