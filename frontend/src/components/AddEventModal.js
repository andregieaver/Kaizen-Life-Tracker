import React, { useState } from 'react';
import { X, Calendar, Clock, Target, MapPin, Trophy } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

const AddEventModal = ({ isOpen, onClose, onSubmit, initialDate, editingEvent = null }) => {
  const [formData, setFormData] = useState({
    title: editingEvent?.title || '',
    description: editingEvent?.description || '',
    event_type: editingEvent?.event_type || 'race',
    event_date: editingEvent?.event_date || initialDate || new Date().toISOString().split('T')[0],
    start_time: editingEvent?.start_time || '',
    target_distance: editingEvent?.target_distance || '',
    target_time: editingEvent?.target_time || '',
    target_amount: editingEvent?.target_amount || '',
    location: editingEvent?.location || '',
    category: editingEvent?.category || '',
    notes: editingEvent?.notes || '',
    // Results (for completed events)
    actual_time: editingEvent?.actual_time || '',
    actual_distance: editingEvent?.actual_distance || '',
    actual_amount: editingEvent?.actual_amount || '',
    result_notes: editingEvent?.result_notes || '',
    completed: editingEvent?.completed || false,
  });

  const [activeMetricTab, setActiveMetricTab] = useState('distance'); // 'distance', 'time', 'amount'

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Clean up the data - only send the active metric
    const cleanedData = {
      ...formData,
      target_distance: activeMetricTab === 'distance' ? formData.target_distance : null,
      target_time: activeMetricTab === 'time' ? formData.target_time : null,
      target_amount: activeMetricTab === 'amount' ? formData.target_amount : null,
    };
    
    onSubmit(cleanedData);
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const eventTypes = [
    { value: 'race', label: 'Race' },
    { value: 'test', label: 'Fitness Test' },
    { value: 'competition', label: 'Competition' },
    { value: 'goal', label: 'Goal Event' },
  ];

  const categories = [
    '5K', '10K', 'Half Marathon', 'Marathon', 'Ultra',
    'Triathlon', 'Sprint Triathlon', 'Olympic Triathlon', 'Ironman',
    'Time Trial', 'Track Meet', 'Cross Country', 'Other'
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            {editingEvent ? 'Edit Event' : 'Add Event'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Basic Information */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Event Name *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
                placeholder="e.g., Boston Marathon, 5K Time Trial"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="event_type">Event Type *</Label>
                <Select value={formData.event_type} onValueChange={(value) => handleChange('event_type', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {eventTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="category">Category</Label>
                <Select value={formData.category} onValueChange={(value) => handleChange('category', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="event_date" className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  Event Date *
                </Label>
                <Input
                  id="event_date"
                  type="date"
                  value={formData.event_date}
                  onChange={(e) => handleChange('event_date', e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="start_time" className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  Start Time
                </Label>
                <Input
                  id="start_time"
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => handleChange('start_time', e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="location" className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                Location
              </Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => handleChange('location', e.target.value)}
                placeholder="e.g., Central Park, New York"
              />
            </div>
          </div>

          {/* Target Metrics */}
          <div className="space-y-3 pt-4 border-t">
            <Label className="flex items-center gap-1">
              <Target className="w-4 h-4" />
              Target Goal (choose one)
            </Label>
            
            <div className="flex gap-2 mb-3">
              <Button
                type="button"
                variant={activeMetricTab === 'distance' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveMetricTab('distance')}
              >
                Distance
              </Button>
              <Button
                type="button"
                variant={activeMetricTab === 'time' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveMetricTab('time')}
              >
                Time
              </Button>
              <Button
                type="button"
                variant={activeMetricTab === 'amount' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveMetricTab('amount')}
              >
                Amount
              </Button>
            </div>

            {activeMetricTab === 'distance' && (
              <div>
                <Label htmlFor="target_distance">Target Distance</Label>
                <div className="flex gap-2">
                  <Input
                    id="target_distance"
                    type="number"
                    step="0.01"
                    value={formData.target_distance}
                    onChange={(e) => handleChange('target_distance', e.target.value)}
                    placeholder="e.g., 26.2"
                  />
                  <span className="flex items-center px-3 bg-gray-100 dark:bg-gray-800 rounded text-sm">
                    miles
                  </span>
                </div>
              </div>
            )}

            {activeMetricTab === 'time' && (
              <div>
                <Label htmlFor="target_time">Target Time (HH:MM:SS)</Label>
                <Input
                  id="target_time"
                  type="text"
                  value={formData.target_time}
                  onChange={(e) => handleChange('target_time', e.target.value)}
                  placeholder="e.g., 01:30:00"
                  pattern="[0-9]{1,2}:[0-9]{2}:[0-9]{2}"
                />
                <p className="text-xs text-gray-500 mt-1">Format: hours:minutes:seconds</p>
              </div>
            )}

            {activeMetricTab === 'amount' && (
              <div>
                <Label htmlFor="target_amount">Target Amount (reps/count)</Label>
                <Input
                  id="target_amount"
                  type="number"
                  value={formData.target_amount}
                  onChange={(e) => handleChange('target_amount', e.target.value)}
                  placeholder="e.g., 100"
                />
                <p className="text-xs text-gray-500 mt-1">For counted activities (push-ups, reps, etc.)</p>
              </div>
            )}
          </div>

          {/* Description & Notes */}
          <div className="space-y-4 pt-4 border-t">
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Brief description of the event..."
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                placeholder="Training plan, goals, reminders..."
                rows={2}
              />
            </div>
          </div>

          {/* Results Section (for completed events) */}
          {editingEvent && (
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="completed"
                  checked={formData.completed}
                  onChange={(e) => handleChange('completed', e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="completed" className="cursor-pointer">
                  Mark as Completed
                </Label>
              </div>

              {formData.completed && (
                <>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="actual_time">Actual Time</Label>
                      <Input
                        id="actual_time"
                        type="text"
                        value={formData.actual_time}
                        onChange={(e) => handleChange('actual_time', e.target.value)}
                        placeholder="HH:MM:SS"
                      />
                    </div>
                    <div>
                      <Label htmlFor="actual_distance">Actual Distance</Label>
                      <Input
                        id="actual_distance"
                        type="number"
                        step="0.01"
                        value={formData.actual_distance}
                        onChange={(e) => handleChange('actual_distance', e.target.value)}
                        placeholder="miles"
                      />
                    </div>
                    <div>
                      <Label htmlFor="actual_amount">Actual Amount</Label>
                      <Input
                        id="actual_amount"
                        type="number"
                        value={formData.actual_amount}
                        onChange={(e) => handleChange('actual_amount', e.target.value)}
                        placeholder="count"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="result_notes">Result Notes</Label>
                    <Textarea
                      id="result_notes"
                      value={formData.result_notes}
                      onChange={(e) => handleChange('result_notes', e.target.value)}
                      placeholder="How did it go? Any notes about the performance..."
                      rows={3}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              {editingEvent ? 'Update Event' : 'Create Event'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddEventModal;
