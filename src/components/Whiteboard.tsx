import { Tldraw } from 'tldraw'
import 'tldraw/tldraw.css'

export default function Whiteboard() {
  return (
    <div className="w-full h-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800" style={{ minHeight: '500px' }}>
      <Tldraw persistenceKey="memora-collab-whiteboard" />
    </div>
  )
}
