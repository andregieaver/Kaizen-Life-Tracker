"""
Weekly Menus Routes
Handles weekly meal planning templates for athletes.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
import logging
import uuid
from datetime import datetime, timezone, date, time
from database import db

router = APIRouter(prefix="/weekly-menus", tags=["weekly-menus"])


# Models
class WeeklyMenuMeal(BaseModel):
    """Individual meal slot in a weekly menu"""
    recipe_id: Optional[str] = None
    recipe_name: Optional[str] = None
    nutrition_entry_id: Optional[str] = None
    meal_type: str  # 'breakfast', 'lunch', 'dinner'
    day_of_week: str  # 'monday', 'tuesday', etc.


class WeeklyMenu(BaseModel):
    """Template for weekly meal planning"""
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    athlete_id: str
    menu_name: str
    description: Optional[str] = None
    meals: list[WeeklyMenuMeal]
    is_active: bool = Field(default=False)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None


# Helper functions
def prepare_for_mongo(data):
    """Prepare data for MongoDB storage by converting datetime objects to ISO strings"""
    if isinstance(data, dict):
        for key, value in data.items():
            if isinstance(value, datetime):
                data[key] = value.isoformat()
            elif isinstance(value, date):
                data[key] = value.isoformat()
            elif isinstance(value, time):
                data[key] = value.strftime('%H:%M:%S')
    return data


def parse_from_mongo(item):
    """Parse data from MongoDB, keeping dates as strings for JSON serialization"""
    if isinstance(item.get('time'), str):
        try:
            item['time'] = datetime.strptime(item['time'], '%H:%M:%S').time()
        except (ValueError, TypeError):
            pass
    return item


# Routes
@router.get("/{athlete_id}")
async def get_weekly_menus(athlete_id: str):
    """Get all weekly menus for an athlete"""
    menus = await db.weekly_menus.find(
        {"athlete_id": athlete_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(100).to_list(length=100)
    
    return {"menus": [parse_from_mongo(menu) for menu in menus]}


@router.post("")
async def create_weekly_menu(menu: WeeklyMenu):
    """Create a new weekly menu template"""
    try:
        # If this menu is set as active, deactivate all other menus for this athlete
        if menu.is_active:
            await db.weekly_menus.update_many(
                {"athlete_id": menu.athlete_id, "is_active": True},
                {"$set": {"is_active": False}}
            )
        
        menu_dict = prepare_for_mongo(menu.model_dump())
        await db.weekly_menus.insert_one(menu_dict)
        
        # Fetch the saved menu
        saved_menu = await db.weekly_menus.find_one({"id": menu.id}, {"_id": 0})
        
        return {
            "success": True,
            "menu": parse_from_mongo(saved_menu)
        }
    except Exception as e:
        logging.error(f"Error creating weekly menu: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to create menu: {str(e)}")


@router.put("/{menu_id}")
async def update_weekly_menu(menu_id: str, menu_update: dict):
    """Update a weekly menu template"""
    try:
        # If setting this menu as active, deactivate others
        if menu_update.get('is_active'):
            athlete_id = menu_update.get('athlete_id')
            if athlete_id:
                await db.weekly_menus.update_many(
                    {"athlete_id": athlete_id, "id": {"$ne": menu_id}, "is_active": True},
                    {"$set": {"is_active": False}}
                )
        
        menu_update['updated_at'] = datetime.now(timezone.utc).isoformat()
        
        result = await db.weekly_menus.update_one(
            {"id": menu_id},
            {"$set": menu_update}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Menu not found")
        
        # Fetch updated menu
        updated_menu = await db.weekly_menus.find_one({"id": menu_id}, {"_id": 0})
        
        return {
            "success": True,
            "menu": parse_from_mongo(updated_menu)
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating weekly menu: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to update menu: {str(e)}")


@router.delete("/{menu_id}")
async def delete_weekly_menu(menu_id: str):
    """Delete a weekly menu"""
    result = await db.weekly_menus.delete_one({"id": menu_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Menu not found")
    
    return {"success": True}


@router.get("/{menu_id}/details")
async def get_weekly_menu_details(menu_id: str):
    """Get a weekly menu with full recipe details"""
    menu = await db.weekly_menus.find_one({"id": menu_id}, {"_id": 0})
    
    if not menu:
        raise HTTPException(status_code=404, detail="Menu not found")
    
    # Fetch full recipe details for each meal
    recipe_ids = [meal.get('recipe_id') for meal in menu.get('meals', []) if meal.get('recipe_id')]
    recipes = {}
    
    if recipe_ids:
        recipe_list = await db.recipes.find(
            {"id": {"$in": recipe_ids}},
            {"_id": 0}
        ).limit(100).to_list(length=100)
        
        for recipe in recipe_list:
            recipes[recipe['id']] = parse_from_mongo(recipe)
    
    # Enhance meals with recipe details
    for meal in menu.get('meals', []):
        recipe_id = meal.get('recipe_id')
        if recipe_id and recipe_id in recipes:
            meal['recipe_details'] = recipes[recipe_id]
    
    return {"menu": parse_from_mongo(menu)}
