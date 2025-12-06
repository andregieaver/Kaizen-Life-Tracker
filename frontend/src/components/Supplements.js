import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Plus, Edit3, Trash2, X, Pill } from 'lucide-react';

import { logger } from '../utils/logger';
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Supplements = ({ athleteId }) => {
  const location = useLocation();
  const [supplements, setSupplements] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSupplement, setEditingSupplement] = useState(null);
  const [saveStatus, setSaveStatus] = useState({ type: '', message: '' });
  const [athlete, setAthlete] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    dosage: '',
    unit: 'mg',
    frequency: 'daily',
    time_of_day: 'morning',
    notes: ''
  });

  useEffect(() => {
    loadSupplements();
    loadAthleteData();
  }, [athleteId]);

  // Check for openAddModal in location state
  useEffect(() => {
    if (location.state?.openAddModal) {
      openNewSupplementModal();
      // Clear the state so it doesn't reopen on subsequent renders
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const loadAthleteData = async () => {
    try {
      const response = await axios.get(`${API}/athlete/${athleteId}`);
      setAthlete(response.data);
    } catch (error) {
      logger.error(null, 'Error loading athlete data:', error);
    }
  };

  const loadSupplements = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(`${API}/supplements/${athleteId}`);
      setSupplements(response.data.supplements || []);
    } catch (error) {
      logger.error(null, 'Error loading supplements:', error);
      setSaveStatus({ type: 'error', message: 'Failed to load supplements' });
    } finally {
      setIsLoading(false);
    }
  };

  const openNewSupplementModal = () => {
    setEditingSupplement(null);
    setFormData({
      name: '',
      dosage: '',
      unit: athlete?.weight_unit === 'kg' ? 'mg' : 'mg', // Default to mg regardless
      frequency: 'daily',
      time_of_day: 'morning',
      notes: ''
    });
    setShowModal(true);
  };

  const handleEditSupplement = (supplement) => {
    setEditingSupplement(supplement);
    setFormData({
      name: supplement.name,
      dosage: supplement.dosage.toString(),
      unit: supplement.unit,
      frequency: supplement.frequency,
      time_of_day: supplement.time_of_day || 'morning',
      notes: supplement.notes || ''
    });
    setShowModal(true);
  };

  const handleSaveSupplement = async () => {
    if (!formData.name.trim() || !formData.dosage) {
      setSaveStatus({ type: 'error', message: 'Please fill in supplement name and dosage' });
      return;
    }

    try {
      const supplementData = {
        athlete_id: athleteId,
        name: formData.name,
        dosage: parseFloat(formData.dosage),
        unit: formData.unit,
        frequency: formData.frequency,
        time_of_day: formData.time_of_day,
        notes: formData.notes
      };

      if (editingSupplement) {
        await axios.put(`${API}/supplements/${editingSupplement.id}`, supplementData);
        setSaveStatus({ type: 'success', message: 'Supplement updated!' });
      } else {
        await axios.post(`${API}/supplements`, supplementData);
        setSaveStatus({ type: 'success', message: 'Supplement added!' });
      }

      setShowModal(false);
      setEditingSupplement(null);
      setFormData({
        name: '',
        dosage: '',
        unit: 'mg',
        frequency: 'daily',
        time_of_day: 'morning',
        notes: ''
      });
      await loadSupplements();
    } catch (error) {
      logger.error(null, 'Error saving supplement:', error);
      setSaveStatus({ type: 'error', message: 'Failed to save supplement' });
    }
  };

  const handleDeleteSupplement = async (supplementId) => {
    if (!window.confirm('Are you sure you want to delete this supplement?')) {
      return;
    }

    try {
      await axios.delete(`${API}/supplements/${supplementId}`);
      setSaveStatus({ type: 'success', message: 'Supplement deleted' });
      await loadSupplements();
    } catch (error) {
      logger.error(null, 'Error deleting supplement:', error);
      setSaveStatus({ type: 'error', message: 'Failed to delete supplement' });
    }
  };

  const getFrequencyLabel = (frequency) => {
    const labels = {
      daily: 'Daily',
      twice_daily: 'Twice Daily',
      weekly: 'Weekly',
      as_needed: 'As Needed'
    };
    return labels[frequency] || frequency;
  };

  const getTimeOfDayLabel = (time) => {
    const labels = {
      morning: 'Morning',
      afternoon: 'Afternoon',
      evening: 'Evening',
      night: 'Night',
      with_meals: 'With Meals',
      any: 'Any Time'
    };
    return labels[time] || time;
  };

  const getUnitOptions = () => {
    const weightUnits = ['mg', 'g', 'mcg', 'IU'];
    const fluidUnits = athlete?.fluid_unit === 'ml' ? ['ml', 'L'] : ['fl oz', 'tsp', 'tbsp'];
    const otherUnits = ['capsules', 'tablets', 'drops', 'other'];
    
    return [...weightUnits, ...fluidUnits, ...otherUnits];
  };

  return (
    <div className="min-h-screen p-2 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Supplements</h1>
          <p className="text-gray-300 mt-1">Track your daily supplements and vitamins</p>
        </div>
        <Button 
          onClick={openNewSupplementModal}
          className="text-white border-0"
          style={{ backgroundColor: '#32D3FF' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#009688'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#32D3FF'}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Supplement
        </Button>
      </div>

      {/* Status Messages */}
      {saveStatus.message && (
        <div className={`p-4 rounded-lg ${
          saveStatus.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          {saveStatus.message}
        </div>
      )}

      {/* Supplements List */}
      {isLoading ? (
        <div className="text-center py-8">
          <p className="text-gray-300">Loading supplements...</p>
        </div>
      ) : supplements.length === 0 ? (
        <div className="border-0 shadow-lg overflow-hidden rounded-none md:rounded-3xl" style={{ background: 'var(--grad-surface)' }}>
          <div className="text-center py-12 p-4">
            <Pill className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
            <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-hi)' }}>No supplements yet</h3>
            <p className="mb-4" style={{ color: 'var(--text-med)' }}>Start tracking your supplements and vitamins</p>
            <Button 
              onClick={openNewSupplementModal}
              className="text-white border-0"
              style={{ backgroundColor: '#32D3FF' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#009688'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#32D3FF'}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add First Supplement
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {supplements.map((supplement) => (
            <div key={supplement.id} className="hover:shadow-lg transition-shadow border-0 shadow-lg overflow-hidden rounded-none md:rounded-3xl" style={{ background: 'var(--grad-surface)' }}>
              <div className="p-4 pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-hi)' }}>{supplement.name}</h3>
                    <p className="mt-1" style={{ color: 'var(--text-med)' }}>
                      {supplement.dosage} {supplement.unit}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleEditSupplement(supplement)}
                      className="p-2 hover:bg-blue-900/30 rounded-lg transition-colors text-blue-400"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteSupplement(supplement.id)}
                      className="p-2 hover:bg-red-900/30 rounded-lg transition-colors text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="pt-0 pb-4 px-4">
                {supplement.notes && (
                  <p className="text-sm" style={{ color: 'var(--text-med)' }}>{supplement.notes}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto relative z-50 border-0 shadow-lg overflow-hidden rounded-none md:rounded-3xl border border-gray-700" style={{ background: 'var(--grad-surface)' }}>
            <div className="p-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-hi)' }}>
                  {editingSupplement ? 'Edit Supplement' : 'Add Supplement'}
                </h3>
                <button
                  onClick={() => {
                    setShowModal(false);
                    setEditingSupplement(null);
                  }}
                  className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm mt-1" style={{ color: 'var(--text-med)' }}>
                {editingSupplement ? 'Update supplement details' : 'Add a new supplement to your routine'}
              </p>
            </div>
            <div className="p-4 space-y-4">
              {/* Supplement Name */}
              <div className="space-y-2">
                <Label className="text-white">Supplement Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Vitamin D3, Omega-3, Magnesium"
                  className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-400"
                />
              </div>

              {/* Dosage and Unit */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-white">Dosage *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.dosage}
                    onChange={(e) => setFormData(prev => ({ ...prev, dosage: e.target.value }))}
                    placeholder="100"
                    className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-400"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white">Unit</Label>
                  <Select
                    value={formData.unit}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, unit: value }))}
                  >
                    <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[100] bg-gray-800 border-gray-700">
                      <SelectItem value="mg" className="text-white">mg (milligrams)</SelectItem>
                      <SelectItem value="g" className="text-white">g (grams)</SelectItem>
                      <SelectItem value="mcg" className="text-white">mcg (micrograms)</SelectItem>
                      <SelectItem value="IU" className="text-white">IU (International Units)</SelectItem>
                      {athlete?.fluid_unit === 'ml' ? (
                        <>
                          <SelectItem value="ml" className="text-white">ml (milliliters)</SelectItem>
                          <SelectItem value="L" className="text-white">L (liters)</SelectItem>
                        </>
                      ) : (
                        <>
                          <SelectItem value="fl oz" className="text-white">fl oz (fluid ounces)</SelectItem>
                          <SelectItem value="tsp" className="text-white">tsp (teaspoons)</SelectItem>
                          <SelectItem value="tbsp" className="text-white">tbsp (tablespoons)</SelectItem>
                        </>
                      )}
                      <SelectItem value="capsules" className="text-white">capsules</SelectItem>
                      <SelectItem value="tablets" className="text-white">tablets</SelectItem>
                      <SelectItem value="drops" className="text-white">drops</SelectItem>
                      <SelectItem value="other" className="text-white">other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Frequency */}
              <div className="space-y-2">
                <Label className="text-white">Frequency</Label>
                <Select
                  value={formData.frequency}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, frequency: value }))}
                >
                  <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[100] bg-gray-800 border-gray-700">
                    <SelectItem value="daily" className="text-white">Daily</SelectItem>
                    <SelectItem value="twice_daily" className="text-white">Twice Daily</SelectItem>
                    <SelectItem value="weekly" className="text-white">Weekly</SelectItem>
                    <SelectItem value="as_needed" className="text-white">As Needed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Time of Day */}
              <div className="space-y-2">
                <Label className="text-white">Time of Day</Label>
                <Select
                  value={formData.time_of_day}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, time_of_day: value }))}
                >
                  <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[100] bg-gray-800 border-gray-700">
                    <SelectItem value="morning" className="text-white">Morning</SelectItem>
                    <SelectItem value="afternoon" className="text-white">Afternoon</SelectItem>
                    <SelectItem value="evening" className="text-white">Evening</SelectItem>
                    <SelectItem value="night" className="text-white">Night</SelectItem>
                    <SelectItem value="with_meals" className="text-white">With Meals</SelectItem>
                    <SelectItem value="any" className="text-white">Any Time</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label className="text-white">Notes (Optional)</Label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Additional notes about this supplement..."
                  className="w-full h-20 p-3 bg-gray-700 border border-gray-600 text-white placeholder:text-gray-400 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  className="flex-1 bg-gray-700 text-white border-gray-600 hover:bg-gray-600"
                  onClick={() => {
                    setShowModal(false);
                    setEditingSupplement(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-teal-600 hover:bg-teal-700 text-white"
                  onClick={handleSaveSupplement}
                  disabled={!formData.name.trim() || !formData.dosage}
                >
                  {editingSupplement ? 'Update' : 'Save'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Supplements;
