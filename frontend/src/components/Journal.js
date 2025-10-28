import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Plus, Mic, MicOff, Trash2, Edit3, FileText, Volume2, X, BookOpen } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
const API = `${BACKEND_URL}/api`;

const Journal = ({ athleteId }) => {
  const { t } = useTranslation();
  const [entries, setEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [entryType, setEntryType] = useState('text'); // 'text' or 'voice'
  const [textContent, setTextContent] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [saveStatus, setSaveStatus] = useState({ type: '', message: '' });
  
  // Video recording state
  const [videoBlob, setVideoBlob] = useState(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState(null);
  const [videoTranscription, setVideoTranscription] = useState('');
  const [videoSrtContent, setVideoSrtContent] = useState('');
  const [burnSubtitles, setBurnSubtitles] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isProcessingVideo, setIsProcessingVideo] = useState(false);
  const [videoStream, setVideoStream] = useState(null);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const videoChunksRef = useRef([]);
  const timerRef = useRef(null);
  const videoRef = useRef(null);
  const videoPreviewRef = useRef(null);

  useEffect(() => {
    loadJournalEntries();
  }, [athleteId]);

  // Check for action parameter in URL to auto-start voice recording
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');
    
    if (action === 'voice') {
      // Small delay to ensure component is fully mounted
      setTimeout(() => {
        setShowModal(true);
        setEntryType('voice');
        // Auto-start recording after modal opens
        setTimeout(() => {
          startRecording();
        }, 500);
        // Clean up URL
        window.history.replaceState({}, '', window.location.pathname);
      }, 300);
    }
  }, []);

  const loadJournalEntries = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(`${API}/journal/${athleteId}`);
      setEntries(response.data.entries || []);
    } catch (error) {
      console.error('Error loading journal entries:', error);
      setSaveStatus({ type: 'error', message: 'Failed to load journal entries' });
    } finally {
      setIsLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        
        // Transcribe audio using backend API
        try {
          setSaveStatus({ type: '', message: 'Transcribing audio...' });
          
          const formData = new FormData();
          formData.append('audio', audioBlob, 'recording.wav');
          
          const response = await axios.post(
            `${API}/journal/transcribe/${athleteId}`,
            formData,
            {
              headers: {
                'Content-Type': 'multipart/form-data',
              },
            }
          );
          
          setTextContent(response.data.transcription);
          setSaveStatus({ type: 'success', message: 'Audio transcribed successfully!' });
        } catch (error) {
          console.error('Error transcribing audio:', error);
          const errorMessage = error.response?.data?.detail || 'Failed to transcribe audio';
          setSaveStatus({ type: 'error', message: errorMessage });
          
          // Fallback to placeholder if transcription fails
          const fallbackText = `[Voice recording - ${recordingTime}s] Transcription failed. ${errorMessage}`;
          setTextContent(fallbackText);
        }
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error starting recording:', error);
      setSaveStatus({ type: 'error', message: 'Failed to access microphone' });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const handleSaveEntry = async () => {
    if (!textContent.trim()) {
      setSaveStatus({ type: 'error', message: 'Please enter some content' });
      return;
    }

    try {
      await axios.post(`${API}/journal`, {
        athlete_id: athleteId,
        content: textContent,
        entry_type: entryType
      });

      setSaveStatus({ type: 'success', message: 'Journal entry saved!' });
      setShowModal(false);
      setTextContent('');
      setEntryType('text');
      await loadJournalEntries();
    } catch (error) {
      console.error('Error saving journal entry:', error);
      setSaveStatus({ type: 'error', message: 'Failed to save entry' });
    }
  };

  const handleDeleteEntry = async (entryId) => {
    if (!window.confirm('Are you sure you want to delete this entry?')) {
      return;
    }

    try {
      await axios.delete(`${API}/journal/${entryId}`);
      setSaveStatus({ type: 'success', message: 'Entry deleted' });
      await loadJournalEntries();
    } catch (error) {
      console.error('Error deleting entry:', error);
      setSaveStatus({ type: 'error', message: 'Failed to delete entry' });
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Journal</h1>
          <p className="text-gray-300 mt-1">Record your thoughts, feelings, and progress</p>
        </div>
        <Button 
          onClick={() => setShowModal(true)}
          className="text-white border-0"
          style={{ backgroundColor: '#00C2A8' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#009688'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#00C2A8'}
        >
          <Plus className="w-4 h-4 mr-2" />
          New Entry
        </Button>
      </div>

      {/* Status Messages */}
      {saveStatus.message && (
        <div className={`p-4 rounded-lg ${
          saveStatus.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          {saveStatus.message}
        </div>
      )}

      {/* Journal Entries List */}
      {isLoading ? (
        <div className="text-center py-8">
          <p className="text-gray-300">Loading entries...</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <BookOpen className="w-16 h-16 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-200 mb-2">No journal entries yet</h3>
          <p className="text-gray-400 text-center">
            Record your thoughts, feelings, and progress
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => (
            <Card key={entry.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <Badge variant={entry.entry_type === 'voice' ? 'default' : 'secondary'}>
                        {entry.entry_type === 'voice' ? (
                          <>
                            <Volume2 className="w-3 h-3 mr-1" />
                            Voice
                          </>
                        ) : (
                          <>
                            <FileText className="w-3 h-3 mr-1" />
                            Text
                          </>
                        )}
                      </Badge>
                      <span className="text-sm text-gray-500">{formatDate(entry.created_at)}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteEntry(entry.id)}
                    className="p-2 hover:bg-red-50 rounded-lg transition-colors text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 whitespace-pre-wrap">{entry.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* New Entry Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-gradient-to-r from-gray-900 to-gray-800 border-gray-700">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white">New Journal Entry</CardTitle>
                <button
                  onClick={() => {
                    setShowModal(false);
                    setTextContent('');
                    setEntryType('text');
                    stopRecording();
                  }}
                  className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <CardDescription className="text-gray-300">Choose text or voice input</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Entry Type Toggle */}
              <div className="flex items-center space-x-4 bg-gray-700 rounded-lg p-2">
                <button
                  onClick={() => {
                    setEntryType('text');
                    if (isRecording) stopRecording();
                  }}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                    entryType === 'text'
                      ? 'bg-teal-600 text-white shadow-md'
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  <FileText className="w-4 h-4 inline mr-2" />
                  Text
                </button>
                <button
                  onClick={() => setEntryType('voice')}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                    entryType === 'voice'
                      ? 'bg-teal-600 text-white shadow-md'
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  <Mic className="w-4 h-4 inline mr-2" />
                  Voice
                </button>
              </div>

              {/* Text Input */}
              {entryType === 'text' && (
                <div>
                  <textarea
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                    placeholder="Write your thoughts here..."
                    className="w-full h-64 p-4 bg-gray-600 border border-gray-500 text-white placeholder:text-gray-400 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                  />
                </div>
              )}

              {/* Voice Input */}
              {entryType === 'voice' && (
                <div className="space-y-4">
                  <div className="flex flex-col items-center justify-center py-8 bg-gray-700 rounded-lg border border-gray-600">
                    {isRecording ? (
                      <>
                        <div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center mb-4 animate-pulse">
                          <Mic className="w-10 h-10 text-white" />
                        </div>
                        <p className="text-lg font-semibold text-white mb-2">Recording...</p>
                        <p className="text-3xl font-mono text-red-400">{recordingTime}s</p>
                        <Button
                          onClick={stopRecording}
                          className="mt-4 bg-red-600 hover:bg-red-700 text-white"
                          variant="destructive"
                        >
                          <MicOff className="w-4 h-4 mr-2" />
                          Stop Recording
                        </Button>
                      </>
                    ) : (
                      <>
                        <div className="w-20 h-20 bg-teal-600 rounded-full flex items-center justify-center mb-4">
                          <Mic className="w-10 h-10 text-white" />
                        </div>
                        <p className="text-gray-300 mb-4">Click to start recording</p>
                        <Button onClick={startRecording} className="bg-teal-600 hover:bg-teal-700 text-white">
                          <Mic className="w-4 h-4 mr-2" />
                          Start Recording
                        </Button>
                      </>
                    )}
                  </div>
                  
                  {textContent && (
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">
                        Transcription Preview
                      </label>
                      <textarea
                        value={textContent}
                        onChange={(e) => setTextContent(e.target.value)}
                        className="w-full h-32 p-4 bg-gray-600 border border-gray-500 text-white placeholder:text-gray-400 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  className="flex-1 bg-gray-700 text-white border-gray-600 hover:bg-gray-600"
                  onClick={() => {
                    setShowModal(false);
                    setTextContent('');
                    setEntryType('text');
                    stopRecording();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-teal-600 hover:bg-teal-700 text-white"
                  onClick={handleSaveEntry}
                  disabled={!textContent.trim()}
                >
                  Save Entry
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Journal;
