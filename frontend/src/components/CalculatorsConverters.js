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
      const response = await axios.get(`${API_URL}/api/athletes/${athleteId}`);
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
    <div className="fixed inset-0 bg-white z-50 overflow-y-auto">
      {/* Header */}
      <div className={`bg-gradient-to-r ${calculator.color} text-white py-6 px-4 md:px-8 shadow-lg sticky top-0 z-10`}>
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
              <IconComponent className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-display font-bold">{calculator.title}</h2>
              <p className="text-white/90 text-sm">{calculator.description}</p>
            </div>
          </div>
          <Button
            onClick={onClose}
            className="bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm border-0"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Calculator Content Area */}
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-8">
        {calculatorId === 'running-pace' && (
          <PaceCalculator athletePreferences={athletePreferences} />
        )}
        
        {calculatorId === 'finishing-percentage' && (
          <Card className="border-0 shadow-lg">
            <CardContent className="p-8">
              <div className="text-center py-12">
                <div className={`w-20 h-20 bg-gradient-to-br ${calculator.color} rounded-full flex items-center justify-center mx-auto mb-6`}>
                  <IconComponent className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-2xl font-display font-bold text-gray-800 mb-4">
                  Calculator Coming Soon
                </h3>
                <p className="text-gray-600 max-w-md mx-auto mb-8">
                  The {calculator.title.toLowerCase()} functionality will be implemented here.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
        
        {calculatorId === 'body-fat' && (
          <Card className="border-0 shadow-lg">
            <CardContent className="p-8">
              <div className="text-center py-12">
                <div className={`w-20 h-20 bg-gradient-to-br ${calculator.color} rounded-full flex items-center justify-center mx-auto mb-6`}>
                  <IconComponent className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-2xl font-display font-bold text-gray-800 mb-4">
                  Calculator Coming Soon
                </h3>
                <p className="text-gray-600 max-w-md mx-auto mb-8">
                  The {calculator.title.toLowerCase()} functionality will be implemented here.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
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
    { label: '800m', value: unit === 'km' ? 0.8 : 0.497097 },
    { label: '1 mile', value: unit === 'km' ? 1.60934 : 1 },
    ...Array.from({ length: 100 }, (_, i) => ({
      label: `${i + 1} ${unit}`,
      value: i + 1
    })),
    { label: 'Half Marathon', value: unit === 'km' ? 21.0975 : 13.1094 },
    { label: 'Marathon', value: unit === 'km' ? 42.195 : 26.2188 },
    { label: '50 miles', value: unit === 'km' ? 80.4672 : 50 },
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
                      ['100m', '200m', '800m', '1 mile', 'Half Marathon', 'Marathon', '50 miles'].includes(distance.label)
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

export default CalculatorsConverters;
