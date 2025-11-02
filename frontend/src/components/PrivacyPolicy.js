import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from './ui/button';
import { Heart, ArrowLeft } from 'lucide-react';
import axios from 'axios';
import { loadAndInjectPageSEO } from '../utils/seoUtils';
import HtmlRenderer from '../utils/HtmlRenderer';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const PrivacyPolicy = () => {
  const [siteTitle, setSiteTitle] = useState('TrainSmart');
  const [pageData, setPageData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch site title
        const settingsResponse = await axios.get(`${BACKEND_URL}/api/system/settings/public`);
        if (settingsResponse.data?.seo?.siteTitle) {
          setSiteTitle(settingsResponse.data.seo.siteTitle);
        }

        // Fetch page data by URL slug
        const pagesResponse = await axios.get(`${BACKEND_URL}/api/pages/public/by-slug?slug=/privacy-policy`);
        if (pagesResponse.data) {
          setPageData(pagesResponse.data);
          console.log('Privacy page data:', pagesResponse.data);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        // If page not found in CMS, we'll use hard-coded content
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
    
    // Load page-level SEO meta tags
    loadAndInjectPageSEO('/privacy-policy');
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
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
              <p className="text-gray-400 mt-4">Loading...</p>
            </div>
          ) : pageData && pageData.use_cms_content && pageData.content_blocks && pageData.content_blocks.length > 0 ? (
            // Render CMS content blocks
            <div className="space-y-6">
              {pageData.content_blocks
                .sort((a, b) => (a.order || 0) - (b.order || 0))
                .map((block) => (
                  <HtmlRenderer
                    key={block.id}
                    html={block.content}
                    className="cms-content text-gray-300"
                  />
                ))}
            </div>
          ) : (
            // Render hard-coded content (fallback)
            <>
              <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">Privacy Policy</h1>
              <p className="text-gray-400 mb-8">Last updated: {new Date().toLocaleDateString()}</p>

              <div className="space-y-8 text-gray-300">
              <section>
                <h2 className="text-2xl font-bold text-white mb-4">1. Introduction</h2>
                <p className="mb-4">
                  Welcome to {siteTitle}. We respect your privacy and are committed to protecting your personal data. 
                  This privacy policy will inform you about how we look after your personal data when you visit our 
                  website and tell you about your privacy rights and how the law protects you.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">2. Information We Collect</h2>
                <p className="mb-4">We may collect, use, store and transfer different kinds of personal data about you:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li><strong className="text-white">Identity Data:</strong> Name, username, date of birth</li>
                  <li><strong className="text-white">Contact Data:</strong> Email address, telephone number</li>
                  <li><strong className="text-white">Health Data:</strong> Fitness metrics, workout data, health goals</li>
                  <li><strong className="text-white">Technical Data:</strong> IP address, browser type, device information</li>
                  <li><strong className="text-white">Usage Data:</strong> Information about how you use our website and services</li>
                  <li><strong className="text-white">Marketing Data:</strong> Your preferences for receiving marketing communications</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">3. How We Use Your Information</h2>
                <p className="mb-4">We use your personal data for the following purposes:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>To provide and maintain our service</li>
                  <li>To notify you about changes to our service</li>
                  <li>To provide customer support</li>
                  <li>To gather analysis or valuable information to improve our service</li>
                  <li>To monitor the usage of our service</li>
                  <li>To detect, prevent and address technical issues</li>
                  <li>To provide personalized fitness and health recommendations</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">4. Data Security</h2>
                <p className="mb-4">
                  We have implemented appropriate security measures to prevent your personal data from being accidentally 
                  lost, used or accessed in an unauthorized way, altered or disclosed. We use industry-standard encryption 
                  and secure servers to protect your data.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">5. Data Retention</h2>
                <p className="mb-4">
                  We will only retain your personal data for as long as necessary to fulfill the purposes we collected it for, 
                  including for the purposes of satisfying any legal, accounting, or reporting requirements.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">6. Your Legal Rights</h2>
                <p className="mb-4">Under certain circumstances, you have rights under data protection laws in relation to your personal data:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Request access to your personal data</li>
                  <li>Request correction of your personal data</li>
                  <li>Request erasure of your personal data</li>
                  <li>Object to processing of your personal data</li>
                  <li>Request restriction of processing your personal data</li>
                  <li>Request transfer of your personal data</li>
                  <li>Right to withdraw consent</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">7. Third-Party Services</h2>
                <p className="mb-4">
                  We may use third-party services to help us operate our business, such as payment processors, analytics 
                  providers, and cloud storage services. These third parties have access to your personal data only to 
                  perform these tasks on our behalf and are obligated not to disclose or use it for any other purpose.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">8. Cookies</h2>
                <p className="mb-4">
                  We use cookies and similar tracking technologies to track activity on our service and hold certain information. 
                  You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">9. Changes to This Privacy Policy</h2>
                <p className="mb-4">
                  We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new 
                  Privacy Policy on this page and updating the "Last updated" date.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-white mb-4">10. Contact Us</h2>
                <p className="mb-4">
                  If you have any questions about this Privacy Policy, please contact us at:
                </p>
                <div className="bg-gray-700 rounded-lg p-4">
                  <p className="text-white">Email: privacy@{siteTitle.toLowerCase().replace(/\s+/g, '')}.com</p>
                </div>
              </section>
            </div>
              </>
            )}

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

export default PrivacyPolicy;
