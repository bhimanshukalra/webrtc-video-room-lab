import type { ReactNode } from 'react';
import { PeerProvider } from './PeerProvider';
import { SocketProvider } from './SocketProvider';

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider = ({ children }: AppProviderProps) => {
  return (
    <SocketProvider>
      <PeerProvider>{children}</PeerProvider>
    </SocketProvider>
  );
};
