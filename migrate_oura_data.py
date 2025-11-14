#!/usr/bin/env python3
"""
Migration script to extract HR and HRV data from raw_data field
and populate the top-level fields in existing Oura sleep activities.
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os

async def migrate_oura_data():
    # Connect to MongoDB
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017/')
    db_name = os.environ.get('DB_NAME', 'test_database')
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print("=== Oura Data Migration Script ===\n")
    
    # Find all sleep activities with None values but have raw_data
    query = {
        "type": "Sleep",
        "$or": [
            {"lowest_heart_rate": None},
            {"average_heart_rate": None},
            {"average_hrv": None},
            {"score": None}
        ],
        "raw_data": {"$exists": True}
    }
    
    sleep_activities = await db.oura_activities.find(query).to_list(length=1000)
    
    print(f"Found {len(sleep_activities)} sleep activities to migrate\n")
    
    updated_count = 0
    skipped_count = 0
    
    for activity in sleep_activities:
        raw_data = activity.get('raw_data', {})
        activity_id = activity.get('activity_id', 'unknown')
        
        # Extract data from raw_data
        updates = {}
        
        # Update lowest_heart_rate if missing
        if activity.get('lowest_heart_rate') is None:
            lowest_hr = raw_data.get('lowest_heart_rate')
            if lowest_hr is not None:
                updates['lowest_heart_rate'] = lowest_hr
        
        # Update average_heart_rate if missing
        if activity.get('average_heart_rate') is None:
            avg_hr = raw_data.get('average_heart_rate')
            if avg_hr is not None:
                updates['average_heart_rate'] = avg_hr
        
        # Update average_hrv if missing
        if activity.get('average_hrv') is None:
            avg_hrv = raw_data.get('average_hrv')
            if avg_hrv is not None:
                updates['average_hrv'] = avg_hrv
        
        # Update score if missing (try readiness.score as fallback for old data)
        if activity.get('score') is None:
            score = raw_data.get('score')
            if score is None and 'readiness' in raw_data:
                # For old data, use readiness score as sleep score indicator
                score = raw_data.get('readiness', {}).get('score')
            if score is not None:
                updates['score'] = score
        
        if updates:
            # Update the document
            result = await db.oura_activities.update_one(
                {"_id": activity['_id']},
                {"$set": updates}
            )
            
            if result.modified_count > 0:
                updated_count += 1
                print(f"✓ Updated {activity_id}: {', '.join(f'{k}={v}' for k, v in updates.items())}")
            else:
                skipped_count += 1
                print(f"⚠ Skipped {activity_id}: No changes needed")
        else:
            skipped_count += 1
            print(f"⚠ Skipped {activity_id}: No data to extract from raw_data")
    
    print(f"\n=== Migration Complete ===")
    print(f"Updated: {updated_count}")
    print(f"Skipped: {skipped_count}")
    print(f"Total processed: {len(sleep_activities)}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(migrate_oura_data())
