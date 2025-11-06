#!/usr/bin/env python3
"""
Recipe Generation Test Script
Tests the complete recipe generation flow including:
- Creating test athlete if needed
- Configuring OpenAI integration
- Generating a recipe
- Checking all steps with detailed logging
"""

import asyncio
import httpx
import sys
import json
from datetime import datetime

# Configuration
BASE_URL = "https://multilingual-fitness-1.preview.emergentagent.com/api"
TEST_EMAIL = "test_recipe@trainsmart.ai"
TEST_PASSWORD = "TestPassword123!"
TEST_NAME = "Recipe Test Athlete"

# ANSI color codes for pretty output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

def log_info(msg):
    print(f"{BLUE}ℹ️  {msg}{RESET}")

def log_success(msg):
    print(f"{GREEN}✅ {msg}{RESET}")

def log_error(msg):
    print(f"{RED}❌ {msg}{RESET}")

def log_warning(msg):
    print(f"{YELLOW}⚠️  {msg}{RESET}")

async def test_recipe_generation():
    """Main test function"""
    print("=" * 70)
    print("🧪 RECIPE GENERATION TEST SUITE")
    print("=" * 70)
    
    athlete_id = None
    openai_key = None
    
    # Ask user for OpenAI API key
    print(f"\n{YELLOW}{'=' * 70}{RESET}")
    print(f"{YELLOW}IMPORTANT: OpenAI API Key Required{RESET}")
    print(f"{YELLOW}{'=' * 70}{RESET}")
    print("To test recipe generation, you need a valid OpenAI API key.")
    print("Get your key from: https://platform.openai.com/api-keys")
    print("\nOptions:")
    print("  1. Enter your OpenAI API key to run full test")
    print("  2. Skip (will only test athlete creation)")
    
    choice = input("\nYour choice (1 or 2): ").strip()
    
    if choice == "1":
        openai_key = input("\nEnter your OpenAI API key (starts with sk-): ").strip()
        if not openai_key.startswith('sk-'):
            log_error("Invalid API key format. Key should start with 'sk-'")
            return
    
    async with httpx.AsyncClient(timeout=120.0) as client:
        
        # Step 1: Check if test athlete exists
        log_info("Step 1: Checking for existing test athlete...")
        try:
            response = await client.post(
                f"{BASE_URL}/auth/login",
                json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
            )
            if response.status_code == 200:
                data = response.json()
                athlete_id = data.get('athlete_id')
                log_success(f"Test athlete exists: {athlete_id}")
            else:
                log_info("Test athlete not found, will create new one")
        except Exception as e:
            log_info(f"No existing athlete found: {str(e)}")
        
        # Step 2: Create test athlete if needed
        if not athlete_id:
            log_info("Step 2: Creating test athlete...")
            try:
                response = await client.post(
                    f"{BASE_URL}/athlete",
                    json={
                        "email": TEST_EMAIL,
                        "password": TEST_PASSWORD,
                        "name": TEST_NAME,
                        "weekly_mileage": 20.0,
                        "date_of_birth": "1990-01-01",
                        "gender": "male",
                        "measurement_system": "metric",
                        "running_goals": "general fitness",
                        "allergies": ["peanuts"],
                        "dietary_preferences": ["balanced"]
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    athlete_id = data.get('id')
                    log_success(f"Test athlete created: {athlete_id}")
                else:
                    log_error(f"Failed to create athlete: {response.status_code}")
                    log_error(f"Response: {response.text}")
                    return
            except Exception as e:
                log_error(f"Error creating athlete: {str(e)}")
                return
        
        # Step 3: Configure OpenAI integration if key provided
        if openai_key:
            log_info("Step 3: Configuring OpenAI integration...")
            try:
                response = await client.post(
                    f"{BASE_URL}/integrations/openai/{athlete_id}",
                    json={"api_key": openai_key}
                )
                
                if response.status_code == 200:
                    log_success("OpenAI API key configured successfully")
                else:
                    log_error(f"Failed to configure OpenAI key: {response.status_code}")
                    log_error(f"Response: {response.text}")
                    return
            except Exception as e:
                log_error(f"Error configuring OpenAI: {str(e)}")
                return
            
            # Step 4: Generate recipe
            log_info("Step 4: Generating test recipe (breakfast)...")
            log_warning("This may take 30-60 seconds...")
            
            try:
                start_time = datetime.now()
                response = await client.post(
                    f"{BASE_URL}/recipes/generate/{athlete_id}",
                    json={"meal_type": "breakfast"}
                )
                duration = (datetime.now() - start_time).total_seconds()
                
                if response.status_code == 200:
                    data = response.json()
                    log_success(f"Recipe generated successfully in {duration:.1f}s!")
                    print(f"\n{GREEN}{'=' * 70}{RESET}")
                    print(f"{GREEN}📋 RECIPE DETAILS{RESET}")
                    print(f"{GREEN}{'=' * 70}{RESET}")
                    print(f"Recipe Name: {data.get('recipe_name')}")
                    print(f"Meal Type: {data.get('meal_type')}")
                    
                    recipe = data.get('recipe', {})
                    if recipe:
                        print(f"\n📝 Ingredients: {len(recipe.get('ingredients', []))} items")
                        print(f"⏱️  Prep Time: {recipe.get('prep_time')} minutes")
                        print(f"🍳 Cook Time: {recipe.get('cook_time')} minutes")
                        print(f"🍽️  Servings: {recipe.get('servings')}")
                        
                        nutrition = recipe.get('nutrition_info', {})
                        if nutrition:
                            print(f"\n🥗 Nutrition:")
                            print(f"  - Calories: {nutrition.get('calories')}")
                            print(f"  - Protein: {nutrition.get('protein')}g")
                            print(f"  - Carbs: {nutrition.get('carbs')}g")
                            print(f"  - Fat: {nutrition.get('fat')}g")
                        
                        has_image = recipe.get('image_base64') is not None
                        print(f"\n🖼️  Image: {'✅ Generated' if has_image else '❌ Not generated'}")
                    
                    print(f"{GREEN}{'=' * 70}{RESET}")
                else:
                    log_error(f"Recipe generation failed: {response.status_code}")
                    log_error(f"Response: {response.text}")
                    
                    # Parse error details
                    try:
                        error_data = response.json()
                        detail = error_data.get('detail', 'Unknown error')
                        print(f"\n{RED}Error Details: {detail}{RESET}")
                    except:
                        pass
                    
                    return
            except httpx.TimeoutException:
                log_error("Request timed out (>120 seconds)")
                return
            except Exception as e:
                log_error(f"Error generating recipe: {str(e)}")
                return
            
            # Step 5: Verify recipe was saved
            log_info("Step 5: Verifying recipe was saved to database...")
            try:
                response = await client.get(f"{BASE_URL}/recipes/{athlete_id}")
                
                if response.status_code == 200:
                    data = response.json()
                    recipes = data.get('recipes', [])
                    log_success(f"Found {len(recipes)} recipe(s) in database")
                else:
                    log_warning("Could not verify recipes in database")
            except Exception as e:
                log_warning(f"Error checking recipes: {str(e)}")
        
        else:
            log_warning("Skipping recipe generation (no API key provided)")
    
    # Summary
    print(f"\n{'=' * 70}")
    print("📊 TEST SUMMARY")
    print("=" * 70)
    print(f"✅ Athlete ID: {athlete_id}")
    print(f"{'✅' if openai_key else '⚠️ '} OpenAI Integration: {'Configured' if openai_key else 'Not configured'}")
    print(f"{'✅' if openai_key else '⚠️ '} Recipe Generation: {'Tested' if openai_key else 'Skipped'}")
    print("=" * 70)
    
    if not openai_key:
        print(f"\n{YELLOW}To test recipe generation:{RESET}")
        print("1. Get your OpenAI API key from: https://platform.openai.com/api-keys")
        print("2. Run this script again and choose option 1")
        print(f"3. Or add it manually in the app: Account Settings → Apps tab")

if __name__ == "__main__":
    try:
        asyncio.run(test_recipe_generation())
    except KeyboardInterrupt:
        print(f"\n\n{YELLOW}Test interrupted by user{RESET}")
    except Exception as e:
        print(f"\n\n{RED}Unexpected error: {str(e)}{RESET}")
        import traceback
        traceback.print_exc()
