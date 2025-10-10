import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import Dashboard from './components/Dashboard';
import OnboardingForm from './components/OnboardingForm';
import Login from './components/Login';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';
import Pricing from './components/Pricing';
import Journal from './components/Journal';
import StravaCallback from './components/StravaCallback';
import OuraCallback from './components/OuraCallback';
import CorosCallback from './components/CorosCallback';
import LandingPage from './components/LandingPage';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  const { t } = useTranslation();
  const [athleteId, setAthleteId] = useState(localStorage.getItem('athleteId'));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if athlete exists in localStorage and validate
    const storedAthleteId = localStorage.getItem('athleteId');
    if (storedAthleteId) {
      validateAthlete(storedAthleteId);
    } else {
      setIsLoading(false);
    }
  }, []);

  const validateAthlete = async (id) => {
    try {
      await axios.get(`${API}/athlete/${id}`);
      setAthleteId(id);
    } catch (error) {
      console.error('Invalid athlete ID, clearing localStorage');
      localStorage.removeItem('athleteId');
      setAthleteId(null);
    }
    setIsLoading(false);
  };

  const handleAthleteCreated = (id) => {
    localStorage.setItem('athleteId', id);
    setAthleteId(id);
  };

  const handleAthleteLogin = (id) => {
    localStorage.setItem('athleteId', id);
    setAthleteId(id);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-lg text-gray-600">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route 
            path="/" 
            element={
              athleteId ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <LandingPage />
              )
            } 
          />
          <Route 
            path="/onboarding" 
            element={
              athleteId ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <OnboardingForm onAthleteCreated={handleAthleteCreated} />
              )
            } 
          />
          <Route 
            path="/login" 
            element={
              athleteId ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <Login onAthleteLogin={handleAthleteLogin} />
              )
            } 
          />
          <Route 
            path="/forgot-password" 
            element={
              athleteId ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <ForgotPassword />
              )
            } 
          />
          <Route 
            path="/reset-password" 
            element={
              athleteId ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <ResetPassword />
              )
            } 
          />
          <Route 
            path="/pricing" 
            element={<Pricing />} 
          />
          <Route 
            path="/dashboard" 
            element={
              athleteId ? (
                <Dashboard athleteId={athleteId} />
              ) : (
                <Navigate to="/" replace />
              )
            } 
          />
          <Route 
            path="/dashboard/:tab" 
            element={
              athleteId ? (
                <Dashboard athleteId={athleteId} />
              ) : (
                <Navigate to="/" replace />
              )
            } 
          />
          <Route 
            path="/auth/strava/callback" 
            element={<StravaCallback />} 
          />
          <Route 
            path="/auth/oura/callback" 
            element={<OuraCallback />} 
          />
          <Route 
            path="/auth/coros/callback" 
            element={<CorosCallback />} 
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
