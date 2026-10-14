// 全流程检查：node tests/flow.cjs [local|ai] [dark|light]，需先启动设计台（默认 http://127.0.0.1:4180）。
// 截图存到 tests/out/。Playwright 路径可用 PLAYWRIGHT 环境变量指定。
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const path = require('path');
const fs = require('fs');
const A = path.join(__dirname, '../demo/public/files/assets/');
const OUT = path.join(__dirname, 'out'); require('fs').mkdirSync(OUT, { recursive: true });
const pool = require('fs').readdirSync(A).filter((f) => f.endsWith('.png'));
const tag = process.argv[2] || 'local';
const theme = process.argv[3] || 'dark';
const PET = fs.readFileSync(path.join(__dirname, 'sample-brief.txt'), 'utf8');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 920 }, colorScheme: theme, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => m.type() === 'error' && errors.push(m.text()));
  const base = process.env.BASE || 'http://127.0.0.1:4180';
  const shot = async (n, full) => { if (full) await page.addStyleTag({ content: '.sidebar{position:relative!important;height:auto!important}' }); return page.screenshot({ path: `${OUT}/${tag}-${theme}-${n}.png`, fullPage: !!full }); };
  const settle = async () => { await page.waitForLoadState('networkidle'); await page.waitForTimeout(400); };
  const next = async () => { const u = page.url(); await page.click('.step-foot button[type=submit]:not(.link-button)'); await page.waitForURL(x => x.toString() !== u, { timeout: 15000 }); await settle(); };
  const log = (...a) => console.log(...a);
  const names = ['autumn-kv-direction-a.png', 'style-reference-mood.png', 'winter-solstice-round1-a.png', 'festival-poster-history.png', 'winter-solstice-round1-b.png'];
  const img = (f, name) => ({ name: name || f, mimeType: 'image/png', buffer: fs.readFileSync(A + pool[Math.max(0, names.indexOf(f)) % pool.length]) });

  await page.goto(base + '/assets');
  await page.setInputFiles('input[name=files]', ['autumn-kv-direction-a.png', 'style-reference-mood.png', 'winter-solstice-round1-a.png', 'festival-poster-history.png'].map((f) => img(f)));
  await page.waitForSelector('.form-ok', { timeout: 30000 });
  log('assets', await page.locator('.asset-card').count());

  // 新项目：她那段宠物零食背景
  await page.click('.nav-add'); await page.waitForURL(/\/new$/);
  await page.fill('textarea[name=raw]', PET);
  await page.click('button:has-text("建项目")');
  await page.waitForURL(/\/brief$/); await settle();
  log('title', await page.inputValue('input[name=title]').catch(() => '?'));
  log('known', await page.$$eval('.brief-form .brief-field label > span, .brief-form .brief-field > label', e => e.map(x => x.textContent.trim()).slice(0, 20)));
  await page.setInputFiles('.dropzone input[name=files]', [img('style-reference-mood.png', '宠味食刻_logo.png')]);
  await page.waitForSelector('.ref-chip', { timeout: 20000 }); await settle();
  log('refs', await page.locator('.ref-chip').count());
  await shot('brief', true);
  await next();

  // 脑图
  await page.click('button:has-text("生成脑图")');
  await page.waitForSelector('.mind-canvas .mind-star', { timeout: 20000 }); await page.waitForTimeout(900);
  log('branches', await page.$$eval('.mind-canvas .mind-node text', e => e.map(x => x.textContent)));
  await page.locator('.mind-canvas .mind-node').nth(1).click();
  await page.waitForFunction(() => document.querySelectorAll('.mind-canvas .mind-star').length > 7, null, { timeout: 20000 });
  await page.waitForTimeout(900);
  await shot('ideas');
  await page.locator('.mind-canvas .mind-node').nth(2).dblclick(); await page.waitForTimeout(800);
  await shot('ideas-zoom');
  await page.click('[aria-label="看全图"]'); await page.waitForTimeout(700);
  for (const i of [1, 7, 8]) await page.locator('.mind-canvas .mind-star').nth(i).click({ force: true }), await page.waitForTimeout(500);
  await next();

  // 风格
  await page.click('button:has-text("按创意组合匹配")'); await settle();
  await page.locator('.asset-grid button:has-text("选用")').first().click();
  await page.waitForSelector('.ref-editor', { timeout: 10000 });
  await shot('style');
  await next();

  // 出稿：设计卡片 + 资产库挑图
  log('card images', await page.locator('.design-images figure').count());
  await page.click('.card-picker summary');
  await page.locator('.picker-item button').nth(2).click(); await settle();
  log('card images after pick', await page.locator('.design-images figure').count());
  await page.click('[aria-label="复制设计卡片"]'); await page.waitForTimeout(1500);
  log('copy note', await page.textContent('.design-card-actions [role=status]').catch(() => 'none'));
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[aria-label="下载设计卡片"]')]);
  await dl.saveAs(`${OUT}/${tag}-${theme}-card.png`);
  log('scrollW', await page.evaluate(() => [document.documentElement.scrollWidth, ...[...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > 1450).slice(0,5).map(e => e.tagName + '.' + e.className + ':' + Math.round(e.getBoundingClientRect().width))]));
  await shot('draft', true);
  await page.setInputFiles('.dropzone input[name=files]', [img('winter-solstice-round1-b.png', '宠味食刻KV_v1.png')]);
  await page.waitForSelector('.draft-card', { timeout: 20000 }); await settle();
  await page.locator('#draft-from-asset').selectOption({ index: 0 });
  await page.click('.from-asset button'); await settle();
  log('drafts', await page.$$eval('.draft-card strong', e => e.map(x => x.textContent)));
  await next();

  await page.click('.review-form button[type=submit]');
  await page.waitForSelector('.finding', { timeout: 30000 });
  await shot('review');
  await page.click('button:has-text("就用这一版，提交终稿")');
  await page.waitForURL(/\/delivery$/);
  await page.fill('textarea[name=retro]', '高饱和配色方向通过');
  await page.click('button:has-text("交付完成")'); await page.waitForSelector('text=终稿已存进资产库'); await settle();

  // 另建一个项目再删除
  await page.goto(base + '/new');
  await page.fill('textarea[name=raw]', '中秋礼盒包装，暖金色');
  await page.click('button:has-text("建项目")'); await page.waitForURL(/\/brief$/);
  await page.click('.danger-zone summary'); await page.click('.danger-zone button'); await page.waitForURL(base + '/'); await settle();
  log('sidebar after delete', await page.$$eval('.project-list > li > a', e => e.map(x => x.textContent)));
  await page.click('.nav-foot-link:has-text("历史项目")'); await settle();
  log('history', await page.$$eval('.history-group', e => e.map(x => x.querySelector('h2').textContent + ':' + [...x.querySelectorAll('.history-main strong')].map(s => s.textContent).join('/'))));
  await shot('history');
  await page.locator('.history-group').nth(1).locator('.confirm-pop summary').click(); await page.waitForTimeout(200);
  await shot('history-confirm');
  await page.locator('.history-group').nth(1).locator('[title="恢复项目"]').click(); await settle();
  log('after restore', await page.$$eval('.history-group h2', e => e.map(x => x.textContent)), await page.$$eval('.project-list > li > a', e => e.map(x => x.textContent)));
  await page.locator('.history-group').nth(0).locator('.confirm-pop summary').first().click();
  await page.locator('.history-group').nth(0).locator('.confirm-box button').first().click(); await settle();
  log('after purge', await page.$$eval('.history-main strong', e => e.map(x => x.textContent)));
  await page.click('.nav-foot-link:has-text("设置")'); await settle(); await shot('settings');
  await page.click('.settings-tabs a:has-text("评审角色")'); await settle(); await shot('roles');
  await page.goto(base); await shot('home');
  log('errors', errors);
  await browser.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
