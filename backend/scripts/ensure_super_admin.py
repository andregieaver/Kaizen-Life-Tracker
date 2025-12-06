"""
Super-Admin Verification and Setup Script

This script ensures andre@humanweb.no always has super-admin privileges.
Run this script after any deployment to verify admin status.

Usage: python ensure_super_admin.py
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
import os
import sys

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

SUPER_ADMIN_EMAIL = "andre@humanweb.no"
SUPER_ADMIN_PASSWORD = "Pernilla666!"

async def ensure_super_admin():
    """Ensure super-admin account exists and has correct privileges"""
    
    # Get database connection
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'test_database')
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print("="*80)
    print("SUPER-ADMIN VERIFICATION AND SETUP")
    print("="*80)
    print(f"Database: {db_name}")
    print(f"Super-Admin Email: {SUPER_ADMIN_EMAIL}")
    print("="*80)
    
    try:
        # Find the user
        user = await db.athlete_profiles.find_one({"email": SUPER_ADMIN_EMAIL})
        
        if not user:
            print(f"\n❌ ERROR: User {SUPER_ADMIN_EMAIL} not found in database!")
            print("Please create this user account first.")
            client.close()
            sys.exit(1)
        
        print(f"\n✓ Found user: {user.get('name')}")
        print(f"  Athlete ID: {user.get('id')}")
        print(f"  Email: {user.get('email')}")
        
        # Check current privileges
        current_role = user.get('role', 'user')
        is_admin = user.get('is_admin', False)
        is_super_admin = user.get('is_super_admin', False)
        
        print(f"\nCurrent Status:")
        print(f"  Role: {current_role}")
        print(f"  is_admin: {is_admin}")
        print(f"  is_super_admin: {is_super_admin}")
        
        # Determine if update is needed
        needs_update = (
            current_role != "super_admin" or
            not is_admin or
            not is_super_admin or
            not user.get('permissions') or
            'all' not in user.get('permissions', [])
        )
        
        if needs_update:
            print(f"\n⚠️  Admin privileges need updating...")
            
            # Hash the password
            password_hash = pwd_context.hash(SUPER_ADMIN_PASSWORD)
            
            # Update with super-admin privileges
            update_fields = {
                "role": "super_admin",
                "is_admin": True,
                "is_super_admin": True,
                "permissions": ["all"],
                "password": password_hash,
                "password_hash": password_hash
            }
            
            result = await db.athlete_profiles.update_one(
                {"email": SUPER_ADMIN_EMAIL},
                {"$set": update_fields}
            )
            
            print(f"✅ Super-admin privileges updated!")
            print(f"  Modified: {result.modified_count} document(s)")
            
            # Verify the update
            updated_user = await db.athlete_profiles.find_one({"email": SUPER_ADMIN_EMAIL})
            print(f"\nVerified Status:")
            print(f"  Role: {updated_user.get('role')}")
            print(f"  is_admin: {updated_user.get('is_admin')}")
            print(f"  is_super_admin: {updated_user.get('is_super_admin')}")
            print(f"  Permissions: {updated_user.get('permissions')}")
        else:
            print(f"\n✅ Super-admin privileges already correct!")
        
        print("\n" + "="*80)
        print("✅ SUPER-ADMIN STATUS VERIFIED")
        print("="*80)
        print(f"\nSuper-Admin Account Details:")
        print(f"  Email: {SUPER_ADMIN_EMAIL}")
        print(f"  Password: {SUPER_ADMIN_PASSWORD}")
        print(f"  Athlete ID: {user.get('id')}")
        print(f"  Role: super_admin")
        print(f"  Permissions: ALL")
        print(f"\nThis account has full access to all system features.")
        print("="*80)
        
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(ensure_super_admin())
