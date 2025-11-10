import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { useConnectionStore } from '@/stores/connectionStore';
import { SOCKET_EVENTS, type ScheduleEventData, type GroupEventData, type UserEventData, type NotificationEventData, type ConflictEventData, type ChildEventData, type VehicleEventData, type FamilyEventData, type CapacityEventData } from '../shared/events';
import { SOCKET_URL } from '@/config/runtime';
import { secureStorage } from '@/utils/secureStorage';
import { authService } from '../services/authService';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

interface SocketProviderProps {
  children: ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { isAuthenticated, user } = useAuth();
  const queryClient = useQueryClient();
  const { setWsStatus } = useConnectionStore();

  useEffect(() => {
    let authToken: string | null = null;

    // Try to get token from authService first (synchronously)
    authToken = authService.getToken();

    // If no token from context and user is authenticated, try secure storage (async)
    if (!authToken && isAuthenticated && user) {
      const getSecureToken = async () => {
        try {
          const token = await secureStorage.getItem('authToken');
          if (token && !socket) {
            // We got the token asynchronously, but we need to recreate the socket
            // This will trigger the effect again with the token
            // This is a limitation of the current architecture
            console.log('Got token from secure storage asynchronously');
          }
        } catch (error) {
          console.error('Failed to get auth token from secure storage:', error);
        }
      };
      getSecureToken();
    }

    if (isAuthenticated && user && authToken) {
      console.log('Creating new socket connection with fresh token');
      console.log('Socket URL:', SOCKET_URL);

      // Try to create socket with error handling and fallback
      let newSocket: Socket | null = null;
      const createSocketWithFallback = (transportOnly?: string[]) => {
        try {
          return io(SOCKET_URL, {
            auth: {
              token: authToken
            },
            autoConnect: true,
            reconnection: true,
            reconnectionDelay: 3000,    // Start with 3 seconds
            reconnectionDelayMax: 30000, // Max 30 seconds
            reconnectionAttempts: 3,     // Reduced to 3 attempts
            timeout: 10000,             // 10 second connection timeout
            transports: transportOnly || (import.meta.env.VITE_SOCKET_FORCE_POLLING === 'true'
              ? ['polling']
              : ['websocket', 'polling'])
          });
        } catch (error) {
          console.error('Failed to create socket with transports', transportOnly, ':', error);
          return null;
        }
      };

      // Try WebSocket first, then fallback to polling only
      newSocket = createSocketWithFallback();

      // If WebSocket fails and not already forcing polling, try polling only
      if (!newSocket && import.meta.env.VITE_SOCKET_FORCE_POLLING !== 'true') {
        console.warn('WebSocket connection failed, trying polling-only fallback...');
        newSocket = createSocketWithFallback(['polling']);
      }

      // If all socket creation attempts failed
      if (!newSocket) {
        console.error('All connection attempts failed. Application will work without real-time features.');
        setWsStatus('error', 'Real-time features unavailable. Application will work normally.');
        return;
      }

      // Update connection status to connecting
      setWsStatus('connecting');

      // Connection event handlers
      newSocket.on('connect', () => {
        console.log('Socket connected:', newSocket.id);
        setIsConnected(true);
        setWsStatus('connected');
      });

      newSocket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        setIsConnected(false);
        
        // Different handling based on disconnect reason
        if (reason === 'io server disconnect') {
          // Server initiated disconnect
          setWsStatus('disconnected', 'Server disconnected the connection');
        } else if (reason === 'io client disconnect') {
          // Client initiated disconnect (e.g., user logout)
          setWsStatus('disconnected');
        } else {
          // Connection lost
          setWsStatus('disconnected', 'Connection lost. Attempting to reconnect...');
        }
      });

      newSocket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        setIsConnected(false);

        // Provide user-friendly error messages that don't break the app
        let errorMessage = 'Real-time updates unavailable. Application will work normally.';

        if (error.message.includes('ECONNREFUSED')) {
          errorMessage = 'Real-time features temporarily unavailable. All other features will work normally.';
        } else if (error.message.includes('Unauthorized')) {
          errorMessage = 'Session expired for real-time updates. Please refresh if needed.';
        } else if (error.message.includes('timeout')) {
          errorMessage = 'Real-time connection timeout. Application continues to work normally.';
        } else if (error.message.includes('WebSocket')) {
          errorMessage = 'WebSocket connection failed. Using fallback transport.';
        }

        setWsStatus('error', errorMessage);

        // Don't throw - let the app continue normally
        console.info('Application continues to work without real-time updates');
      });

      // Reconnection events
      newSocket.on('reconnect_attempt', (attemptNumber) => {
        console.log('Attempting to reconnect...', attemptNumber);
        setWsStatus('connecting', `Reconnecting... (attempt ${attemptNumber})`);
      });

      newSocket.on('reconnect', (attemptNumber) => {
        console.log('Reconnected after', attemptNumber, 'attempts');
        setIsConnected(true);
        setWsStatus('connected');
      });

      newSocket.on('reconnect_failed', () => {
        console.error('Failed to reconnect after maximum attempts');
        setWsStatus('error', 'Real-time features temporarily disabled. Application continues to work normally.');
        console.info('Application will continue without real-time updates. Manual refresh may restore real-time features.');
      });

      // Real-time event handlers - CENTRALIZED HANDLING
      
      // Schedule-related events (new standardized names)
      newSocket.on(SOCKET_EVENTS.SCHEDULE_UPDATED, (data: ScheduleEventData) => {
        console.log('🔄 SCHEDULE_UPDATED:', data);
        queryClient.invalidateQueries({ queryKey: ['schedule', data.groupId] });
        queryClient.invalidateQueries({ queryKey: ['weekly-schedule', data.groupId] });
        queryClient.invalidateQueries({ queryKey: ['timeslots', data.groupId] });
      });
      
      newSocket.on(SOCKET_EVENTS.SCHEDULE_SLOT_UPDATED, (data: ScheduleEventData) => {
        console.log('🔄 SCHEDULE_SLOT_UPDATED:', data);
        queryClient.invalidateQueries({ queryKey: ['schedule', data.groupId] });
        queryClient.invalidateQueries({ queryKey: ['weekly-schedule', data.groupId] });
        if (data.scheduleSlotId) {
          queryClient.invalidateQueries({ queryKey: ['schedule-slot', data.scheduleSlotId] });
        }
      });
      
      newSocket.on(SOCKET_EVENTS.SCHEDULE_SLOT_CREATED, (data: ScheduleEventData) => {
        console.log('🔄 SCHEDULE_SLOT_CREATED:', data);
        queryClient.invalidateQueries({ queryKey: ['schedule', data.groupId] });
        queryClient.invalidateQueries({ queryKey: ['weekly-schedule', data.groupId] });
      });
      
      newSocket.on(SOCKET_EVENTS.SCHEDULE_SLOT_DELETED, (data: ScheduleEventData) => {
        console.log('🔄 SCHEDULE_SLOT_DELETED:', data);
        queryClient.invalidateQueries({ queryKey: ['schedule', data.groupId] });
        queryClient.invalidateQueries({ queryKey: ['weekly-schedule', data.groupId] });
        if (data.scheduleSlotId) {
          queryClient.removeQueries({ queryKey: ['schedule-slot', data.scheduleSlotId] });
        }
      });


      // Child management events
      newSocket.on(SOCKET_EVENTS.CHILD_ADDED, (data: ChildEventData) => {
        console.log('🔄 CHILD_ADDED:', data);
        if (data.userId === user.id) {
          queryClient.invalidateQueries({ queryKey: ['children'] });
          queryClient.invalidateQueries({ queryKey: ['weekly-schedule'] });
          queryClient.invalidateQueries({ queryKey: ['schedule-slot'] });
          if (data.familyId) {
            queryClient.invalidateQueries({ queryKey: ['recent-activity', data.familyId] });
          }
        }
      });

      newSocket.on(SOCKET_EVENTS.CHILD_UPDATED, (data: ChildEventData) => {
        console.log('🔄 CHILD_UPDATED:', data);
        if (data.userId === user.id) {
          queryClient.invalidateQueries({ queryKey: ['children'] });
          queryClient.invalidateQueries({ queryKey: ['weekly-schedule'] });
          queryClient.invalidateQueries({ queryKey: ['schedule-slot'] });
          if (data.familyId) {
            queryClient.invalidateQueries({ queryKey: ['recent-activity', data.familyId] });
          }
        }
      });

      newSocket.on(SOCKET_EVENTS.CHILD_DELETED, (data: ChildEventData) => {
        console.log('🔄 CHILD_DELETED:', data);
        if (data.userId === user.id) {
          queryClient.invalidateQueries({ queryKey: ['children'] });
          queryClient.invalidateQueries({ queryKey: ['weekly-schedule'] });
          queryClient.invalidateQueries({ queryKey: ['schedule-slot'] });
          if (data.familyId) {
            queryClient.invalidateQueries({ queryKey: ['recent-activity', data.familyId] });
          }
        }
      });

      // Vehicle management events  
      newSocket.on(SOCKET_EVENTS.VEHICLE_ADDED, (data: VehicleEventData) => {
        console.log('🔄 VEHICLE_ADDED:', data);
        if (data.userId === user.id) {
          queryClient.invalidateQueries({ queryKey: ['vehicles'] });
          queryClient.invalidateQueries({ queryKey: ['weekly-schedule'] });
          queryClient.invalidateQueries({ queryKey: ['schedule-slot'] });
          if (data.familyId) {
            queryClient.invalidateQueries({ queryKey: ['recent-activity', data.familyId] });
          }
        }
      });

      newSocket.on(SOCKET_EVENTS.VEHICLE_UPDATED, (data: VehicleEventData) => {
        console.log('🔄 VEHICLE_UPDATED:', data);
        if (data.userId === user.id) {
          queryClient.invalidateQueries({ queryKey: ['vehicles'] });
          queryClient.invalidateQueries({ queryKey: ['weekly-schedule'] });
          queryClient.invalidateQueries({ queryKey: ['schedule-slot'] });
          if (data.familyId) {
            queryClient.invalidateQueries({ queryKey: ['recent-activity', data.familyId] });
          }
        }
      });

      newSocket.on(SOCKET_EVENTS.VEHICLE_DELETED, (data: VehicleEventData) => {
        console.log('🔄 VEHICLE_DELETED:', data);
        if (data.userId === user.id) {
          queryClient.invalidateQueries({ queryKey: ['vehicles'] });
          queryClient.invalidateQueries({ queryKey: ['weekly-schedule'] });
          queryClient.invalidateQueries({ queryKey: ['schedule-slot'] });
          if (data.familyId) {
            queryClient.invalidateQueries({ queryKey: ['recent-activity', data.familyId] });
          }
        }
      });

      // Notification events
      newSocket.on(SOCKET_EVENTS.NOTIFICATION, (data: NotificationEventData) => {
        console.log('🔔 NOTIFICATION:', data);
        // Here you could show toast notifications or update a notification center
        // For now, we'll just log it
      });
      
      // Conflict detection events
      newSocket.on(SOCKET_EVENTS.CONFLICT_DETECTED, (data: ConflictEventData) => {
        console.log('⚠️ CONFLICT_DETECTED:', data);
        // Could show toast warning about conflicts
      });
      
      // Capacity warning events
      newSocket.on(SOCKET_EVENTS.SCHEDULE_SLOT_CAPACITY_WARNING, (data: CapacityEventData) => {
        console.log('⚠️ CAPACITY_WARNING:', data);
        // Could show toast about approaching capacity
      });
      
      newSocket.on(SOCKET_EVENTS.SCHEDULE_SLOT_CAPACITY_FULL, (data: CapacityEventData) => {
        console.log('🚫 CAPACITY_FULL:', data);
        // Could show toast about full capacity
      });

      // Family activity events - invalidate activity feed for real-time updates
      newSocket.on(SOCKET_EVENTS.FAMILY_MEMBER_JOINED, (data: FamilyEventData) => {
        console.log('🔄 FAMILY_MEMBER_JOINED:', data);
        queryClient.invalidateQueries({ queryKey: ['recent-activity', data.familyId] });
        queryClient.invalidateQueries({ queryKey: ['families'] });
      });

      newSocket.on(SOCKET_EVENTS.FAMILY_MEMBER_LEFT, (data: FamilyEventData) => {
        console.log('🔄 FAMILY_MEMBER_LEFT:', data);
        queryClient.invalidateQueries({ queryKey: ['recent-activity', data.familyId] });
        queryClient.invalidateQueries({ queryKey: ['families'] });
      });

      newSocket.on(SOCKET_EVENTS.FAMILY_UPDATED, (data: FamilyEventData) => {
        console.log('🔄 FAMILY_UPDATED:', data);
        queryClient.invalidateQueries({ queryKey: ['recent-activity', data.familyId] });
        queryClient.invalidateQueries({ queryKey: ['families'] });
        if (data.familyId) {
          queryClient.invalidateQueries({ queryKey: ['family', data.familyId] });
        }
      });

      // Invalidate activity feed for existing events that affect family activity
      // Group management events
      newSocket.on(SOCKET_EVENTS.GROUP_UPDATED, (data: GroupEventData) => {
        console.log('🔄 GROUP_UPDATED:', data);
        queryClient.invalidateQueries({ queryKey: ['groups'] });
        queryClient.invalidateQueries({ queryKey: ['user-groups'] });
        queryClient.invalidateQueries({ queryKey: ['group-members', data.groupId] });
        if (data.groupId) {
          queryClient.invalidateQueries({ queryKey: ['group', data.groupId] });
          queryClient.invalidateQueries({ queryKey: ['group-families', data.groupId] });
        }
        if (data.familyId) {
          queryClient.invalidateQueries({ queryKey: ['recent-activity', data.familyId] });
        }
      });

      newSocket.on(SOCKET_EVENTS.MEMBER_JOINED, (data: UserEventData) => {
        console.log('🔄 MEMBER_JOINED:', data);
        queryClient.invalidateQueries({ queryKey: ['groups'] });
        queryClient.invalidateQueries({ queryKey: ['user-groups'] });
        queryClient.invalidateQueries({ queryKey: ['group-members', data.groupId] });
        if (data.groupId) {
          queryClient.invalidateQueries({ queryKey: ['group', data.groupId] });
          queryClient.invalidateQueries({ queryKey: ['group-families', data.groupId] });
        }
        if (data.familyId) {
          queryClient.invalidateQueries({ queryKey: ['recent-activity', data.familyId] });
        }
      });

      newSocket.on(SOCKET_EVENTS.MEMBER_LEFT, (data: UserEventData) => {
        console.log('🔄 MEMBER_LEFT:', data);
        queryClient.invalidateQueries({ queryKey: ['groups'] });
        queryClient.invalidateQueries({ queryKey: ['user-groups'] });
        queryClient.invalidateQueries({ queryKey: ['group-members', data.groupId] });
        if (data.groupId) {
          queryClient.invalidateQueries({ queryKey: ['group', data.groupId] });
          queryClient.invalidateQueries({ queryKey: ['group-families', data.groupId] });
        }
        if (data.familyId) {
          queryClient.invalidateQueries({ queryKey: ['recent-activity', data.familyId] });
        }
      });

      setSocket(newSocket);

      return () => {
        console.log('Cleaning up socket connection');
        newSocket.close();
        setSocket(null);
        setIsConnected(false);
      };
    } else {
      // User is not authenticated, cleanup any existing socket
      if (socket) {
        socket.close();
        setSocket(null);
        setIsConnected(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user, queryClient, setWsStatus]); // Removed 'socket' to prevent infinite loop

  const value: SocketContextType = {
    socket,
    isConnected
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};