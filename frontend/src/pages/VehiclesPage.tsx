import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { usePageState } from '../hooks/usePageState';
import { useFamily } from '../contexts/FamilyContext';
import type { Vehicle } from '@/types/api';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingState, ErrorState, EmptyVehicles } from '@/components/ui/empty-states';
import { PageLayout, PageHeader, ModernButton, ModernCard } from '@/components/ui/page-layout';
import { Plus, Edit2, Trash2, Car, ArrowLeft, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { VEHICLE_CONSTRAINTS } from '../constants/vehicle';

const VehiclesPage: React.FC = () => {
  const navigate = useNavigate();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [formData, setFormData] = useState({ name: '', capacity: '' });
  const [vehicleToDelete, setVehicleToDelete] = useState<Vehicle | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string>('');
  const queryClient = useQueryClient();
  const { refreshFamily } = useFamily();

  const vehiclesQuery = useQuery({
    queryKey: ['vehicles'],
    queryFn: async () => {
      const result = await api.GET('/vehicles', {});
      return result.data?.data || []; // Type: Vehicle[]
    },
  });
  
  const { data: vehicles, shouldShowLoading, shouldShowError, shouldShowEmpty } = usePageState(vehiclesQuery);

  const createMutation = useMutation({
    mutationFn: (data: { name: string; capacity: number }) => api.POST('/vehicles', { body: data }),
    retry: false, // Disable automatic retries to prevent duplicates
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      // Invalidate schedule-related queries since vehicle data is embedded in schedule slots
      queryClient.invalidateQueries({ queryKey: ['weekly-schedule'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-slot'] });
      await refreshFamily(); // Refresh family context to update ManageFamilyPage
      setIsFormOpen(false);
      setFormData({ name: '', capacity: '' });
      setFormError('');
    },
    onError: (error: unknown) => {
      console.error('Error creating vehicle:', error);

      // Handle specific permission errors for OpenAPI client
      if (error && typeof error === 'object' && 'status' in error) {
        const apiError = error as { status: number; message?: string };
        if (apiError.status === 403) {
          setFormError('You do not have permission to add vehicles. Only family admins can add vehicles.');
        } else if (apiError.status === 401) {
          setFormError('You must be logged in to add vehicles.');
        } else {
          setFormError(apiError.message || 'Failed to add vehicle. Please try again.');
        }
      } else {
        setFormError('Failed to add vehicle. Please try again.');
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; capacity?: number } }) =>
      api.PATCH('/vehicles/{vehicleId}', { params: { path: { vehicleId: id } }, body: data }),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      // Invalidate schedule-related queries since vehicle data is embedded in schedule slots
      queryClient.invalidateQueries({ queryKey: ['weekly-schedule'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-slot'] });
      await refreshFamily(); // Refresh family context to update ManageFamilyPage
      setEditingVehicle(null);
      setFormData({ name: '', capacity: '' });
      setFormError('');
    },
    onError: (error: unknown) => {
      console.error('Error updating vehicle:', error);

      // Handle specific permission errors for OpenAPI client
      if (error && typeof error === 'object' && 'status' in error) {
        const apiError = error as { status: number; message?: string };
        if (apiError.status === 403) {
          setFormError('You do not have permission to edit vehicles. Only family admins can edit vehicles.');
        } else if (apiError.status === 401) {
          setFormError('You must be logged in to edit vehicles.');
        } else {
          setFormError(apiError.message || 'Failed to update vehicle. Please try again.');
        }
      } else {
        setFormError('Failed to update vehicle. Please try again.');
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.DELETE('/vehicles/{vehicleId}', { params: { path: { vehicleId: id } } }),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      // Invalidate schedule-related queries since vehicle data is embedded in schedule slots
      queryClient.invalidateQueries({ queryKey: ['weekly-schedule'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-slot'] });
      await refreshFamily(); // Refresh family context to update ManageFamilyPage
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent multiple submissions
    if (createMutation.isPending || updateMutation.isPending || isSubmitting) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const capacity = parseInt(formData.capacity);
      
      if (editingVehicle) {
        await updateMutation.mutateAsync({
          id: editingVehicle.id,
          data: { name: formData.name, capacity }
        });
      } else {
        await createMutation.mutateAsync({ name: formData.name, capacity });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setFormData({ name: vehicle.name, capacity: vehicle.capacity.toString() });
    setFormError('');
    setIsFormOpen(true);
  };

  const handleDelete = (vehicle: Vehicle) => {
    setVehicleToDelete(vehicle);
  };

  const confirmDelete = async () => {
    if (vehicleToDelete) {
      await deleteMutation.mutateAsync(vehicleToDelete.id);
      setVehicleToDelete(null);
    }
  };

  const resetForm = () => {
    setIsFormOpen(false);
    setEditingVehicle(null);
    setFormData({ name: '', capacity: '' });
    setFormError('');
    setIsSubmitting(false);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setIsFormOpen(open);
    if (!open) {
      // Dialog is closing, reset form
      setEditingVehicle(null);
      setFormData({ name: '', capacity: '' });
      setFormError('');
      setIsSubmitting(false);
    }
  };

  if (shouldShowLoading) {
    return (
      <PageLayout>
        <PageHeader 
          title="Vehicles" 
          subtitle="Loading your vehicles..."
          data-testid="VehiclesPage-Header-pageHeader"
          subtitle-testid="VehiclesPage-Description-pageDescription"
        />
        <LoadingState title="Loading your vehicles..." data-testid="VehiclesPage-Container-loading" />
      </PageLayout>
    );
  }

  if (shouldShowError) {
    return (
      <PageLayout>
        <PageHeader 
          title="Vehicles" 
          subtitle="Manage your vehicles available for school transport"
          subtitle-testid="VehiclesPage-Description-pageDescription"
          data-testid="VehiclesPage-Header-pageHeader"
        />
        <ErrorState
          title="Failed to load vehicles"
          description="We couldn't load your vehicles. Please check your connection and try again."
          onRetry={() => window.location.reload()}
        />
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/family/manage')}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <PageHeader 
            title="Vehicles" 
            subtitle="Manage your vehicles available for school transport"
            subtitle-testid="VehiclesPage-Description-pageDescription"
            data-testid="VehiclesPage-Title-pageTitle"
          >
        <Dialog open={isFormOpen} onOpenChange={handleDialogOpenChange}>
          <DialogTrigger asChild>
            <ModernButton icon={<Plus className="h-5 w-5" />} data-testid="VehiclesPage-Button-addVehicle">
              Add Vehicle
            </ModernButton>
          </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]" data-testid="VehiclesPage-Container-dialogContainer">
              <DialogHeader>
                <DialogTitle data-testid="VehiclesPage-Title-vehicleModalTitle">{editingVehicle ? 'Edit Vehicle' : 'Add New Vehicle'}</DialogTitle>
                <DialogDescription data-testid="VehiclesPage-Description-vehicleModalDescription">
                  {editingVehicle ? 'Update your vehicle information.' : 'Add a new vehicle for school transport.'}
                </DialogDescription>
              </DialogHeader>
              
              {/* Error Message */}
              {formError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {formError}
                  </AlertDescription>
                </Alert>
              )}
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="vehicle-name">Vehicle Name</Label>
                  <Input
                    id="vehicle-name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Honda CR-V, Toyota Prius"
                    required
                    data-testid="VehiclesPage-Input-vehicleName"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vehicle-capacity">Capacity (number of seats)</Label>
                  <Input
                    id="vehicle-capacity"
                    type="number"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                    min="1"
                    max={VEHICLE_CONSTRAINTS.MAX_CAPACITY}
                    required
                    data-testid="VehiclesPage-Input-vehicleCapacity"
                  />
                </div>

                <div className="flex justify-end space-x-3">
                  <Button type="button" variant="outline" onClick={resetForm} data-testid="VehiclesPage-Button-cancelVehicle">
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createMutation.isPending || updateMutation.isPending || isSubmitting}
                    data-testid="VehiclesPage-Button-submitVehicle"
                  >
                    {createMutation.isPending || updateMutation.isPending || isSubmitting ? 'Saving...' : editingVehicle ? 'Update' : 'Add'} Vehicle
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </PageHeader>
        </div>
      </div>

        {shouldShowEmpty ? (
          <div data-testid="VehiclesPage-Container-emptyState">
            <EmptyVehicles 
              onAddVehicle={() => {
                setEditingVehicle(null);
                setFormData({ name: '', capacity: '' });
                setFormError('');
                setIsFormOpen(true);
              }}
              data-testid="VehiclesPage"
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3" data-testid="VehiclesPage-List-vehiclesList">
            {vehicles.map((vehicle) => (
              <ModernCard key={vehicle.id}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Car className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg text-slate-900 dark:text-slate-100" data-testid={`VehiclesPage-Text-vehicleName-${vehicle.id}`}>{vehicle.name}</CardTitle>
                      <CardDescription className="font-medium" data-testid={`VehiclesPage-Text-vehicleCapacity-${vehicle.id}`}>
                        Capacity: {vehicle.capacity} seat{vehicle.capacity !== 1 ? 's' : ''}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(vehicle)}
                      aria-label="Edit"
                      className="hover:bg-primary/10"
                      data-testid={`VehiclesPage-Button-editVehicle-${vehicle.id}`}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(vehicle)}
                      aria-label="Delete"
                      className="hover:bg-destructive/10 hover:text-destructive"
                      data-testid={`VehiclesPage-Button-deleteVehicle-${vehicle.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
              </ModernCard>
            ))}
          </div>
        )}

        <ConfirmationDialog
          open={!!vehicleToDelete}
          onOpenChange={(open) => !open && setVehicleToDelete(null)}
          title="Delete Vehicle"
          description={`Are you sure you want to delete ${vehicleToDelete?.name}? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          variant="destructive"
          onConfirm={confirmDelete}
        />
      </PageLayout>
  );
};

export default VehiclesPage;