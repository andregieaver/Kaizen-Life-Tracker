import React, { useState } from 'react';
import { ChefHat, Calendar } from 'lucide-react';
import Recipes from './Recipes';
import WeeklyMenuBuilder from './WeeklyMenuBuilder';

const RecipesPage = ({ athleteId }) => {
  const [activeTab, setActiveTab] = useState('menus');

  const tabs = [
    { id: 'menus', label: 'Weekly Menus', icon: Calendar },
    { id: 'generator', label: 'Generator', icon: ChefHat }
  ];

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-gray-800 to-gray-600">
      {/* Tab Navigation */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 border-b border-gray-700 shadow-sm sticky top-0 z-10">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? 'text-white'
                      : 'border-transparent text-gray-400 hover:text-white hover:border-gray-600'
                  }`}
                  style={activeTab === tab.id ? { borderColor: '#00C2A8' } : {}}
                >
                  <Icon className="w-5 h-5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'menus' && <WeeklyMenuBuilder athleteId={athleteId} />}
        {activeTab === 'generator' && <Recipes athleteId={athleteId} />}
      </div>
    </div>
  );
};

export default RecipesPage;
