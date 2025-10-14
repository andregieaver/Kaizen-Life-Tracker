import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Clock, Users, ChefHat, Star, Sparkles, Loader2 } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Recipes = ({ athleteId }) => {
  const { t } = useTranslation();
  const [recipes, setRecipes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingProgress, setGeneratingProgress] = useState({ current: 0, total: 7, currentDay: '' });
  const [selectedDay, setSelectedDay] = useState('all');
  const [selectedMeal, setSelectedMeal] = useState('all');

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const meals = ['breakfast', 'lunch', 'dinner'];

  useEffect(() => {
    loadRecipes();
  }, [athleteId]);

  const loadRecipes = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API}/recipes/${athleteId}`);
      setRecipes(response.data.recipes || []);
    } catch (error) {
      console.error('Error loading recipes:', error);
      setRecipes([]);
    } finally {
      setIsLoading(false);
    }
  };

  const generateWeeklyMenu = async () => {
    setIsGenerating(true);
    setGeneratingProgress({ current: 0, total: 7, currentDay: '' });
    
    try {
      const weekStartDate = new Date().toISOString().split('T')[0]; // Today's date
      
      // Generate recipes day by day
      for (let i = 0; i < days.length; i++) {
        const day = days[i];
        setGeneratingProgress({ 
          current: i + 1, 
          total: 7, 
          currentDay: day.charAt(0).toUpperCase() + day.slice(1) 
        });
        
        try {
          const response = await axios.post(`${API}/recipes/generate-day/${athleteId}`, {
            day_of_week: day,
            week_start_date: weekStartDate
          });
          console.log(`Generated recipes for ${day}:`, response.data);
          
          // Reload recipes after each day to show progress
          await loadRecipes();
        } catch (dayError) {
          console.error(`Error generating recipes for ${day}:`, dayError);
          // Continue with next day even if one fails
        }
      }
      
      alert('Weekly menu generated successfully! 🎉');
    } catch (error) {
      console.error('Error generating recipes:', error);
      alert(error.response?.data?.detail || 'Failed to generate recipes. Please make sure you have an OpenAI API key set in Account Settings → Apps tab.');
    } finally {
      setIsGenerating(false);
      setGeneratingProgress({ current: 0, total: 7, currentDay: '' });
    }
  };

  const rateRecipe = async (recipeId, rating) => {
    try {
      await axios.put(`${API}/recipes/${recipeId}/rating`, { rating });
      // Update local state
      setRecipes(recipes.map(r => 
        r.id === recipeId ? { ...r, user_rating: rating } : r
      ));
    } catch (error) {
      console.error('Error rating recipe:', error);
    }
  };

  const deleteRecipe = async (recipeId) => {
    if (!window.confirm('Are you sure you want to delete this recipe?')) return;
    
    try {
      await axios.delete(`${API}/recipes/${recipeId}`);
      setRecipes(recipes.filter(r => r.id !== recipeId));
    } catch (error) {
      console.error('Error deleting recipe:', error);
    }
  };

  // Filter recipes
  const filteredRecipes = recipes.filter(recipe => {
    if (selectedDay !== 'all' && recipe.day_of_week !== selectedDay) return false;
    if (selectedMeal !== 'all' && recipe.meal_type !== selectedMeal) return false;
    return true;
  });

  // Group recipes by day and meal
  const recipesByDay = {};
  days.forEach(day => {
    recipesByDay[day] = {
      breakfast: filteredRecipes.find(r => r.day_of_week === day && r.meal_type === 'breakfast'),
      lunch: filteredRecipes.find(r => r.day_of_week === day && r.meal_type === 'lunch'),
      dinner: filteredRecipes.find(r => r.day_of_week === day && r.meal_type === 'dinner'),
    };
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading recipes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-gray-900">Weekly Meal Plan</h1>
          <p className="text-gray-600 mt-1">AI-generated recipes tailored to your nutrition needs</p>
        </div>
        <Button
          onClick={generateWeeklyMenu}
          disabled={isGenerating}
          className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Generate New Week
            </>
          )}
        </Button>
      </div>

      {recipes.length === 0 ? (
        <Card className="border-2 border-dashed">
          <CardContent className="text-center py-12">
            <ChefHat className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Recipes Yet</h3>
            <p className="text-gray-600 mb-6">Generate your first AI-powered weekly meal plan</p>
            <Button
              onClick={generateWeeklyMenu}
              disabled={isGenerating}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Weekly Menu
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <select
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Days</option>
              {days.map(day => (
                <option key={day} value={day}>{day.charAt(0).toUpperCase() + day.slice(1)}</option>
              ))}
            </select>
            <select
              value={selectedMeal}
              onChange={(e) => setSelectedMeal(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Meals</option>
              {meals.map(meal => (
                <option key={meal} value={meal}>{meal.charAt(0).toUpperCase() + meal.slice(1)}</option>
              ))}
            </select>
          </div>

          {/* Recipes Grid */}
          <div className="space-y-8">
            {days.map(day => {
              const dayRecipes = recipesByDay[day];
              const hasRecipes = dayRecipes.breakfast || dayRecipes.lunch || dayRecipes.dinner;
              
              if (!hasRecipes && selectedDay === 'all') return null;
              if (selectedDay !== 'all' && selectedDay !== day) return null;

              return (
                <div key={day} className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-gray-900 capitalize border-b pb-2">
                    {day}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {meals.map(meal => {
                      const recipe = dayRecipes[meal];
                      if (!recipe) return null;
                      if (selectedMeal !== 'all' && selectedMeal !== meal) return null;

                      return (
                        <Card key={recipe.id} className="hover:shadow-lg transition-shadow">
                          {/* Recipe Image */}
                          {recipe.image_base64 && (
                            <div className="relative h-48 overflow-hidden rounded-t-lg">
                              <img
                                src={`data:image/png;base64,${recipe.image_base64}`}
                                alt={recipe.recipe_name}
                                className="w-full h-full object-cover"
                              />
                              <Badge className="absolute top-2 right-2 bg-white text-purple-700 capitalize">
                                {meal}
                              </Badge>
                            </div>
                          )}
                          
                          <CardHeader>
                            <CardTitle className="text-lg font-display">{recipe.recipe_name}</CardTitle>
                            <div className="flex items-center gap-4 text-sm text-gray-600">
                              <div className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                {recipe.prep_time + recipe.cook_time} min
                              </div>
                              <div className="flex items-center gap-1">
                                <Users className="w-4 h-4" />
                                {recipe.servings} servings
                              </div>
                            </div>
                          </CardHeader>

                          <CardContent className="space-y-4">
                            {/* Nutrition Info */}
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div className="bg-blue-50 p-2 rounded">
                                <p className="text-xs text-gray-600">Calories</p>
                                <p className="font-semibold">{recipe.nutrition_info.calories}</p>
                              </div>
                              <div className="bg-green-50 p-2 rounded">
                                <p className="text-xs text-gray-600">Protein</p>
                                <p className="font-semibold">{recipe.nutrition_info.protein}g</p>
                              </div>
                              <div className="bg-yellow-50 p-2 rounded">
                                <p className="text-xs text-gray-600">Carbs</p>
                                <p className="font-semibold">{recipe.nutrition_info.carbs}g</p>
                              </div>
                              <div className="bg-red-50 p-2 rounded">
                                <p className="text-xs text-gray-600">Fat</p>
                                <p className="font-semibold">{recipe.nutrition_info.fat}g</p>
                              </div>
                            </div>

                            {/* Rating */}
                            <div className="flex items-center justify-between pt-2 border-t">
                              <div className="flex gap-1">
                                {[1, 2, 3, 4, 5].map(star => (
                                  <button
                                    key={star}
                                    onClick={() => rateRecipe(recipe.id, star)}
                                    className="focus:outline-none"
                                  >
                                    <Star
                                      className={`w-5 h-5 ${
                                        star <= (recipe.user_rating || 0)
                                          ? 'fill-yellow-400 text-yellow-400'
                                          : 'text-gray-300'
                                      }`}
                                    />
                                  </button>
                                ))}
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  // Show recipe details in modal or expanded view
                                  alert(`Recipe: ${recipe.recipe_name}\n\nIngredients:\n${recipe.ingredients.join('\n')}\n\nInstructions:\n${recipe.instructions}`);
                                }}
                                className="text-purple-600 hover:text-purple-700"
                              >
                                View Recipe
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default Recipes;
