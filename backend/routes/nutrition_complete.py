"""
Nutrition routes - Extracted from server.py
Handles nutrition entries, supplements, drinks, and AI-powered meal analysis
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime, timezone
import uuid
import logging
import json
import re
import openai

# Import shared dependencies
from database import db
from utils import prepare_for_mongo, parse_from_mongo

router = APIRouter(tags=["nutrition"])

# ============= MODELS =============

class NutritionEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    athlete_id: str
    meal_type: str
    description: str
    image_data: Optional[str] = None
    entry_date: Optional[str] = None
    entry_time: Optional[str] = None
    calories: Optional[int] = None
    protein: Optional[float] = None
    carbs: Optional[float] = None
    fat: Optional[float] = None
    fiber: Optional[float] = None
    sodium: Optional[float] = None
    sugar: Optional[float] = None
    vitamin_a: Optional[float] = None
    vitamin_c: Optional[float] = None
    vitamin_d: Optional[float] = None
    calcium: Optional[float] = None
    iron: Optional[float] = None
    potassium: Optional[float] = None
    ai_analysis: Optional[str] = None
    ingredients: Optional[List[str]] = None
    instructions: Optional[List[str]] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Supplement(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    athlete_id: str
    name: str
    dosage: str
    frequency: str
    time_of_day: str
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Drink(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    athlete_id: str
    drink_type: str
    amount_ml: float
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============= HELPER FUNCTIONS =============

async def generate_meal_details_with_ai(description: str, image_data: str, openai_key: str) -> dict:
    """Use OpenAI Vision API to analyze meal image and description"""
    try:
        prompt = f"""Analyze this meal: "{description}"

Based on the image and description, provide:
1. A detailed list of ingredients with quantities needed to recreate this meal
2. Step-by-step preparation instructions

Return your response in this exact JSON format:
{{
  "ingredients": ["ingredient 1 with quantity", "ingredient 2 with quantity", ...],
  "instructions": ["step 1", "step 2", ...]
}}

Be specific with quantities (e.g., "200g chicken breast", "1 cup rice", "2 tbsp olive oil").
Make instructions clear and easy to follow."""

        client = openai.AsyncOpenAI(api_key=openai_key)
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {"url": image_data}
                        }
                    ]
                }
            ],
            temperature=0.7
        )
        
        content = response.choices[0].message.content
        
        # Clean and parse JSON
        cleaned_text = content.strip()
        if cleaned_text.startswith('```'):
            cleaned_text = re.sub(r'^```(?:json)?\n', '', cleaned_text)
            cleaned_text = re.sub(r'\n```$', '', cleaned_text)
        
        json_match = re.search(r'\{.*\}', cleaned_text, re.DOTALL)
        if json_match:
            result = json.loads(json_match.group(0))
        else:
            result = json.loads(cleaned_text)
        
        return {
            "ingredients": result.get("ingredients", []),
            "instructions": result.get("instructions", [])
        }
        
    except Exception as e:
        logging.error(f"[NUTRITION AI] Failed to generate meal details: {str(e)}")
        return {"ingredients": [], "instructions": []}

# ============= NUTRITION ROUTES =============

@router.get("/nutrition/{athlete_id}")
async def get_nutrition_entries(athlete_id: str, date: Optional[str] = None):
    """Get nutrition entries for an athlete, optionally filtered by date"""
    query = {"athlete_id": athlete_id}
    
    if date:
        query["entry_date"] = date
    
    entries = await db.nutrition_entries.find(
        query,
        {"_id": 0}
    ).limit(100).to_list(length=100)
    
    parsed_entries = [parse_from_mongo(entry) for entry in entries]
    
    def sort_key(entry):
        if entry.get('entry_date') and entry.get('entry_time'):
            try:
                date_str = entry['entry_date']
                time_str = entry['entry_time']
                datetime_str = f"{date_str} {time_str}"
                dt = datetime.strptime(datetime_str, "%Y-%m-%d %H:%M")
                return dt.replace(tzinfo=timezone.utc)
            except:
                pass
        
        if isinstance(entry.get('created_at'), str):
            try:
                return datetime.fromisoformat(entry['created_at'].replace('Z', '+00:00'))
            except:
                pass
        elif isinstance(entry.get('created_at'), datetime):
            dt = entry['created_at']
            if dt.tzinfo is None:
                return dt.replace(tzinfo=timezone.utc)
            return dt
        
        return datetime.min.replace(tzinfo=timezone.utc)
    
    parsed_entries.sort(key=sort_key, reverse=True)
    
    return {"entries": parsed_entries}


@router.post("/nutrition")
async def create_nutrition_entry(entry: NutritionEntry):
    """Create a new nutrition entry with AI-generated ingredients and instructions"""
    entry_dict = prepare_for_mongo(entry.model_dump())
    await db.nutrition_entries.insert_one(entry_dict)
    
    # Generate ingredients and instructions with AI if image and description are provided
    if entry.description and entry.image_data:
        try:
            system_settings = await db.system_settings.find_one(
                {"setting_type": "global"},
                {"_id": 0}
            )
            
            if system_settings and system_settings.get('advanced', {}).get('openaiApiKey'):
                openai_key = system_settings['advanced']['openaiApiKey']
                logging.info(f"[NUTRITION AI] Generating meal details for entry {entry.id}")
                
                ai_details = await generate_meal_details_with_ai(
                    entry.description, 
                    entry.image_data, 
                    openai_key
                )
                
                await db.nutrition_entries.update_one(
                    {"id": entry.id},
                    {"$set": {
                        "ingredients": ai_details["ingredients"],
                        "instructions": ai_details["instructions"]
                    }}
                )
                logging.info(f"[NUTRITION AI] Successfully generated {len(ai_details['ingredients'])} ingredients and {len(ai_details['instructions'])} instructions")
            else:
                logging.info(f"[NUTRITION AI] No OpenAI key found, skipping AI generation")
        except Exception as e:
            logging.error(f"[NUTRITION AI] Failed to generate meal details: {str(e)}")
    
    return {"success": True, "id": entry.id}


@router.get("/nutrition/entry/{entry_id}")
async def get_nutrition_entry(entry_id: str):
    """Get a single nutrition entry by ID"""
    entry = await db.nutrition_entries.find_one({"id": entry_id}, {"_id": 0})
    if not entry:
        raise HTTPException(status_code=404, detail="Nutrition entry not found")
    return parse_from_mongo(entry)


@router.post("/nutrition/entry/{entry_id}/reanalyze")
async def reanalyze_nutrition_entry(entry_id: str):
    """Re-run AI analysis on an existing nutrition entry"""
    entry = await db.nutrition_entries.find_one({"id": entry_id}, {"_id": 0})
    if not entry:
        raise HTTPException(status_code=404, detail="Nutrition entry not found")
    
    if not entry.get("description") or not entry.get("image_data"):
        raise HTTPException(status_code=400, detail="Entry must have description and image for AI analysis")
    
    try:
        system_settings = await db.system_settings.find_one(
            {"setting_type": "global"},
            {"_id": 0}
        )
        
        if not system_settings or not system_settings.get('advanced', {}).get('openaiApiKey'):
            raise HTTPException(status_code=400, detail="OpenAI API key not configured")
        
        openai_key = system_settings['advanced']['openaiApiKey']
        logging.info(f"[NUTRITION AI] Re-analyzing entry {entry_id}")
        
        ai_details = await generate_meal_details_with_ai(
            entry["description"],
            entry["image_data"],
            openai_key
        )
        
        await db.nutrition_entries.update_one(
            {"id": entry_id},
            {"$set": {
                "ingredients": ai_details["ingredients"],
                "instructions": ai_details["instructions"]
            }}
        )
        
        return {
            "success": True,
            "ingredients": ai_details["ingredients"],
            "instructions": ai_details["instructions"]
        }
        
    except Exception as e:
        logging.error(f"[NUTRITION AI] Re-analysis failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"AI analysis failed: {str(e)}")


@router.put("/nutrition/{entry_id}")
async def update_nutrition_entry(entry_id: str, updates: dict):
    """Update a nutrition entry"""
    update_data = {}
    
    allowed_fields = [
        'meal_type', 'description', 'image_data', 'entry_date', 'entry_time',
        'calories', 'protein', 'carbs', 'fat', 'fiber', 'sodium', 'sugar',
        'vitamin_a', 'vitamin_c', 'vitamin_d', 'calcium', 'iron', 'potassium',
        'ai_analysis', 'ingredients', 'instructions'
    ]
    
    for field in allowed_fields:
        if field in updates:
            update_data[field] = updates[field]
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    result = await db.nutrition_entries.update_one(
        {"id": entry_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Nutrition entry not found")
    
    return {"success": True}


@router.delete("/nutrition/{entry_id}")
async def delete_nutrition_entry(entry_id: str):
    """Delete a nutrition entry"""
    result = await db.nutrition_entries.delete_one({"id": entry_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Nutrition entry not found")
    
    return {"success": True}


@router.post("/nutrition/analyze-image/{athlete_id}")
async def analyze_nutrition_image(athlete_id: str, data: dict):
    """Analyze food image and/or description using OpenAI API"""
    try:
        image_data = data.get("image_data")
        description = data.get("description", "")
        
        if not image_data and not description:
            raise HTTPException(status_code=400, detail="Either image_data or description is required")
        
        system_settings = await db.system_settings.find_one(
            {"setting_type": "global"},
            {"_id": 0}
        )
        
        if not system_settings or not system_settings.get('advanced', {}).get('openaiApiKey'):
            raise HTTPException(status_code=400, detail="OpenAI API key not configured")
        
        openai_key = system_settings['advanced']['openaiApiKey']
        client = openai.AsyncOpenAI(api_key=openai_key)
        
        # Build prompt based on what's available
        if image_data and description:
            prompt = f"""Analyze this food image and the description: "{description}". Provide detailed nutritional information including macronutrients and key micronutrients.

Return your response in this exact JSON format:
{{
  "description": "Brief description of the meal/food",
  "calories": estimated_calories_number,
  "protein": grams_of_protein,
  "carbs": grams_of_carbs,
  "fat": grams_of_fat,
  "fiber": grams_of_fiber,
  "sodium": milligrams_of_sodium,
  "cholesterol": milligrams_of_cholesterol,
  "vitamin_a": micrograms_RAE,
  "vitamin_c": milligrams,
  "vitamin_d": micrograms,
  "calcium": milligrams,
  "iron": milligrams,
  "potassium": milligrams,
  "ingredients": ["ingredient 1", "ingredient 2", ...],
  "analysis": "Brief analysis of nutritional value and micronutrient content"
}}

Be as accurate as possible with estimates. For micronutrients, estimate based on typical values for the identified ingredients."""
        elif image_data:
            prompt = """Analyze this food image and provide detailed nutritional information including macronutrients and key micronutrients.

Return your response in this exact JSON format:
{
  "description": "Brief description of the meal/food",
  "calories": estimated_calories_number,
  "protein": grams_of_protein,
  "carbs": grams_of_carbs,
  "fat": grams_of_fat,
  "fiber": grams_of_fiber,
  "sodium": milligrams_of_sodium,
  "cholesterol": milligrams_of_cholesterol,
  "vitamin_a": micrograms_RAE,
  "vitamin_c": milligrams,
  "vitamin_d": micrograms,
  "calcium": milligrams,
  "iron": milligrams,
  "potassium": milligrams,
  "ingredients": ["ingredient 1", "ingredient 2", ...],
  "analysis": "Brief analysis of nutritional value and micronutrient content"
}

Be as accurate as possible with estimates. For micronutrients, estimate based on typical values for the identified ingredients."""
        else:
            # Description only
            prompt = f"""Analyze this meal description: "{description}". Provide detailed nutritional information including macronutrients and key micronutrients based on typical portion sizes.

Return your response in this exact JSON format:
{{
  "description": "Brief description of the meal/food",
  "calories": estimated_calories_number,
  "protein": grams_of_protein,
  "carbs": grams_of_carbs,
  "fat": grams_of_fat,
  "fiber": grams_of_fiber,
  "sodium": milligrams_of_sodium,
  "cholesterol": milligrams_of_cholesterol,
  "vitamin_a": micrograms_RAE,
  "vitamin_c": milligrams,
  "vitamin_d": micrograms,
  "calcium": milligrams,
  "iron": milligrams,
  "potassium": milligrams,
  "ingredients": ["ingredient 1", "ingredient 2", ...],
  "analysis": "Brief analysis of nutritional value and micronutrient content"
}}

Be as accurate as possible with estimates. For micronutrients, estimate based on typical values for the identified ingredients."""

        # Build message content based on what's available
        if image_data:
            message_content = [
                {"type": "text", "text": prompt},
                {
                    "type": "image_url",
                    "image_url": {"url": image_data}
                }
            ]
        else:
            # Text only
            message_content = [
                {"type": "text", "text": prompt}
            ]

        response = await client.chat.completions.create(
            model="gpt-4o" if image_data else "gpt-4o-mini",
            messages=[
                {
                    "role": "user",
                    "content": message_content
                }
            ],
            temperature=0.7
        )
        
        content = response.choices[0].message.content
        
        # Clean and parse JSON
        cleaned_text = content.strip()
        if cleaned_text.startswith('```'):
            cleaned_text = re.sub(r'^```(?:json)?\n', '', cleaned_text)
            cleaned_text = re.sub(r'\n```$', '', cleaned_text)
        
        json_match = re.search(r'\{.*\}', cleaned_text, re.DOTALL)
        if json_match:
            result = json.loads(json_match.group(0))
        else:
            result = json.loads(cleaned_text)
        
        return result
        
    except Exception as e:
        logging.error(f"[NUTRITION AI] Image analysis failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


# ============= SUPPLEMENTS ROUTES =============

@router.get("/supplements/{athlete_id}")
async def get_supplements(athlete_id: str):
    """Get all supplements for an athlete"""
    supplements = await db.supplements.find(
        {"athlete_id": athlete_id},
        {"_id": 0}
    ).limit(100).to_list(length=100)
    return {"supplements": supplements}


@router.post("/supplements")
async def create_supplement(supplement: Supplement):
    """Create a new supplement"""
    supplement_dict = prepare_for_mongo(supplement.model_dump())
    await db.supplements.insert_one(supplement_dict)
    return {"success": True, "id": supplement.id}


@router.put("/supplements/{supplement_id}")
async def update_supplement(supplement_id: str, updates: dict):
    """Update a supplement"""
    allowed_fields = ['name', 'dosage', 'frequency', 'time_of_day', 'notes']
    update_data = {k: v for k, v in updates.items() if k in allowed_fields}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    result = await db.supplements.update_one(
        {"id": supplement_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Supplement not found")
    
    return {"success": True}


@router.delete("/supplements/{supplement_id}")
async def delete_supplement(supplement_id: str):
    """Delete a supplement"""
    result = await db.supplements.delete_one({"id": supplement_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Supplement not found")
    
    return {"success": True}


# ============= DRINKS/HYDRATION ROUTES =============

@router.get("/drinks/{athlete_id}")
async def get_drinks(athlete_id: str, date: Optional[str] = None):
    """Get drink/hydration entries for an athlete"""
    query = {"athlete_id": athlete_id}
    
    if date:
        start_of_day = f"{date}T00:00:00"
        end_of_day = f"{date}T23:59:59"
        query["timestamp"] = {
            "$gte": start_of_day,
            "$lte": end_of_day
        }
    
    drinks = await db.drinks.find(
        query,
        {"_id": 0}
    ).sort("timestamp", -1).limit(100).to_list(length=100)
    
    total_ml = sum(drink.get('amount_ml', 0) for drink in drinks)
    
    return {
        "drinks": drinks,
        "total_ml": total_ml
    }


@router.post("/drinks/{athlete_id}")
async def log_drink(athlete_id: str, drink: Drink):
    """Log a drink/hydration entry"""
    drink.athlete_id = athlete_id
    drink_dict = prepare_for_mongo(drink.model_dump())
    await db.drinks.insert_one(drink_dict)
    return {"success": True, "id": drink.id}


@router.put("/drinks/{athlete_id}/{drink_id}")
async def update_drink(athlete_id: str, drink_id: str, updates: dict):
    """Update a drink entry"""
    allowed_fields = ['drink_type', 'amount_ml', 'timestamp']
    update_data = {k: v for k, v in updates.items() if k in allowed_fields}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    result = await db.drinks.update_one(
        {"id": drink_id, "athlete_id": athlete_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Drink entry not found")
    
    return {"success": True}


@router.delete("/drinks/{athlete_id}/{drink_id}")
async def delete_drink(athlete_id: str, drink_id: str):
    """Delete a drink entry"""
    result = await db.drinks.delete_one({
        "id": drink_id,
        "athlete_id": athlete_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Drink entry not found")
    
    return {"success": True}
