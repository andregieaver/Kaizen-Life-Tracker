import { useState, useEffect } from 'react';
import axios from 'axios';

import { logger } from '../utils/logger';
import { getApiUrl } from '../utils/apiConfig';
const API = getApiUrl();

/**
 * Custom hook to fetch menu data
 * Returns default menus if API call fails
 */
export const useMenus = () => {
  const [menus, setMenus] = useState({
    header_logged_out: [],
    header_logged_in: [],
    slideout_menu: [],
    loading: true
  });

  useEffect(() => {
    const fetchMenus = async () => {
      try {
        // Try to fetch from API (public endpoint would be better)
        const response = await axios.get(`${API}/menus/public`);
        setMenus({
          ...response.data,
          loading: false
        });
      } catch (error) {
        logger.debug(null, 'Using default menus');
        // Use defaults if API fails
        setMenus({
          header_logged_out: [],
          header_logged_in: [],
          slideout_menu: [],
          loading: false
        });
      }
    };

    fetchMenus();
  }, []);

  return menus;
};

/**
 * Get icon component by name
 * Maps string icon names to Lucide React components
 */
export const getIconComponent = (iconName) => {
  // This will be imported dynamically by components
  return iconName || 'Circle';
};
