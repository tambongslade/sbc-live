import { Track, type Participant } from 'livekit-client'
import { useEffect, useRef } from 'react'
import { IconMic, IconMicOff } from '../lib/icons'
import { initials } from '../lib/types'

function goFullscreen(el: HTMLElement) {
  if (el.requestFullscreen) el.requestFullscreen()
  else if ((el as unknown as { webkitRequestFullscreen?: () => void }).webkitRequestFullscreen)
    (el as unknown as { webkitRequestFullscreen: () => void }).webkitRequestFullscreen()
}

export function VideoTile({ participant, big }: { participant: Participant; big?: boolean }) {
  const camPub = participant.getTrackPublication(Track.Source.Camera)
  const micPub = participant.getTrackPublication(Track.Source.Microphone)
  const camTrack = camPub?.track
  const micTrack = micPub?.track
  const camOn = !!camTrack && !camPub.isMuted
  const micOn = !!micPub && !micPub.isMuted

  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const tileRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = videoRef.current
    if (!camTrack || !el) return
    camTrack.attach(el)
    return () => { camTrack.detach(el) }
  }, [camTrack, camOn])

  useEffect(() => {
    if (participant.isLocal) return
    const el = audioRef.current
    if (!micTrack || !el) return
    micTrack.attach(el)
    return () => { micTrack.detach(el) }
  }, [micTrack, participant.isLocal])

  const name = participant.name || participant.identity

  return (
    <div
      ref={tileRef}
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
      <button
        className="tile-fullscreen"
        title="Plein écran"
        onClick={() => tileRef.current && goFullscreen(tileRef.current)}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
        </svg>
      </button>
    </div>
  )
}
