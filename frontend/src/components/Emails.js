import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Mail, Edit3, X, CheckCircle, XCircle, Plus, Trash2, Send } from 'lucide-react';

import { logger } from '../utils/logger';
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Emails = () => {
  const { t } = useTranslation();
  const [emailTemplates, setEmailTemplates] = useState([]);
  const [customEmails, setCustomEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedCustomEmail, setSelectedCustomEmail] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCustomEmailModal, setShowCustomEmailModal] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [editForm, setEditForm] = useState({
    subject: '',
    body: '',
    htmlBody: ''
  });
  const [customEmailForm, setCustomEmailForm] = useState({
    name: '',
    subject: '',
    body: '',
    htmlBody: '',
    targetAudience: 'all' // all, waitlist, free, pro, premium
  });
  const [saveStatus, setSaveStatus] = useState({ type: '', message: '' });
  const [testEmailStatus, setTestEmailStatus] = useState({ type: '', message: '' });
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  const defaultTemplates = [
    {
      id: 'reset_password',
      name: 'Password Reset',
      description: 'Email sent when user requests password reset',
      variables: ['{{reset_link}}', '{{user_name}}'],
      defaultSubject: 'Reset Your Password',
      defaultBody: 'Hi {{user_name}},\n\nYou requested to reset your password. Click the link below to reset it:\n\n{{reset_link}}\n\nIf you didn\'t request this, please ignore this email.',
      defaultHtmlBody: '<p>Hi {{user_name}},</p><p>You requested to reset your password. Click the link below to reset it:</p><p><a href="{{reset_link}}">Reset Password</a></p><p>If you didn\'t request this, please ignore this email.</p>'
    },
    {
      id: 'welcome',
      name: 'Welcome Email',
      description: 'Email sent when new user signs up',
      variables: ['{{user_name}}', '{{login_url}}'],
      defaultSubject: 'Welcome to TrainSmart!',
      defaultBody: 'Hi {{user_name}},\n\nWelcome to TrainSmart! We\'re excited to have you on board.\n\nGet started: {{login_url}}',
      defaultHtmlBody: '<p>Hi {{user_name}},</p><p>Welcome to TrainSmart! We\'re excited to have you on board.</p><p><a href="{{login_url}}">Get Started</a></p>'
    },
    {
      id: 'email_changed',
      name: 'Email Changed Confirmation',
      description: 'Email sent when user changes their email address',
      variables: ['{{user_name}}', '{{new_email}}'],
      defaultSubject: 'Your Email Address Has Been Changed',
      defaultBody: 'Hi {{user_name}},\n\nYour email address has been successfully changed to {{new_email}}.\n\nIf you didn\'t make this change, please contact support immediately.',
      defaultHtmlBody: '<p>Hi {{user_name}},</p><p>Your email address has been successfully changed to {{new_email}}.</p><p>If you didn\'t make this change, please contact support immediately.</p>'
    },
    {
      id: 'password_changed',
      name: 'Password Changed Confirmation',
      description: 'Email sent when user changes their password',
      variables: ['{{user_name}}'],
      defaultSubject: 'Your Password Has Been Changed',
      defaultBody: 'Hi {{user_name}},\n\nYour password has been successfully changed.\n\nIf you didn\'t make this change, please contact support immediately.',
      defaultHtmlBody: '<p>Hi {{user_name}},</p><p>Your password has been successfully changed.</p><p>If you didn\'t make this change, please contact support immediately.</p>'
    },
    {
      id: 'waitlist_autoresponder',
      name: 'Waitlist Auto-responder',
      description: 'Welcome email sent to users who sign up for the waiting list',
      variables: ['{{user_name}}', '{{user_email}}', '{{preferred_language}}'],
      defaultSubject: 'Thank You for Joining Our Waitlist!',
      defaultBody: 'Hi {{user_name}},\n\nThank you for signing up for our waitlist! We\'re excited to have you join us.\n\nYour email: {{user_email}}\nPreferred language: {{preferred_language}}\n\nWe\'ll notify you as soon as we launch. Stay tuned!\n\nBest regards,\nThe Team',
      defaultHtmlBody: '<p>Hi {{user_name}},</p><p>Thank you for signing up for our waitlist! We\'re excited to have you join us.</p><p><strong>Your email:</strong> {{user_email}}<br><strong>Preferred language:</strong> {{preferred_language}}</p><p>We\'ll notify you as soon as we launch. Stay tuned!</p><p>Best regards,<br>The Team</p>'
    }
  ];

  useEffect(() => {
    loadEmailTemplates();
    loadCustomEmails();
  }, []);

  const loadEmailTemplates = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/email-templates`);
      // Merge with default templates
      const templates = defaultTemplates.map(defaultTemplate => {
        const customTemplate = response.data.find(t => t.template_id === defaultTemplate.id);
        return {
          ...defaultTemplate,
          subject: customTemplate?.subject || defaultTemplate.defaultSubject,
          body: customTemplate?.body || defaultTemplate.defaultBody,
          htmlBody: customTemplate?.html_body || defaultTemplate.defaultHtmlBody,
          isCustomized: !!customTemplate
        };
      });
      setEmailTemplates(templates);
    } catch (error) {
      logger.error(null, 'Error loading email templates:', error);
      // Use default templates if API fails
      setEmailTemplates(defaultTemplates.map(t => ({
        ...t,
        subject: t.defaultSubject,
        body: t.defaultBody,
        htmlBody: t.defaultHtmlBody,
        isCustomized: false
      })));
    } finally {
      setLoading(false);
    }
  };

  const loadCustomEmails = async () => {
    try {
      const response = await axios.get(`${API}/custom-emails`);
      setCustomEmails(response.data.emails || []);
    } catch (error) {
      logger.error(null, 'Error loading custom emails:', error);
      setCustomEmails([]);
    }
  };

  const handleCreateNewEmail = () => {
    setIsCreatingNew(true);
    setSelectedCustomEmail(null);
    setCustomEmailForm({
      name: '',
      subject: '',
      body: '',
      htmlBody: '',
      targetAudience: 'all'
    });
    setShowCustomEmailModal(true);
    setSaveStatus({ type: '', message: '' });
  };

  const handleEditCustomEmail = (email) => {
    setIsCreatingNew(false);
    setSelectedCustomEmail(email);
    setCustomEmailForm({
      name: email.name,
      subject: email.subject,
      body: email.body,
      htmlBody: email.html_body || '',
      targetAudience: email.target_audience
    });
    setShowCustomEmailModal(true);
    setSaveStatus({ type: '', message: '' });
  };

  const handleSaveCustomEmail = async (e) => {
    e.preventDefault();
    setSaveStatus({ type: '', message: '' });

    if (!customEmailForm.name.trim()) {
      setSaveStatus({ type: 'error', message: t('emails.emailNameRequired') });
      return;
    }
    if (!customEmailForm.subject.trim()) {
      setSaveStatus({ type: 'error', message: 'Subject is required' });
      return;
    }

    try {
      const payload = {
        name: customEmailForm.name,
        subject: customEmailForm.subject,
        body: customEmailForm.body,
        html_body: customEmailForm.htmlBody,
        target_audience: customEmailForm.targetAudience
      };

      if (isCreatingNew) {
        await axios.post(`${API}/custom-emails`, payload);
        setSaveStatus({ type: 'success', message: 'Custom email created successfully!' });
      } else {
        await axios.put(`${API}/custom-emails/${selectedCustomEmail.id}`, payload);
        setSaveStatus({ type: 'success', message: 'Custom email updated successfully!' });
      }

      await loadCustomEmails();
      
      setTimeout(() => {
        setShowCustomEmailModal(false);
        setSelectedCustomEmail(null);
      }, 1500);
    } catch (error) {
      logger.error(null, 'Error saving custom email:', error);
      setSaveStatus({ type: 'error', message: error.response?.data?.detail || 'Failed to save custom email' });
    }
  };

  const handleDeleteCustomEmail = async (emailId) => {
    if (!window.confirm('Are you sure you want to delete this custom email?')) return;

    try {
      await axios.delete(`${API}/custom-emails/${emailId}`);
      await loadCustomEmails();
    } catch (error) {
      logger.error(null, 'Error deleting custom email:', error);
      alert('Failed to delete custom email');
    }
  };

  const handleSendCustomEmail = async (emailId) => {
    if (!window.confirm('Are you sure you want to send this email to the targeted audience?')) return;

    setSendingEmail(true);
    try {
      const response = await axios.post(`${API}/custom-emails/${emailId}/send`);
      alert(`Email sent successfully to ${response.data.sent_count} recipients!`);
    } catch (error) {
      logger.error(null, 'Error sending custom email:', error);
      alert(error.response?.data?.detail || 'Failed to send email');
    } finally {
      setSendingEmail(false);
    }
  };

  const handleEditClick = (template) => {
    setSelectedTemplate(template);
    setEditForm({
      subject: template.subject,
      body: template.body,
      htmlBody: template.htmlBody
    });
    setShowEditModal(true);
    setSaveStatus({ type: '', message: '' });
    setTestEmailStatus({ type: '', message: '' });
    setTestEmail('');
  };

  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    setSaveStatus({ type: '', message: '' });

    try {
      await axios.post(`${API}/email-templates`, {
        template_id: selectedTemplate.id,
        subject: editForm.subject,
        body: editForm.body,
        html_body: editForm.htmlBody
      });

      setSaveStatus({ type: 'success', message: 'Email template saved successfully!' });
      
      // Reload templates
      await loadEmailTemplates();
      
      // Close modal after 1.5 seconds
      setTimeout(() => {
        setShowEditModal(false);
        setSelectedTemplate(null);
      }, 1500);
    } catch (error) {
      logger.error(null, 'Error saving email template:', error);
      setSaveStatus({ type: 'error', message: 'Failed to save email template' });
    }
  };

  const handleResetToDefault = () => {
    if (selectedTemplate) {
      setEditForm({
        subject: selectedTemplate.defaultSubject,
        body: selectedTemplate.defaultBody,
        htmlBody: selectedTemplate.defaultHtmlBody
      });
    }
  };

  const handleSendTestEmail = async (e) => {
    e.preventDefault();
    if (!testEmail) {
      setTestEmailStatus({ type: 'error', message: 'Please enter an email address' });
      return;
    }

    setSendingTest(true);
    setTestEmailStatus({ type: '', message: '' });

    try {
      await axios.post(`${API}/email-templates/send-test`, {
        template_id: selectedTemplate.id,
        to_email: testEmail,
        subject: editForm.subject,
        body: editForm.body,
        html_body: editForm.htmlBody
      });

      setTestEmailStatus({ type: 'success', message: `Test email sent successfully to ${testEmail}!` });
    } catch (error) {
      logger.error(null, 'Error sending test email:', error);
      setTestEmailStatus({ type: 'error', message: t('emails.failedSendTest') });
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-white mb-2">{t('emails.title')}</h1>
        <p className="text-gray-300">{t('emails.description')}</p>
      </div>

      {/* Custom Emails Section */}
      <div className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-white">{t('emails.customEmails')}</h2>
            <p className="text-gray-400 text-sm mt-1">{t('emails.customEmailsDesc')}</p>
          </div>
          <Button
            onClick={handleCreateNewEmail}
            className="bg-[#32D3FF] hover:bg-[#00a890] text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            {t('emails.createEmail')}
          </Button>
        </div>

        {customEmails.length === 0 ? (
          <Card className="border-0 shadow-lg bg-gradient-to-br from-gray-700 to-gray-800">
            <CardContent className="py-12 text-center">
              <Mail className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400">{t('emails.noEmailsYet')}</p>
              <p className="text-gray-500 text-sm mt-2">{t('emails.clickCreateEmail')}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {customEmails.map((email) => (
              <Card key={email.id} className="border-0 shadow-lg bg-gradient-to-br from-gray-700 to-gray-800">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-white flex items-center gap-2">
                        <Mail className="w-5 h-5 text-[#32D3FF]" />
                        {email.name}
                      </CardTitle>
                      <CardDescription className="text-gray-400 mt-1">
                        {t('emails.target')}: <span className="font-semibold capitalize">{t(`emails.${email.target_audience}`)}</span>
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleEditCustomEmail(email)}
                        className="bg-gray-600 hover:bg-gray-500 text-white"
                        size="sm"
                      >
                        <Edit3 className="w-4 h-4" />
                      </Button>
                      <Button
                        onClick={() => handleDeleteCustomEmail(email.id)}
                        className="bg-red-600 hover:bg-red-700 text-white"
                        size="sm"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">{t('emails.subject')}:</p>
                      <p className="text-sm text-gray-300 font-medium">{email.subject}</p>
                    </div>
                    <Button
                      onClick={() => handleSendCustomEmail(email.id)}
                      className="w-full bg-[#32D3FF] hover:bg-[#00a890] text-white"
                      disabled={sendingEmail}
                    >
                      <Send className="w-4 h-4 mr-2" />
                      {sendingEmail ? t('emails.sending') : t('emails.send')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Transactional Email Templates Section */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white mb-4">{t('emails.transactionalTemplates')}</h2>
        <p className="text-gray-400 text-sm mb-4">{t('emails.transactionalDesc')}</p>
      </div>

      {/* Email Templates List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-12 h-12 border-4 border-[#32D3FF] border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {emailTemplates.map((template) => (
            <Card key={template.id} className="border-0 shadow-lg bg-gradient-to-br from-gray-700 to-gray-800">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-white flex items-center gap-2">
                      <Mail className="w-5 h-5 text-[#32D3FF]" />
                      {template.id === 'reset_password' ? t('emails.passwordReset') :
                       template.id === 'welcome' ? t('emails.welcomeEmail') :
                       template.id === 'email_changed' ? t('emails.emailChanged') : template.name}
                      {template.isCustomized && (
                        <span className="text-xs bg-[#32D3FF] text-white px-2 py-1 rounded">Customized</span>
                      )}
                    </CardTitle>
                    <CardDescription className="text-gray-400 mt-1">
                      {template.id === 'reset_password' ? t('emails.passwordResetDesc') :
                       template.id === 'welcome' ? t('emails.welcomeEmailDesc') :
                       template.id === 'email_changed' ? t('emails.emailChangedDesc') : template.description}
                    </CardDescription>
                  </div>
                  <Button
                    onClick={() => handleEditClick(template)}
                    className="bg-[#32D3FF] hover:bg-[#00a890] text-white"
                    size="sm"
                  >
                    <Edit3 className="w-4 h-4 mr-1" />
                    {t('emails.edit')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">{t('emails.subject')}:</p>
                    <p className="text-sm text-gray-300 font-medium">{template.subject}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">{t('emails.availableVariables')}:</p>
                    <div className="flex flex-wrap gap-1">
                      {template.variables.map((variable) => (
                        <code key={variable} className="text-xs bg-gray-900 text-[#32D3FF] px-2 py-1 rounded">
                          {variable}
                        </code>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedTemplate && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowEditModal(false)}>
          <div className="bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-6 z-10">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Mail className="w-6 h-6 text-[#32D3FF]" />
                    Edit {selectedTemplate.name}
                  </h2>
                  <p className="text-gray-400 text-sm mt-1">{selectedTemplate.description}</p>
                </div>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveTemplate} className="p-6 space-y-6">
              {/* Status Message */}
              {saveStatus.message && (
                <div className={`p-4 rounded-lg border ${
                  saveStatus.type === 'success' 
                    ? 'bg-green-900/30 border-green-700 text-green-400'
                    : 'bg-red-900/30 border-red-700 text-red-400'
                }`}>
                  <div className="flex items-center">
                    {saveStatus.type === 'success' ? (
                      <CheckCircle className="w-4 h-4 mr-2" />
                    ) : (
                      <XCircle className="w-4 h-4 mr-2" />
                    )}
                    {saveStatus.message}
                  </div>
                </div>
              )}

              {/* Available Variables */}
              <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                <p className="text-white font-semibold mb-2">{t('emails.availableVariables')}:</p>
                <div className="flex flex-wrap gap-2">
                  {selectedTemplate.variables.map((variable) => (
                    <code key={variable} className="text-sm bg-gray-800 text-[#32D3FF] px-3 py-1 rounded border border-gray-700">
                      {variable}
                    </code>
                  ))}
                </div>
                <p className="text-gray-500 text-xs mt-2">{t('emails.copyPasteVariables')}</p>
              </div>

              {/* Send Test Email */}
              <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
                <p className="text-white font-semibold mb-3">{t('emails.sendTestEmail')}</p>
                {testEmailStatus.message && (
                  <div className={`mb-3 p-3 rounded border text-sm ${
                    testEmailStatus.type === 'success' 
                      ? 'bg-green-900/30 border-green-700 text-green-400'
                      : 'bg-red-900/30 border-red-700 text-red-400'
                  }`}>
                    <div className="flex items-center">
                      {testEmailStatus.type === 'success' ? (
                        <CheckCircle className="w-4 h-4 mr-2" />
                      ) : (
                        <XCircle className="w-4 h-4 mr-2" />
                      )}
                      {testEmailStatus.message}
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder={t('emails.enterEmailAddress')}
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    className="flex-1 bg-gray-700 border-gray-600 text-white"
                  />
                  <Button
                    type="button"
                    onClick={handleSendTestEmail}
                    disabled={sendingTest || !testEmail}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {sendingTest ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        {t('emails.sending')}
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4 mr-2" />
                        {t('emails.sendTest')}
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-gray-400 text-xs mt-2">{t('emails.variablesReplacedHint')}</p>
              </div>

              {/* Subject */}
              <div className="space-y-2">
                <Label htmlFor="subject" className="text-white font-semibold">{t('emails.emailSubject')}</Label>
                <Input
                  id="subject"
                  value={editForm.subject}
                  onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })}
                  className="bg-gray-700 border-gray-600 text-white"
                  required
                />
              </div>

              {/* Plain Text Body */}
              <div className="space-y-2">
                <Label htmlFor="body" className="text-white font-semibold">{t('emails.plainTextBody')}</Label>
                <textarea
                  id="body"
                  value={editForm.body}
                  onChange={(e) => setEditForm({ ...editForm, body: e.target.value })}
                  className="w-full min-h-[200px] p-3 bg-gray-700 border border-gray-600 text-white rounded-md resize-vertical focus:ring-2 focus:ring-[#32D3FF] focus:border-transparent"
                  required
                />
                <p className="text-gray-500 text-xs">{t('emails.plainTextVersionHint')}</p>
              </div>

              {/* HTML Body */}
              <div className="space-y-2">
                <Label htmlFor="htmlBody" className="text-white font-semibold">HTML Body</Label>
                <textarea
                  id="htmlBody"
                  value={editForm.htmlBody}
                  onChange={(e) => setEditForm({ ...editForm, htmlBody: e.target.value })}
                  className="w-full min-h-[300px] p-3 bg-gray-700 border border-gray-600 text-white rounded-md resize-vertical focus:ring-2 focus:ring-[#32D3FF] focus:border-transparent font-mono text-sm"
                  required
                />
                <p className="text-gray-500 text-xs">HTML version with styling and formatting</p>
              </div>

              {/* Actions */}
              <div className="flex justify-between gap-3 pt-4">
                <Button
                  type="button"
                  onClick={handleResetToDefault}
                  className="bg-gray-700 hover:bg-gray-600 text-white"
                >
                  Reset to Default
                </Button>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="bg-gray-700 hover:bg-gray-600 text-white"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-[#32D3FF] hover:bg-[#00a890] text-white"
                  >
                    Save Template
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Email Create/Edit Modal */}
      {showCustomEmailModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowCustomEmailModal(false)}>
          <div className="bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-6 z-10">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white">{isCreatingNew ? t('emails.createCustomEmail') : t('emails.editCustomEmail')}</h2>
                  <p className="text-gray-400 text-sm mt-1">{t('emails.createTargetedCampaigns')}</p>
                </div>
                <button
                  onClick={() => setShowCustomEmailModal(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveCustomEmail} className="p-6">
              <div className="space-y-6">
                {/* Email Name */}
                <div>
                  <Label htmlFor="email-name" className="text-white mb-2">{t('emails.emailName')} *</Label>
                  <Input
                    id="email-name"
                    value={customEmailForm.name}
                    onChange={(e) => setCustomEmailForm({ ...customEmailForm, name: e.target.value })}
                    placeholder={t('emails.emailNamePlaceholder')}
                    className="bg-gray-700 border-gray-600 text-white"
                    required
                  />
                  <p className="text-xs text-gray-400 mt-1">{t('emails.internalNameHint')}</p>
                </div>

                {/* Target Audience */}
                <div>
                  <Label htmlFor="target-audience" className="text-white mb-2">{t('emails.targetAudience')} *</Label>
                  <select
                    id="target-audience"
                    value={customEmailForm.targetAudience}
                    onChange={(e) => setCustomEmailForm({ ...customEmailForm, targetAudience: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-2 focus:border-[#32D3FF] focus:ring-2 focus:ring-[#32D3FF]/20 outline-none"
                  >
                    <option value="all">{t('emails.allUsers')}</option>
                    <option value="waitlist">{t('emails.waitlistUsers')}</option>
                    <option value="free">{t('emails.freePlanUsers')}</option>
                    <option value="pro">{t('emails.proPlanUsers')}</option>
                    <option value="premium">{t('emails.premiumPlanUsers')}</option>
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    {customEmailForm.targetAudience === 'waitlist' && t('emails.waitlistHint')}
                    {customEmailForm.targetAudience === 'free' && t('emails.freeHint')}
                    {customEmailForm.targetAudience === 'pro' && t('emails.proHint')}
                    {customEmailForm.targetAudience === 'premium' && t('emails.premiumHint')}
                    {customEmailForm.targetAudience === 'all' && t('emails.allUsersHint')}
                  </p>
                </div>

                {/* Subject */}
                <div>
                  <Label htmlFor="custom-subject" className="text-white mb-2">{t('emails.subjectLine')} *</Label>
                  <Input
                    id="custom-subject"
                    value={customEmailForm.subject}
                    onChange={(e) => setCustomEmailForm({ ...customEmailForm, subject: e.target.value })}
                    placeholder={t('emails.subjectPlaceholderCustom')}
                    className="bg-gray-700 border-gray-600 text-white"
                    required
                  />
                </div>

                {/* Plain Text Body */}
                <div>
                  <Label htmlFor="custom-body" className="text-white mb-2">{t('emails.plainTextBody')} *</Label>
                  <textarea
                    id="custom-body"
                    value={customEmailForm.body}
                    onChange={(e) => setCustomEmailForm({ ...customEmailForm, body: e.target.value })}
                    placeholder={t('emails.plainTextBodyPlaceholder')}
                    className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-2 focus:border-[#32D3FF] focus:ring-2 focus:ring-[#32D3FF]/20 outline-none"
                    rows="8"
                    required
                  />
                  <p className="text-xs text-gray-400 mt-1">{t('emails.availableVariablesHint')}</p>
                </div>

                {/* HTML Body */}
                <div>
                  <Label htmlFor="custom-html-body" className="text-white mb-2">{t('emails.htmlBody')}</Label>
                  <textarea
                    id="custom-html-body"
                    value={customEmailForm.htmlBody}
                    onChange={(e) => setCustomEmailForm({ ...customEmailForm, htmlBody: e.target.value })}
                    placeholder={t('emails.htmlBodyPlaceholder')}
                    className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-2 focus:border-[#32D3FF] focus:ring-2 focus:ring-[#32D3FF]/20 outline-none font-mono text-sm"
                    rows="8"
                  />
                  <p className="text-xs text-gray-400 mt-1">{t('emails.htmlVersionHint')}</p>
                </div>

                {/* Status Messages */}
                {saveStatus.message && (
                  <div className={`flex items-center gap-2 p-4 rounded-lg ${
                    saveStatus.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                  }`}>
                    {saveStatus.type === 'success' ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <XCircle className="w-5 h-5" />
                    )}
                    <span>{saveStatus.message}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 mt-8">
                <Button
                  type="button"
                  onClick={() => setShowCustomEmailModal(false)}
                  className="bg-gray-700 hover:bg-gray-600 text-white"
                >
                  {t('emails.cancel')}
                </Button>
                <Button
                  type="submit"
                  className="bg-[#32D3FF] hover:bg-[#00a890] text-white"
                >
                  {isCreatingNew ? t('emails.createEmailButton') : t('emails.updateEmail')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Emails;
