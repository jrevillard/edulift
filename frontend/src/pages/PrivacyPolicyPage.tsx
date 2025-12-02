import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, Database, Eye, Trash2, Lock, Mail, Users, Car, MapPin, Clock, FileText, AlertTriangle, CheckCircle } from 'lucide-react';

export default function PrivacyPolicyPage() {
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
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Privacy Policy
            </h1>
            <p className="text-lg text-gray-600">
              EduLift - Protection of Your Personal Data
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
            <div className="mt-4 flex items-center justify-center">
              <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm font-medium">
                ✅ GDPR Compliant
              </div>
            </div>
          </div>

          {/* Introduction */}
          <div className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
              <Shield className="w-6 h-6 mr-3 text-blue-600" />
              1. Introduction and Commitments
            </h2>
            <div className="prose prose-gray max-w-none">
              <p className="text-gray-700 leading-relaxed mb-4">
                EduLift ("we," "our") is committed to protecting the privacy and personal data
                of its users. This privacy policy explains what data we collect, why we collect it,
                how we use it, and how we protect it in accordance with the General Data Protection
                Regulation (GDPR) and applicable laws.
              </p>
              <p className="text-gray-700 leading-relaxed">
                We are the controller of the data you provide through the EduLift application.
              </p>
            </div>
          </div>

          {/* Personal Data Collected */}
          <div className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
              <Database className="w-6 h-6 mr-3 text-blue-600" />
              2. Personal Data Collected
            </h2>
            <div className="space-y-6">
              {/* Identification Data */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <Users className="w-5 h-5 mr-2 text-blue-500" />
                  Identification and Account Data
                </h3>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
                  <li>Full name and first name</li>
                  <li>Email address (primary identifier)</li>
                  <li>Hashed password (stored securely)</li>
                  <li>Profile photo (optional)</li>
                  <li>Personal timezone</li>
                  <li>Login history</li>
                </ul>
              </div>

              {/* Family Data */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <Users className="w-5 h-5 mr-2 text-blue-500" />
                  Family and Children Data
                </h3>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
                  <li>Children's names and ages</li>
                  <li>Family relationships (parent/legal guardian)</li>
                  <li>School information (institution, class)</li>
                  <li>Specific constraints (allergies, special needs)</li>
                  <li>Authorized persons for pickup/drop-off</li>
                </ul>
              </div>

              {/* Vehicle Data */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <Car className="w-5 h-5 mr-2 text-blue-500" />
                  Vehicle Data
                </h3>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
                  <li>Vehicle make, model, year</li>
                  <li>Available seats capacity</li>
                  <li>Insurance information (validity only)</li>
                  <li>Vehicle photo (optional)</li>
                </ul>
              </div>

              {/* Location Data */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <MapPin className="w-5 h-5 mr-2 text-blue-500" />
                  Location and Address Data
                </h3>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
                  <li>Home addresses (starting point)</li>
                  <li>School institution addresses</li>
                  <li>Pickup/drop-off point GPS coordinates</li>
                  <li>Real-time location during trips (with consent)</li>
                </ul>
              </div>

              {/* Schedule Data */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <Clock className="w-5 h-5 mr-2 text-blue-500" />
                  Schedule and Organization Data
                </h3>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
                  <li>Pickup and drop-off times</li>
                  <li>Weekly trip schedules</li>
                  <li>Completed trip history</li>
                  <li>Schedule notifications and reminders</li>
                  <li>Communications with other parents</li>
                </ul>
              </div>

              {/* Technical Data */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <Database className="w-5 h-5 mr-2 text-blue-500" />
                  Technical and Usage Data
                </h3>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
                  <li>IP address and device type</li>
                  <li>Application version and operating system</li>
                  <li>Activity logs and technical logs</li>
                  <li>Cookies and similar technologies</li>
                  <li>User preferences and settings</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Legal Basis */}
          <div className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
              <FileText className="w-6 h-6 mr-3 text-blue-600" />
              3. Legal Basis for Processing
            </h2>
            <div className="prose prose-gray max-w-none">
              <p className="text-gray-700 leading-relaxed mb-4">
                We process your personal data based on the following legal basis in accordance with GDPR:
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li><strong>Explicit consent:</strong> For sensitive data and location collection</li>
                <li><strong>Contract execution:</strong> To provide school transportation services</li>
                <li><strong>Legal obligation:</strong> To comply with child transportation regulations</li>
                <li><strong>Legitimate interest:</strong> To improve our services and prevent abuse</li>
              </ul>
            </div>
          </div>

          {/* Processing Purposes */}
          <div className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
              <Eye className="w-6 h-6 mr-3 text-blue-600" />
              4. Processing Purposes
            </h2>
            <div className="space-y-4">
              <div className="flex items-start p-4 bg-blue-50 rounded-lg">
                <CheckCircle className="w-5 h-5 mr-3 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-gray-900">Main service provision</h4>
                  <p className="text-gray-700">Organization and coordination of school transportation</p>
                </div>
              </div>
              <div className="flex items-start p-4 bg-blue-50 rounded-lg">
                <CheckCircle className="w-5 h-5 mr-3 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-gray-900">User account management</h4>
                  <p className="text-gray-700">Authentication, profile, and preferences</p>
                </div>
              </div>
              <div className="flex items-start p-4 bg-blue-50 rounded-lg">
                <CheckCircle className="w-5 h-5 mr-3 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-gray-900">Security and moderation</h4>
                  <p className="text-gray-700">Abuse prevention and child protection</p>
                </div>
              </div>
              <div className="flex items-start p-4 bg-blue-50 rounded-lg">
                <CheckCircle className="w-5 h-5 mr-3 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-gray-900">Service improvement</h4>
                  <p className="text-gray-700">Usage analysis and feature development</p>
                </div>
              </div>
              <div className="flex items-start p-4 bg-blue-50 rounded-lg">
                <CheckCircle className="w-5 h-5 mr-3 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-gray-900">Communication</h4>
                  <p className="text-gray-700">Notifications, support, and customer service</p>
                </div>
              </div>
            </div>
          </div>

          {/* Data Retention Period */}
          <div className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
              <Clock className="w-6 h-6 mr-3 text-blue-600" />
              5. Data Retention Period
            </h2>
            <div className="prose prose-gray max-w-none">
              <p className="text-gray-700 leading-relaxed mb-4">
                We retain your personal data only as long as necessary for the purposes
                for which it was collected:
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li><strong>Account data:</strong> As long as your account is active</li>
                <li><strong>Schedule data:</strong> 2 years after the trip (for proof purposes)</li>
                <li><strong>Location data:</strong> 30 days (unless consent for longer retention)</li>
                <li><strong>Technical logs:</strong> Maximum 1 year</li>
                <li><strong>Post-deletion data:</strong> Anonymization after 3 years</li>
              </ul>
            </div>
          </div>

          {/* Data Sharing */}
          <div className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
              <Users className="w-6 h-6 mr-3 text-blue-600" />
              6. Personal Data Sharing
            </h2>
            <div className="prose prose-gray max-w-none">
              <p className="text-gray-700 leading-relaxed mb-4">
                Your data may be shared with:
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li><strong>Family/group members:</strong> Only information necessary for coordination</li>
                <li><strong>Technical providers:</strong> Hosts and subcontracted service providers</li>
                <li><strong>Competent authorities:</strong> In case of legal or judicial obligation</li>
                <li><strong>Qualified third parties:</strong> Only with your explicit consent</li>
              </ul>
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mt-4">
                <p className="text-gray-700">
                  <strong>Important:</strong> We never sell your personal data for commercial purposes.
                </p>
              </div>
            </div>
          </div>

          {/* Data Security */}
          <div className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
              <Lock className="w-6 h-6 mr-3 text-blue-600" />
              7. Data Security and Protection
            </h2>
            <div className="prose prose-gray max-w-none">
              <p className="text-gray-700 leading-relaxed mb-4">
                We implement appropriate technical and organizational measures to protect
                your data:
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li>Data encryption in transit and at rest</li>
                <li>Strong authentication and secure access management</li>
                <li>Regular backups and disaster recovery plan</li>
                <li>Regular security audits and penetration testing</li>
                <li>Continuous training of our teams on data protection</li>
                <li>Compliance with ISO 27001 information security standards</li>
              </ul>
            </div>
          </div>

          {/* User Rights */}
          <div className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
              <Shield className="w-6 h-6 mr-3 text-blue-600" />
              8. Your GDPR Rights
            </h2>
            <div className="space-y-4">
              <div className="flex items-start p-4 bg-gray-50 rounded-lg">
                <Eye className="w-5 h-5 mr-3 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-gray-900">Right of access</h4>
                  <p className="text-gray-700">View all data we hold about you</p>
                </div>
              </div>
              <div className="flex items-start p-4 bg-gray-50 rounded-lg">
                <FileText className="w-5 h-5 mr-3 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-gray-900">Right to rectification</h4>
                  <p className="text-gray-700">Update your inaccurate or incomplete data</p>
                </div>
              </div>
              <div className="flex items-start p-4 bg-gray-50 rounded-lg">
                <Trash2 className="w-5 h-5 mr-3 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-gray-900">Right to erasure</h4>
                  <p className="text-gray-700">Request deletion of your personal data</p>
                </div>
              </div>
              <div className="flex items-start p-4 bg-gray-50 rounded-lg">
                <Database className="w-5 h-5 mr-3 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-gray-900">Right to portability</h4>
                  <p className="text-gray-700">Receive your data in a readable and reusable format</p>
                </div>
              </div>
              <div className="flex items-start p-4 bg-gray-50 rounded-lg">
                <AlertTriangle className="w-5 h-5 mr-3 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-gray-900">Right to object</h4>
                  <p className="text-gray-700">Object to processing of your data for legitimate reasons</p>
                </div>
              </div>
            </div>
          </div>

          {/* Cookies */}
          <div className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
              <Database className="w-6 h-6 mr-3 text-blue-600" />
              9. Cookies and Similar Technologies
            </h2>
            <div className="prose prose-gray max-w-none">
              <p className="text-gray-700 leading-relaxed mb-4">
                Our application uses cookies and similar technologies to:
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li>Keep your session active</li>
                <li>Remember your preferences</li>
                <li>Analyze application usage</li>
                <li>Ensure security and prevent fraud</li>
              </ul>
              <p className="text-gray-700 leading-relaxed">
                You can manage your cookie preferences in the application settings.
              </p>
            </div>
          </div>

          {/* International Transfers */}
          <div className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
              <MapPin className="w-6 h-6 mr-3 text-blue-600" />
              10. International Data Transfers
            </h2>
            <div className="prose prose-gray max-w-none">
              <p className="text-gray-700 leading-relaxed">
                Your data is primarily hosted within the European Union. Any international
                data transfer is performed in compliance with GDPR and with appropriate
                safeguards (standard contractual clauses, adequacy certifications, etc.).
              </p>
            </div>
          </div>

          {/* Policy Modifications */}
          <div className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
              <FileText className="w-6 h-6 mr-3 text-blue-600" />
              11. Policy Modifications
            </h2>
            <div className="prose prose-gray max-w-none">
              <p className="text-gray-700 leading-relaxed">
                We may update this privacy policy to reflect changes in our practices
                or for legal and regulatory reasons. Changes will be communicated via
                the application with at least 30 days' notice for significant changes.
              </p>
            </div>
          </div>

          {/* Contact and Complaints */}
          <div className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
              <Mail className="w-6 h-6 mr-3 text-blue-600" />
              12. Contact and Complaints
            </h2>
            <div className="prose prose-gray max-w-none">
              <p className="text-gray-700 leading-relaxed mb-4">
                To exercise your rights or ask questions about this policy:
              </p>
              <div className="bg-gray-50 rounded-lg p-6 space-y-3">
                <div className="flex items-center text-gray-700">
                  <Mail className="w-5 h-5 mr-3 text-blue-600" />
                  <span className="font-medium">DPO (Data Protection):</span>
                  <span className="ml-2">dpo@edulift.app</span>
                </div>
                <div className="flex items-center text-gray-700">
                  <Mail className="w-5 h-5 mr-3 text-blue-600" />
                  <span className="font-medium">General support:</span>
                  <span className="ml-2">privacy@edulift.app</span>
                </div>
              </div>
              <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mt-4">
                <p className="text-gray-700">
                  <strong>Supervisory Authority Complaint:</strong> You also have the right to file a complaint
                  with the relevant data protection supervisory authority if you believe
                  your rights have not been respected.
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t pt-8 mt-12">
            <div className="text-center text-sm text-gray-500">
              <p className="mb-2">
                This policy applies to all EduLift application users within the
                European Union and in accordance with GDPR (Regulation 2016/679).
              </p>
              <p>
                © {new Date().getFullYear()} EduLift. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}