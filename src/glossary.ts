export interface GlossaryTerm {
  id: string;
  term: string;
  aliases?: string[];
  category: 'court' | 'politics' | 'ritual' | 'social' | 'textual' | 'spatial';
  definition: string;
}

export const GLOSSARY_TERMS: GlossaryTerm[] = [
  {
    id: 'imo-year',
    term: 'Imo year (1762)',
    aliases: ['imo year'],
    category: 'politics',
    definition:
      'The pivotal year of Prince Sado\'s death. In Hyegyong\'s memoirs, this marks the central dynastic rupture shaping all later testimony.',
  },
  {
    id: 'rice-chest',
    term: 'Rice chest',
    aliases: ['rice chest', 'that thing'],
    category: 'politics',
    definition:
      'Container into which Prince Sado was ordered in 1762. The phrase functions as both literal object and politically charged shorthand in later memoir disputes.',
  },
  {
    id: 'crown-prince',
    term: 'Crown Prince',
    aliases: ['heir apparent'],
    category: 'court',
    definition:
      'Designated successor to the throne. In this corpus, succession status drives factional alignments, surveillance, and inner-court conflict.',
  },
  {
    id: 'prince-regent',
    term: 'Prince-Regent',
    aliases: ['regent'],
    category: 'court',
    definition:
      'A crown prince exercising governing authority before accession. Prince Sado held this role before the 1762 catastrophe.',
  },
  {
    id: 'dowager-regency',
    term: 'Dowager regency',
    aliases: ['dowager regent', 'regency'],
    category: 'politics',
    definition:
      'Rule by a queen dowager during a minor king\'s reign. Queen Chŏngsun\'s 1800–1804 regency is central to late memoir grievance narratives.',
  },
  {
    id: 'inner-court',
    term: 'Inner court',
    aliases: ['inner court'],
    category: 'court',
    definition:
      'Palace domestic and gendered sphere where kinship, rank, and access shaped political outcomes as much as formal ministerial institutions.',
  },
  {
    id: 'secondary-consort',
    term: 'Secondary consort',
    aliases: ['consort'],
    category: 'court',
    definition:
      'Royal partner below queen rank, often with major succession implications. Several key memoir actors are secondary consorts.',
  },
  {
    id: 'filial-piety',
    term: 'Filial piety',
    aliases: ['filial devotion'],
    category: 'social',
    definition:
      'Confucian duty to parents and ancestors. A core moral frame in Hyegyong\'s narrative and Jeongjo\'s memorial politics.',
  },
  {
    id: 'posthumous-honor',
    term: 'Posthumous honor/title',
    aliases: ['posthumous title', 'honorary title'],
    category: 'ritual',
    definition:
      'Titles and honors granted after death. In the memoirs these are politically contested instruments of memory and legitimacy.',
  },
  {
    id: 'civil-examination',
    term: 'Civil service examination',
    aliases: ['civil service examination', 'examination'],
    category: 'politics',
    definition:
      'State examination route to office. Family advancement, factional entry, and status claims frequently hinge on exam success.',
  },
  {
    id: 'state-council',
    term: 'State Council',
    aliases: ['state council'],
    category: 'politics',
    definition:
      'Top governing body in Joseon administration. Appointment/removal in this arena reflects high-stakes factional power shifts.',
  },
  {
    id: 'memorial',
    term: 'Memorial (petition to throne)',
    aliases: ['memorial'],
    category: 'textual',
    definition:
      'Formal written petition to the king. Memorials in the memoirs serve as weapons in accusation, defense, and retrospective legitimation.',
  },
  {
    id: 'yangban',
    term: 'Yangban',
    aliases: ['yangban'],
    category: 'social',
    definition:
      'Hereditary elite status group in Joseon. Hyegyong\'s natal family identity and obligations are framed through this social position.',
  },
  {
    id: 'hwaseong',
    term: 'Hwasŏng',
    aliases: ['Hwasŏng', 'Hwaseong'],
    category: 'spatial',
    definition:
      'Monumental fortress-city project under Jeongjo, tied to filial commemoration and the politics of Sado\'s memory.',
  },
  {
    id: 'hyeollyung',
    term: 'Hyŏllyung Tomb',
    aliases: ['Hyŏllyung', 'Hyŏllyung Tomb'],
    category: 'spatial',
    definition:
      'Reinterment site of Prince Sado, treated in the memoirs as a central node of dynastic remembrance and ritual statecraft.',
  },
  {
    id: 'joseon',
    term: 'Joseon dynasty',
    aliases: ['Joseon'],
    category: 'politics',
    definition:
      'Korean dynastic state (1392–1897). Hyegyong\'s memoirs are situated in late Joseon succession and factional crises.',
  },
];
