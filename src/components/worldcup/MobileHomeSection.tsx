import { motion } from 'framer-motion'
import { MOTION } from '../../constants/design'
import { MobileTopHeader } from '../layout/MobileTopHeader'
import { NotificationTicker } from '../notifications/NotificationTicker.tsx'

export function MobileHomeHeader() {
  return (
    <>
      <motion.div {...MOTION.fadeIn} className="relative z-30">
        <MobileTopHeader className="mx-3 mt-[max(0.5rem,env(safe-area-inset-top))]" />
      </motion.div>
      <NotificationTicker />
    </>
  )
}
