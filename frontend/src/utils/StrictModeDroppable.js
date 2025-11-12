import { useEffect, useState } from 'react';
import { Droppable } from 'react-beautiful-dnd';

/**
 * StrictModeDroppable
 * Wrapper for react-beautiful-dnd Droppable that works with React 18 StrictMode
 * 
 * React 18's StrictMode causes double-mounting which breaks react-beautiful-dnd.
 * This wrapper delays the enablement of the droppable until after initial mount.
 */
export const StrictModeDroppable = ({ children, isDropDisabled = false, ...props }) => {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const animation = requestAnimationFrame(() => setEnabled(true));
    return () => {
      cancelAnimationFrame(animation);
      setEnabled(false);
    };
  }, []);

  if (!enabled) {
    return null;
  }

  return <Droppable {...props} isDropDisabled={isDropDisabled}>{children}</Droppable>;
};
