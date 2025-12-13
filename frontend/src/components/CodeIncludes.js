import { useEffect, useState } from 'react';
import axios from 'axios';
import { getApiUrl } from '../utils/apiConfig';

const API = getApiUrl();

/**
 * CodeIncludes Component
 * Fetches custom code includes from system settings and injects them into the page.
 * Handles head, body, and footer code injection.
 */
const CodeIncludes = () => {
  const [includes, setIncludes] = useState(null);
  const [injected, setInjected] = useState(false);

  useEffect(() => {
    // Fetch system settings (public endpoint)
    const fetchIncludes = async () => {
      try {
        const response = await axios.get(`${API}/system/settings/public`);
        if (response.data?.advanced?.includes) {
          setIncludes(response.data.advanced.includes);
        }
      } catch (error) {
        // Silently fail - includes are optional
        console.debug('CodeIncludes: Could not load includes', error.message);
      }
    };

    fetchIncludes();
  }, []);

  useEffect(() => {
    if (!includes || injected) return;

    // Inject head code
    if (includes.head && includes.head.trim()) {
      try {
        const headContainer = document.createElement('div');
        headContainer.id = 'custom-head-includes';
        headContainer.innerHTML = includes.head;
        
        // Move script and other elements to head
        const elements = headContainer.children;
        while (elements.length > 0) {
          document.head.appendChild(elements[0]);
        }
      } catch (error) {
        console.error('CodeIncludes: Error injecting head code', error);
      }
    }

    // Inject body code (after body opening)
    if (includes.body && includes.body.trim()) {
      try {
        const bodyContainer = document.createElement('div');
        bodyContainer.id = 'custom-body-includes';
        bodyContainer.innerHTML = includes.body;
        
        // Insert at the beginning of body
        if (document.body.firstChild) {
          document.body.insertBefore(bodyContainer, document.body.firstChild);
        } else {
          document.body.appendChild(bodyContainer);
        }
      } catch (error) {
        console.error('CodeIncludes: Error injecting body code', error);
      }
    }

    // Inject footer code (before body closing)
    if (includes.footer && includes.footer.trim()) {
      try {
        const footerContainer = document.createElement('div');
        footerContainer.id = 'custom-footer-includes';
        footerContainer.innerHTML = includes.footer;
        
        // Append to end of body
        document.body.appendChild(footerContainer);
      } catch (error) {
        console.error('CodeIncludes: Error injecting footer code', error);
      }
    }

    setInjected(true);
  }, [includes, injected]);

  // This component doesn't render anything visible
  return null;
};

export default CodeIncludes;
