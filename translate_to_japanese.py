#!/usr/bin/env python3
"""
Japanese Translation Script with Chunking Support
"""

import json
import os
import time
import asyncio
from emergentintegrations.llm.chat import LlmChat, UserMessage

def count_keys(obj):
    if isinstance(obj, dict):
        return sum(count_keys(v) if isinstance(v, dict) else 1 for v in obj.values())
    return 1

def split_section(section_data, max_keys=150):
    if not isinstance(section_data, dict):
        return [section_data]
    total_keys = count_keys(section_data)
    if total_keys <= max_keys:
        return [section_data]
    chunks = []
    current_chunk = {}
    current_size = 0
    for key, value in section_data.items():
        key_size = count_keys(value) if isinstance(value, dict) else 1
        if current_size + key_size > max_keys and current_chunk:
            chunks.append(current_chunk)
            current_chunk = {}
            current_size = 0
        current_chunk[key] = value
        current_size += key_size
    if current_chunk:
        chunks.append(current_chunk)
    return chunks

async def translate_chunk(section_name, chunk_data, chunk_num, total_chunks, api_key, context="", max_retries=3):
    chunk_info = f" (part {chunk_num}/{total_chunks})" if total_chunks > 1 else ""
    prompt = f"""You are a professional Japanese translator specializing in software localization for fitness and health applications.

Context: This is the TrainSmart application - a comprehensive fitness tracking platform.

Section: {section_name}{chunk_info}
{context}

Translate the following JSON from English to Japanese:
- Keep all JSON keys UNCHANGED (only translate values)
- Use professional, consistent terminology
- Maintain the same structure
- Use polite form (です/ます) for user-facing text
- Keep technical terms like "API", "GTM", "OAuth" unchanged
- Use Japanese fitness/health terminology

JSON to translate:
{json.dumps(chunk_data, indent=2, ensure_ascii=False)}

IMPORTANT: Return ONLY the valid JSON with translated values. No explanations, no markdown, just pure JSON."""

    for attempt in range(max_retries):
        try:
            chat = LlmChat(
                api_key=api_key,
                session_id=f"translate-ja-{section_name}-chunk{chunk_num}-{int(time.time())}-{attempt}",
                system_message="You are a professional Japanese translator. You respond ONLY with valid JSON."
            ).with_model("openai", "gpt-4o")
            user_message = UserMessage(text=prompt)
            response = await chat.send_message(user_message)
            translated_text = response.strip()
            if translated_text.startswith('```'):
                lines = translated_text.split('\n')
                translated_text = '\n'.join(lines[1:-1]) if len(lines) > 2 else translated_text
            translated_json = json.loads(translated_text)
            return translated_json
        except json.JSONDecodeError as e:
            if attempt < max_retries - 1:
                print(f"  ⚠️  JSON error (attempt {attempt+1}/{max_retries})")
                await asyncio.sleep(3)
            else:
                raise
        except Exception as e:
            if attempt < max_retries - 1:
                print(f"  ⚠️  Error (attempt {attempt+1}/{max_retries})")
                await asyncio.sleep(5)
            else:
                raise

async def translate_section(section_name, section_data, api_key, context=""):
    total_keys = count_keys(section_data)
    chunks = split_section(section_data, max_keys=150)
    total_chunks = len(chunks)
    if total_chunks > 1:
        print(f" ({total_keys} keys → {total_chunks} chunks)")
    translated_data = {}
    for i, chunk in enumerate(chunks, 1):
        if total_chunks > 1:
            print(f"      Chunk {i}/{total_chunks}... ", end='', flush=True)
        translated_chunk = await translate_chunk(section_name, chunk, i, total_chunks, api_key, context)
        if isinstance(translated_chunk, dict):
            translated_data.update(translated_chunk)
        else:
            translated_data = translated_chunk
        if total_chunks > 1:
            print("✅")
        await asyncio.sleep(1)
    return translated_data

async def translate_locale_file():
    input_file = 'frontend/src/locales/en.json'
    output_file = 'frontend/src/locales/ja.json'
    print("=" * 60)
    print("🇯🇵 Japanese Translation Script - TrainSmart")
    print("=" * 60)
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        print("❌ Error: EMERGENT_LLM_KEY not set!")
        exit(1)
    with open(input_file, 'r', encoding='utf-8') as f:
        en_data = json.load(f)
    translated_data = {}
    if os.path.exists(output_file):
        with open(output_file, 'r', encoding='utf-8') as f:
            translated_data = json.load(f)
        print(f"✅ Loaded {len(translated_data)} existing sections")
    sections = list(en_data.keys())
    total_sections = len(sections)
    remaining_sections = [s for s in sections if s not in translated_data]
    print(f"⏳ Remaining: {len(remaining_sections)}/{total_sections} sections\n")
    start_time = time.time()
    start_index = len(translated_data)
    for idx, section in enumerate(remaining_sections, start_index + 1):
        print(f"[{idx:2d}/{total_sections}] {section:<20} ", end='', flush=True)
        try:
            translated_section = await translate_section(section, en_data[section], api_key)
            translated_data[section] = translated_section
            if len(split_section(en_data[section], 150)) == 1:
                print("✅")
            if idx % 3 == 0:
                with open(output_file, 'w', encoding='utf-8') as f:
                    json.dump(translated_data, f, indent=2, ensure_ascii=False)
            await asyncio.sleep(1)
        except Exception as e:
            print(f"❌ Failed")
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(translated_data, f, indent=2, ensure_ascii=False)
            raise
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(translated_data, f, indent=2, ensure_ascii=False)
    elapsed = time.time() - start_time
    print(f"\n✅ Complete! Time: {int(elapsed/60)}m {int(elapsed%60)}s\n")

if __name__ == "__main__":
    asyncio.run(translate_locale_file())
