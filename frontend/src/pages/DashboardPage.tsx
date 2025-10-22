import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useFamily } from '../contexts/FamilyContext';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '../services/apiService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { EmptyState } from '@/components/ui/empty-states';
import { GroupMembershipWarning } from '../components/GroupMembershipWarning';
import { PageLayout, LoadingState } from '@/components/ui/page-layout';
import { formatDatetimeInTimezone } from '../utils/timezoneUtils';
import {
  Users,
  Car,
  Calendar,
  UserPlus,
  Plus,
  Activity,
  Clock,
  MapPin,
  ArrowRight,
  Sparkles,
  User
} from 'lucide-react';

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { currentFamily, userPermissions } = useFamily();
  const navigate = useNavigate();

  // Fetch real children data
  const { data: children = [] } = useQuery({
    queryKey: ['children'],
    queryFn: () => apiService.getChildren(),
    enabled: !!user
  });


  // Fetch this week's trips with shorter cache for real-time updates
  const { data: weeklySchedule, isLoading: scheduleLoading, error: scheduleError } = useQuery({
    queryKey: ['weekly-schedule', user?.id],
    queryFn: () => apiService.getDashboardWeeklySchedule(),
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes for weekly data
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: true, // Refetch when user returns to tab
  });

  // Fetch recent activity with medium cache duration (family-based)
  const { data: recentActivity, isLoading: activityLoading } = useQuery({
    queryKey: ['recent-activity', currentFamily?.id],
    queryFn: () => apiService.getRecentActivity(),
    enabled: !!user && !!currentFamily,
    staleTime: 2 * 60 * 1000, // 2 minutes (shorter for more frequent updates)
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true, // Enable refetch on focus for better updates
  });

  const isDataLoading = scheduleLoading || activityLoading;


  const quickActions = [
    { 
      label: 'Join a Group', 
      variant: 'default' as const, 
      icon: Users,
      description: 'Connect with other families',
      onClick: () => navigate('/groups')
    },
    { 
      label: 'Add Child', 
      variant: 'secondary' as const, 
      icon: UserPlus,
      description: 'Register for transport',
      onClick: () => navigate('/children')
    },
    { 
      label: 'Add Vehicle', 
      variant: 'outline' as const, 
      icon: Car,
      description: 'Offer rides to others',
      onClick: () => navigate('/vehicles')
    },
  ];

  if (isDataLoading) {
    return (
      <PageLayout>
        <LoadingState />
      </PageLayout>
    );
  }

  return (
    <PageLayout data-testid="DashboardPage-Container-main">
        {/* Modern Welcome Section */}
        <header className="mb-8 md:mb-12" data-testid="DashboardPage-Container-welcome">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 mb-6">
            <Avatar className="h-12 w-12 sm:h-16 sm:w-16 ring-4 ring-primary/20 shadow-lg" data-testid="DashboardPage-Container-userProfile">
              <AvatarImage src="" />
              <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground text-sm sm:text-lg font-semibold">
                {user?.name?.split(' ').map(n => n[0]).join('').toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-2 flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 dark:from-slate-100 dark:to-slate-400 bg-clip-text text-transparent" data-testid="DashboardPage-Heading-welcomeMessage">
                  Welcome back, {user?.name?.split(' ')[0]}!
                </h1>
                <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-amber-500 animate-pulse" />
              </div>
              <p className="text-sm sm:text-base lg:text-lg text-muted-foreground font-medium">
                Your transport dashboard • {formatDatetimeInTimezone(new Date(), 'EEEE, MMMM d', user?.timezone)}
              </p>
            </div>
          </div>
        </header>

        {/* Family Information */}
        {currentFamily && (
          <section className="mb-8">
            <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-blue-200 dark:border-blue-800">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                      <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-semibold text-blue-900 dark:text-blue-100" data-testid="DashboardPage-Text-familyName">
                        {currentFamily.name}
                      </CardTitle>
                      <p className="text-sm text-blue-600 dark:text-blue-400">
                        {currentFamily.members.length} member{currentFamily.members.length !== 1 ? 's' : ''}
                        {currentFamily.children.length > 0 && (
                          <span data-testid="DashboardPage-Text-childrenCount">
                            {` • ${currentFamily.children.length} child${currentFamily.children.length !== 1 ? 'ren' : ''}`}
                          </span>
                        )}
                        {currentFamily.vehicles.length > 0 && (
                          <span data-testid="DashboardPage-Text-vehiclesCount">
                            {` • ${currentFamily.vehicles.length} vehicle${currentFamily.vehicles.length !== 1 ? 's' : ''}`}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      {userPermissions?.canManageMembers ? 'Admin' : 
                       userPermissions?.canModifyChildren ? 'Parent' : 'Member'}
                    </Badge>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => navigate('/family/manage')}
                      className="border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900"
                    >
                      Manage Family
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </section>
        )}


        {/* Warning for children without groups */}
        <GroupMembershipWarning 
          children={children} 
          variant="dashboard" 
          showDismiss={true} 
        />

        {/* Empty state for families with no children or vehicles */}
        {currentFamily && currentFamily.children.length === 0 && currentFamily.vehicles.length === 0 && (
          <EmptyState
            icon={Users}
            title="Welcome to your family!"
            description="Start by adding children and vehicles to begin coordinating transportation."
            className="my-8"
            data-testid="DashboardPage-Container-emptyState"
          />
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-8">
          {/* Left Column - Quick Actions & Recent Activity */}
          <section className="xl:col-span-2 space-y-6 lg:space-y-8">
            {/* Quick Actions */}
            <Card className="border-0 shadow-lg bg-gradient-to-br from-white via-white to-slate-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
              <CardHeader className="pb-6">
                <CardTitle className="flex items-center gap-3 text-xl font-bold">
                  <div className="p-2 rounded-xl bg-primary/10">
                    <Plus className="h-5 w-5 text-primary" />
                  </div>
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {quickActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <Button
                      key={action.label}
                      variant="ghost"
                      className="w-full justify-start h-auto p-6 group hover:bg-primary/5 hover:scale-[1.02] transition-all duration-200 border border-transparent hover:border-primary/20 rounded-xl"
                      onClick={action.onClick}
                      data-testid={`DashboardPage-Button-quickAction-${action.label.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <div className="flex items-center gap-4 w-full">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 group-hover:from-primary/20 group-hover:to-primary/10 transition-all duration-200">
                          <Icon className="h-6 w-6 text-primary" />
                        </div>
                        <div className="text-left flex-1">
                          <div className="font-semibold text-base text-slate-900 dark:text-slate-100" data-testid={`DashboardPage-Text-actionLabel-${action.label.toLowerCase().replace(/\s+/g, '-')}`}>{action.label}</div>
                          <div className="text-sm text-muted-foreground font-medium" data-testid={`DashboardPage-Text-actionDescription-${action.label.toLowerCase().replace(/\s+/g, '-')}`}>
                            {action.description}
                          </div>
                        </div>
                        <ArrowRight className="h-5 w-5 text-primary opacity-0 group-hover:opacity-100 transition-all duration-200 transform group-hover:translate-x-1" />
                      </div>
                    </Button>
                  );
                })}
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card className="border-0 shadow-lg bg-gradient-to-br from-white via-white to-slate-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
              <CardHeader className="pb-6">
                <CardTitle className="flex items-center gap-3 text-xl font-bold">
                  <div className="p-2 rounded-xl bg-primary/10">
                    <Activity className="h-5 w-5 text-primary" />
                  </div>
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                {recentActivity?.activities?.length ? (
                  <div className="space-y-4">
                    {recentActivity.activities.map((activity, index) => (
                      <div key={activity.id} className="group">
                        <div className="flex items-center gap-4 p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all duration-200">
                          <div className="p-3 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 group-hover:from-primary/20 group-hover:to-primary/10 transition-all">
                            {activity.type === 'group' ? 
                              <Users className="h-5 w-5 text-primary" /> : 
                              <Car className="h-5 w-5 text-primary" />
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate" data-testid={`DashboardPage-Text-activityAction-${activity.id}`}>{activity.action}</p>
                            <p className="text-xs text-muted-foreground font-medium mt-1" data-testid={`DashboardPage-Text-activityTime-${activity.id}`}>{activity.time}</p>
                          </div>
                          <div className="h-2 w-2 rounded-full bg-primary/30 group-hover:bg-primary/50 transition-colors" />
                        </div>
                        {index < recentActivity.activities.length - 1 && (
                          <Separator className="my-2 ml-16" />
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={Activity}
                    title="No recent activity"
                    description="Your activity will appear here as you use the app."
                    className="border-0 shadow-none"
                    data-testid="DashboardPage-Container-noRecentActivity"
                  />
                )}
              </CardContent>
            </Card>
          </section>

          {/* This Week's Trips */}
          <section>
            <Card className="border-0 shadow-lg bg-gradient-to-br from-white via-white to-slate-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
              <CardHeader className="pb-6">
                <CardTitle className="flex items-center gap-3 text-xl font-bold">
                  <div className="p-2 rounded-xl bg-primary/10">
                    <Clock className="h-5 w-5 text-primary" />
                  </div>
                  This Week's Trips
                </CardTitle>
              </CardHeader>
              <CardContent>
                {scheduleError ? (
                  <EmptyState
                    icon={Calendar}
                    title="Unable to load schedule"
                    description="There was an issue loading your schedule. Please try again."
                    className="border-0 shadow-none"
                    data-testid="DashboardPage-Container-unableToLoadSchedule"
                  />
                ) : weeklySchedule?.upcomingTrips?.length ? (
                  <div className="space-y-4">
                    {weeklySchedule.upcomingTrips.map((trip) => (
                      <div key={trip.id} className="group p-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-gradient-to-r from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 hover:shadow-md hover:border-primary/30 transition-all duration-200">
                        <div className="flex items-start gap-4">
                          <Badge 
                            variant={trip.type === 'pickup' ? 'default' : 'secondary'}
                            className="text-sm font-semibold px-3 py-1.5 mt-1"
                            data-testid={`DashboardPage-Badge-tripTime-${trip.id}`}
                          >
                            {trip.time}
                          </Badge>
                          <div className="flex-1 min-w-0 space-y-3">
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-primary" />
                              <p className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate" data-testid={`DashboardPage-Text-tripDestination-${trip.id}`}>
                                {trip.destination}
                              </p>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                              <span className="font-medium text-muted-foreground" data-testid={`DashboardPage-Text-tripType-${trip.id}`}>
                                {trip.type === 'pickup' ? 'Pick up' : 'Drop off'}
                              </span>
                              <span className="text-muted-foreground">•</span>
                              <span className="font-medium text-primary" data-testid={`DashboardPage-Text-tripDate-${trip.id}`}>
                                {trip.date}
                              </span>
                            </div>
                            
                            {/* Vehicle Information */}
                            {trip.vehicle && (
                              <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                                <Car className="h-4 w-4 text-primary" />
                                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                  {trip.vehicle.name} • {trip.vehicle.capacity} seats
                                  {trip.driver && (
                                    <span className="text-muted-foreground ml-2">
                                      • Driver: {trip.driver.name}
                                    </span>
                                  )}
                                </p>
                              </div>
                            )}
                            
                            {/* Children Information */}
                            {trip.children && trip.children.length > 0 && (
                              <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                                <User className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5" />
                                <div className="flex flex-wrap gap-2">
                                  {trip.children.map((child) => (
                                    <Badge key={child.id} variant="outline" className="text-xs font-medium bg-white dark:bg-slate-800">
                                      {child.name}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={Calendar}
                    title="No trips this week"
                    description="Your schedule is clear for this week."
                    className="border-0 shadow-none"
                    data-testid="DashboardPage-Container-noTripsThisWeek"
                  />
                )}
              </CardContent>
            </Card>
          </section>
        </div>
      </PageLayout>
  );
};

export default DashboardPage;