import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Calculator, Activity, Target, Ruler, X } from 'lucide-react';

const CalculatorsConverters = ({ athleteId }) => {
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
      title: 'Calculate Running Pace',
      description: 'Calculate your pace per mile or kilometer based on distance and time',
      icon: Activity,
      color: 'from-[#62D2C4] to-[#4fc4b5]',
    },
    {
      id: 'race-predictor',
      title: 'Race Time Predictor',
      description: 'Predict your finish times for other race distances based on a recent result',
      icon: Target,
      color: 'from-orange-400 to-orange-600',
    },
    {
      id: 'finishing-percentage',
      title: 'Calculate Finishing Percentage',
      description: 'Estimate your race finishing position based on your time',
      icon: Target,
      color: 'from-blue-400 to-blue-600',
    },
    {
      id: 'body-fat',
      title: 'Calculate Body Fat Percentage',
      description: 'Calculate body fat percentage using various measurement methods',
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
        <h1 className="text-3xl font-display font-bold bg-gradient-to-r from-[#62D2C4] to-[#4fc4b5] bg-clip-text text-transparent mb-2">
          Calculators & Converters
        </h1>
        <p className="text-gray-600">
          Useful tools to help you track and optimize your fitness journey
        </p>
      </div>

      {/* Calculators Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {calculators.map((calc) => {
          const IconComponent = calc.icon;
          return (
            <Card
              key={calc.id}
              className="border-0 shadow-md hover:shadow-lg transition-all cursor-pointer group"
              onClick={() => openCalculator(calc.id)}
            >
              <CardHeader>
                <div className={`w-16 h-16 bg-gradient-to-br ${calc.color} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-md`}>
                  <IconComponent className="w-8 h-8 text-white" />
                </div>
                <CardTitle className="text-xl font-display">{calc.title}</CardTitle>
                <CardDescription className="text-gray-600 mt-2">
                  {calc.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className={`w-full bg-gradient-to-r ${calc.color} hover:opacity-90 text-white`}>
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
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <CardHeader className={`sticky top-0 bg-gradient-to-r ${calculator.color} text-white z-10`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                <IconComponent className="w-6 h-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-white text-xl">{calculator.title}</CardTitle>
                <CardDescription className="text-white/90">
                  {calculator.description}
                </CardDescription>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-white" />
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
            <div className="text-center py-12">
              <div className={`w-20 h-20 bg-gradient-to-br ${calculator.color} rounded-full flex items-center justify-center mx-auto mb-6`}>
                <IconComponent className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-2xl font-display font-bold text-gray-800 mb-4">
                Calculator Coming Soon
              </h3>
              <p className="text-gray-600 max-w-md mx-auto">
                The {calculator.title.toLowerCase()} functionality will be implemented here.
              </p>
            </div>
          )}
          
          {calculatorId === 'body-fat' && (
            <div className="text-center py-12">
              <div className={`w-20 h-20 bg-gradient-to-br ${calculator.color} rounded-full flex items-center justify-center mx-auto mb-6`}>
                <IconComponent className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-2xl font-display font-bold text-gray-800 mb-4">
                Calculator Coming Soon
              </h3>
              <p className="text-gray-600 max-w-md mx-auto">
                The {calculator.title.toLowerCase()} functionality will be implemented here.
              </p>
            </div>
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
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl font-display">Enter Your Pace</CardTitle>
          <CardDescription>Select your pace per {unit === 'km' ? 'kilometer' : 'mile'}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Minutes Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Minutes
              </label>
              <select
                value={minutes}
                onChange={(e) => setMinutes(parseInt(e.target.value))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#62D2C4] focus:border-transparent text-lg"
              >
                {Array.from({ length: 21 }, (_, i) => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            </div>

            {/* Seconds Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Seconds
              </label>
              <select
                value={seconds}
                onChange={(e) => setSeconds(parseInt(e.target.value))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#62D2C4] focus:border-transparent text-lg"
              >
                {Array.from({ length: 60 }, (_, i) => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            </div>

            {/* Unit Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Per
              </label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#62D2C4] focus:border-transparent text-lg"
              >
                <option value="km">Kilometer (km)</option>
                <option value="miles">Mile (mi)</option>
              </select>
            </div>
          </div>

          {/* Current Pace Display */}
          <div className="mt-6 bg-gradient-to-r from-[#D4F0E9] to-[#b8e6db] rounded-lg p-4">
            <p className="text-center text-lg">
              <span className="text-gray-600">Your pace:</span>{' '}
              <span className="font-bold text-2xl text-gray-800">
                {minutes}:{seconds.toString().padStart(2, '0')}
              </span>
              <span className="text-gray-600"> per {unit === 'km' ? 'km' : 'mile'}</span>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Results Table */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl font-display">Finish Times</CardTitle>
          <CardDescription>Estimated finish times for various distances</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Distance</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Time</th>
                </tr>
              </thead>
              <tbody>
                {distances.map((distance, index) => (
                  <tr 
                    key={index}
                    className={`border-b border-gray-100 hover:bg-gradient-to-r hover:from-[#D4F0E9]/30 hover:to-transparent transition-colors ${
                      ['100m', '200m', '400m', '800m', '1 mile', 'Half Marathon', 'Marathon', '50 miles', '100 miles'].includes(distance.label)
                        ? 'bg-gradient-to-r from-blue-50/50 to-transparent font-medium'
                        : ''
                    }`}
                  >
                    <td className="py-3 px-4 text-gray-800">{distance.label}</td>
                    <td className="py-3 px-4 text-right font-mono text-lg text-gray-900">
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
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl font-display">Enter Your Race Result</CardTitle>
          <CardDescription>Input your recent race time to predict other distances</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Distance Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Race Distance
              </label>
              <select
                value={inputDistance}
                onChange={(e) => setInputDistance(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#62D2C4] focus:border-transparent text-lg"
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Distance
                  </label>
                  <input
                    type="number"
                    value={customDistance}
                    onChange={(e) => setCustomDistance(e.target.value)}
                    placeholder="Enter distance"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#62D2C4] focus:border-transparent text-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Unit
                  </label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#62D2C4] focus:border-transparent text-lg"
                  >
                    <option value="km">Kilometers</option>
                    <option value="miles">Miles</option>
                  </select>
                </div>
              </div>
            )}

            {/* Time Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#62D2C4] focus:border-transparent text-lg"
                  />
                  <p className="text-xs text-gray-500 mt-1 text-center">Hours</p>
                </div>
                <div>
                  <input
                    type="number"
                    value={timeMinutes}
                    onChange={(e) => setTimeMinutes(e.target.value)}
                    placeholder="Minutes"
                    min="0"
                    max="59"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#62D2C4] focus:border-transparent text-lg"
                  />
                  <p className="text-xs text-gray-500 mt-1 text-center">Minutes</p>
                </div>
                <div>
                  <input
                    type="number"
                    value={timeSeconds}
                    onChange={(e) => setTimeSeconds(e.target.value)}
                    placeholder="Seconds"
                    min="0"
                    max="59"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#62D2C4] focus:border-transparent text-lg"
                  />
                  <p className="text-xs text-gray-500 mt-1 text-center">Seconds</p>
                </div>
              </div>
            </div>

            {/* Calculate Button */}
            <Button
              onClick={calculatePredictions}
              disabled={!inputDistance || (inputDistance === 'custom' && !customDistance) || (!timeHours && !timeMinutes && !timeSeconds)}
              className="w-full bg-gradient-to-r from-orange-400 to-orange-600 hover:opacity-90 text-white text-lg py-6"
            >
              Calculate Predictions
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Predictions Results */}
      {predictions && (
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-display">Predicted Race Times</CardTitle>
            <CardDescription>
              Based on your pace of {predictions.pace} per km (using Riegel's Formula)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Distance</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Category</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Predicted Time</th>
                  </tr>
                </thead>
                <tbody>
                  {predictions.predictedTimes.map((race, index) => (
                    <tr 
                      key={index}
                      className="border-b border-gray-100 hover:bg-gradient-to-r hover:from-orange-50/50 hover:to-transparent transition-colors"
                    >
                      <td className="py-3 px-4 text-gray-800 font-medium">{race.label}</td>
                      <td className="py-3 px-4 text-gray-600 text-sm">{race.category}</td>
                      <td className="py-3 px-4 text-right font-mono text-lg text-gray-900 font-semibold">
                        {formatPredictedTime(race.predictedTime)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Info note */}
            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> Predictions use Riegel's Formula, widely used in running for race time predictions. 
                Actual performance may vary based on training, terrain, weather, and race conditions.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CalculatorsConverters;
