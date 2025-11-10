import React, { useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Mail, Send, CheckCircle, AlertCircle, HelpCircle } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Support = ({ athleteId, athlete }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    name: athlete?.name || '',
    email: athlete?.email || '',
    subject: '',
    message: ''
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null); // 'success', 'error', or null
  const [errorMessage, setErrorMessage] = useState('');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus(null);
    setErrorMessage('');

    try {
      const response = await axios.post(`${API}/support/submit`, formData);
      
      if (response.data.success) {
        setSubmitStatus('success');
        // Reset form but keep name and email
        setFormData({
          name: athlete?.name || '',
          email: athlete?.email || '',
          subject: '',
          message: ''
        });
        
        // Auto-hide success message after 5 seconds
        setTimeout(() => {
          setSubmitStatus(null);
        }, 5000);
      }
    } catch (error) {
      console.error('Error submitting support form:', error);
      setSubmitStatus('error');
      setErrorMessage(
        error.response?.data?.detail || 
        t('support.errorMessage')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center">
            <HelpCircle className="mr-3 text-[#32D3FF]" size={36} />
            {t('support.title')}
          </h1>
          <p className="text-gray-400">
            {t('support.subtitle')}
          </p>
        </div>

        {/* Support Form Card */}
        <Card className="bg-gradient-to-br from-gray-800 to-gray-700 border-gray-600">
          <CardHeader>
            <CardTitle className="flex items-center text-white">
              <Mail className="mr-2 text-[#32D3FF]" />
              {t('support.contactSupport')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Success Message */}
            {submitStatus === 'success' && (
              <div className="mb-6 p-4 bg-blue-900/30 border border-blue-500/50 rounded-lg flex items-start">
                <CheckCircle className="mr-3 text-blue-500 flex-shrink-0 mt-0.5" size={20} />
                <div>
                  <p className="font-semibold text-blue-400">{t('support.successTitle')}</p>
                  <p className="text-blue-300 text-sm mt-1">
                    {t('support.successMessage')}
                  </p>
                </div>
              </div>
            )}

            {/* Error Message */}
            {submitStatus === 'error' && (
              <div className="mb-6 p-4 bg-red-900/30 border border-red-500/50 rounded-lg flex items-start">
                <AlertCircle className="mr-3 text-red-500 flex-shrink-0 mt-0.5" size={20} />
                <div>
                  <p className="font-semibold text-red-400">{t('support.errorTitle')}</p>
                  <p className="text-red-300 text-sm mt-1">
                    {errorMessage}
                  </p>
                </div>
              </div>
            )}

            {/* Support Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Name Field */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
                  {t('support.name')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#32D3FF] focus:border-transparent"
                  placeholder={t('support.namePlaceholder')}
                />
              </div>

              {/* Email Field */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                  {t('support.email')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#32D3FF] focus:border-transparent"
                  placeholder={t('support.emailPlaceholder')}
                />
              </div>

              {/* Subject Field */}
              <div>
                <label htmlFor="subject" className="block text-sm font-medium text-gray-300 mb-2">
                  {t('support.subject')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#32D3FF] focus:border-transparent"
                  placeholder={t('support.subjectPlaceholder')}
                />
              </div>

              {/* Message Field */}
              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-300 mb-2">
                  {t('support.message')} <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleInputChange}
                  required
                  rows={6}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                  placeholder={t('support.messagePlaceholder')}
                />
                <p className="text-gray-400 text-xs mt-1">
                  {t('support.messageCount', { count: formData.message.length })}
                </p>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2 rounded-lg flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                      {t('support.submitting')}
                    </>
                  ) : (
                    <>
                      <Send size={18} className="mr-2" />
                      {t('support.submit')}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Contact Info */}
        <div className="mt-6 text-center text-gray-400 text-sm">
          <p>
            You can also email us directly at:{' '}
            <a 
              href="mailto:support@kaizenlifetracker.com" 
              className="text-teal-500 hover:text-teal-400 underline"
            >
              support@kaizenlifetracker.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Support;
