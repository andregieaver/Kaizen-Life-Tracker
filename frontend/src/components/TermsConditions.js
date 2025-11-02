import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from './ui/button';
import { Heart, ArrowLeft } from 'lucide-react';
import axios from 'axios';
import { loadAndInjectPageSEO } from '../utils/seoUtils';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const TermsConditions = () => {
  const [siteTitle, setSiteTitle] = useState('TrainSmart');

  useEffect(() => {
    const fetchSiteTitle = async () => {
      try {
        const response = await axios.get(`${BACKEND_URL}/api/system/settings/public`);
        if (response.data?.seo?.siteTitle) {
          setSiteTitle(response.data.seo.siteTitle);
        }
      } catch (error) {
        console.error('Error fetching site title:', error);
      }
    };
    
    fetchSiteTitle();
    
    // Load page-level SEO meta tags
    loadAndInjectPageSEO('/terms');
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-800 to-gray-900">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 bg-gradient-to-br from-cyan-700 via-teal-600 to-cyan-600 backdrop-blur-sm z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center">
              <Heart className="w-8 h-8 text-white" />
              <span className="ml-2 text-xl font-bold text-white">{siteTitle}</span>
            </Link>
            <Link to="/">
              <Button variant="outline" className="border-white text-white hover:bg-white hover:text-teal-600">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4">
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">Terms & Conditions</h1>
          <p className="text-gray-400 mb-8">Last updated: {new Date().toLocaleDateString()}</p>

          <div className="space-y-8 text-gray-300">
              <section>
                <h2 className="text-2xl font-bold text-white mb-4">1. Acceptance of Terms</h2>
                <p className="mb-4">
                  By accessing and using {siteTitle}, you accept and agree to be bound by the terms and provision of this 
                  agreement. If you do not agree to these terms, please do not use our service.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">2. Use License</h2>
                <p className="mb-4">
                  Permission is granted to temporarily access the materials (information or software) on {siteTitle} for 
                  personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title.
                </p>
                <p className="mb-4">Under this license you may not:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Modify or copy the materials</li>
                  <li>Use the materials for any commercial purpose or for any public display</li>
                  <li>Attempt to reverse engineer any software contained in {siteTitle}</li>
                  <li>Remove any copyright or other proprietary notations from the materials</li>
                  <li>Transfer the materials to another person or "mirror" the materials on any other server</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">3. User Account</h2>
                <p className="mb-4">
                  When you create an account with us, you must provide accurate, complete, and current information at all times. 
                  Failure to do so constitutes a breach of the Terms, which may result in immediate termination of your account.
                </p>
                <p className="mb-4">
                  You are responsible for safeguarding the password that you use to access the service and for any activities 
                  or actions under your password.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">4. Subscription and Payment</h2>
                <p className="mb-4">
                  Some parts of the service are billed on a subscription basis. You will be billed in advance on a recurring 
                  and periodic basis (monthly or annually).
                </p>
                <p className="mb-4">Key points about subscriptions:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Subscriptions automatically renew unless cancelled before the renewal date</li>
                  <li>You can cancel your subscription at any time through your account settings</li>
                  <li>Refunds are handled according to our refund policy</li>
                  <li>Price changes will be communicated in advance</li>
                  <li>Failed payments may result in service suspension</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">5. Health and Fitness Disclaimer</h2>
                <p className="mb-4">
                  {siteTitle} provides fitness and health-related information and tools. This information is not intended as 
                  medical advice and should not replace consultation with a healthcare professional.
                </p>
                <p className="mb-4">
                  <strong className="text-white">Important:</strong> Always consult with a qualified healthcare provider before 
                  beginning any exercise program or making changes to your diet. Individual results may vary.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">6. Content Ownership</h2>
                <p className="mb-4">
                  The service and its original content, features, and functionality are and will remain the exclusive property 
                  of {siteTitle}. The service is protected by copyright, trademark, and other laws.
                </p>
                <p className="mb-4">
                  You retain ownership of any content you submit, post, or display on or through the service. By submitting 
                  content, you grant us a worldwide, non-exclusive, royalty-free license to use, reproduce, and display that content.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">7. Prohibited Uses</h2>
                <p className="mb-4">You may not use our service:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>In any way that violates any applicable national or international law or regulation</li>
                  <li>To transmit, or procure the sending of, any advertising or promotional material</li>
                  <li>To impersonate or attempt to impersonate the company, another user, or any other person or entity</li>
                  <li>To engage in any conduct that restricts or inhibits anyone's use or enjoyment of the service</li>
                  <li>To upload viruses or other malicious code</li>
                  <li>To harvest or collect email addresses or other contact information of other users</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">8. Limitation of Liability</h2>
                <p className="mb-4">
                  In no event shall {siteTitle}, nor its directors, employees, partners, agents, suppliers, or affiliates, be 
                  liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, 
                  loss of profits, data, use, or other intangible losses.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">9. Termination</h2>
                <p className="mb-4">
                  We may terminate or suspend your account and bar access to the service immediately, without prior notice or 
                  liability, under our sole discretion, for any reason whatsoever and without limitation, including but not 
                  limited to a breach of the Terms.
                </p>
                <p className="mb-4">
                  If you wish to terminate your account, you may simply discontinue using the service or delete your account 
                  through your account settings.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">10. Changes to Terms</h2>
                <p className="mb-4">
                  We reserve the right to modify or replace these Terms at any time. If a revision is material, we will provide 
                  at least 30 days' notice prior to any new terms taking effect. What constitutes a material change will be 
                  determined at our sole discretion.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">11. Governing Law</h2>
                <p className="mb-4">
                  These Terms shall be governed and construed in accordance with the laws of your jurisdiction, without regard 
                  to its conflict of law provisions.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">12. Contact Us</h2>
                <p className="mb-4">
                  If you have any questions about these Terms, please contact us at:
                </p>
                <div className="bg-gray-700 rounded-lg p-4">
                  <p className="text-white">Email: legal@{siteTitle.toLowerCase().replace(/\s+/g, '')}.com</p>
                </div>
              </section>
          </div>

          <div className="mt-12 pt-8 border-t border-gray-600">
            <Link to="/">
              <Button className="bg-teal-600 hover:bg-teal-700 text-white">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-950 text-gray-300 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-sm">
            © {new Date().getFullYear()} {siteTitle}. All rights reserved.
          </p>
          <div className="mt-4 flex justify-center gap-6 text-sm">
            <Link to="/privacy" className="hover:text-teal-400 transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-teal-400 transition-colors">Terms & Conditions</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default TermsConditions;
