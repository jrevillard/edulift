/**
 * FAMILY ONBOARDING WIZARD
 * 
 * Mandatory onboarding flow for users who need to create or join a family.
 * This component appears when a user logs in but doesn't belong to any family.
 * 
 * Features:
 * - Step-by-step wizard interface
 * - Create new family or join existing family
 * - Form validation and error handling
 * - Accessibility compliant (WCAG 2.1 AA)
 * - Loading states and success feedback
 */

import React, { useState, useCallback } from 'react';
import { useFamily } from '../../contexts/FamilyContext';
import { 
  validateFamilyName, 
  validateInviteCode,
  type CreateFamilyFormData,
  type JoinFamilyFormData 
} from '../../types/family';
import { Alert, AlertDescription } from '../ui/alert';
import { AlertCircle, CheckCircle } from 'lucide-react';

interface FamilyOnboardingWizardProps {
  onComplete: () => void;
  onCancel?: () => void;
}

type OnboardingStep = 'choice' | 'create' | 'join' | 'success';

interface FormErrors {
  familyName?: string;
  inviteCode?: string;
  general?: string;
}

export const FamilyOnboardingWizard: React.FC<FamilyOnboardingWizardProps> = ({
  onComplete,
  onCancel
}) => {
  const { createFamily, joinFamily, isLoading, error, clearError } = useFamily();
  
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('choice');
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form data
  const [createFormData, setCreateFormData] = useState<CreateFamilyFormData>({
    name: '',
    description: ''
  });
  const [joinFormData, setJoinFormData] = useState<JoinFamilyFormData>({
    inviteCode: ''
  });

  const clearErrors = useCallback(() => {
    setFormErrors({});
    clearError();
  }, [clearError]);

  const handleChoiceSelection = useCallback((choice: 'create' | 'join') => {
    clearErrors();
    setCurrentStep(choice);
  }, [clearErrors]);

  const handleCreateFamily = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form
    const nameError = validateFamilyName(createFormData.name);
    if (nameError) {
      setFormErrors({ familyName: nameError });
      return;
    }

    clearErrors();
    setIsSubmitting(true);
    
    try {
      await createFamily(createFormData.name);
      setCurrentStep('success');
      
      // Complete onboarding after brief success display
      setTimeout(() => {
        onComplete();
      }, 2000);
    } catch (err) {
      console.error('Failed to create family:', err);
      setFormErrors({ 
        general: err instanceof Error ? err.message : 'Failed to create family' 
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [createFormData.name, createFamily, onComplete, clearErrors]);

  const handleJoinFamily = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form
    const codeError = validateInviteCode(joinFormData.inviteCode);
    if (codeError) {
      setFormErrors({ inviteCode: codeError });
      return;
    }

    clearErrors();
    setIsSubmitting(true);
    
    try {
      await joinFamily(joinFormData.inviteCode);
      setCurrentStep('success');
      
      // Complete onboarding after brief success display
      setTimeout(() => {
        onComplete();
      }, 2000);
    } catch (err) {
      console.error('Failed to join family:', err);
      setFormErrors({ 
        general: err instanceof Error ? err.message : 'Failed to join family' 
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [joinFormData.inviteCode, joinFamily, onComplete, clearErrors]);

  const handleBackToChoice = useCallback(() => {
    clearErrors();
    setCurrentStep('choice');
  }, [clearErrors]);

  const renderChoiceStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2" data-testid="FamilyOnboardingWizard-Heading-welcome">
          Welcome to EduLift!
        </h1>
        <p className="text-gray-600 mb-6">
          To get started, you need to create a family or join an existing one. 
          Families help you share children and vehicles for transportation coordination.
        </p>
      </div>

      <div className="space-y-4">
        <button
          onClick={() => handleChoiceSelection('create')}
          className="w-full p-4 border-2 border-blue-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
          aria-describedby="create-family-description"
          data-testid="FamilyOnboardingWizard-Button-createFamilyChoice"
        >
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white font-bold">+</span>
            </div>
            <div>
              <div className="font-medium text-gray-900" data-testid="FamilyOnboardingWizard-Text-createFamilyChoice">Create a New Family</div>
              <div id="create-family-description" className="text-sm text-gray-600">
                Start a new family and invite others to join
              </div>
            </div>
          </div>
        </button>

        <button
          onClick={() => handleChoiceSelection('join')}
          className="w-full p-4 border-2 border-green-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors text-left"
          aria-describedby="join-family-description"
          data-testid="FamilyOnboardingWizard-Button-joinFamilyChoice"
        >
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
              <span className="text-white font-bold">→</span>
            </div>
            <div>
              <div className="font-medium text-gray-900" data-testid="FamilyOnboardingWizard-Text-joinFamilyChoice">Join an Existing Family</div>
              <div id="join-family-description" className="text-sm text-gray-600">
                Use an invitation code to join a family
              </div>
            </div>
          </div>
        </button>
      </div>

      {onCancel && (
        <div className="text-center pt-4">
          <button
            onClick={onCancel}
            className="text-sm text-gray-500 hover:text-gray-700"
            data-testid="FamilyOnboardingWizard-Button-skipOnboarding"
          >
            Skip for now
          </button>
        </div>
      )}
    </div>
  );

  const renderCreateStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-900 mb-2" data-testid="FamilyOnboardingWizard-Heading-createFamilyTitle">
          Create Your Family
        </h2>
        <p className="text-gray-600" data-testid="FamilyOnboardingWizard-Text-createFamilyDescription">
          You need to create or join a family before joining groups
        </p>
      </div>

      <form onSubmit={handleCreateFamily} className="space-y-4">
        <div>
          <label htmlFor="family-name" className="block text-sm font-medium text-gray-700 mb-1">
            Family Name *
          </label>
          <input
            id="family-name"
            type="text"
            value={createFormData.name}
            onChange={(e) => setCreateFormData(prev => ({ ...prev, name: e.target.value }))}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              formErrors.familyName ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Enter family name (e.g., Smith Family)"
            required
            aria-invalid={!!formErrors.familyName}
            aria-describedby={formErrors.familyName ? 'family-name-error' : undefined}
            data-testid="FamilyOnboardingWizard-Input-familyName"
          />
          {formErrors.familyName && (
            <p id="family-name-error" className="mt-1 text-sm text-red-600" role="alert" data-testid="FamilyOnboardingWizard-Alert-familyNameError">
              {formErrors.familyName}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="family-description" className="block text-sm font-medium text-gray-700 mb-1">
            Description (Optional)
          </label>
          <textarea
            id="family-description"
            value={createFormData.description || ''}
            onChange={(e) => setCreateFormData(prev => ({ ...prev, description: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Describe your family (optional)"
            rows={3}
            data-testid="FamilyOnboardingWizard-Input-familyDescription"
          />
        </div>

        {(formErrors.general || error) && (
          <Alert variant="destructive" data-testid="FamilyOnboardingWizard-Alert-createFamilyError">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {formErrors.general || error}
            </AlertDescription>
          </Alert>
        )}
        
        {currentStep === 'success' && (
          <Alert variant="success" data-testid="FamilyOnboardingWizard-Alert-familyCreated">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Family created successfully!
            </AlertDescription>
          </Alert>
        )}

        <div className="flex space-x-3 pt-4">
          <button
            type="button"
            onClick={handleBackToChoice}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isSubmitting}
            data-testid="FamilyOnboardingWizard-Button-backToChoice"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={isSubmitting || isLoading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="FamilyOnboardingWizard-Button-createFamily"
          >
            {isSubmitting || isLoading ? 'Creating...' : 'Create Family'}
          </button>
        </div>
      </form>
    </div>
  );

  const renderJoinStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-900 mb-2" data-testid="FamilyOnboardingWizard-Heading-joinFamilyTitle">
          Join a Family
        </h2>
        <p className="text-gray-600">
          Enter the invitation code shared by a family member.
        </p>
      </div>

      <form onSubmit={handleJoinFamily} className="space-y-4">
        <div>
          <label htmlFor="invite-code" className="block text-sm font-medium text-gray-700 mb-1">
            Invitation Code *
          </label>
          <input
            id="invite-code"
            type="text"
            value={joinFormData.inviteCode}
            onChange={(e) => setJoinFormData(prev => ({ ...prev, inviteCode: e.target.value }))}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              formErrors.inviteCode ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Enter invitation code"
            required
            aria-invalid={!!formErrors.inviteCode}
            aria-describedby={formErrors.inviteCode ? 'invite-code-error' : undefined}
            data-testid="FamilyOnboardingWizard-Input-inviteCode"
          />
          {formErrors.inviteCode && (
            <p id="invite-code-error" className="mt-1 text-sm text-red-600" role="alert" data-testid="FamilyOnboardingWizard-Alert-inviteCodeError">
              {formErrors.inviteCode}
            </p>
          )}
        </div>

        <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
          <p className="font-medium mb-1" data-testid="FamilyOnboardingWizard-Text-noInviteCode">Don't have an invitation code?</p>
          <p>Ask a family member to share their invitation code with you, or create your own family instead.</p>
        </div>

        {(formErrors.general || error) && (
          <Alert variant="destructive" data-testid="FamilyOnboardingWizard-Alert-joinFamilyError">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {formErrors.general || error}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex space-x-3 pt-4">
          <button
            type="button"
            onClick={handleBackToChoice}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isSubmitting}
            data-testid="FamilyOnboardingWizard-Button-backToChoice"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={isSubmitting || isLoading}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="FamilyOnboardingWizard-Button-joinFamily"
          >
            {isSubmitting || isLoading ? 'Joining...' : 'Join Family'}
          </button>
        </div>
      </form>
    </div>
  );

  const renderSuccessStep = () => (
    <div className="space-y-6 text-center" data-testid="FamilyOnboardingWizard-Container-successStep">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto" data-testid="FamilyOnboardingWizard-Icon-success">
        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-2" data-testid="FamilyOnboardingWizard-Heading-successTitle">
          Welcome to your family!
        </h2>
        <p className="text-gray-600" data-testid="FamilyOnboardingWizard-Text-successDescription">
          You can now manage shared children and vehicles, and coordinate with other family members.
        </p>
      </div>

      <div className="animate-pulse">
        <p className="text-sm text-gray-500" data-testid="FamilyOnboardingWizard-Text-redirectingMessage">Redirecting to dashboard...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow-md p-8">
          {/* Progress indicator */}
          <div className="flex justify-center mb-8">
            <div className="flex space-x-2">
              <div className={`w-2 h-2 rounded-full ${
                currentStep === 'choice' ? 'bg-blue-600' : 'bg-gray-300'
              }`} />
              <div className={`w-2 h-2 rounded-full ${
                ['create', 'join'].includes(currentStep) ? 'bg-blue-600' : 'bg-gray-300'
              }`} />
              <div className={`w-2 h-2 rounded-full ${
                currentStep === 'success' ? 'bg-green-600' : 'bg-gray-300'
              }`} />
            </div>
          </div>

          {/* Step content */}
          {currentStep === 'choice' && renderChoiceStep()}
          {currentStep === 'create' && renderCreateStep()}
          {currentStep === 'join' && renderJoinStep()}
          {currentStep === 'success' && renderSuccessStep()}
        </div>
      </div>
    </div>
  );
};