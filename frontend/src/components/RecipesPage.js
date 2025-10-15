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
    <div className="h-full flex flex-col bg-gradient-to-br from-[#f0fffe] to-[#e8f9f7]">
      {/* Tab Navigation */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-10">
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
                      ? 'border-[#62D2C4] text-[#62D2C4]'
                      : 'border-transparent text-gray-500 hover:text-[#62D2C4] hover:border-[#D4F0E9]'
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
