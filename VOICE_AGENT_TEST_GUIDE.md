# 🎤 Support Agent Voice Mode - Testing Guide

## What Changed

### ✅ Ultra-Short, Direct Instructions
- **Before:** 3,467 characters of instructions (too long!)
- **After:** ~600 characters - ultra-focused
- **Strategy:** Put MOST important info at the TOP

### ✅ Function Definitions Active
- 5 functions defined in session
- `tool_choice: "auto"` enabled
- Functions will show in console when called

### ✅ Frontend Logging Added
- Function calls will show popup alert: "Function called: take_photo_and_post"
- Console log: "🔥 FUNCTION CALL RECEIVED"
- This helps debug if function calling is working

---

## 🧪 Test Instructions

### Test 1: Camera Function
1. Open Support Agent in voice mode
2. Say: **"Take a picture"** or **"Take a selfie"**
3. **Expected:** 
   - Agent says something like "Opening camera!"
   - Alert popup: "Function called: take_photo_and_post"
   - Camera modal opens
4. **If it fails:**
   - Check browser console for "🔥 FUNCTION CALL RECEIVED"
   - If you see it → Frontend is working, camera code issue
   - If you DON'T see it → OpenAI didn't call function

### Test 2: Create Post Function  
1. Say: **"Post about my workout"**
2. **Expected:**
   - Agent says "Creating post!"
   - Alert: "Function called: create_post"
   - Post created in community
3. **Check:** Community page for new post

### Test 3: Navigate Function
1. Say: **"Take me to community"** or **"Go to the community page"**
2. **Expected:**
   - Alert: "Function called: navigate_to_page"
   - Page navigates to /dashboard/community

---

## 🔍 Debugging

### If Agent Still Says "I Can't"

**Check 1: Are functions in session?**
```bash
curl -s -X POST ".../api/support-agent/voice/session/[athlete_id]" | grep "tools"
```
Should show 5 function definitions.

**Check 2: Are instructions correct?**
```bash
curl -s -X POST ".../api/support-agent/voice/session/[athlete_id]" | grep "instructions"
```
Should mention: "YOU HAVE 5 WORKING FUNCTIONS"

**Check 3: Is frontend receiving function calls?**
- Open browser console
- Say "take a picture"
- Look for: "🔥 FUNCTION CALL RECEIVED"
- If YES → OpenAI is calling, frontend should handle
- If NO → OpenAI isn't calling the function

### If OpenAI Isn't Calling Functions

Possible causes:
1. **Model behavior:** GPT-4o-realtime might be conservative
2. **Instructions not clear:** Need even simpler language
3. **Function descriptions unclear:** Need better descriptions
4. **Temperature too low:** Might need higher temperature

### Try These Phrases

**For Camera:**
- "Take a picture"
- "Take a selfie" 
- "Open the camera"
- "I want to take a photo"

**For Posting:**
- "Post this: I had a great workout"
- "Create a post about my run"
- "Publish a post"
- "Share this on community"

---

## 🎯 Success Criteria

✅ Agent responds with action phrase ("Opening camera!", "Creating post!")
✅ Alert popup shows function name
✅ Console shows "🔥 FUNCTION CALL RECEIVED"
✅ Actual action executes (camera opens, post created, navigation happens)

---

## 📝 Current Configuration

**Session Config:**
- Model: gpt-4o-realtime-preview-2024-12-17
- Voice: alloy
- Tools: 5 functions defined
- Tool choice: auto
- Temperature: 0.8

**Instructions Focus:**
1. Camera (take_photo_and_post)
2. Post (create_post)
3. Edit (edit_post)
4. Delete (delete_post_request)
5. Navigate (navigate_to_page)

**Instructions Tone:**
- Ultra direct
- Command-style
- Examples included
- Explicitly says "YOU CAN do this"
- Forbids saying "I can't"

---

## 🚨 If Still Not Working

**Next Steps:**
1. Verify OpenAI Realtime API is calling functions (check WebRTC data channel events)
2. Test with simpler function (just navigate, no complex logic)
3. Add more explicit examples in instructions
4. Consider using `tool_choice: "required"` to force function use
5. Add a test function that always gets called on first message

**Report Back:**
- Did you see the alert popup?
- Did you see console log "🔥 FUNCTION CALL RECEIVED"?
- What did the agent actually say?
- Did camera open / post create / navigation happen?
