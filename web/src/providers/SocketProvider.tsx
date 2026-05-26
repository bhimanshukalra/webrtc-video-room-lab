import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { io, type Socket } from 'socket.io-client';

interface SocketProviderProps {
  children: ReactNode;
}

interface SocketContextValue {
  socket: Socket;
  signalingState: 'connected' | 'disconnected';
}

const SocketContext = createContext<SocketContextValue | null>(null);

export const useSocket = () => {
  const context = useContext(SocketContext);

  if (!context) {
    throw new Error('useSocket must be used inside SocketProvider');
  }

  return context;
};

export const SocketProvider = ({ children }: SocketProviderProps) => {
  const socket = useMemo(() => io('http://localhost:8001'), []);
  const [signalingState, setSignalingState] = useState<
    SocketContextValue['signalingState']
  >(socket.connected ? 'connected' : 'disconnected');

  useEffect(() => {
    const handleConnect = () => {
      setSignalingState('connected');
    };

    const handleDisconnect = () => {
      setSignalingState('disconnected');
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [socket]);

  return (
    <SocketContext.Provider value={{ socket, signalingState }}>
      {children}
    </SocketContext.Provider>
  );
};
