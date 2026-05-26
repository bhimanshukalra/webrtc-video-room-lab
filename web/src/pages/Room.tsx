import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { usePeer, useSocket } from '../providers';
import { VideoPlayer } from '../components';

interface IncomingCallPayload {
  fromEmail: string;
  offer: RTCSessionDescriptionInit;
}

interface IceCandidatePayload {
  candidate: RTCIceCandidateInit;
}

interface UserLeftPayload {
  emailId: string;
}

interface RoomLocationState {
  emailId?: string;
}

const CONTROL_BUTTON_BASE_CLASSNAME =
  'rounded-md px-4 py-2 text-sm font-medium transition';
const CONTROL_BUTTON_ON_CLASSNAME = 'bg-white text-zinc-950 hover:bg-zinc-200';
const CONTROL_BUTTON_OFF_CLASSNAME = 'bg-red-600 text-white hover:bg-red-500';

const getControlButtonClassName = (isEnabled: boolean) =>
  `${CONTROL_BUTTON_BASE_CLASSNAME} ${
    isEnabled ? CONTROL_BUTTON_ON_CLASSNAME : CONTROL_BUTTON_OFF_CLASSNAME
  }`;

const getConnectionStatusClassName = (
  state: RTCPeerConnectionState | RTCIceConnectionState,
) => {
  const isConnected = state === 'connected' || state === 'completed';
  const hasFailed =
    state === 'failed' || state === 'disconnected' || state === 'closed';

  if (isConnected) {
    return 'rounded-full bg-emerald-500 px-3 py-1 text-xs font-medium text-zinc-950';
  }

  if (hasFailed) {
    return 'rounded-full bg-red-600 px-3 py-1 text-xs font-medium text-white';
  }

  return 'rounded-full bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-200';
};

const getSignalingStatusClassName = (
  signalingState: 'connected' | 'disconnected' | 'reconnecting',
) => {
  if (signalingState === 'connected') {
    return 'rounded-full bg-emerald-500 px-3 py-1 text-xs font-medium text-zinc-950';
  }

  if (signalingState === 'reconnecting') {
    return 'rounded-full bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-200';
  }

  return 'rounded-full bg-red-600 px-3 py-1 text-xs font-medium text-white';
};

const getUserDisplayName = (emailId: string) =>
  emailId.split('@')[0] || emailId;

export const RoomPage = () => {
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { emailId } = (location.state ?? {}) as RoomLocationState;
  const { socket, signalingState } = useSocket();
  const {
    peer,
    connectionState,
    createOffer,
    createAnswer,
    iceConnectionState,
    setRemoteAnswer,
    addIceCandidate,
    sendStream,
    remoteUserStream,
    clearRemoteUserStream,
  } = usePeer();
  const [currentUserStream, setCurrentUserStream] =
    useState<MediaStream | null>(null);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [toastMessage, setToastMessage] = useState('');
  const currentUserStreamRef = useRef<MediaStream | null>(null);
  const remoteEmailIdRef = useRef('');
  const previousSignalingStateRef = useRef(signalingState);

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

  const handleUserLeft = useCallback(
    ({ emailId }: UserLeftPayload) => {
      console.log('user left room', emailId);
      remoteEmailIdRef.current = '';
      setToastMessage(`${getUserDisplayName(emailId)} left`);
      clearRemoteUserStream();
    },
    [clearRemoteUserStream],
  );

  useEffect(() => {
    socket.on('user-joined', handleNewUserJoined);
    socket.on('incoming-call', handleIncomingCall);
    socket.on('call-accepted', handleCallAccepted);
    socket.on('ice-candidate', handleIceCandidate);
    socket.on('user-left', handleUserLeft);

    return () => {
      socket.off('user-joined', handleNewUserJoined);
      socket.off('incoming-call', handleIncomingCall);
      socket.off('call-accepted', handleCallAccepted);
      socket.off('ice-candidate', handleIceCandidate);
      socket.off('user-left', handleUserLeft);
    };
  }, [
    socket,
    handleCallAccepted,
    handleNewUserJoined,
    handleIncomingCall,
    handleIceCandidate,
    handleUserLeft,
  ]);

  useEffect(() => {
    const handleLocalIceCandidate = ({
      candidate,
    }: RTCPeerConnectionIceEvent) => {
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

  useEffect(() => {
    const wasReconnected =
      previousSignalingStateRef.current !== 'connected' &&
      signalingState === 'connected';

    previousSignalingStateRef.current = signalingState;

    if (!wasReconnected || !emailId || !roomId) {
      return;
    }

    socket.emit('join-room', { emailId, roomId });
  }, [emailId, roomId, signalingState, socket]);

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

  const handleEndCall = () => {
    socket.emit('leave-room');

    if (currentUserStream) {
      const localTracks = currentUserStream.getTracks();

      for (const sender of peer.getSenders()) {
        if (sender.track && localTracks.includes(sender.track)) {
          peer.removeTrack(sender);
        }
      }

      for (const track of localTracks) {
        track.stop();
      }
    }

    currentUserStreamRef.current = null;
    remoteEmailIdRef.current = '';
    setCurrentUserStream(null);
    setIsCameraOn(true);
    setIsMicOn(true);
    navigate('/');
  };

  useEffect(() => {
    const handleBeforeUnload = () => {
      currentUserStreamRef.current?.getTracks().forEach((track) => {
        track.stop();
      });
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setToastMessage('');
    }, 3000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [toastMessage]);

  return (
    <div className='flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-950 p-6 text-white'>
      {toastMessage && (
        <div className='fixed right-6 top-6 rounded-md bg-white px-4 py-3 text-sm font-medium text-zinc-950 shadow-lg'>
          {toastMessage}
        </div>
      )}
      <div className='flex flex-col items-center gap-2'>
        <h1 className='text-2xl font-semibold'>Room page</h1>
        <div className='flex flex-wrap justify-center gap-2'>
          <span className={getSignalingStatusClassName(signalingState)}>
            Signaling {signalingState}
          </span>
          <span className={getConnectionStatusClassName(connectionState)}>
            Peer {connectionState}
          </span>
          <span className={getConnectionStatusClassName(iceConnectionState)}>
            ICE {iceConnectionState}
          </span>
        </div>
      </div>
      <div className='flex w-full max-w-5xl flex-wrap justify-center gap-4'>
        {currentUserStream && (
          <VideoPlayer mediaStream={currentUserStream} muted />
        )}
        {remoteUserStream && <VideoPlayer mediaStream={remoteUserStream} />}
      </div>
      {currentUserStream && (
        <div className='flex gap-3'>
          <button
            type='button'
            onClick={toggleCamera}
            className={getControlButtonClassName(isCameraOn)}
          >
            {isCameraOn ? 'Turn camera off' : 'Turn camera on'}
          </button>
          <button
            type='button'
            onClick={toggleMic}
            className={getControlButtonClassName(isMicOn)}
          >
            {isMicOn ? 'Mute mic' : 'Unmute mic'}
          </button>
          <button
            type='button'
            onClick={handleEndCall}
            className='rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-600'
          >
            End call
          </button>
        </div>
      )}
    </div>
  );
};
