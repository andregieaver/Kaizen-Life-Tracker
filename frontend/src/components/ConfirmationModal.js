import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from './ui/button';

const ConfirmationModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = "Confirm Action",
  message = "Are you sure you want to proceed?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmButtonClass = "bg-red-500 hover:bg-red-600 text-white",
  icon = <AlertTriangle className="w-12 h-12 text-yellow-500" />
}) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[70] p-4"
      onClick={onClose}
      role="presentation"
    >
      <div 
        className="bg-gray-800 rounded-lg max-w-md w-full p-6 shadow-2xl border border-gray-700"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmation-modal-title"
        aria-describedby="confirmation-modal-description"
      >
        {/* Header with Icon */}
        <div className="flex items-start space-x-4 mb-4">
          <div className="flex-shrink-0">
            {icon}
          </div>
          <div className="flex-1">
            <h3 id="confirmation-modal-title" className="text-xl font-bold text-white mb-2">{title}</h3>
            <p id="confirmation-modal-description" className="text-gray-300 text-sm">{message}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-3 mt-6">
          <Button
            onClick={onClose}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white"
          >
            {cancelText}
          </Button>
          <Button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`flex-1 ${confirmButtonClass}`}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
