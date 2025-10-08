import asyncio
import os
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import uuid
import json

load_dotenv()

async def create_sample_data():
    # Connect to MongoDB
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ['DB_NAME']]
    
    # Sample athlete ID
    athlete_id = str(uuid.uuid4())
    
    # Create athlete profile
    athlete_data = {
        "id": athlete_id,
        "name": "Sarah Johnson",
        "email": "sarah.johnson@example.com",
        "age": 29,
        "weekly_mileage": 45.0,
        "recent_race_time": "Half Marathon: 1:28:30",
        "running_goals": "Train for Boston Marathon qualifier. Want to run sub-3:05 marathon and stay injury-free through training cycle.",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.athlete_profiles.insert_one(athlete_data)
    print(f"Created athlete profile for {athlete_data['name']} (ID: {athlete_id})")
    
    # Create sample workout data (last 14 days)
    workouts = []
    for i in range(14):
        date = (datetime.now(timezone.utc) - timedelta(days=i)).date().isoformat()
        
        # Vary workout types
        if i % 7 == 0:  # Long runs on "Sundays"
            workout = {
                "id": str(uuid.uuid4()),
                "athlete_id": athlete_id,
                "date": date,
                "workout_type": "long_run",
                "distance_miles": 16.0 - (i * 0.5),
                "duration_minutes": 120 - (i * 2),
                "avg_hr": 155,
                "max_hr": 170,
                "perceived_effort": 6,
                "notes": "Felt strong throughout. Good negative split."
            }
        elif i % 3 == 0:  # Tempo runs
            workout = {
                "id": str(uuid.uuid4()),
                "athlete_id": athlete_id,
                "date": date,
                "workout_type": "tempo",
                "distance_miles": 6.0,
                "duration_minutes": 42,
                "avg_hr": 175,
                "max_hr": 185,
                "perceived_effort": 8,
                "notes": "3x2 mile tempo intervals. Hit target paces well."
            }
        elif i % 5 == 0:  # Intervals
            workout = {
                "id": str(uuid.uuid4()),
                "athlete_id": athlete_id,
                "date": date,
                "workout_type": "intervals",
                "distance_miles": 8.0,
                "duration_minutes": 50,
                "avg_hr": 180,
                "max_hr": 190,
                "perceived_effort": 9,
                "notes": "6x800m @ 5K pace. Rest between reps felt adequate."
            }
        elif i % 2 == 0:  # Easy runs
            workout = {
                "id": str(uuid.uuid4()),
                "athlete_id": athlete_id,
                "date": date,
                "workout_type": "easy",
                "distance_miles": 6.5,
                "duration_minutes": 48,
                "avg_hr": 145,
                "max_hr": 160,
                "perceived_effort": 4,
                "notes": "Easy conversational pace. Felt relaxed."
            }
        else:  # Recovery runs or rest days
            if i % 4 == 1:
                workout = {
                    "id": str(uuid.uuid4()),
                    "athlete_id": athlete_id,
                    "date": date,
                    "workout_type": "recovery",
                    "distance_miles": 4.0,
                    "duration_minutes": 32,
                    "avg_hr": 135,
                    "max_hr": 150,
                    "perceived_effort": 3,
                    "notes": "Short recovery run. Legs felt a bit tired."
                }
            else:
                continue  # Rest day
        
        workout["created_at"] = datetime.now(timezone.utc).isoformat()
        workouts.append(workout)
    
    await db.workouts.insert_many(workouts)
    print(f"Created {len(workouts)} sample workouts")
    
    # Create sample sleep data (last 7 days)
    sleep_data = []
    for i in range(7):
        date = (datetime.now(timezone.utc) - timedelta(days=i)).date().isoformat()
        
        # Vary sleep quality
        sleep_hours = 7.5 + (i * 0.2) - 0.7  # Range from ~7-8.5 hours
        sleep_quality = 7 + (i % 3) - 1  # Range 6-9
        efficiency = 85 + (i % 5)  # Range 85-89%
        hrv_score = 45 - (i * 2) + (i % 4)  # Simulate some variation
        resting_hr = 52 + (i % 6)  # Range 52-57
        
        sleep_record = {
            "id": str(uuid.uuid4()),
            "athlete_id": athlete_id,
            "date": date,
            "total_sleep_hours": round(sleep_hours, 1),
            "sleep_efficiency": efficiency,
            "hrv_score": hrv_score,
            "resting_hr": resting_hr,
            "sleep_quality": sleep_quality,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        sleep_data.append(sleep_record)
    
    await db.sleep_data.insert_many(sleep_data)
    print(f"Created {len(sleep_data)} sleep data records")
    
    print(f"\\n🎉 Sample data created successfully!")
    print(f"Athlete ID: {athlete_id}")
    print(f"Use this ID to test the application")
    
    # Save athlete ID to a file for easy access
    with open('/app/sample_athlete_id.txt', 'w') as f:
        f.write(athlete_id)
    
    client.close()

if __name__ == "__main__":
    asyncio.run(create_sample_data())