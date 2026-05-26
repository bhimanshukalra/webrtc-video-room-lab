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
3. Both users should join the same room and exchange audio/video.

If you open `/room/:roomId` directly without a saved email, the app redirects you back to the home page so you can join with an email first.

## Current Features

- Two-person audio/video rooms.
- Room join by email and room id.
- Direct room URL support after an email is known.
- Local camera on/off.
- Local microphone mute/unmute.
- End call button.
- Local self-preview pinned in the bottom-right corner.
- Remote video in the main center area.
- User name labels on videos.
- Remote camera/mic status labels.
- Toast when another user leaves.
- Signaling, peer connection, and ICE connection status badges.
- Socket reconnect rejoin for the signaling room.
- Tab close and manual leave cleanup.

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
- "My microphone is muted"
- "I left the room"

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

### 8. Users Toggle Camera Or Microphone

When a user turns camera or microphone on/off, the app does two things:

1. It updates the local media track:

```ts
track.enabled = false;
```

2. It sends a `media-toggle` event to the other user through Socket.IO.

That lets the remote UI show labels like:

```txt
Camera off
Mic muted
```

The media track is not removed when toggled. This keeps the WebRTC connection alive.

### 9. A User Leaves

When the user clicks `End call`, the client emits:

```ts
socket.emit('leave-room');
```

The local camera and microphone tracks are stopped, local peer senders are removed, and the user is sent back to the home page.

When a tab closes, Socket.IO disconnects. The server handles that disconnect and notifies the room:

```ts
socket.to(roomId).emit('user-left', { emailId });
```

The other browser then clears the remote stream and shows a toast like:

```txt
jake left
```

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
- forwarding camera/mic status changes
- users leaving rooms
- disconnect cleanup

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
- clearing the remote media stream
- tracking peer connection state
- tracking ICE connection state

### `web/src/pages/Home.tsx`

Contains the form where a user enters email and room id.

It stores the email in `sessionStorage` so refreshing or revisiting a room can keep the user identity.

### `web/src/pages/Room.tsx`

Contains the main WebRTC flow:

- get local camera and microphone
- send local tracks
- handle incoming calls
- exchange ICE candidates
- render local and remote videos
- toggle local camera/microphone
- send remote camera/mic status updates
- handle user leaving
- show call status badges

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

### I Do Not Hear Audio

Check:

- The remote user's microphone is not muted.
- Your output volume is on.
- The browser has permission to use the microphone.
- You are not testing both tabs without headphones, which can cause feedback or echo issues.

### Port 8001 Is Already In Use

The Socket.IO server uses port `8001`.

If the app behaves strangely, an old server may still be running. Stop the old process and restart the server.

### Browser Asks For Camera Permission

Allow camera and microphone access. Without permission, there is no local stream to send to the other user.

### Direct Room URL Sends Me Home

That means the app does not know your email yet.

Join from the home page first. The email is saved in session storage for the current browser session.

## Manual Test Checklist

Before calling a change good, test:

- two users can join the same room
- local and remote video appear
- audio works
- camera off/on updates the remote status
- mic mute/unmute updates the remote status
- end call returns home and notifies the other user
- closing a tab shows a "left" toast for the other user
- refreshing a room works when email is saved
- direct room URL without email redirects home
- signaling status changes when the server is stopped/restarted

## Current Limitations

This is a learning project, not a production video app yet.

Some missing production pieces:

- no authentication
- no TURN server for difficult networks
- no screen sharing
- no multiple participant grid
- no full peer reconnection after WebRTC connection failure

For local learning and same-network testing, the current flow is enough to understand WebRTC basics.
