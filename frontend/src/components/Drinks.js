import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { GlassWater, Plus, X, Trash2, Calendar as CalendarIcon, Clock, Droplets } from 'lucide-react';

import { logger } from '../utils/logger';
import { getApiUrl, getApiBaseUrl } from '../utils/apiConfig';
const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Drinks = ({ athleteId }) => {
  const { t } = useTranslation();
  const [drinks, setDrinks] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState({ type: '', message: '' });

  // New drink form
  const [newDrink, setNewDrink] = useState({
    drink_type: 'water',
    amount_ml: 250,
    log_date: new Date().toISOString().split('T')[0],
    log_time: new Date().toTimeString().slice(0, 5),
    notes: ''
  });

  // Drink types with colors
  const drinkTypes = [
    { value: 'water', label: t('drinks.drinkTypes.water'), color: 'bg-blue-500', icon: '💧' },
    { value: 'coffee', label: t('drinks.drinkTypes.coffee'), color: 'bg-amber-700', icon: '☕' },
    { value: 'tea', label: t('drinks.drinkTypes.tea'), color: 'bg-green-600', icon: '🍵' },
    { value: 'juice', label: t('drinks.drinkTypes.juice'), color: 'bg-orange-500', icon: '🧃' },
    { value: 'sports_drink', label: t('drinks.drinkTypes.sports_drink'), color: 'bg-purple-500', icon: '⚡' },
    { value: 'milk', label: t('drinks.drinkTypes.milk'), color: 'bg-gray-100', icon: '🥛' },
    { value: 'smoothie', label: t('drinks.drinkTypes.smoothie'), color: 'bg-pink-500', icon: '🥤' },
    { value: 'other', label: t('drinks.drinkTypes.other'), color: 'bg-gray-500', icon: '🥤' }
  ];

  // Common amounts in ml
  const commonAmounts = [250, 330, 500, 750, 1000];

  useEffect(() => {
    loadDrinks();
  }, [selectedDate, athleteId]);

  const loadDrinks = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(`${API}/drinks/${athleteId}?date=${selectedDate}`);
      setDrinks(response.data.drinks || []);
    } catch (error) {
      logger.error(null, 'Error loading drinks:', error);
      setSaveStatus({ type: 'error', message: t('drinks.failedToLoad') });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddDrink = async () => {
    try {
      setSaveStatus({ type: '', message: '' });
      const response = await axios.post(`${API}/drinks/${athleteId}`, newDrink);
      
      if (response.data.success) {
        setSaveStatus({ type: 'success', message: t('drinks.drinkLoggedSuccess') });
        setShowAddModal(false);
        loadDrinks();
        
        // Reset form
        setNewDrink({
          drink_type: 'water',
          amount_ml: 250,
          log_date: new Date().toISOString().split('T')[0],
          log_time: new Date().toTimeString().slice(0, 5),
          notes: ''
        });
      }
    } catch (error) {
      logger.error(null, 'Error adding drink:', error);
      setSaveStatus({ type: 'error', message: t('drinks.failedToLog') });
    }
  };

  const handleDeleteDrink = async (drinkId) => {
    if (!window.confirm(t('drinks.confirmDelete'))) return;
    
    try {
      await axios.delete(`${API}/drinks/${athleteId}/${drinkId}`);
      setSaveStatus({ type: 'success', message: t('drinks.drinkDeletedSuccess') });
      loadDrinks();
    } catch (error) {
      logger.error(null, 'Error deleting drink:', error);
      setSaveStatus({ type: 'error', message: t('drinks.failedToDelete') });
    }
  };

  // Calculate total for the day
  const totalForDay = drinks.reduce((sum, drink) => sum + (drink.amount_ml || 0), 0);
  const totalByType = drinks.reduce((acc, drink) => {
    acc[drink.drink_type] = (acc[drink.drink_type] || 0) + drink.amount_ml;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-2">
              <GlassWater className="w-8 h-8 text-[#32D3FF]" />
              Hydration Tracker
            </h1>
            <p className="text-gray-400 mt-1">Track your daily fluid intake</p>
          </div>
          <Button
            onClick={() => setShowAddModal(true)}
            className="bg-gradient-to-r from-[#32D3FF] to-[#2ab8e6] hover:from-[#2ab8e6] hover:to-[#32D3FF] text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Log Drink
          </Button>
        </div>

        {/* Date Selector */}
        <div className="flex items-center gap-4">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-[#32D3FF] focus:border-transparent"
          />
        </div>

        {/* Status Message */}
        {saveStatus.message && (
          <div className={`mt-4 p-3 rounded-lg ${
            saveStatus.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
          }`}>
            {saveStatus.message}
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-blue-600 to-blue-800 border-0">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm">Total Today</p>
                <p className="text-3xl font-bold text-white">{totalForDay} ml</p>
                <p className="text-blue-200 text-xs mt-1">{(totalForDay / 1000).toFixed(1)} liters</p>
              </div>
              <Droplets className="w-12 h-12 text-blue-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#32D3FF] to-[#2ab8e6] border-0">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-teal-100 text-sm">Goal Progress</p>
                <p className="text-3xl font-bold text-white">{Math.round((totalForDay / 2000) * 100)}%</p>
                <p className="text-teal-200 text-xs mt-1">of 2000 ml goal</p>
              </div>
              <div className="relative w-12 h-12">
                <svg className="w-12 h-12 transform -rotate-90">
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    stroke="rgba(255,255,255,0.2)"
                    strokeWidth="4"
                    fill="none"
                  />
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    stroke="white"
                    strokeWidth="4"
                    fill="none"
                    strokeDasharray={`${(totalForDay / 2000) * 125.6} 125.6`}
                  />
                </svg>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-gray-700 to-gray-800 border-0">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-300 text-sm">Logs Today</p>
                <p className="text-3xl font-bold text-white">{drinks.length}</p>
                <p className="text-gray-400 text-xs mt-1">entries</p>
              </div>
              <GlassWater className="w-12 h-12 text-gray-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Drinks List */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Drink Log - {new Date(selectedDate).toLocaleDateString()}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-gray-400">Loading...</div>
          ) : drinks.length === 0 ? (
            <div className="text-center py-8">
              <GlassWater className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No drinks logged for this day</p>
              <Button
                onClick={() => setShowAddModal(true)}
                className="mt-4 bg-gradient-to-r from-[#32D3FF] to-[#2ab8e6] hover:from-[#2ab8e6] hover:to-[#32D3FF] text-white"
              >
                Log Your First Drink
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {drinks.map((drink) => {
                const drinkInfo = drinkTypes.find(t => t.value === drink.drink_type) || drinkTypes[drinkTypes.length - 1];
                return (
                  <div
                    key={drink.id}
                    className="flex items-center justify-between p-4 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 ${drinkInfo.color} rounded-full flex items-center justify-center text-2xl`}>
                        {drinkInfo.icon}
                      </div>
                      <div>
                        <p className="text-white font-semibold">{drinkInfo.label}</p>
                        <p className="text-[#32D3FF] text-sm font-medium">{drink.amount_ml} ml</p>
                        <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {drink.log_time}
                          </span>
                          {drink.notes && <span>• {drink.notes}</span>}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteDrink(drink.id)}
                      className="text-red-400 hover:text-red-300 transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Drink Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg max-w-md w-full p-6 shadow-2xl border border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                <GlassWater className="w-6 h-6 text-[#32D3FF]" />
                Log Drink
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Drink Type */}
              <div>
                <label className="block text-gray-300 mb-2 text-sm font-medium">Drink Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {drinkTypes.map((type) => (
                    <button
                      key={type.value}
                      onClick={() => setNewDrink({ ...newDrink, drink_type: type.value })}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        newDrink.drink_type === type.value
                          ? 'border-[#32D3FF] bg-[#32D3FF]/20'
                          : 'border-gray-600 bg-gray-700 hover:border-gray-500'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{type.icon}</span>
                        <span className="text-white text-sm">{type.label}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-gray-300 mb-2 text-sm font-medium">Amount (ml)</label>
                <div className="grid grid-cols-5 gap-2 mb-2">
                  {commonAmounts.map((amount) => (
                    <button
                      key={amount}
                      onClick={() => setNewDrink({ ...newDrink, amount_ml: amount })}
                      className={`py-2 px-3 rounded-lg border transition-all text-sm ${
                        newDrink.amount_ml === amount
                          ? 'border-[#32D3FF] bg-[#32D3FF]/20 text-white'
                          : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500'
                      }`}
                    >
                      {amount}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  value={newDrink.amount_ml}
                  onChange={(e) => setNewDrink({ ...newDrink, amount_ml: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-[#32D3FF] focus:border-transparent"
                  placeholder="Custom amount"
                />
              </div>

              {/* Date and Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-300 mb-2 text-sm font-medium">Date</label>
                  <input
                    type="date"
                    value={newDrink.log_date}
                    onChange={(e) => setNewDrink({ ...newDrink, log_date: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-[#32D3FF] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 mb-2 text-sm font-medium">Time</label>
                  <input
                    type="time"
                    value={newDrink.log_time}
                    onChange={(e) => setNewDrink({ ...newDrink, log_time: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-[#32D3FF] focus:border-transparent"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-gray-300 mb-2 text-sm font-medium">Notes (optional)</label>
                <input
                  type="text"
                  value={newDrink.notes}
                  onChange={(e) => setNewDrink({ ...newDrink, notes: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-[#32D3FF] focus:border-transparent"
                  placeholder="e.g., Pre-workout, With meal"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 mt-6">
                <Button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddDrink}
                  className="flex-1 bg-gradient-to-r from-[#32D3FF] to-[#2ab8e6] hover:from-[#2ab8e6] hover:to-[#32D3FF] text-white"
                >
                  Log Drink
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Drinks;
