import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { scheduleConfigService, type ScheduleHours, type GroupScheduleConfig } from '../services/scheduleConfigService';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '@/components/ui/tabs';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Plus,
  Trash2,
  Clock,
  RotateCcw,
  Save,
  AlertTriangle,
  Info,
  Copy
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { convertScheduleHoursToLocal, convertScheduleHoursToUtc } from '@/utils/timezoneUtils';
import { getErrorMessage } from '@/utils/errorUtils';

interface GroupScheduleConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  groupName: string;
  currentConfig: GroupScheduleConfig | null;
  isAdmin: boolean;
}

const WEEKDAYS = [
  { key: 'MONDAY', label: 'Monday', shortLabel: 'Mon' },
  { key: 'TUESDAY', label: 'Tuesday', shortLabel: 'Tue' },
  { key: 'WEDNESDAY', label: 'Wednesday', shortLabel: 'Wed' },
  { key: 'THURSDAY', label: 'Thursday', shortLabel: 'Thu' },
  { key: 'FRIDAY', label: 'Friday', shortLabel: 'Fri' }
];

const DEFAULT_TIME_SLOTS = [
  '06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
  '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00', '18:30', '19:00', '19:30', '20:00'
];

export const GroupScheduleConfigModal: React.FC<GroupScheduleConfigModalProps> = ({
  isOpen,
  onClose,
  groupId,
  groupName,
  currentConfig,
  isAdmin
}) => {
  const [scheduleHours, setScheduleHours] = useState<ScheduleHours>({});
  const [activeWeekday, setActiveWeekday] = useState<string>('MONDAY');
  const [newTimeSlot, setNewTimeSlot] = useState<string>('07:00');
  const [hasChanges, setHasChanges] = useState(false);
  const [copyFromDay, setCopyFromDay] = useState<string>('');
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Get user timezone, fallback to browser timezone
  const userTimezone = user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Initialize schedule hours when modal opens
  // IMPORTANT: Convert UTC times from backend to local times for display
  useEffect(() => {
    if (currentConfig && isOpen && userTimezone) {
      // Convert UTC scheduleHours to local timezone for display
      const localScheduleHours = convertScheduleHoursToLocal(
        currentConfig.scheduleHours,
        userTimezone
      );
      setScheduleHours(localScheduleHours);
      setHasChanges(false);
    }
  }, [currentConfig, isOpen, userTimezone]);

  // Update schedule configuration mutation
  // IMPORTANT: Convert local times to UTC before sending to backend
  const updateConfigMutation = useMutation({
    mutationFn: (localScheduleHours: ScheduleHours) => {
      // Convert local scheduleHours to UTC for backend
      const utcScheduleHours = convertScheduleHoursToUtc(
        localScheduleHours,
        userTimezone
      );
      return scheduleConfigService.updateGroupScheduleConfig(groupId, utcScheduleHours);
    },
    onSuccess: () => {
      toast.success('Schedule configuration updated successfully');
      queryClient.invalidateQueries({ queryKey: ['group-schedule-config', groupId] });
      queryClient.invalidateQueries({ queryKey: ['weekly-schedule', groupId] });
      setHasChanges(false);
      onClose();
    },
    onError: (error: Error) => {
      toast.error('Failed to update schedule configuration', {
        description: getErrorMessage(error)
      });
    }
  });

  // Reset to default configuration mutation
  const resetConfigMutation = useMutation({
    mutationFn: () => scheduleConfigService.resetGroupScheduleConfig(groupId),
    onSuccess: () => {
      toast.success('Schedule configuration reset to default');
      queryClient.invalidateQueries({ queryKey: ['group-schedule-config', groupId] });
      queryClient.invalidateQueries({ queryKey: ['weekly-schedule', groupId] });
      setHasChanges(false);
      onClose();
    },
    onError: (error: Error) => {
      toast.error('Failed to reset schedule configuration', {
        description: getErrorMessage(error)
      });
    }
  });

  const handleAddTimeSlot = () => {
    if (!newTimeSlot || !activeWeekday) return;

    const currentSlots = scheduleHours[activeWeekday] || [];
    
    // Check if time slot already exists
    if (currentSlots.includes(newTimeSlot)) {
      toast.error('Time slot already exists for this day');
      return;
    }

    // Check maximum slots limit
    if (currentSlots.length >= 20) {
      toast.error('Maximum 20 time slots allowed per weekday');
      return;
    }

    const updatedSlots = [...currentSlots, newTimeSlot].sort();
    
    setScheduleHours(prev => ({
      ...prev,
      [activeWeekday]: updatedSlots
    }));
    setHasChanges(true);
    
    // Reset to next available time slot
    const nextSlot = DEFAULT_TIME_SLOTS.find(slot => 
      !updatedSlots.includes(slot) && slot > newTimeSlot
    );
    if (nextSlot) {
      setNewTimeSlot(nextSlot);
    }
  };

  const handleRemoveTimeSlot = (weekday: string, timeSlot: string) => {
    const currentSlots = scheduleHours[weekday] || [];
    const updatedSlots = currentSlots.filter(slot => slot !== timeSlot);
    
    setScheduleHours(prev => ({
      ...prev,
      [weekday]: updatedSlots
    }));
    setHasChanges(true);
  };

  const handleSaveConfiguration = () => {
    updateConfigMutation.mutate(scheduleHours);
  };

  const handleResetToDefault = () => {
    if (confirm('Are you sure you want to reset to default configuration? This will replace all current settings.')) {
      resetConfigMutation.mutate();
    }
  };

  const handleCopyFromDay = () => {
    if (!copyFromDay || copyFromDay === activeWeekday) {
      toast.error('Please select a different day to copy from');
      return;
    }

    const sourceSlots = scheduleHours[copyFromDay] || [];
    if (sourceSlots.length === 0) {
      toast.error(`No time slots configured for ${WEEKDAYS.find(w => w.key === copyFromDay)?.label}`);
      return;
    }

    const currentSlots = scheduleHours[activeWeekday] || [];
    if (currentSlots.length > 0) {
      const sourceDayLabel = WEEKDAYS.find(w => w.key === copyFromDay)?.label;
      const targetDayLabel = WEEKDAYS.find(w => w.key === activeWeekday)?.label;
      if (!confirm(`This will replace all ${currentSlots.length} time slot(s) in ${targetDayLabel} with ${sourceSlots.length} time slot(s) from ${sourceDayLabel}. Continue?`)) {
        return;
      }
    }

    setScheduleHours(prev => ({
      ...prev,
      [activeWeekday]: [...sourceSlots]
    }));
    setHasChanges(true);
    setCopyFromDay('');
    
    const sourceDayLabel = WEEKDAYS.find(w => w.key === copyFromDay)?.label;
    const targetDayLabel = WEEKDAYS.find(w => w.key === activeWeekday)?.label;
    toast.success(`Copied ${sourceSlots.length} time slots from ${sourceDayLabel} to ${targetDayLabel}`);
  };

  const validateTimeSlots = (slots: string[]): string[] => {
    const errors: string[] = [];
    
    // Check for minimum interval (15 minutes)
    const sortedSlots = [...slots].sort();
    for (let i = 0; i < sortedSlots.length - 1; i++) {
      const currentTime = new Date(`2000-01-01T${sortedSlots[i]}:00`);
      const nextTime = new Date(`2000-01-01T${sortedSlots[i + 1]}:00`);
      const diffMinutes = (nextTime.getTime() - currentTime.getTime()) / (1000 * 60);
      
      if (diffMinutes < 15) {
        errors.push(`Time slots ${sortedSlots[i]} and ${sortedSlots[i + 1]} are too close (minimum 15 minutes required)`);
      }
    }
    
    return errors;
  };

  const getWeekdayErrors = (weekday: string): string[] => {
    const slots = scheduleHours[weekday] || [];
    return validateTimeSlots(slots);
  };

  const hasAnyErrors = (): boolean => {
    return WEEKDAYS.some(weekday => getWeekdayErrors(weekday.key).length > 0);
  };

  const getTotalTimeSlots = (): number => {
    return Object.values(scheduleHours).reduce((total, slots) => total + (slots?.length || 0), 0);
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={() => !hasChanges && onClose()}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] p-0 overflow-hidden flex flex-col gap-0" data-testid="GroupScheduleConfigModal-Content-dialog">
        <DialogHeader className="flex-shrink-0 p-6 pb-4">
          <DialogTitle className="flex items-center gap-2 text-xl md:text-2xl" data-testid="GroupScheduleConfigModal-Title-scheduleConfig">
            <Clock className="h-5 w-5" />
            <span className="truncate">Schedule Configuration - {groupName}</span>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Configure time slots for each weekday for the {groupName} group schedule
          </DialogDescription>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm md:text-base text-muted-foreground">
            <div className="flex items-center gap-1" data-testid="GroupScheduleConfigModal-Text-description">
              <Info className="h-4 w-4" />
              Configure time slots for each weekday
            </div>
            {currentConfig?.isDefault && (
              <Badge variant="secondary" className="w-fit" data-testid="GroupScheduleConfigModal-Badge-defaultConfig">Using Default Configuration</Badge>
            )}
          </div>
          {/* Timezone indicator */}
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg" data-testid="GroupScheduleConfigModal-Alert-timezoneInfo">
            <div className="flex items-start gap-2 text-sm">
              <Info className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-blue-900 font-medium">Horaires affichés dans votre fuseau horaire</p>
                <p className="text-blue-700 text-xs mt-1">
                  Fuseau horaire : <span className="font-mono">{userTimezone}</span>
                </p>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6">
          {!isAdmin && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4 flex-shrink-0" data-testid="GroupScheduleConfigModal-Alert-readOnlyMode">
              <div className="flex items-center gap-2 text-amber-800">
                <AlertTriangle className="h-4 w-4" />
                <span className="font-medium">Read-only mode</span>
              </div>
              <p className="text-sm text-amber-700 mt-1">
                Only group administrators can modify schedule configurations.
              </p>
            </div>
          )}

          <div className="space-y-6 pb-4">
          {/* Summary Stats */}
          <Card data-testid="GroupScheduleConfigModal-Card-configurationSummary">
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">Configuration Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center" data-testid="GroupScheduleConfigModal-Container-totalTimeSlots">
                  <div className="text-lg md:text-xl font-bold text-primary" data-testid="GroupScheduleConfigModal-Text-totalTimeSlotsValue">{getTotalTimeSlots()}</div>
                  <div className="text-xs md:text-sm text-muted-foreground">Total Time Slots</div>
                </div>
                <div className="text-center" data-testid="GroupScheduleConfigModal-Container-activeWeekdays">
                  <div className="text-lg md:text-xl font-bold text-primary" data-testid="GroupScheduleConfigModal-Text-activeWeekdaysValue">
                    {WEEKDAYS.filter(w => (scheduleHours[w.key]?.length || 0) > 0).length}
                  </div>
                  <div className="text-xs md:text-sm text-muted-foreground">Active Weekdays</div>
                </div>
                <div className="text-center" data-testid="GroupScheduleConfigModal-Container-avgPerDay">
                  <div className="text-lg md:text-xl font-bold text-primary" data-testid="GroupScheduleConfigModal-Text-avgPerDayValue">
                    {Math.round(getTotalTimeSlots() / 5)}
                  </div>
                  <div className="text-xs md:text-sm text-muted-foreground">Avg per Day</div>
                </div>
                <div className="text-center" data-testid="GroupScheduleConfigModal-Container-configurationStatus">
                  <div className={`text-lg md:text-xl font-bold ${hasAnyErrors() ? 'text-red-600' : 'text-green-600'}`} data-testid="GroupScheduleConfigModal-Text-configurationStatusValue">
                    {hasAnyErrors() ? 'Issues' : 'Valid'}
                  </div>
                  <div className="text-xs md:text-sm text-muted-foreground">Configuration</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Weekday Tabs */}
          <Tabs value={activeWeekday} onValueChange={setActiveWeekday} className="w-full" data-testid="GroupScheduleConfigModal-Tabs-weekdayTabs">
            <div className="sticky top-0 bg-white z-10 pb-4">
              <TabsList className="grid grid-cols-5 w-full">
                {WEEKDAYS.map(weekday => {
                  const slotCount = scheduleHours[weekday.key]?.length || 0;
                  const hasErrors = getWeekdayErrors(weekday.key).length > 0;
                  
                  return (
                    <TabsTrigger 
                      key={weekday.key} 
                      value={weekday.key}
                      className="flex flex-col gap-1 p-2 h-auto min-h-[60px] text-xs md:text-sm"
                      data-testid={`GroupScheduleConfigModal-Tab-${weekday.key.toLowerCase()}`}
                    >
                      <span className="truncate">{weekday.shortLabel}</span>
                      <div className="flex items-center justify-center gap-1">
                        <Badge 
                          variant={hasErrors ? "destructive" : slotCount > 0 ? "default" : "secondary"}
                          className="text-xs px-1 py-0 min-w-[20px] justify-center"
                          data-testid={`GroupScheduleConfigModal-Badge-${weekday.key.toLowerCase()}SlotCount`}
                        >
                          {slotCount}
                        </Badge>
                        {hasErrors && <AlertTriangle className="h-3 w-3 text-red-500 flex-shrink-0" />}
                      </div>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>

            {WEEKDAYS.map(weekday => (
              <TabsContent key={weekday.key} value={weekday.key} className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{weekday.label} Time Slots</span>
                      <Badge variant="outline">
                        {scheduleHours[weekday.key]?.length || 0} / 20 slots
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      Configure the available time slots for {weekday.label}. 
                      Time slots must be at least 15 minutes apart.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Add new time slot */}
                    {isAdmin && (
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <select 
                          value={newTimeSlot}
                          onChange={(e) => setNewTimeSlot(e.target.value)}
                          className="flex-1 p-2 border rounded-lg text-sm"
                          data-testid="GroupScheduleConfigModal-Select-newTimeSlot"
                        >
                          {DEFAULT_TIME_SLOTS
                            .filter(slot => !(scheduleHours[weekday.key] || []).includes(slot))
                            .map(slot => (
                              <option key={slot} value={slot}>{slot}</option>
                            ))}
                        </select>
                        <Button 
                          onClick={handleAddTimeSlot}
                          disabled={!newTimeSlot || (scheduleHours[weekday.key]?.length || 0) >= 20}
                          className="gap-2 w-full sm:w-auto"
                          size="sm"
                          data-testid="GroupScheduleConfigModal-Button-addTimeSlot"
                        >
                          <Plus className="h-4 w-4" />
                          <span className="sm:inline">Add Time Slot</span>
                        </Button>
                      </div>
                    )}

                    {/* Copy from another day */}
                    {isAdmin && (
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 border-t">
                        <select 
                          value={copyFromDay}
                          onChange={(e) => setCopyFromDay(e.target.value)}
                          className="flex-1 p-2 border rounded-lg text-sm"
                          data-testid="GroupScheduleConfigModal-Select-copyFromDay"
                        >
                          <option value="">Copy from another day...</option>
                          {WEEKDAYS
                            .filter(w => w.key !== weekday.key && (scheduleHours[w.key]?.length || 0) > 0)
                            .map(w => (
                              <option key={w.key} value={w.key}>
                                {w.label} ({scheduleHours[w.key]?.length || 0} slots)
                              </option>
                            ))}
                        </select>
                        <Button 
                          onClick={handleCopyFromDay}
                          disabled={!copyFromDay || copyFromDay === weekday.key}
                          variant="outline"
                          className="gap-2 w-full sm:w-auto"
                          size="sm"
                          data-testid="GroupScheduleConfigModal-Button-copyFromDay"
                        >
                          <Copy className="h-4 w-4" />
                          <span className="sm:inline">Copy Schedule</span>
                        </Button>
                      </div>
                    )}

                    {/* Show validation errors */}
                    {getWeekdayErrors(weekday.key).length > 0 && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 text-red-800 mb-2">
                          <AlertTriangle className="h-4 w-4" />
                          <span className="font-medium">Configuration Issues</span>
                        </div>
                        <ul className="text-sm text-red-700 space-y-1">
                          {getWeekdayErrors(weekday.key).map((error, index) => (
                            <li key={index}>• {error}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Time slots grid */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                      {(scheduleHours[weekday.key] || []).sort().map(timeSlot => (
                        <div 
                          key={timeSlot}
                          className="flex items-center justify-between p-2 md:p-3 bg-gray-50 rounded-lg border min-w-0"
                        >
                          <span className="font-mono text-sm truncate flex-1">{timeSlot}</span>
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveTimeSlot(weekday.key, timeSlot)}
                              className="h-6 w-6 p-0 hover:bg-red-100 hover:text-red-600 flex-shrink-0 ml-1"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Empty state */}
                    {(!scheduleHours[weekday.key] || scheduleHours[weekday.key].length === 0) && (
                      <div className="text-center py-8 text-muted-foreground">
                        <Clock className="h-12 w-12 mx-auto mb-2 opacity-40" />
                        <p>No time slots configured for {weekday.label}</p>
                        <p className="text-sm">Add time slots to enable scheduling for this day</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 flex flex-col-reverse md:flex-row items-stretch md:items-center justify-end gap-3 pt-6 pb-4 px-6 border-t">
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 md:gap-4">
            {isAdmin && (
              <>
                <Button
                  variant="outline"
                  onClick={handleResetToDefault}
                  disabled={updateConfigMutation.isPending || resetConfigMutation.isPending}
                  className="gap-2 w-full md:w-auto"
                  data-testid="GroupScheduleConfigModal-Button-resetToDefault"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span className="hidden md:inline">Reset to Default</span>
                  <span className="md:hidden">Reset</span>
                </Button>
                <Button
                  onClick={handleSaveConfiguration}
                  disabled={!hasChanges || hasAnyErrors() || updateConfigMutation.isPending}
                  className="gap-2 w-full md:w-auto"
                  data-testid="GroupScheduleConfigModal-Button-saveConfiguration"
                >
                  <Save className="h-4 w-4" />
                  {updateConfigMutation.isPending ? 'Saving...' : (
                    <>
                      <span className="hidden md:inline">Save Configuration</span>
                      <span className="md:hidden">Save</span>
                    </>
                  )}
                </Button>
              </>
            )}
            <Button variant="outline" onClick={onClose} className="w-full md:w-auto" data-testid="GroupScheduleConfigModal-Button-close">
              {isAdmin ? 'Cancel' : 'Close'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};