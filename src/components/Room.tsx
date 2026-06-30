import { useEffect, useRef, useState } from 'react';
import { db } from '../lib/firebase';
import { collection, doc, setDoc, getDoc, onSnapshot, updateDoc, addDoc, getDocs } from 'firebase/firestore';
import { Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { cn } from '../lib/utils';

const ICE_SERVERS = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
    },
  ],
};

export default function Room({ roomId, isVideoOn, isMicOn }: { roomId: string, isVideoOn: boolean, isMicOn: boolean }) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  
  useEffect(() => {
    // Setup local media
    const initLocalMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        setLocalStream(stream);
      } catch (err: any) {
        console.warn('Media devices not accessible or permission denied.', err?.message);
        // We can still allow the user to be in the room without media
      }
    };
    
    initLocalMedia();
    
    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      if (pcRef.current) {
        pcRef.current.close();
      }
    };
  }, []);

  // Update track states when props change
  useEffect(() => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => track.enabled = isVideoOn);
      localStream.getAudioTracks().forEach(track => track.enabled = isMicOn);
    }
  }, [isVideoOn, isMicOn, localStream]);

  // Join or Create Room logic
  useEffect(() => {
    if (!localStream) return;
    
    const initWebRTC = async () => {
      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;
      
      const remote = new MediaStream();
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remote;
      }
      setRemoteStream(remote);

      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });

      pc.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => {
          remote.addTrack(track);
        });
      };

      const roomRef = doc(db, 'rooms', roomId);
      const callerCandidatesCollection = collection(roomRef, 'callerCandidates');
      const calleeCandidatesCollection = collection(roomRef, 'calleeCandidates');

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          // Check if we are caller or callee by seeing if offer exists
          getDoc(roomRef).then(roomSnapshot => {
            if (!roomSnapshot.exists() || !roomSnapshot.data().answer) {
               addDoc(callerCandidatesCollection, event.candidate.toJSON());
            } else {
               addDoc(calleeCandidatesCollection, event.candidate.toJSON());
            }
          });
        }
      };

      const roomSnapshot = await getDoc(roomRef);
      
      if (!roomSnapshot.exists()) {
        // Create Room (Caller)
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        
        await setDoc(roomRef, {
          offer: {
            type: offer.type,
            sdp: offer.sdp,
          },
        });

        // Listen for remote answer
        onSnapshot(roomRef, (snapshot) => {
          const data = snapshot.data();
          if (!pc.currentRemoteDescription && data?.answer) {
            const answerDescription = new RTCSessionDescription(data.answer);
            pc.setRemoteDescription(answerDescription);
          }
        });

        // Listen for remote ICE candidates
        onSnapshot(calleeCandidatesCollection, (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const candidate = new RTCIceCandidate(change.doc.data());
              pc.addIceCandidate(candidate);
            }
          });
        });

      } else {
        // Join Room (Callee)
        const offer = roomSnapshot.data().offer;
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        await updateDoc(roomRef, {
          answer: {
            type: answer.type,
            sdp: answer.sdp,
          },
        });

        // Listen for remote ICE candidates
        onSnapshot(callerCandidatesCollection, (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const candidate = new RTCIceCandidate(change.doc.data());
              pc.addIceCandidate(candidate);
            }
          });
        });
      }
    };
    
    initWebRTC();
  }, [localStream, roomId]);

  return (
    <div className="w-full h-full flex flex-col md:flex-row gap-4">
      {/* Local Video */}
      <div className="flex-1 bg-slate-900 rounded-2xl relative overflow-hidden flex items-center justify-center">
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className={cn(
            "absolute inset-0 w-full h-full object-cover transition-opacity duration-300",
            isVideoOn ? "opacity-100" : "opacity-0"
          )}
        />
        {!isVideoOn && (
          <div className="w-full h-full flex items-center justify-center font-bold text-white text-4xl">
            You
          </div>
        )}
        <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-md px-3 py-1 rounded-lg text-white text-sm font-medium flex items-center gap-2">
          You {!isMicOn && <MicOff className="w-3 h-3 text-red-400" />}
        </div>
      </div>

      {/* Remote Video */}
      <div className="flex-1 bg-slate-800 rounded-2xl relative overflow-hidden flex items-center justify-center group">
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
        {(!remoteStream || remoteStream.getVideoTracks().length === 0) && (
          <div className="w-full h-full flex items-center justify-center font-bold text-white text-4xl opacity-50">
            Waiting...
          </div>
        )}
        <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-md px-3 py-1 rounded-lg text-white text-sm font-medium">
          Peer
        </div>
      </div>
    </div>
  );
}
