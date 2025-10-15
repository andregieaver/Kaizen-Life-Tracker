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
    <div className="h-full flex flex-col">
      {/* Tab Navigation */}
      <div className="bg-white border-b sticky top-0 z-10">
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
                      ? 'border-purple-600 text-purple-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
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
