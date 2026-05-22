import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  AppStateStatus,
  PermissionsAndroid,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Audio } from 'expo-av';
import * as SecureStore from 'expo-secure-store';

import { useSessionContext } from '@/context/SessionContext';
import { getApiBaseUrl } from '@/constants/Config';
import { api } from '@/lib/http';
import { nudgeInboxHeader } from '@/lib/inbox-header-nudge';
import { getActiveSocket } from '@/lib/socketClient';
import type { WhatsAppIncomingCallPayload } from '@/types/whatsapp-call';

// Permission check and request utility
export async function checkAndRequestMicPermission(): Promise<boolean> {
  try {
    const { granted } = await Audio.requestPermissionsAsync();
    return granted;
  } catch (err) {
    console.warn('[Permissions] Failed to request mic permission:', err);
    return false;
  }
}

function callIdsLooselyMatch(a: string, b: string): boolean {
  const sa = String(a).trim().toLowerCase();
  const sb = String(b).trim().toLowerCase();
  if (!sa || !sb) return false;
  if (sa === sb) return true;
  return sa.includes(sb) || sb.includes(sa);
}

export interface ActiveCallState {
  callId: string;
  contactId: string;
  contactName: string;
  phoneNumber: string;
  direction: 'incoming' | 'outgoing';
  status: 'ringing' | 'calling' | 'connecting' | 'connected' | 'ended';
  sdpOffer?: string;
}

// Global triggers
let globalShowIncomingCall: ((payload: WhatsAppIncomingCallPayload) => void) | null = null;
let globalStartOutgoingCall: ((contactId: string, contactName: string, phoneNumber: string) => void) | null = null;

export function showIncomingCallScreen(payload: WhatsAppIncomingCallPayload) {
  if (globalShowIncomingCall) {
    globalShowIncomingCall(payload);
  } else {
    queueMicrotask(() => globalShowIncomingCall?.(payload));
  }
}

export function startOutgoingCall(contactId: string, contactName: string, phoneNumber: string) {
  if (globalStartOutgoingCall) {
    globalStartOutgoingCall(contactId, contactName, phoneNumber);
  } else {
    queueMicrotask(() => globalStartOutgoingCall?.(contactId, contactName, phoneNumber));
  }
}

// Inline HTML to load standard WebRTC scripts inside the hidden WebView
const WEBRTC_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>WebRTC Tunnel</title>
  <style>
    body { font-family: sans-serif; background: #000; color: #fff; margin: 0; padding: 20px; font-size: 11px; }
    #log { white-space: pre-wrap; word-break: break-all; }
  </style>
</head>
<body>
  <h3>WebRTC Call Helper</h3>
  <div id="log">Ready.</div>

  <script>
    const logEl = document.getElementById('log');
    function log(msg) {
      logEl.innerHTML += "\\n" + msg;
      console.log("[WebView WebRTC]", msg);
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'log', message: msg }));
    }

    let pc = null;
    let localStream = null;

    const iceServers = [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
      { urls: "stun:stun3.l.google.com:19302" },
      { urls: "stun:stun4.l.google.com:19302" }
    ];

    function closePeerConnection() {
      log("Closing connection...");
      if (pc) {
        pc.close();
        pc = null;
      }
      if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
        localStream = null;
      }
      if (window.activeTtsAudio) {
        try {
          window.activeTtsAudio.pause();
          window.activeTtsAudio.src = "";
          window.activeTtsAudio = null;
        } catch(e){}
      }
      if (window.activeAudioContext) {
        try {
          window.activeAudioContext.close();
          window.activeAudioContext = null;
        } catch(e){}
      }
      const audios = document.querySelectorAll('audio');
      audios.forEach(a => {
        a.srcObject = null;
        a.remove();
      });
      log("Connection cleared.");
    }

    // Direct Mobile-to-WebView API Tunnel
    window.webrtcTunnel = async (data) => {
      if (!data || typeof data !== 'object') return;
      log("Received action direct: " + data.type);

      if (data.type === 'accept-call') {
        try {
          closePeerConnection();
          const { callId, sdpOffer, autoAttend, ttsUrl } = data;
          
          log("Acquiring microphone...");
          localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          log("Microphone acquired.");

          let streamToSend = localStream;

          if (autoAttend) {
            log("Auto-attend active. Preparing Web Audio mixer...");
            try {
              const AudioContext = window.AudioContext || window.webkitAudioContext;
              const audioCtx = new AudioContext();
              window.activeAudioContext = audioCtx;

              // Create mic source & gain
              const micSource = audioCtx.createMediaStreamSource(localStream);
              const micGain = audioCtx.createGain();
              micGain.gain.setValueAtTime(0, audioCtx.currentTime); // initially muted
              micSource.connect(micGain);
              window.activeMicGain = micGain;

              // Create TTS audio & source & gain
              const ttsAudio = document.createElement("audio");
              ttsAudio.crossOrigin = "anonymous";
              ttsAudio.src = ttsUrl || "/api/whatsapp/calls/tts";
              const ttsSource = audioCtx.createMediaElementSource(ttsAudio);
              const ttsGain = audioCtx.createGain();
              ttsGain.gain.setValueAtTime(1, audioCtx.currentTime); // initially full volume
              ttsSource.connect(ttsGain);
              window.activeTtsAudio = ttsAudio;
              window.activeTtsGain = ttsGain;

              // Connect to destination
              const dest = audioCtx.createMediaStreamDestination();
              micGain.connect(dest);
              ttsGain.connect(dest);

              streamToSend = dest.stream;

              ttsAudio.play().then(() => {
                log("TTS greeting playing...");
              }).catch(e => {
                log("TTS Play Failed: " + e.message);
                // Fallback: unmute mic immediately if TTS fails to play
                micGain.gain.setValueAtTime(1, audioCtx.currentTime);
              });

              ttsAudio.onended = () => {
                log("TTS finished. Smoothly unmuting microphone...");
                micGain.gain.linearRampToValueAtTime(1, audioCtx.currentTime + 0.5);
                ttsGain.gain.setValueAtTime(0, audioCtx.currentTime);
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'tts-ended',
                  callId
                }));
              };
            } catch (audioErr) {
              log("AudioContext setup failed, using fallback raw stream: " + audioErr.message);
              streamToSend = localStream;
            }
          }

          pc = new RTCPeerConnection({ iceServers, iceCandidatePoolSize: 10 });
          streamToSend.getTracks().forEach(track => pc.addTrack(track, streamToSend));

          pc.ontrack = (evt) => {
            if (evt.track.kind !== "audio") return;
            log("Remote audio track received!");
            const remoteStream = evt.streams[0] || new MediaStream([evt.track]);
            
            let audioEl = document.createElement("audio");
            audioEl.autoplay = true;
            audioEl.setAttribute("playsinline", "true");
            audioEl.srcObject = remoteStream;
            document.body.appendChild(audioEl);
            audioEl.play().catch(e => log("Audio play failed: " + e.message));
          };

          pc.onconnectionstatechange = () => {
            log("Connection state: " + pc.connectionState);
            window.ReactNativeWebView.postMessage(JSON.stringify({ 
              type: 'connection-state', 
              state: pc.connectionState 
            }));
          };

          log("Setting remote description (offer)...");
          await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: sdpOffer }));

          log("Creating answer...");
          const answer = await pc.createAnswer();
          
          log("Setting local description (answer)...");
          await pc.setLocalDescription(answer);

          // ICE gathering setup
          await Promise.race([
            new Promise(resolve => {
              if (pc.iceGatheringState === "complete") resolve();
              else {
                pc.onicegatheringstatechange = () => {
                  if (pc.iceGatheringState === "complete") {
                    pc.onicegatheringstatechange = null;
                    resolve();
                  }
                };
              }
            }),
            new Promise(r => setTimeout(r, 8000)) // Increased to 8s for cellular networks
          ]);

          const localSdp = pc.localDescription?.sdp;
          if (!localSdp) {
            throw new Error("No local SDP answer");
          }

          log("SDP answer gathered. Answering...");
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'accept-answer',
            callId,
            sdp: localSdp
          }));

        } catch (err) {
          log("Accept call failed: " + err.message);
          window.ReactNativeWebView.postMessage(JSON.stringify({ 
            type: 'error', 
            error: err.message 
          }));
        }
      } 
      
      else if (data.type === 'initiate-call') {
        try {
          closePeerConnection();
          const { contactId } = data;

          log("Acquiring microphone...");
          localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          log("Microphone acquired.");

          pc = new RTCPeerConnection({ iceServers, iceCandidatePoolSize: 10 });
          localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

          pc.ontrack = (evt) => {
            if (evt.track.kind !== "audio") return;
            log("Remote audio track received!");
            const remoteStream = evt.streams[0] || new MediaStream([evt.track]);
            
            let audioEl = document.createElement("audio");
            audioEl.autoplay = true;
            audioEl.setAttribute("playsinline", "true");
            audioEl.srcObject = remoteStream;
            document.body.appendChild(audioEl);
            audioEl.play().catch(e => log("Audio play failed: " + e.message));
          };

          pc.onconnectionstatechange = () => {
            log("Connection state: " + pc.connectionState);
            window.ReactNativeWebView.postMessage(JSON.stringify({ 
              type: 'connection-state', 
              state: pc.connectionState 
            }));
          };

          log("Creating offer...");
          const offer = await pc.createOffer();
          
          log("Setting local description (offer)...");
          await pc.setLocalDescription(offer);

          // ICE gathering setup
          await Promise.race([
            new Promise(resolve => {
              if (pc.iceGatheringState === "complete") resolve();
              else {
                pc.onicegatheringstatechange = () => {
                  if (pc.iceGatheringState === "complete") {
                    pc.onicegatheringstatechange = null;
                    resolve();
                  }
                };
              }
            }),
            new Promise(r => setTimeout(r, 8000)) // Increased to 8s for cellular networks
          ]);

          const localSdp = pc.localDescription?.sdp;
          if (!localSdp) {
            throw new Error("No local SDP offer");
          }

          log("SDP offer gathered. Sending to RN...");
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'initiate-offer',
            contactId,
            sdp: localSdp
          }));

        } catch (err) {
          log("Initiate call failed: " + err.message);
          window.ReactNativeWebView.postMessage(JSON.stringify({ 
            type: 'error', 
            error: err.message 
          }));
        }
      } 
      
      else if (data.type === 'set-remote-answer') {
        try {
          if (!pc) {
            log("No RTCPeerConnection to set answer on.");
            return;
          }
          log("Setting remote description (answer)...");
          await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: data.sdp }));
          log("Remote answer configured.");
        } catch (err) {
          log("Set remote answer failed: " + err.message);
        }
      } 
      
      else if (data.type === 'terminate-call') {
        closePeerConnection();
      }
    };

    // Fallback Legacy Event Listener
    window.addEventListener('message', async (event) => {
      let rawData = event.data;
      if (typeof rawData === 'string') {
        try {
          const parsed = JSON.parse(rawData);
          if (typeof parsed === 'object') {
            rawData = parsed;
          }
        } catch (_) {}
      }
      if (rawData && typeof rawData === 'object' && rawData.type) {
        window.webrtcTunnel(rawData);
      }
    });

    log("Initialized.");
  </script>
</body>
</html>
`;

export function WhatsAppIncomingCallHost() {
  const session = useSessionContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [activeCall, setActiveCall] = useState<ActiveCallState | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [duration, setDuration] = useState(0);
  const [autoAttendEnabled, setAutoAttendEnabled] = useState(false);
  const [isGreetingPlaying, setIsGreetingPlaying] = useState(false);

  const webviewRef = useRef<WebView>(null);
  const activeCallRef = useRef(activeCall);
  activeCallRef.current = activeCall;

  const postToWebView = useCallback((action: any) => {
    const js = `
      if (window.webrtcTunnel) {
        window.webrtcTunnel(${JSON.stringify(action)});
      } else {
        window.postMessage(${JSON.stringify(JSON.stringify(action))}, '*');
      }
      true;
    `;
    webviewRef.current?.injectJavaScript(js);
  }, []);

  const dismiss = useCallback(() => {
    postToWebView({ type: 'terminate-call' });
    setActiveCall(null);
    setIsGreetingPlaying(false);
  }, [postToWebView]);

  const onAttendCall = useCallback(() => {
    const call = activeCallRef.current;
    if (!call || call.status !== 'ringing') return;

    setActiveCall((cur) => cur ? { ...cur, status: 'connecting' } : null);

    if (autoAttendEnabled) {
      setIsGreetingPlaying(true);
    }

    const baseUrl = getApiBaseUrl();
    const ttsUrl = `${baseUrl}/api/whatsapp/calls/tts`;

    postToWebView({
      type: 'accept-call',
      callId: call.callId,
      sdpOffer: call.sdpOffer,
      autoAttend: autoAttendEnabled,
      ttsUrl,
    });

    if (call.contactId) {
      router.push({ pathname: '/inbox', params: { openContactId: call.contactId } } as any);
    } else {
      router.push('/inbox');
    }
    queueMicrotask(() => {
      nudgeInboxHeader();
    });
  }, [postToWebView, router, autoAttendEnabled]);

  const onReject = useCallback(async () => {
    const call = activeCallRef.current;
    if (!call || rejecting) return;
    
    setRejecting(true);
    const callId = call.callId;
    const isRinging = call.status === 'ringing';
    const isOutgoing = call.direction === 'outgoing';

    // Disconnect WebRTC and update UI instantly
    postToWebView({ type: 'terminate-call' });
    setActiveCall((cur) => cur ? { ...cur, status: 'ended' } : null);
    setIsGreetingPlaying(false);

    try {
      if (callId) {
        await api().post('/api/whatsapp/calls/reject', {
          callId,
          action: isRinging || (isOutgoing && call.status === 'calling') ? 'reject' : 'terminate',
        });
      }
    } catch {
      // ignore rejection API failures
    } finally {
      setRejecting(false);
    }
  }, [rejecting, postToWebView]);

  // Duration Timer Loop
  useEffect(() => {
    let id: any = null;
    if (activeCall?.status === 'connected') {
      id = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } else {
      setDuration(0);
    }
    return () => {
      if (id) clearInterval(id);
    };
  }, [activeCall?.status]);

  // Ended Call Timeout cleanup
  useEffect(() => {
    if (activeCall?.status === 'ended') {
      const t = setTimeout(() => {
        setActiveCall(null);
      }, 2000);
      return () => clearTimeout(t);
    }
  }, [activeCall?.status]);

  // Auto-dismiss ringing after 45 seconds (webhook may miss terminate event)
  useEffect(() => {
    if (activeCall?.status === 'ringing') {
      const t = setTimeout(() => {
        setActiveCall((cur) => {
          if (cur?.status === 'ringing') {
            postToWebView({ type: 'terminate-call' });
            return { ...cur, status: 'ended' };
          }
          return cur;
        });
      }, 45_000);
      return () => clearTimeout(t);
    }
  }, [activeCall?.status, postToWebView]);

  // Auto-dismiss outgoing 'calling' state after 60 seconds (no answer)
  useEffect(() => {
    if (activeCall?.status === 'calling' && activeCall?.direction === 'outgoing') {
      const t = setTimeout(() => {
        setActiveCall((cur) => {
          if (cur?.status === 'calling') {
            postToWebView({ type: 'terminate-call' });
            return { ...cur, status: 'ended' };
          }
          return cur;
        });
      }, 60_000);
      return () => clearTimeout(t);
    }
  }, [activeCall?.status, activeCall?.direction, postToWebView]);

  const formattedDuration = useMemo(() => {
    const mins = Math.floor(duration / 60);
    const secs = duration % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, [duration]);

  // Global triggers hook
  useEffect(() => {
    globalShowIncomingCall = (p: WhatsAppIncomingCallPayload) => {
      setActiveCall({
        callId: p.callId,
        contactId: p.contactId || '',
        contactName: p.contactName && p.contactName !== 'Unknown' ? p.contactName : (p.phoneNumber || 'Unknown'),
        phoneNumber: p.phoneNumber || '',
        direction: 'incoming',
        status: 'ringing',
        sdpOffer: p.session?.sdp || '',
      });
    };

    globalStartOutgoingCall = (contactId: string, contactName: string, phoneNumber: string) => {
      setActiveCall({
        callId: '',
        contactId,
        contactName: contactName || phoneNumber || 'Unknown',
        phoneNumber,
        direction: 'outgoing',
        status: 'calling',
      });

      // Inject create offer to WebView WebRTC
      setTimeout(() => {
        postToWebView({
          type: 'initiate-call',
          contactId,
        });
      }, 120);
    };

    return () => {
      globalShowIncomingCall = null;
      globalStartOutgoingCall = null;
    };
  }, [postToWebView]);

  // WebView message dispatcher
  const onWebViewMessage = useCallback(async (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('[WebView Msg]', data.type);

      if (data.type === 'log') {
        console.log('[WebView WebRTC LOG]', data.message);
      } 
      
      else if (data.type === 'connection-state') {
        const state = data.state;
        setActiveCall((cur) => {
          if (!cur) return null;
          if (state === 'connected') {
            return { ...cur, status: 'connected' };
          }
          if (state === 'failed' || state === 'closed') {
            return { ...cur, status: 'ended' };
          }
          return cur;
        });
      } 
      
      else if (data.type === 'accept-answer') {
        try {
          await api().post('/api/whatsapp/calls/accept', {
            callId: data.callId,
            session: { sdp_type: 'answer', sdp: data.sdp },
          });
          setActiveCall((cur) => {
            if (cur && cur.callId === data.callId) {
              return { ...cur, status: 'connecting' };
            }
            return cur;
          });
        } catch (err) {
          console.warn('[Call Host] Accept endpoint failed:', err);
          setActiveCall((cur) => cur ? { ...cur, status: 'ended' } : null);
        }
      } 
      
      else if (data.type === 'initiate-offer') {
        try {
          const res = await api().post<{ success: boolean; callId: string | null; needsPermission?: boolean; code?: string }>(
            '/api/whatsapp/calls/initiate',
            {
              contactId: data.contactId,
              session: { sdp_type: 'offer', sdp: data.sdp },
            }
          );
          
          // Handle CALL_PERMISSION_REQUIRED: user hasn't opted in to receive calls
          const resData = res.data as any;
          if (resData?.needsPermission || resData?.code === 'CALL_PERMISSION_REQUIRED') {
            console.warn('[Call Host] Call permission required for contact:', data.contactId);
            Alert.alert(
              'Call Permission Required',
              'This contact hasn\'t opted in to receive WhatsApp calls. Would you like to send a call permission request?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Send Request',
                  onPress: async () => {
                    try {
                      await api().post('/api/whatsapp/calls/initiate', {
                        contactId: data.contactId,
                        requestPermission: true,
                      });
                      Alert.alert('Permission Requested', 'A call permission request has been sent. You can call once they accept.');
                    } catch (permErr: any) {
                      Alert.alert('Failed', permErr?.message || 'Could not send permission request.');
                    }
                  },
                },
              ]
            );
            setActiveCall((cur) => cur ? { ...cur, status: 'ended' } : null);
            return;
          }

          if (res.status >= 200 && res.status < 300 && res.data?.callId) {
            const callId = res.data.callId;
            setActiveCall((cur) => {
              if (cur && cur.contactId === data.contactId) {
                return { ...cur, callId, status: 'calling' };
              }
              return cur;
            });
          } else {
            const errMsg = resData?.error || 'Call API responded without callId';
            throw new Error(errMsg);
          }
        } catch (err: any) {
          console.warn('[Call Host] Initiate endpoint failed:', err?.message || err);
          Alert.alert(
            'Calling Unavailable',
            err?.message || 'The connection failed. Please check that WhatsApp calling is enabled in your account settings.'
          );
          setActiveCall((cur) => cur ? { ...cur, status: 'ended' } : null);
        }
      }
      
      else if (data.type === 'tts-ended') {
        console.log('[Call Host] TTS greeting ended. Transitioning to live call.');
        setIsGreetingPlaying(false);
      }
      
      else if (data.type === 'error') {
        console.warn('[Call Host] WebView WebRTC Error:', data.error);
        Alert.alert('Call Failed', `Microphone or WebRTC error: ${data.error}`);
        setActiveCall((cur) => cur ? { ...cur, status: 'ended' } : null);
        setIsGreetingPlaying(false);
      }
    } catch (err) {
      console.warn('[Call Host] WebView JSON parse error:', err);
    }
  }, []);

  // Reload the auto-attend setting when component mounts or call status changes
  useEffect(() => {
    const loadAutoAttend = async () => {
      try {
        const val = await SecureStore.getItemAsync('rawabi.auto_attend_calls.v1');
        setAutoAttendEnabled(val === 'true');
      } catch (err) {
        console.warn('[Call Host] Failed to load auto-attend setting:', err);
        setAutoAttendEnabled(false);
      }
    };
    loadAutoAttend();
  }, [activeCall?.status]);

  // Trigger Automatic Attend when call rings and auto-attend is enabled
  useEffect(() => {
    if (activeCall && activeCall.direction === 'incoming' && activeCall.status === 'ringing' && autoAttendEnabled) {
      console.log('[Call Host] Auto-attending incoming call:', activeCall.callId);
      const t = setTimeout(() => {
        onAttendCall();
      }, 600);
      return () => clearTimeout(t);
    }
  }, [activeCall?.callId, activeCall?.status, autoAttendEnabled, onAttendCall]);

  // Web Sockets Event Handlers
  useEffect(() => {
    if (session.status !== 'loggedIn') {
      setActiveCall(null);
      return;
    }

    let cleaned = false;
    let detach: (() => void) | null = null;

    const bind = (sock: NonNullable<ReturnType<typeof getActiveSocket>>) => {
      const onIncoming = (raw: unknown) => {
        const p = raw as WhatsAppIncomingCallPayload;
        if (!p?.callId) return;
        setActiveCall((cur) => {
          if (cur && callIdsLooselyMatch(cur.callId, p.callId)) return cur;
          return {
            callId: p.callId,
            contactId: p.contactId || '',
            contactName: p.contactName && p.contactName !== 'Unknown' ? p.contactName : (p.phoneNumber || 'Unknown'),
            phoneNumber: p.phoneNumber || '',
            direction: 'incoming',
            status: 'ringing',
            sdpOffer: p.session?.sdp || '',
          };
        });
      };

      const onEnded = (raw: unknown) => {
        const d = raw as { callId?: string };
        const id = d?.callId != null ? String(d.callId) : '';
        const cur = activeCallRef.current;
        if (!cur || !id) return;
        if (callIdsLooselyMatch(cur.callId, id)) {
          postToWebView({ type: 'terminate-call' });
          setActiveCall((c) => c ? { ...c, status: 'ended' } : null);
        }
      };

      const onOutgoingAnswer = (raw: unknown) => {
        const d = raw as { callId?: string; session?: { sdp: string; sdp_type: string } };
        const id = d?.callId != null ? String(d.callId) : '';
        const cur = activeCallRef.current;
        if (!cur || !id || !d.session?.sdp) return;

        if (cur && cur.direction === 'outgoing' && (callIdsLooselyMatch(cur.callId, id) || !cur.callId)) {
          postToWebView({ type: 'set-remote-answer', sdp: d.session.sdp });
          setActiveCall((c) => {
            if (c) {
              return { ...c, callId: c.callId || id, status: 'connecting' };
            }
            return null;
          });
        }
      };

      const onCallConnected = (raw: unknown) => {
        const d = raw as { callId?: string };
        const id = d?.callId != null ? String(d.callId) : '';
        const cur = activeCallRef.current;
        if (!cur || !id) return;

        if (cur && callIdsLooselyMatch(cur.callId, id)) {
          setActiveCall((c) => c ? { ...c, status: 'connected' } : null);
        }
      };

      sock.on('incoming-call', onIncoming);
      sock.on('call-ended', onEnded);
      sock.on('outgoing-call-answer', onOutgoingAnswer);
      sock.on('call-connected', onCallConnected);

      return () => {
        sock.off('incoming-call', onIncoming);
        sock.off('call-ended', onEnded);
        sock.off('outgoing-call-answer', onOutgoingAnswer);
        sock.off('call-connected', onCallConnected);
      };
    };

    const tryBind = () => {
      const sock = getActiveSocket();
      if (!sock || cleaned) return false;
      detach = bind(sock);
      return true;
    };

    if (!tryBind()) {
      const iv = setInterval(() => {
        if (cleaned) return;
        if (tryBind()) clearInterval(iv);
      }, 500);
      return () => {
        cleaned = true;
        clearInterval(iv);
        detach?.();
      };
    }

    return () => {
      cleaned = true;
      detach?.();
    };
  }, [session.status, postToWebView]);

  // Polling incoming call loop (socket backup)
  const pollIncomingCalls = useCallback(async () => {
    const sock = getActiveSocket();
    if (sock?.connected) return;
    if (activeCallRef.current) return;
    try {
      const r = await api().get('/api/incoming-calls');
      if (r.status !== 200) return;
      const calls = (r.data as { calls?: WhatsAppIncomingCallPayload[] })?.calls ?? [];
      const first = calls[0];
      if (first?.callId) {
        setActiveCall({
          callId: first.callId,
          contactId: first.contactId || '',
          contactName: first.contactName && first.contactName !== 'Unknown' ? first.contactName : (first.phoneNumber || 'Unknown'),
          phoneNumber: first.phoneNumber || '',
          direction: 'incoming',
          status: 'ringing',
          sdpOffer: first.session?.sdp || '',
        });
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Polling outgoing answer loop (socket backup)
  const pollOutgoingAnswer = useCallback(async () => {
    const call = activeCallRef.current;
    if (!call || call.direction !== 'outgoing' || call.status !== 'calling') return;
    const callId = call.callId;
    if (!callId) return;

    try {
      const res = await api().get(`/api/whatsapp/calls/answer?callId=${encodeURIComponent(callId)}`);
      if (res.status !== 200) return;
      const answer = (res.data as any)?.answer;
      if (answer?.session?.sdp) {
        postToWebView({ type: 'set-remote-answer', sdp: answer.session.sdp });
        setActiveCall((c) => {
          if (c && c.callId === callId && c.status === 'calling') {
            return { ...c, status: 'connecting' };
          }
          return c;
        });
      }
    } catch {
      /* ignore */
    }
  }, [postToWebView]);

  useEffect(() => {
    if (session.status !== 'loggedIn') return;

    const id = setInterval(() => void pollIncomingCalls(), 4_000);
    void pollIncomingCalls();

    const onAppStateChange = (next: AppStateStatus) => {
      if (next === 'active') {
        void pollIncomingCalls();
      }
    };
    const sub = AppState.addEventListener('change', onAppStateChange);

    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [session.status, pollIncomingCalls]);

  useEffect(() => {
    if (!activeCall || activeCall.direction !== 'outgoing' || activeCall.status !== 'calling') return;
    const iv = setInterval(() => {
      void pollOutgoingAnswer();
    }, 2500);
    return () => clearInterval(iv);
  }, [activeCall, pollOutgoingAnswer]);

  if (!activeCall) return null;

  const green = '#25D366';
  const red = '#ef4444';
  const isIncomingRinging = activeCall.direction === 'incoming' && activeCall.status === 'ringing';

  const statusLabel = (() => {
    if (isGreetingPlaying && (activeCall.status === 'connecting' || activeCall.status === 'connected')) {
      return 'Playing greeting…';
    }
    switch (activeCall.status) {
      case 'ringing':
        return 'Ringing…';
      case 'calling':
        return 'Calling…';
      case 'connecting':
        return 'Connecting…';
      case 'connected':
        return formattedDuration;
      case 'ended':
        return 'Call ended';
      default:
        return '';
    }
  })();

  const statusTextColor = activeCall.status === 'ended' ? red : green;

  return (
    <View style={styles.fullScreenOverlay} pointerEvents="box-none">
      <View style={styles.backdrop}>
        <View style={styles.callScreen}>
          {/* Status bar branding pill */}
          <View style={[styles.statusRow, { paddingTop: insets.top + 12 }]}>
            <View style={styles.statusPill}>
              <Ionicons name="logo-whatsapp" size={14} color={green} />
              <Text style={styles.statusText}>WhatsApp Voice Call</Text>
            </View>
          </View>

          {/* Caller Profile Details */}
          <View style={styles.callerSection}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={64} color="#8696a0" />
            </View>
            <Text style={styles.callerName} numberOfLines={1}>
              {activeCall.contactName && activeCall.contactName !== 'Unknown'
                ? activeCall.contactName
                : activeCall.phoneNumber || 'Unknown Caller'}
            </Text>
            {activeCall.contactName && activeCall.contactName !== 'Unknown' && activeCall.phoneNumber ? (
              <Text style={styles.callerPhone}>{activeCall.phoneNumber}</Text>
            ) : null}

            <View style={styles.ringingRow}>
              <Text style={[styles.ringingText, { color: statusTextColor }]}>
                {statusLabel}
              </Text>
            </View>
          </View>

          {/* Call Controls Buttons */}
          <View style={[styles.callActions, { paddingBottom: insets.bottom + 24 }]}>
            {isIncomingRinging ? (
              <>
                {/* Decline Button */}
                <TouchableOpacity
                  onPress={onReject}
                  disabled={rejecting}
                  activeOpacity={0.7}
                  style={[styles.callBtn, { opacity: rejecting ? 0.6 : 1 }]}
                >
                  <View style={[styles.callIconCircle, { backgroundColor: red }]}>
                    <Ionicons name="call" size={32} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
                  </View>
                  <Text style={styles.callBtnLabel}>Decline</Text>
                </TouchableOpacity>

                {/* Answer Button */}
                <TouchableOpacity
                  onPress={onAttendCall}
                  activeOpacity={0.7}
                  style={styles.callBtn}
                >
                  <View style={[styles.callIconCircle, { backgroundColor: green }]}>
                    <Ionicons name="call" size={32} color="#fff" />
                  </View>
                  <Text style={styles.callBtnLabel}>Answer</Text>
                </TouchableOpacity>
              </>
            ) : (
              /* Outgoing / Connected Single red end-call button */
              <TouchableOpacity
                onPress={onReject}
                disabled={rejecting}
                activeOpacity={0.7}
                style={[styles.callBtn, { opacity: rejecting ? 0.6 : 1 }]}
              >
                <View style={[styles.callIconCircle, { backgroundColor: red }]}>
                  <Ionicons name="call" size={32} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
                </View>
                <Text style={styles.callBtnLabel}>End Call</Text>
              </TouchableOpacity>
            )}
          </View>

          {isIncomingRinging && (
            <Pressable onPress={dismiss} hitSlop={20} style={styles.dismissRow}>
              <Text style={{ color: '#8696a0', fontSize: 14 }}>Dismiss notification</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Hidden WebView WebRTC Helper (Rendered off-screen tiny size to prevent OS suspending) */}
      <View style={{ position: 'absolute', width: 10, height: 10, left: -100, top: -100 }} pointerEvents="none">
        <WebView
          ref={webviewRef}
          source={{ html: WEBRTC_HTML }}
          originWhitelist={['*']}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback={true}
          mediaCapturePermissionGrantType="grant"
          onMessage={onWebViewMessage}
          // @ts-ignore
          onPermissionRequest={(event: any) => {
            event.grant(event.resources);
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreenOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99999,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(11, 20, 26, 0.98)',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  callScreen: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  statusRow: {
    marginBottom: 12,
    alignItems: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#1f2c34',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    color: '#8696a0',
  },
  callerSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -40,
  },
  avatar: {
    width: 132,
    height: 132,
    borderRadius: 66,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#00a884',
    backgroundColor: '#202c33',
    marginBottom: 24,
  },
  callerName: {
    fontSize: 30,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 16,
    color: '#e9edef',
  },
  callerPhone: {
    fontSize: 17,
    marginTop: 6,
    color: '#8696a0',
  },
  ringingRow: {
    marginTop: 18,
  },
  ringingText: {
    fontSize: 18,
    fontWeight: '600',
  },
  callActions: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    marginTop: 24,
  },
  callBtn: {
    alignItems: 'center',
    gap: 10,
  },
  callIconCircle: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  callBtnLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  dismissRow: {
    paddingVertical: 12,
    marginBottom: 8,
  },
});
