import { resolvePlayerPhoto, playerInitials, positionColor, positionAbbrev } from '../../utils/playerPhoto';



interface PlayerAvatarProps {

  photo?: string | null;

  photoUrl?: string | null;

  name: string;

  size?: 'sm' | 'md' | 'lg' | 'hero';

  className?: string;

  shirtNumber?: number | null;

  position?: string | null;

  nationality?: string | null;

  flagUrl?: string | null;

  verified?: boolean;

}



const sizes = {

  sm: { box: 'h-11 w-11 text-sm', badge: 'text-[8px] px-1', num: 'text-[10px]' },

  md: { box: 'h-14 w-14 text-lg', badge: 'text-[9px] px-1.5', num: 'text-xs' },

  lg: { box: 'h-28 w-28 text-4xl', badge: 'text-[10px] px-2', num: 'text-sm' },

  hero: { box: 'h-36 w-36 text-5xl sm:h-40 sm:w-40', badge: 'text-xs px-2', num: 'text-base' },

};



export function PlayerAvatar({

  photo,

  photoUrl,

  name,

  size = 'md',

  className = '',

  shirtNumber,

  position,

  nationality,

  flagUrl,

  verified,

}: PlayerAvatarProps) {

  const src = resolvePlayerPhoto({ photo, photoUrl });

  const sz = sizes[size];



  if (src) {

    return (

      <div className={`relative shrink-0 ${className}`}>

        <img

          src={src}

          alt={name}

          loading="lazy"

          className={`${sz.box} rounded-2xl object-cover object-top shadow-wc26-float ring-2 ring-white/40`}

        />

        {verified && (

          <span className="absolute -bottom-1 -right-1 rounded-full bg-[#006B3F] px-1 py-0.5 text-[8px] font-black uppercase text-white shadow-sm ring-2 ring-white">

            ✓

          </span>

        )}

      </div>

    );

  }



  const posColor = positionColor(position);

  const posLabel = positionAbbrev(position);



  return (

    <div className={`relative shrink-0 ${className}`}>

      <span

        className={`${sz.box} grid place-items-center overflow-hidden rounded-2xl font-black text-white shadow-md ring-2 ring-white/30`}

        style={{ background: posColor }}

        aria-hidden

      >

        <span className="relative z-10">{playerInitials(name)}</span>

        {shirtNumber != null && shirtNumber > 0 && (

          <span className={`absolute left-1 top-1 font-mono font-black opacity-80 ${sz.num}`}>{shirtNumber}</span>

        )}

        <span

          className="absolute inset-0 opacity-20"

          style={{

            background: 'linear-gradient(135deg, rgba(255,255,255,0.35) 0%, transparent 55%)',

          }}

        />

      </span>

      {posLabel && (

        <span

          className={`absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-black/75 font-black uppercase tracking-wide text-white ${sz.badge}`}

        >

          {posLabel}

        </span>

      )}

      {(flagUrl || nationality) && size !== 'sm' && (

        <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-white text-[10px] shadow-sm ring-1 ring-black/10">

          {flagUrl ? (

            <img src={flagUrl} alt="" className="h-3.5 w-3.5 rounded-full object-cover" />

          ) : (

            <span className="font-bold text-[9px] text-wc26-text/60">{nationality?.slice(0, 2).toUpperCase()}</span>

          )}

        </span>

      )}

      {verified && (

        <span className="absolute -bottom-1 -right-1 rounded-full bg-[#006B3F] px-1 py-0.5 text-[8px] font-black uppercase text-white shadow-sm ring-2 ring-white">

          ✓

        </span>

      )}

    </div>

  );

}



export function unavailableLabel(value: unknown): string {

  if (value === null || value === undefined || value === '' || value === 0) return '—';

  return String(value);

}

