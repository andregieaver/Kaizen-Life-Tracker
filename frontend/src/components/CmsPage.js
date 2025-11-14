import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from './ui/button';
import { Heart, ArrowLeft } from 'lucide-react';
import axios from 'axios';
import { loadAndInjectPageSEO } from '../utils/seoUtils';
import HtmlRenderer from '../utils/HtmlRenderer';

import { logger } from '../utils/logger';
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const CmsPage = () => {
  const location = useLocation();
  const [siteTitle, setSiteTitle] = useState('TrainSmart');
  const [pageData, setPageData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setNotFound(false);

        // Get the current URL path
        const urlSlug = location.pathname;

        // Fetch site title
        const settingsResponse = await axios.get(`${BACKEND_URL}/api/system/settings/public`);
        if (settingsResponse.data?.seo?.siteTitle) {
          setSiteTitle(settingsResponse.data.seo.siteTitle);
        }

        // Fetch page data by URL slug
        const pagesResponse = await axios.get(`${BACKEND_URL}/api/pages/public/by-slug?slug=${urlSlug}`);
        if (pagesResponse.data) {
          setPageData(pagesResponse.data);
          logger.debug(null, 'CMS Page data:', pagesResponse.data);
        }
      } catch (error) {
        logger.error(null, 'Error fetching page data:', error);
        if (error.response?.status === 404) {
          setNotFound(true);
        }
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
    
    // Load page-level SEO meta tags
    loadAndInjectPageSEO(location.pathname);
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-6xl font-bold text-white mb-4">404</h1>
          <p className="text-xl text-gray-400 mb-8">Page not found</p>
          <Link to="/">
            <Button className="bg-teal-600 hover:bg-teal-700 text-white">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

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
          {pageData && pageData.use_cms_content && pageData.content_blocks && pageData.content_blocks.length > 0 ? (
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
            // Fallback if no CMS content
            <div className="text-center py-12">
              <h1 className="text-4xl font-bold text-white mb-4">{pageData?.title || 'Page'}</h1>
              <p className="text-gray-400">This page is under construction.</p>
            </div>
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

export default CmsPage;
