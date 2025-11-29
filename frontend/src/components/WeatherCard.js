import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Cloud, CloudRain, CloudSnow, Sun, Wind, Droplets, Eye, Gauge } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const WeatherCard = () => {
  const { t } = useTranslation();
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [locationName, setLocationName] = useState(null);

  useEffect(() => {
    fetchWeather();
  }, []);

  const getLocationName = async (latitude, longitude) => {
    try {
      // Use OpenStreetMap Nominatim for reverse geocoding (free, no API key needed)
      const response = await axios.get(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`,
        {
          headers: {
            'User-Agent': 'TrainSmart Weather App'
          }
        }
      );
      
      const address = response.data?.address;
      if (address) {
        // Try to get city, town, village, or municipality
        const location = address.city || address.town || address.village || address.municipality || address.county;
        const country = address.country;
        
        if (location && country) {
          return `${location}, ${country}`;
        } else if (location) {
          return location;
        } else if (country) {
          return country;
        }
      }
      
      return null;
    } catch (err) {
      console.error('Error fetching location name:', err);
      return null;
    }
  };

  const fetchWeather = async () => {
    try {
      setLoading(true);
      setError(null);
      setLocationError(null);

      // Request geolocation
      if (!navigator.geolocation) {
        setLocationError(t('weather.errors.notSupported'));
        setLoading(false);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            
            // Fetch weather and location name in parallel
            const [weatherResponse, locName] = await Promise.all([
              axios.get(`${API}/api/weather/current`, {
                params: {
                  lat: latitude,
                  lon: longitude
                }
              }),
              getLocationName(latitude, longitude)
            ]);

            setWeather(weatherResponse.data);
            setLocationName(locName);
            setLoading(false);
          } catch (err) {
            console.error('Error fetching weather:', err);
            setError(err.response?.data?.detail || 'Failed to fetch weather data');
            setLoading(false);
          }
        },
        (err) => {
          console.error('Geolocation error:', err);
          setLocationError(
            err.code === 1 ? t('weather.errors.permissionDenied') :
            err.code === 2 ? t('weather.errors.locationUnavailable') :
            err.code === 3 ? t('weather.errors.timeout') :
            t('weather.errors.failedToGetLocation')
          );
          setLoading(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        }
      );
    } catch (err) {
      console.error('Error in fetchWeather:', err);
      setError('An unexpected error occurred');
      setLoading(false);
    }
  };

  const getWeatherIcon = (symbolCode) => {
    if (!symbolCode) return <Sun className="w-8 h-8" />;
    
    const code = symbolCode.toLowerCase();
    if (code.includes('rain') || code.includes('drizzle')) {
      return <CloudRain className="w-8 h-8" />;
    } else if (code.includes('snow') || code.includes('sleet')) {
      return <CloudSnow className="w-8 h-8" />;
    } else if (code.includes('cloud') || code.includes('overcast') || code.includes('fog')) {
      return <Cloud className="w-8 h-8" />;
    } else {
      return <Sun className="w-8 h-8" />;
    }
  };

  const getRecommendationColor = (overall) => {
    switch (overall) {
      case 'good':
        return 'text-green-400';
      case 'caution':
        return 'text-yellow-400';
      case 'poor':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  if (loading) {
    return (
      <div 
        className="p-4 md:p-6"
        style={{
          background: 'color-mix(in srgb, var(--c-glass) 10%, transparent)',
          backdropFilter: 'blur(12px) saturate(140%)',
          WebkitBackdropFilter: 'blur(12px) saturate(140%)',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: `
            inset 0 0 0 1px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 10%), transparent),
            0px 2px 8px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 8%), transparent)
          `
        }}
      >
        <div className="flex items-center justify-center h-32">
          <div className="animate-pulse text-gray-400">{t('weather.loading')}</div>
        </div>
      </div>
    );
  }

  if (locationError || error) {
    return (
      <div 
        className="p-4 md:p-6"
        style={{
          background: 'color-mix(in srgb, var(--c-glass) 10%, transparent)',
          backdropFilter: 'blur(12px) saturate(140%)',
          WebkitBackdropFilter: 'blur(12px) saturate(140%)',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: `
            inset 0 0 0 1px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 10%), transparent),
            0px 2px 8px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 8%), transparent)
          `
        }}
      >
        <div className="flex flex-col items-center justify-center h-32 text-center">
          <Cloud className="w-8 h-8 text-gray-400 mb-2" />
          <p className="text-sm text-gray-400">{locationError || error}</p>
          {locationError && (
            <button 
              onClick={fetchWeather}
              className="mt-3 px-4 py-2 text-xs rounded-lg"
              style={{ background: 'var(--c-brand-500)', color: 'white' }}
            >
              {t('weather.tryAgain')}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!weather) return null;

  const { current, forecast, training_recommendations } = weather;

  return (
    <div 
      className="p-4 md:p-6"
      style={{
        background: 'color-mix(in srgb, var(--c-glass) 10%, transparent)',
        backdropFilter: 'blur(12px) saturate(140%)',
        WebkitBackdropFilter: 'blur(12px) saturate(140%)',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: `
          inset 0 0 0 1px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 10%), transparent),
          inset 1.8px 3px 0px -2px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 40%), transparent),
          inset -2px -2px 0px -2px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 35%), transparent),
          inset -3px -8px 1px -6px color-mix(in srgb, var(--c-light) calc(var(--glass-reflex-light) * 25%), transparent),
          inset -0.3px -1px 4px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 12%), transparent),
          inset -1.5px 2.5px 0px -2px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 20%), transparent),
          inset 0px 3px 4px -2px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 20%), transparent),
          inset 2px -6.5px 1px -4px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 10%), transparent),
          0px 1px 5px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 10%), transparent),
          0px 6px 16px 0px color-mix(in srgb, var(--c-dark) calc(var(--glass-reflex-dark) * 8%), transparent)
        `
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold" style={{ color: 'var(--text-hi)' }}>
          {t('weather.title')}
        </h3>
        <div style={{ color: 'var(--c-brand-500)' }}>
          {getWeatherIcon(forecast?.next_1h?.symbol)}
        </div>
      </div>

      {/* Temperature and conditions */}
      <div className="mb-6">
        <div className="flex items-baseline mb-2">
          <span className="text-4xl font-bold" style={{ color: 'var(--text-hi)' }}>
            {Math.round(current.temperature)}°
          </span>
          <span className="ml-2 text-sm" style={{ color: 'var(--text-med)' }}>
            {t('weather.feelsLike')} {Math.round(current.feels_like)}°
          </span>
        </div>
      </div>

      {/* Weather details grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Wind className="w-4 h-4" style={{ color: 'var(--c-brand-500)' }} />
          <div>
            <p className="text-xs" style={{ color: 'var(--text-med)' }}>{t('weather.wind')}</p>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-hi)' }}>
              {current.wind_speed ? `${Math.round(current.wind_speed)} m/s` : 'N/A'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Droplets className="w-4 h-4" style={{ color: 'var(--c-brand-500)' }} />
          <div>
            <p className="text-xs" style={{ color: 'var(--text-med)' }}>{t('weather.humidity')}</p>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-hi)' }}>
              {current.humidity ? `${Math.round(current.humidity)}%` : 'N/A'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <CloudRain className="w-4 h-4" style={{ color: 'var(--c-brand-500)' }} />
          <div>
            <p className="text-xs" style={{ color: 'var(--text-med)' }}>{t('weather.precipitation')}</p>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-hi)' }}>
              {forecast?.next_1h?.precipitation ? `${forecast.next_1h.precipitation} mm` : '0 mm'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Gauge className="w-4 h-4" style={{ color: 'var(--c-brand-500)' }} />
          <div>
            <p className="text-xs" style={{ color: 'var(--text-med)' }}>{t('weather.pressure')}</p>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-hi)' }}>
              {current.pressure ? `${Math.round(current.pressure)} hPa` : 'N/A'}
            </p>
          </div>
        </div>
      </div>

      {/* Training recommendations */}
      {training_recommendations && (
        <div 
          className="mt-4 p-3 rounded-lg"
          style={{
            background: 'rgba(0, 0, 0, 0.2)',
            border: '1px solid rgba(255, 255, 255, 0.05)'
          }}
        >
          <div className="flex items-start gap-2">
            <div className={`mt-0.5 ${getRecommendationColor(training_recommendations.overall)}`}>
              ●
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-hi)' }}>
                {training_recommendations.message_key ? t(training_recommendations.message_key) : training_recommendations.message}
              </p>
              {((training_recommendations.details_keys && training_recommendations.details_keys.length > 0) || 
                (training_recommendations.details && training_recommendations.details.length > 0)) && (
                <ul className="text-xs space-y-1" style={{ color: 'var(--text-med)' }}>
                  {training_recommendations.details_keys ? 
                    training_recommendations.details_keys.map((key, idx) => (
                      <li key={idx}>• {t(key)}</li>
                    )) :
                    training_recommendations.details.map((detail, idx) => (
                      <li key={idx}>• {detail}</li>
                    ))
                  }
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Refresh button */}
      <div className="mt-4 flex justify-end">
        <button
          onClick={fetchWeather}
          className="text-xs px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
          style={{ 
            background: 'rgba(255, 255, 255, 0.1)',
            color: 'var(--text-med)'
          }}
        >
          {t('weather.refresh')}
        </button>
      </div>
    </div>
  );
};

export default WeatherCard;
