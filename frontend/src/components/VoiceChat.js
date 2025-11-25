import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { logger } from '../utils/logger';
class RealtimeAudioChat {
    constructor(backendUrl, athleteId, onTranscriptUpdate, apiBasePath = '/coach/voice') {
        this.backendUrl = backendUrl;
        this.athleteId = athleteId;
        this.peerConnection = null;
        this.dataChannel = null;
        this.audioElement = null;
        this.localStream = null;
        this.onTranscriptUpdate = onTranscriptUpdate;
        this.sessionId = null;
        this.transcript = [];
        this.sessionStartTime = null;
        this.apiBasePath = apiBasePath;
    }

    async init() {
        try {
            // Generate session ID for this voice conversation
            this.sessionId = `voice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            this.sessionStartTime = new Date();
            this.transcript = [];
            
            // Get session from backend
            const tokenResponse = await fetch(`${this.backendUrl}/api${this.apiBasePath}/session/${this.athleteId}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                }
            });
            
            if (!tokenResponse.ok) {
                const errorData = await tokenResponse.json();
                if (tokenResponse.status === 400 && errorData.detail?.includes("OpenAI API key")) {
                    throw new Error("OpenAI API key required for voice chat. Please add your API key in Account Settings.");
                }
                throw new Error(errorData.detail || "Failed to create voice session");
            }
            
            const data = await tokenResponse.json();
            if (!data.client_secret?.value) {
                throw new Error("Failed to get session token");
            }

            // Create and set up WebRTC peer connection
            this.peerConnection = new RTCPeerConnection({
                iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
            });
            
            this.setupAudioElement();
            await this.setupLocalAudio();
            this.setupDataChannel();

            // Create and send offer
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);

            // Send offer to backend and get answer
            const response = await fetch(`${this.backendUrl}/api${this.apiBasePath}/negotiate/${this.athleteId}`, {
                method: "POST",
                body: offer.sdp,
                headers: {
                    "Content-Type": "application/sdp"
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                if (response.status === 400 && errorData.detail?.includes("OpenAI API key")) {
                    throw new Error("OpenAI API key required for voice chat. Please add your API key in Account Settings.");
                }
                throw new Error(errorData.detail || "Failed to negotiate WebRTC connection");
            }

            const { sdp: answerSdp } = await response.json();
            const answer = {
                type: "answer",
                sdp: answerSdp
            };

            await this.peerConnection.setRemoteDescription(answer);
            logger.debug(null, "WebRTC connection established");
            return true;
        } catch (error) {
            logger.error(null, "Failed to initialize audio chat:", error);
            throw error;
        }
    }

    setupAudioElement() {
        this.audioElement = document.createElement("audio");
        this.audioElement.autoplay = true;
        this.audioElement.style.display = 'none';
        document.body.appendChild(this.audioElement);

        this.peerConnection.ontrack = (event) => {
            logger.debug(null, "Received remote audio track");
            this.audioElement.srcObject = event.streams[0];
        };
    }

    async setupLocalAudio() {
        this.localStream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });
        
        this.localStream.getTracks().forEach(track => {
            this.peerConnection.addTrack(track, this.localStream);
        });
        
        logger.debug(null, "Local audio stream setup complete");
    }

    setupDataChannel() {
        this.dataChannel = this.peerConnection.createDataChannel("oai-events");
        
        this.dataChannel.onopen = () => {
            logger.debug(null, "Data channel opened");
        };
        
        this.dataChannel.onmessage = (event) => {
            try {
                const eventData = JSON.parse(event.data);
                logger.debug(null, "Received event:", eventData);
                
                // Handle transcript events from OpenAI Realtime API
                if (eventData.type === 'conversation.item.input_audio_transcription.completed') {
                    // User speech transcribed
                    this.addToTranscript('user', eventData.transcript, new Date());
                } else if (eventData.type === 'response.audio_transcript.done') {
                    // Assistant response transcribed
                    this.addToTranscript('assistant', eventData.transcript, new Date());
                } else if (eventData.type === 'conversation.item.created' && eventData.item?.type === 'message') {
                    // Alternative way to get transcripts
                    const content = eventData.item?.content;
                    if (content && Array.isArray(content)) {
                        content.forEach(part => {
                            if (part.type === 'input_text' || part.type === 'text') {
                                const role = eventData.item.role || 'assistant';
                                this.addToTranscript(role, part.text, new Date());
                            }
                        });
                    }
                }
            } catch (error) {
                logger.error(null, "Error parsing data channel event:", error);
            }
        };
        
        this.dataChannel.onerror = (error) => {
            logger.error(null, "Data channel error:", error);
        };
    }
    
    addToTranscript(role, content, timestamp) {
        if (content && content.trim()) {
            const transcriptEntry = {
                role: role,
                content: content.trim(),
                timestamp: timestamp.toISOString()
            };
            
            this.transcript.push(transcriptEntry);
            logger.debug(null, `Added to transcript [${role}]: ${content.trim()}`);
            
            // Notify parent component of transcript update
            if (this.onTranscriptUpdate) {
                this.onTranscriptUpdate(this.transcript);
            }
        }
    }

    async disconnect() {
        try {
            // Save the conversation if we have transcript data
            await this.saveConversation();
            
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => track.stop());
            }
            
            if (this.dataChannel) {
                this.dataChannel.close();
            }
            
            if (this.peerConnection) {
                this.peerConnection.close();
            }
            
            if (this.audioElement) {
                document.body.removeChild(this.audioElement);
            }
            
            logger.debug(null, "Voice chat disconnected");
        } catch (error) {
            logger.error(null, "Error disconnecting:", error);
        }
    }
    
    async saveConversation() {
        if (!this.transcript || this.transcript.length === 0) {
            logger.debug(null, "No transcript to save");
            return;
        }
        
        try {
            const durationSeconds = this.sessionStartTime ? 
                Math.round((new Date() - this.sessionStartTime) / 1000) : null;
            
            const conversationData = {
                athlete_id: this.athleteId,
                session_id: this.sessionId,
                transcript: this.transcript,
                duration_seconds: durationSeconds
            };
            
            logger.debug(null, "Saving voice conversation:", conversationData);
            
            const response = await fetch(`${this.backendUrl}/api${this.apiBasePath}/save-conversation`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(conversationData)
            });
            
            if (response.ok) {
                logger.debug(null, "Voice conversation saved successfully");
            } else {
                const errorData = await response.json();
                logger.error(null, "Failed to save voice conversation:", errorData);
            }
        } catch (error) {
            logger.error(null, "Error saving voice conversation:", error);
        }
    }
}

const VoiceChat = React.forwardRef(({ backendUrl, athleteId, onError, apiBasePath = '/coach/voice', autoStart = false }, ref) => {
    const { t } = useTranslation();
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState(null);
    const [micPermission, setMicPermission] = useState('prompt');
    const [transcript, setTranscript] = useState([]);
    
    const realtimeChatRef = useRef(null);

    // Check microphone permission on component mount
    useEffect(() => {
        const checkMicPermission = async () => {
            try {
                const permissionStatus = await navigator.permissions.query({ name: 'microphone' });
                setMicPermission(permissionStatus.state);
                
                permissionStatus.addEventListener('change', () => {
                    setMicPermission(permissionStatus.state);
                });
            } catch (error) {
                logger.debug(null, "Could not check microphone permission:", error);
            }
        };
        
        checkMicPermission();
    }, []);

    // Auto-start voice chat if autoStart is true
    useEffect(() => {
        if (autoStart && !isConnected && !isConnecting) {
            // Small delay to ensure component is mounted
            const timer = setTimeout(() => {
                startVoiceChat();
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [autoStart]);

    const startVoiceChat = useCallback(async () => {
        logger.debug(null, '=== VOICECHAT: startVoiceChat called ===');
        logger.debug(null, 'VoiceChat: athleteId:', athleteId);
        logger.debug(null, 'VoiceChat: backendUrl:', backendUrl);
        logger.debug(null, 'VoiceChat: isConnecting:', isConnecting);
        logger.debug(null, 'VoiceChat: isConnected:', isConnected);
        logger.debug(null, 'VoiceChat: micPermission:', micPermission);
        
        if (isConnecting || isConnected) {
            logger.debug(null, '⚠️ VoiceChat: Already connecting or connected, returning');
            return;
        }
        
        setIsConnecting(true);
        setError(null);
        
        try {
            logger.debug(null, '🎤 VoiceChat: Checking microphone permission...');
            // Check for microphone permission first
            if (micPermission === 'denied') {
                throw new Error("Microphone permission is required for voice chat. Please enable it in your browser settings.");
            }
            
            realtimeChatRef.current = new RealtimeAudioChat(backendUrl, athleteId, setTranscript, apiBasePath);
            await realtimeChatRef.current.init();
            
            setIsConnected(true);
            setIsConnecting(false);
        } catch (error) {
            logger.error(null, "Voice chat error:", error);
            setError(error.message);
            setIsConnecting(false);
            if (onError) onError(error.message);
            
            // Clean up on error
            if (realtimeChatRef.current) {
                await realtimeChatRef.current.disconnect();
                realtimeChatRef.current = null;
            }
        }
    }, [backendUrl, athleteId, isConnecting, isConnected, micPermission, onError, apiBasePath]);

    const stopVoiceChat = useCallback(async () => {
        if (!isConnected) return;
        
        try {
            if (realtimeChatRef.current) {
                await realtimeChatRef.current.disconnect();
                realtimeChatRef.current = null;
            }
            
            setIsConnected(false);
            setError(null);
            setTranscript([]); // Clear transcript when stopping
        } catch (error) {
            logger.error(null, "Error stopping voice chat:", error);
            setError("Error stopping voice chat");
        }
    }, [isConnected]);

    // Expose startVoiceChat and stopVoiceChat to parent component
    React.useImperativeHandle(ref, () => {
        logger.debug(null, 'VoiceChat: useImperativeHandle called, exposing functions');
        return {
            startVoiceChat,
            stopVoiceChat,
            isConnected,
            isConnecting
        };
    });

    // Clean up on component unmount
    useEffect(() => {
        return () => {
            if (realtimeChatRef.current && isConnected) {
                realtimeChatRef.current.disconnect();
            }
        };
    }, [isConnected]);

    return (
        <div className="voice-chat-container">
            <div className="voice-chat-controls">
                {!isConnected && !isConnecting && (
                    <button
                        onClick={startVoiceChat}
                        className="voice-chat-button start-button"
                        disabled={micPermission === 'denied'}
                        title={micPermission === 'denied' ? t('voiceChat.micPermissionRequired') : t('voiceChat.startVoice')}
                    >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                        {t('voiceChat.startVoice')}
                    </button>
                )}
                
                {isConnecting && (
                    <div className="voice-chat-button connecting-button">
                        <svg className="animate-spin w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {t('voiceChat.connecting')}
                    </div>
                )}
                
                {isConnected && (
                    <button
                        onClick={stopVoiceChat}
                        className="voice-chat-button stop-button"
                    >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                        </svg>
                        {t('voiceChat.stopVoice')}
                    </button>
                )}
            </div>
            
            {isConnected && (
                <div className="voice-chat-status">
                    <div className="flex items-center text-green-600">
                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse mr-2"></div>
                        {t('voiceChat.connected')}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                        {t('voiceChat.speakNow')}
                    </p>
                </div>
            )}
            
            {/* Live Transcript Display */}
            {isConnected && transcript.length > 0 && (
                <div className="voice-transcript">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Live Transcript:</h4>
                    <div className="transcript-messages">
                        {transcript.slice(-6).map((entry, index) => (
                            <div key={index} className={`transcript-message ${entry.role}`}>
                                <span className="transcript-role">
                                    {entry.role === 'user' ? 'You:' : 'Coach:'}
                                </span>
                                <span className="transcript-content">{entry.content}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            {error && (
                <div className="voice-chat-error">
                    <p className="text-red-600 text-sm">{error}</p>
                    {error.includes('OpenAI API key') && (
                        <p className="text-gray-600 text-xs mt-1">
                            {t('voiceChat.apiKeyRequired')}
                        </p>
                    )}
                </div>
            )}
            
            {micPermission === 'denied' && (
                <div className="voice-chat-permission-warning">
                    <p className="text-amber-600 text-sm">
                        {t('voiceChat.micPermissionDenied')}
                    </p>
                </div>
            )}
        </div>
    );
});

VoiceChat.displayName = 'VoiceChat';

export default VoiceChat;