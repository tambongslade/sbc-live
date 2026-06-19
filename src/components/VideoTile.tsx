import { Track, type Participant } from 'livekit-client'
import { useEffect, useRef } from 'react'
import { IconMic, IconMicOff } from '../lib/icons'
import { initials } from '../lib/types'

/**
 * Renders one participant: camera feed (or initials placeholder), remote audio,
 * name + mic state, green ring while speaking. Parent must re-render on room
 * events (useRoomTick) so track changes flow down.
 */
export function VideoTile({ participant, big }: { participant: Participant; big?: boolean }) {
  const camPub = participant.getTrackPublication(Track.Source.Camera)
  const micPub = participant.getTrackPublication(Track.Source.Microphone)
  const camTrack = camPub?.track
  const micTrack = micPub?.track
  const camOn = !!camTrack && !camPub.isMuted
  const micOn = !!micPub && !micPub.isMuted

  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const el = videoRef.current
    if (!camTrack || !el) return
    camTrack.attach(el)
    return () => {
      camTrack.detach(el)
    }
  }, [camTrack, camOn])

  useEffect(() => {
    if (participant.isLocal) return // never play our own mic back
    const el = audioRef.current
    if (!micTrack || !el) return
    micTrack.attach(el)
    return () => {
      micTrack.detach(el)
    }
  }, [micTrack, participant.isLocal])

  const name = participant.name || participant.identity

  return (
    <div
      className={`tile ${participant.isSpeaking ? 'speaking' : ''} ${big ? 'tile-big' : ''}`}
      data-identity={participant.identity}
    >
      {camOn ? (
        <video ref={videoRef} autoPlay playsInline muted={participant.isLocal} />
      ) : (
        <div className="tile-void">
          <span>{initials(name)}</span>
        </div>
      )}
      <audio ref={audioRef} autoPlay />
      <div className="tile-label">
        <span className="mono">
          {name}
          {participant.isLocal ? ' · vous' : ''}
        </span>
        {micOn ? <IconMic /> : <IconMicOff className="ic-off" />}
      </div>
    </div>
  )
}
