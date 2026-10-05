export const ui = {
  '.masthead p': 'FIELD JOURNAL <span aria-hidden="true">/</span> 野外调查手记',
  '#reset-view .label': '复位镜头',
  '.atlas-note': '中国化石调查 · 示意地图',
  '#chapter .kicker': '<span class="chapter-number">01</span> EXPEDITION / 寻找线索',
  '#chapter h2': '下一站，去哪里？',
  '#chapter p': '点选地图上的地点，<br>开启一段化石发现的故事。',
  '.letter-heading > span:first-child': '野外情报',
  '.letter-stamp': 'FIELD NOTES',
  '#catalog-info .kicker': 'FIELD COLLECTION / 研究桌',
  '[data-specimen="heping"]': '01　和平永川龙',
  '[data-specimen="feather"]': '02　羽毛化石示意',
  '[data-specimen="rock"]': '03　红层岩石样本',
  '#sample-help': '小提示 · 点击收音机听情报，点击标本看图鉴。',
  '.controls': '<span class="control-key">拖动</span> 环视 <span class="control-key">滚轮</span> 缩放',
  '#nav-map .nav-text': '调查地图', '#nav-catalog .nav-text': '野外图鉴', '#nav-field .nav-text': '前往发掘',
  '[data-pin="sichuan"]': '<i></i>四川 · 自贡', '[data-pin="liaoning"]': '<i></i>辽宁 · 北票', '[data-pin="heyuan"]': '<i></i>广东 · 河源',
  '#loading h2': '铺开调查地图', '#retry': '重新载入',
};
export const messages = {
  depart:'出发调查 →', unavailable:'调查地点筹备中', soundOn:'声音：开', soundOff:'声音：关', soundFailed:'声音：不可用',
  archived:'已归档 · 石头冲调查记录', locked:'尚未归档 · 完成自贡发掘后解锁', reference:'参考样本 · 不计入发现图鉴',
  loading:'布置粘土模型', loadingInitial:'正在布置粘土模型…', failed:'未能载入地图：', contextLost:'图形上下文中断，请重新载入',
  reset:'复位镜头', navigation:'游戏导航', mapLabel:'可旋转的三维中国化石情报地图', language:'切换语言 · English',
  tableTitle:'中 国 · 化 石 调 查', islands:'南 海 诸 岛', tableNote:'区域位置参考 · 地形为艺术化表达',
  hills:'粘土丘陵', compass:'罗盘 · 复位地图', radio:'收音机 · 查看当前情报', rock:'红层样本 · 拿到研究桌上', feather:'化石板 · 拿到研究桌上',
};
export const sites = {
  sichuan: { lon: 104.78, lat: 29.43, title: '石头冲的“龙骨”', location: '四川 · 自贡 · 和平街道', report: '来信 001 · 村民报告', body: '村民修建房屋时，发现几块像脊椎的石头。先去看看露头，再决定从哪里开始清理。', note: '改编自 1985 年真实发现 · 当前可玩地点', active: true },
  liaoning: { lon: 120.77, lat: 41.80, title: '石板上的生命印痕', location: '辽宁 · 北票 · 热河生物群', report: '调查档案 002 · 区域线索', body: '辽西的早白垩世地层，保存了带羽毛恐龙等珍贵化石。桌上的石板是风格化示意，可在研究桌上仔细观察。', note: '区域研究档案 · 场景筹备中，尚未开放', active: false },
  heyuan: { lon: 114.70, lat: 23.74, title: '红层里的恐龙蛋', location: '广东 · 河源 · 红层盆地', report: '调查档案 003 · 区域线索', body: '河源的白垩纪红层以恐龙蛋化石闻名。发现蛋化石后，需要保留排列与层位信息，不能仅凭一枚蛋确定恐龙属种。', note: '区域研究档案 · 场景筹备中，尚未开放', active: false },
};
export const descriptions = {
  heping: { title: '和平永川龙', latin: 'Yangchuanosaurus hepingensis', text: '晚侏罗世的大型肉食恐龙。1985 年，自贡和平乡村民修房时发现尾椎，后经采集与修理获得较完整骨架。此处为 Tripo 风格化复原，外形细节仍需科学校核。' },
  feather: { title: '羽毛化石示意板', latin: 'JEHOL BIOTA · STUDY REFERENCE', text: '热河生物群为研究带羽毛恐龙提供了重要证据。这件模型是生成的展示示意，骨骼形态和羽毛痕迹尚未校核，不对应某一件真实标本，也不作为物种鉴定依据。' },
  rock: { title: '红层岩石样本', latin: 'RED BEDS · FIELD REFERENCE', text: '层理记录了沉积过程。观察颜色、颗粒和上下层位，可以帮助描述化石的埋藏环境。模型的层带经过艺术化处理，不能单凭红色就判断地层时代。' },
};
