# Multi-Participant WebRTC Plan

This document explains how to evolve the current two-person video room into a room that supports multiple participants.

The current app is built around a simple one-to-one model:

```txt
You <-> one RTCPeerConnection <-> one remote user
```

For multiple participants, that model needs to become:

```txt
You <-> RTCPeerConnection A <-> Jake
You <-> RTCPeerConnection B <-> Sara
You <-> RTCPeerConnection C <-> Mina
```

In a browser-only mesh WebRTC room, every participant has a separate peer connection to every other participant.

## What Changes Conceptually

In the current two-person version, there is only:

- one remote user
- one peer connection
- one remote stream
- one remote media status

For multiple participants, each remote user needs their own:

- `RTCPeerConnection`
- remote `MediaStream`
- offer/answer exchange
- ICE candidate exchange
- camera/mic status
- leave cleanup

## Server Changes

The signaling server needs to track all users in a room, not just one target user.

Useful maps:

```ts
const emailToSocketMapping = new Map<string, string>();
const socketToEmailMapping = new Map<string, string>();
const socketToRoomMapping = new Map<string, string>();
const roomToEmailIdsMapping = new Map<string, Set<string>>();
```

When a user joins a room, the server should:

1. Find the users already in that room.
2. Send that list to the new user.
3. Notify existing users that a new user joined.
4. Add the new user to the room mappings.

Example event:

```ts
socket.emit('room-users', {
  users: existingEmailIds,
});
```

Existing users still receive:

```ts
socket.to(roomId).emit('user-joined', { emailId });
```

## Signaling Payloads

In the two-person app, `emailId` often means "the other user."

In a multi-user app, signaling messages should be explicit about who the message is for.

Use `toEmail` for outgoing messages:

```ts
socket.emit('call-user', {
  toEmail,
  offer,
});
```

```ts
socket.emit('call-accepted', {
  toEmail,
  answer,
});
```

```ts
socket.emit('ice-candidate', {
  toEmail,
  candidate,
});
```

The server should add `fromEmail` when forwarding:

```ts
socket.to(targetSocketId).emit('incoming-call', {
  fromEmail,
  offer,
});
```

```ts
socket.to(targetSocketId).emit('call-accepted', {
  fromEmail,
  answer,
});
```

```ts
socket.to(targetSocketId).emit('ice-candidate', {
  fromEmail,
  candidate,
});
```

This makes every event unambiguous.

## Client State Shape

The current app has one peer connection and one remote stream.

For multiple participants, use a participant map keyed by email:

```ts
interface RemoteParticipant {
  emailId: string;
  peer: RTCPeerConnection;
  stream: MediaStream | null;
  isCameraOn: boolean;
  isMicOn: boolean;
}

type RemoteParticipants = Record<string, RemoteParticipant>;
```

State could look like:

```ts
const [participants, setParticipants] = useState<RemoteParticipants>({});
```

Each participant entry represents one remote user.

## Peer Connection Management

Instead of one global peer connection, create one peer connection per remote email.

Helpful helper functions:

```ts
const createPeerConnection = (emailId: string) => {
  const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS });

  peer.addEventListener('track', (event) => {
    const [stream] = event.streams;
    updateParticipantStream(emailId, stream);
  });

  peer.addEventListener('icecandidate', (event) => {
    if (!event.candidate) {
      return;
    }

    socket.emit('ice-candidate', {
      toEmail: emailId,
      candidate: event.candidate.toJSON(),
    });
  });

  return peer;
};
```

Then keep those peer connections in state or refs:

```ts
const peersRef = useRef<Record<string, RTCPeerConnection>>({});
```

Refs are useful because peer connections are mutable objects and should not force React renders on every internal state change.

## Join Flow

When a user joins a room:

1. Server sends `room-users` to the new user.
2. New user creates one peer connection per existing user.
3. New user adds local tracks to each peer connection.
4. New user creates an offer for each existing user.
5. Existing users receive offers and answer.

Example:

```ts
socket.on('room-users', async ({ users }) => {
  for (const emailId of users) {
    const peer = getOrCreatePeer(emailId);
    addLocalTracks(peer);

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);

    socket.emit('call-user', {
      toEmail: emailId,
      offer: peer.localDescription,
    });
  }
});
```

## Incoming Offer Flow

When an existing user receives `incoming-call`:

1. Create or reuse a peer connection for `fromEmail`.
2. Add local tracks.
3. Set the remote offer.
4. Create an answer.
5. Send the answer back to `fromEmail`.

```ts
socket.on('incoming-call', async ({ fromEmail, offer }) => {
  const peer = getOrCreatePeer(fromEmail);
  addLocalTracks(peer);

  await peer.setRemoteDescription(offer);
  const answer = await peer.createAnswer();
  await peer.setLocalDescription(answer);

  socket.emit('call-accepted', {
    toEmail: fromEmail,
    answer: peer.localDescription,
  });
});
```

## ICE Candidate Flow

When a user receives an ICE candidate, they need to apply it to the peer connection for the sender:

```ts
socket.on('ice-candidate', async ({ fromEmail, candidate }) => {
  const peer = peersRef.current[fromEmail];

  if (!peer) {
    return;
  }

  await peer.addIceCandidate(candidate);
});
```

## Media Toggle Flow

When a user toggles mic/camera, broadcast that status to the room:

```ts
socket.emit('media-toggle', {
  kind: 'audio',
  enabled: false,
});
```

The server can broadcast it to everyone else in the same room:

```ts
socket.to(roomId).emit('media-toggle', {
  fromEmail,
  kind,
  enabled,
});
```

The client updates only that participant:

```ts
setParticipants((participants) => ({
  ...participants,
  [fromEmail]: {
    ...participants[fromEmail],
    isMicOn: enabled,
  },
}));
```

## User Leave Flow

When a user leaves or closes the tab:

1. Server removes them from room mappings.
2. Server emits `user-left` to the room.
3. Every remaining client closes that user's peer connection.
4. Every remaining client removes that user from the participant map.

```ts
socket.on('user-left', ({ emailId }) => {
  peersRef.current[emailId]?.close();
  delete peersRef.current[emailId];

  setParticipants((participants) => {
    const nextParticipants = { ...participants };
    delete nextParticipants[emailId];
    return nextParticipants;
  });
});
```

## Rendering The Video Grid

Local preview can stay pinned bottom-right.

Remote users can render in the main grid:

```tsx
<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
  {Object.values(participants).map((participant) => (
    <VideoPlayer
      key={participant.emailId}
      mediaStream={participant.stream}
      label={getUserDisplayName(participant.emailId)}
      status={getRemoteMediaStatus(participant)}
    />
  ))}
</div>
```

For one remote user, this looks like the current main video area.

For many users, it becomes a grid.

## Important Tradeoff: Mesh WebRTC

This plan uses mesh WebRTC.

That means each participant sends media separately to every other participant.

For example, in a 5-person room, each browser sends 4 outgoing video streams.

Mesh is fine for learning and small rooms, but it does not scale well.

Approximate guidance:

- 2 to 4 users: mesh is usually okay for a demo.
- 5+ users: CPU and bandwidth can become a problem.
- Production group calls usually use an SFU such as mediasoup, LiveKit, Janus, Jitsi, or Twilio.

## Suggested Implementation Order

1. Change server payloads from `emailId` to `toEmail` and forwarded `fromEmail`.
2. Add `room-users` event on join.
3. Create `peersRef` on the client.
4. Add `getOrCreatePeer(emailId)`.
5. Store remote participants in a map.
6. Create offers to all existing room users.
7. Handle incoming offers per remote user.
8. Apply ICE candidates per remote user.
9. Render remote participants as a grid.
10. Update media toggle events to include `fromEmail`.
11. Update leave handling to close and remove one participant.

## What Not To Do

Do not try to reuse one `RTCPeerConnection` for all participants.

Do not store only one `remoteUserStream`.

Do not rely on event names without `fromEmail` or `toEmail`; multi-user signaling needs explicit routing.

Do not expect mesh WebRTC to scale to large rooms.

## V2 Goal

The v2 goal should be:

- one local user
- multiple remote participants
- one peer connection per remote participant
- remote participant grid
- user leave cleanup per participant
- camera/mic status per participant

That keeps the architecture understandable while extending the current v1 naturally.
