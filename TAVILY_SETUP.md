# Tavily Search API Setup Guide

## What This Enables
Your AI Coach can now search the internet in real-time for the latest health, nutrition, and training information. When you ask questions that need current data, the AI automatically searches trusted sources and provides cited responses.

## Setup Instructions

### Step 1: Get Your Free Tavily API Key

1. Go to [https://app.tavily.com](https://app.tavily.com)
2. Click "Sign Up" or "Get Started"
3. Create your account (free tier includes **1,000 searches per month**)
4. After signing in, you'll see your API key on the dashboard
5. Copy your API key (it starts with `tvly-`)

### Step 2: Add API Key to Backend

**Option A: Using the File Editor**
1. Open `/app/backend/.env` file
2. Find the line: `TAVILY_API_KEY=your_tavily_api_key_here`
3. Replace `your_tavily_api_key_here` with your actual key
4. Save the file

**Option B: Using Command Line**
```bash
# Replace YOUR_ACTUAL_KEY with your Tavily API key
sed -i 's/TAVILY_API_KEY=your_tavily_api_key_here/TAVILY_API_KEY=YOUR_ACTUAL_KEY/' /app/backend/.env
```

### Step 3: Restart the Backend

```bash
sudo supervisorctl restart backend
```

### Step 4: Verify It's Working

1. Check the backend logs for successful initialization:
```bash
tail -n 50 /var/log/supervisor/backend.err.log | grep -i tavily
```

You should see:
```
INFO:root:Tavily client initialized for web search
```

If you see a warning instead, the API key wasn't loaded properly.

## Testing the Feature

Try asking your AI Coach questions like:

1. **Latest Research:**
   - "What's the latest research on Zone 2 training?"
   - "What's the current thinking on polarized training?"

2. **Nutrition Questions:**
   - "What are the benefits of beetroot juice for endurance athletes?"
   - "Tell me about the latest guidelines for post-run protein intake"

3. **Health Topics:**
   - "What's the latest progress from Sinclair Labs on longevity research?"
   - "What are the health benefits of NAD+ supplementation?"

4. **Training Guidance:**
   - "What's the science behind tempo runs?"
   - "How should I structure my taper before a marathon?"

## How It Works

1. **Automatic Detection**: The AI analyzes your question and determines if it needs current information
2. **Smart Search**: If needed, it searches trusted health sources (NIH, CDC, Mayo Clinic, Healthline, etc.)
3. **Cited Response**: The AI provides an answer based on the search results and cites its sources

## Trusted Sources

The search is configured to prioritize:
- **Health**: NIH.gov, CDC.gov, WHO.int, MayoClinic.org, WebMD.com, Healthline.com
- **Nutrition**: Nutrition.gov, EatRight.org, Harvard School of Public Health
- **Training**: RunnersWorld.com, TrainingPeaks.com, Active.com

## Free Tier Limits

- **1,000 searches per month** (free)
- **Basic search**: 1 credit per search
- **Advanced search**: 2 credits per search (better results, used by default)

With advanced search, you get ~500 searches/month for free.

## Troubleshooting

### "Search functionality not available" message
- Check that your API key is correctly added to `.env`
- Restart the backend after adding the key
- Verify the key starts with `tvly-`

### AI doesn't search when expected
- The AI decides when to search based on the question
- Try being more specific: "Search for the latest research on..."
- Make sure you have an OpenAI API key configured

### Backend logs show "TAVILY_API_KEY not found"
- The key wasn't loaded properly
- Check for syntax errors in the `.env` file
- Make sure there are no extra spaces or quotes around the key
- Restart the backend after fixing

## Cost Information

**Free Tier:**
- 1,000 API credits/month
- No credit card required
- Perfect for personal use

**Paid Plans** (if you need more):
- Pay as you go: $0.001 per basic search, $0.002 per advanced search
- Enterprise plans available

## Notes

- The feature is **completely optional** - your coach works fine without it
- If Tavily isn't configured, the coach falls back to its trained knowledge
- Search results are passed to OpenAI, using your OpenAI API credits as well
- Each search typically uses 1-2 OpenAI API calls (one to decide to search, one for the final response)
