import { motion } from 'framer-motion';
import { TrendingDown, TrendingUp, Minus, Shield, AlertTriangle, Zap } from 'lucide-react';
import { MOTION } from '../../constants/design';
import type { PlayerIntelligence, TeamIntelligence } from '../../utils/intelligenceAnalytics';
import { fmtNumber, fmtPct } from '../../utils/formatDisplay';

type AiInsightsProps =
  | { type: 'team'; data: TeamIntelligence }
  | { type: 'player'; data: PlayerIntelligence };

function TrendIcon({ trend }: { trend: TeamIntelligence['trend'] }) {
  if (trend === 'up') return <TrendingUp className="h-4 w-4 text-wc26-green" />;
  if (trend === 'down') return <TrendingDown className="h-4 w-4 text-wc26-red" />;
  if (trend === 'stable') return <Minus className="h-4 w-4 text-wc26-muted" />;
  return null;
}

function buildTeamInsights(data: TeamIntelligence) {
  const lines: { kind: 'strength' | 'weakness' | 'state' | 'risk' | 'trend'; text: string }[] = [];
  const name = data.team.name;
  const total = data.wins + data.draws + data.losses;

  if (total > 0) {
    lines.push({
      kind: 'state',
      text: `${name} acumula ${data.wins} victoria${data.wins !== 1 ? 's' : ''}, ${data.draws} empate${data.draws !== 1 ? 's' : ''} y ${data.losses} derrota${data.losses !== 1 ? 's' : ''} en sus últimos ${total} partidos registrados.`,
    });
  }

  if (data.formIndex != null && total >= 3) {
    const quality =
      data.formIndex >= 70 ? 'una de las mejores formas del torneo' :
      data.formIndex >= 45 ? 'una forma competitiva' : 'una forma irregular';
    lines.push({
      kind: 'strength',
      text: `${name} llega con ${quality} (índice de forma ${data.formIndex}/100).`,
    });
  }

  if (data.avgGoalsFor != null && data.sampleSize >= 2) {
    lines.push({
      kind: 'strength',
      text: `Promedia ${fmtNumber(data.avgGoalsFor, 1)} goles convertidos por partido en su ventana reciente.`,
    });
  }

  if (data.avgGoalsAgainst != null && data.sampleSize >= 2) {
    const defensive =
      data.avgGoalsAgainst < 1
        ? `Recibe menos de un gol por encuentro (${fmtNumber(data.avgGoalsAgainst, 1)} en promedio).`
        : `Recibe ${fmtNumber(data.avgGoalsAgainst, 1)} goles por partido en promedio.`;
    lines.push({
      kind: data.avgGoalsAgainst < 1.2 ? 'strength' : 'weakness',
      text: defensive,
    });
  }

  if (data.goalDifference < 0 && total >= 2) {
    lines.push({
      kind: 'weakness',
      text: `Diferencia de gol negativa (${data.goalDifference}) en los últimos partidos analizados.`,
    });
  }

  if (data.trend !== 'unknown') {
    lines.push({ kind: 'trend', text: data.trendLabel + '.' });
  }

  if (data.losses >= 3 && total >= 5) {
    lines.push({
      kind: 'risk',
      text: `Riesgo elevado: ${data.losses} derrotas en la muestra reciente pueden afectar la confianza del grupo.`,
    });
  }

  if (data.officialMatches > 0) {
    lines.push({
      kind: 'state',
      text: `${data.officialMatches} partido${data.officialMatches !== 1 ? 's' : ''} oficial${data.officialMatches !== 1 ? 'es' : ''} en el torneo${data.friendlyMatches > 0 ? ` y ${data.friendlyMatches} amistoso${data.friendlyMatches !== 1 ? 's' : ''}` : ''}.`,
    });
  }

  if (lines.length === 0) {
    lines.push({
      kind: 'state',
      text: `${name} aún no tiene partidos finalizados en el torneo. El análisis se completará cuando haya resultados.`,
    });
  }

  return lines;
}

function buildPlayerInsights(data: PlayerIntelligence) {
  const lines: { kind: 'strength' | 'weakness' | 'state' | 'risk' | 'trend'; text: string }[] = [];
  const name = data.player.name;

  if (data.appearances > 0) {
    lines.push({
      kind: 'state',
      text: `${name} registra ${data.appearances} partido${data.appearances !== 1 ? 's' : ''}, ${data.goals} gol${data.goals !== 1 ? 'es' : ''} y ${data.assists} asistencia${data.assists !== 1 ? 's' : ''}.`,
    });
  }

  if (data.avgGoalsPerMatch != null && data.goals > 0) {
    lines.push({
      kind: 'strength',
      text: `Promedio ofensivo de ${fmtNumber(data.avgGoalsPerMatch, 2)} goles por partido.`,
    });
  }

  if (data.rating != null && data.rating >= 7) {
    lines.push({
      kind: 'strength',
      text: `Rating destacado (${fmtNumber(data.rating, 1)}), por encima del promedio del plantel.`,
    });
  } else if (data.rating != null && data.rating < 6.5) {
    lines.push({
      kind: 'weakness',
      text: `Rating por debajo del umbral elite (${fmtNumber(data.rating, 1)}).`,
    });
  }

  if (data.teamFormIndex != null && data.teamForm.length >= 3) {
    lines.push({
      kind: data.teamFormIndex >= 55 ? 'strength' : 'risk',
      text: `Su selección muestra índice de forma ${data.teamFormIndex}/100 (${fmtPct(data.teamFormIndex)}).`,
    });
  }

  if (data.appearances === 0) {
    lines.push({
      kind: 'state',
      text: `${name} aún no acumula minutos registrados en el torneo.`,
    });
  }

  return lines;
}

const KIND_ICON = {
  strength: Shield,
  weakness: AlertTriangle,
  state: Zap,
  risk: AlertTriangle,
  trend: TrendingUp,
};

const KIND_LABEL = {
  strength: 'Fortaleza',
  weakness: 'Debilidad',
  state: 'Estado',
  risk: 'Riesgo',
  trend: 'Tendencia',
};

export function AiInsights(props: AiInsightsProps) {
  const lines = props.type === 'team' ? buildTeamInsights(props.data) : buildPlayerInsights(props.data);
  const trend = props.type === 'team' ? props.data.trend : undefined;

  return (
    <motion.div {...MOTION.enter} className="wc26-card-intelligence space-y-4 p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="wc26-section-title !text-white/90">Análisis IA</p>
        {trend && <TrendIcon trend={trend} />}
      </div>
      <div className="space-y-3">
        {lines.map((line, i) => {
          const Icon = KIND_ICON[line.kind];
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              className="flex gap-3 rounded-2xl bg-white/8 p-3 ring-1 ring-white/10"
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-wc26-fifaYellow" />
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-wc26-fifaYellow/80">
                  {KIND_LABEL[line.kind]}
                </p>
                <p className="mt-1 text-sm font-semibold leading-relaxed text-white/90">{line.text}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
