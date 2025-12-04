import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { apiService } from '../services/apiService';
/*
  apiService DEPENDENCY ANALYSIS:
  =================================
  ACTIVE apiService USAGE:
  ------------------------
  1. getUserGroups() - Line 133
     - Needed: User groups endpoint not yet available in OpenAPI
     - Migration Path: Add /user/groups endpoint to OpenAPI spec

  2. getWeeklySchedule() - Line 148
     - Needed: Complex date/week logic not yet in OpenAPI
     - Migration Path: Add /groups/{id}/schedule?week=YYYY-WW endpoint with timezone support

  3. createScheduleSlotWithVehicle() - Line 281
     - Needed: Complex schedule creation with timezone and date calculations
     - Migration Path: Add comprehensive schedule slot creation endpoint

  4. assignVehicleToScheduleSlot() - Line 446 (commented out)
     - Needed: Vehicle assignment to existing schedule slots
     - Migration Path: Add PUT /schedule-slots/{id}/vehicles endpoint

  MIGRATION PLAN:
  --------------
  These methods require OpenAPI endpoint additions before migration.
  The methods involve complex business logic, timezone handling, and
  date calculations that need proper backend API support.

  CLEANUP STATUS: ✅ SAFE TO KEEP - Required for functionality
  NEXT STEP: Backend team to add missing OpenAPI endpoints
*/
import { scheduleConfigService } from '../services/scheduleConfigService';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import { usePageState } from '../hooks/usePageState';
import VehicleSelectionModal from '../components/VehicleSelectionModal';
import ChildAssignmentModal from '../components/ChildAssignmentModal';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/empty-states';
import { PageLayout, PageHeader, ModernCard } from '@/components/ui/page-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Users, Calendar, ChevronLeft, ChevronRight, Car, EyeOff, Eye, Settings2 } from 'lucide-react';
import type { UserGroup, ScheduleSlot, ScheduleSlotVehicle } from '../types/api';
import { getEffectiveCapacity, hasSeatOverride } from '../utils/capacity';

// TODO: Helper function to handle child name compatibility between legacy and OpenAPI formats
const getChildName = (child: any): string => {
  if (child.name) {
    return child.name; // Legacy format: simple name property
  }
  if (child.firstName && child.lastName) {
    return `${child.firstName} ${child.lastName}`; // OpenAPI format: separate first/last names
  }
  return 'Unknown Child';
};
import { SOCKET_EVENTS } from '../shared/events';
import {
  getISOWeekNumber,
  getISOWeekYear,
  getDateFromISOWeek
} from '../utils/weekCalculations';
import {
  getWeekdayInTimezone,
  getTimeInTimezone,
  convertScheduleHoursToLocal
} from '../utils/timezoneUtils';
import { getErrorMessage } from '../utils/errorUtils';

interface WeekdayInfo {
  key: string;
  shortLabel: string;
  dayOfMonth: number;
  month: number;
  date: Date;
}

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

// Configure dayjs plugins
dayjs.extend(utc);
dayjs.extend(timezone);

const SchedulePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [currentWeek, setCurrentWeek] = useState<string>('');
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [isChildModalOpen, setIsChildModalOpen] = useState(false);
  const [selectedScheduleSlot, setSelectedScheduleSlot] = useState<ScheduleSlot | null>(null);
  const [selectedVehicleAssignmentId, setSelectedVehicleAssignmentId] = useState<string | undefined>(undefined);
  const [dayOffset, setDayOffset] = useState<number>(0); // For responsive day navigation
  const [screenSize, setScreenSize] = useState<'xs' | 'sm' | 'md' | 'lg' | 'xl'>('xl');
  const [sidebarVisible, setSidebarVisible] = useState<boolean>(true);
  const queryClient = useQueryClient();
  const { socket, isConnected } = useSocket();
  const { user } = useAuth();
  const navigate = useNavigate();
  // const { formatError: formatErrorDate } = useDateFormatting(); // TODO: Use for error messages

  // Responsive breakpoint detection - More aggressive for better readability
  useEffect(() => {
    const updateScreenSize = () => {
      const width = window.innerWidth;
      if (width >= 1800) setScreenSize('xl');      // 5 days (très grands écrans)
      else if (width >= 1400) setScreenSize('lg');  // 4 days  
      else if (width >= 1100) setScreenSize('md');   // 3 days
      else if (width >= 800) setScreenSize('sm');   // 2 days
      else setScreenSize('xs');                     // 1 day
    };

    updateScreenSize();
    window.addEventListener('resize', updateScreenSize);
    return () => window.removeEventListener('resize', updateScreenSize);
  }, []);

  // Reset offset when screen size changes
  useEffect(() => {
    setDayOffset(0);
  }, [screenSize]);

  // Initialize current week and selected group
  useEffect(() => {
    const groupFromUrl = searchParams.get('group');
    if (groupFromUrl) {
      setSelectedGroup(groupFromUrl);
    }

    // Set current week (ISO week format YYYY-WW)
    const now = new Date();
    const userTimezone = user?.timezone || dayjs.tz.guess();
    const weekNumber = getISOWeekNumber(now, userTimezone);
    const year = getISOWeekYear(now, userTimezone);
    const weekString = `${year}-${weekNumber.toString().padStart(2, '0')}`;
    console.log(`🔍 DEBUG: Setting current week to: ${weekString} (now: ${now.toISOString()}, timezone: ${userTimezone})`);
    setCurrentWeek(weekString);
  }, [searchParams, user?.timezone]);

  // Socket room management for real-time updates
  useEffect(() => {
    if (socket && selectedGroup && isConnected) {
      // Join the group room for real-time updates using standardized event name
      socket.emit(SOCKET_EVENTS.GROUP_JOIN, { groupId: selectedGroup });

      // NOTE: Individual event listeners removed - now handled centrally in SocketContext
      // This prevents duplicate event handling and improves performance

      return () => {
        socket.emit(SOCKET_EVENTS.GROUP_LEAVE, { groupId: selectedGroup });
      };
    }
  }, [socket, selectedGroup, isConnected, currentWeek, queryClient]);

  // TODO: Migrate to OpenAPI - need to find correct endpoint for user groups
  const groupsQuery = useQuery({
    queryKey: ['user-groups'],
    queryFn: () => apiService.getUserGroups(),
  });

  const {
    data: groups,
    shouldShowLoading,
    shouldShowError,
    shouldShowEmpty
  } = usePageState(groupsQuery);

  // Fetch weekly schedule
  const { data: schedule, isLoading: scheduleLoading, error: scheduleError } = useQuery({
    queryKey: ['weekly-schedule', selectedGroup, currentWeek],
    queryFn: async () => {
      console.log(`🔍 DEBUG: Fetching schedule for group ${selectedGroup}, week ${currentWeek}`);
      const result = await apiService.getWeeklySchedule(selectedGroup, currentWeek, user?.timezone);
      console.log(`🔍 DEBUG: Schedule API response:`, result);
      return result;
    },
    enabled: !!selectedGroup && !!currentWeek,
  });

  // Generate weekdays for current week (timezone-aware)
  const weekdays = useMemo(() => {
    if (!currentWeek) return [];

    const userTimezone = user?.timezone || dayjs.tz.guess();
    const [year, week] = currentWeek.split('-').map(Number);

    // Get Monday of the ISO week using timezone-aware function
    const weekStart = getDateFromISOWeek(year, week, userTimezone);
    const weekdays = [];

    for (let i = 0; i < 5; i++) { // Monday to Friday
      const date = new Date(weekStart);
      date.setUTCDate(weekStart.getUTCDate() + i);

      // Use browser locale for display but English for keys to maintain consistency
      const locale = navigator.language || 'fr-FR';
      const weekdayKeys = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
      const currentDayIndex = i; // i goes from 0 to 4 for Mon-Fri
      weekdays.push({
        key: weekdayKeys[currentDayIndex], // Always use English keys
        label: date.toLocaleDateString(locale, { weekday: 'long' }),
        shortLabel: date.toLocaleDateString(locale, { weekday: 'short' }),
        date: date,
        dayOfMonth: date.getUTCDate(),
        month: date.getUTCMonth(),
        dateString: date.toISOString().split('T')[0] // YYYY-MM-DD
      });
    }

    return weekdays;
  }, [currentWeek, user?.timezone]);

  // Fetch schedule configuration for the selected group
  const { data: scheduleConfig, error: scheduleConfigError, isLoading: scheduleConfigLoading } = useQuery({
    queryKey: ['group-schedule-config', selectedGroup],
    queryFn: () => {
      console.log('🔍 DEBUG: Fetching schedule config for group:', selectedGroup);
      return scheduleConfigService.getGroupScheduleConfig(selectedGroup);
    },
    enabled: !!selectedGroup,
    staleTime: 5 * 60 * 1000, // 5 minutes - config doesn't change often
    gcTime: 10 * 60 * 1000, // 10 minutes cache (was cacheTime)
    retry: 2, // Reduce retries for faster failure detection
    retryDelay: 500, // Faster retry delay
    networkMode: 'online', // Only query when online
    refetchOnWindowFocus: false, // Prevent unnecessary refetches
  });

  // Debug schedule config loading
  useEffect(() => {
    console.log('🔍 DEBUG: ScheduleConfig changed:', {
      scheduleConfig: scheduleConfig,
      error: scheduleConfigError,
      isLoading: scheduleConfigLoading,
      selectedGroup
    });
  }, [scheduleConfig, scheduleConfigError, scheduleConfigLoading, selectedGroup]);

  // Generate combined time slots from all weekdays for the grid
  // IMPORTANT: Convert UTC times from backend to local times for display
  const timeSlots = useMemo(() => {
    if (!scheduleConfig?.scheduleHours || !user?.timezone) return [];

    // Convert UTC scheduleHours to local timezone
    const localScheduleHours = convertScheduleHoursToLocal(
      scheduleConfig.scheduleHours,
      user.timezone
    );
    console.log('🔍 DEBUG: localScheduleHours after conversion:', localScheduleHours);

    const allTimeSlots = new Set<string>();
    const weekdayKeys = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];

    weekdayKeys.forEach(weekday => {
      const dayTimeSlots = localScheduleHours[weekday] || [];
      dayTimeSlots.forEach((timeSlot: string) => allTimeSlots.add(timeSlot));
    });

    return Array.from(allTimeSlots).sort();
  }, [scheduleConfig, user?.timezone]);

  // Transform schedule data to group by day
  const scheduleByDay = useMemo(() => {
    console.log(`🔍 DEBUG: Processing schedule data:`, schedule);
    if (!schedule?.scheduleSlots) {
      console.log(`🔍 DEBUG: No schedule slots found in response`);
      return {};
    }

    console.log(`🔍 DEBUG: Found ${schedule.scheduleSlots.length} schedule slots`);

    // Transform schedule data for display
    const grouped: { [day: string]: ScheduleSlot[] } = {};
    schedule.scheduleSlots.forEach((slot: ScheduleSlot) => {
      // Extract day from datetime using UTC to match server timezone
      const slotDate = new Date(slot.datetime);
      const dayKey = slotDate.toLocaleDateString('en-US', {
        weekday: 'long',
        timeZone: 'UTC'
      }).toUpperCase();

      console.log(`🔍 DEBUG: Slot datetime: ${slot.datetime}, parsed as: ${slotDate.toISOString()}, dayKey: ${dayKey} (UTC)`);

      if (!grouped[dayKey]) {
        grouped[dayKey] = [];
      }
      grouped[dayKey].push(slot);
    });

    console.log(`🔍 DEBUG: Grouped schedule by day:`, grouped);
    return grouped;
  }, [schedule]);

  // MIGRATED: Use OpenAPI client
  const { data: vehiclesData = { data: [] } } = useQuery({
    queryKey: ['vehicles'],
    queryFn: async () => {
      const result = await api.GET('/vehicles', {});
      return result.data;
    },
  });

  const vehicles = vehiclesData?.data || [];

  // TODO: Replace with direct OpenAPI call - currently using apiService wrapper for complex date logic
  const createScheduleSlotWithVehicleMutation = useMutation({
    mutationFn: (data: { day: string; time: string; vehicleId: string; driverId?: string }) =>
      apiService.createScheduleSlotWithVehicle(
        selectedGroup,
        data.day,
        data.time,
        currentWeek,
        data.vehicleId,
        data.driverId,
        undefined, // seatOverride
        user?.timezone // Pass user timezone
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekly-schedule', selectedGroup, currentWeek] });
    },
  });



  // Memoized sidebar visibility check
  const isSidebarVisible = useMemo((): boolean => {
    return (screenSize !== 'xs' && screenSize !== 'sm') && sidebarVisible;
  }, [screenSize, sidebarVisible]);

  // Memoized number of days to display
  const daysToShow = useMemo((): number => {
    // Progressive reduction with smooth transitions
    switch (screenSize) {
      case 'xl': return 5; // Always 5 days on XL screens
      case 'lg': return 4; // Always 4 days on LG screens
      case 'md': return isSidebarVisible ? 2 : 3; // 3 days, 2 with sidebar
      case 'sm': return 2; // Always 2 days (no sidebar)
      case 'xs': return 1; // Always 1 day (no sidebar)
      default: return 5;
    }
  }, [screenSize, isSidebarVisible]);

  // Memoized time column width
  const timeColumnWidth = useMemo((): string => {
    switch (screenSize) {
      case 'xl': return '90px';
      case 'lg': return '80px';
      case 'md': return '70px';
      case 'sm': return '60px';
      case 'xs': return '50px';
      default: return '80px';
    }
  }, [screenSize]);

  // Memoized grid template columns
  const gridColumns = useMemo((): string => {
    const dayColumns = Array(daysToShow).fill('1fr').join(' ');
    return `${timeColumnWidth} ${dayColumns}`;
  }, [timeColumnWidth, daysToShow]);

  // Memoized visible days for current offset
  const visibleDays = useMemo(() => {
    return weekdays.slice(dayOffset, dayOffset + daysToShow);
  }, [weekdays, dayOffset, daysToShow]);

  // Memoized navigation functions
  const canNavigatePrev = useMemo((): boolean => dayOffset > 0, [dayOffset]);
  const canNavigateNext = useMemo((): boolean => {
    return dayOffset + daysToShow < weekdays.length;
  }, [dayOffset, daysToShow, weekdays.length]);

  const navigateDays = useCallback((direction: 'prev' | 'next') => {
    if (direction === 'next' && canNavigateNext) {
      setDayOffset(Math.min(weekdays.length - daysToShow, dayOffset + daysToShow));
    } else if (direction === 'prev' && canNavigatePrev) {
      setDayOffset(Math.max(0, dayOffset - daysToShow));
    }
  }, [dayOffset, daysToShow, canNavigateNext, canNavigatePrev, weekdays.length]);

  const navigateWeek = (direction: 'prev' | 'next') => {
    const userTimezone = user?.timezone || dayjs.tz.guess();
    const [year, week] = currentWeek.split('-').map(Number);

    // Use timezone-aware navigation
    const currentWeekDate = getDateFromISOWeek(year, week, userTimezone);
    const offset = direction === 'next' ? 7 : -7;
    const newDate = new Date(currentWeekDate);
    newDate.setUTCDate(currentWeekDate.getUTCDate() + offset);

    const newWeekNumber = getISOWeekNumber(newDate, userTimezone);
    const newYear = getISOWeekYear(newDate, userTimezone);
    const newWeekString = `${newYear}-${newWeekNumber.toString().padStart(2, '0')}`;

    console.log(`🔍 DEBUG: Navigating from ${currentWeek} to ${newWeekString} (${direction}, timezone: ${userTimezone})`);
    setCurrentWeek(newWeekString);
  };

  // Format week range for display (timezone-aware)
  const formatWeekRangeDisplay = (weekString: string) => {
    if (!weekString) return '';

    const userTimezone = user?.timezone || dayjs.tz.guess();
    const [year, week] = weekString.split('-').map(Number);

    // Get Monday and Friday of the ISO week
    const monday = getDateFromISOWeek(year, week, userTimezone);
    const friday = new Date(monday);
    friday.setUTCDate(monday.getUTCDate() + 4);

    const formatOptions: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    };

    return `${monday.toLocaleDateString(navigator.language || 'fr-FR', formatOptions)} - ${friday.toLocaleDateString(navigator.language || 'fr-FR', formatOptions)}`;
  };

  const handleManageVehicles = useCallback((scheduleSlot: ScheduleSlot) => {
    setSelectedScheduleSlot(scheduleSlot);
    setIsVehicleModalOpen(true);
  }, []);

  const handleManageChildren = useCallback((scheduleSlot: ScheduleSlot, vehicleAssignmentId?: string) => {
    setSelectedScheduleSlot(scheduleSlot);
    setSelectedVehicleAssignmentId(vehicleAssignmentId);
    setIsChildModalOpen(true);
  }, []);

  const closeVehicleModal = useCallback(() => {
    setIsVehicleModalOpen(false);
    setSelectedScheduleSlot(null);
  }, []);

  const closeChildModal = useCallback(() => {
    setIsChildModalOpen(false);
    setSelectedScheduleSlot(null);
    setSelectedVehicleAssignmentId(undefined);
  }, []);

  const handleVehicleDrop = useCallback(async (day: string, time: string, vehicleId: string) => {
    try {
      const daySchedule = scheduleByDay[day] || [];
      let scheduleSlot = daySchedule.find((slot: ScheduleSlot) => {
        // Convert UTC datetime to local time for matching
        const slotTime = getTimeInTimezone(slot.datetime, user?.timezone || 'UTC');
        return slotTime === time;
      });

      if (!scheduleSlot) {
        // Create schedule slot with vehicle atomically
        scheduleSlot = await createScheduleSlotWithVehicleMutation.mutateAsync({
          day,
          time,
          vehicleId,
          driverId: user!.id
        });
      } else {
        // TODO: Check if this vehicle is already assigned to this schedule slot
        // FIXME: Null safety required because vehicle can be undefined in legacy format
        const isVehicleAlreadyAssigned = scheduleSlot.vehicleAssignments?.some(
          (va: ScheduleSlotVehicle) => va.vehicle?.id === vehicleId
        );

        if (isVehicleAlreadyAssigned) {
          toast.error("Vehicle already assigned", {
            description: "This vehicle is already assigned to this time slot"
          });
          return;
        }

        // TODO: Assign vehicle to existing schedule slot - need to find correct OpenAPI endpoint
        // await apiService.assignVehicleToScheduleSlot(scheduleSlot.id, vehicleId, user!.id);
        console.log('TODO: Need to migrate assignVehicleToScheduleSlot to OpenAPI');
      }

      // Refresh schedule - force refetch
      await queryClient.invalidateQueries({ queryKey: ['weekly-schedule', selectedGroup, currentWeek] });
      await queryClient.refetchQueries({ queryKey: ['weekly-schedule', selectedGroup, currentWeek] });

      // FIXME: Null safety check required because scheduleSlot could be undefined in some code paths
      if (socket && scheduleSlot) {
        socket.emit(SOCKET_EVENTS.SCHEDULE_SLOT_UPDATED, { groupId: selectedGroup, scheduleSlotId: scheduleSlot.id });
      }
    } catch (error) {
      console.error('Failed to attach vehicle:', error);
      toast.error("Failed to attach vehicle", {
        description: getErrorMessage(error)
      });
    }
  }, [scheduleByDay, selectedGroup, currentWeek, user, socket, queryClient, createScheduleSlotWithVehicleMutation]);

  const renderTimeSlot = useCallback((weekday: WeekdayInfo, time: string) => {
    // Check if this time slot is configured for this weekday
    // IMPORTANT: Convert UTC scheduleHours to local timezone for comparison
    if (!scheduleConfig?.scheduleHours || !user?.timezone) {
      return (
        <div
          key={`${weekday.key}-${time}`}
          className="border border-gray-200 p-2 min-h-[140px] bg-gray-50 opacity-40"
          data-testid={`schedule-slot-${weekday.key}-${time}-unavailable`}
        >
          <div className="h-full flex items-center justify-center text-gray-400 text-xs">
            Loading...
          </div>
        </div>
      );
    }

    const localScheduleHours = convertScheduleHoursToLocal(
      scheduleConfig.scheduleHours,
      user.timezone
    );
    const weekdayTimeSlots = localScheduleHours[weekday.key] || [];
    const isTimeSlotAvailable = weekdayTimeSlots.includes(time);

    // // Debug logs pour comprendre le problème
    // console.log('🔍 DEBUG renderTimeSlot:', {
    //   weekdayKey: weekday.key,
    //   time,
    //   localScheduleHours,
    //   weekdayTimeSlots,
    //   isTimeSlotAvailable
    // });

    // If time slot is not available for this weekday, render empty cell
    if (!isTimeSlotAvailable) {
      return (
        <div
          key={`${weekday.key}-${time}`}
          className="border border-gray-200 p-2 min-h-[140px] bg-gray-50 opacity-40"
          data-testid={`schedule-slot-${weekday.key}-${time}-unavailable`}
        >
          <div className="h-full flex items-center justify-center text-gray-400 text-xs">
            Not configured
          </div>
        </div>
      );
    }

    const daySchedule = scheduleByDay[weekday.key] || [];

    const scheduleSlot = daySchedule.find((slot: ScheduleSlot) => {
      // Convert UTC datetime to local time for matching
      const slotTime = getTimeInTimezone(slot.datetime, user?.timezone || 'UTC');
      return slotTime === time;
    });

    // Check if this time slot is in the past using user timezone
    // Get user timezone from auth context, default to browser timezone
    const userTimezone = user?.timezone || dayjs.tz.guess();

    // Create slot datetime in user timezone
    const [slotHours, slotMinutes] = time.split(':').map(Number);
    const slotDateTime = dayjs(weekday.date)
      .tz(userTimezone)
      .hour(slotHours)
      .minute(slotMinutes)
      .second(0)
      .millisecond(0);

    // Get current time in user timezone
    const nowInUserTz = dayjs().tz(userTimezone);
    const isInPast = slotDateTime.isBefore(nowInUserTz);

    // DEBUG: Log datetime calculations for debugging
    if (window.location.search.includes('debug')) {
      console.log(`DEBUG: Time slot ${weekday.key} ${time} - timezone: ${userTimezone}, slotDateTime: ${slotDateTime.format()}, now: ${nowInUserTz.format()}, isInPast: ${isInPast}`);
    }

    return (
      <div
        key={`${weekday.key}-${time}`}
        className={`border border-gray-200 p-2 min-h-[140px] relative text-xs ${isInPast
            ? 'bg-gray-100 opacity-60 cursor-not-allowed'
            : 'bg-white hover:bg-gray-50'
          }`}
        data-testid={`schedule-slot-${weekday.key}-${time}`}
        onDragOver={(e) => {
          if (isInPast) {
            e.dataTransfer.dropEffect = 'none';
            return;
          }
          e.preventDefault();
          e.currentTarget.classList.add('bg-blue-50', 'border-blue-300', 'border-2');
        }}
        onDragLeave={(e) => {
          if (isInPast) return;
          e.currentTarget.classList.remove('bg-blue-50', 'border-blue-300', 'border-2');
        }}
        onDrop={(e) => {
          if (isInPast) {
            e.preventDefault();
            toast.error("Cannot modify past trips", {
              description: "This time slot has already passed"
            });
            return;
          }
          e.preventDefault();
          e.currentTarget.classList.remove('bg-blue-50', 'border-blue-300', 'border-2');

          const vehicleId = e.dataTransfer.getData('vehicleId');

          if (vehicleId) {
            handleVehicleDrop(weekday.key, time, vehicleId);
          } else {
            toast.error("No vehicle data found", {
              description: "Make sure you drag from the vehicle sidebar"
            });
          }
        }}
      >
        {scheduleSlot ? (
          <div className="space-y-2">
            {/* Modern vehicle cards */}
            {scheduleSlot.vehicleAssignments?.map((vehicleAssignment: ScheduleSlotVehicle) => {
              // Calculate children assigned to this specific vehicle
              const vehicleChildren = scheduleSlot.childAssignments.filter((ca) =>
                ca.vehicleAssignmentId === vehicleAssignment.id
              );


              const currentCapacity = vehicleChildren.length;
              const maxCapacity = getEffectiveCapacity(vehicleAssignment);
              const isAtCapacity = currentCapacity >= maxCapacity;
              const capacityPercentage = (currentCapacity / maxCapacity) * 100;

              // Determine status and colors based on vehicle-specific capacity
              const getStatusColor = () => {
                if (currentCapacity === 0) return 'bg-gray-50 border-gray-200 text-gray-700';
                if (isAtCapacity) return 'bg-red-50 border-red-200 text-red-800';
                if (capacityPercentage >= 75) return 'bg-orange-50 border-orange-200 text-orange-800';
                return 'bg-green-50 border-green-200 text-green-800';
              };

              return (
                <div
                  key={vehicleAssignment.id}
                  className={`border rounded-lg p-3 transition-all hover:shadow-md hover:scale-[1.02] cursor-pointer ${getStatusColor()}`}
                  onClick={() => handleManageChildren(scheduleSlot, vehicleAssignment.id)}
                  title="Click to manage children for this vehicle"
                  data-testid={`schedule-vehicle-${vehicleAssignment.id}`}
                >
                  {/* Header with vehicle name and actions */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 rounded-full bg-current opacity-60"></div>
                      {/* TODO: Legacy compatibility - vehicle can be undefined in old apiService format */}
                      {vehicleAssignment.vehicle && (
                        <>
                          <span className="font-medium text-sm" data-testid={`schedule-vehicle-name-${vehicleAssignment.vehicle.id}`}>{vehicleAssignment.vehicle.name}</span>
                          {hasSeatOverride(vehicleAssignment) && (
                            <div
                              title={`Seat override: ${vehicleAssignment.seatOverride} seats (original: ${vehicleAssignment.vehicle.capacity})`}
                              data-testid={`seat-override-indicator-${vehicleAssignment.id}`}
                            >
                              <Settings2 className="h-3 w-3 text-blue-600" />
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleManageVehicles(scheduleSlot);
                        }}
                        className="p-1 rounded text-xs hover:bg-white/50 transition-colors"
                        title="Manage vehicles"
                      >
                        ⚙️
                      </button>
                    </div>
                  </div>

                  {/* Capacity bar */}
                  <div className="mb-2">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span data-testid={`capacity-indicator-${vehicleAssignment.id}`}>{currentCapacity}/{maxCapacity} seats</span>
                      {vehicleAssignment.driver && (
                        <span className="text-xs opacity-75" data-testid="driver-info">
                          {/* FIXME: Legacy driver format compatibility - handle both name and firstName/lastName formats */}
                          Driver: {vehicleAssignment.driver?.firstName && vehicleAssignment.driver?.lastName ? `${vehicleAssignment.driver.firstName} ${vehicleAssignment.driver.lastName}` : 'Unassigned'}
                        </span>
                      )}
                    </div>
                    <div className="w-full bg-white/50 rounded-full h-1.5">
                      <div
                        className="bg-current h-1.5 rounded-full transition-all opacity-60"
                        style={{ width: `${Math.min(capacityPercentage, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Children list for this specific vehicle */}
                  <div className="text-xs">
                    {vehicleChildren.length > 0 ? (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="font-medium opacity-75">Children:</div>
                          <div className="text-xs opacity-60">Click to edit</div>
                        </div>
                        <div className="space-y-0.5">
                          {/* TODO: Legacy compatibility - assignment.child can be undefined in old apiService format */}
                          {vehicleChildren.map((assignment, index) => (
                            assignment.child && (
                              <div key={assignment.child.id} className="flex items-center justify-between bg-white/30 rounded px-2 py-1">
                                <span data-testid={`schedule-child-${assignment.child.id}`}>{getChildName(assignment.child)}</span>
                                <span className="opacity-60">#{index + 1}</span>
                              </div>
                            )
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-2 opacity-60 italic">
                        No children assigned - Click to add
                      </div>
                    )}
                  </div>
                </div>
              );
            }) || []}

            {/* Add vehicle button */}
            {vehicles.length > 0 && !isInPast && (
              <button
                onClick={() => handleManageVehicles(scheduleSlot)}
                className="w-full text-xs px-3 py-2 text-blue-600 border border-dashed border-blue-300 rounded-lg hover:bg-blue-50 hover:border-blue-400 transition-all"
                data-testid="manage-vehicles-btn"
              >
                + Add vehicle
              </button>
            )}
            {isInPast && (
              <div className="text-xs text-gray-500 text-center py-2 px-3 bg-gray-50 rounded-lg border border-gray-300">
                Cannot modify past trips
              </div>
            )}
            {vehicles.length === 0 && (
              <div className="text-xs text-gray-500 text-center py-3 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                Add vehicles to volunteer for trips
              </div>
            )}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center space-y-3">
            {isInPast ? (
              <div className="text-gray-500 text-xs text-center">
                <div className="mb-1">Time slot has passed</div>
                <div className="text-gray-400 text-xs">Cannot modify past trips</div>
              </div>
            ) : (
              <>
                <div className="text-gray-400 text-xs text-center">
                  No vehicles assigned
                </div>
                {vehicles.length > 0 ? (
                  <button
                    onClick={() => {
                      // Create a pseudo schedule slot for the modal to handle vehicle selection
                      // Calculate datetime from day/time/week using proper ISO week calculation
                      const [year, weekNum] = currentWeek.split('-').map(Number);
                      const jan4 = new Date(year, 0, 4);
                      const jan4DayOfWeek = (jan4.getDay() + 6) % 7; // Convert to Monday=0, Tuesday=1, etc.
                      const weekStart = new Date(jan4);
                      weekStart.setDate(jan4.getDate() - jan4DayOfWeek + (weekNum - 1) * 7);

                      const dayOffsets: Record<string, number> = {
                        'MONDAY': 0, 'TUESDAY': 1, 'WEDNESDAY': 2, 'THURSDAY': 3, 'FRIDAY': 4
                      };
                      const dayOffset = dayOffsets[weekday.key] || 0;
                      const targetDate = new Date(weekStart);
                      targetDate.setDate(weekStart.getDate() + dayOffset);
                      const [hours, minutes] = time.split(':').map(Number);
                      targetDate.setHours(hours, minutes, 0, 0);

                      setSelectedScheduleSlot({
                        id: '',
                        groupId: selectedGroup,
                        datetime: targetDate.toISOString(),
                        // Keep legacy fields for backward compatibility
                        day: weekday.key,
                        time,
                        week: currentWeek,
                        vehicleAssignments: [],
                        childAssignments: [],
                        totalCapacity: 0,
                        availableSeats: 0,
                        createdAt: '',
                        updatedAt: ''
                      } as ScheduleSlot);
                      setIsVehicleModalOpen(true);
                    }}
                    className="text-xs px-3 py-2 text-blue-600 border border-dashed border-blue-300 rounded-lg hover:bg-blue-50 hover:border-blue-400 transition-all"
                    data-testid="add-vehicle-btn"
                  >
                    + Add vehicle
                  </button>
                ) : (
                  <div className="text-xs text-gray-500 text-center py-3 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                    Add vehicles to volunteer for trips
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
  }, [scheduleByDay, selectedGroup, currentWeek, vehicles.length, handleManageChildren, handleManageVehicles, handleVehicleDrop, scheduleConfig, user?.timezone]);

  // Show loading when groups are loading
  if (shouldShowLoading) {
    return (
      <PageLayout variant="schedule">
        <PageHeader
          title="Weekly Schedule"
          subtitle="Loading your groups..."
          data-testid="SchedulePage-Header-weeklySchedule"
        />
        <LoadingState />
      </PageLayout>
    );
  }

  // Handle groups query error
  if (shouldShowError) {
    return (
      <PageLayout variant="schedule">
        <PageHeader
          title="Weekly Schedule"
          subtitle="Coordinate school transport with your groups"
          data-testid="SchedulePage-Header-weeklySchedule"
        />
        <ErrorState
          title="Failed to load groups"
          description="We couldn't load your transport groups. Please check your connection and try again."
          onRetry={() => window.location.reload()}
        />
      </PageLayout>
    );
  }

  // Show message when no groups exist
  if (shouldShowEmpty) {
    return (
      <PageLayout variant="schedule">
        <PageHeader
          title="Weekly Schedule"
          subtitle="Coordinate school transport with your groups"
          data-testid="SchedulePage-Header-weeklySchedule"
        />
        <EmptyState
          icon={Users}
          title="No Transport Groups"
          description="You need to join or create a transport group to view schedules. Groups help you coordinate school transport with other families."
          action={{
            label: "Go to Groups Page",
            onClick: () => window.location.href = '/groups'
          }}
          data-testid="SchedulePage-EmptyState-noGroups"
        />
      </PageLayout>
    );
  }

  // Show group selection when groups exist but none selected
  if (!selectedGroup && groups.length > 0) {
    return (
      <PageLayout variant="schedule">
        <PageHeader
          title="Weekly Schedule"
          subtitle="Choose a group to view its weekly schedule"
          data-testid="SchedulePage-Header-weeklySchedule"
        />
        <div className="text-center py-12">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-4xl mx-auto">
            {groups.map((group: UserGroup) => (
              <ModernCard key={group.id} className="cursor-pointer transition-transform hover:scale-105" onClick={() => setSelectedGroup(group.id)}>
                <div className="p-6 text-center">
                  <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-xl bg-primary/10">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg text-slate-900 dark:text-slate-100 mb-2">{group.name}</h3>
                  <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground">
                    <Badge variant="secondary">{group.userRole}</Badge>
                    <span>•</span>
                    <span>{group.familyCount} famil{group.familyCount !== 1 ? 'ies' : 'y'}</span>
                  </div>
                </div>
              </ModernCard>
            ))}
          </div>
        </div>
      </PageLayout>
    );
  }

  if (scheduleLoading) {
    return (
      <PageLayout variant="schedule">
        <PageHeader
          title="Weekly Schedule"
          subtitle="Loading schedule..."
          data-testid="SchedulePage-Header-weeklySchedule"
        />
        <LoadingState />
      </PageLayout>
    );
  }

  const selectedGroupData = groups.find(g => g.id === selectedGroup);

  return (
    <PageLayout variant="schedule">
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
        {/* My Vehicles Sidebar - Modern Design */}
        <div className={`${isSidebarVisible ? 'block' : 'hidden'} w-full lg:w-64 order-2 lg:order-1`}>
          <ModernCard className="h-fit"
          >
            <div className="p-4 lg:p-6">
              <div className="flex items-center gap-2 mb-4">
                <Car className="h-5 w-5 text-primary" />
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">My Vehicles</h3>
              </div>

              {vehicles.length > 0 ? (
                <div className="space-y-3">
                  {vehicles.map(vehicle => (
                    <div
                      key={vehicle.id}
                      draggable
                      className="p-3 border-2 border-dashed border-primary/20 rounded-xl cursor-move hover:border-primary/40 hover:bg-primary/5 transition-all duration-200 group"
                      data-testid={`sidebar-vehicle-${vehicle.id}`}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('vehicleId', vehicle.id);
                        e.dataTransfer.setData('vehicleName', vehicle.name);
                        e.dataTransfer.setData('vehicleCapacity', vehicle.capacity.toString());
                        e.currentTarget.style.opacity = '0.5';
                      }}
                      onDragEnd={(e) => {
                        e.currentTarget.style.opacity = '1';
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Car className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium text-slate-900 dark:text-slate-100" data-testid={`sidebar-vehicle-name-${vehicle.id}`}>{vehicle.name}</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {vehicle.capacity} seats
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-2 group-hover:text-primary transition-colors">
                        Drag to schedule slot
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <Car className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <div className="text-sm text-muted-foreground">No vehicles added yet</div>
                  <div className="text-xs text-muted-foreground mt-1">Add vehicles to volunteer for trips</div>
                </div>
              )}
            </div>
          </ModernCard>
        </div>

        {/* Main Schedule Content */}
        <div className="flex-1 order-1 lg:order-2">
          {/* Modern Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <Calendar className="h-6 w-6 text-primary" />
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100" data-testid="SchedulePage-Title-weeklySchedule">Weekly Schedule</h1>
                {!isSidebarVisible && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSidebarVisible(true)}
                    className="ml-auto lg:hidden"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                <span className="font-medium" data-testid="GroupCard-Heading-groupName">{selectedGroupData?.name}</span>
              </div>
            </div>

            {isSidebarVisible && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSidebarVisible(false)}
                className="lg:hidden"
              >
                <EyeOff className="h-4 w-4 mr-2" />
                Hide Vehicles
              </Button>
            )}
          </div>

          {/* Modern Week Navigation */}
          <div className="flex items-center justify-between gap-4 mb-6">
            <Button
              variant="outline"
              onClick={() => navigateWeek('prev')}
              className="gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous Week
            </Button>

            <div className="text-center">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100" data-testid="week-range-header">
                {formatWeekRangeDisplay(currentWeek)}
              </h2>
            </div>

            <Button
              variant="outline"
              onClick={() => navigateWeek('next')}
              className="gap-2"
            >
              Next Week
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {scheduleError && (
            <div className="mb-6">
              <ErrorState
                title="Failed to load schedule"
                description="We couldn't load the weekly schedule. Please check your connection and try again."
                onRetry={() => queryClient.invalidateQueries({ queryKey: ['weekly-schedule', selectedGroup, currentWeek] })}
              />
            </div>
          )}

          {scheduleConfigLoading && selectedGroup && (
            <div className="mb-6">
              <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted/50 mb-4 mx-auto">
                  <Settings2 className="h-10 w-10 text-muted-foreground animate-pulse" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Loading schedule configuration...</h3>
                <p className="text-muted-foreground">
                  Checking group schedule settings...
                </p>
              </div>
            </div>
          )}

          {(scheduleConfigError && !scheduleConfigLoading) && (
            <div className="mb-6">
              <div className="border-2 border-dashed border-destructive/20 rounded-lg p-8 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted/50 mb-4 mx-auto">
                  <Settings2 className="h-10 w-10 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Schedule configuration required</h3>
                <p className="text-muted-foreground mb-4">
                  This group needs schedule configuration. Set up time slots to enable scheduling.
                </p>
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    onClick={() => queryClient.invalidateQueries({ queryKey: ['group-schedule-config', selectedGroup] })}
                  >
                    Try Again
                  </Button>
                  {selectedGroupData?.userRole === 'ADMIN' ? (
                    <Button
                      onClick={() => navigate(`/groups/${selectedGroup}/manage`)}
                    >
                      Configure Schedule
                    </Button>
                  ) : (
                    <div className="w-full mt-2 text-sm text-muted-foreground">
                      Contact a group administrator to set up time slots.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Responsive Day Navigation - Show only when needed */}
          {daysToShow < 5 && (
            <div className="flex items-center justify-between gap-4 mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateDays('prev')}
                disabled={!canNavigatePrev}
                className="gap-2"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>

              <div className="text-center">
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {visibleDays.map(d => d.shortLabel).join(' - ')}
                </div>
                <div className="text-xs text-muted-foreground">
                  {daysToShow} of 5 days
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateDays('next')}
                disabled={!canNavigateNext}
                className="gap-2"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Modern Schedule Grid - Only show if schedule config is available */}
          {scheduleConfig && !scheduleConfigError && (
            <ModernCard className="overflow-hidden" data-testid="schedule-grid">
              {/* Responsive Header */}
              <div className="grid border-b border-slate-200 dark:border-slate-700" style={{ gridTemplateColumns: gridColumns }}>
                <div className="p-4 bg-slate-50 dark:bg-slate-800 font-semibold text-slate-900 dark:text-slate-100 text-sm text-center">
                  Time
                </div>
                {visibleDays.map(weekday => (
                  <div key={weekday.key} className="p-4 bg-slate-50 dark:bg-slate-800 font-semibold text-slate-900 dark:text-slate-100 text-center text-sm">
                    <div className="font-semibold">{weekday.shortLabel}</div>
                    <div className="text-xs opacity-75 mt-1">{weekday.dayOfMonth}/{weekday.month + 1}</div>
                  </div>
                ))}
              </div>

              {timeSlots.map(time => (
                <div key={time} className="grid border-b border-slate-200 dark:border-slate-700 last:border-b-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors" style={{ gridTemplateColumns: gridColumns }}>
                  <div className="p-4 bg-slate-100/50 dark:bg-slate-900/50 font-medium text-slate-700 dark:text-slate-300 text-center text-sm">
                    {time}
                  </div>
                  {visibleDays.map(weekday => renderTimeSlot(weekday, time))}
                </div>
              ))}
            </ModernCard>
          )}
        </div>
      </div>

      {/* Vehicle Selection Modal */}
      <VehicleSelectionModal
        isOpen={isVehicleModalOpen}
        onClose={closeVehicleModal}
        scheduleSlotId={selectedScheduleSlot?.id || ''}
        existingScheduleSlot={selectedScheduleSlot || undefined}
        groupId={selectedGroup}
        day={selectedScheduleSlot ? getWeekdayInTimezone(selectedScheduleSlot.datetime, user?.timezone).toUpperCase() : ''}
        time={selectedScheduleSlot ? getTimeInTimezone(selectedScheduleSlot.datetime, user?.timezone) : ''}
        week={currentWeek}
      />

      {/* Child Assignment Modal */}
      {selectedScheduleSlot && (
        <ChildAssignmentModal
          scheduleSlot={selectedScheduleSlot}
          isOpen={isChildModalOpen}
          onClose={closeChildModal}
          preSelectedVehicleAssignmentId={selectedVehicleAssignmentId}
        />
      )}
    </PageLayout>
  );
};

export default SchedulePage;