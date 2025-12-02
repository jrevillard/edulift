import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, Users, Car, AlertTriangle, Mail, Phone, MapPin } from 'lucide-react';

export default function TermsOfServicePage() {
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
              Terms of Service
            </h1>
            <p className="text-lg text-gray-600">
              EduLift - Collaborative School Transportation Management
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          {/* Introduction */}
          <div className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
              <Users className="w-6 h-6 mr-3 text-blue-600" />
              1. Introduction
            </h2>
            <div className="prose prose-gray max-w-none">
              <p className="text-gray-700 leading-relaxed mb-4">
                Welcome to EduLift, a mobile application dedicated to simplifying and centralizing
                the organization of home-to-school trips for parent groups. Our platform operates
                on a dual-system approach enabling optimized management of family resources
                and efficient coordination of group schedules.
              </p>
              <p className="text-gray-700 leading-relaxed">
                By using the EduLift application, you agree to comply with these Terms of Service
                ("Terms"). If you do not accept these terms, please do not use our application.
              </p>
            </div>
          </div>

          {/* Acceptance of Terms */}
          <div className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
              <Shield className="w-6 h-6 mr-3 text-blue-600" />
              2. Acceptance of Terms
            </h2>
            <div className="prose prose-gray max-w-none">
              <p className="text-gray-700 leading-relaxed mb-4">
                Access to and use of EduLift are subject to acceptance of these Terms of Service.
                Your registration or use of the application constitutes full and complete
                acceptance of these terms.
              </p>
              <p className="text-gray-700 leading-relaxed">
                EduLift reserves the right to modify these terms at any time. Changes will take
                effect upon publication on the application. It is your responsibility to regularly
                consult the updated terms.
              </p>
            </div>
          </div>

          {/* Service Description */}
          <div className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
              <Car className="w-6 h-6 mr-3 text-blue-600" />
              3. Service Description
            </h2>
            <div className="prose prose-gray max-w-none">
              <p className="text-gray-700 leading-relaxed mb-4">
                EduLift is a collaborative platform that enables:
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4">
                <li><strong>Family System:</strong> Management of shared resources (children, vehicles)
                  within family units with defined roles and permissions</li>
                <li><strong>Group System:</strong> Coordination of schedules and organization of trips
                  among multiple participating families</li>
                <li><strong>Intelligent Planning:</strong> Creation of schedules, management of time slots,
                  and optimization of trips</li>
                <li><strong>Secure Communication:</strong> Exchanges between family and group members
                  for logistical coordination</li>
              </ul>
              <p className="text-gray-700 leading-relaxed">
                The service is accessible via mobile application and requires an internet connection
                for optimal functionality.
              </p>
            </div>
          </div>

          {/* User Responsibilities */}
          <div className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
              <Users className="w-6 h-6 mr-3 text-blue-600" />
              4. User Responsibilities
            </h2>
            <div className="prose prose-gray max-w-none">
              <p className="text-gray-700 leading-relaxed mb-4">
                As an EduLift user, you commit to:
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4">
                <li>Provide accurate and up-to-date information during registration</li>
                <li>Maintain confidentiality of your login credentials</li>
                <li>Use the service exclusively for school transportation purposes</li>
                <li>Respect other users and applicable codes of conduct</li>
                <li>Not use the application for illegal or fraudulent activities</li>
                <li>Ensure child safety during trips organized via the platform</li>
                <li>Comply with local laws and regulations regarding child transportation</li>
                <li>Maintain necessary insurance (vehicle insurance, liability coverage)</li>
              </ul>
            </div>
          </div>

          {/* Data Protection */}
          <div className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
              <Shield className="w-6 h-6 mr-3 text-blue-600" />
              5. Personal Data Protection
            </h2>
            <div className="prose prose-gray max-w-none">
              <p className="text-gray-700 leading-relaxed mb-4">
                EduLift commits to protecting user privacy in accordance with our Privacy Policy.
                The collected data includes:
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4">
                <li><strong>Account Information:</strong> Name, email address, login credentials</li>
                <li><strong>Family Information:</strong> Children's names, ages, family relationships</li>
                <li><strong>Vehicle Information:</strong> Make, model, capacity</li>
                <li><strong>Schedule Data:</strong> Times, trips</li>
                <li><strong>Usage Data:</strong> Activity logs, preferences, history</li>
              </ul>
              <p className="text-gray-700 leading-relaxed">
                This data is processed in compliance with GDPR and applicable regulations.
                For more details, consult our <a href="/privacy-policy" className="text-blue-600 hover:underline">Privacy Policy</a>.
              </p>
            </div>
          </div>

          {/* Intellectual Property */}
          <div className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
              <Shield className="w-6 h-6 mr-3 text-blue-600" />
              6. Intellectual Property
            </h2>
            <div className="prose prose-gray max-w-none">
              <p className="text-gray-700 leading-relaxed mb-4">
                EduLift and its content, including but not limited to software, text, graphics,
                images, and logos, are the exclusive property of EduLift and are protected by
                intellectual property laws.
              </p>
              <p className="text-gray-700 leading-relaxed">
                You may not use, copy, reproduce, distribute, or exploit EduLift content without
                our prior written authorization.
              </p>
            </div>
          </div>

          {/* Limitation of Liability */}
          <div className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
              <AlertTriangle className="w-6 h-6 mr-3 text-blue-600" />
              7. Limitation of Liability
            </h2>
            <div className="prose prose-gray max-w-none">
              <p className="text-gray-700 leading-relaxed mb-4">
                EduLift acts as a connection and organization platform. Our responsibility
                is limited to the technical aspects of the application. Users are fully
                responsible for:
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4">
                <li>Child safety during trips</li>
                <li>Compliance with traffic laws and local regulations</li>
                <li>Validity of vehicle insurance and liability coverage</li>
                <li>Verification of other users' backgrounds</li>
                <li>Decisions regarding transportation organization</li>
              </ul>
              <p className="text-gray-700 leading-relaxed font-medium">
                EduLift cannot be held liable for accidents, incidents, or damages occurring
                during trips organized via the platform.
              </p>
            </div>
          </div>

          {/* Suspension and Termination */}
          <div className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
              <AlertTriangle className="w-6 h-6 mr-3 text-blue-600" />
              8. Suspension and Termination
            </h2>
            <div className="prose prose-gray max-w-none">
              <p className="text-gray-700 leading-relaxed mb-4">
                EduLift reserves the right to immediately suspend or terminate your account
                in case of:
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4">
                <li>Violation of these Terms of Service</li>
                <li>Fraudulent or abusive use of the service</li>
                <li>Provision of false information</li>
                <li>Activities harmful to child safety or other users</li>
                <li>Non-compliance with applicable laws and regulations</li>
              </ul>
              <p className="text-gray-700 leading-relaxed">
                You may terminate your account at any time from the application settings.
              </p>
            </div>
          </div>

          {/* Contact and Support */}
          <div className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
              <Mail className="w-6 h-6 mr-3 text-blue-600" />
              9. Contact and Support
            </h2>
            <div className="prose prose-gray max-w-none">
              <p className="text-gray-700 leading-relaxed mb-4">
                For any questions regarding these Terms of Service or to obtain
                technical support, you can contact us:
              </p>
              <div className="bg-gray-50 rounded-lg p-6 space-y-3">
                <div className="flex items-center text-gray-700">
                  <Mail className="w-5 h-5 mr-3 text-blue-600" />
                  <span className="font-medium">Email:</span>
                  <span className="ml-2">legal@edulift.app</span>
                </div>
                <div className="flex items-center text-gray-700">
                  <Phone className="w-5 h-5 mr-3 text-blue-600" />
                  <span className="font-medium">Support:</span>
                  <span className="ml-2">support@edulift.app</span>
                </div>
                <div className="flex items-start text-gray-700">
                  <MapPin className="w-5 h-5 mr-3 text-blue-600 mt-0.5" />
                  <div>
                    <span className="font-medium">Headquarters:</span>
                    <p className="mt-1">[Headquarters Address]</p>
                    <p>[Postal Code, City, Country]</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Legal Mentions */}
          <div className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
              <Shield className="w-6 h-6 mr-3 text-blue-600" />
              10. Legal Information
            </h2>
            <div className="prose prose-gray max-w-none">
              <div className="space-y-3 text-gray-700">
                <p><strong>Platform Publisher:</strong> EduLift Inc.</p>
                <p><strong>Legal Form:</strong> Simplified Joint Stock Company</p>
                <p><strong>Share Capital:</strong> [Share Capital Amount]</p>
                <p><strong>Registration Number:</strong> [Registration Number]</p>
                <p><strong>VAT Number:</strong> [VAT Number]</p>
                <p><strong>Publication Director:</strong> [Director's Name]</p>
                <p><strong>Hosting Provider:</strong> [Hosting Provider Name and Contact]</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t pt-8 mt-12">
            <div className="text-center text-sm text-gray-500">
              <p className="mb-2">
                By using EduLift, you acknowledge that you have read, understood, and agree
                to these Terms of Service.
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