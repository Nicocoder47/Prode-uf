import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { MOTION } from '../../constants/design';
import { FormBreakdownCard, FormStrip, StatBar } from './StatVisualizations';
import type { TeamIntelligence, PlayerIntelligence, RecentMatchEntry } from '../../utils/intelligenceAnalytics';
import { fmtDateShort, fmtNumber, fmtPct } from '../../utils/formatDisplay';
import { TeamCrest } from '../worldcup/TeamCrest';

function HistoryRow({ entry }: { entry: RecentMatchEntry }) {
  return (
    <Link
      to={`/matches/${entry.matchId}`}
      className="flex items-center gap-3 rounded-2xl bg-white/6 px-3 py-2.5 ring-1 ring-white/8 transition hover:bg-white/10"
    >
      <span
        className={`wc26-form-pill shrink-0 ${entry.result === 'W' ? 'win' : entry.result === 'D' ? 'draw' : 'loss'}`}
      >
        {entry.result}
      </span>
      <TeamCrest flag={entry.opponent.flag} code={entry.opponent.code} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black text-white">{entry.opponent.name}</p>
        <p className="text-[10px] font-semibold text-white/45">
          {fmtDateShort(entry.date)} · {entry.isHome ? 'Local' : 'Visitante'}
          {entry.isOfficial ? ' · Oficial' : ' · Amistoso'}
        </p>
      </div>
      <p className="font-black text-white">
        {entry.goalsFor}–{entry.goalsAgainst}
      </p>
    </Link>
  );
}

export function TeamIntelligencePanel({ data }: { data: TeamIntelligence }) {
  const maxG = Math.max(data.goalsFor, data.goalsAgainst, 1);

  return (
    <motion.div {...MOTION.enter} className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { l: 'Índice forma', v: data.formIndex != null ? fmtPct(data.formIndex) : '—' },
          { l: 'Goles a favor', v: String(data.goalsFor) },
          { l: 'Goles en contra', v: String(data.goalsAgainst) },
          { l: 'Diferencia', v: data.sampleSize > 0 ? (data.goalDifference > 0 ? `+${data.goalDifference}` : String(data.goalDifference)) : '—' },
        ].map(s => (
          <div key={s.l} className="wc26-stat-card-dark text-center">
            <p className="text-xl font-black text-white">{s.v}</p>
            <p className="text-[9px] font-black uppercase text-white/45">{s.l}</p>
          </div>
        ))}
      </div>

      {data.form.length > 0 && (
        <div className="wc26-card-intelligence p-4">
          <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-white/45">Forma · últimos 10</p>
          <FormStrip form={data.form} />
          <p className="mt-2 text-center font-mono text-sm font-black tracking-widest text-white/80">
            {data.form.join('')}
          </p>
        </div>
      )}

      {data.sampleSize > 0 && (
        <FormBreakdownCard wins={data.wins} draws={data.draws} losses={data.losses} />
      )}

      <div className="wc26-card space-y-4 p-5">
        <p className="wc26-section-title">Rendimiento reciente</p>
        {data.sampleSize > 0 ? (
          <>
            <StatBar label="Goles convertidos" value={data.goalsFor} max={maxG} color="green" />
            <StatBar label="Goles recibidos" value={data.goalsAgainst} max={maxG} color="blue" />
            {data.avgGoalsFor != null && (
              <div className="rounded-2xl bg-wc26-gray100/80 px-3 py-2.5 text-center">
                <p className="text-[10px] font-bold uppercase text-wc26-text/45">Prom. goles/partido</p>
                <p className="text-lg font-black text-wc26-green">{fmtNumber(data.avgGoalsFor, 1)}</p>
              </div>
            )}
          </>
        ) : (
          <p className="text-center text-sm text-wc26-text/50">Sin partidos finalizados todavía.</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="wc26-stat-card text-center">
          <p className="text-2xl font-black text-wc26-blue">{data.officialMatches}</p>
          <p className="text-[10px] font-black uppercase text-wc26-text/45">Oficiales</p>
        </div>
        <div className="wc26-stat-card text-center">
          <p className="text-2xl font-black text-wc26-muted">{data.friendlyMatches}</p>
          <p className="text-[10px] font-black uppercase text-wc26-text/45">Amistosos</p>
        </div>
      </div>

      {data.recentHistory.length > 0 && (
        <section>
          <p className="wc26-section-title">Historial reciente</p>
          <div className="space-y-2">
            {data.recentHistory.slice().reverse().map(e => (
              <HistoryRow key={e.matchId} entry={e} />
            ))}
          </div>
        </section>
      )}

      {data.opponents.length > 0 && (
        <section>
          <p className="wc26-section-title">Rivales enfrentados</p>
          <div className="wc26-card divide-y divide-wc26-gray100/80 overflow-hidden">
            {data.opponents.slice(0, 8).map(o => (
              <div key={o.team.id} className="flex items-center gap-3 px-4 py-3">
                <TeamCrest flag={o.team.flag} code={o.team.code} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-black text-wc26-text">{o.team.name}</p>
                  <p className="text-xs text-wc26-text/45">{o.played} PJ · {o.wins}G {o.draws}E {o.losses}P</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="wc26-card-intelligence flex items-center justify-between p-4">
        <div>
          <p className="text-[10px] font-black uppercase text-white/45">Tendencia</p>
          <p className="font-black text-white">{data.trendLabel}</p>
        </div>
        {data.formIndex != null && (
          <div className="text-right">
            <p className="text-3xl font-black text-wc26-fifaYellow">{data.formIndex}</p>
            <p className="text-[9px] font-bold uppercase text-white/45">Índice</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function PlayerIntelligencePanel({ data }: { data: PlayerIntelligence }) {
  return (
    <motion.div {...MOTION.enter} className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          { l: 'Partidos', v: data.appearances || '—' },
          { l: 'Goles', v: data.goals || '—' },
          { l: 'Asist.', v: data.assists || '—' },
        ].map(s => (
          <div key={s.l} className="wc26-stat-card-dark text-center">
            <p className="text-xl font-black text-white">{s.v}</p>
            <p className="text-[9px] font-black uppercase text-white/45">{s.l}</p>
          </div>
        ))}
      </div>

      {data.avgGoalsPerMatch != null && (
        <div className="wc26-card p-4 text-center">
          <p className="text-[10px] font-black uppercase text-wc26-text/45">Promedio de goles</p>
          <p className="text-3xl font-black text-wc26-green">{fmtNumber(data.avgGoalsPerMatch, 2)}</p>
        </div>
      )}

      {data.teamForm.length > 0 && (
        <div className="wc26-card-intelligence p-4">
          <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-white/45">
            Forma de {data.player.team?.name ?? 'su selección'}
          </p>
          <FormStrip form={data.teamForm} />
          {data.teamFormIndex != null && (
            <p className="mt-2 text-center text-sm font-black text-wc26-fifaYellow">
              Índice {data.teamFormIndex}/100
            </p>
          )}
        </div>
      )}
    </motion.div>
  );
}
