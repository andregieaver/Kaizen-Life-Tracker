import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Calendar as CalendarIcon, Plus } from 'lucide-react';
import { Calendar, momentLocalizer, Views } from 'react-big-calendar';
import moment from 'moment';
import { logger } from '../utils/logger';
import 'react-big-calendar/lib/css/react-big-calendar.css';

import { getApiUrl } from '../utils/apiConfig';
const API = getApiUrl();

const localizer = momentLocalizer(moment);

const TrainingCalendar = ({ athleteId }) => {
  const { t } = useTranslation();
  const [trainingBlocks, setTrainingBlocks] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState(Views.WEEK);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (athleteId) {
      loadTrainingBlocks();
    }
  }, [athleteId]);

  const loadTrainingBlocks = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API}/training-calendar/${athleteId}`);
      setTrainingBlocks(response.data.blocks || []);
    } catch (error) {
      logger.error(null, 'Error loading training blocks:', error);
      setTrainingBlocks([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Convert training blocks to calendar events
  const calendarEvents = trainingBlocks.map(block => ({
    id: block.id,
    title: block.title,
    start: new Date(block.start_date + 'T00:00:00'),
    end: new Date(block.end_date + 'T23:59:59'),
    resource: block
  }));

  const EventComponent = ({ event }) => {
    const block = event.resource;
    const isTraining = block.block_type === 'training';
    
    return (
      <div className={`p-1 text-xs ${isTraining ? 'bg-blue-500' : 'bg-green-500'} text-white rounded`}>
        <div className="font-medium truncate">{block.title}</div>
        {block.distance && (
          <span>{block.distance}{block.unit_system === 'miles' ? 'mi' : 'km'}</span>
        )}
        {block.duration_minutes && (
          <span> • {block.duration_minutes}min</span>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-lg text-gray-600">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Enhanced Training Calendar
          </h1>
          <p className="text-gray-600 mt-1">
            Plan and track your workouts with detailed metrics
          </p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Add Workout
        </Button>
      </div>

      {/* Calendar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <CalendarIcon className="w-5 h-5 mr-2" />
              Training Calendar
            </div>
            <div className="flex gap-2">
              <Button
                variant={currentView === Views.WEEK ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCurrentView(Views.WEEK)}
              >
                Week
              </Button>
              <Button
                variant={currentView === Views.MONTH ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCurrentView(Views.MONTH)}
              >
                Month
              </Button>
            </div>
          </CardTitle>
          <CardDescription>
            Enhanced calendar with workout details and weekly summaries
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div style={{ height: '600px' }}>
            <Calendar
              localizer={localizer}
              events={calendarEvents}
              startAccessor="start"
              endAccessor="end"
              style={{ height: '100%' }}
              view={currentView}
              onView={setCurrentView}
              date={currentDate}
              onNavigate={setCurrentDate}
              components={{
                event: EventComponent
              }}
              eventPropGetter={(event) => ({
                style: {
                  backgroundColor: event.resource.block_type === 'training' ? '#3B82F6' : '#10B981',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'white'
                }
              })}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TrainingCalendar;