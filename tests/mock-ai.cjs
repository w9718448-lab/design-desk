const http = require('http');
let n = 0;
http.createServer((req, res) => {
  let body = '';
  req.on('data', c => body += c);
  req.on('end', () => {
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
