import { useEffect, useMemo, useState } from 'react'
import { BookOpen, Search, RefreshCw, SlidersHorizontal, X, ArrowUpRight, LibraryBig } from 'lucide-react'

type Book = {
  series: string; volume: string; thickness: string; height: string; width: string;
  weight: string; chapters: string; pages: string; price: string; shop: string; id: string
}

const sheetIdParts = [
  '1O1K_1Zk2DC3RGEWUEQPVYY',
  'QV24WhjK2PDYYkDrDOR3A'
];

const sheetId = sheetIdParts.join('');
const sheetHost = 'https://docs.google.com/';
const sheetPath = 'spreadsheets/d/';
const sheetExport = '/export?format=csv&gid=0';

const CSV_URL = sheetHost + sheetPath + sheetId + sheetExport;

const sampleBooks: Book[] = [
  { series: 'Attack On Titan', volume: '33', thickness: '14.4', height: '191', width: '127', weight: '181.4', chapters: '131 - 134', pages: '192', price: '51.75', shop: 'צומת ספרים', id: 'sample-1' },
  { series: 'Attack On Titan', volume: '34', thickness: '19.3', height: '191', width: '127', weight: '232.46', chapters: '135 - 139', pages: '256', price: '69', shop: 'צומת ספרים', id: 'sample-2' },
  { series: 'Attack On Titan', volume: '31 - 34', thickness: '37', height: '266', width: '180', weight: '1780', chapters: '123 - 139', pages: '832', price: '143.55', shop: 'Awesome Books', id: 'sample-3' },
  { series: 'Berserk deluxe edition', volume: '1', thickness: '50.8', height: '263', width: '186', weight: '1835', chapters: '1 - 9', pages: '698', price: '250', shop: 'CNV', id: 'sample-4' },
  { series: 'One Piece', volume: '1', thickness: '11.1', height: '19.1', width: '12.7', weight: '190', chapters: '1 - 8', pages: '208', price: '45', shop: 'Local bookstore', id: 'sample-5' },
  { series: 'Blue Period', volume: '1', thickness: '13', height: '19', width: '1.5', weight: '220', chapters: '1 - 4', pages: '224', price: '59', shop: 'Bookshop', id: 'sample-6' },
]

function parseCSV(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"' && quoted && text[i + 1] === '"') { cell += '"'; i++ }
    else if (ch === '"') quoted = !quoted
    else if (ch === ',' && !quoted) { row.push(cell); cell = '' }
    else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell); if (row.some(v => v.trim())) rows.push(row); row = []; cell = ''
    } else cell += ch
  }
  if (cell.length || row.length) { row.push(cell); if (row.some(v => v.trim())) rows.push(row) }
  return rows
}
function normaliseHeader(s: string) { return s.toLowerCase().trim().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ') }
function booksFromCSV(csv: string): Book[] {
  const rows = parseCSV(csv)
  if (rows.length < 2) throw new Error('The spreadsheet appears to be empty.')
  const headers = rows[0].map(normaliseHeader)
  const index = (...names: string[]) => headers.findIndex(h => names.includes(h))
  const columns = {
    series: index('series', 'title'),
    volume: index('volume', 'volume number'),
    thickness: index('thickness', 'thickness mm'),
    height: index('height', 'height mm'),
    width: index('width', 'width mm'),
    weight: index('weight', 'weight g'),
    chapters: index('chapters', 'chapter', 'chapter range'),
    pages: index('page number', 'pages', 'page count', 'number of pages'),
    price: index('price'),
    shop: index('location of purchase', 'location', 'purchase location', 'shop', 'store'),
  }
  if (columns.series < 0 || columns.volume < 0) throw new Error('Could not find the required “series” and “volume” columns in the sheet.')
  if (columns.thickness < 0) throw new Error('Could not find the required “thickness” column in the sheet.')
  const value = (r: string[], i: number) => i < 0 ? '' : (r[i] ?? '').trim()
  return rows.slice(1).map((r, i) => ({
    series: value(r, columns.series),
    volume: value(r, columns.volume),
    thickness: value(r, columns.thickness),
    height: value(r, columns.height),
    width: value(r, columns.width),
    weight: value(r, columns.weight),
    chapters: value(r, columns.chapters),
    pages: value(r, columns.pages),
    price: value(r, columns.price),
    shop: value(r, columns.shop),
    id: `sheet-${i}-${value(r, columns.series)}-${value(r, columns.volume)}`
  })).filter(b => b.series || b.volume)
}
const palette = ['#315b4d', '#8e3f35', '#d0a34d', '#394d73', '#7a6040', '#784b68', '#476b79', '#8b6a37']
function spineLabel(series: string) {
  const known: Record<string, string> = { 'attack on titan': 'AOT', 'attack on titan: before the fall': 'AOT: BTF', 'one piece': 'ONE PIECE', 'berserk deluxe edition': 'BERSERK DELUXE' }
  const key = series.trim().toLowerCase()
  if (known[key]) return known[key]
  if (series.length <= 17) return series
  const words = series.split(/\s+/).filter(Boolean)
  const initials = words.map(w => w[0]).join('').toUpperCase()
  return initials.length >= 2 ? initials : series.slice(0, 14) + '…'
}
function volumeSortKey(value: string) {
  // Only numeric volumes/sets sort by their starting volume. Named editions and novels
  // follow the regular numbered volumes, preserving their order in the spreadsheet.
  const match = value.trim().match(/^(\d+(?:\.\d+)?)(?:\s*[-–]\s*\d+(?:\.\d+)?)?$/)
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY
}
function bookThicknessMm(book: Book) { return numeric(book.thickness) ?? 0 }
function money(n: number) { return `₪${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}` }
function aggregate(items: Book[]) {
  return { price: items.reduce((sum, b) => sum + (numeric(b.price) ?? 0), 0), weight: items.reduce((sum, b) => sum + (numeric(b.weight) ?? 0), 0), pages: items.reduce((sum, b) => sum + (numeric(b.pages) ?? 0), 0), thickness: items.reduce((sum, b) => sum + bookThicknessMm(b), 0) }
}
function bookColor(book: Book, i: number) { let h = 0; for (const c of `${book.series}${book.volume}`) h = (h * 31 + c.charCodeAt(0)) | 0; return palette[Math.abs(h + i) % palette.length] }
function numeric(value: string) { const n = Number(value.replace(/[^\d.-]/g, '')); return Number.isFinite(n) ? n : null }

export default function App() {
  const [books, setBooks] = useState<Book[]>(sampleBooks)
  const [search, setSearch] = useState('')
  const [shopFilter, setShopFilter] = useState('all')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [minChapters, setMinChapters] = useState('')
  const [maxChapters, setMaxChapters] = useState('')
  const [selected, setSelected] = useState<Book | null>(null)
  const [view, setView] = useState<'shelves' | 'catalogue'>('shelves')
  const [catalogueSort, setCatalogueSort] = useState<'series-asc' | 'series-desc' | 'price-desc' | 'price-asc' | 'pages-desc' | 'pages-asc' | 'thickness-desc' | 'thickness-asc'>('series-asc')
  const [loading, setLoading] = useState(false)
  const [source, setSource] = useState<'sample' | 'sheet'>('sample')
  const [notice, setNotice] = useState('Showing sample data. Connect your public sheet to load your full collection.')
  const [showFilters, setShowFilters] = useState(false)
  const [expandedSeries, setExpandedSeries] = useState<string[]>([])

  async function refresh() {
    setLoading(true); setNotice('Checking your Google Sheet…')
    try {
      const response = await fetch(`${CSV_URL}&cachebust=${Date.now()}`, { cache: 'no-store' })
      if (!response.ok) throw new Error(`Google Sheets returned ${response.status}.`)
      const csv = await response.text()
      if (!csv || csv.trimStart().startsWith('<!DOCTYPE') || csv.trimStart().startsWith('<html')) throw new Error('Google returned a web page instead of CSV. Publish the sheet to the web as CSV, then try again.')
      const parsed = booksFromCSV(csv)
      if (!parsed.length) throw new Error('No book rows were found in the sheet.')
      setBooks(parsed); setSource('sheet'); setNotice(`Live from Google Sheets · ${parsed.length} entries · just refreshed`)
    } catch (e) {
      setNotice(`${e instanceof Error ? e.message : 'Could not load the sheet.'} Showing the included example data instead.`)
      setBooks(sampleBooks); setSource('sample')
    } finally { setLoading(false) }
  }
  useEffect(() => { void refresh() }, [])
  useEffect(() => {
    if (!selected) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setSelected(null)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selected])

  const shops = useMemo(() => [...new Set(books.map(b => b.shop).filter((shop): shop is string => Boolean(shop)))].sort((a,b) => a.localeCompare(b)), [books])
  const filtered = useMemo(() => books.filter(b => {
    const q = search.toLowerCase().trim()
    if (q && !`${b.series} ${b.volume} ${b.chapters} ${b.shop}`.toLowerCase().includes(q)) return false
    if (shopFilter !== 'all' && b.shop !== shopFilter) return false
    const price = numeric(b.price)
    if (minPrice !== '' && (price === null || price < Number(minPrice))) return false
    if (maxPrice !== '' && (price === null || price > Number(maxPrice))) return false
    const chapterNumbers = (b.chapters.match(/\d+/g) ?? []).map(Number)
    const chapterCount = chapterNumbers.length > 1 ? chapterNumbers[chapterNumbers.length - 1] - chapterNumbers[0] + 1 : chapterNumbers[0]
    if (minChapters !== '' && (chapterCount === undefined || chapterCount < Number(minChapters))) return false
    if (maxChapters !== '' && (chapterCount === undefined || chapterCount > Number(maxChapters))) return false
    return true
  }), [books, search, shopFilter, minPrice, maxPrice, minChapters, maxChapters])
  const groupedBooks = useMemo(() => {
    const groups = new Map<string, Book[]>()
    for (const book of filtered) groups.set(book.series.trim(), [...(groups.get(book.series.trim()) ?? []), book])
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([series, items]) => ({
      series,
      items: items.map((book, index) => ({ book, index })).sort((a, b) => volumeSortKey(a.book.volume) - volumeSortKey(b.book.volume) || a.index - b.index).map(x => x.book),
    }))
  }, [filtered])
  const catalogueGroups = useMemo(() => [...groupedBooks].sort((a, b) => {
    const aTotals = aggregate(a.items)
    const bTotals = aggregate(b.items)
    switch (catalogueSort) {
      case 'series-asc': return a.series.localeCompare(b.series)
      case 'series-desc': return b.series.localeCompare(a.series)
      case 'price-desc': return bTotals.price - aTotals.price
      case 'price-asc': return aTotals.price - bTotals.price
      case 'pages-desc': return bTotals.pages - aTotals.pages
      case 'pages-asc': return aTotals.pages - bTotals.pages
      case 'thickness-desc': return bTotals.thickness - aTotals.thickness
      case 'thickness-asc': return aTotals.thickness - bTotals.thickness
    }
  }), [groupedBooks, catalogueSort])
  const collectionTotals = useMemo(() => aggregate(books), [books])
  const totalSeriesCount = useMemo(() => new Set(books.map(b => b.series.trim()).filter(Boolean)).size, [books])
  const shelfBooks = useMemo(() => groupedBooks.flatMap(group => group.items), [groupedBooks])

  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="#top" onClick={() => { setSearch(''); setView('shelves') }}><span className="brand-mark"><LibraryBig size={22}/></span><span><b>THE READING ROOM</b><small>PERSONAL LIBRARY CATALOGUE</small></span></a><nav><button className={view === 'shelves' ? 'nav-active' : ''} onClick={() => setView('shelves')}>My shelves</button><button className={view === 'catalogue' ? 'nav-active' : ''} onClick={() => setView('catalogue')}>Catalogue</button></nav><button className="refresh-button" onClick={refresh} disabled={loading}><RefreshCw size={15} className={loading ? 'spin' : ''}/><span>{loading ? 'Refreshing' : 'Refresh data'}</span></button></header>
    <main id="top">
      <section className="hero"><div className="hero-copy"><div className="eyebrow"><span className="eyebrow-line"/> A HOME FOR EVERY STORY</div><h1>A little world<br/><em>between the covers.</em></h1><p>A personal collection, carefully shelved. Browse the books, discover a series, or look up the details of a favourite volume.</p><div className="hero-actions"><button className="primary-button" onClick={() => { setView('catalogue'); document.getElementById('collection')?.scrollIntoView({behavior:'smooth'}) }}>Explore the collection <ArrowUpRight size={16}/></button><span className="book-count"><BookOpen size={16}/><b>{books.length}</b> entries in the library</span></div></div><div className="hero-art" aria-hidden="true"><div className="lamp-glow"/><div className="art-book art-book-one"><i/><span>THE ART OF STORY</span></div><div className="art-book art-book-two"><i/><span>WANDERER</span></div><div className="art-book art-book-three"><i/><span>ATLAS OF WORLDS</span></div><div className="art-book art-book-four"><i/><span>静かな夜</span></div><div className="art-book art-book-five"><i/><span>COLLECTED TALES</span></div><div className="art-shelf"/><div className="art-plant">✳</div></div><div className="hero-index">EST. WITH LOVE <span>✳</span> ONE BOOK AT A TIME</div></section>
      <section className="collection-section" id="collection"><div className="section-heading"><div><div className="eyebrow">YOUR PRIVATE ARCHIVE</div><h2>{view === 'shelves' ? 'Browse the shelves' : 'The catalogue'}</h2><p className="section-subtitle">{view === 'shelves' ? 'Spines, stories, and the things worth keeping.' : 'Every entry, with the details at your fingertips.'}</p></div><div className="view-switch"><button className={view === 'shelves' ? 'selected' : ''} onClick={() => setView('shelves')}>Shelf view</button><button className={view === 'catalogue' ? 'selected' : ''} onClick={() => setView('catalogue')}>List view</button></div></div>
        <div className="collection-stats" aria-label="Collection totals">
          <div><span>Collection value</span><b>{money(collectionTotals.price)}</b></div>
          <div><span>Total weight</span><b>{collectionTotals.weight.toLocaleString(undefined, { maximumFractionDigits: 2 })} g</b></div>
          <div><span>Total pages</span><b>{collectionTotals.pages.toLocaleString()}</b></div>
          <div><span>Total stacked thickness</span><b>{(collectionTotals.thickness / 1000).toFixed(4)} m</b></div>
          <div><span>Series</span><b>{totalSeriesCount}</b></div>
        </div>
        <div className="search-row"><label className="search-box"><Search size={18}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search series, volume, chapters, store…"/><kbd>⌕</kbd></label><button className={`filter-toggle ${showFilters ? 'active' : ''}`} onClick={() => setShowFilters(v => !v)}><SlidersHorizontal size={16}/> Filters</button></div>
        {showFilters && <div className="filter-panel"><label>Purchase location<select value={shopFilter} onChange={e => setShopFilter(e.target.value)}><option value="all">All locations</option>{shops.map(s => <option key={s} value={s}>{s}</option>)}</select></label><label>Min. price<input type="number" min="0" value={minPrice} onChange={e => setMinPrice(e.target.value)} placeholder="Any"/></label><label>Max. price<input type="number" min="0" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} placeholder="Any"/></label><label>Min. chapter<input type="number" min="0" value={minChapters} onChange={e => setMinChapters(e.target.value)} placeholder="Any"/></label><label>Max. chapter<input type="number" min="0" value={maxChapters} onChange={e => setMaxChapters(e.target.value)} placeholder="Any"/></label><button className="clear-filters" onClick={() => {setShopFilter('all');setMinPrice('');setMaxPrice('');setMinChapters('');setMaxChapters('')}}>Clear filters</button></div>}
        <div className="status-line"><span><span className={`status-dot ${source === 'sheet' ? 'live' : ''}`}/>{notice}</span><span className="result-count">{filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}</span></div>
        {filtered.length === 0 ? <div className="empty-state"><BookOpen size={32}/><h3>No books found</h3><p>Try a different search or clear some filters.</p><button onClick={() => {setSearch('');setShopFilter('all');setMinPrice('');setMaxPrice('');setMinChapters('');setMaxChapters('')}}>Reset search</button></div> : view === 'shelves' ? <div className="shelf-groups" aria-label="Books arranged across shared shelves">{shelfBooks.map((book, i) => { const previous = shelfBooks[i - 1]; const heightMm = numeric(book.height) ?? 191; const pages = numeric(book.pages) ?? 200; const spineHeight = Math.min(198, Math.max(112, heightMm * 0.68)); const spineWidth = Math.min(76, Math.max(36, 24 + pages * 0.045)); return <button key={book.id} className={`spine-button ${!previous || previous.series !== book.series ? 'new-series' : ''}`} style={{'--book-width': `${spineWidth}px`} as React.CSSProperties} title={`${book.series} — ${book.volume}`} aria-label={`${book.series}, volume ${book.volume}`} onClick={() => setSelected(book)}><div className="spine" style={{'--spine-color':bookColor(book,i), '--spine-height':`${spineHeight}px`} as React.CSSProperties}><span className="spine-top">✳</span><span className="spine-title" title={book.series}>{spineLabel(book.series)}</span><span className="spine-volume">{book.volume}</span></div></button> })}</div> : <>
          <div className="catalogue-sort">
            <label>Sort series
              <select value={catalogueSort} onChange={e => setCatalogueSort(e.target.value as typeof catalogueSort)}>
                <option value="series-asc">Series: A–Z</option>
                <option value="series-desc">Series: Z–A</option>
                <option value="price-desc">Total price: highest first</option>
                <option value="price-asc">Total price: lowest first</option>
                <option value="pages-desc">Total pages: most first</option>
                <option value="pages-asc">Total pages: fewest first</option>
                <option value="thickness-desc">Stacked thickness: thickest first</option>
                <option value="thickness-asc">Stacked thickness: thinnest first</option>
              </select>
            </label>
          </div>
          <div className="catalogue-groups">{catalogueGroups.map((group, gi) => { const totals = aggregate(group.items); const isOpen = expandedSeries.includes(group.series); return <section className="catalogue-series" key={group.series}><button className="catalogue-series-heading" onClick={() => setExpandedSeries(old => isOpen ? old.filter(x => x !== group.series) : [...old, group.series])} aria-expanded={isOpen}><span className="series-heading-main"><span className="table-book-dot" style={{background:bookColor(group.items[0],gi)}}/><span><b>{group.series}</b><small>{group.items.length} {group.items.length === 1 ? 'volume / set' : 'volumes / sets'}</small></span></span><span className="series-heading-totals"><b>{money(totals.price)}</b><small>{totals.weight.toLocaleString(undefined, { maximumFractionDigits: 1 })} g · {totals.pages.toLocaleString()} pages</small></span><span className={`group-chevron ${isOpen ? 'open' : ''}`}>⌄</span></button>{isOpen && <div className="catalogue-table-wrap"><table className="catalogue-table"><thead><tr><th>Volume / edition</th><th>Chapters</th><th>Pages</th><th>Price</th><th>Purchased at</th><th/></tr></thead><tbody>{group.items.map((b,i)=><tr key={b.id} onClick={() => setSelected(b)}><td><b>{b.volume}</b></td><td>{b.chapters || '—'}</td><td>{b.pages || '—'}</td><td>{b.price ? money(numeric(b.price) ?? 0) : '—'}</td><td>{b.shop || '—'}</td><td><ArrowUpRight size={16}/></td></tr>)}</tbody></table><div className="series-footnote">Combined thickness: {(totals.thickness / 1000).toFixed(4)} m</div></div>}</section> })}</div>
        </>}
      </section>
      <footer><div className="footer-brand"><LibraryBig size={19}/> THE READING ROOM</div><p>A small archive for a growing collection.</p><span>MADE FOR THE LOVE OF BOOKS <span className="footer-star">✳</span></span></footer>
    </main>
    {selected && <div className="modal-backdrop" role="presentation" onMouseDown={e => {if(e.target === e.currentTarget) setSelected(null)}}><section className="detail-modal" role="dialog" aria-modal="true" aria-label={`${selected.series} details`}><button className="close-modal" onClick={() => setSelected(null)} aria-label="Close details"><X size={20}/></button><div className="detail-top"><div className="detail-spine" style={{background:bookColor(selected, 1)}}><span>✳</span><b>{selected.series}</b><small>{selected.volume}</small></div><div className="detail-title"><div className="eyebrow">COLLECTION DETAILS</div><h2>{selected.series}</h2><p>{selected.volume.includes('-') ? `Collection / volumes ${selected.volume}` : `Volume ${selected.volume}`}</p><div className="detail-price">{selected.price ? `₪${selected.price}` : 'Price not listed'}</div></div></div><div className="detail-grid"><Detail label="Chapters" value={selected.chapters}/><Detail label="Page count" value={selected.pages}/><Detail label="Width" value={selected.width} unit="mm"/><Detail label="Height" value={selected.height} unit="mm"/><Detail label="Thickness" value={selected.thickness} unit="mm"/><Detail label="Weight" value={selected.weight} unit="g"/><Detail label="Purchased at" value={selected.shop}/><Detail label="Record type" value={selected.volume.includes('-') ? 'Multi-volume set' : 'Single volume'}/></div><div className="detail-note"><BookOpen size={16}/><span>Measurements are shown as recorded in the collection spreadsheet. Book height and width describe the cover; thickness measures the spine. Shelf illustrations are scaled for appearance.</span></div></section></div>}
  </div>
}
function Detail({label,value,unit}: {label:string;value:string;unit?:string}) { return <div className="detail-cell"><span>{label}</span><b>{value ? `${value}${unit ? ` ${unit}` : ''}` : '—'}</b></div> }
