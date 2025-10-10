import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Calendar } from './ui/calendar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Calendar as CalendarIcon, Plus, Edit, Trash2, Dumbbell, Heart } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const TrainingCalendar = ({ athleteId }) => {
  const { t } = useTranslation();
  const [trainingBlocks, setTrainingBlocks] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    block_type: 'training',
    start_date: '',
    end_date: ''
  });

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
      console.error('Error loading training blocks:', error);
      setTrainingBlocks([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateBlock = () => {
    setEditingBlock(null);
    setFormData({
      title: '',
      description: '',
      block_type: 'training',
      start_date: format(selectedDate, 'yyyy-MM-dd'),
      end_date: format(selectedDate, 'yyyy-MM-dd')
    });
    setIsDialogOpen(true);
  };

  const handleEditBlock = (block) => {
    setEditingBlock(block);
    setFormData({
      title: block.title,
      description: block.description || '',
      block_type: block.block_type,
      start_date: block.start_date,
      end_date: block.end_date
    });
    setIsDialogOpen(true);
  };

  const handleDeleteBlock = async (blockId) => {
    if (window.confirm(t('trainingCalendar.confirmDelete'))) {
      try {
        await axios.delete(`${API}/training-calendar/${blockId}`);
        await loadTrainingBlocks();
      } catch (error) {
        console.error('Error deleting training block:', error);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const data = {
        ...formData,
        athlete_id: athleteId
      };

      if (editingBlock) {
        await axios.put(`${API}/training-calendar/${editingBlock.id}`, data);
      } else {
        await axios.post(`${API}/training-calendar`, data);
      }

      setIsDialogOpen(false);
      await loadTrainingBlocks();
      
      // Reset form
      setFormData({
        title: '',
        description: '',
        block_type: 'training',
        start_date: '',
        end_date: ''
      });
    } catch (error) {
      console.error('Error saving training block:', error);
    }
  };

  const getBlocksForDate = (date) => {
    return trainingBlocks.filter(block => {
      const startDate = parseISO(block.start_date);
      const endDate = parseISO(block.end_date);
      return date >= startDate && date <= endDate;
    });
  };

  const getBlocksForDateRange = (start, end) => {
    return trainingBlocks.filter(block => {
      const blockStart = parseISO(block.start_date);
      const blockEnd = parseISO(block.end_date);
      return (blockStart <= end && blockEnd >= start);
    });
  };

  const renderCalendarDay = (date) => {
    const blocks = getBlocksForDate(date);
    const isSelected = isSameDay(date, selectedDate);
    
    return (
      <div 
        className={`relative w-full h-full min-h-[40px] p-1 cursor-pointer rounded-lg transition-colors ${
          isSelected 
            ? 'bg-blue-100 text-blue-900' 
            : 'hover:bg-gray-50'
        }`}
        onClick={() => setSelectedDate(date)}
      >
        <div className="text-sm font-medium">{format(date, 'd')}</div>
        {blocks.length > 0 && (
          <div className="absolute bottom-1 left-1 right-1">
            <div className="flex gap-1 flex-wrap">
              {blocks.slice(0, 2).map((block) => (
                <div
                  key={block.id}
                  className={`w-2 h-2 rounded-full ${
                    block.block_type === 'training' 
                      ? 'bg-blue-500' 
                      : 'bg-green-500'
                  }`}
                />
              ))}
              {blocks.length > 2 && (
                <div className="text-xs text-gray-500">+{blocks.length - 2}</div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const monthBlocks = getBlocksForDateRange(
    startOfMonth(selectedMonth),
    endOfMonth(selectedMonth)
  );

  const selectedDateBlocks = getBlocksForDate(selectedDate);

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
            {t('trainingCalendar.title')}
          </h1>
          <p className="text-gray-600 mt-1">
            {t('trainingCalendar.description')}
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              onClick={handleCreateBlock}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              {t('trainingCalendar.addBlock')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingBlock 
                  ? t('trainingCalendar.editBlock') 
                  : t('trainingCalendar.createBlock')
                }
              </DialogTitle>
              <DialogDescription>
                {editingBlock 
                  ? t('trainingCalendar.editBlockDescription')
                  : t('trainingCalendar.createBlockDescription')
                }
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">{t('trainingCalendar.blockTitle')}</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({...prev, title: e.target.value}))}
                  placeholder={t('trainingCalendar.titlePlaceholder')}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="block_type">{t('trainingCalendar.blockType')}</Label>
                <Select 
                  value={formData.block_type} 
                  onValueChange={(value) => setFormData(prev => ({...prev, block_type: value}))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('trainingCalendar.selectType')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="training">
                      <div className="flex items-center">
                        <Dumbbell className="w-4 h-4 mr-2" />
                        {t('trainingCalendar.training')}
                      </div>
                    </SelectItem>
                    <SelectItem value="recovery">
                      <div className="flex items-center">
                        <Heart className="w-4 h-4 mr-2" />
                        {t('trainingCalendar.recovery')}
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">{t('trainingCalendar.startDate')}</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData(prev => ({...prev, start_date: e.target.value}))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end_date">{t('trainingCalendar.endDate')}</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData(prev => ({...prev, end_date: e.target.value}))}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">{t('trainingCalendar.description')}</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({...prev, description: e.target.value}))}
                  placeholder={t('trainingCalendar.descriptionPlaceholder')}
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsDialogOpen(false)}
                >
                  {t('common.cancel')}
                </Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                  {editingBlock ? t('common.update') : t('common.create')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center">
              <CalendarIcon className="w-5 h-5 mr-2" />
              {format(selectedMonth, 'MMMM yyyy')}
            </CardTitle>
            <CardDescription>
              {t('trainingCalendar.calendarDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              month={selectedMonth}
              onMonthChange={setSelectedMonth}
              components={{
                Day: ({ date }) => renderCalendarDay(date)
              }}
              className="w-full"
            />
          </CardContent>
        </Card>

        {/* Selected Date Details */}
        <Card>
          <CardHeader>
            <CardTitle>
              {format(selectedDate, 'MMM d, yyyy')}
            </CardTitle>
            <CardDescription>
              {selectedDateBlocks.length > 0 
                ? t('trainingCalendar.blocksForDate', { count: selectedDateBlocks.length })
                : t('trainingCalendar.noBlocksForDate')
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedDateBlocks.length > 0 ? (
              <div className="space-y-3">
                {selectedDateBlocks.map((block) => (
                  <div 
                    key={block.id} 
                    className="p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge 
                            variant={block.block_type === 'training' ? 'default' : 'secondary'}
                            className={`${
                              block.block_type === 'training' 
                                ? 'bg-blue-100 text-blue-800' 
                                : 'bg-green-100 text-green-800'
                            }`}
                          >
                            {block.block_type === 'training' ? (
                              <Dumbbell className="w-3 h-3 mr-1" />
                            ) : (
                              <Heart className="w-3 h-3 mr-1" />
                            )}
                            {t(`trainingCalendar.${block.block_type}`)}
                          </Badge>
                        </div>
                        <h4 className="font-medium text-gray-900 mb-1">
                          {block.title}
                        </h4>
                        {block.description && (
                          <p className="text-sm text-gray-600 mb-2">
                            {block.description}
                          </p>
                        )}
                        <p className="text-xs text-gray-500">
                          {format(parseISO(block.start_date), 'MMM d')} - {format(parseISO(block.end_date), 'MMM d')}
                        </p>
                      </div>
                      <div className="flex gap-1 ml-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEditBlock(block)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteBlock(block.id)}
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <CalendarIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 mb-4">
                  {t('trainingCalendar.noBlocksSelected')}
                </p>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleCreateBlock}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {t('trainingCalendar.addBlockForDate')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Monthly Overview */}
      {monthBlocks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              {t('trainingCalendar.monthlyOverview', { month: format(selectedMonth, 'MMMM yyyy') })}
            </CardTitle>
            <CardDescription>
              {t('trainingCalendar.monthlyDescription', { count: monthBlocks.length })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {monthBlocks.map((block) => (
                <div 
                  key={block.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => handleEditBlock(block)}
                >
                  <div className="flex items-center gap-3">
                    <Badge 
                      variant={block.block_type === 'training' ? 'default' : 'secondary'}
                      className={`${
                        block.block_type === 'training' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {block.block_type === 'training' ? (
                        <Dumbbell className="w-3 h-3 mr-1" />
                      ) : (
                        <Heart className="w-3 h-3 mr-1" />
                      )}
                      {t(`trainingCalendar.${block.block_type}`)}
                    </Badge>
                    <div>
                      <h4 className="font-medium text-gray-900">{block.title}</h4>
                      <p className="text-sm text-gray-500">
                        {format(parseISO(block.start_date), 'MMM d')} - {format(parseISO(block.end_date), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditBlock(block);
                      }}
                      className="h-8 w-8 p-0"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteBlock(block.id);
                      }}
                      className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TrainingCalendar;