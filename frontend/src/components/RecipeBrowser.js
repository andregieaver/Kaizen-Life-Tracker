import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Clock, Users, Star, Filter, ChefHat, Flame, Beef, Wheat, Droplet, X } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const RecipeBrowser = ({ athleteId }) => {
  const { t } = useTranslation();
  const [recipes, setRecipes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterMealType, setFilterMealType] = useState('all');
  const [filterRating, setFilterRating] = useState(0);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [adjustedServings, setAdjustedServings] = useState(1);

  useEffect(() => {
    if (athleteId) {
      fetchRecipes();
    } else {
      setIsLoading(false);
    }
  }, [athleteId]);

  const fetchRecipes = async () => {
    if (!athleteId) {
      console.log('[RecipeBrowser] No athleteId provided, setting loading to false');
      setIsLoading(false);
      return;
    }
    
    console.log('[RecipeBrowser] Fetching recipes for athleteId:', athleteId);
    console.log('[RecipeBrowser] API URL:', `${API}/recipes/${athleteId}`);
    
    try {
      setIsLoading(true);
      const response = await axios.get(`${API}/recipes/${athleteId}`, {
        timeout: 30000 // 30 seconds timeout for large response with images
      });
      console.log('[RecipeBrowser] Recipes loaded successfully:', response.data.recipes?.length || 0);
      setRecipes(response.data.recipes || []);
    } catch (error) {
      console.error('[RecipeBrowser] Error loading recipes:', error);
      console.error('[RecipeBrowser] Error details:', error.response || error.message);
      setRecipes([]);
    } finally {
      console.log('[RecipeBrowser] Setting loading to false');
      setIsLoading(false);
    }
  };

  const rateRecipe = async (recipeId, rating) => {
    try {
      await axios.put(`${API}/recipes/${recipeId}/rating`, { rating });
      setRecipes(recipes.map(r => 
        r.id === recipeId ? { ...r, user_rating: rating } : r
      ));
      if (selectedRecipe && selectedRecipe.id === recipeId) {
        setSelectedRecipe({ ...selectedRecipe, user_rating: rating });
      }
    } catch (error) {
      console.error('Error rating recipe:', error);
    }
  };

  const deleteRecipe = async (recipeId) => {
    if (!window.confirm(t('recipeBrowser.confirmDelete'))) {
      return;
    }

    try {
      await axios.delete(`${API}/recipes/${recipeId}`);
      setRecipes(recipes.filter(r => r.id !== recipeId));
      
      // Close detail modal if the deleted recipe was open
      if (selectedRecipe && selectedRecipe.id === recipeId) {
        setSelectedRecipe(null);
      }
    } catch (error) {
      console.error('Error deleting recipe:', error);
      alert(t('recipeBrowser.failedToDelete'));
    }
  };

  const openRecipeDetail = (recipe) => {
    setSelectedRecipe(recipe);
    setAdjustedServings(recipe.servings);
  };

  const closeRecipeDetail = () => {
    setSelectedRecipe(null);
  };

  const scaleIngredient = (ingredient, originalServings, newServings) => {
    const scaleFactor = newServings / originalServings;
    const numberPattern = /(\d+\/\d+|\d+\.\d+|\d+)/g;
    
    return ingredient.replace(numberPattern, (match) => {
      let num;
      if (match.includes('/')) {
        const [numerator, denominator] = match.split('/').map(Number);
        num = numerator / denominator;
      } else {
        num = parseFloat(match);
      }
      
      const scaled = num * scaleFactor;
      
      if (scaled === Math.floor(scaled)) {
        return scaled.toString();
      } else if (scaled < 1) {
        const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
        const denominator = 4;
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

  const filteredRecipes = recipes
    .filter(recipe => filterMealType === 'all' || recipe.meal_type === filterMealType)
    .filter(recipe => filterRating === 0 || (recipe.user_rating || 0) >= filterRating);

  const recipesByMealType = {
    breakfast: filteredRecipes.filter(r => r.meal_type === 'breakfast'),
    lunch: filteredRecipes.filter(r => r.meal_type === 'lunch'),
    dinner: filteredRecipes.filter(r => r.meal_type === 'dinner')
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('recipeBrowser.loadingRecipes')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display font-bold text-gray-900">{t('recipeBrowser.title')}</h1>
        <p className="text-gray-600 mt-1">{t('recipeBrowser.subtitle')}</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Filter className="w-4 h-4 inline mr-1" />
                {t('recipeBrowser.mealType')}
              </label>
              <select
                value={filterMealType}
                onChange={(e) => setFilterMealType(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">{t('recipes.allMeals')}</option>
                <option value="breakfast">{t('recipes.mealTypes.breakfast')}</option>
                <option value="lunch">{t('recipes.mealTypes.lunch')}</option>
                <option value="dinner">{t('recipes.mealTypes.dinner')}</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Star className="w-4 h-4 inline mr-1" />
                {t('recipeBrowser.minimumRating')}
              </label>
              <select
                value={filterRating}
                onChange={(e) => setFilterRating(parseInt(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="0">{t('recipeBrowser.allRatings')}</option>
                <option value="1">⭐ {t('recipeBrowser.starsPlus', { count: 1 })}</option>
                <option value="2">⭐⭐ {t('recipeBrowser.starsPlus', { count: 2 })}</option>
                <option value="3">⭐⭐⭐ {t('recipeBrowser.starsPlus', { count: 3 })}</option>
                <option value="4">⭐⭐⭐⭐ {t('recipeBrowser.starsPlus', { count: 4 })}</option>
                <option value="5">⭐⭐⭐⭐⭐ {t('recipeBrowser.starsPlus', { count: 5 })}</option>
              </select>
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-600">
            {t('recipeBrowser.showingRecipes', { filtered: filteredRecipes.length, total: recipes.length })}
          </div>
        </CardContent>
      </Card>

      {filteredRecipes.length === 0 ? (
        <Card className="border-2 border-dashed">
          <CardContent className="text-center py-12">
            <ChefHat className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">{t('recipeBrowser.noRecipesFound')}</h3>
            <p className="text-gray-600">{t('recipeBrowser.adjustFilters')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* Breakfast Section */}
          {recipesByMealType.breakfast.length > 0 && (
            <div>
              <h2 className="text-2xl font-display font-bold text-gray-900 mb-4 flex items-center gap-2">
                {t('recipes.mealTypes.breakfast')}
                <Badge variant="secondary">{recipesByMealType.breakfast.length}</Badge>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {recipesByMealType.breakfast.map((recipe) => (
                  <RecipeCard key={recipe.id} recipe={recipe} onView={openRecipeDetail} onRate={rateRecipe} onDelete={deleteRecipe} />
                ))}
              </div>
            </div>
          )}

          {/* Lunch Section */}
          {recipesByMealType.lunch.length > 0 && (
            <div>
              <h2 className="text-2xl font-display font-bold text-gray-900 mb-4 flex items-center gap-2">
                🥗 Lunch
                <Badge variant="secondary">{recipesByMealType.lunch.length}</Badge>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {recipesByMealType.lunch.map((recipe) => (
                  <RecipeCard key={recipe.id} recipe={recipe} onView={openRecipeDetail} onRate={rateRecipe} onDelete={deleteRecipe} />
                ))}
              </div>
            </div>
          )}

          {/* Dinner Section */}
          {recipesByMealType.dinner.length > 0 && (
            <div>
              <h2 className="text-2xl font-display font-bold text-gray-900 mb-4 flex items-center gap-2">
                🍽️ Dinner
                <Badge variant="secondary">{recipesByMealType.dinner.length}</Badge>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {recipesByMealType.dinner.map((recipe) => (
                  <RecipeCard key={recipe.id} recipe={recipe} onView={openRecipeDetail} onRate={rateRecipe} onDelete={deleteRecipe} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recipe Detail Modal (reuse from Recipes.js) */}
      {selectedRecipe && (
        <RecipeDetailModal
          recipe={selectedRecipe}
          adjustedServings={adjustedServings}
          setAdjustedServings={setAdjustedServings}
          getScaledIngredients={getScaledIngredients}
          getScaledNutrition={getScaledNutrition}
          rateRecipe={rateRecipe}
          onDelete={deleteRecipe}
          onClose={closeRecipeDetail}
        />
      )}
    </div>
  );
};

// Recipe Card Component
const RecipeCard = ({ recipe, onView, onRate, onDelete }) => (
  <Card className="hover:shadow-lg transition-shadow">
    {recipe.image_base64 && (
      <div className="relative h-48 overflow-hidden rounded-t-lg">
        <img
          src={`data:image/jpeg;base64,${recipe.image_base64}`}
          alt={recipe.recipe_name}
          className="w-full h-full object-cover"
        />
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
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="bg-blue-50 p-2 rounded">
          <p className="text-xs text-gray-600">Calories</p>
          <p className="font-semibold">{recipe.nutrition_info.calories}</p>
        </div>
        <div className="bg-green-50 p-2 rounded">
          <p className="text-xs text-gray-600">Protein</p>
          <p className="font-semibold">{recipe.nutrition_info.protein}g</p>
        </div>
      </div>
      <div className="flex items-center justify-between pt-2 border-t">
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map(star => (
            <button
              key={star}
              onClick={() => onRate(recipe.id, star)}
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
            onClick={() => onView(recipe)}
            className="text-purple-600 hover:text-purple-700"
          >
            View Recipe
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(recipe.id);
            }}
            className="text-red-600 hover:text-red-700"
          >
            Delete
          </Button>
        </div>
      </div>
    </CardContent>
  </Card>
);

// Recipe Detail Modal Component
const RecipeDetailModal = ({ recipe, adjustedServings, setAdjustedServings, getScaledIngredients, getScaledNutrition, rateRecipe, onDelete, onClose }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto">
    <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
      {recipe.image_base64 && (
        <div className="relative h-64 md:h-80 overflow-hidden">
          <img
            src={`data:image/jpeg;base64,${recipe.image_base64}`}
            alt={recipe.recipe_name}
            className="w-full h-full object-cover"
          />
          <button
            onClick={onClose}
            className="absolute top-4 right-4 bg-white rounded-full p-2 shadow-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      )}
      <div className="p-6 md:p-8 space-y-6">
        <h2 className="text-3xl md:text-4xl font-display font-bold text-gray-900">
          {recipe.recipe_name}
        </h2>
        
        {/* Servings Adjuster */}
        <div className="bg-purple-50 rounded-lg p-6 border-2 border-purple-200">
          <div className="flex items-center justify-between mb-4">
            <label className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-600" />
              Servings
            </label>
            <span className="text-2xl font-bold text-purple-600">{adjustedServings}</span>
          </div>
          <input
            type="range"
            min="1"
            max="12"
            value={adjustedServings}
            onChange={(e) => setAdjustedServings(parseInt(e.target.value))}
            className="w-full h-2 bg-purple-200 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, rgb(147 51 234) 0%, rgb(147 51 234) ${((adjustedServings - 1) / 11) * 100}%, rgb(233 213 255) ${((adjustedServings - 1) / 11) * 100}%, rgb(233 213 255) 100%)`
            }}
          />
        </div>

        {/* Nutrition */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
            <div className="flex items-center gap-2 mb-2">
              <Flame className="w-5 h-5 text-orange-600" />
              <p className="text-sm font-medium text-gray-600">Calories</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{getScaledNutrition().calories}</p>
          </div>
          <div className="bg-red-50 p-4 rounded-lg border border-red-200">
            <div className="flex items-center gap-2 mb-2">
              <Beef className="w-5 h-5 text-red-600" />
              <p className="text-sm font-medium text-gray-600">Protein</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{getScaledNutrition().protein}g</p>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
            <div className="flex items-center gap-2 mb-2">
              <Wheat className="w-5 h-5 text-yellow-600" />
              <p className="text-sm font-medium text-gray-600">Carbs</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{getScaledNutrition().carbs}g</p>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <Droplet className="w-5 h-5 text-blue-600" />
              <p className="text-sm font-medium text-gray-600">Fat</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{getScaledNutrition().fat}g</p>
          </div>
        </div>

        {/* Ingredients */}
        <div>
          <h3 className="text-2xl font-display font-bold text-gray-900 mb-4">Ingredients</h3>
          <div className="bg-gray-50 rounded-lg p-6">
            <ul className="space-y-3">
              {getScaledIngredients().map((ingredient, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span className="w-6 h-6 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0">
                    {index + 1}
                  </span>
                  <span className="text-gray-700">{ingredient}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Instructions */}
        <div>
          <h3 className="text-2xl font-display font-bold text-gray-900 mb-4">Instructions</h3>
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-6 border border-purple-200">
            <p className="text-gray-700 whitespace-pre-line">{recipe.instructions}</p>
          </div>
        </div>

        {/* Rating and Actions */}
        <div className="flex items-center justify-between pt-6 border-t">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(star => (
              <button
                key={star}
                onClick={() => rateRecipe(recipe.id, star)}
                className="focus:outline-none"
              >
                <Star
                  className={`w-7 h-7 ${
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
              onClick={() => {
                onDelete(recipe.id);
                onClose();
              }} 
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete Recipe
            </Button>
            <Button onClick={onClose} className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white">
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default RecipeBrowser;
