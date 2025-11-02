import React, { useEffect, useRef } from 'react';

/**
 * HtmlRenderer Component
 * Renders HTML content with support for inline CSS, JavaScript, and script tags
 * 
 * Features:
 * - Inline CSS (style attributes) - fully supported
 * - <script> tags - executed after mount
 * - Inline event handlers - supported via manual binding
 */
const HtmlRenderer = ({ html, className = '' }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !html) return;

    const container = containerRef.current;
    
    // Set the HTML content
    container.innerHTML = html;

    // Extract and execute script tags
    const scripts = container.querySelectorAll('script');
    scripts.forEach((oldScript) => {
      const newScript = document.createElement('script');
      
      // Copy attributes
      Array.from(oldScript.attributes).forEach((attr) => {
        newScript.setAttribute(attr.name, attr.value);
      });
      
      // Copy script content
      if (oldScript.src) {
        // External script
        newScript.src = oldScript.src;
      } else {
        // Inline script
        newScript.textContent = oldScript.textContent;
      }
      
      // Replace old script with new one to execute it
      oldScript.parentNode.replaceChild(newScript, oldScript);
    });

    // Handle inline event handlers (onclick, onload, etc.)
    const elementsWithEvents = container.querySelectorAll('[onclick], [onmouseover], [onmouseout], [onload], [oninput], [onchange]');
    elementsWithEvents.forEach((element) => {
      // onclick
      if (element.getAttribute('onclick')) {
        const onclickCode = element.getAttribute('onclick');
        element.onclick = new Function(onclickCode);
      }
      
      // onmouseover
      if (element.getAttribute('onmouseover')) {
        const onmouseoverCode = element.getAttribute('onmouseover');
        element.onmouseover = new Function(onmouseoverCode);
      }
      
      // onmouseout
      if (element.getAttribute('onmouseout')) {
        const onmouseoutCode = element.getAttribute('onmouseout');
        element.onmouseout = new Function(onmouseoutCode);
      }
      
      // onload
      if (element.getAttribute('onload')) {
        const onloadCode = element.getAttribute('onload');
        element.onload = new Function(onloadCode);
      }
      
      // oninput
      if (element.getAttribute('oninput')) {
        const oninputCode = element.getAttribute('oninput');
        element.oninput = new Function(oninputCode);
      }
      
      // onchange
      if (element.getAttribute('onchange')) {
        const onchangeCode = element.getAttribute('onchange');
        element.onchange = new Function(onchangeCode);
      }
    });

    // Cleanup function
    return () => {
      // Remove event listeners and clean up
      if (container) {
        container.innerHTML = '';
      }
    };
  }, [html]);

  return <div ref={containerRef} className={className} />;
};

export default HtmlRenderer;
