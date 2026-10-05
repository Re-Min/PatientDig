// English copy for the atlas and field guide. Site coordinates live in locale-zh.js.
export const messages = {
  depart:'Investigate →', unavailable:'Site not yet open', soundOn:'Sound: On', soundOff:'Sound: Off', soundFailed:'Sound unavailable',
  archived:'Archived · Shitouchong field record', locked:'Locked · Complete the Zigong dig', reference:'Reference sample · Not a catalog discovery',
  loading:'Placing clay models', loadingInitial:'Preparing clay models…', failed:'Unable to load map: ', contextLost:'Graphics connection lost. Please reload.',
  reset:'Reset view', navigation:'Game navigation', mapLabel:'Rotatable 3D fossil survey map of China', language:'Switch language · 中文',
  tableTitle:'CHINA · FOSSIL SURVEY', islands:'SOUTH CHINA SEA ISLANDS', tableNote:'Regional reference · Stylized terrain',
  hills:'Clay hills', compass:'Compass · Reset map', radio:'Radio · Read current report', rock:'Red-bed sample · Examine on study table', feather:'Fossil slab · Examine on study table',
};
export const sites = {
  sichuan: {
    title: 'The “dragon bones” of Shitouchong', location: 'Heping · Zigong · Sichuan',
    report: 'Report 001 · A villager’s discovery',
    body: 'While building a house, villagers found stones that looked like vertebrae. Examine the exposed bones, then decide where to begin clearing.',
    note: 'Based on a discovery in 1985 · Playable site', active: true,
  },
  liaoning: {
    title: 'Life preserved in stone', location: 'Jehol Biota · Beipiao · Liaoning',
    report: 'File 002 · Regional clues',
    body: 'Early Cretaceous rocks in western Liaoning preserve remarkable fossils, including feathered dinosaurs. Examine the illustrative fossil slab on the study table.',
    note: 'Regional research file · Site not yet open', active: false,
  },
  heyuan: {
    title: 'Dinosaur eggs in the red beds', location: 'Red-bed basins · Heyuan · Guangdong',
    report: 'File 003 · Regional clues',
    body: 'Heyuan’s Cretaceous red beds are known for dinosaur eggs. Record their arrangement and rock layer: a single egg cannot identify a dinosaur genus or species.',
    note: 'Regional research file · Site not yet open', active: false,
  },
};
export const descriptions = {
  heping: { title: 'Yangchuanosaurus', latin: 'Yangchuanosaurus hepingensis', text: 'A large meat-eating dinosaur from the Late Jurassic. In 1985, villagers building a house in Heping, Zigong, found tail vertebrae. Collection and preparation later yielded a fairly complete skeleton. This stylized Tripo reconstruction still requires scientific review of its anatomical details.' },
  feather: { title: 'Feathered fossil illustration', latin: 'JEHOL BIOTA · STUDY REFERENCE', text: 'The Jehol Biota provides important evidence about feathered dinosaurs. This generated model is an illustration, not a specific fossil specimen. Its bones and feather traces have not been scientifically checked and cannot be used for species identification.' },
  rock: { title: 'Red-bed rock sample', latin: 'RED BEDS · FIELD REFERENCE', text: 'Rock layers record sediment deposition. Their color, grains and relative positions help describe a fossil’s burial environment. This model’s bands are stylized; red color alone does not establish a rock layer’s age.' },
};
// Only fixed, authored markup is used here; no user-supplied HTML.
export const ui = {
  '.masthead p': 'FIELD JOURNAL <span aria-hidden="true">/</span> Notes from the field',
  '#reset-view .label': 'Reset view',
  '.atlas-note': 'China fossil survey · Illustrative map',
  '#chapter .kicker': '<span class="chapter-number">01</span> EXPEDITION / FOLLOW THE CLUES',
  '#chapter h2': 'Where to next?',
  '#chapter p': 'Pick a place on the map.<br>Discover the story beneath it.',
  '.letter-heading > span:first-child': 'Field report',
  '.letter-stamp': 'FIELD NOTES',
  '#catalog-info .kicker': 'FIELD COLLECTION / STUDY TABLE',
  '[data-specimen="heping"]': '01　Yangchuanosaurus',
  '[data-specimen="feather"]': '02　Feathered fossil',
  '[data-specimen="rock"]': '03　Red-bed sample',
  '#sample-help': 'Tip · Click the radio for clues, or a specimen to study it.',
  '.controls': '<span class="control-key">Drag</span> Orbit <span class="control-key">Scroll</span> Zoom',
  '#nav-map .nav-text': 'Map',
  '#nav-catalog .nav-text': 'Field guide',
  '#nav-field .nav-text': 'Go dig',
  '[data-pin="sichuan"]': '<i></i>Sichuan · Zigong',
  '[data-pin="liaoning"]': '<i></i>Liaoning · Beipiao',
  '[data-pin="heyuan"]': '<i></i>Guangdong · Heyuan',
  '#loading h2': 'Unfolding the survey map',
  '#retry': 'Reload',
};
