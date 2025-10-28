import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Mail, Edit3, X, CheckCircle, XCircle } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Emails = () => {
  const [emailTemplates, setEmailTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    subject: '',
    body: '',
    htmlBody: ''
  });
  const [saveStatus, setSaveStatus] = useState({ type: '', message: '' });
  const [testEmailStatus, setTestEmailStatus] = useState({ type: '', message: '' });
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

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
    }
  ];

  useEffect(() => {
    loadEmailTemplates();
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
      console.error('Error loading email templates:', error);
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
      console.error('Error saving email template:', error);
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

  return (
    <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-white mb-2">Email Templates</h1>
        <p className="text-gray-300">Customize transactional email templates</p>
      </div>

      {/* Email Templates List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-12 h-12 border-4 border-[#00C2A8] border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {emailTemplates.map((template) => (
            <Card key={template.id} className="border-0 shadow-lg bg-gradient-to-br from-gray-700 to-gray-800">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-white flex items-center gap-2">
                      <Mail className="w-5 h-5 text-[#00C2A8]" />
                      {template.name}
                      {template.isCustomized && (
                        <span className="text-xs bg-[#00C2A8] text-white px-2 py-1 rounded">Customized</span>
                      )}
                    </CardTitle>
                    <CardDescription className="text-gray-400 mt-1">
                      {template.description}
                    </CardDescription>
                  </div>
                  <Button
                    onClick={() => handleEditClick(template)}
                    className="bg-[#00C2A8] hover:bg-[#00a890] text-white"
                    size="sm"
                  >
                    <Edit3 className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Subject:</p>
                    <p className="text-sm text-gray-300 font-medium">{template.subject}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Available Variables:</p>
                    <div className="flex flex-wrap gap-1">
                      {template.variables.map((variable) => (
                        <code key={variable} className="text-xs bg-gray-900 text-[#00C2A8] px-2 py-1 rounded">
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
                    <Mail className="w-6 h-6 text-[#00C2A8]" />
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
                <p className="text-white font-semibold mb-2">Available Variables:</p>
                <div className="flex flex-wrap gap-2">
                  {selectedTemplate.variables.map((variable) => (
                    <code key={variable} className="text-sm bg-gray-800 text-[#00C2A8] px-3 py-1 rounded border border-gray-700">
                      {variable}
                    </code>
                  ))}
                </div>
                <p className="text-gray-500 text-xs mt-2">Copy and paste these variables into your email content</p>
              </div>

              {/* Subject */}
              <div className="space-y-2">
                <Label htmlFor="subject" className="text-white font-semibold">Email Subject</Label>
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
                <Label htmlFor="body" className="text-white font-semibold">Plain Text Body</Label>
                <textarea
                  id="body"
                  value={editForm.body}
                  onChange={(e) => setEditForm({ ...editForm, body: e.target.value })}
                  className="w-full min-h-[200px] p-3 bg-gray-700 border border-gray-600 text-white rounded-md resize-vertical focus:ring-2 focus:ring-[#00C2A8] focus:border-transparent"
                  required
                />
                <p className="text-gray-500 text-xs">Plain text version for email clients that don't support HTML</p>
              </div>

              {/* HTML Body */}
              <div className="space-y-2">
                <Label htmlFor="htmlBody" className="text-white font-semibold">HTML Body</Label>
                <textarea
                  id="htmlBody"
                  value={editForm.htmlBody}
                  onChange={(e) => setEditForm({ ...editForm, htmlBody: e.target.value })}
                  className="w-full min-h-[300px] p-3 bg-gray-700 border border-gray-600 text-white rounded-md resize-vertical focus:ring-2 focus:ring-[#00C2A8] focus:border-transparent font-mono text-sm"
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
                    className="bg-[#00C2A8] hover:bg-[#00a890] text-white"
                  >
                    Save Template
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Emails;
