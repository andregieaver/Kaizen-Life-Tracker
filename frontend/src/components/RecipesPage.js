import React, { useState } from 'react';
import { ChefHat, Calendar } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import Recipes from './Recipes';
import WeeklyMenuBuilder from './WeeklyMenuBuilder';

const RecipesPage = ({ athleteId }) => {
  const [activeTab, setActiveTab] = useState('menus');

  return (
    <div className="h-full flex flex-col space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 bg-gray-800 border border-gray-700 p-1.5 h-auto">
          <TabsTrigger 
            value="menus" 
            className="text-sm data-[state=active]:bg-gray-700 data-[state=active]:text-white text-gray-400"
          >
            <Calendar className="w-4 h-4 mr-2" />
            Weekly Menus
          </TabsTrigger>
          <TabsTrigger 
            value="generator" 
            className="text-sm data-[state=active]:bg-gray-700 data-[state=active]:text-white text-gray-400"
          >
            <ChefHat className="w-4 h-4 mr-2" />
            Generator
          </TabsTrigger>
        </TabsList>

        <TabsContent value="menus">
          <WeeklyMenuBuilder athleteId={athleteId} />
        </TabsContent>

        <TabsContent value="generator">
          <Recipes athleteId={athleteId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RecipesPage;
