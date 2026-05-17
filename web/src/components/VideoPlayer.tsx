import { useEffect, useRef } from 'react';

interface VideoPlayerProps {
  mediaStream: MediaStream | null;
  muted?: boolean;
}

export const VideoPlayer = ({ mediaStream, muted = false }: VideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!videoRef.current) {
      return;
    }

    videoRef.current.srcObject = mediaStream;
  }, [mediaStream]);

  return <video ref={videoRef} autoPlay playsInline muted={muted} />;
};
