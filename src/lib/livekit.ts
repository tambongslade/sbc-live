import { Room, RoomEvent, VideoPresets } from 'livekit-client'
import { useEffect, useState } from 'react'

/** Host / speaker room — publishes at 720p max (server capacity is tuned for this). */
export function createHostRoom() {
  return new Room({
    adaptiveStream: true,
    dynacast: true,
    videoCaptureDefaults: { resolution: VideoPresets.h720.resolution },
  })
}

/** Audience room — receive-only until promoted; same publish defaults if promoted. */
export function createViewerRoom() {
  return new Room({
    adaptiveStream: true,
    videoCaptureDefaults: { resolution: VideoPresets.h720.resolution },
  })
}

const TICK_EVENTS = [
  RoomEvent.ConnectionStateChanged,
  RoomEvent.ParticipantConnected,
  RoomEvent.ParticipantDisconnected,
  RoomEvent.TrackSubscribed,
  RoomEvent.TrackUnsubscribed,
  RoomEvent.TrackPublished,
  RoomEvent.TrackUnpublished,
  RoomEvent.TrackMuted,
  RoomEvent.TrackUnmuted,
  RoomEvent.LocalTrackPublished,
  RoomEvent.LocalTrackUnpublished,
  RoomEvent.ParticipantPermissionsChanged,
  RoomEvent.ActiveSpeakersChanged,
  RoomEvent.AudioPlaybackStatusChanged,
] as const

/** Re-render the component on any room activity (tracks, participants, permissions…). */
export function useRoomTick(room: Room) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const bump = () => setTick((t) => t + 1)
    for (const e of TICK_EVENTS) room.on(e, bump)
    return () => {
      for (const e of TICK_EVENTS) room.off(e, bump)
    }
  }, [room])
}

/** mm:ss elapsed since `since` (ms epoch), ticking every second. */
export function useElapsed(since: number | null): string {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!since) return
    const i = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(i)
  }, [since])
  if (!since) return '00:00'
  const s = Math.max(0, Math.floor((now - since) / 1000))
  const mm = String(Math.floor(s / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return `${mm}:${ss}`
}
