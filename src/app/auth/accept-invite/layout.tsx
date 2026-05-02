import { Suspense } from 'react'
import AcceptInvitePage from './page'

export default function AcceptInviteLayout() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
      </div>
    }>
      <AcceptInvitePage />
    </Suspense>
  )
}
