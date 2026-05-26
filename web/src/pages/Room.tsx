import { useCallback, useEffect, useRef, useState } from 'react';
import { usePeer, useSocket } from '../providers';
import { VideoPlayer } from '../components';

interface IncomingCallPayload {
  fromEmail: string;
  offer: RTCSessionDescriptionInit;
}

interface IceCandidatePayload {
  candidate: RTCIceCandidateInit;
}

const CONTROL_BUTTON_BASE_CLASSNAME =
  'rounded-md px-4 py-2 text-sm font-medium transition';
const CONTROL_BUTTON_ON_CLASSNAME = 'bg-white text-zinc-950 hover:bg-zinc-200';
const CONTROL_BUTTON_OFF_CLASSNAME = 'bg-red-600 text-white hover:bg-red-500';

const getControlButtonClassName = (isEnabled: boolean) =>
  `${CONTROL_BUTTON_BASE_CLASSNAME} ${
    isEnabled ? CONTROL_BUTTON_ON_CLASSNAME : CONTROL_BUTTON_OFF_CLASSNAME
  }`;

export const RoomPage = () => {
  const { socket, signalingState } = useSocket();
  const {
    peer,
    createOffer,
    createAnswer,
    setRemoteAnswer,
    addIceCandidate,
    sendStream,
    remoteUserStream,
  } = usePeer();
  const [currentUserStream, setCurrentUserStream] =
    useState<MediaStream | null>(null);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const currentUserStreamRef = useRef<MediaStream | null>(null);
  const remoteEmailIdRef = useRef('');

  const ensureUserMediaStream = useCallback(async () => {
    if (currentUserStreamRef.current) {
      return currentUserStreamRef.current;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });

    currentUserStreamRef.current = stream;
    setCurrentUserStream(stream);
    return stream;
  }, []);

  const handleNewUserJoined = useCallback(
    async ({ emailId }: { emailId: string }) => {
      console.log('new user joined room', emailId);
      const stream = await ensureUserMediaStream();
      sendStream(stream);
      remoteEmailIdRef.current = emailId;
      const offer = await createOffer();
      socket.emit('call-user', { emailId, offer });
    },
    [createOffer, ensureUserMediaStream, sendStream, socket],
  );

  const handleIncomingCall = useCallback(
    async ({ fromEmail, offer }: IncomingCallPayload) => {
      console.log('Incoming call from', fromEmail, offer);
      const stream = await ensureUserMediaStream();
      sendStream(stream);
      remoteEmailIdRef.current = fromEmail;
      const answer = await createAnswer(offer);
      socket.emit('call-accepted', { emailId: fromEmail, answer });
    },
    [createAnswer, ensureUserMediaStream, sendStream, socket],
  );

  const handleCallAccepted = useCallback(
    async ({ answer }: { answer: RTCSessionDescriptionInit }) => {
      await setRemoteAnswer(answer);
    },
    [setRemoteAnswer],
  );

  const handleIceCandidate = useCallback(
    async ({ candidate }: IceCandidatePayload) => {
      await addIceCandidate(candidate);
    },
    [addIceCandidate],
  );

  useEffect(() => {
    socket.on('user-joined', handleNewUserJoined);
    socket.on('incoming-call', handleIncomingCall);
    socket.on('call-accepted', handleCallAccepted);
    socket.on('ice-candidate', handleIceCandidate);

    return () => {
      socket.off('user-joined', handleNewUserJoined);
      socket.off('incoming-call', handleIncomingCall);
      socket.off('call-accepted', handleCallAccepted);
      socket.off('ice-candidate', handleIceCandidate);
    };
  }, [
    socket,
    handleCallAccepted,
    handleNewUserJoined,
    handleIncomingCall,
    handleIceCandidate,
  ]);

  useEffect(() => {
    const handleLocalIceCandidate = ({ candidate }: RTCPeerConnectionIceEvent) => {
      const emailId = remoteEmailIdRef.current;
      if (!candidate || !emailId) {
        return;
      }

      socket.emit('ice-candidate', {
        emailId,
        candidate: candidate.toJSON(),
      });
    };

    peer.addEventListener('icecandidate', handleLocalIceCandidate);

    return () => {
      peer.removeEventListener('icecandidate', handleLocalIceCandidate);
    };
  }, [peer, socket]);

  useEffect(() => {
    ensureUserMediaStream();
  }, [ensureUserMediaStream]);

  const toggleCamera = () => {
    const videoTrack = currentUserStream?.getVideoTracks()[0];
    if (!videoTrack) {
      return;
    }

    videoTrack.enabled = !videoTrack.enabled;
    setIsCameraOn(videoTrack.enabled);
  };

  const toggleMic = () => {
    const audioTrack = currentUserStream?.getAudioTracks()[0];
    if (!audioTrack) {
      return;
    }

    audioTrack.enabled = !audioTrack.enabled;
    setIsMicOn(audioTrack.enabled);
  };

  const signalingStatusClassName = `rounded-full px-3 py-1 text-xs font-medium ${
    signalingState === 'connected'
      ? 'bg-emerald-500 text-zinc-950'
      : 'bg-red-600 text-white'
  }`;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-950 p-6 text-white">
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-2xl font-semibold">Room page</h1>
        <span className={signalingStatusClassName}>
          Signaling {signalingState}
        </span>
      </div>
      {currentUserStream && <VideoPlayer mediaStream={currentUserStream} muted />}
      {currentUserStream && (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={toggleCamera}
            className={getControlButtonClassName(isCameraOn)}
          >
            {isCameraOn ? 'Turn camera off' : 'Turn camera on'}
          </button>
          <button
            type="button"
            onClick={toggleMic}
            className={getControlButtonClassName(isMicOn)}
          >
            {isMicOn ? 'Mute mic' : 'Unmute mic'}
          </button>
        </div>
      )}
      {remoteUserStream && <VideoPlayer mediaStream={remoteUserStream} />}
    </div>
  );
};
