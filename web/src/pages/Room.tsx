import { useCallback, useEffect, useState } from 'react';
import { usePeer, useSocket } from '../providers';
import { VideoPlayer } from '../components';

interface IncomingCallPayload {
  fromEmail: string;
  offer: RTCSessionDescriptionInit;
}

export const RoomPage = () => {
  const { socket } = useSocket();
  const {
    peer,
    createOffer,
    createAnswer,
    setRemoteAnswer,
    sendStream,
    remoteUserStream,
  } = usePeer();
  const [currentUserStream, setCurrentUserStream] =
    useState<MediaStream | null>(null);
  const [remoteEmailId, setRemoteEmailId] = useState('');

  const handleNewUserJoined = useCallback(
    async ({ emailId }: { emailId: string }) => {
      console.log('new user joined room', emailId);
      const offer = await createOffer();
      socket.emit('call-user', { emailId, offer });
      setRemoteEmailId(emailId);
    },
    [createOffer, socket],
  );

  const handleIncommingCall = useCallback(
    async ({ fromEmail, offer }: IncomingCallPayload) => {
      console.log('Incomming call from', fromEmail, offer);
      const answer = await createAnswer(offer);
      socket.emit('call-accepted', { emailId: fromEmail, answer });
      sendStream(currentUserStream);
      setRemoteEmailId(fromEmail);
    },
    [currentUserStream, socket, createAnswer, sendStream],
  );

  const handleCallAccepted = useCallback(
    async ({ answer }: { answer: RTCSessionDescriptionInit }) => {
      await setRemoteAnswer(answer);
      sendStream(currentUserStream);
    },
    [currentUserStream, sendStream, setRemoteAnswer],
  );

  useEffect(() => {
    socket.on('user-joined', handleNewUserJoined);
    socket.on('incoming-call', handleIncommingCall);
    socket.on('call-accepted', handleCallAccepted);

    return () => {
      socket.off('user-joined', handleNewUserJoined);
      socket.off('incoming-call', handleIncommingCall);
      socket.off('call-accepted', handleCallAccepted);
    };
  }, [socket, handleCallAccepted, handleNewUserJoined, handleIncommingCall]);

  const updateUserMediaStream = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });
    setCurrentUserStream(stream);
  }, []);

  const handleNegotiation = useCallback(() => {
    const localOffer = peer.localDescription;
    socket.emit('call-user', { emailId: remoteEmailId, offer: localOffer });
  }, [peer.localDescription, remoteEmailId, socket]);

  useEffect(() => {
    peer.addEventListener('negotiationneeded', handleNegotiation);
    return () => {
      peer.removeEventListener('negotiationneeded', handleNegotiation);
    };
  }, [handleNegotiation, peer]);

  useEffect(() => {
    updateUserMediaStream();
  }, [updateUserMediaStream]);

  return (
    <div>
      <h1>Room page</h1>
      {currentUserStream && <VideoPlayer mediaStream={currentUserStream} />}
      {remoteUserStream && <VideoPlayer mediaStream={remoteUserStream} />}
    </div>
  );
};
