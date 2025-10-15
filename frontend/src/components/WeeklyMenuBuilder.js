import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Plus, Save, Trash2, Calendar, Check, X, ChefHat, Star, Clock, Users } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const MEALS = ['breakfast', 'lunch', 'dinner'];

const WeeklyMenuBuilder = ({ athleteId }) => {
  const [menus, setMenus] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [nutritionEntries, setNutritionEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingMenu, setEditingMenu] = useState(null);
  const [menuName, setMenuName] = useState('');
  const [menuDescription, setMenuDescription] = useState('');
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [showRecipePicker, setShowRecipePicker] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [adjustedServings, setAdjustedServings] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (athleteId) {
      fetchData();
    } else {
      setIsLoading(false);
    }
  }, [athleteId]);

  const fetchData = async () => {
    if (!athleteId) {
      console.log('[WeeklyMenuBuilder] No athleteId provided, setting loading to false');
      setIsLoading(false);
      return;
    }
    
    console.log('[WeeklyMenuBuilder] Fetching data for athleteId:', athleteId);
    
    try {
      setIsLoading(true);
      const [menusRes, recipesRes, nutritionRes] = await Promise.all([
        axios.get(`${API}/weekly-menus/${athleteId}`, { timeout: 30000 }),
        axios.get(`${API}/recipes/${athleteId}`, { timeout: 30000 }),
        axios.get(`${API}/nutrition/${athleteId}`, { timeout: 30000 })
      ]);
      console.log('[WeeklyMenuBuilder] Data loaded successfully');
      console.log('[WeeklyMenuBuilder] Menus:', menusRes.data.menus?.length || 0);
      console.log('[WeeklyMenuBuilder] Recipes:', recipesRes.data.recipes?.length || 0);
      console.log('[WeeklyMenuBuilder] Nutrition Entries:', nutritionRes.data.entries?.length || 0);
      
      const loadedRecipes = recipesRes.data.recipes || [];
      const loadedNutrition = nutritionRes.data.entries || [];
      
      console.log('[WeeklyMenuBuilder] Setting state with:', {
        menus: menusRes.data.menus?.length || 0,
        recipes: loadedRecipes.length,
        nutrition: loadedNutrition.length
      });
      
      setMenus(menusRes.data.menus || []);
      setRecipes(loadedRecipes);
      setNutritionEntries(loadedNutrition);
      
      console.log('[WeeklyMenuBuilder] State set complete');
    } catch (error) {
      console.error('[WeeklyMenuBuilder] Error loading data:', error);
      console.error('[WeeklyMenuBuilder] Error details:', error.response || error.message);
    } finally {
      console.log('[WeeklyMenuBuilder] Setting loading to false');
      setIsLoading(false);
    }
  };

  const createNewMenu = () => {
    // Initialize empty menu with 21 slots (7 days × 3 meals)
    const emptyMeals = [];
    DAYS.forEach(day => {
      MEALS.forEach(meal => {
        emptyMeals.push({
          day_of_week: day,
          meal_type: meal,
          recipe_id: null,
          recipe_name: null
        });
      });
    });

    setEditingMenu({
      id: null,
      athlete_id: athleteId,
      menu_name: '',
      description: '',
      meals: emptyMeals,
      is_active: false
    });
    setMenuName('');
    setMenuDescription('');
  };

  const saveMenu = async () => {
    if (!menuName.trim()) {
      alert('Please enter a menu name');
      return;
    }

    try {
      const menuData = {
        athlete_id: athleteId,
        menu_name: menuName,
        description: menuDescription,
        meals: editingMenu.meals,
        is_active: editingMenu.is_active || false
      };

      if (editingMenu.id) {
        // Update existing menu - include id
        menuData.id = editingMenu.id;
        await axios.put(`${API}/weekly-menus/${editingMenu.id}`, menuData);
      } else {
        // Create new menu - don't include id, backend will generate it
        await axios.post(`${API}/weekly-menus`, menuData);
      }

      await fetchData();
      setEditingMenu(null);
      setMenuName('');
      setMenuDescription('');
    } catch (error) {
      console.error('Error saving menu:', error);
      console.error('Error details:', error.response?.data || error.message);
      alert(`Failed to save menu: ${error.response?.data?.detail || error.message}`);
    }
  };

  const deleteMenu = async (menuId) => {
    if (!window.confirm('Are you sure you want to delete this menu?')) return;

    try {
      await axios.delete(`${API}/weekly-menus/${menuId}`);
      await fetchData();
    } catch (error) {
      console.error('Error deleting menu:', error);
    }
  };

  const setActiveMenu = async (menuId) => {
    try {
      await axios.put(`${API}/weekly-menus/${menuId}`, { 
        athlete_id: athleteId,
        is_active: true 
      });
      await fetchData();
    } catch (error) {
      console.error('Error setting active menu:', error);
    }
  };

  const editMenu = (menu) => {
    setEditingMenu(menu);
    setMenuName(menu.menu_name);
    setMenuDescription(menu.description || '');
  };

  const selectRecipeForSlot = (day, mealType) => {
    setSelectedSlot({ day, mealType });
    setShowRecipePicker(true);
  };

  const assignRecipe = (recipe) => {
    if (!selectedSlot || !editingMenu) return;

    const updatedMeals = editingMenu.meals.map(meal => {
      if (meal.day_of_week === selectedSlot.day && meal.meal_type === selectedSlot.mealType) {
        return {
          ...meal,
          recipe_id: recipe.id,
          recipe_name: recipe.recipe_name,
          nutrition_entry_id: null  // Clear nutrition entry if assigning recipe
        };
      }
      return meal;
    });

    setEditingMenu({ ...editingMenu, meals: updatedMeals });
    setShowRecipePicker(false);
    setSelectedSlot(null);
    setSearchTerm('');
  };

  const assignNutritionEntry = (entry) => {
    if (!selectedSlot || !editingMenu) return;

    const updatedMeals = editingMenu.meals.map(meal => {
      if (meal.day_of_week === selectedSlot.day && meal.meal_type === selectedSlot.mealType) {
        return {
          ...meal,
          nutrition_entry_id: entry.id,
          recipe_name: entry.description || 'Nutrition Entry',
          recipe_id: null  // Clear recipe if assigning nutrition entry
        };
      }
      return meal;
    });

    setEditingMenu({ ...editingMenu, meals: updatedMeals });
    setShowRecipePicker(false);
    setSelectedSlot(null);
    setSearchTerm('');
  };

  const removeRecipeFromSlot = (day, mealType) => {
    const updatedMeals = editingMenu.meals.map(meal => {
      if (meal.day_of_week === day && meal.meal_type === mealType) {
        return {
          ...meal,
          recipe_id: null,
          recipe_name: null,
          nutrition_entry_id: null
        };
      }
      return meal;
    });

    setEditingMenu({ ...editingMenu, meals: updatedMeals });
  };

  const getMealForSlot = (day, mealType) => {
    if (!editingMenu) return null;
    return editingMenu.meals.find(m => m.day_of_week === day && m.meal_type === mealType);
  };

  const recipesByMealType = {
    breakfast: recipes.filter(r => r.meal_type === 'breakfast'),
    lunch: recipes.filter(r => r.meal_type === 'lunch'),
    dinner: recipes.filter(r => r.meal_type === 'dinner')
  };

  const openRecipeDetail = (recipe) => {
    setSelectedRecipe(recipe);
    setAdjustedServings(recipe.servings);
  };

  const closeRecipeDetail = () => {
    setSelectedRecipe(null);
  };

  const getScaledIngredients = () => {
    if (!selectedRecipe) return [];
    const scale = adjustedServings / selectedRecipe.servings;
    return selectedRecipe.ingredients.map(ingredient => {
      const match = ingredient.match(/^([\d./]+)\s*(.+)/);
      if (match) {
        const amount = eval(match[1]) * scale;
        return `${amount.toFixed(1)} ${match[2]}`;
      }
      return ingredient;
    });
  };

  const getScaledNutrition = () => {
    if (!selectedRecipe) return {};
    const scale = adjustedServings / selectedRecipe.servings;
    return {
      calories: Math.round(selectedRecipe.nutrition_info.calories * scale),
      protein: Math.round(selectedRecipe.nutrition_info.protein * scale),
      carbs: Math.round(selectedRecipe.nutrition_info.carbs * scale),
      fat: Math.round(selectedRecipe.nutrition_info.fat * scale)
    };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading menus...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-gray-900">Weekly Menu Builder</h1>
          <p className="text-gray-600 mt-1">Create and manage weekly meal plan templates</p>
        </div>
        {!editingMenu && (
          <Button
            onClick={createNewMenu}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Menu
          </Button>
        )}
      </div>

      {editingMenu ? (
        <div className="space-y-6">
          {/* Menu Details */}
          <Card>
            <CardHeader>
              <CardTitle>Menu Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Menu Name *
                </label>
                <input
                  type="text"
                  value={menuName}
                  onChange={(e) => setMenuName(e.target.value)}
                  placeholder="e.g., High Protein Week, Recovery Week"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={menuDescription}
                  onChange={(e) => setMenuDescription(e.target.value)}
                  placeholder="Optional description..."
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div className="flex gap-3">
                <Button onClick={saveMenu} className="bg-green-600 hover:bg-green-700 text-white">
                  <Save className="w-4 h-4 mr-2" />
                  Save Menu
                </Button>
                <Button
                  onClick={() => {
                    setEditingMenu(null);
                    setMenuName('');
                    setMenuDescription('');
                  }}
                  variant="outline"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Weekly Grid */}
          <Card>
            <CardHeader>
              <CardTitle>Weekly Meal Plan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="p-3 text-left font-semibold text-gray-700 border">Day</th>
                      <th className="p-3 text-left font-semibold text-gray-700 border">🍳 Breakfast</th>
                      <th className="p-3 text-left font-semibold text-gray-700 border">🥗 Lunch</th>
                      <th className="p-3 text-left font-semibold text-gray-700 border">🍽️ Dinner</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DAYS.map(day => (
                      <tr key={day} className="hover:bg-gray-50">
                        <td className="p-3 border font-medium capitalize text-gray-900">
                          {day}
                        </td>
                        {MEALS.map(meal => {
                          const mealData = getMealForSlot(day, meal);
                          return (
                            <td key={meal} className="p-3 border">
                              {mealData?.recipe_name ? (
                                <div className="flex items-center justify-between gap-2 bg-purple-50 p-2 rounded">
                                  <span className="text-sm text-gray-900 flex-1">
                                    {mealData.recipe_name}
                                  </span>
                                  <button
                                    onClick={() => removeRecipeFromSlot(day, meal)}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => selectRecipeForSlot(day, meal)}
                                  className="w-full px-3 py-2 text-sm text-purple-600 hover:bg-purple-50 rounded border-2 border-dashed border-purple-300 hover:border-purple-500 transition-colors"
                                >
                                  <Plus className="w-4 h-4 mx-auto" />
                                </button>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        /* Menu List */
        <div className="space-y-4">
          {menus.length === 0 ? (
            <Card className="border-2 border-dashed">
              <CardContent className="text-center py-12">
                <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Menus Yet</h3>
                <p className="text-gray-600 mb-4">Create your first weekly menu template</p>
                <Button
                  onClick={createNewMenu}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Menu
                </Button>
              </CardContent>
            </Card>
          ) : (
            menus.map(menu => (
              <Card key={menu.id} className={menu.is_active ? 'border-2 border-green-500' : ''}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <CardTitle>{menu.menu_name}</CardTitle>
                        {menu.is_active && (
                          <Badge className="bg-green-600">
                            <Check className="w-3 h-3 mr-1" />
                            Active
                          </Badge>
                        )}
                      </div>
                      {menu.description && (
                        <p className="text-sm text-gray-600 mt-1">{menu.description}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {!menu.is_active && (
                        <Button
                          size="sm"
                          onClick={() => setActiveMenu(menu.id)}
                          variant="outline"
                          className="text-green-600 hover:text-green-700"
                        >
                          <Check className="w-4 h-4 mr-1" />
                          Set Active
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={() => editMenu(menu)}
                        variant="outline"
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => deleteMenu(menu.id)}
                        variant="outline"
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-sm text-gray-600 mb-4">
                      {menu.meals.filter(m => m.recipe_id || m.nutrition_entry_id).length} of 21 meals assigned
                    </div>

                    {/* Weekly Overview */}
                    <div className="space-y-3">
                      {DAYS.map(day => {
                        const dayMeals = menu.meals.filter(m => m.day_of_week === day && (m.recipe_id || m.nutrition_entry_id));
                        if (dayMeals.length === 0) return null;

                        // Calculate daily nutrition totals from both recipes and nutrition entries
                        const dailyNutrition = dayMeals.reduce((acc, meal) => {
                          if (meal.recipe_id) {
                            const recipe = recipes.find(r => r.id === meal.recipe_id);
                            if (recipe && recipe.nutrition_info) {
                              acc.calories += recipe.nutrition_info.calories || 0;
                              acc.protein += recipe.nutrition_info.protein || 0;
                              acc.carbs += recipe.nutrition_info.carbs || 0;
                              acc.fat += recipe.nutrition_info.fat || 0;
                            }
                          } else if (meal.nutrition_entry_id) {
                            const entry = nutritionEntries.find(e => e.id === meal.nutrition_entry_id);
                            if (entry) {
                              acc.calories += entry.calories || 0;
                              acc.protein += entry.protein || 0;
                              acc.carbs += entry.carbs || 0;
                              acc.fat += entry.fat || 0;
                            }
                          }
                          return acc;
                        }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

                        return (
                          <div key={day} className="border rounded-lg p-4 bg-gray-50">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-semibold text-gray-900 capitalize text-lg">{day}</h4>
                              <div className="flex gap-3 text-xs text-gray-600">
                                <span className="bg-blue-100 px-2 py-1 rounded">{Math.round(dailyNutrition.calories)} cal</span>
                                <span className="bg-green-100 px-2 py-1 rounded">{Math.round(dailyNutrition.protein)}g protein</span>
                                <span className="bg-yellow-100 px-2 py-1 rounded">{Math.round(dailyNutrition.carbs)}g carbs</span>
                                <span className="bg-red-100 px-2 py-1 rounded">{Math.round(dailyNutrition.fat)}g fat</span>
                              </div>
                            </div>
                            
                            {/* Three column layout for meals */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              {MEALS.map(mealType => {
                                const meal = dayMeals.find(m => m.meal_type === mealType);
                                if (!meal) return null;
                                
                                const recipe = meal.recipe_id ? recipes.find(r => r.id === meal.recipe_id) : null;
                                const nutritionEntry = meal.nutrition_entry_id ? nutritionEntries.find(e => e.id === meal.nutrition_entry_id) : null;
                                const mealIcon = mealType === 'breakfast' ? '🍳' : mealType === 'lunch' ? '🥗' : '🍽️';
                                
                                // Get nutrition info from either recipe or nutrition entry
                                const nutritionInfo = recipe?.nutrition_info || nutritionEntry;
                                const mealImage = recipe?.image_base64 || nutritionEntry?.image_data;
                                
                                // Get display name from nutrition entry or recipe
                                const mealName = nutritionEntry?.description || meal.recipe_name;
                                
                                return (
                                  <div 
                                    key={mealType} 
                                    onClick={() => recipe && openRecipeDetail(recipe)}
                                    className="bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                                  >
                                    {/* Meal Image */}
                                    {mealImage && (
                                      <div className="h-32 overflow-hidden">
                                        <img
                                          src={`data:image/jpeg;base64,${mealImage}`}
                                          alt={meal.recipe_name}
                                          className="w-full h-full object-cover"
                                        />
                                      </div>
                                    )}
                                    
                                    {/* Meal Info */}
                                    <div className="p-3">
                                      <div className="text-xs font-semibold text-gray-500 uppercase mb-1 flex items-center gap-1">
                                        {mealIcon} {mealType}
                                        {nutritionEntry && <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-xs">Logged</span>}
                                      </div>
                                      <div className="font-medium text-gray-900 text-sm line-clamp-2 mb-2">
                                        {mealName}
                                      </div>
                                      
                                      {/* Individual meal nutrition */}
                                      {nutritionInfo && (
                                        <div className="grid grid-cols-2 gap-1.5 mt-2 text-xs">
                                          <div className="bg-blue-50 px-2 py-1 rounded">
                                            <span className="text-gray-600">{nutritionInfo.calories} cal</span>
                                          </div>
                                          <div className="bg-green-50 px-2 py-1 rounded">
                                            <span className="text-gray-600">{nutritionInfo.protein}g Protein</span>
                                          </div>
                                          <div className="bg-yellow-50 px-2 py-1 rounded">
                                            <span className="text-gray-600">{nutritionInfo.carbs}g Carbs</span>
                                          </div>
                                          <div className="bg-red-50 px-2 py-1 rounded">
                                            <span className="text-gray-600">{nutritionInfo.fat}g Fat</span>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                      {menu.meals.filter(m => m.recipe_id).length === 0 && (
                        <p className="text-sm text-gray-500 italic">No meals assigned yet</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Recipe Picker Modal */}
      {showRecipePicker && selectedSlot && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b sticky top-0 bg-white">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">
                  Select {selectedSlot.mealType} for {selectedSlot.day}
                </h2>
                <button
                  onClick={() => {
                    setShowRecipePicker(false);
                    setSelectedSlot(null);
                    setSearchTerm('');
                  }}
                  className="text-gray-600 hover:text-gray-900"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-6">
              {/* Search Bar */}
              <div className="sticky top-0 bg-white pb-4 border-b">
                <input
                  type="text"
                  placeholder="Search recipes and meals..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                />
              </div>

              {/* AI Generated Recipes Section */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <ChefHat className="w-5 h-5 text-purple-600" />
                  AI Generated Recipes
                </h3>
                {(() => {
                  // Filter recipes by meal type and search term
                  console.log('[Modal] Total recipes available:', recipes.length);
                  console.log('[Modal] Selected meal type:', selectedSlot.mealType);
                  console.log('[Modal] Search term:', searchTerm);
                  
                  const filteredRecipes = recipes.filter(r => {
                    const matchesMealType = r.meal_type === selectedSlot.mealType;
                    const matchesSearch = !searchTerm || 
                      r.recipe_name.toLowerCase().includes(searchTerm.toLowerCase());
                    console.log(`[Modal] Recipe "${r.recipe_name}" (${r.meal_type}): mealType=${matchesMealType}, search=${matchesSearch}`);
                    return matchesMealType && matchesSearch;
                  });
                  
                  console.log('[Modal] Filtered recipes count:', filteredRecipes.length);

                  return filteredRecipes.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 rounded-lg">
                      <p className="text-gray-600">
                        {searchTerm ? 'No recipes match your search' : `No ${selectedSlot.mealType} recipes available`}
                      </p>
                      {!searchTerm && (
                        <p className="text-sm text-gray-500 mt-2">Generate some recipes first</p>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {filteredRecipes.map(recipe => (
                        <div
                          key={recipe.id}
                          onClick={() => assignRecipe(recipe)}
                          className="border rounded-lg p-4 hover:bg-purple-50 cursor-pointer transition-colors"
                        >
                          <div className="flex gap-4">
                            {recipe.image_base64 && (
                              <img
                                src={`data:image/jpeg;base64,${recipe.image_base64}`}
                                alt={recipe.recipe_name}
                                className="w-20 h-20 object-cover rounded"
                              />
                            )}
                            <div className="flex-1">
                              <h3 className="font-semibold text-gray-900">{recipe.recipe_name}</h3>
                              <p className="text-sm text-gray-600">
                                {recipe.prep_time + recipe.cook_time} min • {recipe.nutrition_info.calories} cal
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Nutrition Log Entries Section */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  📊 Nutrition Log Entries
                </h3>
                {(() => {
                  // Filter nutrition entries by search term
                  console.log('[Modal] Total nutrition entries available:', nutritionEntries.length);
                  
                  const filteredEntries = nutritionEntries.filter(entry => {
                    if (!searchTerm) return true;
                    const description = entry.description || '';
                    return description.toLowerCase().includes(searchTerm.toLowerCase());
                  });
                  
                  console.log('[Modal] Filtered nutrition entries count:', filteredEntries.length);

                  return filteredEntries.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 rounded-lg">
                      <p className="text-gray-600">
                        {searchTerm ? 'No nutrition entries match your search' : 'No nutrition entries available'}
                      </p>
                      {!searchTerm && (
                        <p className="text-sm text-gray-500 mt-2">Log some meals in the Nutrition section first</p>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {filteredEntries.map(entry => (
                        <div
                          key={entry.id}
                          onClick={() => assignNutritionEntry(entry)}
                          className="border rounded-lg p-4 hover:bg-blue-50 cursor-pointer transition-colors"
                        >
                          <div className="flex gap-4">
                            {entry.image_data && (
                              <img
                                src={`data:image/jpeg;base64,${entry.image_data}`}
                                alt={entry.description}
                                className="w-20 h-20 object-cover rounded"
                              />
                            )}
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-gray-900">{entry.description || 'Meal Entry'}</h3>
                                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs">Logged</span>
                              </div>
                              <p className="text-sm text-gray-600">
                                {entry.calories} cal • {entry.protein}g protein • {entry.carbs}g carbs • {entry.fat}g fat
                              </p>
                              {entry.date && (
                                <p className="text-xs text-gray-500 mt-1">
                                  {new Date(entry.date).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recipe Detail Modal */}
      {selectedRecipe && (
        <RecipeDetailModal
          recipe={selectedRecipe}
          adjustedServings={adjustedServings}
          setAdjustedServings={setAdjustedServings}
          getScaledIngredients={getScaledIngredients}
          getScaledNutrition={getScaledNutrition}
          onClose={closeRecipeDetail}
        />
      )}
    </div>
  );
};

// Recipe Detail Modal Component (reused from RecipeBrowser)
const RecipeDetailModal = ({ recipe, adjustedServings, setAdjustedServings, getScaledIngredients, getScaledNutrition, onClose }) => {
  return (
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
              className="w-full h-2 bg-purple-200 rounded-lg appearance-none cursor-pointer slider-purple"
            />
          </div>

          {/* Time and Servings Info */}
          <div className="flex gap-4 text-gray-600">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              <span>{recipe.prep_time + recipe.cook_time} minutes</span>
            </div>
          </div>

          {/* Scaled Nutrition */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-600 mb-1">Calories</p>
              <p className="text-2xl font-bold text-gray-900">{getScaledNutrition().calories}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-600 mb-1">Protein</p>
              <p className="text-2xl font-bold text-gray-900">{getScaledNutrition().protein}g</p>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-600 mb-1">Carbs</p>
              <p className="text-2xl font-bold text-gray-900">{getScaledNutrition().carbs}g</p>
            </div>
            <div className="bg-red-50 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-600 mb-1">Fat</p>
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
          {recipe.instructions && Array.isArray(recipe.instructions) && (
            <div>
              <h3 className="text-2xl font-display font-bold text-gray-900 mb-4">Instructions</h3>
              <div className="bg-gray-50 rounded-lg p-6">
                <ol className="space-y-4">
                  {recipe.instructions.map((instruction, index) => (
                    <li key={index} className="flex gap-4">
                      <span className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0">
                        {index + 1}
                      </span>
                      <p className="text-gray-700 pt-1">{instruction}</p>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}

          {/* Close Button */}
          <div className="flex justify-end pt-6 border-t">
            <Button onClick={onClose} className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white">
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeeklyMenuBuilder;
