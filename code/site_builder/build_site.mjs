#!/usr/bin/env node
/**
 * 產生 soloDev 文件站。GitHub Pages 讀 repo 根目錄的 docs/。
 *
 *   node code/site_builder/build_site.mjs
 *
 * 做的事：
 *   1. 找 report/ 裡版本號最大的手冊 md、skill/ 裡版本號最大的 .skill
 *   2. 手冊 md 轉成 HTML，產生章節目錄，套進 templates/handbook.html
 *   3. 把版本與下載連結填進 templates/index.html
 *   4. 寫出 docs/index.html、docs/handbook.html、docs/assets/site.css、site.js、docs/.nojekyll
 *
 * 不需要安裝任何套件：markdown 轉換用 vendor/marked.esm.js（MIT 授權，隨 repo 附帶）。
 * 手冊改版、skill 重新打包之後，重跑這支再 commit、push，網站就更新。
 * docs/ 整個資料夾都是產生出來的，不要手改；要改版面改 templates/。
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Marked } from './vendor/marked.esm.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const TPL = join(HERE, 'templates');
const OUT = join(ROOT, 'docs');

const REPO_URL = 'https://github.com/art0428/soloDev';
const DS_URL = 'https://art0428.github.io/webdesign/dist';
const HANDBOOK = /^管理者工作室AI單人開發手冊_v(\d+)\.md$/;
const SKILL = /^studio-init_v(\d+)\.skill$/;

const COPY_ICON = '<svg class="ic" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="14" height="14" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';

function fail(msg) {
  console.error(`✖ ${msg}`);
  process.exit(1);
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const read = (name) => readFileSync(join(TPL, name), 'utf8');

/** 資料夾裡符合 pattern、版本號最大的檔名。 */
function latest(dir, pattern) {
  const hits = readdirSync(join(ROOT, dir))
    .map((name) => ({ name, m: name.match(pattern) }))
    .filter((x) => x.m)
    .sort((a, b) => Number(b.m[1]) - Number(a.m[1]));
  if (!hits.length) fail(`${dir}/ 裡找不到符合 ${pattern} 的檔案`);
  return { name: hits[0].name, version: `v${hits[0].m[1]}` };
}

/** 拆開 md 開頭的 YAML front matter（只支援「鍵: 值」單行）。 */
function splitFrontMatter(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return { meta: {}, body: md };
  const meta = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { meta, body: md.slice(m[0].length) };
}

/** 沒標語言的程式碼區塊，依內容給標題列一個說明。 */
function codeLabel(text, lang) {
  if (lang) return { label: lang, soft: false };
  if (/[├└│]/.test(text)) return { label: '資料夾結構', soft: false };
  if (!text.includes('\n') && text.includes('→')) return { label: '流程', soft: true };
  return { label: '給 AI 的 Prompt', soft: true };
}

/** 手冊 md → HTML ＋ 章節目錄。章 id 是 ch-<章號>，節 id 是 ch-<章號>-<第幾節>。 */
function renderHandbook(md) {
  const toc = [];
  let chapterId = '';
  let chapterCount = 0;
  let sectionCount = 0;

  const marked = new Marked({ gfm: true });
  marked.use({
    renderer: {
      heading(token) {
        const inner = this.parser.parseInline(token.tokens);
        if (token.depth === 1) return ''; // 文件標題放在頁首，不重複
        if (token.depth === 2) {
          chapterCount += 1;
          sectionCount = 0;
          const num = token.text.match(/^(\d+)\./);
          chapterId = `ch-${num ? num[1] : `x${chapterCount}`}`;
          toc.push({ id: chapterId, label: token.text.split('：')[0] });
          return `<h2 id="${chapterId}">${inner}</h2>\n`;
        }
        if (token.depth === 3) {
          sectionCount += 1;
          return `<h3 id="${chapterId}-${sectionCount}">${inner}</h3>\n`;
        }
        return `<h${token.depth}>${inner}</h${token.depth}>\n`;
      },
      code(token) {
        const { label, soft } = codeLabel(token.text, (token.lang || '').trim());
        return `<div class="codeblk"><div class="cbar">${esc(label)}<button class="btn sm" type="button" data-copy>${COPY_ICON}<span>複製</span></button></div><pre${soft ? ' class="sd-soft"' : ''}>${esc(token.text)}</pre></div>\n`;
      },
    },
  });

  let html = marked.parse(md);
  // 表格包一層可橫捲的容器，並記下欄數（手機上三欄表格要有最小寬度）
  html = html.replace(/<table>([\s\S]*?)<\/table>/g, (all, inner) => {
    const head = inner.match(/<tr>([\s\S]*?)<\/tr>/);
    const cols = head ? (head[1].match(/<th/g) || []).length : 0;
    return `<div class="tw"><table data-cols="${cols}">${inner}</table></div>`;
  });
  return { html, toc };
}

function fill(template, vars) {
  let out = template;
  // 先展開共用片段，再填值；片段裡的佔位符才會一起被換掉
  for (let pass = 0; pass < 2; pass += 1) {
    out = out.replace(/\{\{([A-Z_]+)\}\}/g, (all, key) => (key in vars ? vars[key] : all));
  }
  const left = out.match(/\{\{[A-Z_]+\}\}/);
  if (left) fail(`樣板還有沒填的佔位符 ${left[0]}`);
  return out;
}

// ── 1. 找來源 ──
const hb = latest('report', HANDBOOK);
const skill = latest('skill', SKILL);
const { meta, body } = splitFrontMatter(readFileSync(join(ROOT, 'report', hb.name), 'utf8'));
for (const key of ['title', 'subtitle', 'date', 'version']) {
  if (!meta[key]) fail(`${hb.name} 的 front matter 少了 ${key}`);
}

// ── 2. 手冊 ──
const { html: hbHtml, toc } = renderHandbook(body);
if (!toc.length) fail('手冊裡沒有任何「## 」章標題，產生不出章節目錄');
for (const item of toc) {
  const count = hbHtml.split(`id="${item.id}"`).length - 1;
  if (count !== 1) fail(`章 id ${item.id} 出現 ${count} 次，應該剛好一次（章號重複或漏寫）`);
}
const tocHtml = [
  '  <div class="sd-toc">',
  '    <p class="sd-grp">章節</p>',
  '    <nav aria-label="章節目錄" data-toc>',
  ...toc.map((t) => `      <a class="nitem" href="#${t.id}">${esc(t.label)}</a>`),
  '    </nav>',
  '  </div>',
].join('\n');

// ── 3. 共用的值 ──
const skillUrl = `${REPO_URL}/raw/main/skill/${encodeURIComponent(skill.name)}`;
const common = {
  REPO_URL,
  DS_URL,
  SKILL_URL: skillUrl,
  SKILL_FILE: esc(skill.name),
  SKILL_VERSION: skill.version,
  HB_VERSION: esc(meta.version),
  HB_DATE: esc(meta.date),
  HB_TITLE: esc(meta.title),
  HB_SUBTITLE: esc(meta.subtitle),
  HB_SOURCE_NAME: esc(`report/${hb.name}`),
  HB_SOURCE_URL: `${REPO_URL}/blob/main/report/${encodeURIComponent(hb.name)}`,
  HEAD: read('_head.html'),
  HEADER: read('_header.html'),
  MENU: read('_menu.html'),
  FOOTER: read('_footer.html'),
};

const pages = {
  'index.html': fill(read('index.html'), {
    ...common,
    TITLE: 'soloDev：管理者工作室 AI 單人開發手冊與專案範本',
    DESC: '一份原型、一個人、一組 Claude Code 對話，把系統做出來。手冊、專案範本與初始化 skill。',
    CUR_HOME: ' aria-current="page"',
    CUR_BOOK: '',
    DL_CLASS: '',
    MENU_CLASS: ' sd-menu-only',
    TOC: '',
  }),
  'handbook.html': fill(read('handbook.html'), {
    ...common,
    TITLE: `${esc(meta.title)} ${esc(meta.version)}｜soloDev`,
    DESC: esc(meta.subtitle),
    CUR_HOME: '',
    CUR_BOOK: ' aria-current="page"',
    DL_CLASS: ' primary',
    MENU_CLASS: '',
    TOC: tocHtml,
    HB_HTML: hbHtml,
  }),
};

// ── 4. 寫檔 ──
mkdirSync(join(OUT, 'assets'), { recursive: true });
for (const [name, html] of Object.entries(pages)) writeFileSync(join(OUT, name), html);
copyFileSync(join(TPL, 'site.css'), join(OUT, 'assets', 'site.css'));
copyFileSync(join(TPL, 'site.js'), join(OUT, 'assets', 'site.js'));
writeFileSync(join(OUT, '.nojekyll'), ''); // 告訴 GitHub Pages 不要用 Jekyll 處理，原樣送出

console.log(`✓ 手冊   report/${hb.name}（${meta.version}，${toc.length} 章）`);
console.log(`✓ skill  skill/${skill.name}`);
console.log(`✓ 寫出   docs/index.html、docs/handbook.html、docs/assets/site.css、site.js、.nojekyll`);
