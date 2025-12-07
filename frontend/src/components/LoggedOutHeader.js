import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet';
import axios from 'axios';
import { logger } from '../utils/logger';

import { getApiUrl, getApiBaseUrl } from '../utils/apiConfig';
const API = getApiUrl();
const BACKEND_URL = getApiBaseUrl();

const LoggedOutHeader = () => {
  const navigate = useNavigate();
  const [logoUrl, setLogoUrl] = useState(null);
  const [siteTitle, setSiteTitle] = useState('TrainSmart');
  const [headerMenu, setHeaderMenu] = useState([]);
  const [slideoutMenu, setSlideoutMenu] = useState([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Fetch SEO settings and menus
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await axios.get(`${BACKEND_URL}/api/system/settings/public`);
        if (response.data?.seo) {
          const seo = response.data.seo;
          if (seo.siteTitle) setSiteTitle(seo.siteTitle);
          if (seo.logoUrl) setLogoUrl(seo.logoUrl);
        }
      } catch (error) {
        logger.error(null, 'Error fetching settings:', error);
      }
    };

    const fetchMenus = async () => {
      try {
        const response = await axios.get(`${API}/menus/public`);
        
        // Fetch header menu
        if (response.data?.header_logged_out) {
          const sortedItems = response.data.header_logged_out.sort((a, b) => (a.order || 0) - (b.order || 0));
          setHeaderMenu(sortedItems);
        }
        
        // Fetch slideout menu
        if (response.data?.slideout_menu_logged_out) {
          const sortedItems = response.data.slideout_menu_logged_out.sort((a, b) => (a.order || 0) - (b.order || 0));
          setSlideoutMenu(sortedItems);
        }
      } catch (error) {
        logger.error(null, 'Error fetching menus:', error);
      }
    };

    fetchSettings();
    fetchMenus();
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-gray-900/95 backdrop-blur-md border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            {logoUrl ? (
              <img 
                src={logoUrl} 
                alt={siteTitle} 
                className="h-8 w-auto"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-[#32D3FF] to-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">T</span>
                </div>
                <span className="text-xl font-bold text-white">{siteTitle}</span>
              </div>
            )}
          </button>

          {/* Right side - Menu buttons and Hamburger */}
          <div className="flex items-center gap-4">
            {/* Mobile Slideout Menu */}
            <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <SheetTrigger asChild className="lg:hidden">
                <button
                  className="p-2 text-white hover:text-[#32D3FF] transition-colors"
                  aria-label="Toggle menu"
                >
                  <Menu className="w-6 h-6" />
                </button>
              </SheetTrigger>
              <SheetContent 
                side="left" 
                className="w-[280px] bg-gray-900/95 border-r border-gray-700 p-0"
              >
                <div className="flex flex-col h-full">
                  {/* Menu Header */}
                  <div className="p-4 border-b border-gray-700">
                    <h2 className="text-lg font-semibold text-white">Menu</h2>
                  </div>
                  
                  {/* Menu Items */}
                  <div className="flex-1 overflow-y-auto p-4">
                    <nav className="space-y-2">
                      {slideoutMenu.length > 0 ? (
                        slideoutMenu.map((item, index) => {
                          if (item.is_separator) {
                            return (
                              <div
                                key={item.id || `separator-${index}`}
                                className="my-4 border-t border-gray-700"
                              />
                            );
                          }
                          
                          // Safely get icon component
                          const IconComponent = item.icon && LucideIcons[item.icon] ? LucideIcons[item.icon] : null;
                          
                          return (
                            <button
                              key={item.id || index}
                              onClick={() => {
                                navigate(item.url);
                                setIsMenuOpen(false);
                              }}
                              className="w-full flex items-center gap-3 px-4 py-3 text-white hover:bg-[#32D3FF]/20 rounded-lg transition-colors"
                            >
                              {IconComponent && <IconComponent className="w-5 h-5 text-[#32D3FF]" />}
                              <span>{item.label}</span>
                            </button>
                          );
                        })
                      ) : (
                        // Fallback default menu
                        <>
                          <button
                            onClick={() => {
                              navigate('/');
                              setIsMenuOpen(false);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-white hover:bg-[#32D3FF]/20 rounded-lg transition-colors"
                          >
                            <span>Home</span>
                          </button>
                          <button
                            onClick={() => {
                              navigate('/login');
                              setIsMenuOpen(false);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-white hover:bg-[#32D3FF]/20 rounded-lg transition-colors"
                          >
                            <span>Login</span>
                          </button>
                        </>
                      )}
                    </nav>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
            
            {/* Desktop Header Menu */}
            <div className="hidden lg:flex items-center gap-4">
              {headerMenu.length > 0 ? (
                headerMenu.map((item, index) => (
                  <button
                    key={index}
                    onClick={() => navigate(item.url)}
                    className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#32D3FF] disabled:pointer-events-none disabled:opacity-50 bg-[#32D3FF] text-white hover:bg-[#1FC1FF] h-9 px-4 py-2 shadow-md hover:shadow-lg"
                  >
                    {item.label}
                  </button>
                ))
              ) : (
                <button
                  onClick={() => navigate('/login')}
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#32D3FF] disabled:pointer-events-none disabled:opacity-50 bg-[#32D3FF] text-white hover:bg-[#1FC1FF] h-9 px-4 py-2 shadow-md hover:shadow-lg"
                >
                  Login
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default LoggedOutHeader;
