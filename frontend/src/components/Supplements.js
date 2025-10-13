import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Plus, Edit3, Trash2, X, Pill } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
const API = `${BACKEND_URL}/api`;

const Supplements = ({ athleteId }) => {
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

  const loadAthleteData = async () => {
    try {
      const response = await axios.get(`${API}/athlete/${athleteId}`);
      setAthlete(response.data);
    } catch (error) {
      console.error('Error loading athlete data:', error);
    }
  };

  const loadSupplements = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(`${API}/supplements/${athleteId}`);
      setSupplements(response.data.supplements || []);
    } catch (error) {
      console.error('Error loading supplements:', error);
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
      console.error('Error saving supplement:', error);
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
      console.error('Error deleting supplement:', error);
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Supplements</h1>
          <p className="text-gray-600 mt-1">Track your daily supplements and vitamins</p>
        </div>
        <Button onClick={openNewSupplementModal}>
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
          <p className="text-gray-500">Loading supplements...</p>
        </div>
      ) : supplements.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Pill className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No supplements yet</h3>
            <p className="text-gray-600 mb-4">Start tracking your supplements and vitamins</p>
            <Button onClick={openNewSupplementModal}>
              <Plus className="w-4 h-4 mr-2" />
              Add First Supplement
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {supplements.map((supplement) => (
            <Card key={supplement.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{supplement.name}</CardTitle>
                    <CardDescription className="mt-1">
                      {supplement.dosage} {supplement.unit}
                    </CardDescription>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleEditSupplement(supplement)}
                      className="p-2 hover:bg-blue-50 rounded-lg transition-colors text-blue-600"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteSupplement(supplement.id)}
                      className="p-2 hover:bg-red-50 rounded-lg transition-colors text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                      {getFrequencyLabel(supplement.frequency)}
                    </Badge>
                    {supplement.time_of_day && (
                      <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                        {getTimeOfDayLabel(supplement.time_of_day)}
                      </Badge>
                    )}
                  </div>
                  {supplement.notes && (
                    <p className="text-sm text-gray-600 mt-2">{supplement.notes}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  {editingSupplement ? 'Edit Supplement' : 'Add Supplement'}
                </CardTitle>
                <button
                  onClick={() => {
                    setShowModal(false);
                    setEditingSupplement(null);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <CardDescription>
                {editingSupplementstate ? 'Update supplement details' : 'Add a new supplement to your routine'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Supplement Name */}
              <div className="space-y-2">
                <Label>Supplement Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Vitamin D3, Omega-3, Magnesium"
                />
              </div>

              {/* Dosage and Unit */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Dosage *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.dosage}
                    onChange={(e) => setFormData(prev => ({ ...prev, dosage: e.target.value }))}
                    placeholder="100"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unit</Label>
                  <Select
                    value={formData.unit}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, unit: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mg">mg (milligrams)</SelectItem>
                      <SelectItem value="g">g (grams)</SelectItem>
                      <SelectItem value="mcg">mcg (micrograms)</SelectItem>
                      <SelectItem value="IU">IU (International Units)</SelectItem>
                      {athlete?.fluid_unit === 'ml' ? (
                        <>
                          <SelectItem value="ml">ml (milliliters)</SelectItem>
                          <SelectItem value="L">L (liters)</SelectItem>
                        </>
                      ) : (
                        <>
                          <SelectItem value="fl oz">fl oz (fluid ounces)</SelectItem>
                          <SelectItem value="tsp">tsp (teaspoons)</SelectItem>
                          <SelectItem value="tbsp">tbsp (tablespoons)</SelectItem>
                        </>
                      )}
                      <SelectItem value="capsules">capsules</SelectItem>
                      <SelectItem value="tablets">tablets</SelectItem>
                      <SelectItem value="drops">drops</SelectItem>
                      <SelectItem value="other">other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Frequency */}
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select
                  value={formData.frequency}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, frequency: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="twice_daily">Twice Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="as_needed">As Needed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Time of Day */}
              <div className="space-y-2">
                <Label>Time of Day</Label>
                <Select
                  value={formData.time_of_day}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, time_of_day: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="morning">Morning</SelectItem>
                    <SelectItem value="afternoon">Afternoon</SelectItem>
                    <SelectItem value="evening">Evening</SelectItem>
                    <SelectItem value="night">Night</SelectItem>
                    <SelectItem value="with_meals">With Meals</SelectItem>
                    <SelectItem value="any">Any Time</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label>Notes (Optional)</Label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Additional notes about this supplement..."
                  className="w-full h-20 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowModal(false);
                    setEditingSupplementstate(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleSaveSupplement}
                  disabled={!formData.name.trim() || !formData.dosage}
                >
                  {editingSupplementstate ? 'Update' : 'Save'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Supplements;
