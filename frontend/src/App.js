import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import Dashboard from './components/Dashboard';
import OnboardingForm from './components/OnboardingForm';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading...</div>
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
                <OnboardingForm onAthleteCreated={handleAthleteCreated} />
              )
            } 
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
