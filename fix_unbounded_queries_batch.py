#!/usr/bin/env python3
"""
Batch fix for unbounded queries in server.py
Applies safe limits to all remaining .to_list(length=None) calls
"""

import re

# Define replacements with contextual limits
replacements = [
    # Community comments (line 10933)
    {
        'search': r'comments = await db\.community_comments\.aggregate\(pipeline\)\.to_list\(length=None\)',
        'replace': 'comments = await db.community_comments.aggregate(pipeline).to_list(length=200)  # Max 200 comments per post',
        'description': 'Community post comments'
    },
    # Event comments (line 11172)
    {
        'search': r'comments = await db\.community_event_comments\.aggregate\(pipeline\)\.to_list\(length=None\)',
        'replace': 'comments = await db.community_event_comments.aggregate(pipeline).to_list(length=200)  # Max 200 comments per event',
        'description': 'Event comments'
    },
    # Challenge leaderboard (line 11443)
    {
        'search': r'leaderboard = await db\.community_challenge_participants\.aggregate\(leaderboard_pipeline\)\.to_list\(length=None\)',
        'replace': 'leaderboard = await db.community_challenge_participants.aggregate(leaderboard_pipeline).to_list(length=500)  # Max 500 participants',
        'description': 'Challenge leaderboard'
    },
    # Challenge comments (line 11822)
    {
        'search': r'comments = await db\.community_challenge_comments\.aggregate\(pipeline\)\.to_list\(length=None\)',
        'replace': 'comments = await db.community_challenge_comments.aggregate(pipeline).to_list(length=200)  # Max 200 challenge comments',
        'description': 'Challenge comments'
    },
    # Groups list (line 12204)
    {
        'search': r'groups = await db\.community_groups\.aggregate\(pipeline\)\.to_list\(length=None\)',
        'replace': 'groups = await db.community_groups.aggregate(pipeline).to_list(length=100)  # Max 100 groups',
        'description': 'Community groups'
    },
    # Group memberships (line 12256)
    {
        'search': r'groups = await db\.community_group_memberships\.aggregate\(pipeline\)\.to_list\(length=None\)',
        'replace': 'groups = await db.community_group_memberships.aggregate(pipeline).to_list(length=100)  # Max 100 groups per user',
        'description': 'Group memberships'
    },
    # Group posts (line 12646)
    {
        'search': r'posts = await db\.community_group_posts\.aggregate\(pipeline\)\.to_list\(length=None\)',
        'replace': 'posts = await db.community_group_posts.aggregate(pipeline).to_list(length=100)  # Max 100 group posts',
        'description': 'Group posts'
    },
    # User groups lookup (line 12782)
    {
        'search': r'\}, \{"_id": 0, "group_id": 1\}\)\.to_list\(length=None\)',
        'replace': '}, {"_id": 0, "group_id": 1}).limit(100).to_list(length=100)  # Max 100 groups',
        'description': 'User groups lookup'
    }
]

# Read server.py
with open('/app/backend/server.py', 'r') as f:
    content = f.read()

# Track changes
changes_made = 0

# Apply replacements
for replacement in replacements:
    pattern = replacement['search']
    new_text = replacement['replace']
    desc = replacement['description']
    
    if re.search(pattern, content):
        content = re.sub(pattern, new_text, content)
        changes_made += 1
        print(f"✅ Fixed: {desc}")
    else:
        print(f"⚠️  Not found: {desc}")

# Write back
with open('/app/backend/server.py', 'w') as f:
    f.write(content)

print(f"\n✅ Total changes: {changes_made}")
print("Server.py updated successfully!")
