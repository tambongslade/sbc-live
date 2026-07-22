/* Icon set — lucide-react pack, re-exported under the app's icon names.
   Default footprint matches the previous hand-rolled set (15px). */
import {
  Calendar,
  Check,
  Copy,
  Hand,
  House,
  Mic,
  MicOff,
  Pencil,
  Plus,
  Radio,
  Search,
  Shield,
  Tag,
  Trash2,
  TriangleAlert,
  User,
  Users,
  Video,
  VideoOff,
  Volume2,
  X,
  type LucideProps,
} from 'lucide-react'

const wrap = (Icon: React.ComponentType<LucideProps>) =>
  function WrappedIcon(props: LucideProps) {
    return <Icon size={15} strokeWidth={2} aria-hidden="true" {...props} />
  }

export const IconMic = wrap(Mic)
export const IconMicOff = wrap(MicOff)
export const IconCam = wrap(Video)
export const IconCamOff = wrap(VideoOff)
export const IconHand = wrap(Hand)
export const IconCopy = wrap(Copy)
export const IconUsers = wrap(Users)
export const IconX = wrap(X)
export const IconCheck = wrap(Check)
export const IconRadio = wrap(Radio)
export const IconVolume = wrap(Volume2)
export const IconUser = wrap(User)
export const IconTag = wrap(Tag)
export const IconAlertTriangle = wrap(TriangleAlert)
export const IconShield = wrap(Shield)
export const IconEdit = wrap(Pencil)
export const IconCalendar = wrap(Calendar)
export const IconTrash = wrap(Trash2)
export const IconSearch = wrap(Search)
export const IconHome = wrap(House)
export const IconPlus = wrap(Plus)
