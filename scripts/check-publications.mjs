// Looks for papers on Semantic Scholar that are not yet in src/data/publications.yaml
// and adds them to the top of that file (not selected) so they can be reviewed in a PR.
//
//   node scripts/check-publications.mjs            update the file
//   node scripts/check-publications.mjs --dry-run  only print what would be added
//
// Optional env: S2_API_KEY (higher rate limits), REPORT_PATH (markdown summary for the PR body).

import { readFile, writeFile } from 'node:fs/promises';
import { parse, parseDocument } from 'yaml';

// Semantic Scholar splits the papers over two author profiles.
const AUTHOR_IDS = ['1607113435', '2387335620'];
const MY_SURNAME = 'Schimunek';

const PUBLICATIONS = new URL('../src/data/publications.yaml', import.meta.url);
const IGNORE = new URL('../src/data/publications-ignore.yaml', import.meta.url);
const dryRun = process.argv.includes('--dry-run');

const normalize = (title) => title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');

async function fetchJson(url) {
  const headers = process.env.S2_API_KEY ? { 'x-api-key': process.env.S2_API_KEY } : {};
  for (let attempt = 1; attempt <= 6; attempt++) {
    const res = await fetch(url, { headers });
    if (res.ok) return res.json();
    if (res.status !== 429 && res.status < 500) throw new Error(`${res.status} for ${url}`);
    await new Promise((r) => setTimeout(r, 5000 * attempt));
  }
  throw new Error(`Gave up on ${url}`);
}

async function authorPapers(id) {
  const fields = 'title,year,venue,journal,externalIds,authors,url';
  const data = await fetchJson(`https://api.semanticscholar.org/graph/v1/author/${id}/papers?fields=${fields}&limit=500`);
  return data.data ?? [];
}

// "Pieter-Jan Hoedt" -> "P.-J. Hoedt"
function shortName(fullName) {
  const parts = fullName.trim().split(/\s+/);
  const surname = parts.pop();
  const initials = parts.map((p) => p.split('-').map((s) => `${s[0].toUpperCase()}.`).join('-'));
  return [...initials, surname].join(' ');
}

function authorList(authors) {
  const names = authors.map((a) => shortName(a.name));
  if (names.length <= 12) return names;
  const first = names.slice(0, 3);
  const me = names.find((n) => n.endsWith(MY_SURNAME));
  if (me && !first.includes(me)) first.push(me);
  return [...first, 'et al.'];
}

function paperLink(paper) {
  const ids = paper.externalIds ?? {};
  if (ids.DOI && !ids.DOI.startsWith('10.48550/')) return `https://doi.org/${ids.DOI}`;
  if (ids.ArXiv) return `https://arxiv.org/abs/${ids.ArXiv}`;
  return paper.url;
}

function venueName(paper) {
  const venue = paper.journal?.name || paper.venue || '';
  if (/biorxiv/i.test(venue)) return 'bioRxiv preprint';
  if (/arxiv/i.test(venue) || (!venue && paper.externalIds?.ArXiv)) return 'arXiv preprint';
  return venue || 'Preprint';
}

function slug(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').slice(0, 5).join('-');
}

const doc = parseDocument(await readFile(PUBLICATIONS, 'utf8'));
const existing = doc.toJS() ?? [];
const ignored = parse(await readFile(IGNORE, 'utf8')) ?? [];

const knownTitles = new Set([...existing.map((p) => p.title), ...ignored].map(normalize));
const knownLinks = existing.flatMap((p) => Object.values(p.links ?? {})).join(' ').toLowerCase();

const isKnown = (paper) => {
  const t = normalize(paper.title);
  if (knownTitles.has(t)) return true;
  // Same paper with a slightly different title (subtitles, abbreviations)
  if ([...knownTitles].some((k) => k.slice(0, 40) === t.slice(0, 40))) return true;
  const { DOI, ArXiv } = paper.externalIds ?? {};
  return Boolean((DOI && knownLinks.includes(DOI.toLowerCase())) || (ArXiv && knownLinks.includes(ArXiv)));
};

const found = new Map();
for (const id of AUTHOR_IDS) {
  for (const paper of await authorPapers(id)) {
    if (paper.title && !isKnown(paper)) found.set(normalize(paper.title), paper);
  }
}

const added = [...found.values()].sort((a, b) => (b.year ?? 0) - (a.year ?? 0));

const report = added.length
  ? [
      `Semantic Scholar lists ${added.length} paper(s) that are not on the website yet:`,
      '',
      ...added.map((p) => `- **${p.title}** (${p.venue || 'unknown venue'}, ${p.year ?? 'no year'})`),
      '',
      `${dryRun ? 'They would be added' : 'They were added'} to the top of \`src/data/publications.yaml\` with \`selected: false\`.`,
      'Before merging, check the venue, `label` and author names, and set `selected: true` to feature one.',
      '',
      'To drop a paper for good, close this PR and add its title to `src/data/publications-ignore.yaml`.',
    ].join('\n')
  : 'No new publications found.';

console.log(report);
if (process.env.REPORT_PATH) await writeFile(process.env.REPORT_PATH, report + '\n');

if (added.length && !dryRun) {
  added.reverse().forEach((paper) => {
    const venue = venueName(paper);
    const entry = {
      id: slug(paper.title),
      title: paper.title,
      authors: authorList(paper.authors ?? []),
      venue,
      label: [venue.replace(/ preprint$/, ''), paper.year].filter(Boolean).join(' '),
      year: paper.year ?? null,
      selected: false,
      links: { paper: paperLink(paper) },
    };
    const node = doc.createNode(entry);
    node.flow = false;
    node.get('authors', true).flow = true;
    node.commentBefore = ' New from Semantic Scholar: check venue, label and authors';
    node.spaceBefore = true;
    doc.contents.items.unshift(node);
  });
  await writeFile(PUBLICATIONS, doc.toString({ lineWidth: 0, flowCollectionPadding: false }));
}
