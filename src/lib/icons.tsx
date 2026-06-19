import type { SVGProps } from 'react'

function Svg(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    />
  )
}

export const IconMic = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <rect x="9" y="2" width="6" height="12" rx="3" />
    <path d="M5 10v1a7 7 0 0 0 14 0v-1" />
    <line x1="12" y1="18" x2="12" y2="22" />
  </Svg>
)

export const IconMicOff = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <line x1="2" y1="2" x2="22" y2="22" />
    <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V5a3 3 0 0 0-5.94-.6" />
    <path d="M5 10v1a7 7 0 0 0 11.95 4.95M19 10v1a7 7 0 0 1-.11 1.23" />
    <line x1="12" y1="18" x2="12" y2="22" />
  </Svg>
)

export const IconCam = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <rect x="2" y="6" width="13" height="12" rx="2" />
    <path d="M15 10.5 22 7v10l-7-3.5" />
  </Svg>
)

export const IconCamOff = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <line x1="2" y1="2" x2="22" y2="22" />
    <path d="M15 13.34V8a2 2 0 0 0-2-2H8.66M4 6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h9a2 2 0 0 0 1.66-.88" />
    <path d="M22 7l-5 2.5" />
  </Svg>
)

export const IconHand = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M18 11V6.5a1.5 1.5 0 0 0-3 0V11" />
    <path d="M15 10.5V4.5a1.5 1.5 0 0 0-3 0V10" />
    <path d="M12 10V3.5a1.5 1.5 0 0 0-3 0V11" />
    <path d="M9 11V6a1.5 1.5 0 0 0-3 0v8a6 6 0 0 0 6 6h1a6 6 0 0 0 5-4.5l.8-3.2a1.6 1.6 0 0 0-3-1L15 14" />
  </Svg>
)

export const IconCopy = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </Svg>
)

export const IconUsers = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </Svg>
)

export const IconX = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </Svg>
)

export const IconCheck = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <polyline points="20 6 9 17 4 12" />
  </Svg>
)

export const IconRadio = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="2" />
    <path d="M16.24 7.76a6 6 0 0 1 0 8.49M7.76 16.24a6 6 0 0 1 0-8.49M19.07 4.93a10 10 0 0 1 0 14.14M4.93 19.07a10 10 0 0 1 0-14.14" />
  </Svg>
)

export const IconVolume = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14" />
  </Svg>
)

export const IconUser = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </Svg>
)

export const IconTag = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="m20.59 13.41-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
    <line x1="7" y1="7" x2="7.01" y2="7" />
  </Svg>
)

export const IconAlertTriangle = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="m10.29 3.86-8.49 14.7A1 1 0 0 0 2.66 20h16.68a1 1 0 0 0 .86-1.44l-8.49-14.7a1 1 0 0 0-1.72 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </Svg>
)

export const IconShield = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </Svg>
)

export const IconEdit = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </Svg>
)

export const IconCalendar = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </Svg>
)

export const IconTrash = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </Svg>
)
