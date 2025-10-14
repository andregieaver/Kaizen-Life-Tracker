import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Clock, Users, ChefHat, Star, Sparkles, Loader2, X } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Recipes = ({ athleteId }) => {
  const { t } = useTranslation();
  const [recipes, setRecipes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState('breakfast');
  const [filterMealType, setFilterMealType] = useState('all');

  const mealTypes = ['breakfast', 'lunch', 'dinner'];

  useEffect(() => {
    let mounted = true;
    
    const fetchRecipes = async () => {
      setIsLoading(true);
      try {
        const response = await axios.get(`${API}/recipes/${athleteId}`, {
          timeout: 5000 // 5 second timeout
        });
        if (mounted) {
          setRecipes(response.data.recipes || []);
        }
      } catch (error) {
        console.error('Error loading recipes:', error);
        if (mounted) {
          setRecipes([]);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };
    
    fetchRecipes();
    
    return () => {
      mounted = false;
    };
  }, [athleteId]);

  const loadRecipes = async () => {
    try {
      const response = await axios.get(`${API}/recipes/${athleteId}`, {
        timeout: 5000
      });
      setRecipes(response.data.recipes || []);
    } catch (error) {
      console.error('Error loading recipes:', error);
      setRecipes([]);
    }
  };

  const generateRecipe = async () => {
    setIsGenerating(true);
    
    try {
      const response = await axios.post(`${API}/recipes/generate/${athleteId}`, {
        meal_type: selectedMealType
      });
      
      console.log('Generated recipe:', response.data);
      
      // Add the new recipe to the list
      if (response.data.recipe) {
        setRecipes([response.data.recipe, ...recipes]);
      }
    } catch (error) {
      console.error('Error generating recipe:', error);
      alert(error.response?.data?.detail || 'Failed to generate recipe. Please make sure you have an OpenAI API key set in Account Settings → Apps tab.');
    } finally {
      setIsGenerating(false);
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
      <div>
        <h1 className="text-3xl font-display font-bold text-gray-900">Recipe Generator</h1>
        <p className="text-gray-600 mt-1">Generate AI-powered recipes tailored to your nutrition needs</p>
      </div>

      {/* Generation Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-display">Generate New Recipe</CardTitle>
          <CardDescription>Select a meal type and generate a personalized recipe</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Meal Type
              </label>
              <select
                value={selectedMealType}
                onChange={(e) => setSelectedMealType(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                disabled={isGenerating}
              >
                <option value="breakfast">🍳 Breakfast</option>
                <option value="lunch">🥗 Lunch</option>
                <option value="dinner">🍽️ Dinner</option>
              </select>
            </div>
            <Button
              onClick={generateRecipe}
              disabled={isGenerating}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white whitespace-nowrap"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Recipe
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filter */}
      {recipes.length > 0 && (
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Filter by:</label>
          <select
            value={filterMealType}
            onChange={(e) => setFilterMealType(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">All Meals</option>
            <option value="breakfast">🍳 Breakfast</option>
            <option value="lunch">🥗 Lunch</option>
            <option value="dinner">🍽️ Dinner</option>
          </select>
        </div>
      )}

      {recipes.length === 0 ? (
        <Card className="border-2 border-dashed">
          <CardContent className="text-center py-12">
            <ChefHat className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Recipes Yet</h3>
            <p className="text-gray-600">Use the form above to generate your first AI-powered recipe</p>
          </CardContent>
        </Card>
      ) : (
        <>

          {/* Recipes Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recipes
              .filter(recipe => filterMealType === 'all' || recipe.meal_type === filterMealType)
              .map((recipe) => {
                return (
                  <div key={recipe.id}>
                    <Card className="hover:shadow-lg transition-shadow">
                      {/* Recipe Image */}
                      {recipe.image_base64 && (
                        <div className="relative h-48 overflow-hidden rounded-t-lg">
                          <img
                            src={`data:image/png;base64,${recipe.image_base64}`}
                            alt={recipe.recipe_name}
                            className="w-full h-full object-cover"
                          />
                          <Badge className="absolute top-2 right-2 bg-white text-purple-700 capitalize">
                            {recipe.meal_type === 'breakfast' ? '🍳' : recipe.meal_type === 'lunch' ? '🥗' : '🍽️'} {recipe.meal_type}
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
