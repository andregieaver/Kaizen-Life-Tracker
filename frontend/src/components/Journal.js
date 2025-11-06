import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Plus, Mic, MicOff, Trash2, Edit3, FileText, Volume2, X, BookOpen, Video, VideoOff, Play, Check } from 'lucide-react';

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
      setSaveStatus({ type: 'error', message: t('journal.failedToLoadEntries') });
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
          setSaveStatus({ type: '', message: t('journal.transcribing') });
          
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
          setSaveStatus({ type: 'success', message: t('journal.audioTranscribedSuccess') });
        } catch (error) {
          console.error('Error transcribing audio:', error);
          const errorMessage = error.response?.data?.detail || t('journal.failedToTranscribe');
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
      setSaveStatus({ type: 'error', message: t('journal.failedToAccessMicrophone') });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  // Video recording functions
  const startVideoRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true
      });
      
      setVideoStream(stream);
      
      // Show live preview
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      // Start recording
      videoChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp8,opus'
      });
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          videoChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        const videoBlob = new Blob(videoChunksRef.current, { type: 'video/webm' });
        
        // Check file size (50MB limit)
        if (videoBlob.size > 50 * 1024 * 1024) {
          setSaveStatus({ type: 'error', message: t('journal.videoTooLarge') });
          stopVideoStream();
          return;
        }
        
        setVideoBlob(videoBlob);
        const previewUrl = URL.createObjectURL(videoBlob);
        setVideoPreviewUrl(previewUrl);
        
        // Stop camera stream
        stopVideoStream();
        
        // Auto-transcribe the video
        await transcribeVideo(videoBlob);
      };
      
      mediaRecorderRef.current = mediaRecorder;
      
      // Start timer
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      mediaRecorder.start();
      setIsRecording(true);
      setSaveStatus({ type: '', message: t('journal.recordingVideo') });
      
    } catch (error) {
      console.error('Error starting video recording:', error);
      setSaveStatus({ type: 'error', message: t('journal.failedToAccessCamera') });
    }
  };
  
  const stopVideoRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };
  
  const stopVideoStream = () => {
    if (videoStream) {
      videoStream.getTracks().forEach(track => track.stop());
      setVideoStream(null);
    }
  };
  
  const transcribeVideo = async (blob) => {
    try {
      setIsTranscribing(true);
      setSaveStatus({ type: '', message: 'Transcribing video... This may take a minute.' });
      
      const formData = new FormData();
      formData.append('video', blob, 'video.webm');
      
      const response = await axios.post(
        `${API}/journal/transcribe-video/${athleteId}`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 120000 // 2 minute timeout
        }
      );
      
      setVideoTranscription(response.data.transcription);
      setVideoSrtContent(response.data.srt);
      setTextContent(response.data.transcription);
      setSaveStatus({ type: 'success', message: 'Video transcribed successfully!' });
      
    } catch (error) {
      console.error('Error transcribing video:', error);
      setSaveStatus({ 
        type: 'error', 
        message: error.response?.data?.detail || 'Failed to transcribe video. You can still save the video without transcription.' 
      });
    } finally {
      setIsTranscribing(false);
    }
  };
  
  const handleSaveVideoEntry = async () => {
    if (!videoBlob) {
      setSaveStatus({ type: 'error', message: 'No video recorded' });
      return;
    }
    
    if (!videoTranscription.trim()) {
      setSaveStatus({ type: 'error', message: 'Please wait for transcription to complete' });
      return;
    }
    
    try {
      setIsProcessingVideo(true);
      setSaveStatus({ type: '', message: 'Processing video... This may take a moment.' });
      
      const formData = new FormData();
      formData.append('video', videoBlob, 'video.webm');
      formData.append('transcription', videoTranscription);
      formData.append('srt_content', videoSrtContent);
      formData.append('burn_subtitles', burnSubtitles);
      
      const response = await axios.post(
        `${API}/journal/process-video/${athleteId}`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 180000 // 3 minute timeout
        }
      );
      
      setSaveStatus({ type: 'success', message: 'Video journal entry saved!' });
      
      // Clean up and reset
      setShowModal(false);
      resetVideoState();
      await loadJournalEntries();
      
    } catch (error) {
      console.error('Error saving video entry:', error);
      setSaveStatus({ 
        type: 'error', 
        message: error.response?.data?.detail || 'Failed to save video entry' 
      });
    } finally {
      setIsProcessingVideo(false);
    }
  };
  
  const resetVideoState = () => {
    setVideoBlob(null);
    if (videoPreviewUrl) {
      URL.revokeObjectURL(videoPreviewUrl);
    }
    setVideoPreviewUrl(null);
    setVideoTranscription('');
    setVideoSrtContent('');
    setBurnSubtitles(false);
    setTextContent('');
    setEntryType('text');
    stopVideoStream();
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

  // Convert SRT to VTT format for HTML5 video player
  const convertSrtToVtt = (srt) => {
    let vtt = 'WEBVTT\n\n';
    vtt += srt.replace(/(\d+:\d+:\d+),(\d+)/g, '$1.$2');
    return vtt;
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
    <div className="min-h-screen p-2 md:p-6 space-y-6" style={{ background: 'var(--grad-page)' }}>
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
            <div key={entry.id} className="hover:shadow-lg transition-shadow border-0 shadow-lg overflow-hidden rounded-none md:rounded-3xl" style={{ background: 'var(--grad-surface)' }}>
              <div className="p-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <Badge variant={entry.entry_type === 'text' ? 'secondary' : 'default'}>
                        {entry.entry_type === 'voice' ? (
                          <>
                            <Volume2 className="w-3 h-3 mr-1" />
                            Voice
                          </>
                        ) : entry.entry_type === 'video' ? (
                          <>
                            <Video className="w-3 h-3 mr-1" />
                            Video
                          </>
                        ) : (
                          <>
                            <FileText className="w-3 h-3 mr-1" />
                            Text
                          </>
                        )}
                      </Badge>
                      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{formatDate(entry.created_at)}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteEntry(entry.id)}
                    className="p-2 hover:bg-red-900/30 rounded-lg transition-colors text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="p-4">
                {/* Video Player for video entries */}
                {entry.entry_type === 'video' && entry.video_path && (
                  <div className="mb-4">
                    <video
                      src={`${process.env.REACT_APP_BACKEND_URL}${entry.video_path}`}
                      controls
                      className="w-full rounded-lg bg-black"
                    >
                      {entry.subtitle_path && !entry.has_burned_subtitles && (
                        <track
                          kind="subtitles"
                          src={`${process.env.REACT_APP_BACKEND_URL}${entry.subtitle_path}`}
                          srcLang="en"
                          label="English"
                          default
                        />
                      )}
                    </video>
                  </div>
                )}
                <p className="whitespace-pre-wrap" style={{ color: 'var(--text-med)' }}>{entry.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Entry Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-2 md:p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto border-0 shadow-lg overflow-hidden rounded-none md:rounded-3xl border border-gray-700" style={{ background: 'var(--grad-surface)' }}>
            <div className="p-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-hi)' }}>New Journal Entry</h3>
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
              <p className="text-sm mt-1" style={{ color: 'var(--text-med)' }}>Choose text, voice, or video input</p>
            </div>
            <div className="p-4 space-y-4">
              {/* Entry Type Toggle */}
              <div className="flex items-center space-x-2 bg-gray-700 rounded-lg p-2">
                <button
                  onClick={() => {
                    setEntryType('text');
                    if (isRecording) stopRecording();
                    if (isRecording) stopVideoRecording();
                    resetVideoState();
                  }}
                  className={`flex-1 px-3 py-2 rounded-lg font-medium transition-all ${
                    entryType === 'text'
                      ? 'bg-teal-600 text-white shadow-md'
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  <FileText className="w-4 h-4 inline mr-1" />
                  Text
                </button>
                <button
                  onClick={() => {
                    setEntryType('voice');
                    resetVideoState();
                  }}
                  className={`flex-1 px-3 py-2 rounded-lg font-medium transition-all ${
                    entryType === 'voice'
                      ? 'bg-teal-600 text-white shadow-md'
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  <Mic className="w-4 h-4 inline mr-1" />
                  Voice
                </button>
                <button
                  onClick={() => {
                    setEntryType('video');
                    if (isRecording) stopRecording();
                  }}
                  className={`flex-1 px-3 py-2 rounded-lg font-medium transition-all ${
                    entryType === 'video'
                      ? 'bg-teal-600 text-white shadow-md'
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  <Video className="w-4 h-4 inline mr-1" />
                  Video
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

              {/* Video Input */}
              {entryType === 'video' && (
                <div className="space-y-4">
                  {!videoBlob ? (
                    <>
                      {/* Recording UI */}
                      <div className="flex flex-col items-center justify-center py-8 bg-gray-700 rounded-lg border border-gray-600">
                        {isRecording ? (
                          <>
                            {/* Live Video Preview */}
                            <video
                              ref={videoRef}
                              autoPlay
                              muted
                              className="w-full max-w-md rounded-lg mb-4"
                            />
                            <p className="text-lg font-semibold text-white mb-2">Recording...</p>
                            <p className="text-3xl font-mono text-red-400 mb-4">{recordingTime}s</p>
                            <Button
                              onClick={stopVideoRecording}
                              className="bg-red-600 hover:bg-red-700 text-white"
                              variant="destructive"
                            >
                              <VideoOff className="w-4 h-4 mr-2" />
                              Stop Recording
                            </Button>
                          </>
                        ) : (
                          <>
                            <div className="w-20 h-20 bg-teal-600 rounded-full flex items-center justify-center mb-4">
                              <Video className="w-10 h-10 text-white" />
                            </div>
                            <p className="text-gray-300 mb-4">Click to start video recording</p>
                            <Button onClick={startVideoRecording} className="bg-teal-600 hover:bg-teal-700 text-white">
                              <Video className="w-4 h-4 mr-2" />
                              Start Recording
                            </Button>
                          </>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Video Preview with Subtitles */}
                      <div className="space-y-4">
                        <div className="relative">
                          <video
                            ref={videoPreviewRef}
                            src={videoPreviewUrl}
                            controls
                            className="w-full rounded-lg bg-black"
                          >
                            {!burnSubtitles && videoSrtContent && (
                              <track
                                kind="subtitles"
                                src={`data:text/vtt;base64,${btoa(convertSrtToVtt(videoSrtContent))}`}
                                srcLang="en"
                                label="English"
                                default
                              />
                            )}
                          </video>
                          {isTranscribing && (
                            <div className="absolute inset-0 bg-black/70 flex items-center justify-center rounded-lg">
                              <div className="text-center">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500 mx-auto mb-4"></div>
                                <p className="text-white font-medium">Transcribing video...</p>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Transcription Text */}
                        {videoTranscription && (
                          <div>
                            <label className="block text-sm font-medium text-white mb-2">
                              Transcription (Editable)
                            </label>
                            <textarea
                              value={videoTranscription}
                              onChange={(e) => setVideoTranscription(e.target.value)}
                              className="w-full h-32 p-4 bg-gray-600 border border-gray-500 text-white placeholder:text-gray-400 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                            />
                          </div>
                        )}

                        {/* Burn Subtitles Option */}
                        {videoTranscription && (
                          <div className="flex items-center space-x-3 p-4 bg-gray-700 rounded-lg">
                            <input
                              type="checkbox"
                              id="burnSubtitles"
                              checked={burnSubtitles}
                              onChange={(e) => setBurnSubtitles(e.target.checked)}
                              className="w-5 h-5 text-teal-600 rounded focus:ring-teal-500 focus:ring-offset-gray-800"
                            />
                            <label htmlFor="burnSubtitles" className="text-white cursor-pointer flex-1">
                              <span className="font-medium">Burn subtitles into video</span>
                              <p className="text-sm text-gray-400 mt-1">
                                Add permanent white subtitles with black background to the video file
                              </p>
                            </label>
                          </div>
                        )}

                        {/* Re-record Button */}
                        <Button
                          onClick={() => {
                            resetVideoState();
                          }}
                          variant="outline"
                          className="w-full bg-gray-700 text-white border-gray-600 hover:bg-gray-600"
                        >
                          <Video className="w-4 h-4 mr-2" />
                          Record Again
                        </Button>
                      </div>
                    </>
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
                    stopVideoRecording();
                    resetVideoState();
                  }}
                  disabled={isProcessingVideo}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-teal-600 hover:bg-teal-700 text-white"
                  onClick={entryType === 'video' ? handleSaveVideoEntry : handleSaveEntry}
                  disabled={
                    entryType === 'video' 
                      ? (!videoBlob || !videoTranscription || isTranscribing || isProcessingVideo)
                      : !textContent.trim()
                  }
                >
                  {isProcessingVideo ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Processing...
                    </>
                  ) : isTranscribing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Transcribing...
                    </>
                  ) : (
                    'Save Entry'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Journal;
