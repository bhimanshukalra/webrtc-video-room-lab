# WebRTC Video Calling Spike

This project is a small learning spike for adding browser-to-browser video calling before integrating it into the AI interview app.

The goal is to understand and prove the WebRTC building blocks in isolation:

- camera and microphone access
- local and remote video rendering
- `RTCPeerConnection`
- offer/answer signaling
- ICE candidate exchange
- room join/leave behavior
- mic/camera toggles
- connection state handling
- cleanup when users leave
- basic STUN/TURN configuration

Keep this project intentionally small. It is not meant to be polished product UI.

## Target Outcome

By the end of the spike, two browser tabs or two different browsers should be able to:

1. Join the same room.
2. See their own local camera preview.
3. See the other participant's remote video.
4. Toggle microphone on and off.
5. Toggle camera on and off.
6. Leave and rejoin without stale video tracks.
7. Display connection state such as `connecting`, `connected`, `disconnected`, `failed`, and `closed`.

## Suggested Stack

Use the simplest stack possible:

- Vite + React + TypeScript for the web client
- Node.js + `ws` for the signaling server
- No database
- No auth
- No styling framework required

Suggested structure:

```text
webrtc-spike/
  README.md
  package.json
  server/
    package.json
    src/
      index.ts
  web/
    package.json
    src/
      App.tsx
      webrtc/
        signaling-client.ts
        peer-connection.ts
        use-video-room.ts
```

## Core Concepts

### Media Capture

Use `navigator.mediaDevices.getUserMedia()` to request camera and microphone access.

Start with:

```ts
const stream = await navigator.mediaDevices.getUserMedia({
  video: true,
  audio: true
});
```

Render this stream into a local `<video>` element:

```ts
localVideoRef.current.srcObject = stream;
```

Important cleanup:

```ts
for (const track of stream.getTracks()) {
  track.stop();
}
```

### Peer Connection

Each participant creates an `RTCPeerConnection`.

Start with public STUN:

```ts
const peerConnection = new RTCPeerConnection({
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' }
  ]
});
```

Later, test with TURN. Real production video calling usually needs TURN for restrictive networks.

### Signaling

WebRTC does not define signaling. This spike should use a WebSocket server to pass messages between users in the same room.

Minimum signaling messages:

```ts
type SignalingMessage =
  | { type: 'join-room'; roomId: string }
  | { type: 'peer-joined'; peerId: string }
  | { type: 'peer-left'; peerId: string }
  | { type: 'offer'; roomId: string; sdp: RTCSessionDescriptionInit }
  | { type: 'answer'; roomId: string; sdp: RTCSessionDescriptionInit }
  | { type: 'ice-candidate'; roomId: string; candidate: RTCIceCandidateInit };
```

The server should not inspect SDP contents. It only forwards messages to the other participant in the same room.

## Room Rules

Keep the first version limited to two participants per room.

Server behavior:

- A client connects over WebSocket.
- A client sends `join-room`.
- The server stores the socket under `roomId`.
- If a second client joins, notify both clients.
- If a third client joins, reject with a room-full message.
- If a client disconnects, notify the remaining participant.

This keeps the spike focused on one-to-one calling.

## Offer/Answer Flow

For the two-person spike, use this simple rule:

- The first participant waits.
- The second participant creates the offer.

Flow:

1. User A joins room.
2. User B joins room.
3. Server sends `peer-joined`.
4. User B creates an offer.
5. User B sends offer through signaling server.
6. User A receives offer and calls `setRemoteDescription`.
7. User A creates answer.
8. User A sends answer.
9. User B receives answer and calls `setRemoteDescription`.
10. Both users exchange ICE candidates.
11. Remote video should appear.

## ICE Candidate Flow

Each peer should listen for ICE candidates:

```ts
peerConnection.onicecandidate = (event) => {
  if (event.candidate) {
    signaling.send({
      type: 'ice-candidate',
      roomId,
      candidate: event.candidate.toJSON()
    });
  }
};
```

When receiving a candidate:

```ts
await peerConnection.addIceCandidate(candidate);
```

Handle candidates carefully. In some cases candidates may arrive before the remote description is set. If that happens, queue them and apply them after `setRemoteDescription`.

## Remote Track Handling

Attach remote media when tracks arrive:

```ts
peerConnection.ontrack = (event) => {
  remoteVideoRef.current.srcObject = event.streams[0];
};
```

Add local tracks to the peer connection:

```ts
for (const track of localStream.getTracks()) {
  peerConnection.addTrack(track, localStream);
}
```

## Mic and Camera Toggles

For the spike, toggles can enable or disable existing tracks:

```ts
function setMicrophoneEnabled(stream: MediaStream, enabled: boolean): void {
  for (const track of stream.getAudioTracks()) {
    track.enabled = enabled;
  }
}

function setCameraEnabled(stream: MediaStream, enabled: boolean): void {
  for (const track of stream.getVideoTracks()) {
    track.enabled = enabled;
  }
}
```

This keeps the connection alive while muting audio or hiding video.

## Connection State UI

Show these values somewhere on screen:

- `peerConnection.connectionState`
- `peerConnection.iceConnectionState`
- WebSocket connection state
- room ID
- whether local audio is enabled
- whether local video is enabled

Listen for state changes:

```ts
peerConnection.onconnectionstatechange = () => {
  setConnectionState(peerConnection.connectionState);
};

peerConnection.oniceconnectionstatechange = () => {
  setIceConnectionState(peerConnection.iceConnectionState);
};
```

## Cleanup Checklist

When leaving a room:

1. Stop local media tracks.
2. Remove local video `srcObject`.
3. Remove remote video `srcObject`.
4. Close the peer connection.
5. Close or reset the WebSocket room subscription.
6. Clear pending ICE candidates.
7. Reset UI state.

Example:

```ts
peerConnection.close();

for (const track of localStream.getTracks()) {
  track.stop();
}

localVideo.srcObject = null;
remoteVideo.srcObject = null;
```

## Manual Test Plan

Run through these before considering the spike complete:

1. Open two tabs in the same browser and join the same room.
2. Open Chrome and Safari or Chrome and Firefox and join the same room.
3. Join, leave, and rejoin from one tab.
4. Refresh one participant while the other remains connected.
5. Deny camera permission and confirm the UI shows a useful error.
6. Mute and unmute microphone.
7. Disable and re-enable camera.
8. Close one tab and confirm the other sees the peer leave.
9. Try two different devices on the same network.
10. Try two different networks if possible.

## Expected Problems

These are normal while learning WebRTC:

- Remote video does not appear because tracks were added after offer creation.
- ICE candidates arrive before remote description is set.
- Localhost works, but different networks fail without TURN.
- Browser autoplay rules prevent video from playing unless video is muted or user interacted.
- Camera stays active after leaving because tracks were not stopped.
- Duplicate peer connections are created after reconnects or React re-renders.
- React Strict Mode may run effects twice in development.

## Production Notes for Later Integration

Do not copy the spike directly into the main product. Use the spike to learn the flow, then integrate behind clearer boundaries.

Suggested future app structure:

```text
apps/web/src/features/video/
  signaling-client.ts
  peer-connection.ts
  use-video-room.ts
  video-room.tsx
```

Product integration will also need:

- authenticated room access
- interview ownership checks
- interview room presence
- TURN credentials
- deployment support for WebSocket signaling
- graceful fallback when camera/mic permission is denied
- clear browser support expectations
- logging around connection failures

## Definition of Done

The spike is done when:

- two participants can complete a one-to-one call
- mic and camera toggles work
- leaving cleans up devices and connections
- connection state is visible
- the signaling message flow is documented
- you can explain offer, answer, and ICE candidate exchange without reading code

Do not add recording, screen share, chat, auth, database persistence, or interview-specific UI until this baseline works.
