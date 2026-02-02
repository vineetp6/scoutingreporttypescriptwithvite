import './style.css'

type GameId = 'VAL' | 'LOL'

type QueryInput = {
  game: GameId
  opponent: string
  region: string
  seriesCount: number
}

type SeriesSummary = {
  id: string
  date: string
  opponent: string
  result: string
  mapOrGame: string
  tournament: TournamentSummary | null
  teams: TeamSummary[]
}

type TeamSummary = {
  id: string
  name: string
  logoUrl?: string
}

type TournamentSummary = {
  id: string
  name: string
}

type GridSeriesNode = {
  id: string
  startTimeScheduled?: string | null
  tournament?: {
    id?: string | null
    name?: string | null
  } | null
  title?: {
    id?: string | null
    nameShortened?: string | null
  } | null
  teams?: Array<{
    baseInfo?: {
      id?: string | null
      name?: string | null
      logoUrl?: string | null
    } | null
  } | null> | null
}

type GridSeriesResponse = {
  data?: {
    allSeries?: {
      edges?: Array<{ node?: GridSeriesNode | null } | null> | null
    } | null
  } | null
  errors?: Array<{ message: string }>
}

type ReportSection = {
  title: string
  bullets: string[]
}

type ScoutingReport = {
  heading: string
  confidence: number
  generatedAt: string
  notes: string[]
  tendencies: ReportSection
  strategies: ReportSection
  defaults: ReportSection
  comps: ReportSection
  series: SeriesSummary[]
}

type QuerySnapshot = {
  game: string
  opponent: string
  region: string
}

type AvailabilityRow = {
  game: string
  opponent: string
  region: string
  seriesId: string
  date: string
}

type ChartMetric = {
  label: string
  value: number
}

const app = document.querySelector<HTMLDivElement>('#app')!

app.innerHTML = `
  <div class="page">
    <header class="hero">
      <div>
        <p class="eyebrow">Automated Scouting Report Generator</p>
        <h1>Scout the next opponent from GRID match intelligence.</h1>
        <p class="lead">
          Pull recent series, extract tendencies, and ship a crisp report for coaches and analysts.
        </p>
      </div>
      <div class="hero-panel">
        <div class="status">
          <div>
            <p class="status-label">GRID API</p>
            <p class="status-value" id="apiStatus">Checking config...</p>
          </div>
          <div class="status-pill" id="mockPill">Mock Mode</div>
        </div>
        <div class="status-grid">
          <div>
            <p class="status-label">Data feeds</p>
            <p class="status-value">Central + Live</p>
          </div>
          <div>
            <p class="status-label">Output</p>
            <p class="status-value">Scouting brief</p>
          </div>
          <div>
            <p class="status-label">Focus</p>
            <p class="status-value">VAL + LoL</p>
          </div>
        </div>
      </div>
    </header>

    <section class="workspace">
      <div class="workspace-column">
        <div class="panel form-panel">
          <form id="scoutForm">
            <div class="panel-header">
              <h2>Generate report</h2>
              <p>Fill the opponent details and assemble a tailored scout in seconds.</p>
            </div>
            <div class="form-grid">
              <label class="field">
                <span>Game</span>
                <select id="gameSelect">
                  <option value="VAL">Valorant</option>
                  <option value="LOL">League of Legends</option>
                </select>
              </label>
              <label class="field">
                <span>Opponent</span>
                <input id="opponentInput" type="text" placeholder="Team name" required />
              </label>
              <label class="field">
                <span>Region</span>
                <input id="regionInput" type="text" placeholder="EMEA, NA, APAC" />
              </label>
              <label class="field">
                <span>Recent series</span>
                <input id="seriesInput" type="number" min="1" max="10" value="5" />
              </label>
            </div>
          </form>
          <div class="form-actions">
            <button type="submit" form="scoutForm" class="primary">Generate scouting report</button>
            <button type="button" id="availabilityButton" class="ghost">View available data</button>
            <button type="button" id="sampleButton" class="ghost">Load sample opponent</button>
          </div>
          <div class="hint">
            Live data pulls from GRID when <code>VITE_GRID_API_KEY</code> is set. Set <code>VITE_GRID_MOCK=true</code> to force mock mode.
          </div>
        </div>

        <section class="panel availability-panel">
          <div class="panel-header">
            <h2>Available data</h2>
            <p>Preview games, opponents, and regions pulled from recent series. No form input required.</p>
          </div>
          <div id="availabilityBody" class="availability-body">
            <div class="empty-state">
              <h3>No preview yet</h3>
              <p>Click "View available data" to browse recent series without filling the form.</p>
            </div>
          </div>
        </section>
      </div>

      <section class="panel report-panel">
        <div class="panel-header">
          <h2>Scouting report</h2>
          <p id="reportMeta">Submit a query to see the report.</p>
        </div>
        <div id="reportBody" class="report-body">
          <div class="empty-state">
            <h3>No report yet</h3>
            <p>Run a query to surface strategies, player tendencies, and default setups.</p>
          </div>
        </div>
      </section>
    </section>
  </div>
`

const apiKey = import.meta.env.VITE_GRID_API_KEY as string | undefined
const forceMock = (import.meta.env.VITE_GRID_MOCK as string | undefined) === 'true'
const useMock = !apiKey || forceMock

const GRID_GRAPHQL_URL = 'https://api-op.grid.gg/central-data/graphql'
const GRID_SERIES_QUERY = `
  query SeriesList($first: Int!, $titleId: ID!) {
    allSeries(
      first: $first
      filter: { titleId: $titleId, types: [ESPORTS] }
      orderBy: StartTimeScheduled
      orderDirection: DESC
    ) {
      edges {
        node {
          id
          startTimeScheduled
          title {
            id
            nameShortened
          }
          teams {
            baseInfo {
              id
              name
              logoUrl
            }
          }
          tournament {
            id
            name
          }
        }
      }
    }
  }
`

const GRID_SERIES_FALLBACK_QUERY = `
  query SeriesListLite($first: Int!, $titleId: ID!) {
    allSeries(
      first: $first
      filter: { titleId: $titleId }
    ) {
      edges {
        node {
          id
          startTimeScheduled
          title {
            id
            nameShortened
          }
          teams {
            baseInfo {
              id
              name
              logoUrl
            }
          }
          tournament {
            id
            name
          }
        }
      }
    }
  }
`

const parseEnvNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

type GridRequestError = Error & { status?: number }

const GRID_TITLE_IDS: Record<GameId, string> = {
  VAL: String(parseEnvNumber(import.meta.env.VITE_GRID_VALORANT_TITLE_ID as string | undefined, 6)),
  LOL: String(parseEnvNumber(import.meta.env.VITE_GRID_LOL_TITLE_ID as string | undefined, 1))
}

const apiStatus = document.querySelector<HTMLParagraphElement>('#apiStatus')!
const mockPill = document.querySelector<HTMLDivElement>('#mockPill')!
const form = document.querySelector<HTMLFormElement>('#scoutForm')!
const gameSelect = document.querySelector<HTMLSelectElement>('#gameSelect')!
const opponentInput = document.querySelector<HTMLInputElement>('#opponentInput')!
const regionInput = document.querySelector<HTMLInputElement>('#regionInput')!
const seriesInput = document.querySelector<HTMLInputElement>('#seriesInput')!
const reportMeta = document.querySelector<HTMLParagraphElement>('#reportMeta')!
const reportBody = document.querySelector<HTMLDivElement>('#reportBody')!
const sampleButton = document.querySelector<HTMLButtonElement>('#sampleButton')!
const availabilityButton = document.querySelector<HTMLButtonElement>('#availabilityButton')!
const availabilityBody = document.querySelector<HTMLDivElement>('#availabilityBody')!

const setStatus = (statusText: string, live: boolean) => {
  apiStatus.textContent = statusText
  mockPill.textContent = live ? 'Live Mode' : 'Mock Mode'
  mockPill.classList.toggle('live', live)
}

const isAuthError = (error: unknown) => {
  if (!error) {
    return false
  }
  const message = error instanceof Error ? error.message : String(error)
  const normalized = message.toLowerCase()
  return normalized.includes('forbidden') || normalized.includes('unauthorized')
}

setStatus(
  !apiKey ? 'Awaiting API key' : useMock ? 'API key detected (mock forced)' : 'Live API ready',
  !useMock
)

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const mockSeries: SeriesSummary[] = [
  {
    id: 'SR-1145',
    date: '2026-01-18',
    opponent: 'Solar Invitational',
    result: '2-1',
    mapOrGame: 'VAL (6) | EMEA feed',
    tournament: { id: 'T-556', name: 'Solar Invitational' },
    teams: [
      { id: 'TM-120', name: 'Nova Prime' },
      { id: 'TM-217', name: 'Violet Crest' }
    ]
  },
  {
    id: 'SR-1138',
    date: '2026-01-12',
    opponent: 'Crimson Circuit',
    result: '2-0',
    mapOrGame: 'VAL (6) | EMEA feed',
    tournament: { id: 'T-542', name: 'Crimson Circuit' },
    teams: [
      { id: 'TM-241', name: 'Crimson Tide' },
      { id: 'TM-135', name: 'Solaris' }
    ]
  },
  {
    id: 'SR-1129',
    date: '2026-01-09',
    opponent: 'Aurora Open',
    result: '1-2',
    mapOrGame: 'VAL (6) | Global feed',
    tournament: { id: 'T-518', name: 'Aurora Open' },
    teams: [
      { id: 'TM-332', name: 'Aurora' },
      { id: 'TM-404', name: 'Drift' }
    ]
  },
  {
    id: 'SR-1122',
    date: '2026-01-04',
    opponent: 'Glass Wolves Showdown',
    result: '2-0',
    mapOrGame: 'VAL (6) | NA feed',
    tournament: { id: 'T-507', name: 'Glass Wolves Showdown' },
    teams: [
      { id: 'TM-119', name: 'Glass Wolves' },
      { id: 'TM-210', name: 'Ironclad' }
    ]
  },
  {
    id: 'SR-1118',
    date: '2025-12-29',
    opponent: 'Vector Clash',
    result: '2-1',
    mapOrGame: 'VAL (6) | APAC feed',
    tournament: { id: 'T-488', name: 'Vector Clash' },
    teams: [
      { id: 'TM-376', name: 'Vector' },
      { id: 'TM-164', name: 'Nightfall' }
    ]
  }
]

const gameLabels: Record<GameId, string> = {
  VAL: 'Valorant',
  LOL: 'League of Legends'
}

const getGameLabel = (game: GameId) => gameLabels[game]

const formatSeriesDate = (value?: string | null) => {
  if (!value) {
    return 'TBD'
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return 'TBD'
  }
  return parsed.toLocaleDateString()
}

const buildTournamentSummary = (tournament: GridSeriesNode['tournament']): TournamentSummary | null => {
  const id = tournament?.id ? String(tournament.id) : ''
  const name = tournament?.name?.trim() ?? ''
  if (!id && !name) {
    return null
  }
  return {
    id,
    name: name || 'Unknown tournament'
  }
}

const parseGridPayload = (raw: string): GridSeriesResponse | null => {
  if (!raw) {
    return null
  }
  try {
    return JSON.parse(raw) as GridSeriesResponse
  } catch {
    return null
  }
}

const requestGridSeries = async (query: string, variables: { first: number; titleId: string }) => {
  const response = await fetch(GRID_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey ?? ''
    },
    body: JSON.stringify({
      query,
      variables
    })
  })

  const raw = await response.text()
  const payload = parseGridPayload(raw)

  if (!response.ok) {
    const details = payload?.errors?.[0]?.message ?? raw.trim()
    const message = details || `GRID API request failed (${response.status})`
    const error = new Error(message) as GridRequestError
    error.status = response.status
    throw error
  }

  if (!payload) {
    throw new Error('GRID API returned empty response.')
  }

  if (payload.errors?.length) {
    throw new Error(payload.errors[0]?.message ?? 'GRID API error')
  }

  return payload
}

async function fetchSeriesList(query: QueryInput): Promise<SeriesSummary[]> {
  if (useMock) {
    await sleep(450)
    return mockSeries
  }

  const titleId = GRID_TITLE_IDS[query.game]
  const requestedCount = Math.min(Math.max(query.seriesCount, 1), 50)
  const variables = { first: requestedCount, titleId }
  let payload: GridSeriesResponse

  try {
    payload = await requestGridSeries(GRID_SERIES_QUERY, variables)
  } catch (error) {
    const status = (error as GridRequestError).status
    if (isAuthError(error) || status === 401 || status === 403) {
      setStatus('Live API forbidden; check API key access', true)
      throw error
    }
    if (status === 400) {
      payload = await requestGridSeries(GRID_SERIES_FALLBACK_QUERY, variables)
    } else {
      throw error
    }
  }

  const edges = payload.data?.allSeries?.edges ?? []
  const regionLabel = query.region ? `${query.region} feed` : 'Global feed'

  return edges
    .map((edge) => edge?.node)
    .filter((node): node is GridSeriesNode => Boolean(node?.id))
    .map((node) => {
      const tournament = buildTournamentSummary(node.tournament)
      const tournamentLabel = tournament?.name ?? 'Unknown tournament'
      const titleId = node.title?.id ? String(node.title.id) : ''
      const titleShort = node.title?.nameShortened?.trim()
      const titleLabel = titleShort
        ? titleId
          ? `${titleShort} (${titleId})`
          : titleShort
        : titleId
      const mapOrGame = titleLabel ? `${titleLabel} | ${regionLabel}` : regionLabel
      const teams = node.teams ?? []
      const teamSummaries = teams
        .map((team) => team?.baseInfo)
        .filter((team): team is NonNullable<typeof team> => Boolean(team?.id))
        .map((team) => ({
          id: String(team.id),
          name: team.name?.trim() || 'Unknown team',
          logoUrl: team.logoUrl?.trim() || undefined
        }))
      return {
        id: node.id,
        date: formatSeriesDate(node.startTimeScheduled),
        opponent: tournamentLabel,
        result: node.startTimeScheduled ? 'Scheduled' : 'TBD',
        mapOrGame,
        tournament,
        teams: teamSummaries
      }
    })
}

async function generateScoutingReport(query: QueryInput): Promise<ScoutingReport> {
  const series = await fetchSeriesList(query)
  const now = new Date()
  const gameLabel = getGameLabel(query.game)
  const heading = `${query.opponent} | ${gameLabel} | ${query.region || 'Global'}`
  const sourceLabel = useMock ? 'Sample data' : 'GRID Live API'
  return {
    heading,
    confidence: query.seriesCount >= 5 ? 82 : 64,
    generatedAt: now.toLocaleString(),
    notes: [
      `Source: ${sourceLabel}`,
      `Analyzed ${series.length} recent series`,
      `Baseline derived from ${query.seriesCount} requested series`,
      query.region ? `Region focus: ${query.region}` : 'Region focus: Global'
    ],
    tendencies: {
      title: 'Player tendencies',
      bullets: [
        'Initiator duos favor early mid control then rotate late off utility',
        'Anchors hold second contact, preferring layered re-take setups',
        'High propensity to double-swing after first contact on defense'
      ]
    },
    strategies: {
      title: 'Common strategies',
      bullets: [
        'Early tempo into site fakes on round 4-6 to force rotations',
        'Mid-round shift to heavy utility with 20s spike commitment',
        'Post-plant defaults consistently prioritize long crossfires'
      ]
    },
    defaults: {
      title: query.game === 'VAL' ? 'Default site setups' : 'Default lanes',
      bullets: query.game === 'VAL'
        ? [
            'Split: double controller smoke with A-main lurk support',
            'Haven: 3-1-1 default, delayed Garage pressure at 1:05',
            'Bind: fast B-long control, sentinel holds hookah passive'
          ]
        : [
            '3-1-1 lane split, jungle pathing top to bot reset',
            'Bot lane priority into early dragon stack',
            'Mid wave clear into side-lane hover at 7:00'
          ]
    },
    comps: {
      title: query.game === 'VAL' ? 'Recent comps' : 'Recent comps',
      bullets: query.game === 'VAL'
        ? [
            'Double controller with Skye as flex initiator',
            'Sentinel swap based on map: Killjoy on Split, Cypher on Breeze',
            'Raze prioritized on tight-site maps'
          ]
        : [
            'Front-to-back with engage support, peel top lane',
            'Control mage mid with roaming support windows',
            'Scaling bot carry with early jungle cover'
          ]
    },
    series
  }
}

const queryHistory: QuerySnapshot[] = []
const maxQueryHistory = 8

const buildQuerySnapshot = (query: QueryInput): QuerySnapshot => ({
  game: getGameLabel(query.game),
  opponent: query.opponent || 'Unknown opponent',
  region: query.region || 'Global'
})

const extractRegionLabel = (mapOrGame: string) => {
  if (!mapOrGame) {
    return 'Global feed'
  }
  const parts = mapOrGame
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.length >= 2) {
    return parts[parts.length - 1]
  }
  return mapOrGame
}

const getSeriesOpponentLabel = (series: SeriesSummary) => {
  const teamNames = series.teams
    .map((team) => team.name)
    .filter((name) => name && name !== 'Unknown team')
  if (teamNames.length >= 2) {
    return `${teamNames[0]} vs ${teamNames[1]}`
  }
  if (teamNames.length === 1) {
    return teamNames[0]
  }
  return series.opponent || 'Unknown opponent'
}

const buildAvailabilityRows = (seriesList: SeriesSummary[], game: GameId): AvailabilityRow[] => {
  const gameLabel = getGameLabel(game)
  return seriesList.map((series) => ({
    game: gameLabel,
    opponent: getSeriesOpponentLabel(series),
    region: extractRegionLabel(series.mapOrGame),
    seriesId: series.id,
    date: series.date
  }))
}

const clampValue = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const buildComparisonMetrics = (report: ScoutingReport, query: QueryInput): ChartMetric[] => {
  const base = report.confidence
  const seriesBoost = Math.min(report.series.length * 6, 30)
  const requestBias = Math.min(query.seriesCount * 4, 20)
  return [
    { label: 'Tempo', value: clampValue(base + 6, 30, 95) },
    { label: 'Utility', value: clampValue(55 + seriesBoost, 30, 95) },
    { label: 'Adaptation', value: clampValue(45 + Math.round(base * 0.45), 30, 95) },
    { label: 'Discipline', value: clampValue(50 + requestBias, 30, 95) }
  ]
}

const buildRadarMetrics = (report: ScoutingReport, query: QueryInput): ChartMetric[] => {
  const base = report.confidence
  const depth = clampValue(40 + report.series.length * 7, 30, 95)
  return [
    { label: 'Pace', value: clampValue(base + 4, 30, 95) },
    { label: 'Setup', value: clampValue(52 + query.seriesCount * 3, 30, 95) },
    { label: 'Adapt', value: clampValue(48 + Math.round(base * 0.35), 30, 95) },
    { label: 'Discipline', value: clampValue(50 + Math.round(base * 0.25), 30, 95) },
    { label: 'Depth', value: depth }
  ]
}

const hashString = (value: string) => {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  }
  return hash || 1
}

const buildHeatmapValues = (seed: string, rows: number, cols: number) => {
  let state = hashString(seed)
  const total = rows * cols
  const values: number[] = []
  for (let i = 0; i < total; i += 1) {
    state = (state * 1664525 + 1013904223) >>> 0
    values.push(35 + (state % 60))
  }
  return values
}

const TAG_STOP_WORDS = new Set([
  'and',
  'the',
  'to',
  'with',
  'into',
  'on',
  'of',
  'a',
  'an',
  'for',
  'from',
  'then',
  'after',
  'before',
  'at',
  'in',
  'by',
  'as',
  'is',
  'are',
  'be',
  'or',
  'that',
  'this',
  'these',
  'those',
  'over',
  'under',
  'early',
  'late',
  'mid',
  'round',
  'site',
  'sites',
  'lane',
  'lanes',
  'off'
])

const buildTagCloud = (sections: ReportSection[], limit = 8): string[] => {
  const counts = new Map<string, number>()
  sections.flatMap((section) => section.bullets).forEach((bullet) => {
    const words = bullet.toLowerCase().match(/[a-z]+/g) ?? []
    words.forEach((word) => {
      if (word.length < 3 || TAG_STOP_WORDS.has(word)) {
        return
      }
      counts.set(word, (counts.get(word) ?? 0) + 1)
    })
  })

  return Array.from(counts.entries())
    .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([word]) => word)
}

function renderReport(report: ScoutingReport, query: QueryInput) {
  reportMeta.textContent = `Generated ${report.generatedAt} for ${report.heading}`
  reportBody.innerHTML = `
    <div class="report-header">
      <div>
        <h3>${report.heading}</h3>
        <p class="muted">${report.notes.join(' · ')}</p>
      </div>
      <div class="confidence">
        <span>Confidence</span>
        <div class="bar">
          <div class="bar-fill" style="width: ${report.confidence}%"></div>
        </div>
        <strong>${report.confidence}%</strong>
      </div>
    </div>
    ${renderQueryTable(queryHistory)}
    ${renderVisualReport(report, query)}
    ${renderVisualAnalytics(report, query)}
    <div class="report-grid">
      ${renderSection(report.tendencies)}
      ${renderSection(report.strategies)}
      ${renderSection(report.defaults)}
      ${renderSection(report.comps)}
    </div>
    <div class="series-list">
      <h4>Recent series</h4>
      <div class="series-cards">
        ${report.series.slice(0, query.seriesCount).map((series) => `
          <article class="series-card">
            <div class="series-info">
              <p class="series-id">Series ID: ${series.id}</p>
              <h5>${series.opponent}</h5>
              ${renderTournamentMeta(series.tournament)}
              <p class="muted">${series.mapOrGame}</p>
              ${renderTeams(series.teams)}
            </div>
            <div class="series-meta">
              <span>${series.date}</span>
              <strong>${series.result}</strong>
            </div>
          </article>
        `).join('')}
      </div>
    </div>
  `
}

function renderSection(section: ReportSection) {
  return `
    <article class="report-section">
      <h4>${section.title}</h4>
      <ul>
        ${section.bullets.map((bullet) => `<li>${bullet}</li>`).join('')}
      </ul>
    </article>
  `
}

function renderVisualReport(report: ScoutingReport, query: QueryInput) {
  const tags = buildTagCloud([report.tendencies, report.strategies, report.defaults, report.comps], 8)
  const tagMarkup = tags.length
    ? tags.map((tag) => `<span class="tag">${tag}</span>`).join('')
    : '<span class="tag muted">no tags yet</span>'
  const seriesPulse = renderSeriesPulse(report.series)
  return `
    <div class="visual-report">
      <article class="visual-card highlight">
        <p class="visual-label">Matchup</p>
        <h4>${query.opponent || 'Unknown opponent'}</h4>
        <p class="muted">${getGameLabel(query.game)} · ${query.region || 'Global'}</p>
        <p class="muted">Report ID ${report.heading.replace(/[^A-Z0-9]/gi, '').slice(0, 10) || 'SCOUT'}</p>
      </article>
      <article class="visual-card">
        <p class="visual-label">Confidence</p>
        <div class="radial" style="--value: ${report.confidence}">
          <span>${report.confidence}%</span>
        </div>
        <p class="muted">Signal strength</p>
      </article>
      <article class="visual-card">
        <p class="visual-label">Top themes</p>
        <div class="tag-row">${tagMarkup}</div>
        <p class="muted">Derived from report bullets</p>
      </article>
      <article class="visual-card">
        <p class="visual-label">Series pulse</p>
        ${seriesPulse}
      </article>
    </div>
  `
}

function renderSeriesPulse(seriesList: SeriesSummary[]) {
  const pulseItems = seriesList.slice(0, 6)
  if (!pulseItems.length) {
    return '<p class="muted">No series loaded yet.</p>'
  }
  return `
    <div class="pulse">
      ${pulseItems.map((series, index) => {
        const height = 22 + (pulseItems.length - index) * 6
        return `<span style="height: ${height}px" title="${series.opponent}"></span>`
      }).join('')}
    </div>
    <p class="muted">Latest ${pulseItems.length} series</p>
  `
}

function renderVisualAnalytics(report: ScoutingReport, query: QueryInput) {
  return `
    <div class="visual-analytics">
      <article class="visual-card">
        <p class="visual-label">Bar chart - rankings</p>
        ${renderComparisonBars(report, query)}
      </article>
      <article class="visual-card">
        <p class="visual-label">Heatmap - spatial patterns</p>
        ${renderHeatmap(report, query)}
      </article>
      <article class="visual-card">
        <p class="visual-label">Line graph - trends</p>
        ${renderLineGraph(report)}
      </article>
      <article class="visual-card">
        <p class="visual-label">Radar chart - multi-metric</p>
        ${renderRadarChart(report, query)}
      </article>
    </div>
  `
}

function renderComparisonBars(report: ScoutingReport, query: QueryInput) {
  const metrics = buildComparisonMetrics(report, query)
  return `
    <div class="bar-chart">
      ${metrics.map((metric) => `
        <div class="bar-row">
          <span>${metric.label}</span>
          <div class="bar-track">
            <div class="bar-fill" style="width: ${metric.value}%"></div>
          </div>
          <strong>${metric.value}</strong>
        </div>
      `).join('')}
    </div>
  `
}

function renderHeatmap(report: ScoutingReport, query: QueryInput) {
  const rowLabels = query.game === 'VAL' ? ['A site', 'Mid', 'B site'] : ['Top', 'Mid', 'Bot']
  const colLabels = ['Entry', 'Trade', 'Control', 'Late']
  const values = buildHeatmapValues(`${report.heading}-${report.confidence}`, rowLabels.length, colLabels.length)
  const rows = rowLabels.length
  const cols = colLabels.length
  return `
    <div class="heatmap">
      <div class="heatmap-grid" style="--cols: ${cols}">
        <div class="heatmap-head"></div>
        ${colLabels.map((label) => `<div class="heatmap-head">${label}</div>`).join('')}
        ${rowLabels.map((rowLabel, rowIndex) => `
          <div class="heatmap-head">${rowLabel}</div>
          ${colLabels.map((_, colIndex) => {
            const value = values[rowIndex * cols + colIndex]
            return `<div class="heatmap-cell" style="--heat: ${value / 100}"></div>`
          }).join('')}
        `).join('')}
      </div>
      <div class="heatmap-legend">
        <span>Low</span>
        <span>High</span>
      </div>
    </div>
  `
}

function renderLineGraph(report: ScoutingReport) {
  const seriesCount = Math.min(report.series.length, 8)
  if (!seriesCount) {
    return `<p class="muted">No series loaded yet.</p>`
  }
  const values = Array.from({ length: seriesCount }, (_, index) => {
    const decay = (seriesCount - index) * 4
    const wave = (index % 2) * 3
    return clampValue(report.confidence - 10 + decay + wave, 25, 95)
  })
  const width = 240
  const height = 120
  const padding = 16
  const minValue = Math.min(...values)
  const maxValue = Math.max(...values)
  const range = Math.max(maxValue - minValue, 1)
  const step = values.length > 1 ? (width - padding * 2) / (values.length - 1) : 0
  const points = values.map((value, index) => {
    const x = padding + index * step
    const y = height - padding - ((value - minValue) / range) * (height - padding * 2)
    return `${x},${y}`
  }).join(' ')
  const areaPoints = `${points} ${width - padding},${height - padding} ${padding},${height - padding}`
  return `
    <svg class="line-graph" viewBox="0 0 ${width} ${height}" role="img" aria-label="Trend line chart">
      <polyline class="line-area" points="${areaPoints}" />
      <polyline class="line-stroke" points="${points}" />
      ${values.map((value, index) => {
        const x = padding + index * step
        const y = height - padding - ((value - minValue) / range) * (height - padding * 2)
        return `<circle cx="${x}" cy="${y}" r="3" />`
      }).join('')}
    </svg>
    <p class="muted">Latest ${seriesCount} series trend</p>
  `
}

function renderRadarChart(report: ScoutingReport, query: QueryInput) {
  const metrics = buildRadarMetrics(report, query)
  const width = 180
  const height = 180
  const centerX = width / 2
  const centerY = height / 2
  const radius = 60
  const axisPoints = metrics.map((metric, index) => {
    const angle = (Math.PI * 2 * index) / metrics.length - Math.PI / 2
    const x = centerX + Math.cos(angle) * radius
    const y = centerY + Math.sin(angle) * radius
    return { metric, angle, x, y }
  })
  const polygonPoints = axisPoints.map((point) => {
    const ratio = point.metric.value / 100
    const x = centerX + Math.cos(point.angle) * radius * ratio
    const y = centerY + Math.sin(point.angle) * radius * ratio
    return `${x},${y}`
  }).join(' ')
  return `
    <svg class="radar-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Radar chart">
      <circle cx="${centerX}" cy="${centerY}" r="${radius * 0.35}" />
      <circle cx="${centerX}" cy="${centerY}" r="${radius * 0.65}" />
      <circle cx="${centerX}" cy="${centerY}" r="${radius}" />
      ${axisPoints.map((point) => `<line x1="${centerX}" y1="${centerY}" x2="${point.x}" y2="${point.y}" />`).join('')}
      <polygon class="radar-area" points="${polygonPoints}" />
      <polygon class="radar-stroke" points="${polygonPoints}" />
      ${axisPoints.map((point) => {
        const labelX = centerX + Math.cos(point.angle) * (radius + 16)
        const labelY = centerY + Math.sin(point.angle) * (radius + 16)
        const anchor = Math.cos(point.angle) > 0.2 ? 'start' : Math.cos(point.angle) < -0.2 ? 'end' : 'middle'
        return `<text x="${labelX}" y="${labelY}" text-anchor="${anchor}">${point.metric.label}</text>`
      }).join('')}
    </svg>
  `
}

function renderQueryTable(history: QuerySnapshot[]) {
  if (!history.length) {
    return ''
  }
  return `
    <div class="query-table">
      <div class="table-header">
        <h4>Games, opponents & regions</h4>
        <p class="muted">Recent scouting inputs</p>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Game</th>
              <th>Opponent</th>
              <th>Region</th>
            </tr>
          </thead>
          <tbody>
            ${history.map((entry) => `
              <tr>
                <td>${entry.game}</td>
                <td>${entry.opponent}</td>
                <td>${entry.region}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `
}

function renderAvailabilityTable(rows: AvailabilityRow[]) {
  const opponentCount = new Set(rows.map((row) => row.opponent.toLowerCase())).size
  const regionCount = new Set(rows.map((row) => row.region.toLowerCase())).size
  return `
    <div class="query-table availability-table">
      <div class="table-header">
        <h4>Games, opponents & regions</h4>
        <p class="muted">${rows.length} series | ${opponentCount} opponents | ${regionCount} regions</p>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Game</th>
              <th>Opponent</th>
              <th>Region</th>
              <th>Series</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => `
              <tr>
                <td>${row.game}</td>
                <td>${row.opponent}</td>
                <td>${row.region}</td>
                <td>${row.seriesId}</td>
                <td>${row.date}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `
}

function renderTeams(teams: TeamSummary[]) {
  if (!teams.length) {
    return ''
  }
  return `
    <div class="series-teams">
      ${teams.map((team) => `
        <div class="team-pill">
          ${team.logoUrl ? `<img class="team-logo" src="${team.logoUrl}" alt="${team.name} logo" />` : ''}
          <div class="team-info">
            <span>${team.name}</span>
            <span class="team-id">ID ${team.id}</span>
          </div>
        </div>
      `).join('')}
    </div>
  `
}

function renderTournamentMeta(tournament: TournamentSummary | null) {
  if (!tournament?.id) {
    return ''
  }
  return `<p class="series-sub">Tournament ID: ${tournament.id}</p>`
}

async function handleSubmit(event: Event) {
  event.preventDefault()
  const query: QueryInput = {
    game: gameSelect.value as GameId,
    opponent: opponentInput.value.trim(),
    region: regionInput.value.trim(),
    seriesCount: Number(seriesInput.value) || 5
  }

  if (!query.opponent) {
    opponentInput.focus()
    return
  }

  form.classList.add('loading')
  reportBody.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <div>
        <p>Collecting recent series...</p>
        <span class="muted">Parsing GRID feeds and compiling report</span>
      </div>
    </div>
  `

  try {
    const report = await generateScoutingReport(query)
    queryHistory.unshift(buildQuerySnapshot(query))
    if (queryHistory.length > maxQueryHistory) {
      queryHistory.length = maxQueryHistory
    }
    renderReport(report, query)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load GRID data.'
    reportBody.innerHTML = `
      <div class="empty-state">
        <h3>Unable to load live data</h3>
        <p>${message}</p>
      </div>
    `
  } finally {
    form.classList.remove('loading')
  }
}

async function handleAvailability() {
  const query: QueryInput = {
    game: gameSelect.value as GameId,
    opponent: '',
    region: regionInput.value.trim(),
    seriesCount: Number(seriesInput.value) || 5
  }

  const originalLabel = availabilityButton.textContent
  availabilityButton.disabled = true
  availabilityButton.textContent = 'Loading data...'
  availabilityBody.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <div>
        <p>Pulling available series...</p>
        <span class="muted">Listing recent opponents and regions</span>
      </div>
    </div>
  `

  try {
    const series = await fetchSeriesList(query)
    const rows = buildAvailabilityRows(series, query.game)
    if (!rows.length) {
      availabilityBody.innerHTML = `
        <div class="empty-state">
          <h3>No series found</h3>
          <p>Try increasing the series count or adjusting the game selection.</p>
        </div>
      `
      return
    }
    availabilityBody.innerHTML = renderAvailabilityTable(rows)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load GRID data.'
    availabilityBody.innerHTML = `
      <div class="empty-state">
        <h3>Unable to load data</h3>
        <p>${message}</p>
      </div>
    `
  } finally {
    availabilityButton.disabled = false
    availabilityButton.textContent = originalLabel ?? 'View available data'
  }
}

function loadSample() {
  opponentInput.value = 'Nightfall Esports'
  regionInput.value = 'EMEA'
  gameSelect.value = 'VAL'
  seriesInput.value = '5'
}

form.addEventListener('submit', handleSubmit)
availabilityButton.addEventListener('click', handleAvailability)
sampleButton.addEventListener('click', loadSample)

