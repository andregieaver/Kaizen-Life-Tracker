import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Plus, Mic, MicOff, Trash2, Edit3, FileText, Volume2, X, BookOpen, Video, VideoOff, Play, Check } from 'lucide-react';

import { logger } from '../utils/logger';
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Journal = ({ athleteId }) => {
  const { t } = useTranslation();
  const [entries, setEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [entryType, setEntryType] = useState('text'); // 'text' or 'voice'
  const [previousEntryType, setPreviousEntryType] = useState('text'); // For animation
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

  // Update journal entry type bubble position dynamically
  useLayoutEffect(() => {
    const updateBubblePosition = () => {
      const buttonContainer = document.querySelector('.journal-entry-type-switcher');
      const activeButton = buttonContainer?.querySelector(`button[data-entry-type="${entryType}"]`);
      
      if (buttonContainer && activeButton) {
        const containerRect = buttonContainer.getBoundingClientRect();
        const buttonRect = activeButton.getBoundingClientRect();
        
        const leftOffset = buttonRect.left - containerRect.left;
        const width = buttonRect.width;
        
        buttonContainer.style.setProperty('--bubble-left', `${leftOffset}px`);
        buttonContainer.style.setProperty('--bubble-width', `${width}px`);
      }
    };

    updateBubblePosition();
    const timer1 = setTimeout(updateBubblePosition, 50);
    const timer2 = setTimeout(updateBubblePosition, 200);
    
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [entryType]);

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

  // Auto-start camera preview when video mode is selected
  useEffect(() => {
    if (showModal && entryType === 'video' && !videoBlob && !videoStream && !isRecording) {
      startCameraPreview();
    }
    
    // Clean up camera stream when modal closes or switching away from video
    return () => {
      if ((!showModal || entryType !== 'video') && videoStream) {
        stopVideoStream();
      }
    };
  }, [showModal, entryType, videoBlob]);

  const loadJournalEntries = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(`${API}/journal/${athleteId}`);
      setEntries(response.data.entries || []);
    } catch (error) {
      logger.error(null, 'Error loading journal entries:', error);
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
          logger.error(null, 'Error transcribing audio:', error);
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
      logger.error(null, 'Error starting recording:', error);
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
  const startCameraPreview = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: 1280, 
          height: 720,
          facingMode: 'user' // Use front camera on mobile
        },
        audio: true
      });
      
      setVideoStream(stream);
      
      // Show live preview
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Explicitly play the video to ensure preview shows
        try {
          await videoRef.current.play();
        } catch (playError) {
          logger.error(null, 'Error playing video preview:', playError);
        }
      }
    } catch (error) {
      logger.error(null, 'Error starting camera preview:', error);
      setSaveStatus({ type: 'error', message: t('journal.failedToAccessCamera') });
    }
  };

  const startVideoRecording = async () => {
    try {
      // If camera preview is not already started, start it
      if (!videoStream) {
        await startCameraPreview();
        // Wait a bit for stream to initialize
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      const stream = videoStream || videoRef.current?.srcObject;
      
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
      logger.error(null, 'Error starting video recording:', error);
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
      setSaveStatus({ type: '', message: t('journal.transcribingVideo') });
      
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
      setSaveStatus({ type: 'success', message: t('journal.videoTranscribedSuccess') });
      
    } catch (error) {
      logger.error(null, 'Error transcribing video:', error);
      setSaveStatus({ 
        type: 'error', 
        message: error.response?.data?.detail || t('journal.failedToTranscribeVideo')
      });
    } finally {
      setIsTranscribing(false);
    }
  };
  
  const handleSaveVideoEntry = async () => {
    if (!videoBlob) {
      setSaveStatus({ type: 'error', message: t('journal.noVideoRecorded') });
      return;
    }
    
    if (!videoTranscription.trim()) {
      setSaveStatus({ type: 'error', message: t('journal.waitForTranscription') });
      return;
    }
    
    try {
      setIsProcessingVideo(true);
      setSaveStatus({ type: '', message: t('journal.processingVideo') });
      
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
      
      setSaveStatus({ type: 'success', message: t('journal.videoEntrySaved') });
      
      // Clean up and reset
      setShowModal(false);
      resetVideoState();
      await loadJournalEntries();
      
    } catch (error) {
      logger.error(null, 'Error saving video entry:', error);
      setSaveStatus({ 
        type: 'error', 
        message: error.response?.data?.detail || t('journal.failedToSaveVideo')
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
      setSaveStatus({ type: 'error', message: t('journal.enterContent') });
      return;
    }

    try {
      await axios.post(`${API}/journal`, {
        athlete_id: athleteId,
        content: textContent,
        entry_type: entryType
      });

      setSaveStatus({ type: 'success', message: t('journal.journalEntrySaved') });
      setShowModal(false);
      setTextContent('');
      setEntryType('text');
      await loadJournalEntries();
    } catch (error) {
      logger.error(null, 'Error saving journal entry:', error);
      setSaveStatus({ type: 'error', message: t('journal.failedToSaveEntry') });
    }
  };

  const handleDeleteEntry = async (entryId) => {
    if (!window.confirm(t('journal.confirmDeleteEntry'))) {
      return;
    }

    try {
      await axios.delete(`${API}/journal/${entryId}`);
      setSaveStatus({ type: 'success', message: t('journal.entryDeleted') });
      await loadJournalEntries();
    } catch (error) {
      logger.error(null, 'Error deleting entry:', error);
      setSaveStatus({ type: 'error', message: t('journal.failedToDeleteEntry') });
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
          <h1 className="text-2xl font-bold text-white">{t('journal.title')}</h1>
          <p className="text-gray-300 mt-1">{t('journal.subtitle')}</p>
        </div>
        <Button 
          onClick={() => setShowModal(true)}
          className="text-white border-0 w-10 h-10 md:w-12 md:h-12 p-0 flex items-center justify-center"
          style={{ backgroundColor: '#32D3FF', borderRadius: '99px' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1FC1FF'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#32D3FF'}
        >
          <Plus className="w-5 h-5 md:w-6 md:h-6" />
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
          <p className="text-gray-300">{t('journal.loadingEntries')}</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <BookOpen className="w-16 h-16 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-200 mb-2">{t('journal.noEntriesYet')}</h3>
          <p className="text-gray-400 text-center">
            {t('journal.noEntriesSubtitle')}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => (
            <div 
              key={entry.id} 
              className="hover:shadow-lg transition-shadow border-0 shadow-lg overflow-hidden mx-4 my-3"
              style={{ 
                background: 'color-mix(in srgb, var(--c-glass) 10%, transparent)',
                backdropFilter: 'blur(8px) saturate(150%)',
                WebkitBackdropFilter: 'blur(8px) saturate(150%)',
                borderRadius: '8px',
                boxShadow: `
                  inset 0 1px 1px rgba(255, 255, 255, 0.1),
                  0 2px 8px rgba(0, 0, 0, 0.3)
                `
              }}
            >
              <div className="p-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <Badge variant={entry.entry_type === 'text' ? 'secondary' : 'default'}>
                        {entry.entry_type === 'voice' ? (
                          <>
                            <Volume2 className="w-3 h-3 mr-1" />
                            {t('journal.entryTypes.voice')}
                          </>
                        ) : entry.entry_type === 'video' ? (
                          <>
                            <Video className="w-3 h-3 mr-1" />
                            {t('journal.entryTypes.video')}
                          </>
                        ) : (
                          <>
                            <FileText className="w-3 h-3 mr-1" />
                            {t('journal.entryTypes.text')}
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
                <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-hi)' }}>{t('journal.newJournalEntry')}</h3>
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
              <p className="text-sm mt-1" style={{ color: 'var(--text-med)' }}>{t('journal.chooseInputType')}</p>
            </div>
            <div className="p-4 space-y-4">
              {/* Entry Type Toggle */}
              <div 
                className="journal-entry-type-switcher flex items-center space-x-2 p-2 relative"
                data-previous={previousEntryType}
                style={{
                  background: 'color-mix(in srgb, var(--c-glass) 12%, transparent)',
                  backdropFilter: 'blur(8px) saturate(150%)',
                  WebkitBackdropFilter: 'blur(8px) saturate(150%)',
                  borderRadius: '99em',
                  boxShadow: `
                    inset 0 2px 4px -1px rgba(0,0,0,0.3),
                    inset 0 -1px 2px rgba(255,255,255,0.05)
                  `,
                  '--bubble-left': '0px',
                  '--bubble-width': '100px'
                }}
              >
                <button
                  type="button"
                  data-entry-type="text"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setPreviousEntryType(entryType);
                    setEntryType('text');
                    if (isRecording) stopRecording();
                    if (isRecording) stopVideoRecording();
                    resetVideoState();
                  }}
                  style={{
                    color: entryType === 'text' ? 'var(--bg-950)' : 'var(--text-med)',
                    cursor: 'pointer',
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    position: 'relative',
                    zIndex: 1
                  }}
                  className="flex-1 px-4 py-2.5 rounded-full font-medium transition-colors flex items-center justify-center"
                >
                  <FileText className="w-4 h-4 mr-1.5" />
                  {t('journal.text')}
                </button>
                <button
                  type="button"
                  data-entry-type="voice"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setPreviousEntryType(entryType);
                    // Clear video state first
                    setVideoBlob(null);
                    if (videoPreviewUrl) {
                      URL.revokeObjectURL(videoPreviewUrl);
                    }
                    setVideoPreviewUrl(null);
                    setVideoTranscription('');
                    setVideoSrtContent('');
                    setBurnSubtitles(false);
                    stopVideoStream();
                    // Then set to voice mode
                    setEntryType('voice');
                  }}
                  style={{
                    color: entryType === 'voice' ? 'var(--bg-950)' : 'var(--text-med)',
                    cursor: 'pointer',
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    position: 'relative',
                    zIndex: 1
                  }}
                  className="flex-1 px-4 py-2.5 rounded-full font-medium transition-colors flex items-center justify-center"
                >
                  <Mic className="w-4 h-4 mr-1.5" />
                  {t('journal.voice')}
                </button>
                <button
                  type="button"
                  data-entry-type="video"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setPreviousEntryType(entryType);
                    setEntryType('video');
                    if (isRecording) stopRecording();
                  }}
                  style={{
                    color: entryType === 'video' ? 'var(--bg-950)' : 'var(--text-med)',
                    cursor: 'pointer',
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    position: 'relative',
                    zIndex: 1
                  }}
                  className="flex-1 px-4 py-2.5 rounded-full font-medium transition-colors flex items-center justify-center"
                >
                  <Video className="w-4 h-4 mr-1.5" />
                  {t('journal.video')}
                </button>
              </div>

              {/* Text Input */}
              {entryType === 'text' && (
                <div>
                  <textarea
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                    placeholder={t('journal.writeThoughtsPlaceholder')}
                    className="w-full h-64 p-4 bg-gray-600 border border-gray-500 text-white placeholder:text-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
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
                        <p className="text-lg font-semibold text-white mb-2">{t('journal.recording')}</p>
                        <p className="text-3xl font-mono text-red-400">{recordingTime}s</p>
                        <Button
                          onClick={stopRecording}
                          className="mt-4 bg-red-600 hover:bg-red-700 text-white"
                          variant="destructive"
                        >
                          <MicOff className="w-4 h-4 mr-2" />
                          {t('journal.stopRecording')}
                        </Button>
                      </>
                    ) : (
                      <>
                        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: '#32D3FF' }}>
                          <Mic className="w-10 h-10 text-white" />
                        </div>
                        <p className="text-gray-300 mb-4">{t('journal.clickToStart')}</p>
                        <Button 
                          onClick={startRecording} 
                          className="text-white border-0"
                          style={{ backgroundColor: '#32D3FF' }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1FC1FF'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#32D3FF'}
                        >
                          <Mic className="w-4 h-4 mr-2" />
                          {t('journal.startRecording')}
                        </Button>
                      </>
                    )}
                  </div>
                  
                  {textContent && (
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">
                        {t('journal.transcriptionPreview')}
                      </label>
                      <textarea
                        value={textContent}
                        onChange={(e) => setTextContent(e.target.value)}
                        className="w-full h-32 p-4 bg-gray-600 border border-gray-500 text-white placeholder:text-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
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
                            <p className="text-lg font-semibold text-white mb-2">{t('journal.recording')}</p>
                            <p className="text-3xl font-mono text-red-400 mb-4">{recordingTime}s</p>
                            <Button
                              onClick={stopVideoRecording}
                              className="bg-red-600 hover:bg-red-700 text-white"
                              variant="destructive"
                            >
                              <VideoOff className="w-4 h-4 mr-2" />
                              {t('journal.stopRecordingVideo')}
                            </Button>
                          </>
                        ) : (
                          <>
                            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: '#32D3FF' }}>
                              <Video className="w-10 h-10 text-white" />
                            </div>
                            <p className="text-gray-300 mb-4">{t('journal.clickToStartVideo')}</p>
                            <Button 
                              onClick={startVideoRecording} 
                              className="text-white border-0"
                              style={{ backgroundColor: '#32D3FF' }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1FC1FF'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#32D3FF'}
                            >
                              <Video className="w-4 h-4 mr-2" />
                              {t('journal.startRecording')}
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
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderBottomColor: '#32D3FF' }}></div>
                                <p className="text-white font-medium">{t('journal.transcribingVideo')}</p>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Transcription Text */}
                        {videoTranscription && (
                          <div>
                            <label className="block text-sm font-medium text-white mb-2">
                              {t('journal.transcriptionEditable')}
                            </label>
                            <textarea
                              value={videoTranscription}
                              onChange={(e) => setVideoTranscription(e.target.value)}
                              className="w-full h-32 p-4 bg-gray-600 border border-gray-500 text-white placeholder:text-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
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
                              className="w-5 h-5 rounded focus:ring-blue-500 focus:ring-offset-gray-800"
                              style={{ color: '#32D3FF' }}
                            />
                            <label htmlFor="burnSubtitles" className="text-white cursor-pointer flex-1">
                              <span className="font-medium">{t('journal.burnSubtitles')}</span>
                              <p className="text-sm text-gray-400 mt-1">
                                {t('journal.burnSubtitlesDescription')}
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
                          {t('journal.recordAgain')}
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
                  {t('journal.cancel')}
                </Button>
                <Button
                  className="flex-1 text-white border-0"
                  style={{ backgroundColor: '#32D3FF' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1FC1FF'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#32D3FF'}
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
                      {t('journal.processing')}
                    </>
                  ) : isTranscribing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      {t('journal.transcribingShort')}
                    </>
                  ) : (
                    t('journal.saveEntry')
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
