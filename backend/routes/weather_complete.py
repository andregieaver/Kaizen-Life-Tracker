"""
Weather API Routes
Handles current weather data from MET Norway API with caching and training recommendations
"""

from fastapi import APIRouter, HTTPException, Query
from datetime import datetime, timezone
import logging
import httpx

# Create router
router = APIRouter(prefix="/api", tags=["weather"])

# Logger
logger = logging.getLogger(__name__)

# In-memory cache for weather data (simple hourly caching)
weather_cache = {}


# ==================== Helper Functions ====================

def generate_training_recommendations(weather_data: dict) -> dict:
    """Generate training recommendations based on weather conditions"""
    current = weather_data.get("current", {})
    forecast = weather_data.get("forecast", {})
    
    temp = current.get("temperature")
    wind_speed = current.get("wind_speed", 0)
    precipitation = forecast.get("next_1h", {}).get("precipitation", 0)
    symbol = forecast.get("next_1h", {}).get("symbol", "")
    
    recommendations = {
        "overall": "good",
        "message_key": "weather.recommendations.goodConditions",
        "details_keys": []
    }
    
    # Temperature recommendations
    if temp is not None:
        if temp < 0:
            recommendations["overall"] = "caution"
            recommendations["message_key"] = "weather.recommendations.coldConditions"
            recommendations["details_keys"].append("weather.recommendations.layerUpGradually")
        elif temp < 5:
            recommendations["details_keys"].append("weather.recommendations.coolWeatherLayers")
        elif temp > 25:
            recommendations["overall"] = "caution"
            recommendations["message_key"] = "weather.recommendations.hotConditions"
            recommendations["details_keys"].append("weather.recommendations.bringWaterMorningEvening")
        elif temp > 30:
            recommendations["overall"] = "poor"
            recommendations["message_key"] = "weather.recommendations.veryHotIndoor"
            recommendations["details_keys"].append("weather.recommendations.highHeatRisk")
    
    # Wind recommendations
    if wind_speed > 15:
        recommendations["overall"] = "poor"
        recommendations["message_key"] = "weather.recommendations.highWinds"
        recommendations["details_keys"].append("weather.recommendations.strongWindsAffect")
    elif wind_speed > 10:
        recommendations["overall"] = "caution"
        recommendations["details_keys"].append("weather.recommendations.moderateWindsPacing")
    
    # Precipitation recommendations
    if precipitation > 5:
        recommendations["overall"] = "poor"
        recommendations["message_key"] = "weather.recommendations.heavyRainIndoor"
        recommendations["details_keys"].append("weather.recommendations.significantRainfall")
    elif precipitation > 1:
        recommendations["overall"] = "caution"
        recommendations["message_key"] = "weather.recommendations.rainExpectedGear"
        recommendations["details_keys"].append("weather.recommendations.lightRainForecasted")
    
    # If no warnings, set positive message
    if recommendations["overall"] == "good" and not recommendations["details_keys"]:
        recommendations["details_keys"].append("weather.recommendations.idealConditions")
    
    return recommendations


# ==================== Weather Endpoints ====================

@router.get("/weather/current")
async def get_current_weather(lat: float = Query(..., description="Latitude"), 
                               lon: float = Query(..., description="Longitude")):
    """
    Get current weather data from MET Norway API
    Caches results for 1 hour to respect API usage limits
    """
    try:
        # Create cache key from rounded coordinates (2 decimal places = ~1km accuracy)
        cache_key = f"{round(lat, 2)}_{round(lon, 2)}"
        current_time = datetime.now(timezone.utc)
        
        # Check if we have cached data less than 1 hour old
        if cache_key in weather_cache:
            cached_data, cached_time = weather_cache[cache_key]
            if (current_time - cached_time).total_seconds() < 3600:  # 1 hour
                logging.info(f"Returning cached weather data for {cache_key}")
                return cached_data
        
        # Fetch fresh data from MET Norway API
        url = "https://api.met.no/weatherapi/locationforecast/2.0/compact"
        headers = {
            "User-Agent": "HealthDashboard/1.0 (support@healthdash.app)"
        }
        params = {
            "lat": str(lat),
            "lon": str(lon)
        }
        
        logging.info(f"Fetching weather data from MET Norway for lat={lat}, lon={lon}")
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers, params=params, timeout=10.0)
            response.raise_for_status()
            data = response.json()
        
        # Parse the response to extract current weather
        timeseries = data.get("properties", {}).get("timeseries", [])
        if not timeseries:
            raise HTTPException(status_code=404, detail="No weather data available")
        
        # Get the first entry (current/nearest time)
        current = timeseries[0]
        instant_details = current.get("data", {}).get("instant", {}).get("details", {})
        next_1h = current.get("data", {}).get("next_1_hours", {})
        next_6h = current.get("data", {}).get("next_6_hours", {})
        
        # Extract weather details
        weather_data = {
            "location": {
                "lat": lat,
                "lon": lon
            },
            "current": {
                "temperature": instant_details.get("air_temperature"),
                "feels_like": instant_details.get("air_temperature"),  # MET doesn't provide feels_like, use actual temp
                "humidity": instant_details.get("relative_humidity"),
                "wind_speed": instant_details.get("wind_speed"),
                "wind_direction": instant_details.get("wind_from_direction"),
                "cloud_cover": instant_details.get("cloud_area_fraction"),
                "pressure": instant_details.get("air_pressure_at_sea_level"),
                "visibility": instant_details.get("fog_area_fraction"),  # Approximate visibility from fog
            },
            "forecast": {
                "next_1h": {
                    "symbol": next_1h.get("summary", {}).get("symbol_code"),
                    "precipitation": next_1h.get("details", {}).get("precipitation_amount", 0)
                },
                "next_6h": {
                    "symbol": next_6h.get("summary", {}).get("symbol_code"),
                    "precipitation": next_6h.get("details", {}).get("precipitation_amount", 0)
                }
            },
            "timestamp": current.get("time"),
            "cached_at": current_time.isoformat()
        }
        
        # Generate training recommendations based on weather
        recommendations = generate_training_recommendations(weather_data)
        weather_data["training_recommendations"] = recommendations
        
        # Cache the result
        weather_cache[cache_key] = (weather_data, current_time)
        
        # Clean old cache entries (keep only last 100)
        if len(weather_cache) > 100:
            oldest_key = min(weather_cache.items(), key=lambda x: x[1][1])[0]
            del weather_cache[oldest_key]
        
        return weather_data
        
    except httpx.HTTPStatusError as e:
        logging.error(f"HTTP error fetching weather: {e}")
        raise HTTPException(status_code=e.response.status_code, detail="Weather service error")
    except httpx.TimeoutException:
        logging.error("Timeout fetching weather data")
        raise HTTPException(status_code=504, detail="Weather service timeout")
    except Exception as e:
        logging.error(f"Error fetching weather: {e}")
        raise HTTPException(status_code=500, detail=str(e))
