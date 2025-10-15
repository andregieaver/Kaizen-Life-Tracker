import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Plus, Save, Trash2, Calendar, Check, X, ChefHat } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const MEALS = ['breakfast', 'lunch', 'dinner'];

const WeeklyMenuBuilder = ({ athleteId }) => {
  const [menus, setMenus] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingMenu, setEditingMenu] = useState(null);
  const [menuName, setMenuName] = useState('');
  const [menuDescription, setMenuDescription] = useState('');
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [showRecipePicker, setShowRecipePicker] = useState(false);

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
      const [menusRes, recipesRes] = await Promise.all([
        axios.get(`${API}/weekly-menus/${athleteId}`, { timeout: 30000 }),
        axios.get(`${API}/recipes/${athleteId}`, { timeout: 30000 })
      ]);
      console.log('[WeeklyMenuBuilder] Data loaded successfully');
      console.log('[WeeklyMenuBuilder] Menus:', menusRes.data.menus?.length || 0);
      console.log('[WeeklyMenuBuilder] Recipes:', recipesRes.data.recipes?.length || 0);
      setMenus(menusRes.data.menus || []);
      setRecipes(recipesRes.data.recipes || []);
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
          recipe_name: recipe.recipe_name
        };
      }
      return meal;
    });

    setEditingMenu({ ...editingMenu, meals: updatedMeals });
    setShowRecipePicker(false);
    setSelectedSlot(null);
  };

  const removeRecipeFromSlot = (day, mealType) => {
    const updatedMeals = editingMenu.meals.map(meal => {
      if (meal.day_of_week === day && meal.meal_type === mealType) {
        return {
          ...meal,
          recipe_id: null,
          recipe_name: null
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
                  <div className="text-sm text-gray-600">
                    {menu.meals.filter(m => m.recipe_id).length} of 21 meals assigned
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
                  }}
                  className="text-gray-600 hover:text-gray-900"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="p-6">
              {recipesByMealType[selectedSlot.mealType].length === 0 ? (
                <div className="text-center py-12">
                  <ChefHat className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-600">No {selectedSlot.mealType} recipes available</p>
                  <p className="text-sm text-gray-500 mt-2">Generate some recipes first</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {recipesByMealType[selectedSlot.mealType].map(recipe => (
                    <div
                      key={recipe.id}
                      onClick={() => assignRecipe(recipe)}
                      className="border rounded-lg p-4 hover:bg-purple-50 cursor-pointer transition-colors"
                    >
                      <div className="flex gap-4">
                        {recipe.image_base64 && (
                          <img
                            src={`data:image/png;base64,${recipe.image_base64}`}
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
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WeeklyMenuBuilder;
