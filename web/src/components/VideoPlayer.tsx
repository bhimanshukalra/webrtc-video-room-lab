import { useEffect, useRef } from 'react';

interface VideoPlayerProps {
  mediaStream: MediaStream | null;
  label: string;
  status?: string;
  muted?: boolean;
}

export const VideoPlayer = ({
  mediaStream,
  label,
  status,
  muted = false,
}: VideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!videoRef.current) {
      return;
    }

    videoRef.current.srcObject = mediaStream;
  }, [mediaStream]);

  return (
    <div className='relative w-full max-w-md flex-1 basis-80 overflow-hidden rounded-md bg-black'>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        className='aspect-video w-full object-cover'
      />
      <div className='absolute bottom-0 left-0 right-0 bg-black/60 px-3 py-2 text-sm font-medium text-white'>
        <div>{label}</div>
        {status && <div className='mt-1 text-xs text-zinc-300'>{status}</div>}
      </div>
    </div>
  );
};
