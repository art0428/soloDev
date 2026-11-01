#!/usr/bin/env python3
"""
把 studio_template 打包成 studio-init skill（.skill 是 zip）。
  python3 build_skill.py            打包到 ../../skill/studio-init_<版本>.skill
  python3 build_skill.py --list     只列出會打包哪些檔，不寫檔

套件結構：
  studio-init/SKILL.md                  ← 本資料夾的 SKILL.md
  studio-init/assets/template/...       ← ../studio_template 的快照

只用 Python 標準函式庫。驗證規則照 skill-creator 的 quick_validate.py（frontmatter 欄位、名稱、說明長度、
整包只能有一個 SKILL.md），因為那支要 PyYAML，這台機器不一定有。另外多擋三件事：
  1. 不該進套件的東西：.env（.example 以外）、node_modules、建置與測試產物、作業系統雜檔
  2. 範本裡的 env 範例檔，密鑰欄位必須是空的或 <佔位>
  3. SKILL.md 第 5 步列的關鍵檔案，快照裡每個都要有
"""
import fnmatch
import re
import stat
import sys
import zipfile
from pathlib import Path

VERSION = 'v1'  # 跟手冊、SKILL.md 的「studio-template v1」一起改
SKILL_NAME = 'studio-init'

HERE = Path(__file__).resolve().parent
SRC = (HERE / '..' / 'studio_template').resolve()
SKILL_MD = HERE / 'SKILL.md'
OUT = (HERE / '..' / '..' / 'skill' / f'{SKILL_NAME}_{VERSION}.skill').resolve()

# 任何一層出現就整個資料夾不要
EXCLUDE_DIR_NAMES = {'node_modules', '.git', 'coverage', 'dist', '__pycache__', '.storage-test',
                     'test-results', 'playwright-report', 'secrets'}
# 相對於範本根目錄的資料夾
EXCLUDE_DIR_PATHS = {'.claude/tmp', 'gcp/db/backup'}
EXCLUDE_FILE_GLOBS = {'.DS_Store', '*.tsbuildinfo', '*.pyc', '.iso-base', '*.log'}
# 範本不該帶原型：那是學生自己的
EXCLUDE_FILE_PATHS = {'docs/prototype/index_v1.html'}
EXECUTABLE_GLOBS = {'*.sh', '*.mjs', 'scripts/git-hooks/*'}
SECRET_KEY = re.compile(r'^([A-Z0-9_]*(SECRET|JWT|PASSWORD|TOKEN|API_KEY)[A-Z0-9_]*|DATABASE_URL)=(.*)$', re.M)
ALLOWED_FRONTMATTER = {'name', 'description', 'license', 'allowed-tools', 'metadata', 'compatibility'}


def fail(msg: str) -> None:
    print(f'✖ {msg}', file=sys.stderr)
    sys.exit(1)


def is_env_file(name: str) -> bool:
    if name.endswith('.example'):
        return False
    return name == '.env' or name.startswith('.env.')


def excluded(rel: Path) -> bool:
    if any(p in EXCLUDE_DIR_NAMES for p in rel.parts[:-1]):
        return True
    posix = rel.as_posix()
    if any(posix == d or posix.startswith(d + '/') for d in EXCLUDE_DIR_PATHS):
        return True
    if posix in EXCLUDE_FILE_PATHS or is_env_file(rel.name):
        return True
    return any(fnmatch.fnmatch(rel.name, g) for g in EXCLUDE_FILE_GLOBS)


def validate_skill_md(text: str) -> None:
    m = re.match(r'^---\n(.*?)\n---\n', text, re.S)
    if not m:
        fail('SKILL.md 開頭沒有 --- frontmatter ---')
    fields: dict[str, str] = {}
    for line in m.group(1).splitlines():
        km = re.match(r'^([A-Za-z][\w-]*):\s*(.*)$', line)
        if km:
            fields[km.group(1)] = km.group(2).strip()
    extra = set(fields) - ALLOWED_FRONTMATTER
    if extra:
        fail(f'frontmatter 有不允許的欄位：{", ".join(sorted(extra))}')
    name, desc = fields.get('name', ''), fields.get('description', '')
    if name != SKILL_NAME:
        fail(f'frontmatter name 要是 {SKILL_NAME}，現在是「{name}」')
    if not re.fullmatch(r'[a-z0-9]+(-[a-z0-9]+)*', name) or len(name) > 64:
        fail('name 要是 kebab-case、64 字以內')
    if not desc:
        fail('frontmatter 沒有 description')
    if '<' in desc or '>' in desc:
        fail('description 不能有角括號（上傳會被拒）')
    if len(desc) > 1024:
        fail(f'description 太長：{len(desc)} 字，上限 1024')
    if f'studio-template {VERSION}' not in text:
        fail(f'SKILL.md 沒寫「studio-template {VERSION}」，版本號沒跟著改？')


def key_files(text: str) -> list[str]:
    m = re.search(r'<!-- key-files:start -->(.*?)<!-- key-files:end -->', text, re.S)
    if not m:
        fail('SKILL.md 找不到 key-files 區塊')
    files = re.findall(r'^- `([^`]+)`', m.group(1), re.M)
    if len(files) < 10:
        fail(f'key-files 只抓到 {len(files)} 個，區塊格式壞了？')
    return files


def collect() -> list[tuple[Path, str, int]]:
    """回傳 (來源檔, 套件內路徑, 權限)。"""
    out = []
    for p in sorted(SRC.rglob('*')):
        rel = p.relative_to(SRC)
        if p.is_dir() or excluded(rel):
            continue
        if p.is_symlink():
            fail(f'範本裡有符號連結：{rel}（打包會失真，先換成實體檔）')
        arc_rel = rel.as_posix()
        if rel.name == 'SKILL.md':
            arc_rel += '.tpl'
        executable = any(fnmatch.fnmatch(arc_rel, g) or fnmatch.fnmatch(rel.name, g) for g in EXECUTABLE_GLOBS)
        mode = 0o755 if executable else 0o644
        out.append((p, f'{SKILL_NAME}/assets/template/{arc_rel}', mode))
    return out


def check_env_examples(files: list[tuple[Path, str, int]]) -> None:
    for src, arc, _ in files:
        if not src.name.endswith('.example') or '.env' not in src.name:
            continue
        for m in SECRET_KEY.finditer(src.read_text(encoding='utf-8')):
            value = m.group(3).strip()
            if value and '<' not in value:
                fail(f'{arc}：{m.group(1)} 有值。範例檔的密鑰欄位要空著或寫 <佔位>')


def main() -> None:
    if not SRC.is_dir():
        fail(f'找不到範本：{SRC}')
    text = SKILL_MD.read_text(encoding='utf-8')
    validate_skill_md(text)
    files = collect()
    arcs = {arc for _, arc, _ in files}
    check_env_examples(files)

    prefix = f'{SKILL_NAME}/assets/template/'
    missing = [f for f in key_files(text) if prefix + f not in arcs and prefix + f + '.tpl' not in arcs]
    if missing:
        fail(f'快照缺 SKILL.md 第 5 步列的關鍵檔：{", ".join(missing)}')
    stray = [a for a in arcs if a.endswith('/SKILL.md')]
    if stray:
        fail(f'套件裡除了根目錄還有 SKILL.md：{", ".join(stray)}')

    if '--list' in sys.argv:
        for _, arc, mode in files:
            print(f'{oct(mode)[2:]} {arc}')
        print(f'共 {len(files)} 個範本檔')
        return

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(OUT, 'w', zipfile.ZIP_DEFLATED) as z:
        info = zipfile.ZipInfo.from_file(SKILL_MD, f'{SKILL_NAME}/SKILL.md')
        info.external_attr = (stat.S_IFREG | 0o644) << 16
        info.compress_type = zipfile.ZIP_DEFLATED
        z.writestr(info, SKILL_MD.read_bytes())
        for src, arc, mode in files:
            info = zipfile.ZipInfo.from_file(src, arc)
            info.external_attr = (stat.S_IFREG | mode) << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(info, src.read_bytes())

    tpl = sorted(a.removeprefix(prefix) for a in arcs if a.endswith('SKILL.md.tpl'))
    size_kb = OUT.stat().st_size / 1024
    print(f'✓ {OUT}')
    print(f'  範本檔 {len(files)} 個＋SKILL.md，壓縮後 {size_kb:.0f} KB')
    print(f'  改存 .tpl 的子 skill：{", ".join(tpl)}')
    print(f'  關鍵檔案 {len(key_files(text))} 個都在快照裡')


if __name__ == '__main__':
    main()
