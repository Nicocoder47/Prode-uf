import axios from 'axios';
import { TheSportsDbPlayerProvider } from '../src/services/footballData/providers/TheSportsDbPlayerProvider';
import { WikimediaPlayerProvider } from '../src/services/footballData/providers/WikimediaPlayerProvider';
import { bestIdentityMatch } from '../src/services/footballData/playerIdentityMatch';

const names = ['Emiliano Martínez', 'Christian Romero', 'Nahuel Molina', 'Giovani Lo Celso'];

for (const name of names) {
  const sdb = await TheSportsDbPlayerProvider.searchCandidates(name, 'Argentina');
  const wiki = await WikimediaPlayerProvider.searchCandidates(name, 'Argentina');
  const all = [...sdb, ...wiki];
  const match = bestIdentityMatch({ name, nationality: 'Argentina' }, all);
  console.log(name, 'sdb=', sdb.length, 'wiki=', wiki.length, 'best=', match?.score, match?.verification);
}
