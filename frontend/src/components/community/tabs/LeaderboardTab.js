import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Trophy, TrendingUp, Flame } from 'lucide-react';
import LoadingSpinner from '../../ui/LoadingSpinner';

import { getApiUrl } from '../../../utils/apiConfig';
const API = getApiUrl();

const LeaderboardTab = () => {
  const { t } = useTranslation();
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/body-score/leaderboard`);
      setLeaderboard(response.data.leaderboard || []);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (leaderboard.length === 0) {
    return (
      <div className="text-center py-12">
        <Trophy className="w-16 h-16 mx-auto mb-4 text-gray-600" />
        <p className="text-gray-400 text-lg">No leaderboard data yet</p>
        <p className="text-gray-500 text-sm mt-2">Maintain a Body Score above 85 to appear on the leaderboard!</p>
      </div>
    );
  }

  // Split into top 3 and rest
  const topThree = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);

  // Arrange podium: 2nd, 1st, 3rd
  const podium = [
    topThree[1], // 2nd place (left)
    topThree[0], // 1st place (center)
    topThree[2]  // 3rd place (right)
  ];

  const getPodiumHeight = (index) => {
    if (index === 1) return 'h-48'; // 1st place - tallest
    if (index === 0) return 'h-40'; // 2nd place
    return 'h-32'; // 3rd place
  };

  const getPodiumColor = (index) => {
    if (index === 1) return { bg: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)', text: '#B8860B' }; // Gold
    if (index === 0) return { bg: 'linear-gradient(135deg, #C0C0C0 0%, #808080 100%)', text: '#696969' }; // Silver
    return { bg: 'linear-gradient(135deg, #CD7F32 0%, #8B4513 100%)', text: '#654321' }; // Bronze
  };

  const getRank = (index) => {
    if (index === 1) return 1; // Center
    if (index === 0) return 2; // Left
    return 3; // Right
  };

  return (
    <div className="space-y-8 pb-6">
      {/* Podium Section */}
      <div className="rounded-2xl p-6" style={{
        background: 'linear-gradient(135deg, rgba(50, 211, 255, 0.05) 0%, rgba(59, 130, 246, 0.05) 100%)',
        border: '1px solid rgba(50, 211, 255, 0.1)'
      }}>
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-white flex items-center justify-center gap-2 mb-2">
            <Trophy className="w-7 h-7 text-yellow-500" />
            Top Performers
          </h2>
          <p className="text-gray-400 text-sm">Body Score Streak Leaders</p>
        </div>

        <div className="flex items-end justify-center gap-4 max-w-3xl mx-auto">
          {podium.map((person, index) => {
            if (!person) return null;
            const rank = getRank(index);
            const colors = getPodiumColor(index);
            const isFirst = rank === 1;

            return (
              <div 
                key={person.athlete_id} 
                className={`flex flex-col items-center ${isFirst ? 'w-40' : 'w-36'}`}
              >
                {/* Profile Image */}
                <div className={`relative mb-4 ${isFirst ? 'transform scale-110' : ''}`}>
                  <div 
                    className="w-20 h-20 rounded-full border-4 overflow-hidden"
                    style={{ 
                      borderColor: colors.text,
                      boxShadow: `0 8px 20px ${colors.text}40`
                    }}
                  >
                    {person.profile_picture ? (
                      <img 
                        src={`${BACKEND_URL}${person.profile_picture}`} 
                        alt={person.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-700 flex items-center justify-center text-white text-2xl font-bold">
                        {person.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  
                  {/* Rank Badge */}
                  <div 
                    className="absolute -top-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-sm shadow-lg"
                    style={{ background: colors.bg }}
                  >
                    {rank}
                  </div>
                </div>

                {/* Name */}
                <div className="text-center mb-3">
                  <p className="font-semibold text-white text-sm truncate w-full px-2">
                    {person.name}
                  </p>
                </div>

                {/* Podium */}
                <div 
                  className={`w-full ${getPodiumHeight(index)} rounded-t-lg flex flex-col items-center justify-center p-4 transition-all hover:scale-105`}
                  style={{ 
                    background: colors.bg,
                    boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.3)'
                  }}
                >
                  <div className="flex items-center gap-1 mb-2">
                    <Flame className="w-6 h-6 text-white" />
                    <span className="text-3xl font-bold text-white">{person.streak}</span>
                  </div>
                  <p className="text-white text-xs font-medium">days</p>
                  <p className="text-white text-xs opacity-75 mt-1">Score: {Math.round(person.current_score)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Rest of Leaderboard */}
      {rest.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-white px-4">Other Champions</h3>
          {rest.map((person, index) => {
            const rank = index + 4; // Starting from 4th place
            
            return (
              <div 
                key={person.athlete_id}
                className="rounded-xl p-4 transition-all hover:scale-[1.02]"
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}
              >
                <div className="flex items-center gap-4">
                  {/* Rank */}
                  <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center font-bold text-gray-300">
                    {rank}
                  </div>

                  {/* Profile Image */}
                  <div className="w-12 h-12 rounded-full border-2 border-gray-600 overflow-hidden flex-shrink-0">
                    {person.profile_picture ? (
                      <img 
                        src={`${BACKEND_URL}${person.profile_picture}`} 
                        alt={person.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-700 flex items-center justify-center text-white text-lg font-bold">
                        {person.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Name and Score */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white truncate">{person.name}</p>
                    <p className="text-sm text-gray-400">Current Score: {Math.round(person.current_score)}</p>
                  </div>

                  {/* Streak */}
                  <div className="flex items-center gap-2 px-4 py-2 rounded-lg" style={{
                    background: 'linear-gradient(135deg, rgba(255, 149, 0, 0.1) 0%, rgba(255, 204, 0, 0.1) 100%)',
                    border: '1px solid rgba(255, 149, 0, 0.3)'
                  }}>
                    <Flame className="w-5 h-5 text-orange-500" />
                    <div className="text-right">
                      <div className="text-lg font-bold text-orange-500">{person.streak}</div>
                      <div className="text-xs text-gray-400">days</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LeaderboardTab;
