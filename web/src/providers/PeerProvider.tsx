import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

interface PeerProviderProps {
  children: ReactNode;
}

interface PeerContextPayload {
  peer: RTCPeerConnection;
  createOffer: () => Promise<RTCSessionDescriptionInit>;
  createAnswer: (
    offer: RTCSessionDescriptionInit,
  ) => Promise<RTCSessionDescriptionInit>;
  setRemoteAnswer: (answer: RTCSessionDescriptionInit) => Promise<void>;
  sendStream: (stream: MediaStream | null) => void;
  remoteUserStream: MediaStream | null;
}

const STUN_SERVER_URLS = [
  'stun:stun.l.google.com:19302',
  'stun:global.l.twilio.com:3478',
];

const ICE_SERVERS = [
  {
    urls: STUN_SERVER_URLS,
  },
];

const PeerContext = createContext<PeerContextPayload | null>(null);

export const usePeer = () => {
  const context = useContext(PeerContext);

  if (!context) {
    throw new Error('usePeer must be used inside PeerProvider');
  }

  return context;
};

export const PeerProvider = ({ children }: PeerProviderProps) => {
  const [remoteUserStream, setRemoteUserStream] =
    useState<MediaStream | null>(null);

  const peer = useMemo(
    () =>
      new RTCPeerConnection({
        iceServers: ICE_SERVERS,
      }),
    [],
  );

  const createOffer = async () => {
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    return offer;
  };

  const createAnswer = async (offer: RTCSessionDescriptionInit) => {
    await peer.setRemoteDescription(offer);
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    return answer;
  };

  const setRemoteAnswer = async (answer: RTCSessionDescriptionInit) => {
    await peer.setRemoteDescription(answer);
  };

  const sendStream = (stream: MediaStream | null) => {
    if (!stream) {
      return;
    }

    const tracks = stream.getTracks();
    for (const track of tracks) {
      peer.addTrack(track, stream);
    }
  };

  const handleTrackEvent = useCallback((ev: RTCTrackEvent) => {
    const streams = ev.streams;
    console.log('handleTrackEvent', streams[0]);
    setRemoteUserStream(streams[0]);
  }, []);

  useEffect(() => {
    peer.addEventListener('track', handleTrackEvent);
    return () => {
      peer.removeEventListener('track', handleTrackEvent);
    };
  }, [handleTrackEvent, peer]);

  return (
    <PeerContext.Provider
      value={{
        peer,
        createOffer,
        createAnswer,
        setRemoteAnswer,
        sendStream,
        remoteUserStream,
      }}
    >
      {children}
    </PeerContext.Provider>
  );
};
