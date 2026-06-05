/** photoUrl (API) → photo (dominio) → null */

export function resolvePlayerPhoto(player: {

  photo?: string | null;

  photoUrl?: string | null;

}): string | null {

  return player.photoUrl ?? player.photo ?? null;

}



export function playerInitials(name: string): string {

  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return '?';

  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();

}



const POSITION_COLORS: Record<string, string> = {

  gk: 'linear-gradient(145deg, #F8B91E, #D4AF37)',

  def: 'linear-gradient(145deg, #0057B8, #003D82)',

  mid: 'linear-gradient(145deg, #006B3F, #003D25)',

  fwd: 'linear-gradient(145deg, #E63946, #C92A36)',

  default: 'linear-gradient(145deg, #0E8A4A, #006B3F)',

};



export function positionGroup(position?: string | null): 'gk' | 'def' | 'mid' | 'fwd' | 'default' {

  if (!position) return 'default';

  const p = position.toLowerCase();

  if (/goal|keeper|gk|arq|portero/.test(p)) return 'gk';

  if (/def|back|cb|lb|rb|defen/.test(p)) return 'def';

  if (/mid|cm|cdm|cam|medio|volante/.test(p)) return 'mid';

  if (/wing|forward|strik|off|delan|fw|st|del/.test(p)) return 'fwd';

  return 'default';

}



export function positionColor(position?: string | null): string {

  return POSITION_COLORS[positionGroup(position)];

}



export function positionAbbrev(position?: string | null): string {

  if (!position) return '';

  const g = positionGroup(position);

  if (g === 'gk') return 'GK';

  if (g === 'def') return 'DEF';

  if (g === 'mid') return 'MID';

  if (g === 'fwd') return 'DEL';

  return position.slice(0, 3).toUpperCase();

}

