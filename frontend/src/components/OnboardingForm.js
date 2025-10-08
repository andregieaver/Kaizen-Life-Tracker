import React, { useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Textarea } from './ui/textarea';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const OnboardingForm = ({ onAthleteCreated }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    age: '',
    weekly_mileage: '',
    recent_race_time: '',
    running_goals: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    if (!formData.age || formData.age < 16 || formData.age > 80) {
      newErrors.age = 'Please enter a valid age (16-80)';
    }
    
    if (!formData.weekly_mileage || formData.weekly_mileage < 5 || formData.weekly_mileage > 200) {
      newErrors.weekly_mileage = 'Please enter weekly mileage (5-200 miles)';
    }
    
    if (!formData.running_goals.trim()) {
      newErrors.running_goals = 'Please share your running goals';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      const athleteData = {
        ...formData,
        age: parseInt(formData.age),
        weekly_mileage: parseFloat(formData.weekly_mileage)
      };
      
      const response = await axios.post(`${API}/athlete`, athleteData);
      onAthleteCreated(response.data.id);
    } catch (error) {
      console.error('Error creating athlete profile:', error);
      setErrors({ submit: 'Failed to create profile. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl font-bold text-gray-900 mb-2">
            RunWisely
          </h1>
          <p className="text-lg text-gray-600">
            Your personal AI running coach
          </p>
        </div>

        {/* Form Card */}
        <Card className="glass border-0 shadow-xl">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl font-display font-semibold text-gray-900">
              Welcome, Runner!
            </CardTitle>
            <CardDescription className="text-gray-600">
              Let's create your personalized coaching profile
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium text-gray-700">
                  Full Name
                </Label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className={`input-focus ${errors.name ? 'border-red-300' : ''}`}
                  placeholder="Enter your full name"
                  data-testid="name-input"
                />
                {errors.name && (
                  <p className="text-sm text-red-600" data-testid="name-error">{errors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                  Email Address
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={`input-focus ${errors.email ? 'border-red-300' : ''}`}
                  placeholder="your.email@example.com"
                  data-testid="email-input"
                />
                {errors.email && (
                  <p className="text-sm text-red-600" data-testid="email-error">{errors.email}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                    Password
                  </Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    value={formData.password}
                    onChange={handleChange}
                    className={`input-focus ${errors.password ? 'border-red-300' : ''}`}
                    placeholder="Minimum 6 characters"
                    data-testid="password-input"
                  />
                  {errors.password && (
                    <p className="text-sm text-red-600" data-testid="password-error">{errors.password}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">
                    Confirm Password
                  </Label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className={`input-focus ${errors.confirmPassword ? 'border-red-300' : ''}`}
                    placeholder="Re-enter password"
                    data-testid="confirm-password-input"
                  />
                  {errors.confirmPassword && (
                    <p className="text-sm text-red-600" data-testid="confirm-password-error">{errors.confirmPassword}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="age" className="text-sm font-medium text-gray-700">
                    Age
                  </Label>
                  <Input
                    id="age"
                    name="age"
                    type="number"
                    value={formData.age}
                    onChange={handleChange}
                    className={`input-focus ${errors.age ? 'border-red-300' : ''}`}
                    placeholder="25"
                    min="16"
                    max="80"
                    data-testid="age-input"
                  />
                  {errors.age && (
                    <p className="text-sm text-red-600" data-testid="age-error">{errors.age}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="weekly_mileage" className="text-sm font-medium text-gray-700">
                    Weekly Miles
                  </Label>
                  <Input
                    id="weekly_mileage"
                    name="weekly_mileage"
                    type="number"
                    step="0.5"
                    value={formData.weekly_mileage}
                    onChange={handleChange}
                    className={`input-focus ${errors.weekly_mileage ? 'border-red-300' : ''}`}
                    placeholder="30"
                    min="5"
                    max="200"
                    data-testid="mileage-input"
                  />
                  {errors.weekly_mileage && (
                    <p className="text-sm text-red-600" data-testid="mileage-error">{errors.weekly_mileage}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="recent_race_time" className="text-sm font-medium text-gray-700">
                  Recent Race Time <span className="text-gray-400">(optional)</span>
                </Label>
                <Input
                  id="recent_race_time"
                  name="recent_race_time"
                  value={formData.recent_race_time}
                  onChange={handleChange}
                  className="input-focus"
                  placeholder="e.g., 5K: 22:30, Marathon: 3:45:00"
                  data-testid="race-time-input"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="running_goals" className="text-sm font-medium text-gray-700">
                  Running Goals
                </Label>
                <Textarea
                  id="running_goals"
                  name="running_goals"
                  value={formData.running_goals}
                  onChange={handleChange}
                  className={`input-focus min-h-20 resize-none ${errors.running_goals ? 'border-red-300' : ''}`}
                  placeholder="e.g., Train for Boston Marathon, improve 5K time, run injury-free..."
                  data-testid="goals-textarea"
                />
                {errors.running_goals && (
                  <p className="text-sm text-red-600" data-testid="goals-error">{errors.running_goals}</p>
                )}
              </div>

              {errors.submit && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600" data-testid="submit-error">{errors.submit}</p>
                </div>
              )}

              <Button 
                type="submit" 
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-medium py-3 rounded-lg btn-transition disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="create-profile-btn"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Creating Your Profile...
                  </div>
                ) : (
                  'Start Your AI Coaching Journey'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="text-center mt-6 space-y-3">
          <p className="text-sm text-gray-500">
            Your AI coach will analyze your data to provide personalized training insights
          </p>
          <div className="pt-2 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link 
                to="/login" 
                className="text-emerald-600 hover:text-emerald-700 font-medium hover:underline"
                data-testid="login-link"
              >
                Log in here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingForm;
