import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, Users, CalendarClock, Wallet, Target, Activity, UserCog, ChevronRight, ChevronDown } from 'lucide-react'
import { MOTION } from '../../constants/design'
import type { Player, Team } from '../../types/worldcup'
import type { FormResult } from '../../utils/teamAnalytics'
import {
  computeAverageAge,
  computeSquadValue,
  fmtMarketCompact,
  formBreakdown,
  topPlayersForTeam,
} from '../../utils/teamAnalytics'
import { resolveTeamFlagUrl } from '../../utils/teamDisplay'
import { TeamCrest } from './TeamCrest'
import { PlayerAvatar } from './PlayerAvatar'

type TeamProfileCardProps = {
  team: Team
  groupId: string
  players: Player[]
  form: FormResult[]
  goalsPerMatch: number | null
  accent: string
  index?: number
  expanded?: boolean
  onToggle?: () => void
}

const CONFEDERATION_LABEL: Record<string, string> = {
  uefa: 'UEFA',
  conmebol: 'CONMEBOL',
  concacaf: 'CONCACAF',
  caf: 'CAF',
  afc: 'AFC',
  ofc: 'OFC',
}

function confederationLabel(value: string | null): string | null {
  if (!value) return null
  return CONFEDERATION_LABEL[value.toLowerCase()] ?? value.toUpperCase()
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users
  label: string
  value: string
}) {
  return (
    <div className="wc26-team-metric">
      <Icon className="h-3.5 w-3.5 shrink-0 text-white/45" aria-hidden="true" />
      <div className="min-w-0 text-center">
        <p className="wc26-team-metric__value">{value}</p>
        <p className="wc26-team-metric__label">{label}</p>
      </div>
    </div>
  )
}

type MetricItem = { icon: typeof Users; label: string; value: string }

function FormChips({ form }: { form: FormResult[] }) {
  const recent = form.slice(-5)
  if (recent.length === 0) return null
  const tone: Record<FormResult, string> = {
    W: 'wc26-form-chip--w',
    D: 'wc26-form-chip--d',
    L: 'wc26-form-chip--l',
  }
  const label: Record<FormResult, string> = { W: 'G', D: 'E', L: 'P' }
  return (
    <div className="flex items-center gap-1.5">
      {recent.map((r, i) => (
        <span key={i} className={`wc26-form-chip ${tone[r]}`}>
          {label[r]}
        </span>
      ))}
    </div>
  )
}

export function TeamProfileCard({
  team,
  groupId,
  players,
  form,
  goalsPerMatch,
  accent,
  index = 0,
  expanded = false,
  onToggle,
}: TeamProfileCardProps) {
  const squadValue = computeSquadValue(players)
  const averageAge = computeAverageAge(players)
  const formStats = formBreakdown(form)
  const destacados = topPlayersForTeam(players, 3)
  const confederation = confederationLabel(team.confederation)
  const marketLabel = fmtMarketCompact(squadValue)
  const collapsible = onToggle != null
  const flagImageUrl = resolveTeamFlagUrl(team.flag, team.flag, team.countryCode, team.code)

  const metrics: MetricItem[] = []
  if (players.length > 0) metrics.push({ icon: Users, label: 'Plantel', value: `${players.length}` })
  if (averageAge != null) metrics.push({ icon: CalendarClock, label: 'Edad prom.', value: `${averageAge}` })
  if (marketLabel) metrics.push({ icon: Wallet, label: 'Valor', value: marketLabel })
  if (team.fifaRanking != null) metrics.push({ icon: Trophy, label: 'Ranking FIFA', value: `#${team.fifaRanking}` })
  if (goalsPerMatch != null) metrics.push({ icon: Target, label: 'Goles/PJ', value: goalsPerMatch.toFixed(1) })
  if (form.length > 0) {
    metrics.push({
      icon: Activity,
      label: 'Forma',
      value: `${formStats.wins}G ${formStats.draws}E ${formStats.losses}P`,
    })
  }

  const header = (
    <div
      className={`wc26-team-profile__header-inner${
        collapsible && !expanded ? ' wc26-team-profile__header-inner--row' : ''
      }${expanded ? ' is-expanded' : ''}`}
    >
      <div className="wc26-team-profile__crest-slot">
        <TeamCrest
          flag={team.flag}
          code={team.code}
          name={team.name}
          countryCode={team.countryCode}
          size={expanded ? 'lg' : 'sm'}
          premium
        />
      </div>
      <div className="wc26-team-profile__header-copy">
        <h3 className={`wc26-team-profile__name${expanded ? '' : ' wc26-team-profile__name--compact'}`}>{team.name}</h3>
        <div className="wc26-team-profile__tags">
          {groupId !== '—' && <span className="wc26-team-tag wc26-team-tag--group">Grupo {groupId}</span>}
          {confederation && <span className="wc26-team-tag">{confederation}</span>}
          {team.fifaRanking != null && (
            <span className="wc26-team-rank">
              <Trophy className="h-3 w-3" />
              <span>#{team.fifaRanking}</span>
            </span>
          )}
        </div>
      </div>
      {collapsible && (
        <ChevronDown
          className={`wc26-team-profile__chevron h-4 w-4 shrink-0 text-white/45 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      )}
    </div>
  )

  const details = (
    <>
      {metrics.length > 0 ? (
        <div className="wc26-team-metrics">
          {metrics.map(m => (
            <Metric key={m.label} icon={m.icon} label={m.label} value={m.value} />
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[12px] font-medium text-white/55">
          Datos del plantel pendientes de sincronización.
        </p>
      )}

      {form.length > 0 && (
        <div className="wc26-team-form">
          <span className="wc26-team-form__label">Forma reciente</span>
          <FormChips form={form} />
        </div>
      )}

      {team.coach && (
        <div className="wc26-team-coach">
          <span className="wc26-team-coach__icon">
            <UserCog className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="wc26-team-coach__label">Director técnico</p>
            <p className="wc26-team-coach__name">{team.coach}</p>
          </div>
        </div>
      )}

      {destacados.length > 0 && (
        <div className="wc26-team-stars">
          <p className="wc26-team-stars__label">Jugadores destacados</p>
          <div className="wc26-team-stars__row">
            {destacados.map(player => (
              <Link key={player.id} to={`/players/${player.id}`} className="wc26-team-star">
                <PlayerAvatar
                  photo={player.photo}
                  photoUrl={player.photoUrl}
                  provider={player.provider}
                  providerPlayerId={player.providerPlayerId}
                  apiFootballId={player.apiFootballId}
                  theSportsDbId={player.theSportsDbId}
                  name={player.name}
                  size="sm"
                />
                <span className="wc26-team-star__name">{player.name}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="wc26-team-cta">
        <Link to={`/teams/${team.id}?tab=plantel`} className="wc26-team-cta__primary">
          Ver Plantel
          <ChevronRight className="h-4 w-4" />
        </Link>
        <Link to={`/teams/${team.id}?tab=stats`} className="wc26-team-cta__ghost">
          Ver Estadísticas
        </Link>
      </div>
    </>
  )

  return (
    <motion.div {...MOTION.enter} transition={{ ...MOTION.enter.transition, delay: Math.min(index * 0.02, 0.2) }}>
      <article
        className={`wc26-team-profile group ${collapsible ? 'wc26-team-profile--collapsible' : ''} ${expanded ? 'is-expanded' : ''}`}
        style={{ '--team-accent': accent } as React.CSSProperties}
      >
        <span className="wc26-team-profile__shine" aria-hidden="true" />
        {flagImageUrl ? (
          <span
            className="wc26-team-profile__flag-watermark"
            style={{ backgroundImage: `url("${flagImageUrl}")` }}
            aria-hidden="true"
          />
        ) : null}

        {collapsible ? (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            className="wc26-team-profile-toggle relative w-full"
          >
            {header}
          </button>
        ) : (
          <header className="relative">{header}</header>
        )}

        {collapsible ? (
          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                key="details"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
                className="wc26-team-profile__details overflow-hidden"
              >
                <div className="wc26-team-profile__details-inner">{details}</div>
              </motion.div>
            )}
          </AnimatePresence>
        ) : (
          <div className="wc26-team-profile__details-inner">{details}</div>
        )}
      </article>
    </motion.div>
  )
}
