import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Calculator, Activity, Target, Ruler, X } from 'lucide-react';

const CalculatorsConverters = ({ athleteId }) => {
  const [selectedCalculator, setSelectedCalculator] = useState(null);

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
          onClose={closeCalculator}
        />
      )}
    </div>
  );
};

// Full-Page Calculator Modal Component
const CalculatorModal = ({ calculatorId, calculators, onClose }) => {
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
              <Button
                onClick={onClose}
                className={`bg-gradient-to-r ${calculator.color} hover:opacity-90 text-white`}
              >
                Close Calculator
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CalculatorsConverters;
