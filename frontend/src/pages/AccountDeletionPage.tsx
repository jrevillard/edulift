import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Trash2, AlertTriangle, Clock } from 'lucide-react';

export default function AccountDeletionPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm p-8">
          {/* Title */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center mb-4">
              <Trash2 className="w-12 h-12 text-red-600" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Account Deletion Request
            </h1>
            <p className="text-lg text-gray-600">
              Learn how to permanently delete your EduLift account
            </p>
          </div>

          {/* Important Notice */}
          <div className="mb-12">
            <div className="bg-red-50 border-l-4 border-red-400 p-6">
              <div className="flex items-start">
                <AlertTriangle className="w-6 h-6 text-red-600 mr-3 mt-0.5" />
                <div>
                  <h3 className="text-lg font-semibold text-red-900 mb-2">
                    Important: Permanent Action
                  </h3>
                  <p className="text-red-800 leading-relaxed">
                    Account deletion is permanent and cannot be undone. Once your account is deleted,
                    all your personal data, family information, vehicle details, and trip history
                    will be permanently removed from our systems (if you are the last family administrator).
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* How to Delete Account */}
          <div className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6 flex items-center">
              <User className="w-6 h-6 mr-3 text-blue-600" />
              How to Delete Your Account
            </h2>

            <div className="bg-gray-50 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Step-by-Step Instructions
              </h3>

              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold text-sm">
                    1
                  </div>
                  <div className="ml-4">
                    <h4 className="font-semibold text-gray-900">Open Profile Settings</h4>
                    <p className="text-gray-700">Navigate to your profile page within the EduLift application</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold text-sm">
                    2
                  </div>
                  <div className="ml-4">
                    <h4 className="font-semibold text-gray-900">Find Account Settings</h4>
                    <p className="text-gray-700">Scroll down to the "Account Settings" or "Danger Zone" section</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold text-sm">
                    3
                  </div>
                  <div className="ml-4">
                    <h4 className="font-semibold text-gray-900">Click Delete Account</h4>
                    <p className="text-gray-700">Tap the "Delete Account" button to initiate the deletion process</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold text-sm">
                    4
                  </div>
                  <div className="ml-4">
                    <h4 className="font-semibold text-gray-900">Confirm Deletion</h4>
                    <p className="text-gray-700">Read the confirmation message and confirm your decision to delete your account</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
              <div className="flex items-start">
                <AlertTriangle className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
                <p className="text-blue-800">
                  <strong>Note:</strong> Account deletion must be done from within the application
                  for security reasons. This informational page cannot process deletion requests.
                </p>
              </div>
            </div>
          </div>

          {/* What Gets Deleted */}
          <div className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6 flex items-center">
              <Trash2 className="w-6 h-6 mr-3 text-blue-600" />
              What Gets Deleted
            </h2>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-3">Personal Information</h3>
                <ul className="text-gray-700 space-y-2 text-sm">
                  <li>• Name and email address</li>
                  <li>• Profile information and photo</li>
                  <li>• Account settings and preferences</li>
                </ul>
              </div>

              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-3">Family Data</h3>
                <ul className="text-gray-700 space-y-2 text-sm">
                  <li>• Children's information</li>
                  <li>• Family member details</li>
                  <li>• Vehicle information</li>
                  <li>• Family relationships</li>
                </ul>
              </div>

              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-3">Activity Data</h3>
                <ul className="text-gray-700 space-y-2 text-sm">
                  <li>• Trip history and schedules</li>
                  <li>• Group memberships</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Data Retention Period */}
          <div className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6 flex items-center">
              <Clock className="w-6 h-6 mr-3 text-blue-600" />
              Data Deletion Timeline
            </h2>

            <div className="bg-yellow-50 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3">Important Information About Your Data</h3>

              <div className="space-y-3 text-gray-700">
                <p>
                  <strong>Immediate Deletion:</strong> Your account access will be terminated immediately
                  after confirmation.
                </p>
                <p>
                  <strong>Anonymized Data:</strong> Some anonymized usage statistics may be retained
                  for service improvement purposes, but these cannot be linked to your identity.
                </p>
                <p>
                  <strong>Legal Requirements:</strong> We may retain certain data longer if required
                  by law or for legitimate business purposes (e.g., fraud prevention).
                </p>
              </div>
            </div>
          </div>

          {/* Final Warning */}
          <div className="border-t pt-8">
            <div className="text-center">
              <div className="inline-flex items-center px-4 py-2 bg-red-100 text-red-800 rounded-full text-sm font-medium">
                <AlertTriangle className="w-4 h-4 mr-2" />
                This action is permanent and cannot be undone
              </div>
              <p className="text-gray-500 text-sm mt-4">
                Make sure you've downloaded any important information before proceeding
                with account deletion.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}