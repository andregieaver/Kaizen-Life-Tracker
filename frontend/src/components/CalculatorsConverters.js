import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Calculator, Activity, Target, Ruler, X } from 'lucide-react';

const CalculatorsConverters = ({ athleteId }) => {
  const { t } = useTranslation();
  const [selectedCalculator, setSelectedCalculator] = useState(null);
  const [athletePreferences, setAthletePreferences] = useState(null);

  useEffect(() => {
    loadAthletePreferences();
  }, [athleteId]);

  const loadAthletePreferences = async () => {
    try {
      const API_URL = process.env.REACT_APP_BACKEND_URL;
      const response = await axios.get(`${API_URL}/api/athlete/${athleteId}`);
      setAthletePreferences(response.data);
    } catch (error) {
      console.error('Error loading athlete preferences:', error);
    }
  };

  const calculators = [
    {
      id: 'running-pace',
      title: t('calculators.runningPaceTitle'),
      description: t('calculators.runningPaceDesc'),
      icon: Activity,
      color: 'from-[#62D2C4] to-[#4fc4b5]',
    },
    {
      id: 'race-predictor',
      title: t('calculators.racePredictorTitle'),
      description: t('calculators.racePredictorDesc'),
      icon: Target,
      color: 'from-orange-400 to-orange-600',
    },
    {
      id: 'finishing-percentage',
      title: t('calculators.finishingPercentageTitle'),
      description: t('calculators.finishingPercentageDesc'),
      icon: Target,
      color: 'from-blue-400 to-blue-600',
    },
    {
      id: 'body-fat',
      title: t('calculators.bodyFatTitle'),
      description: t('calculators.bodyFatDesc'),
      icon: Ruler,
      color: 'from-purple-400 to-purple-600',
    },
  ];

  const openCalculator = (calculatorId) => {
    setSelectedCalculator(calculatorId);
  };

  const closeCalculator = () => {
    setSelectedCalculator(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display font-bold text-white mb-2">
          {t('calculators.title')}
        </h1>
        <p className="text-gray-300">
          {t('calculators.subtitle')}
        </p>
      </div>

      {/* Calculators Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {calculators.map((calc) => {
          const IconComponent = calc.icon;
          return (
            <Card
              key={calc.id}
              className="border-0 shadow-md hover:shadow-lg transition-all cursor-pointer group bg-gradient-to-br from-gray-600 to-gray-800"
              onClick={() => openCalculator(calc.id)}
            >
              <CardHeader>
                <div className={`w-16 h-16 bg-gradient-to-br ${calc.color} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-md`}>
                  <IconComponent className="w-8 h-8 text-white" />
                </div>
                <CardTitle className="text-xl font-display text-white">{calc.title}</CardTitle>
                <CardDescription className="text-gray-300 mt-2">
                  {calc.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  className="w-full text-white border-0"
                  style={{ backgroundColor: '#00C2A8' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#009688'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#00C2A8'}
                >
                  <Calculator className="w-4 h-4 mr-2" />
                  Open Calculator
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Full-Page Calculator Modal */}
      {selectedCalculator && (
        <CalculatorModal
          calculatorId={selectedCalculator}
          calculators={calculators}
          athletePreferences={athletePreferences}
          onClose={closeCalculator}
        />
      )}
    </div>
  );
};

// Full-Page Calculator Modal Component
const CalculatorModal = ({ calculatorId, calculators, athletePreferences, onClose }) => {
  const calculator = calculators.find(c => c.id === calculatorId);
  const IconComponent = calculator.icon;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-gradient-to-r from-gray-900 to-gray-800 border-gray-700">
        <CardHeader className="sticky top-0 bg-gradient-to-r from-gray-900 to-gray-800 border-b border-gray-700 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                <IconComponent className="w-6 h-6 text-teal-400" />
              </div>
              <div>
                <CardTitle className="text-white text-xl">{calculator.title}</CardTitle>
                <CardDescription className="text-gray-300">
                  {calculator.description}
                </CardDescription>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </CardHeader>
        
        <CardContent className="p-6">
          {calculatorId === 'running-pace' && (
            <PaceCalculator athletePreferences={athletePreferences} />
          )}
          
          {calculatorId === 'race-predictor' && (
            <RacePredictorCalculator athletePreferences={athletePreferences} />
          )}
          
          {calculatorId === 'finishing-percentage' && (
            <FinishingPercentageCalculator />
          )}
          
          {calculatorId === 'body-fat' && (
            <BodyFatCalculator athletePreferences={athletePreferences} />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// Pace Calculator Component
const PaceCalculator = ({ athletePreferences }) => {
  // Determine default unit from athlete preferences
  const getDefaultUnit = () => {
    if (!athletePreferences) return 'km';
    const distanceUnit = athletePreferences.distance_unit;
    if (distanceUnit === 'miles' || distanceUnit === 'mi') return 'miles';
    return 'km';
  };

  const [minutes, setMinutes] = useState(5);
  const [seconds, setSeconds] = useState(0);
  const [unit, setUnit] = useState(getDefaultUnit());

  // Update unit when preferences load
  React.useEffect(() => {
    if (athletePreferences) {
      const defaultUnit = athletePreferences.distance_unit === 'miles' || athletePreferences.distance_unit === 'mi' ? 'miles' : 'km';
      setUnit(defaultUnit);
    }
  }, [athletePreferences]);

  // Calculate time for a given distance
  const calculateTime = (distance) => {
    const paceInSeconds = minutes * 60 + seconds;
    const totalSeconds = paceInSeconds * distance;
    
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = Math.floor(totalSeconds % 60);
    
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Generate distance list
  const distances = [
    { label: '100m', value: unit === 'km' ? 0.1 : 0.062137 },
    { label: '200m', value: unit === 'km' ? 0.2 : 0.124274 },
    { label: '400m', value: unit === 'km' ? 0.4 : 0.248548 },
    { label: '800m', value: unit === 'km' ? 0.8 : 0.497097 },
    { label: '1 mile', value: unit === 'km' ? 1.60934 : 1 },
    ...Array.from({ length: 100 }, (_, i) => ({
      label: `${i + 1} ${unit}`,
      value: i + 1
    })),
    { label: 'Half Marathon', value: unit === 'km' ? 21.0975 : 13.1094 },
    { label: 'Marathon', value: unit === 'km' ? 42.195 : 26.2188 },
    { label: '50 miles', value: unit === 'km' ? 80.4672 : 50 },
    { label: '100 miles', value: unit === 'km' ? 160.934 : 100 },
  ];

  return (
    <div className="space-y-6">
      {/* Input Card */}
      <Card className="bg-gradient-to-b from-gray-700 to-gray-800 border-gray-600">
        <CardHeader>
          <CardTitle className="text-xl font-display text-white">Enter Your Pace</CardTitle>
          <CardDescription className="text-gray-300">Select your pace per {unit === 'km' ? 'kilometer' : 'mile'}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Minutes Selector */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Minutes
              </label>
              <select
                value={minutes}
                onChange={(e) => setMinutes(parseInt(e.target.value))}
                className="w-full px-4 py-3 bg-gray-600 border border-gray-500 text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-lg"
              >
                {Array.from({ length: 21 }, (_, i) => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            </div>

            {/* Seconds Selector */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Seconds
              </label>
              <select
                value={seconds}
                onChange={(e) => setSeconds(parseInt(e.target.value))}
                className="w-full px-4 py-3 bg-gray-600 border border-gray-500 text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-lg"
              >
                {Array.from({ length: 60 }, (_, i) => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            </div>

            {/* Unit Selector */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Per
              </label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full px-4 py-3 bg-gray-600 border border-gray-500 text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-lg"
              >
                <option value="km">Kilometer (km)</option>
                <option value="miles">Mile (mi)</option>
              </select>
            </div>
          </div>

          {/* Current Pace Display */}
          <div className="mt-6 bg-gradient-to-r from-teal-700 to-teal-800 rounded-lg p-4 border border-teal-600">
            <p className="text-center text-lg">
              <span className="text-gray-300">Your pace:</span>{' '}
              <span className="font-bold text-2xl text-white">
                {minutes}:{seconds.toString().padStart(2, '0')}
              </span>
              <span className="text-gray-300"> per {unit === 'km' ? 'km' : 'mile'}</span>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Results Table */}
      <Card className="bg-gradient-to-b from-gray-700 to-gray-800 border-gray-600">
        <CardHeader>
          <CardTitle className="text-xl font-display text-white">Finish Times</CardTitle>
          <CardDescription className="text-gray-300">Estimated finish times for various distances</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-600">
                  <th className="text-left py-3 px-4 font-semibold text-white">Distance</th>
                  <th className="text-right py-3 px-4 font-semibold text-white">Time</th>
                </tr>
              </thead>
              <tbody>
                {distances.map((distance, index) => (
                  <tr 
                    key={index}
                    className={`border-b border-gray-600 hover:bg-gray-600 transition-colors ${
                      ['100m', '200m', '400m', '800m', '1 mile', 'Half Marathon', 'Marathon', '50 miles', '100 miles'].includes(distance.label)
                        ? 'bg-gray-600/50 font-medium'
                        : ''
                    }`}
                  >
                    <td className="py-3 px-4 text-gray-200">{distance.label}</td>
                    <td className="py-3 px-4 text-right font-mono text-lg text-white">
                      {calculateTime(distance.value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Race Predictor Calculator Component
const RacePredictorCalculator = ({ athletePreferences }) => {
  // Determine default unit from athlete preferences
  const getDefaultUnit = () => {
    if (!athletePreferences) return 'km';
    const distanceUnit = athletePreferences.distance_unit;
    if (distanceUnit === 'miles' || distanceUnit === 'mi') return 'miles';
    return 'km';
  };

  const [inputDistance, setInputDistance] = useState('');
  const [customDistance, setCustomDistance] = useState('');
  const [timeHours, setTimeHours] = useState('');
  const [timeMinutes, setTimeMinutes] = useState('');
  const [timeSeconds, setTimeSeconds] = useState('');
  const [unit, setUnit] = useState(getDefaultUnit());
  const [predictions, setPredictions] = useState(null);

  // Update unit when preferences load
  React.useEffect(() => {
    if (athletePreferences) {
      const defaultUnit = athletePreferences.distance_unit === 'miles' || athletePreferences.distance_unit === 'mi' ? 'miles' : 'km';
      setUnit(defaultUnit);
    }
  }, [athletePreferences]);

  // All official race distances (in kilometers)
  const raceDistances = [
    // Track distances
    { label: '100m', km: 0.1, category: 'Track' },
    { label: '200m', km: 0.2, category: 'Track' },
    { label: '400m', km: 0.4, category: 'Track' },
    { label: '800m', km: 0.8, category: 'Track' },
    { label: '1500m', km: 1.5, category: 'Track' },
    { label: '1 Mile', km: 1.60934, category: 'Track' },
    { label: '3000m', km: 3, category: 'Track' },
    { label: '5000m', km: 5, category: 'Track' },
    { label: '10,000m', km: 10, category: 'Track' },
    // Road/Trail distances
    { label: '5K', km: 5, category: 'Road/Trail' },
    { label: '10K', km: 10, category: 'Road/Trail' },
    { label: '15K', km: 15, category: 'Road/Trail' },
    { label: '10 Miles', km: 16.0934, category: 'Road/Trail' },
    { label: 'Half Marathon', km: 21.0975, category: 'Road/Trail' },
    { label: '25K', km: 25, category: 'Road/Trail' },
    { label: '30K', km: 30, category: 'Road/Trail' },
    { label: 'Marathon', km: 42.195, category: 'Road/Trail' },
    { label: '50K', km: 50, category: 'Ultra' },
    { label: '50 Miles', km: 80.4672, category: 'Ultra' },
    { label: '100K', km: 100, category: 'Ultra' },
    { label: '100 Miles', km: 160.934, category: 'Ultra' },
  ];

  // Riegel's formula: T2 = T1 * (D2/D1)^1.06
  // More accurate for similar distances, uses fatigue factor
  const predictTime = (baseDistanceKm, baseTimeSeconds, targetDistanceKm) => {
    const fatigueFactor = 1.06; // Riegel's exponent
    const predictedSeconds = baseTimeSeconds * Math.pow(targetDistanceKm / baseDistanceKm, fatigueFactor);
    return predictedSeconds;
  };

  const formatPredictedTime = (totalSeconds) => {
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = Math.floor(totalSeconds % 60);
    
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const calculatePredictions = () => {
    // Get input distance in km
    let distanceKm;
    if (inputDistance === 'custom') {
      distanceKm = unit === 'km' ? parseFloat(customDistance) : parseFloat(customDistance) * 1.60934;
    } else {
      const selectedRace = raceDistances.find(d => d.label === inputDistance);
      distanceKm = selectedRace.km;
    }

    // Calculate total time in seconds
    const hours = parseInt(timeHours) || 0;
    const minutes = parseInt(timeMinutes) || 0;
    const seconds = parseInt(timeSeconds) || 0;
    const totalSeconds = hours * 3600 + minutes * 60 + seconds;

    if (!distanceKm || distanceKm <= 0 || totalSeconds <= 0) {
      return;
    }

    // Calculate pace
    const pacePerKm = totalSeconds / distanceKm;
    const paceMinutes = Math.floor(pacePerKm / 60);
    const paceSeconds = Math.floor(pacePerKm % 60);

    // Generate predictions for all distances
    const predictedTimes = raceDistances
      .filter(race => race.km !== distanceKm) // Exclude input distance
      .map(race => ({
        ...race,
        predictedTime: predictTime(distanceKm, totalSeconds, race.km),
      }));

    setPredictions({
      inputDistance: distanceKm,
      inputTime: totalSeconds,
      pace: `${paceMinutes}:${paceSeconds.toString().padStart(2, '0')}`,
      predictedTimes,
    });
  };

  return (
    <div className="space-y-6">
      {/* Input Card */}
      <Card className="bg-gradient-to-b from-gray-700 to-gray-800 border-gray-600">
        <CardHeader>
          <CardTitle className="text-xl font-display text-white">Enter Your Race Result</CardTitle>
          <CardDescription className="text-gray-300">Input your recent race time to predict other distances</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Distance Selection */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Race Distance
              </label>
              <select
                value={inputDistance}
                onChange={(e) => setInputDistance(e.target.value)}
                className="w-full px-4 py-3 bg-gray-600 border border-gray-500 text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-lg"
              >
                <option value="">Select a distance...</option>
                <optgroup label="Track">
                  {raceDistances.filter(d => d.category === 'Track').map(d => (
                    <option key={d.label} value={d.label}>{d.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Road/Trail">
                  {raceDistances.filter(d => d.category === 'Road/Trail').map(d => (
                    <option key={d.label} value={d.label}>{d.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Ultra">
                  {raceDistances.filter(d => d.category === 'Ultra').map(d => (
                    <option key={d.label} value={d.label}>{d.label}</option>
                  ))}
                </optgroup>
                <option value="custom">Custom Distance</option>
              </select>
            </div>

            {/* Custom Distance Input */}
            {inputDistance === 'custom' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Distance
                  </label>
                  <input
                    type="number"
                    value={customDistance}
                    onChange={(e) => setCustomDistance(e.target.value)}
                    placeholder="Enter distance"
                    className="w-full px-4 py-3 bg-gray-600 border border-gray-500 text-white placeholder:text-gray-400 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Unit
                  </label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-600 border border-gray-500 text-white rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-lg"
                  >
                    <option value="km">Kilometers</option>
                    <option value="miles">Miles</option>
                  </select>
                </div>
              </div>
            )}

            {/* Time Input */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Your Finish Time
              </label>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <input
                    type="number"
                    value={timeHours}
                    onChange={(e) => setTimeHours(e.target.value)}
                    placeholder="Hours"
                    min="0"
                    className="w-full px-4 py-3 bg-gray-600 border border-gray-500 text-white placeholder:text-gray-400 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-lg"
                  />
                  <p className="text-xs text-gray-400 mt-1 text-center">Hours</p>
                </div>
                <div>
                  <input
                    type="number"
                    value={timeMinutes}
                    onChange={(e) => setTimeMinutes(e.target.value)}
                    placeholder="Minutes"
                    min="0"
                    max="59"
                    className="w-full px-4 py-3 bg-gray-600 border border-gray-500 text-white placeholder:text-gray-400 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-lg"
                  />
                  <p className="text-xs text-gray-400 mt-1 text-center">Minutes</p>
                </div>
                <div>
                  <input
                    type="number"
                    value={timeSeconds}
                    onChange={(e) => setTimeSeconds(e.target.value)}
                    placeholder="Seconds"
                    min="0"
                    max="59"
                    className="w-full px-4 py-3 bg-gray-600 border border-gray-500 text-white placeholder:text-gray-400 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-lg"
                  />
                  <p className="text-xs text-gray-400 mt-1 text-center">Seconds</p>
                </div>
              </div>
            </div>

            {/* Calculate Button */}
            <Button
              onClick={calculatePredictions}
              disabled={!inputDistance || (inputDistance === 'custom' && !customDistance) || (!timeHours && !timeMinutes && !timeSeconds)}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white text-lg py-6 disabled:opacity-50"
            >
              Calculate Predictions
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Predictions Results */}
      {predictions && (
        <Card className="bg-gradient-to-b from-gray-700 to-gray-800 border-gray-600">
          <CardHeader>
            <CardTitle className="text-xl font-display text-white">Predicted Race Times</CardTitle>
            <CardDescription className="text-gray-300">
              Based on your pace of {predictions.pace} per km (using Riegel's Formula)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-600">
                    <th className="text-left py-3 px-4 font-semibold text-white">Distance</th>
                    <th className="text-left py-3 px-4 font-semibold text-white">Category</th>
                    <th className="text-right py-3 px-4 font-semibold text-white">Predicted Time</th>
                  </tr>
                </thead>
                <tbody>
                  {predictions.predictedTimes.map((race, index) => (
                    <tr 
                      key={index}
                      className="border-b border-gray-600 hover:bg-gray-600 transition-colors"
                    >
                      <td className="py-3 px-4 text-gray-200 font-medium">{race.label}</td>
                      <td className="py-3 px-4 text-gray-400 text-sm">{race.category}</td>
                      <td className="py-3 px-4 text-right font-mono text-lg text-white font-semibold">
                        {formatPredictedTime(race.predictedTime)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Info note */}
            <div className="mt-6 bg-gray-600 border border-gray-500 rounded-lg p-4">
              <p className="text-sm text-gray-300">
                <strong className="text-white">Note:</strong> Predictions use Riegel's Formula, widely used in running for race time predictions. 
                Actual performance may vary based on training, terrain, weather, and race conditions.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// Finishing Percentage Calculator Component
const FinishingPercentageCalculator = () => {
  const [totalParticipants, setTotalParticipants] = useState('');
  const [placement, setPlacement] = useState('');
  const [result, setResult] = useState(null);

  const calculatePercentage = () => {
    const total = parseInt(totalParticipants);
    const position = parseInt(placement);

    if (!total || !position || total <= 0 || position <= 0 || position > total) {
      return;
    }

    // Calculate percentages
    const percentileFromTop = (position / total) * 100;
    const percentileFromBottom = ((total - position + 1) / total) * 100;
    
    // Determine performance category
    let category = '';
    let categoryColor = '';
    let categoryDescription = '';
    
    if (percentileFromTop <= 1) {
      category = 'Elite';
      categoryColor = 'from-yellow-400 to-yellow-600';
      categoryDescription = 'Outstanding! You finished in the top 1%';
    } else if (percentileFromTop <= 5) {
      category = 'Excellent';
      categoryColor = 'from-green-400 to-green-600';
      categoryDescription = 'Excellent performance! Top 5%';
    } else if (percentileFromTop <= 10) {
      category = 'Very Good';
      categoryColor = 'from-blue-400 to-blue-600';
      categoryDescription = 'Very good finish! Top 10%';
    } else if (percentileFromTop <= 25) {
      category = 'Good';
      categoryColor = 'from-teal-400 to-teal-600';
      categoryDescription = 'Good performance! Top quarter';
    } else if (percentileFromTop <= 50) {
      category = 'Above Average';
      categoryColor = 'from-indigo-400 to-indigo-600';
      categoryDescription = 'Above average finish! Top half';
    } else if (percentileFromTop <= 75) {
      category = 'Average';
      categoryColor = 'from-purple-400 to-purple-600';
      categoryDescription = 'Average performance';
    } else {
      category = 'Participation';
      categoryColor = 'from-gray-400 to-gray-600';
      categoryDescription = 'Great effort! Completing is winning!';
    }

    // Calculate how many people finished ahead and behind
    const peopleAhead = position - 1;
    const peopleBehind = total - position;

    setResult({
      total,
      position,
      percentileFromTop: percentileFromTop.toFixed(2),
      percentileFromBottom: percentileFromBottom.toFixed(2),
      peopleAhead,
      peopleBehind,
      category,
      categoryColor,
      categoryDescription,
    });
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      calculatePercentage();
    }
  };

  return (
    <div className="space-y-6">
      {/* Input Card */}
      <Card className="bg-gradient-to-b from-gray-700 to-gray-800 border-gray-600">
        <CardHeader>
          <CardTitle className="text-xl font-display text-white">Enter Race Information</CardTitle>
          <CardDescription className="text-gray-300">Calculate your finishing percentile in the race</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Total Participants */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Total Number of Participants
              </label>
              <input
                type="number"
                value={totalParticipants}
                onChange={(e) => setTotalParticipants(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="e.g., 500"
                min="1"
                className="w-full px-4 py-3 bg-gray-600 border border-gray-500 text-white placeholder:text-gray-400 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-lg"
              />
            </div>

            {/* Placement */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Your Placement (Finishing Position)
              </label>
              <input
                type="number"
                value={placement}
                onChange={(e) => setPlacement(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="e.g., 42"
                min="1"
                max={totalParticipants || undefined}
                className="w-full px-4 py-3 bg-gray-600 border border-gray-500 text-white placeholder:text-gray-400 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-lg"
              />
              {totalParticipants && (
                <p className="text-xs text-gray-400 mt-1">
                  Must be between 1 and {totalParticipants}
                </p>
              )}
            </div>

            {/* Calculate Button */}
            <Button
              onClick={calculatePercentage}
              disabled={!totalParticipants || !placement}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white text-lg py-6 disabled:opacity-50"
            >
              Calculate Percentile
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <Card className="bg-gradient-to-b from-gray-700 to-gray-800 border-gray-600">
          <CardHeader>
            <CardTitle className="text-xl font-display text-white">Your Race Performance</CardTitle>
            <CardDescription className="text-gray-300">
              Position {result.position} out of {result.total} participants
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Performance Category Badge */}
            <div className="text-center">
              <div className={`inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r ${result.categoryColor} text-white rounded-xl shadow-lg mb-4`}>
                <span className="text-3xl font-bold">{result.category}</span>
              </div>
              <p className="text-lg text-white font-medium">{result.categoryDescription}</p>
            </div>

            {/* Main Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Top Percentile */}
              <div className="bg-gray-600 rounded-xl p-6 border border-gray-500">
                <div className="text-sm text-gray-300 mb-2">Top Percentile</div>
                <div className="text-4xl font-bold text-teal-400 mb-1">
                  {result.percentileFromTop}%
                </div>
                <div className="text-sm text-gray-700">
                  You finished in the top {result.percentileFromTop}% of all participants
                </div>
              </div>

              {/* Bottom Percentile */}
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border border-purple-200">
                <div className="text-sm text-gray-600 mb-2">From Bottom</div>
                <div className="text-4xl font-bold text-purple-600 mb-1">
                  {result.percentileFromBottom}%
                </div>
                <div className="text-sm text-gray-700">
                  Better than {result.percentileFromBottom}% of participants
                </div>
              </div>
            </div>

            {/* Detailed Breakdown */}
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6 border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-4">Detailed Breakdown</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">People who finished ahead of you:</span>
                  <span className="font-bold text-gray-900 text-lg">{result.peopleAhead}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">People you finished ahead of:</span>
                  <span className="font-bold text-gray-900 text-lg">{result.peopleBehind}</span>
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-gray-300">
                  <span className="text-gray-700 font-medium">Your placement:</span>
                  <span className="font-bold text-blue-600 text-xl">
                    #{result.position} / {result.total}
                  </span>
                </div>
              </div>
            </div>

            {/* Visual Progress Bar */}
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-4">Visual Representation</h3>
              <div className="relative h-12 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-green-400 to-blue-500 transition-all duration-500"
                  style={{ width: `${result.percentileFromTop}%` }}
                ></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-sm font-bold text-gray-700 drop-shadow-lg">
                    Top {result.percentileFromTop}%
                  </span>
                </div>
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-2">
                <span>1st Place</span>
                <span>Your Position</span>
                <span>Last Place</span>
              </div>
            </div>

            {/* Performance Tips */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>💡 Tip:</strong> {
                  result.percentileFromTop <= 25 
                    ? "You're performing at a competitive level! Keep pushing for improvement."
                    : result.percentileFromTop <= 50
                    ? "Great progress! Focus on consistency and gradual improvements."
                    : "Every finish is an achievement! Set small goals to improve each race."
                }
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// Body Fat Percentage Calculator Component
const BodyFatCalculator = ({ athletePreferences }) => {
  const [method, setMethod] = useState('navy');
  const [gender, setGender] = useState('male');
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [unit, setUnit] = useState('metric');
  
  // Navy Method measurements
  const [neck, setNeck] = useState('');
  const [waist, setWaist] = useState('');
  const [hip, setHip] = useState('');
  
  // Caliper measurements
  const [caliperSites, setCaliperSites] = useState('3'); // '3' or '7' sites
  const [chest, setChest] = useState('');
  const [abdomen, setAbdomen] = useState('');
  const [thigh, setThigh] = useState('');
  const [tricep, setTricep] = useState('');
  const [suprailiac, setSuprailiac] = useState('');
  const [subscapular, setSubscapular] = useState('');
  const [midaxillary, setMidaxillary] = useState('');
  
  const [result, setResult] = useState(null);

  // Update unit based on preferences
  React.useEffect(() => {
    if (athletePreferences) {
      setUnit(athletePreferences.measurement_system === 'imperial' ? 'imperial' : 'metric');
    }
  }, [athletePreferences]);

  // Navy Method Calculation
  const calculateNavyMethod = () => {
    let heightCm, waistCm, neckCm, hipCm;
    
    if (unit === 'imperial') {
      heightCm = parseFloat(height) * 2.54;
      waistCm = parseFloat(waist) * 2.54;
      neckCm = parseFloat(neck) * 2.54;
      if (gender === 'female') hipCm = parseFloat(hip) * 2.54;
    } else {
      heightCm = parseFloat(height);
      waistCm = parseFloat(waist);
      neckCm = parseFloat(neck);
      if (gender === 'female') hipCm = parseFloat(hip);
    }

    let bodyFat;
    if (gender === 'male') {
      bodyFat = 495 / (1.0324 - 0.19077 * Math.log10(waistCm - neckCm) + 0.15456 * Math.log10(heightCm)) - 450;
    } else {
      bodyFat = 495 / (1.29579 - 0.35004 * Math.log10(waistCm + hipCm - neckCm) + 0.22100 * Math.log10(heightCm)) - 450;
    }

    return Math.max(0, Math.min(100, bodyFat));
  };

  // Caliper Method (Jackson-Pollock 3-site or 7-site)
  const calculateCaliperMethod = () => {
    const ageNum = parseInt(age);
    let sumOfSkinfolds;
    let bodyDensity;

    if (caliperSites === '7') {
      // 7-Site Method (Most Accurate)
      sumOfSkinfolds = parseFloat(chest || 0) + parseFloat(abdomen || 0) + parseFloat(thigh || 0) + 
                       parseFloat(tricep || 0) + parseFloat(subscapular || 0) + parseFloat(suprailiac || 0) + 
                       parseFloat(midaxillary || 0);
      
      if (gender === 'male') {
        bodyDensity = 1.112 - (0.00043499 * sumOfSkinfolds) + (0.00000055 * sumOfSkinfolds * sumOfSkinfolds) - (0.00028826 * ageNum);
      } else {
        bodyDensity = 1.097 - (0.00046971 * sumOfSkinfolds) + (0.00000056 * sumOfSkinfolds * sumOfSkinfolds) - (0.00012828 * ageNum);
      }
    } else {
      // 3-Site Method
      if (gender === 'male') {
        sumOfSkinfolds = parseFloat(chest) + parseFloat(abdomen) + parseFloat(thigh);
        bodyDensity = 1.10938 - (0.0008267 * sumOfSkinfolds) + (0.0000016 * sumOfSkinfolds * sumOfSkinfolds) - (0.0002574 * ageNum);
      } else {
        sumOfSkinfolds = parseFloat(tricep) + parseFloat(suprailiac) + parseFloat(thigh);
        bodyDensity = 1.0994921 - (0.0009929 * sumOfSkinfolds) + (0.0000023 * sumOfSkinfolds * sumOfSkinfolds) - (0.0001392 * ageNum);
      }
    }

    // Siri Equation
    const bodyFat = ((4.95 / bodyDensity) - 4.50) * 100;
    return Math.max(0, Math.min(100, bodyFat));
  };

  // BMI-based estimation (Deurenberg formula)
  const calculateBMIMethod = () => {
    let weightKg, heightM;
    
    if (unit === 'imperial') {
      weightKg = parseFloat(weight) * 0.453592;
      heightM = parseFloat(height) * 0.0254;
    } else {
      weightKg = parseFloat(weight);
      heightM = parseFloat(height) / 100;
    }

    const bmi = weightKg / (heightM * heightM);
    const ageNum = parseInt(age);
    const genderFactor = gender === 'male' ? 1 : 0;
    
    const bodyFat = (1.20 * bmi) + (0.23 * ageNum) - (10.8 * genderFactor) - 5.4;
    return Math.max(0, Math.min(100, bodyFat));
  };

  const calculate = () => {
    let bodyFatPercentage;

    try {
      if (method === 'navy') {
        if (!height || !neck || !waist || (gender === 'female' && !hip)) return;
        bodyFatPercentage = calculateNavyMethod();
      } else if (method === 'caliper') {
        if (!age) return;
        // Check required fields based on sites and gender
        if (caliperSites === '3') {
          if (gender === 'male' ? (!chest || !abdomen || !thigh) : (!tricep || !suprailiac || !thigh)) return;
        } else {
          // 7-site requires all 7 measurements
          if (!chest || !abdomen || !thigh || !tricep || !subscapular || !suprailiac || !midaxillary) return;
        }
        bodyFatPercentage = calculateCaliperMethod();
      } else if (method === 'bmi') {
        if (!age || !weight || !height) return;
        bodyFatPercentage = calculateBMIMethod();
      }

      // Categorize body fat percentage
      let category, categoryColor, categoryDescription, healthRange;
      
      if (gender === 'male') {
        if (bodyFatPercentage < 6) {
          category = 'Essential Fat';
          categoryColor = 'from-red-400 to-red-600';
          categoryDescription = 'Below essential fat levels - Not recommended';
          healthRange = '2-5%';
        } else if (bodyFatPercentage < 14) {
          category = 'Athletes';
          categoryColor = 'from-blue-400 to-blue-600';
          categoryDescription = 'Athletic body composition';
          healthRange = '6-13%';
        } else if (bodyFatPercentage < 18) {
          category = 'Fitness';
          categoryColor = 'from-green-400 to-green-600';
          categoryDescription = 'Fit and healthy range';
          healthRange = '14-17%';
        } else if (bodyFatPercentage < 25) {
          category = 'Average';
          categoryColor = 'from-yellow-400 to-yellow-600';
          categoryDescription = 'Average body composition';
          healthRange = '18-24%';
        } else {
          category = 'Above Average';
          categoryColor = 'from-orange-400 to-orange-600';
          categoryDescription = 'Consider healthy lifestyle changes';
          healthRange = '25%+';
        }
      } else {
        if (bodyFatPercentage < 14) {
          category = 'Essential Fat';
          categoryColor = 'from-red-400 to-red-600';
          categoryDescription = 'Below essential fat levels - Not recommended';
          healthRange = '10-13%';
        } else if (bodyFatPercentage < 21) {
          category = 'Athletes';
          categoryColor = 'from-blue-400 to-blue-600';
          categoryDescription = 'Athletic body composition';
          healthRange = '14-20%';
        } else if (bodyFatPercentage < 25) {
          category = 'Fitness';
          categoryColor = 'from-green-400 to-green-600';
          categoryDescription = 'Fit and healthy range';
          healthRange = '21-24%';
        } else if (bodyFatPercentage < 32) {
          category = 'Average';
          categoryColor = 'from-yellow-400 to-yellow-600';
          categoryDescription = 'Average body composition';
          healthRange = '25-31%';
        } else {
          category = 'Above Average';
          categoryColor = 'from-orange-400 to-orange-600';
          categoryDescription = 'Consider healthy lifestyle changes';
          healthRange = '32%+';
        }
      }

      setResult({
        bodyFatPercentage: bodyFatPercentage.toFixed(1),
        category,
        categoryColor,
        categoryDescription,
        healthRange,
        gender,
        method,
        caliperSites: method === 'caliper' ? caliperSites : null,
      });
    } catch (error) {
      console.error('Calculation error:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Method Selection */}
      <Card className="bg-gradient-to-b from-gray-700 to-gray-800 border-gray-600">
        <CardHeader>
          <CardTitle className="text-xl font-display text-white">Select Calculation Method</CardTitle>
          <CardDescription className="text-gray-300">Choose your preferred measurement method</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => setMethod('navy')}
              className={`p-4 rounded-lg border-2 transition-all ${
                method === 'navy'
                  ? 'border-teal-500 bg-teal-700'
                  : 'border-gray-500 bg-gray-600 hover:border-teal-400'
              }`}
            >
              <div className="font-semibold text-white">Navy Method</div>
              <div className="text-sm text-gray-300 mt-1">Uses circumference measurements</div>
            </button>
            <button
              onClick={() => setMethod('caliper')}
              className={`p-4 rounded-lg border-2 transition-all ${
                method === 'caliper'
                  ? 'border-teal-500 bg-teal-700'
                  : 'border-gray-500 bg-gray-600 hover:border-teal-400'
              }`}
            >
              <div className="font-semibold text-white">Caliper Method</div>
              <div className="text-sm text-gray-300 mt-1">Uses skinfold measurements</div>
            </button>
            <button
              onClick={() => setMethod('bmi')}
              className={`p-4 rounded-lg border-2 transition-all ${
                method === 'bmi'
                  ? 'border-teal-500 bg-teal-700'
                  : 'border-gray-500 bg-gray-600 hover:border-teal-400'
              }`}
            >
              <div className="font-semibold text-white">BMI Method</div>
              <div className="text-sm text-gray-300 mt-1">Uses height and weight</div>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Input Form */}
      <Card className="bg-gradient-to-b from-gray-700 to-gray-800 border-gray-600">
        <CardHeader>
          <CardTitle className="text-xl font-display text-white">Enter Your Measurements</CardTitle>
          <CardDescription className="text-gray-300">
            {method === 'navy' && 'Measure circumferences at specified body points'}
            {method === 'caliper' && 'Measure skinfold thickness with calipers'}
            {method === 'bmi' && 'Basic height and weight measurements'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Gender and Unit Selection */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Gender</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Unit System</label>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="metric">Metric (cm, kg)</option>
                  <option value="imperial">Imperial (in, lbs)</option>
                </select>
              </div>
            </div>

            {/* Age (for caliper and BMI methods) */}
            {(method === 'caliper' || method === 'bmi') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Age (years)</label>
                <input
                  type="number"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="e.g., 30"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            )}

            {/* Navy Method Inputs */}
            {method === 'navy' && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Height ({unit === 'metric' ? 'cm' : 'inches'})
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={height}
                      onChange={(e) => setHeight(e.target.value)}
                      placeholder={unit === 'metric' ? '175' : '69'}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Neck ({unit === 'metric' ? 'cm' : 'inches'})
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={neck}
                      onChange={(e) => setNeck(e.target.value)}
                      placeholder={unit === 'metric' ? '38' : '15'}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Waist ({unit === 'metric' ? 'cm' : 'inches'})
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={waist}
                      onChange={(e) => setWaist(e.target.value)}
                      placeholder={unit === 'metric' ? '85' : '33'}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </div>
                {gender === 'female' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Hip ({unit === 'metric' ? 'cm' : 'inches'})
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={hip}
                      onChange={(e) => setHip(e.target.value)}
                      placeholder={unit === 'metric' ? '95' : '37'}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                )}
              </>
            )}

            {/* Caliper Method Inputs */}
            {method === 'caliper' && (
              <>
                {/* Site Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Number of Measurement Sites
                  </label>
                  <select
                    value={caliperSites}
                    onChange={(e) => setCaliperSites(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="3">3-Site Method (Standard)</option>
                    <option value="7">7-Site Method (Most Accurate)</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {caliperSites === '3' 
                      ? 'Quick and accurate for most people' 
                      : 'Most comprehensive - requires all 7 measurements'}
                  </p>
                </div>

                {caliperSites === '3' ? (
                  // 3-Site Method
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {gender === 'male' ? (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Chest (mm)</label>
                          <input
                            type="number"
                            step="0.1"
                            value={chest}
                            onChange={(e) => setChest(e.target.value)}
                            placeholder="10"
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Abdomen (mm)</label>
                          <input
                            type="number"
                            step="0.1"
                            value={abdomen}
                            onChange={(e) => setAbdomen(e.target.value)}
                            placeholder="15"
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Thigh (mm)</label>
                          <input
                            type="number"
                            step="0.1"
                            value={thigh}
                            onChange={(e) => setThigh(e.target.value)}
                            placeholder="12"
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Tricep (mm)</label>
                          <input
                            type="number"
                            step="0.1"
                            value={tricep}
                            onChange={(e) => setTricep(e.target.value)}
                            placeholder="15"
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Suprailiac (mm)</label>
                          <input
                            type="number"
                            step="0.1"
                            value={suprailiac}
                            onChange={(e) => setSuprailiac(e.target.value)}
                            placeholder="18"
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Thigh (mm)</label>
                          <input
                            type="number"
                            step="0.1"
                            value={thigh}
                            onChange={(e) => setThigh(e.target.value)}
                            placeholder="20"
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  // 7-Site Method - All measurements for both genders
                  <>
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
                      <p className="text-sm text-purple-800">
                        <strong>7-Site Method:</strong> Measure all 7 skinfold sites for maximum accuracy. This method is used by fitness professionals and provides the most precise body fat estimation.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Chest (mm)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={chest}
                          onChange={(e) => setChest(e.target.value)}
                          placeholder="10"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                        <p className="text-xs text-gray-500 mt-1">Diagonal fold, midpoint between armpit and nipple</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Abdomen (mm)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={abdomen}
                          onChange={(e) => setAbdomen(e.target.value)}
                          placeholder="15"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                        <p className="text-xs text-gray-500 mt-1">Vertical fold, 2cm beside navel</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Thigh (mm)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={thigh}
                          onChange={(e) => setThigh(e.target.value)}
                          placeholder="12"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                        <p className="text-xs text-gray-500 mt-1">Vertical fold, front of thigh, midway between knee and hip</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Tricep (mm)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={tricep}
                          onChange={(e) => setTricep(e.target.value)}
                          placeholder="13"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                        <p className="text-xs text-gray-500 mt-1">Vertical fold, back of upper arm, midpoint</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Subscapular (mm)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={subscapular}
                          onChange={(e) => setSubscapular(e.target.value)}
                          placeholder="14"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                        <p className="text-xs text-gray-500 mt-1">Diagonal fold, just below shoulder blade</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Suprailiac (mm)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={suprailiac}
                          onChange={(e) => setSuprailiac(e.target.value)}
                          placeholder="16"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                        <p className="text-xs text-gray-500 mt-1">Diagonal fold, above hip bone on side</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Midaxillary (mm)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={midaxillary}
                          onChange={(e) => setMidaxillary(e.target.value)}
                          placeholder="11"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                        <p className="text-xs text-gray-500 mt-1">Horizontal fold, on side below armpit</p>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}

            {/* BMI Method Inputs */}
            {method === 'bmi' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Weight ({unit === 'metric' ? 'kg' : 'lbs'})
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder={unit === 'metric' ? '75' : '165'}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Height ({unit === 'metric' ? 'cm' : 'inches'})
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    placeholder={unit === 'metric' ? '175' : '69'}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}

            {/* Calculate Button */}
            <Button
              onClick={calculate}
              className="w-full bg-gradient-to-r from-purple-400 to-purple-600 hover:opacity-90 text-white text-lg py-6"
            >
              Calculate Body Fat %
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-display">Your Body Fat Percentage</CardTitle>
            <CardDescription>
              Based on {result.method === 'navy' ? 'Navy' : result.method === 'caliper' ? `Caliper - ${result.caliperSites}-Site (Jackson-Pollock)` : 'BMI'} method
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Main Result */}
            <div className="text-center">
              <div className="text-6xl font-bold text-purple-600 mb-2">
                {result.bodyFatPercentage}%
              </div>
              <div className={`inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r ${result.categoryColor} text-white rounded-xl shadow-lg mb-4`}>
                <span className="text-xl font-bold">{result.category}</span>
              </div>
              <p className="text-lg text-gray-700">{result.categoryDescription}</p>
            </div>

            {/* Body Fat Ranges */}
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border border-purple-200">
              <h3 className="font-semibold text-gray-900 mb-4">
                Healthy Range for {result.gender === 'male' ? 'Men' : 'Women'}
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-700">Essential Fat:</span>
                  <span className="font-medium">{result.gender === 'male' ? '2-5%' : '10-13%'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">Athletes:</span>
                  <span className="font-medium">{result.gender === 'male' ? '6-13%' : '14-20%'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">Fitness:</span>
                  <span className="font-medium">{result.gender === 'male' ? '14-17%' : '21-24%'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">Average:</span>
                  <span className="font-medium">{result.gender === 'male' ? '18-24%' : '25-31%'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">Obese:</span>
                  <span className="font-medium">{result.gender === 'male' ? '25%+' : '32%+'}</span>
                </div>
              </div>
            </div>

            {/* Method Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>💡 Note:</strong> {
                  result.method === 'navy' 
                    ? 'The Navy method is accurate and requires only a tape measure. Best for general fitness tracking.'
                    : result.method === 'caliper'
                    ? result.caliperSites === '7'
                      ? 'The 7-site caliper method (Jackson-Pollock) is the gold standard for body fat measurement. Provides the highest accuracy when performed correctly by a trained professional.'
                      : 'The 3-site caliper method (Jackson-Pollock) is highly accurate when performed correctly. Requires calipers and proper technique.'
                    : 'The BMI method provides an estimate based on height and weight. Less accurate than other methods but easy to perform.'
                }
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CalculatorsConverters;
