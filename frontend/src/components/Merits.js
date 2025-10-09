import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Trophy, TrendingUp } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Merits = ({ athleteId }) => {
  const { t } = useTranslation();
  const [merits, setMerits] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadMerits();
  }, [athleteId]);

  const loadMerits = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(`${API}/merits/${athleteId}`);
      setMerits(response.data);
    } catch (error) {
      console.error('Error loading merits:', error);
      setMerits([]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (seconds) => {
    if (!seconds) return '-';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
  };

  const distances = [
    { key: '1km', label: '1 km' },
    { key: '1mile', label: '1 mile' },
    { key: '5km', label: '5 km' },
    { key: '10km', label: '10 km' },
    { key: 'half_marathon', label: 'Half Marathon' },
    { key: 'marathon', label: 'Marathon' }
  ];

  if (isLoading) {
    return (
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Trophy className="w-5 h-5 mr-2 text-yellow-600" />
            Merits
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-8 bg-gray-200 rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Trophy className="w-5 h-5 mr-2 text-yellow-600" />
          {t('merits.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-2 font-semibold text-gray-700">{t('merits.distance')}</th>
                <th className="text-left py-2 px-2 font-semibold text-gray-700">
                  <div className="flex items-center">
                    <TrendingUp className="w-4 h-4 mr-1 text-blue-600" />
                    {t('merits.last12Months')}
                  </div>
                </th>
                <th className="text-left py-2 px-2 font-semibold text-gray-700">
                  <Trophy className="w-4 h-4 inline mr-1 text-yellow-600" />
                  {t('merits.allTimeBest')}
                </th>
              </tr>
            </thead>
            <tbody>
              {distances.map((distance) => {
                const merit = merits.find(m => m.distance === distance.key);
                const hasRecent = merit?.recent_best;
                const hasAllTime = merit?.all_time_best;
                const isPersonalBest = hasRecent && hasAllTime && merit.recent_best === merit.all_time_best;

                return (
                  <tr key={distance.key} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-2 font-medium text-gray-900">{distance.label}</td>
                    <td className="py-3 px-2">
                      {hasRecent ? (
                        <span className={`font-mono ${isPersonalBest ? 'text-blue-600 font-semibold' : 'text-gray-700'}`}>
                          {formatTime(merit.recent_best)}
                          {isPersonalBest && (
                            <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{t('merits.personalBest')}</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">{t('merits.noData')}</span>
                      )}
                    </td>
                    <td className="py-3 px-2">
                      {hasAllTime ? (
                        <span className="font-mono text-gray-900 font-semibold">{formatTime(merit.all_time_best)}</span>
                      ) : (
                        <span className="text-gray-400 text-xs">{t('merits.noData')}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {merits.length === 0 && (
          <div className="text-center py-8">
            <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">{t('merits.noRecords')}</p>
            <p className="text-gray-400 text-xs mt-1">{t('merits.completeWorkouts')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default Merits;
