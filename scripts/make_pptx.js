const pptxgen = require('pptxgenjs');
const sharp = require('sharp');

// ═══════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════
const C = {
  bg: 'FAF8F5',
  surface: 'FFFFFF',
  surfaceAlt: 'F5F3EE',
  text: '1C1917',
  textMuted: '78716C',
  textSubtle: 'A8A29E',
  amber: 'D97706',
  amberDark: 'B45309',
  amberLight: 'FDE68A',
  amberSurface: 'FFFBEB',
  amberSurfaceBold: 'FFF7ED',
  amberDim: 'FEF3C7',
  teal: '0D9488',
  tealDark: '0F766E',
  tealSurface: 'CCFBF1',
  tealLight: 'F0FDFA',
  red: 'EF4444',
  redSurface: 'FEF2F2',
  orangeSurface: 'FFF7ED',
  border: 'E7E5E2',
  amberBorder: 'FCD34D',
  tealBorder: '99F6E4',
  white: 'FFFFFF',
};

// ═══════════════════════════════════════════
// SVGs for icons
// ═══════════════════════════════════════════
const ICONS = {
  sparkle: `<svg xmlns="http://www.w3.org/2000/svg" width="SIZE" height="SIZE" viewBox="0 0 24 24" fill="none" stroke="COLOR" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5z"/><path d="M18 16l.5 2L20 18.5l-1.5.5-.5 2-.5-2L16 18.5l1.5-.5z"/><path d="M6 2l.3 1.2L7.5 3.5 6.3 3.8 6 5l-.3-1.2L4.5 3.5l1.2-.3z"/></svg>`,
  target: `<svg xmlns="http://www.w3.org/2000/svg" width="SIZE" height="SIZE" viewBox="0 0 24 24" fill="none" stroke="COLOR" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
  layers: `<svg xmlns="http://www.w3.org/2000/svg" width="SIZE" height="SIZE" viewBox="0 0 24 24" fill="none" stroke="COLOR" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 22 8.5 12 15 2 8.5"/><polyline points="2 15.5 12 22 22 15.5"/></svg>`,
  heart: `<svg xmlns="http://www.w3.org/2000/svg" width="SIZE" height="SIZE" viewBox="0 0 24 24" fill="none" stroke="COLOR" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.7 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21.3l7.8-7.8 1.1-1.1a5.5 5.5 0 0 0 0-7.8z"/></svg>`,
  search: `<svg xmlns="http://www.w3.org/2000/svg" width="SIZE" height="SIZE" viewBox="0 0 24 24" fill="none" stroke="COLOR" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`,
};

async function renderIcon(name, colorHex, size = 200) {
  const svg = ICONS[name]
    .replace(/SIZE/g, String(size))
    .replace(/COLOR/g, `#${colorHex}`);
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return { data: `image/png;base64,${buf.toString('base64')}`, w: size / 72, h: size / 72 };
}

// ═══════════════════════════════════════════
// Light background with subtle texture
// ═══════════════════════════════════════════
async function createBg() {
  const W = 2000, H = 1125;
  const buf = await sharp({
    create: { width: W, height: H, channels: 4, background: { r: 250, g: 248, b: 245, alpha: 1 } }
  }).png().toBuffer();
  return `image/png;base64,${buf.toString('base64')}`;
}

// ═══════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════
function addCard(slide, opts) {
  slide.addShape('ROUNDED_RECTANGLE', {
    x: opts.x, y: opts.y, w: opts.w, h: opts.h,
    fill: opts.fill,
    rectRadius: opts.radius || 0.1,
    shadow: opts.shadow || undefined,
    line: opts.border ? { color: opts.border, width: 1 } : undefined,
  });
}

function addPill(slide, { x, y, w, h, fill, text, fontSize = 9, color = C.white, bold = false }) {
  slide.addShape('ROUNDED_RECTANGLE', { x, y, w, h, fill, rectRadius: h / 2 });
  slide.addText(text, { x, y, w, h, fontSize, fontFace: 'Calibri', color, bold, align: 'center', valign: 'middle', margin: 0 });
}

function addDot(slide, x, y, size, color, opacity = 100) {
  slide.addShape('OVAL', {
    x, y, w: size, h: size,
    fill: { type: 'solid', color, transparency: 100 - opacity },
  });
}

// ═══════════════════════════════════════════
// Main
// ═══════════════════════════════════════════
async function main() {
  console.log('Creating background...');
  const bg = await createBg();

  console.log('Rendering icons...');
  const icon = {};
  for (const name of ['sparkle', 'target', 'layers', 'heart', 'search']) {
    icon[name] = await renderIcon(name, C.amber, 200);
  }

  const pres = new pptxgen();
  pres.layout = 'LAYOUT_16x9';
  pres.author = 'MemoDeer';
  pres.title = 'MemoDeer · 知道AI学习助手';

  // ════════════════════════════════════
  // SLIDE 1: Opening
  // ════════════════════════════════════
  {
    const slide = pres.addSlide();
    slide.background = { data: bg };

    // ——— Decorative: soft amber circles (top-right, large, very faint) ———
    slide.addShape('OVAL', {
      x: 6.5, y: -1.2, w: 4.8, h: 4.8,
      fill: { type: 'solid', color: C.amberDim, transparency: 60 },
    });
    slide.addShape('OVAL', {
      x: 7.2, y: -0.5, w: 3.2, h: 3.2,
      fill: { type: 'solid', color: C.amberSurface, transparency: 40 },
    });

    // ——— Decorative: scattered dots ———
    addDot(slide, 1.2, 0.9, 0.07, C.amber, 50);
    addDot(slide, 1.7, 1.1, 0.05, C.amber, 35);
    addDot(slide, 8.6, 4.2, 0.06, C.amber, 45);
    addDot(slide, 0.6, 3.8, 0.04, C.amber, 30);
    addDot(slide, 8.9, 1.6, 0.05, C.teal, 40);

    // ——— Thin amber line accent (top-left) ———
    slide.addShape('ROUNDED_RECTANGLE', {
      x: 0.8, y: 1.05, w: 0.55, h: 0.05,
      fill: C.amber, rectRadius: 0.025,
    });

    // ——— Title ———
    slide.addText('MemoDeer', {
      x: 0.8, y: 1.3, w: 8.4, h: 1.2,
      fontSize: 56, fontFace: 'Cambria', color: C.text, bold: true,
      align: 'left', margin: 0,
    });
    slide.addText('知道 AI 学习助手', {
      x: 0.8, y: 2.4, w: 8.4, h: 0.7,
      fontSize: 28, fontFace: 'Calibri', color: C.textMuted,
      align: 'left', margin: 0,
    });

    // ——— Tagline pill ———
    const taglineW = 4.6;
    slide.addShape('ROUNDED_RECTANGLE', {
      x: 0.8, y: 3.2, w: taglineW, h: 0.42,
      fill: C.amberSurface, rectRadius: 0.21,
      line: { color: C.amberBorder, width: 0.8 },
    });
    slide.addText('上传 · 理解 · 问答 · 出题  —  你的个人 AI 知识库', {
      x: 0.8, y: 3.2, w: taglineW, h: 0.42,
      fontSize: 12, fontFace: 'Calibri', color: C.amberDark, bold: true,
      align: 'center', valign: 'middle', margin: 0,
    });

    // ——— Bottom ———
    slide.addText('AI-Powered Personal Knowledge Workspace', {
      x: 0.8, y: 4.55, w: 5, h: 0.35,
      fontSize: 11, fontFace: 'Calibri', color: C.textSubtle,
      align: 'left', margin: 0,
    });
    slide.addText('2026', {
      x: 8.5, y: 4.55, w: 1, h: 0.35,
      fontSize: 11, fontFace: 'Calibri', color: C.textSubtle,
      align: 'right', margin: 0,
    });
  }

  // ════════════════════════════════════
  // SLIDE 2: Pain Points & Solution
  // ════════════════════════════════════
  {
    const slide = pres.addSlide();
    slide.background = { data: bg };

    // ——— Decorative dots ———
    addDot(slide, 9.1, 0.5, 0.06, C.amber, 35);
    addDot(slide, 8.7, 4.9, 0.05, C.teal, 30);

    // ——— Title ———
    slide.addText('痛点与解决方案', {
      x: 0.6, y: 0.25, w: 5, h: 0.55,
      fontSize: 28, fontFace: 'Cambria', color: C.text, bold: true,
      align: 'left', margin: 0,
    });
    slide.addText('传统学习工具的三大困境', {
      x: 0.6, y: 0.72, w: 5, h: 0.3,
      fontSize: 12, fontFace: 'Calibri', color: C.textMuted,
      align: 'left', margin: 0,
    });

    const cardW = 2.7;
    const cardH = 3.15;
    const cardY = 1.3;
    const gap = 0.25;
    const startX = 0.6;

    const painPoints = [
      {
        title: '知识管理碎片化',
        desc: 'PDF、笔记、教材分散在各处，\n无法集中管理和检索。\n想要修改 AI 处理后的内容？\n传统工具只能看，不能改。',
        color: C.amber,
        bg: C.amberSurface,
        border: C.amberBorder,
        dotColor: C.amber,
      },
      {
        title: 'AI 问答不可溯源',
        desc: '通用 AI 的回答没有依据，\n不知道信息来自哪里。\n你上传的文档知识，\nAI 无法精准定位回答。',
        color: C.teal,
        bg: C.tealLight,
        border: C.tealBorder,
        dotColor: C.teal,
      },
      {
        title: '学完无法检验效果',
        desc: '看完资料 ≠ 学会。\n缺少针对性练习和错题追踪，\n不知道薄弱点在哪里，\n无法形成学习闭环。',
        color: C.amberDark,
        bg: C.amberSurfaceBold,
        border: C.amberBorder,
        dotColor: C.amberDark,
      },
    ];

    painPoints.forEach((pp, i) => {
      const x = startX + i * (cardW + gap);

      // Card
      slide.addShape('ROUNDED_RECTANGLE', {
        x, y: cardY, w: cardW, h: cardH,
        fill: C.white, rectRadius: 0.12,
        line: { color: C.border, width: 0.8 },
      });

      // Red X badge
      slide.addShape('OVAL', {
        x: x + 0.14, y: cardY + 0.14, w: 0.32, h: 0.32,
        fill: C.redSurface,
      });
      slide.addText('✕', {
        x: x + 0.14, y: cardY + 0.14, w: 0.32, h: 0.32,
        fontSize: 12, fontFace: 'Calibri', color: C.red, bold: true, align: 'center', valign: 'middle', margin: 0,
      });

      // Title
      slide.addText(pp.title, {
        x: x + 0.2, y: cardY + 0.55, w: cardW - 0.4, h: 0.3,
        fontSize: 13, fontFace: 'Calibri', color: C.text, bold: true,
        align: 'left', margin: 0,
      });

      // Desc
      slide.addText(pp.desc, {
        x: x + 0.2, y: cardY + 0.95, w: cardW - 0.4, h: 1.7,
        fontSize: 10, fontFace: 'Calibri', color: C.textMuted,
        align: 'left', valign: 'top', margin: 0,
        lineSpacingMultiple: 1.6,
      });

      // Bottom badge
      slide.addShape('ROUNDED_RECTANGLE', {
        x: x + 0.15, y: cardY + cardH - 0.52, w: cardW - 0.3, h: 0.26,
        fill: pp.bg, rectRadius: 0.06,
        line: { color: pp.border, width: 0.6 },
      });
      slide.addText('痛点 ' + (i + 1), {
        x: x + 0.15, y: cardY + cardH - 0.52, w: cardW - 0.3, h: 0.26,
        fontSize: 8, fontFace: 'Calibri', color: pp.dotColor, bold: true,
        align: 'center', valign: 'middle', margin: 0,
      });
    });

    // ——— Bottom: solution bar ———
    const solY = 4.72;
    slide.addShape('ROUNDED_RECTANGLE', {
      x: 0.6, y: solY, w: 8.8, h: 0.5,
      fill: C.amberSurface, rectRadius: 0.1,
      line: { color: C.amberBorder, width: 1 },
    });
    slide.addText('MemoDeer 的答案：像 Obsidian 一样编辑知识 + 像 NotebookLM 一样智能问答 + 自动出题巩固  →  学、问、练三合一', {
      x: 0.8, y: solY, w: 8.4, h: 0.5,
      fontSize: 11.5, fontFace: 'Calibri', color: C.amberDark, bold: true,
      align: 'center', valign: 'middle', margin: 0,
    });
  }

  // ════════════════════════════════════
  // SLIDE 3: System Architecture
  // ════════════════════════════════════
  {
    const slide = pres.addSlide();
    slide.background = { data: bg };

    // ——— Decorative ———
    addDot(slide, 0.5, 0.8, 0.05, C.amber, 40);
    addDot(slide, 9.3, 4.6, 0.04, C.teal, 35);

    // ——— Title ———
    slide.addText('系统架构与技术栈', {
      x: 0.6, y: 0.2, w: 5, h: 0.45,
      fontSize: 26, fontFace: 'Cambria', color: C.text, bold: true,
      align: 'left', margin: 0,
    });
    slide.addText('两大核心 AI 管线', {
      x: 0.6, y: 0.58, w: 5, h: 0.25,
      fontSize: 11, fontFace: 'Calibri', color: C.textMuted,
      align: 'left', margin: 0,
    });

    const leftX = 0.5;
    const colW = 4.2;
    const colTop = 1.05;
    const stepH = 0.36;
    const stepY0 = colTop + 0.46;
    const stepGap = 0.1;

    // === LEFT COLUMN: Q&A ===
    slide.addShape('ROUNDED_RECTANGLE', {
      x: leftX, y: colTop, w: colW, h: 0.32,
      fill: C.amberSurface, rectRadius: 0.06,
      line: { color: C.amberBorder, width: 0.6 },
    });
    slide.addText('AI 智能问答管线 (RAG Q&A)', {
      x: leftX, y: colTop, w: colW, h: 0.32,
      fontSize: 9.5, fontFace: 'Calibri', color: C.amberDark, bold: true,
      align: 'center', valign: 'middle', margin: 0,
    });

    const qaSteps = [
      { label: '用户提问', sub: '', color: C.text },
      { label: 'Embedding 向量化', sub: 'BGE-small-zh', color: C.teal },
      { label: 'ChromaDB 向量检索', sub: 'Top-8 + 关键词混合', color: C.teal },
      { label: 'RAG 上下文组装', sub: '过滤 · 排序 · 引用标注', color: C.textMuted },
      { label: 'Pro LLM 推理生成', sub: 'DeepSeek-V4-Pro', color: C.amber },
      { label: '流式返回 + 引用', sub: 'SSE 实时输出 [1][2]', color: C.amber },
    ];

    qaSteps.forEach((s, i) => {
      const y = stepY0 + i * (stepH + stepGap);
      slide.addShape('ROUNDED_RECTANGLE', {
        x: leftX + 0.1, y, w: colW - 0.2, h: stepH,
        fill: i % 2 === 0 ? C.surfaceAlt : C.white, rectRadius: 0.06,
        line: { color: C.border, width: 0.4 },
      });
      // Color dot
      slide.addShape('OVAL', {
        x: leftX + 0.22, y: y + stepH / 2 - 0.035, w: 0.07, h: 0.07,
        fill: s.color,
      });
      slide.addText(s.label, {
        x: leftX + 0.36, y, w: colW - 0.9, h: stepH,
        fontSize: 8.5, fontFace: 'Calibri', color: C.text, bold: true,
        align: 'left', valign: 'middle', margin: 0,
      });
      if (s.sub) {
        slide.addText(s.sub, {
          x: leftX + 1.8, y, w: colW - 2.1, h: stepH,
          fontSize: 7, fontFace: 'Calibri', color: C.textSubtle,
          align: 'right', valign: 'middle', margin: 0,
        });
      }
      // Connector line
      if (i < qaSteps.length - 1) {
        slide.addShape('LINE', {
          x: leftX + colW / 2, y: y + stepH, w: 0, h: stepGap,
          line: { color: C.textSubtle, width: 0.6 },
        });
      }
    });

    // === RIGHT COLUMN: Knowledge + Quiz ===
    const rightX = 5.3;

    slide.addShape('ROUNDED_RECTANGLE', {
      x: rightX, y: colTop, w: colW, h: 0.32,
      fill: C.tealLight, rectRadius: 0.06,
      line: { color: C.tealBorder, width: 0.6 },
    });
    slide.addText('AI 知识点提取 + 出题管线', {
      x: rightX, y: colTop, w: colW, h: 0.32,
      fontSize: 9.5, fontFace: 'Calibri', color: C.tealDark, bold: true,
      align: 'center', valign: 'middle', margin: 0,
    });

    const kpSteps = [
      { label: '文档上传与解析', sub: 'PDF/DOCX/TXT/MD', color: C.text },
      { label: 'AI 格式化 Markdown', sub: 'Flash LLM · Obsidian 风格', color: C.amber },
      { label: '文本分块', sub: '500字/块 · 50字重叠', color: C.teal },
      { label: '向量化存储', sub: 'ChromaDB 嵌入索引', color: C.teal },
      { label: '知识点提取', sub: 'Flash LLM 结构化 JSON', color: C.amber },
      { label: '自动出题 + 错题本', sub: '选择题/填空题 · 错题追踪', color: C.amber },
    ];

    kpSteps.forEach((s, i) => {
      const y = stepY0 + i * (stepH + stepGap);
      slide.addShape('ROUNDED_RECTANGLE', {
        x: rightX + 0.1, y, w: colW - 0.2, h: stepH,
        fill: i % 2 === 0 ? C.surfaceAlt : C.white, rectRadius: 0.06,
        line: { color: C.border, width: 0.4 },
      });
      slide.addShape('OVAL', {
        x: rightX + 0.22, y: y + stepH / 2 - 0.035, w: 0.07, h: 0.07,
        fill: s.color,
      });
      slide.addText(s.label, {
        x: rightX + 0.36, y, w: colW - 0.9, h: stepH,
        fontSize: 8.5, fontFace: 'Calibri', color: C.text, bold: true,
        align: 'left', valign: 'middle', margin: 0,
      });
      if (s.sub) {
        slide.addText(s.sub, {
          x: rightX + 1.8, y, w: colW - 2.1, h: stepH,
          fontSize: 7, fontFace: 'Calibri', color: C.textSubtle,
          align: 'right', valign: 'middle', margin: 0,
        });
      }
      if (i < kpSteps.length - 1) {
        slide.addShape('LINE', {
          x: rightX + colW / 2, y: y + stepH, w: 0, h: stepGap,
          line: { color: C.textSubtle, width: 0.6 },
        });
      }
    });

    // === Bottom: Tech Stack ===
    const techY = 4.78;
    slide.addText('技术栈', {
      x: 0.6, y: techY, w: 0.85, h: 0.32,
      fontSize: 9.5, fontFace: 'Calibri', color: C.textMuted, bold: true,
      align: 'left', valign: 'middle', margin: 0,
    });

    const techs = [
      { name: 'React 18', color: C.teal },
      { name: 'TypeScript', color: C.teal },
      { name: 'Tailwind', color: C.teal },
      { name: 'Zustand', color: C.teal },
      { name: 'FastAPI', color: C.amber },
      { name: 'SQLAlchemy', color: C.amber },
      { name: 'ChromaDB', color: C.amber },
      { name: 'DeepSeek', color: C.amber },
      { name: 'BGE', color: C.amber },
    ];

    let pillX = 1.55;
    techs.forEach((t) => {
      const pillW = t.name.length * 0.07 + 0.32;
      slide.addShape('ROUNDED_RECTANGLE', {
        x: pillX, y: techY + 0.02, w: pillW, h: 0.26,
        fill: t.color, rectRadius: 0.13,
      });
      slide.addText(t.name, {
        x: pillX, y: techY + 0.02, w: pillW, h: 0.26,
        fontSize: 7.5, fontFace: 'Calibri', color: C.white, bold: true,
        align: 'center', valign: 'middle', margin: 0,
      });
      pillX += pillW + 0.08;
    });
  }

  // ════════════════════════════════════
  // SLIDE 4: Business Model
  // ════════════════════════════════════
  {
    const slide = pres.addSlide();
    slide.background = { data: bg };

    // ——— Decorative ———
    addDot(slide, 9.2, 0.4, 0.05, C.amber, 35);
    addDot(slide, 0.5, 4.5, 0.04, C.teal, 30);

    // ——— Title ———
    slide.addText('商业模式', {
      x: 0.6, y: 0.22, w: 5, h: 0.5,
      fontSize: 28, fontFace: 'Cambria', color: C.text, bold: true,
      align: 'left', margin: 0,
    });
    slide.addText('会员制解锁 AI 高级功能 + 云空间扩展', {
      x: 0.6, y: 0.65, w: 5, h: 0.25,
      fontSize: 12, fontFace: 'Calibri', color: C.textMuted,
      align: 'left', margin: 0,
    });

    const mCardW = 2.7;
    const mCardH = 3.25;
    const mCardY = 1.15;
    const mGap = 0.3;
    const mStartX = 0.6;

    const tiers = [
      {
        name: '免费版', price: '¥0', period: '永久',
        color: C.textMuted, border: C.border,
        features: [
          '3 个笔记本',
          '每笔记本 5 个文档',
          '每日 10 次对话',
          '基础文档上传与管理',
          '全文语义搜索',
          'Markdown 编辑器',
        ],
        highlight: false,
      },
      {
        name: '月度会员', price: '¥19.9', period: '/ 月',
        color: C.amber, border: C.amber,
        features: [
          '无限笔记本与文档',
          '无限 AI 对话次数',
          'AI 知识点智能提取',
          'AI 记忆卡片生成',
          'AI 口诀助记生成',
          '智能出题 + 错题本',
          '优先体验新功能',
        ],
        highlight: true,
      },
      {
        name: '终身会员', price: '¥299', period: '买断制',
        color: C.amberDark, border: C.amberDark,
        features: [
          '月度会员全部功能',
          '永久有效，无需续费',
          '专属身份标识',
          '优先客服支持',
          '未来所有功能更新',
          '适合重度学习用户',
        ],
        highlight: false,
      },
    ];

    tiers.forEach((t, i) => {
      const x = mStartX + i * (mCardW + mGap);
      const isHighlight = t.highlight;

      // Card background
      slide.addShape('ROUNDED_RECTANGLE', {
        x, y: mCardY, w: mCardW, h: mCardH,
        fill: C.white, rectRadius: 0.15,
        line: { color: t.border, width: isHighlight ? 2 : 0.8 },
      });

      // "推荐" badge
      if (isHighlight) {
        slide.addShape('ROUNDED_RECTANGLE', {
          x: x + mCardW / 2 - 0.45, y: mCardY - 0.14, w: 0.9, h: 0.28,
          fill: C.amber, rectRadius: 0.14,
        });
        slide.addText('推荐', {
          x: x + mCardW / 2 - 0.45, y: mCardY - 0.14, w: 0.9, h: 0.28,
          fontSize: 9, fontFace: 'Calibri', color: C.white, bold: true,
          align: 'center', valign: 'middle', margin: 0,
        });
      }

      // Tier name
      slide.addText(t.name, {
        x: x + 0.25, y: mCardY + 0.16, w: mCardW - 0.5, h: 0.28,
        fontSize: 14, fontFace: 'Calibri', color: t.color, bold: true,
        align: 'left', margin: 0,
      });

      // Price + period
      slide.addText(t.price, {
        x: x + 0.25, y: mCardY + 0.45, w: mCardW - 1.3, h: 0.5,
        fontSize: 32, fontFace: 'Cambria', color: C.text, bold: true,
        align: 'left', margin: 0,
      });
      slide.addText(t.period, {
        x: x + mCardW - 0.85, y: mCardY + 0.66, w: 0.6, h: 0.22,
        fontSize: 9, fontFace: 'Calibri', color: C.textMuted,
        align: 'left', margin: 0,
      });

      // Divider
      slide.addShape('LINE', {
        x: x + 0.25, y: mCardY + 1.05, w: mCardW - 0.5, h: 0,
        line: { color: t.border, width: 0.5 },
      });

      // Features
      const featureY = mCardY + 1.18;
      t.features.forEach((f, fi) => {
        slide.addText('✓  ' + f, {
          x: x + 0.25, y: featureY + fi * 0.24, w: mCardW - 0.5, h: 0.22,
          fontSize: 7.5, fontFace: 'Calibri', color: C.text,
          align: 'left', valign: 'middle', margin: 0,
        });
      });
    });

    // === Cloud Storage bar ===
    const cloudY = 4.72;
    slide.addShape('ROUNDED_RECTANGLE', {
      x: 0.6, y: cloudY, w: 8.8, h: 0.5,
      fill: C.tealLight, rectRadius: 0.1,
      line: { color: C.tealBorder, width: 1 },
    });
    slide.addText('云空间扩展', {
      x: 0.8, y: cloudY, w: 1.8, h: 0.5,
      fontSize: 12, fontFace: 'Calibri', color: C.tealDark, bold: true,
      align: 'left', valign: 'middle', margin: 0,
    });
    slide.addText('MemoDeer 本质是云笔记本 — 用户的知识资产持续增长。未来提供云存储套餐，按容量付费，让知识库随身携带、跨设备同步。', {
      x: 2.7, y: cloudY, w: 6.5, h: 0.5,
      fontSize: 10, fontFace: 'Calibri', color: C.textMuted,
      align: 'left', valign: 'middle', margin: 0,
    });
  }

  // ════════════════════════════════════
  // SLIDE 5: Thank You
  // ════════════════════════════════════
  {
    const slide = pres.addSlide();
    slide.background = { data: bg };

    // ——— Decorative: large soft circles (center, faint) ———
    slide.addShape('OVAL', {
      x: 2.8, y: 0.6, w: 4.4, h: 4.4,
      fill: { type: 'solid', color: C.amberDim, transparency: 55 },
    });
    slide.addShape('OVAL', {
      x: 3.6, y: 1.3, w: 2.8, h: 2.8,
      fill: { type: 'solid', color: C.amberSurface, transparency: 35 },
    });

    // ——— Decorative dots ring ———
    const cx = 5, cy = 2.85;
    const ringRad = 2;
    const dotCount = 8;
    for (let i = 0; i < dotCount; i++) {
      const angle = (Math.PI * 2 / dotCount) * i - Math.PI / 2;
      const dx = Math.cos(angle) * ringRad;
      const dy = Math.sin(angle) * ringRad;
      addDot(slide, cx + dx, cy + dy, 0.04, i % 2 === 0 ? C.amber : C.teal, 35);
    }

    // ——— Amber accent line ———
    slide.addShape('ROUNDED_RECTANGLE', {
      x: 4.25, y: 2.05, w: 1.5, h: 0.04,
      fill: C.amber, rectRadius: 0.02,
    });

    // ——— Thank you ———
    slide.addText('感谢聆听', {
      x: 1.5, y: 2.25, w: 7, h: 0.9,
      fontSize: 44, fontFace: 'Cambria', color: C.text, bold: true,
      align: 'center', valign: 'middle', margin: 0,
    });

    slide.addText('MemoDeer · 知道 AI 学习助手', {
      x: 1.5, y: 3.15, w: 7, h: 0.45,
      fontSize: 18, fontFace: 'Calibri', color: C.amber,
      align: 'center', valign: 'middle', margin: 0,
    });

    slide.addText('让知识管理更智能，让学习更高效', {
      x: 1.5, y: 3.6, w: 7, h: 0.35,
      fontSize: 13, fontFace: 'Calibri', color: C.textMuted,
      align: 'center', valign: 'middle', margin: 0,
    });

    // Bottom
    slide.addText('学 · 问 · 练  三位一体', {
      x: 1.5, y: 4.6, w: 7, h: 0.3,
      fontSize: 11, fontFace: 'Calibri', color: C.textSubtle,
      align: 'center', valign: 'middle', margin: 0,
    });
  }

  // ════════════════════════════════════
  // Write
  // ════════════════════════════════════
  const outPath = 'MemoDeer_Intro.pptx';
  console.log(`Writing ${outPath}...`);
  await pres.writeFile({ fileName: outPath });
  console.log('Done!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
