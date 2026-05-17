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

export const RoomPage = () => {
  const { socket } = useSocket();
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

  return (
    <div>
      <h1>Room page</h1>
      {currentUserStream && (
        <VideoPlayer mediaStream={currentUserStream} muted />
      )}
      {remoteUserStream && <VideoPlayer mediaStream={remoteUserStream} />}
    </div>
  );
};
