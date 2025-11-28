"""
Recipes Routes
Handles recipe generation with AI and recipe management for athletes.
Note: Generation endpoint uses OpenAI API key from system settings.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
import logging
import os
import uuid
import json
from datetime import datetime, timezone, timedelta, date, time
from database import db

router = APIRouter(tags=["recipes"])


# Helper functions
def parse_from_mongo(item):
    """Parse data from MongoDB, keeping dates as strings for JSON serialization"""
    if isinstance(item.get('time'), str):
        try:
            item['time'] = datetime.strptime(item['time'], '%H:%M:%S').time()
        except ValueError:
            pass
    return item


# Routes
@router.post("/recipes/generate/{athlete_id}")
async def generate_recipe(athlete_id: str, recipe_request: dict):
    """Generate a single recipe (breakfast, lunch, or dinner) using OpenAI based on athlete's nutrition data"""
    meal_type = recipe_request.get('meal_type')  # 'breakfast', 'lunch', or 'dinner'
    
    if not meal_type or meal_type not in ['breakfast', 'lunch', 'dinner']:
        raise HTTPException(status_code=400, detail="meal_type must be 'breakfast', 'lunch', or 'dinner'")
    
    logging.info(f"[RECIPE] Generating {meal_type} recipe for athlete: {athlete_id}")
    try:
        # Get athlete data
        athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
        if not athlete:
            logging.error(f"[RECIPE] Athlete not found: {athlete_id}")
            raise HTTPException(status_code=404, detail="Athlete not found")
        
        logging.info(f"[RECIPE] Fetching OpenAI key from system settings")
        # Get OpenAI key from system_settings collection
        system_settings = await db.system_settings.find_one(
            {"setting_type": "global"},
            {"_id": 0}
        )
        
        if not system_settings or not system_settings.get('advanced', {}).get('openaiApiKey'):
            logging.error(f"[RECIPE] OpenAI API key not found in system settings")
            raise HTTPException(
                status_code=400, 
                detail="OpenAI API key not found. Please add your OpenAI API key in System Settings → Advanced tab (Super Admin only), then try again."
            )
        
        openai_key = system_settings['advanced']['openaiApiKey']
        logging.info(f"[RECIPE] OpenAI key found, length: {len(openai_key)}")
        
        # Get recent nutrition entries (last 14 days)
        two_weeks_ago = (datetime.now(timezone.utc) - timedelta(days=14)).strftime("%Y-%m-%d")
        nutrition_entries = await db.nutrition_entries.find(
            {"athlete_id": athlete_id, "entry_date": {"$gte": two_weeks_ago}},
            {"_id": 0}
        ).limit(100).to_list(length=100)
        
        # Get supplements
        supplements = await db.supplements.find(
            {"athlete_id": athlete_id},
            {"_id": 0}
        ).limit(100).to_list(length=100)
        
        # Calculate average daily nutrition
        total_cals = sum(n.get('calories', 0) for n in nutrition_entries if n.get('calories'))
        total_protein = sum(n.get('protein', 0) for n in nutrition_entries if n.get('protein'))
        total_carbs = sum(n.get('carbs', 0) for n in nutrition_entries if n.get('carbs'))
        total_fat = sum(n.get('fat', 0) for n in nutrition_entries if n.get('fat'))
        days_tracked = len(set(n.get('entry_date') for n in nutrition_entries if n.get('entry_date'))) or 1
        
        avg_nutrition = {
            "calories": total_cals / days_tracked if days_tracked > 0 else 2000,
            "protein": total_protein / days_tracked if days_tracked > 0 else 150,
            "carbs": total_carbs / days_tracked if days_tracked > 0 else 200,
            "fat": total_fat / days_tracked if days_tracked > 0 else 65
        }
        
        # Get dietary restrictions and preferences
        allergies = athlete.get('allergies', [])
        dietary_prefs = athlete.get('dietary_preferences', [])
        
        # Get measurement preferences
        measurement_system = athlete.get('measurement_system', 'imperial')
        
        # Determine measurement units based on preferences
        if measurement_system == 'metric':
            volume_unit = 'ml or liters'
            weight_example = 'grams or kg'
            temp_unit = 'Celsius'
        else:
            volume_unit = 'cups, tablespoons, or teaspoons'
            weight_example = 'oz or lbs'
            temp_unit = 'Fahrenheit'
        
        # Build context for AI
        context = f"""
        Athlete Profile:
        - Estimated daily calorie need: {athlete.get('estimated_calorie_need', 2000)} calories
        - Current average intake: {avg_nutrition['calories']:.0f} calories
        - Average macros: {avg_nutrition['protein']:.0f}g protein, {avg_nutrition['carbs']:.0f}g carbs, {avg_nutrition['fat']:.0f}g fat
        - Allergies: {', '.join(allergies) if allergies else 'None'}
        - Dietary preferences: {', '.join(dietary_prefs) if dietary_prefs else 'None'}
        - Running goals: {athlete.get('running_goals', 'General fitness')}
        - Supplements: {', '.join([s.get('name', '') for s in supplements[:5]]) if supplements else 'None'}
        - Measurement system: {measurement_system}
        
        Generate a complete 7-day meal plan (breakfast, lunch, dinner for each day).
        Each meal should be athlete-appropriate, balanced, and delicious.
        Target calories per meal: ~{athlete.get('estimated_calorie_need', 2000) / 3:.0f}
        """
        
        prompt = f"""{context}

        Create 1 delicious {meal_type.upper()} recipe formatted as JSON object (not array).
        The recipe must have:
        - recipe_name: string (creative, appetizing name appropriate for {meal_type})
        - ingredients: array of strings with quantities (e.g., "2 cups rice", "1 lb chicken breast")
        - instructions: detailed step-by-step cooking instructions as single string
        - nutrition_info: object with calories, protein, carbs, fat (numbers)
        - prep_time: minutes (number)
        - cook_time: minutes (number)
        - servings: number
        
        CRITICAL MEASUREMENT REQUIREMENTS:
        - Use {measurement_system} measurements ONLY
        - Volume: Use {volume_unit}
        - Weight: Use {weight_example}
        - Temperature: Use {temp_unit}
        - Be specific and consistent with units throughout the recipe
        
        IMPORTANT: Avoid all allergens: {', '.join(allergies) if allergies else 'none'}
        Follow dietary preferences: {', '.join(dietary_prefs) if dietary_prefs else 'balanced diet'}
        
        Return ONLY the JSON object, no markdown formatting.
        """
        
        logging.info(f"[RECIPE] Calling OpenAI API")
        
        # Call OpenAI API
        import requests
        response = requests.post(
            'https://api.openai.com/v1/chat/completions',
            headers={
                'Authorization': f'Bearer {openai_key}',
                'Content-Type': 'application/json'
            },
            json={
                'model': 'gpt-4',
                'messages': [
                    {'role': 'system', 'content': 'You are a nutrition expert and chef. Return only valid JSON, no markdown.'},
                    {'role': 'user', 'content': prompt}
                ],
                'temperature': 0.8
            },
            timeout=60
        )
        
        if response.status_code != 200:
            logging.error(f"[RECIPE] OpenAI API error: {response.status_code} - {response.text}")
            raise HTTPException(status_code=response.status_code, detail=f"OpenAI API error: {response.text}")
        
        result = response.json()
        logging.info(f"[RECIPE] OpenAI response received")
        
        # Parse the recipe from the response
        recipe_text = result['choices'][0]['message']['content'].strip()
        
        # Remove markdown code blocks if present
        if recipe_text.startswith('```'):
            recipe_text = recipe_text.split('```')[1]
            if recipe_text.startswith('json'):
                recipe_text = recipe_text[4:]
            recipe_text = recipe_text.strip()
        
        recipe_data = json.loads(recipe_text)
        
        # Create recipe object
        recipe_id = str(uuid.uuid4())
        recipe = {
            "id": recipe_id,
            "athlete_id": athlete_id,
            "meal_type": meal_type,
            "recipe_name": recipe_data.get('recipe_name', 'Untitled Recipe'),
            "ingredients": recipe_data.get('ingredients', []),
            "instructions": recipe_data.get('instructions', ''),
            "nutrition_info": recipe_data.get('nutrition_info', {}),
            "prep_time": recipe_data.get('prep_time', 0),
            "cook_time": recipe_data.get('cook_time', 0),
            "servings": recipe_data.get('servings', 1),
            "user_rating": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Save to database
        await db.recipes.insert_one(recipe)
        
        logging.info(f"[RECIPE] Recipe generated and saved: {recipe_id}")
        return {"success": True, "recipe": recipe}
        
    except json.JSONDecodeError as e:
        logging.error(f"[RECIPE] Failed to parse OpenAI response as JSON: {e}")
        raise HTTPException(status_code=500, detail="Failed to parse recipe from AI response")
    except Exception as e:
        logging.error(f"[RECIPE] Error generating recipe: {e}")
        raise HTTPException(status_code=500, detail=f"Error generating recipe: {str(e)}")


@router.get("/{athlete_id}")
async def get_recipes(athlete_id: str, week_start_date: Optional[str] = None, include_images: bool = True):
    """Get recipes for an athlete, optionally filtered by week"""
    query = {"athlete_id": athlete_id}
    if week_start_date:
        query["week_start_date"] = week_start_date
    
    # Include compressed images by default (they're now small enough)
    projection = {"_id": 0}
    if not include_images:
        projection["image_base64"] = 0
    
    # Limit recipes (weekly menu typically has 7-21 recipes max)
    recipes = await db.recipes.find(query, projection).sort("day_of_week", 1).limit(50).to_list(length=50)
    return {"recipes": [parse_from_mongo(recipe) for recipe in recipes]}


@router.get("/{recipe_id}/details")
async def get_recipe(recipe_id: str):
    """Get a single recipe by ID with full details including image"""
    recipe = await db.recipes.find_one({"id": recipe_id}, {"_id": 0})
    
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    
    return parse_from_mongo(recipe)


@router.put("/{recipe_id}/rating")
async def rate_recipe(recipe_id: str, rating: dict):
    """Update recipe rating"""
    user_rating = rating.get('rating')
    if user_rating is None or not (1 <= user_rating <= 5):
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")
    
    result = await db.recipes.update_one(
        {"id": recipe_id},
        {"$set": {"user_rating": user_rating, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Recipe not found")
    
    return {"success": True}


@router.delete("/{recipe_id}")
async def delete_recipe(recipe_id: str):
    """Delete a recipe"""
    result = await db.recipes.delete_one({"id": recipe_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Recipe not found")
    
    return {"success": True}
