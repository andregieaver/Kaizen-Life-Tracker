import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Clock, Users, ChefHat, Star, Sparkles, Loader2, X, Flame, Beef, Wheat, Droplet } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Recipes = ({ athleteId }) => {
  const { t } = useTranslation();
  const [recipes, setRecipes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState('breakfast');
  const [filterMealType, setFilterMealType] = useState('all');
  const [statusMessage, setStatusMessage] = useState({ type: '', message: '' });
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [adjustedServings, setAdjustedServings] = useState(1);

  const mealTypes = ['breakfast', 'lunch', 'dinner'];

  useEffect(() => {
    const fetchRecipes = async () => {
      try {
        const response = await axios.get(`${API}/recipes/${athleteId}`, {
          timeout: 30000 // 30 seconds timeout for large response with images
        });
        setRecipes(response.data.recipes || []);
      } catch (error) {
        console.error('Error loading recipes:', error);
        setRecipes([]);
      }
    };
    
    fetchRecipes();
  }, [athleteId]);

  const loadRecipes = async () => {
    try {
      const response = await axios.get(`${API}/recipes/${athleteId}`, {
        timeout: 30000 // 30 seconds timeout for large response with images
      });
      setRecipes(response.data.recipes || []);
    } catch (error) {
      console.error('Error loading recipes:', error);
      setRecipes([]);
    }
  };

  const generateRecipe = async () => {
    setIsGenerating(true);
    setStatusMessage({ type: 'info', message: t('recipes.generatingMessage', { mealType: selectedMealType }) });
    
    try {
      console.log('[RECIPE] Starting generation for:', selectedMealType);
      
      const response = await axios.post(`${API}/recipes/generate/${athleteId}`, {
        meal_type: selectedMealType
      });
      
      console.log('[RECIPE] Success! Generated recipe:', response.data);
      setStatusMessage({ type: 'success', message: t('recipes.recipeGenerated', { name: response.data.recipe_name || 'Success' }) });
      
      // Add the new recipe to the list
      if (response.data.recipe) {
        setRecipes([response.data.recipe, ...recipes]);
      }
      
      // Clear success message after 5 seconds
      setTimeout(() => setStatusMessage({ type: '', message: '' }), 5000);
    } catch (error) {
      console.error('[RECIPE] Error generating recipe:', error);
      
      // Show detailed error to user
      const errorDetail = error.response?.data?.detail || error.message || 'Unknown error';
      const errorStatus = error.response?.status || 'N/A';
      
      setStatusMessage({ 
        type: 'error', 
        message: t('recipes.generationFailed', { status: errorStatus, detail: errorDetail })
      });
      
      // Log full error details
      console.error('[RECIPE] Full error object:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
        config: error.config
      });
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
    if (!window.confirm(t('recipes.confirmDeleteRecipe'))) return;
    
    try {
      await axios.delete(`${API}/recipes/${recipeId}`);
      setRecipes(recipes.filter(r => r.id !== recipeId));
    } catch (error) {
      console.error('Error deleting recipe:', error);
    }
  };

  const openRecipeDetail = (recipe) => {
    setSelectedRecipe(recipe);
    setAdjustedServings(recipe.servings);
  };

  const closeRecipeDetail = () => {
    setSelectedRecipe(null);
    setAdjustedServings(1);
  };

  // Scale ingredients based on servings
  const scaleIngredient = (ingredient, originalServings, newServings) => {
    const scaleFactor = newServings / originalServings;
    
    // Match numbers (including fractions and decimals) in the ingredient string
    const numberPattern = /(\d+\/\d+|\d+\.\d+|\d+)/g;
    
    return ingredient.replace(numberPattern, (match) => {
      let num;
      
      // Handle fractions (e.g., "1/2")
      if (match.includes('/')) {
        const [numerator, denominator] = match.split('/').map(Number);
        num = numerator / denominator;
      } else {
        num = parseFloat(match);
      }
      
      const scaled = num * scaleFactor;
      
      // Format the result nicely
      if (scaled === Math.floor(scaled)) {
        return scaled.toString();
      } else if (scaled < 1) {
        // Convert to fraction for small amounts
        const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
        const denominator = 4; // Use quarters for simplicity
        const numerator = Math.round(scaled * denominator);
        const divisor = gcd(numerator, denominator);
        if (numerator === denominator) return '1';
        return `${numerator / divisor}/${denominator / divisor}`;
      } else {
        return scaled.toFixed(1).replace('.0', '');
      }
    });
  };

  const getScaledIngredients = () => {
    if (!selectedRecipe) return [];
    return selectedRecipe.ingredients.map(ing => 
      scaleIngredient(ing, selectedRecipe.servings, adjustedServings)
    );
  };

  const getScaledNutrition = () => {
    if (!selectedRecipe) return {};
    const scaleFactor = adjustedServings / selectedRecipe.servings;
    return {
      calories: Math.round(selectedRecipe.nutrition_info.calories * scaleFactor),
      protein: Math.round(selectedRecipe.nutrition_info.protein * scaleFactor),
      carbs: Math.round(selectedRecipe.nutrition_info.carbs * scaleFactor),
      fat: Math.round(selectedRecipe.nutrition_info.fat * scaleFactor),
    };
  };

  return (
    <div className="min-h-screen p-2 md:p-6 space-y-6" style={{ background: 'var(--grad-page)' }}>
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display font-bold text-white">{t('recipes.title')}</h1>
        <p className="text-gray-300 mt-1">{t('recipes.subtitle')}</p>
      </div>

      {/* Status Message */}
      {statusMessage.message && (
        <div className={`p-4 rounded-lg flex items-start gap-3 ${
          statusMessage.type === 'success' ? 'bg-green-900/30 text-green-200 border border-green-700' :
          statusMessage.type === 'error' ? 'bg-red-900/30 text-red-200 border border-red-700' :
          'bg-blue-900/30 text-blue-200 border border-blue-700'
        }`}>
          {statusMessage.type === 'error' && <X className="w-5 h-5 flex-shrink-0 mt-0.5" />}
          <span className="flex-1">{statusMessage.message}</span>
        </div>
      )}

      {/* Generation Form */}
      <div className="border-0 shadow-lg overflow-hidden rounded-none md:rounded-3xl" style={{ background: 'var(--grad-surface)' }}>
        <div className="p-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-hi)' }}>{t('recipes.generateNew')}</h3>
          <p className="text-sm mt-1" style={{ color: 'var(--text-med)' }}>{t('recipes.selectMealType')}</p>
        </div>
        <div className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-hi)' }}>
                {t('recipes.mealType')}
              </label>
              <select
                value={selectedMealType}
                onChange={(e) => setSelectedMealType(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-600 text-white rounded-lg focus:ring-2 focus:border-transparent"
                style={{ focusRingColor: '#00C2A8' }}
                disabled={isGenerating}
              >
                <option value="breakfast">{t('recipes.mealTypes.breakfast')}</option>
                <option value="lunch">{t('recipes.mealTypes.lunch')}</option>
                <option value="dinner">{t('recipes.mealTypes.dinner')}</option>
              </select>
            </div>
            <Button
              onClick={generateRecipe}
              disabled={isGenerating}
              className="text-white border-0 whitespace-nowrap h-[42px] sm:h-auto px-6 py-2.5"
              style={{ backgroundColor: '#00C2A8' }}
              onMouseEnter={(e) => !isGenerating && (e.currentTarget.style.backgroundColor = '#009688')}
              onMouseLeave={(e) => !isGenerating && (e.currentTarget.style.backgroundColor = '#00C2A8')}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  <span className="hidden sm:inline">{t('recipes.generating')}</span>
                  <span className="sm:hidden">...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">{t('recipes.generateRecipe')}</span>
                  <span className="sm:hidden">{t('common.create')}</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Filter */}
      {recipes.length > 0 && (
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-300">{t('recipes.filterBy')}</label>
          <select
            value={filterMealType}
            onChange={(e) => setFilterMealType(e.target.value)}
            className="px-4 py-2 bg-gray-800 border border-gray-600 text-white rounded-lg focus:ring-2"
            style={{ focusRingColor: '#00C2A8' }}
          >
            <option value="all">{t('recipes.allMeals')}</option>
            <option value="breakfast">{t('recipes.mealTypes.breakfast')}</option>
            <option value="lunch">{t('recipes.mealTypes.lunch')}</option>
            <option value="dinner">{t('recipes.mealTypes.dinner')}</option>
          </select>
        </div>
      )}

      {recipes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <ChefHat className="w-16 h-16 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-200 mb-2">{t('recipes.noRecipesYet')}</h3>
          <p className="text-gray-400 text-center">
            {t('recipes.useFormAbove')}
          </p>
        </div>
      ) : (
        <>

          {/* Recipes Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recipes
              .filter(recipe => filterMealType === 'all' || recipe.meal_type === filterMealType)
              .map((recipe) => {
                return (
                  <div key={recipe.id}>
                    <div className="hover:shadow-lg transition-shadow border-0 shadow-lg overflow-hidden rounded-none md:rounded-3xl" style={{ background: 'var(--grad-surface)' }}>
                      {/* Recipe Image */}
                      {recipe.image_base64 && (
                        <div className="relative h-48 overflow-hidden">
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

                      <div className="p-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
                        <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-hi)' }}>{recipe.recipe_name}</h3>
                        <div className="flex items-center gap-4 text-sm" style={{ color: 'var(--text-muted)' }}>
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {recipe.prep_time + recipe.cook_time} {t('recipes.minutes')}
                          </div>
                          <div className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            {t('recipes.servingsCount', { count: recipe.servings })}
                          </div>
                        </div>
                      </div>

                      <div className="p-4 space-y-4">
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

                        {/* Rating and Actions */}
                        <div className="flex items-center justify-between pt-2" style={{ borderTop: '1px solid var(--border)' }}>
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
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openRecipeDetail(recipe)}
                              className="text-purple-600 hover:text-purple-700"
                            >
                              {t('recipes.viewRecipe')}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteRecipe(recipe.id);
                              }}
                              className="text-red-600 hover:text-red-700"
                            >
                              {t('common.delete')}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </>
      )}

      {/* Recipe Detail Modal */}
      {selectedRecipe && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Header with Image */}
            <div className="relative">
              {selectedRecipe.image_base64 && (
                <div className="h-64 md:h-80 overflow-hidden">
                  <img
                    src={`data:image/jpeg;base64,${selectedRecipe.image_base64}`}
                    alt={selectedRecipe.recipe_name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <button
                onClick={closeRecipeDetail}
                className="absolute top-4 right-4 bg-white rounded-full p-2 shadow-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
              <Badge className="absolute bottom-4 left-4 bg-white text-purple-700 capitalize text-lg py-2 px-4">
                {selectedRecipe.meal_type === 'breakfast' ? '🍳' : selectedRecipe.meal_type === 'lunch' ? '🥗' : '🍽️'} {selectedRecipe.meal_type}
              </Badge>
            </div>

            {/* Content */}
            <div className="p-6 md:p-8 space-y-6">
              {/* Title and Meta Info */}
              <div>
                <h2 className="text-3xl md:text-4xl font-display font-bold text-gray-900 mb-4">
                  {selectedRecipe.recipe_name}
                </h2>
                <div className="flex flex-wrap items-center gap-4 text-gray-600">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    <span><strong>{t('recipes.prep')}:</strong> {selectedRecipe.prep_time} {t('recipes.minutes')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    <span><strong>{t('recipes.cook')}:</strong> {selectedRecipe.cook_time} {t('recipes.minutes')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-purple-600" />
                    <span className="font-semibold text-purple-600">
                      <strong>{t('recipes.total')}:</strong> {selectedRecipe.prep_time + selectedRecipe.cook_time} {t('recipes.minutes')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Servings Adjuster */}
              <div className="bg-purple-50 rounded-lg p-6 border-2 border-purple-200">
                <div className="flex items-center justify-between mb-4">
                  <label className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Users className="w-5 h-5 text-purple-600" />
                    {t('recipes.servings')}
                  </label>
                  <span className="text-2xl font-bold text-purple-600">{adjustedServings}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="12"
                  value={adjustedServings}
                  onChange={(e) => setAdjustedServings(parseInt(e.target.value))}
                  className="w-full h-2 bg-purple-200 rounded-lg appearance-none cursor-pointer slider"
                  style={{
                    background: `linear-gradient(to right, rgb(147 51 234) 0%, rgb(147 51 234) ${((adjustedServings - 1) / 11) * 100}%, rgb(233 213 255) ${((adjustedServings - 1) / 11) * 100}%, rgb(233 213 255) 100%)`
                  }}
                />
                <div className="flex justify-between text-xs text-gray-600 mt-2">
                  <span>{t('recipes.servingSingular')}</span>
                  <span>{t('recipes.servingsPlural', { count: 12 })}</span>
                </div>
              </div>

              {/* Scaled Nutrition Info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Flame className="w-5 h-5 text-orange-600" />
                    <p className="text-sm font-medium text-gray-600">Calories</p>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{getScaledNutrition().calories}</p>
                  <p className="text-xs text-gray-500 mt-1">{t('recipes.perServing')}</p>
                </div>
                <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Beef className="w-5 h-5 text-red-600" />
                    <p className="text-sm font-medium text-gray-600">{t('nutrition.macros.protein')}</p>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{getScaledNutrition().protein}g</p>
                  <p className="text-xs text-gray-500 mt-1">{t('recipes.perServing')}</p>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Wheat className="w-5 h-5 text-yellow-600" />
                    <p className="text-sm font-medium text-gray-600">{t('nutrition.macros.carbs')}</p>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{getScaledNutrition().carbs}g</p>
                  <p className="text-xs text-gray-500 mt-1">{t('recipes.perServing')}</p>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Droplet className="w-5 h-5 text-blue-600" />
                    <p className="text-sm font-medium text-gray-600">{t('nutrition.macros.fat')}</p>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{getScaledNutrition().fat}g</p>
                  <p className="text-xs text-gray-500 mt-1">{t('recipes.perServing')}</p>
                </div>
              </div>

              {/* Ingredients */}
              <div>
                <h3 className="text-2xl font-display font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <ChefHat className="w-6 h-6 text-purple-600" />
                  {t('recipes.ingredients')}
                </h3>
                <div className="bg-gray-50 rounded-lg p-6">
                  <ul className="space-y-3">
                    {getScaledIngredients().map((ingredient, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <span className="w-6 h-6 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 mt-0.5">
                          {index + 1}
                        </span>
                        <span className="text-gray-700 leading-relaxed">{ingredient}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Instructions */}
              <div>
                <h3 className="text-2xl font-display font-bold text-gray-900 mb-4">
                  Preparation Instructions
                </h3>
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-6 border border-purple-200">
                  <div className="prose prose-lg max-w-none">
                    <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                      {selectedRecipe.instructions}
                    </p>
                  </div>
                </div>
              </div>

              {/* Rating Section */}
              <div className="flex items-center justify-between pt-6 border-t">
                <div>
                  <p className="text-sm text-gray-600 mb-2">Rate this recipe</p>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button
                        key={star}
                        onClick={() => rateRecipe(selectedRecipe.id, star)}
                        className="focus:outline-none hover:scale-110 transition-transform"
                      >
                        <Star
                          className={`w-7 h-7 ${
                            star <= (selectedRecipe.user_rating || 0)
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-gray-300 hover:text-yellow-300'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      deleteRecipe(selectedRecipe.id);
                      closeRecipeDetail();
                    }}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    Delete Recipe
                  </Button>
                  <Button
                    onClick={closeRecipeDetail}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Recipes;
