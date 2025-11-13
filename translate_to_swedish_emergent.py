#!/usr/bin/env python3
"""
Swedish Translation Script - Using Emergent LLM Key
Translates the entire English locale file to Swedish with context awareness
"""

import json
import os
import time
import asyncio
from emergentintegrations.llm.chat import LlmChat, UserMessage

async def translate_section(section_name, section_data, api_key, context="", max_retries=3):
    """
    Translate a single section using GPT-4 via Emergent LLM with retry logic
    """
    prompt = f"""You are a professional Swedish translator specializing in software localization for fitness and health applications.

Context: This is the TrainSmart application - a comprehensive fitness tracking platform with features for:
- Workout tracking and planning
- Nutrition management
- Community features (challenges, events, groups)
- Subscription management
- Analytics and statistics
- Device integrations (Strava, Garmin, etc.)
- Cookie consent and privacy settings

Section: {section_name}
{context}

Translate the following JSON from English to Swedish:
- Keep all JSON keys UNCHANGED (only translate values)
- Use professional, consistent terminology
- Maintain the same structure
- Use "du" form (informal) for user-facing text
- Keep technical terms like "API", "GTM", "OAuth" unchanged
- Use Swedish fitness/health terminology

JSON to translate:
{json.dumps(section_data, indent=2, ensure_ascii=False)}

IMPORTANT: Return ONLY the valid JSON with translated values. No explanations, no markdown, just pure JSON."""

    for attempt in range(max_retries):
        try:
            # Initialize chat with unique session for this section
            chat = LlmChat(
                api_key=api_key,
                session_id=f"translate-{section_name}-{int(time.time())}-{attempt}",
                system_message="You are a professional Swedish translator. You respond ONLY with valid JSON. You maintain technical accuracy while providing natural Swedish translations appropriate for a fitness application."
            ).with_model("openai", "gpt-4o")
            
            # Create user message
            user_message = UserMessage(text=prompt)
            
            # Send message and get response
            response = await chat.send_message(user_message)
            translated_text = response.strip()
            
            # Remove markdown code blocks if present
            if translated_text.startswith('```'):
                lines = translated_text.split('\n')
                translated_text = '\n'.join(lines[1:-1]) if len(lines) > 2 else translated_text
            
            translated_json = json.loads(translated_text)
            return translated_json
            
        except json.JSONDecodeError as e:
            if attempt < max_retries - 1:
                print(f"  ⚠️  JSON decode error (attempt {attempt+1}/{max_retries}): {e}")
                await asyncio.sleep(3)
            else:
                print(f"  ❌ JSON decode error after {max_retries} attempts: {e}")
                print(f"  Response: {translated_text[:200]}")
                raise
        except Exception as e:
            if attempt < max_retries - 1:
                print(f"  ⚠️  Error (attempt {attempt+1}/{max_retries}): {e}")
                await asyncio.sleep(5)  # Wait longer for API errors
            else:
                print(f"  ❌ Translation error after {max_retries} attempts: {e}")
                raise

async def translate_locale_file():
    """
    Main translation function - processes entire locale file
    """
    input_file = 'frontend/src/locales/en.json'
    output_file = 'frontend/src/locales/sv.json'
    
    print("=" * 60)
    print("🇸🇪 Swedish Translation Script - TrainSmart Application")
    print("=" * 60)
    print(f"\nInput:  {input_file}")
    print(f"Output: {output_file}")
    
    # Get API key
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        print("❌ Error: EMERGENT_LLM_KEY environment variable not set!")
        print("\nPlease set your Emergent LLM key in /app/backend/.env")
        exit(1)
    
    # Load English locale
    print(f"\n📖 Loading English locale file...")
    with open(input_file, 'r', encoding='utf-8') as f:
        en_data = json.load(f)
    
    # Load existing translations if file exists
    translated_data = {}
    if os.path.exists(output_file):
        print(f"📂 Found existing translation file, loading progress...")
        with open(output_file, 'r', encoding='utf-8') as f:
            translated_data = json.load(f)
        print(f"✅ Loaded {len(translated_data)} already-translated sections")
    
    sections = list(en_data.keys())
    total_sections = len(sections)
    remaining_sections = [s for s in sections if s not in translated_data]
    
    print(f"✅ Loaded {total_sections} sections (English)")
    
    if len(translated_data) > 0:
        print(f"✅ Already translated: {len(translated_data)} sections")
        print(f"⏳ Remaining: {len(remaining_sections)} sections")
        print(f"\nSections to translate:")
        for i, section in enumerate(remaining_sections[:10], 1):
            print(f"  {i}. {section}")
        if len(remaining_sections) > 10:
            print(f"  ... and {len(remaining_sections) - 10} more")
    else:
        print(f"\nSections to translate:")
        for i, section in enumerate(sections[:10], 1):
            print(f"  {i}. {section}")
        if total_sections > 10:
            print(f"  ... and {total_sections - 10} more")
    
    # Confirm before starting
    print(f"\n⚡ Starting translation with Emergent LLM (GPT-4o)...")
    estimated_minutes = (len(remaining_sections) * 30) // 60  # ~30 seconds per section
    print(f"⏱️  Estimated time: {estimated_minutes}-{estimated_minutes+5} minutes")
    print()
    
    # Translation contexts for better quality
    contexts = {
        'auth': 'User authentication and registration',
        'account': 'User account settings and profile management',
        'dashboard': 'Main dashboard overview',
        'community': 'Social features: challenges, events, groups, posts',
        'systemSettings': 'Admin system configuration',
        'nutrition': 'Food tracking and meal planning',
        'workouts': 'Exercise and training management',
        'statistics': 'Analytics and performance metrics',
        'cookies': 'GDPR cookie consent management'
    }
    
    start_time = time.time()
    sections_to_process = remaining_sections if len(translated_data) > 0 else sections
    start_index = len(translated_data)
    
    for idx, section in enumerate(sections_to_process, start_index + 1):
        section_context = contexts.get(section, '')
        
        print(f"[{idx:2d}/{total_sections}] Translating: {section:<20} ", end='', flush=True)
        
        try:
            translated_section = await translate_section(section, en_data[section], api_key, section_context)
            translated_data[section] = translated_section
            print("✅")
            
            # Save progress every 3 sections
            if idx % 3 == 0:
                with open(output_file, 'w', encoding='utf-8') as f:
                    json.dump(translated_data, f, indent=2, ensure_ascii=False)
                elapsed = time.time() - start_time
                completed_this_run = idx - start_index
                if completed_this_run > 0:
                    avg_time = elapsed / completed_this_run
                    remaining_sections_count = total_sections - idx
                    remaining = remaining_sections_count * avg_time
                    print(f"     💾 Progress saved | ⏱️  {int(remaining/60)}m {int(remaining%60)}s remaining")
            
            # Rate limiting - avoid hitting API limits
            await asyncio.sleep(1)
            
        except Exception as e:
            print(f"❌ Failed: {e}")
            print(f"     Saving progress and stopping...")
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(translated_data, f, indent=2, ensure_ascii=False)
            raise
    
    # Final save
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(translated_data, f, indent=2, ensure_ascii=False)
    
    elapsed_time = time.time() - start_time
    
    print("\n" + "=" * 60)
    print("🎉 Translation Complete!")
    print("=" * 60)
    print(f"✅ Output saved to: {output_file}")
    print(f"⏱️  Total time: {int(elapsed_time/60)}m {int(elapsed_time%60)}s")
    print(f"📊 Translated sections: {len(translated_data)}/{total_sections}")
    
    # Count keys
    def count_keys(obj):
        if isinstance(obj, dict):
            return sum(count_keys(v) if isinstance(v, dict) else 1 for v in obj.values())
        return 1
    
    total_keys = sum(count_keys(section) for section in translated_data.values())
    print(f"🔑 Total translation keys: {total_keys}")
    
    print("\n✨ Next steps:")
    print("1. Run validation: python3 validate_swedish.py")
    print("2. Update i18n.js to include Swedish")
    print("3. Test in application")
    print()

if __name__ == "__main__":
    try:
        asyncio.run(translate_locale_file())
    except KeyboardInterrupt:
        print("\n\n⚠️  Translation interrupted by user")
        print("Progress has been saved. Run again to continue.")
    except Exception as e:
        print(f"\n\n❌ Translation failed: {e}")
        print("Check the error above and try again.")
        exit(1)
