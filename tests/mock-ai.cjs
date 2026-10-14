const http = require('http');
const fs = require('fs');
const path = require('path');
let n = 0;
// 生图测试用的示例图：随便取展示版里的一张。
const dir = path.join(__dirname, '..', 'demo', 'public', 'files', 'assets');
const png = fs.readFileSync(path.join(dir, fs.readdirSync(dir).find(f => f.endsWith('.png'))));
const images = [];
http.createServer((req, res) => {
  let body = '';
  req.on('data', c => body += c);
  req.on('end', () => {
    const send = (data) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); };
    if (req.url.startsWith('/img/')) { res.setHeader('Content-Type', 'image/png'); return res.end(png); }
    if (req.url.includes('multimodal-generation')) {
      const json = JSON.parse(body);
      const refs = json.input.messages[0].content.filter(c => c.image).length;
      images.push({ provider: 'tongyi', model: json.model, size: json.parameters.size, n: json.parameters.n, refs });
      console.log('mock image tongyi', json.model, json.parameters.size, 'n=' + json.parameters.n, 'refs=' + refs);
      return send({ output: { choices: [{ message: { content: Array.from({ length: json.parameters.n }, (_, i) => ({ type: 'image', image: `http://127.0.0.1:4999/img/${i}.png` })) } }] } });
    }
    if (req.url.includes('/api/v3/images/generations')) {
      const json = JSON.parse(body);
      images.push({ provider: 'doubao', model: json.model, size: json.size, refs: (json.image || []).length });
      console.log('mock image doubao', json.model, json.size, 'refs=' + (json.image || []).length);
      return send({ data: [{ b64_json: png.toString('base64') }] });
    }
    if (req.url.includes('/v1/images/')) {
      const edits = req.url.includes('edits');
      const count = edits ? Number((body.match(/name="n"\r\n\r\n(\d)/) || [0, 1])[1]) : JSON.parse(body).n;
      images.push({ provider: 'openai', edits, n: count });
      console.log('mock image openai', edits ? 'edits' : 'generations', 'n=' + count);
      return send({ data: Array.from({ length: count }, () => ({ b64_json: png.toString('base64') })) });
    }
    if (req.url === '/calls') return send(images);
    const json = JSON.parse(body);
    const system = json.messages[0].content;
    const user = json.messages[1].content;
    const vision = Array.isArray(user);
    let data;
    if (system.includes('资产整理助手')) data = { tags: ['极光渐变', '冷色调', '柔和光晕', '留白构图', '玻璃质感', '未来感'] };
    else if (system.includes('风格匹配')) {
      const ids = [...String(user).matchAll(/id=(\S+?)｜/g)].map(m => m[1]);
      data = { ranking: ids.map((id, i) => ({ id, score: Math.max(2, 9 - i * 3), reason: i < 2 ? '冷色渐变和光晕与“星空、希望”接近' : '' })) };
    }
    else if (vision) data = {
      findings: [
        { role: 'brand', severity: 'must', text: '左上角 Logo 与边缘距离过小，不足安全区', basis: '原则：Logo 保留安全区' },
        { role: 'audience', severity: 'should', text: '主标题字号偏小，3 秒内不易读到', basis: '需求卡：受众 应届生' },
        { role: 'copy', severity: 'minor', text: '副标题标点建议统一为全角', basis: '通用检查' },
      ],
      conflicts: ['目标受众希望主标题更醒目，品牌守门人要求克制用色'],
    };
    else if (system.includes('脑图的起点')) data = { root: '校招·点亮未来', branches: ['星空与远方', '第一束光', '成长阶梯', '青春热血', '科技脉冲', '同行伙伴'] };
    else if (system.includes('继续发散')) { n++; data = { keywords: ['晨曦' + n, '光轨' + n, '启程' + n, '破晓' + n, '萤火' + n] }; }
    else data = { title: '校招海报', fields: { goal: { value: '吸引应届生投递', status: 'confirmed' }, audience: { value: '应届生', status: 'confirmed' }, deliverables: { value: '海报 1080×1920', status: 'confirmed' } }, questions: '你好，想确认：\n1. 截止时间？' };
    console.log('mock', json.model, vision ? 'vision' : 'text', Object.keys(data)[0]);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ choices: [{ message: { content: '```json\n' + JSON.stringify(data) + '\n```' } }] }));
  });
}).listen(4999);
