import { Bell, Menu, User } from 'lucide-react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { MOTION } from '../../constants/design'
import { TrophyIllustration } from './TrophyIllustration'

export function MobileHomeHeader() {
  return (
    <motion.header
      {...MOTION.fadeIn}
      className="wc26-mobile-header-glass relative z-30 mx-3 mt-[max(0.5rem,env(safe-area-inset-top))] flex items-center justify-between px-3 py-2"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <TrophyIllustration variant="header" />
        <div className="min-w-0 text-left">
          <p className="truncate text-sm font-extrabold tracking-wide text-white">PRODEMUNDIAL</p>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-wc26-yellow">Mundial 2026</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button type="button" className="wc26-header-icon-btn" aria-label="Notificaciones">
          <Bell className="h-[18px] w-[18px]" />
        </button>
        <Link to="/profile" className="wc26-header-icon-btn" aria-label="Perfil">
          <User className="h-[18px] w-[18px]" />
        </Link>
        <button type="button" className="wc26-header-icon-btn" aria-label="Menú">
          <Menu className="h-[18px] w-[18px]" />
        </button>
      </div>
    </motion.header>
  )
}
