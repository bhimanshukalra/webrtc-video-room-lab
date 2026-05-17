# WebRTC Video Room Lab

This project is a small learning app for understanding how a browser-to-browser video call works with WebRTC.

It has two parts:

- `web`: a React app where users join a room and see video streams.
- `server`: a Socket.IO signaling server that helps two browsers find each other.

The important idea: the server does not carry the video. The server only passes setup messages between browsers. Once WebRTC connects, the browsers send audio/video directly to each other.

## Project Structure

```txt
webrtc-video-room-lab/
  server/
    src/index.ts        Socket.IO signaling server
    package.json

  web/
    src/App.tsx         App routes
    src/pages/Home.tsx  Join room form
    src/pages/Room.tsx  Video room and WebRTC flow
    src/providers/      Socket and peer connection providers
    src/components/     Video rendering components
    package.json
```

## How To Run It

Install dependencies in both apps:

```bash
cd server
pnpm install

cd ../web
pnpm install
```

Start the server:

```bash
cd server
pnpm dev
```

Start the web app in another terminal:

```bash
cd web
pnpm dev
```

Open the web app:

```txt
http://localhost:5173
```

To test a call, open the app in two browser tabs:

1. In tab one, enter an email and room id.
2. In tab two, enter a different email and the same room id.
3. Both users should join the same room and exchange video.

## The Big Picture

A WebRTC call needs two things:

1. Media: camera and microphone streams from each browser.
2. Signaling: a way for browsers to exchange connection setup messages.

Browsers already know how to send media to each other using WebRTC, but they do not know how to discover each other by themselves. That is why this project uses Socket.IO as a signaling layer.

Socket.IO sends messages like:

- "I joined room 123"
- "Here is my WebRTC offer"
- "Here is my WebRTC answer"
- "Here is an ICE candidate you can try"

After that setup works, WebRTC handles the real audio/video connection.

## Main Runtime Flow

### 1. User Opens The App

`web/src/App.tsx` sets up two pages:

- `/`: home page with email and room inputs.
- `/room/:roomId`: video room page.

The app is wrapped in `AppProvider`, which contains:

- `SocketProvider`: creates the Socket.IO client.
- `PeerProvider`: creates the `RTCPeerConnection`.

### 2. User Joins A Room

On the home page, the user enters:

- `emailId`
- `roomId`

When the user clicks `Enter Room`, the client emits:

```ts
socket.emit('join-room', { emailId, roomId });
```

The server stores which socket belongs to which email, then joins that socket to the requested room.

### 3. Server Notifies Existing Users

When a second user joins the same room, the server emits:

```ts
socket.broadcast.to(roomId).emit('user-joined', { emailId });
```

This tells the existing user: "A new user joined. Start a WebRTC call with them."

### 4. The First Browser Creates An Offer

When the existing user receives `user-joined`, the room page:

1. Gets camera and microphone using `getUserMedia`.
2. Adds those tracks to the peer connection.
3. Creates a WebRTC offer.
4. Sends that offer to the new user through Socket.IO.

The offer is not video itself. It is a description of what this browser can send and receive.

### 5. The Second Browser Creates An Answer

The new user receives:

```ts
incoming-call
```

Then it:

1. Gets camera and microphone.
2. Adds those tracks to its peer connection.
3. Sets the received offer as the remote description.
4. Creates an answer.
5. Sends that answer back through Socket.IO.

The answer says: "I understand your offer, and here is how I can connect back."

### 6. Both Browsers Exchange ICE Candidates

An ICE candidate is a possible network route between two browsers.

Examples:

- local network route
- public IP route
- relay route, if a TURN server is used

In this project, when a browser finds a candidate, it sends:

```ts
socket.emit('ice-candidate', { emailId, candidate });
```

The server relays that candidate to the other browser.

The receiving browser calls:

```ts
peer.addIceCandidate(candidate);
```

This helps WebRTC find a working network path.

### 7. Remote Video Appears

When the peer connection receives remote media, the browser fires a `track` event.

The app listens for that event in `PeerProvider`:

```ts
peer.addEventListener('track', handleTrackEvent);
```

The received stream is stored as `remoteUserStream`, and `RoomPage` renders it with `VideoPlayer`.

## Why Video Uses srcObject

Camera video from `getUserMedia` is a `MediaStream`, not a normal video URL.

That means this does not work well:

```tsx
<video src={mediaStream} />
```

Instead, the app uses:

```ts
videoRef.current.srcObject = mediaStream;
```

That is the standard way to show live camera or WebRTC streams in a `<video>` element.

## Important Files

### `server/src/index.ts`

This is the signaling server. It handles:

- users joining rooms
- forwarding offers
- forwarding answers
- forwarding ICE candidates

It does not process video.

### `web/src/providers/SocketProvider.tsx`

Creates the Socket.IO client connection:

```ts
io('http://localhost:8001')
```

This lets the React app talk to the signaling server.

### `web/src/providers/PeerProvider.tsx`

Creates and shares the `RTCPeerConnection`.

It exposes helpers for:

- creating offers
- creating answers
- setting remote answers
- adding ICE candidates
- sending local media tracks
- storing the remote media stream

### `web/src/pages/Home.tsx`

Contains the form where a user enters email and room id.

### `web/src/pages/Room.tsx`

Contains the main WebRTC flow:

- get local camera and microphone
- send local tracks
- handle incoming calls
- exchange ICE candidates
- render local and remote videos

### `web/src/components/VideoPlayer.tsx`

Displays a `MediaStream` in a video element using `srcObject`.

## Common Problems

### I See Only One Video

That usually means local camera is working, but remote WebRTC media is not arriving.

Check:

- Both tabs are using different emails.
- Both tabs use the same room id.
- The server was restarted after code changes.
- Only one process is running on port `8001`.
- The browser console does not show WebRTC or media permission errors.

### Port 8001 Is Already In Use

The Socket.IO server uses port `8001`.

If the app behaves strangely, an old server may still be running. Stop the old process and restart the server.

### Browser Asks For Camera Permission

Allow camera and microphone access. Without permission, there is no local stream to send to the other user.

## Current Limitations

This is a learning project, not a production video app yet.

Some missing production pieces:

- no authentication
- no room cleanup
- no handling for users leaving
- no TURN server for difficult networks
- no screen sharing
- no mute/camera controls
- no multiple participant grid

For local learning and same-network testing, the current flow is enough to understand WebRTC basics.
