const pptxgen = require('pptxgenjs');
const React = require('react');
const ReactDOMServer = require('react-dom/server');
const sharp = require('sharp');

// ═══════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════
const SLIDE_W = 10;
const SLIDE_H = 5.625;

const C = {
  darkBg: '141413',
  darkSurface: '1E1D1A',
  lightBg: 'FAF8F5',
  amber: 'D97706',
  amberLight: 'FDE68A',
  amberGlow: 'F59E0B',
  textOnDark: 'F5F0E8',
  textOnLight: '1C1917',
  mutedOnDark: 'A8A29E',
  mutedOnLight: '78716C',
  white: 'FFFFFF',
  teal: '0D9488',
  tealSurface: 'CCFBF1',
  amberSurface: 'FFFBEB',
  cardBorder: 'E7E5E2',
};

// ═══════════════════════════════════════════
// Icon rendering (inline SVGs — no react-icons dependency needed)
// ═══════════════════════════════════════════
const ICONS = {
  sparkle: `<svg xmlns="http://www.w3.org/2000/svg" width="SIZE" height="SIZE" viewBox="0 0 24 24" fill="none" stroke="COLOR" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5z"/><path d="M18 16l.5 2L20 18.5l-1.5.5-.5 2-.5-2L16 18.5l1.5-.5z"/><path d="M6 2l.3 1.2L7.5 3.5 6.3 3.8 6 5l-.3-1.2L4.5 3.5l1.2-.3z"/></svg>`,
  edit: `<svg xmlns="http://www.w3.org/2000/svg" width="SIZE" height="SIZE" viewBox="0 0 24 24" fill="none" stroke="COLOR" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>`,
  brain: `<svg xmlns="http://www.w3.org/2000/svg" width="SIZE" height="SIZE" viewBox="0 0 24 24" fill="none" stroke="COLOR" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4.5a2.5 2.5 0 0 0-4.96-.45 2.5 2.5 0 0 0-1.98 3.25A2.5 2.5 0 0 0 6 11.5a2.5 2.5 0 0 0 4.5 1.5"/><path d="M12 4.5a2.5 2.5 0 0 1 4.96-.45 2.5 2.5 0 0 1 1.98 3.25A2.5 2.5 0 0 1 18 11.5a2.5 2.5 0 0 1-4.5 1.5"/><path d="M12 19.5V13"/><path d="M9 17.5h6"/></svg>`,
  target: `<svg xmlns="http://www.w3.org/2000/svg" width="SIZE" height="SIZE" viewBox="0 0 24 24" fill="none" stroke="COLOR" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
  cpu: `<svg xmlns="http://www.w3.org/2000/svg" width="SIZE" height="SIZE" viewBox="0 0 24 24" fill="none" stroke="COLOR" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M15 2v2M15 20v2M9 2v2M9 20v2M2 15h2M2 9h2M20 15h2M20 9h2"/></svg>`,
  layers: `<svg xmlns="http://www.w3.org/2000/svg" width="SIZE" height="SIZE" viewBox="0 0 24 24" fill="none" stroke="COLOR" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 22 8.5 12 15 2 8.5"/><polyline points="2 15.5 12 22 22 15.5"/></svg>`,
  crown: `<svg xmlns="http://www.w3.org/2000/svg" width="SIZE" height="SIZE" viewBox="0 0 24 24" fill="none" stroke="COLOR" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7z"/><path d="M4 20h16"/></svg>`,
  cloud: `<svg xmlns="http://www.w3.org/2000/svg" width="SIZE" height="SIZE" viewBox="0 0 24 24" fill="none" stroke="COLOR" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>`,
  heart: `<svg xmlns="http://www.w3.org/2000/svg" width="SIZE" height="SIZE" viewBox="0 0 24 24" fill="none" stroke="COLOR" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.7 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21.3l7.8-7.8 1.1-1.1a5.5 5.5 0 0 0 0-7.8z"/></svg>`,
  search: `<svg xmlns="http://www.w3.org/2000/svg" width="SIZE" height="SIZE" viewBox="0 0 24 24" fill="none" stroke="COLOR" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`,
  zap: `<svg xmlns="http://www.w3.org/2000/svg" width="SIZE" height="SIZE" viewBox="0 0 24 24" fill="none" stroke="COLOR" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10"/></svg>`,
  database: `<svg xmlns="http://www.w3.org/2000/svg" width="SIZE" height="SIZE" viewBox="0 0 24 24" fill="none" stroke="COLOR" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>`,
  checkCircle: `<svg xmlns="http://www.w3.org/2000/svg" width="SIZE" height="SIZE" viewBox="0 0 24 24" fill="none" stroke="COLOR" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
};

async function renderIcon(name, colorHex, size = 200) {
  const svg = ICONS[name]
    .replace(/SIZE/g, String(size))
    .replace(/COLOR/g, `#${colorHex}`);
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return { data: `image/png;base64,${buf.toString('base64')}`, w: size / 72, h: size / 72 };
}

// ═══════════════════════════════════════════
// Background gradient image (warm dark with amber glow)
// ═══════════════════════════════════════════
async function createDarkBg() {
  const W = 2000, H = 1125;
  // Create dark base
  const base = await sharp({
    create: { width: W, height: H, channels: 4, background: { r: 20, g: 20, b: 19, alpha: 1 } }
  }).png().toBuffer();

  // Create warm amber glow circle (large, feathered via blur)
  const glowR = Math.round(Math.min(W, H) * 0.45);
  const glow = await sharp({
    create: { width: glowR * 2, height: glowR * 2, channels: 4, background: { r: 217, g: 119, b: 6, alpha: 0.12 } }
  })
    .blur(60)
    .png().toBuffer();

  const result = await sharp(base)
    .composite([{ input: glow, top: Math.round(H * 0.08), left: Math.round((W - glowR * 2) / 2) }])
    .png()
    .toBuffer();
  return `image/png;base64,${result.toString('base64')}`;
}

async function createLightBg() {
  const W = 2000, H = 1125;
  const base = await sharp({
    create: { width: W, height: H, channels: 4, background: { r: 250, g: 248, b: 245, alpha: 1 } }
  }).png().toBuffer();
  return `image/png;base64,${base.toString('base64')}`;
}

// ═══════════════════════════════════════════
// Helper: add a rounded rect card with text
// ═══════════════════════════════════════════
function addCard(slide, { x, y, w, h, fill, border, shadow, radius = 0.1 }) {
  const opts = {
    x, y, w, h, fill, rectRadius: radius,
    shadow: shadow || undefined,
  };
  if (border) {
    opts.line = { color: border, width: 1 };
  }
  slide.addShape('ROUNDED_RECTANGLE', opts);
}

function addPill(slide, { x, y, w, h, fill, text, fontSize = 9, fontFace = 'Calibri', color = C.white, bold = false }) {
  slide.addShape('ROUNDED_RECTANGLE', { x, y, w, h, fill, rectRadius: h / 2 });
  slide.addText(text, {
    x, y, w, h,
    fontSize, fontFace, color, bold, align: 'center', valign: 'middle', margin: 0,
  });
}

// ═══════════════════════════════════════════
// Helper: flow step box
// ═══════════════════════════════════════════
function addFlowStep(slide, { x, y, w, h, label, sub, fill, color, iconName }) {
  const r = 0.06;
  slide.addShape('ROUNDED_RECTANGLE', { x, y, w, h, fill, rectRadius: r });
  const hasIcon = iconName && iconName.length > 0;
  const iconW = hasIcon ? 0.28 : 0;
  // Small colored left accent dot
  slide.addShape('OVAL', { x: x + 0.08, y: y + h / 2 - 0.04, w: 0.08, h: 0.08, fill: color });
  slide.addText(label, {
    x: x + 0.22, y, w: w - 0.28, h,
    fontSize: 7.5, fontFace: 'Calibri', color, bold: true,
    align: 'left', valign: 'middle', margin: 0,
  });
}

function addFlowArrow(slide, x1, y1, x2, y2, color) {
  slide.addShape('LINE', {
    x: x1, y: y1, w: 0, h: y2 - y1,
    line: { color, width: 1.2, dashType: 'solid' },
    flipH: false, flipV: false,
  });
  // Arrow head triangle
  const arrowSize = 0.08;
  slide.addShape('TRIANGLE', {
    x: x2 - arrowSize / 2, y: y2 - arrowSize, w: arrowSize, h: arrowSize,
    fill: color, rotate: 180,
  });
}

// ═══════════════════════════════════════════
// Main
// ═══════════════════════════════════════════
async function main() {
  console.log('Creating backgrounds...');
  const darkBg = await createDarkBg();
  const lightBg = await createLightBg();

  console.log('Rendering icons...');
  const icons = {};
  for (const name of ['sparkle', 'edit', 'brain', 'target', 'cpu', 'layers', 'crown', 'cloud', 'heart', 'search', 'zap', 'database', 'checkCircle']) {
    icons[name] = await renderIcon(name, C.amber, 200);
  }
  const iconWhite = {};
  for (const name of ['sparkle', 'heart']) {
    iconWhite[name] = await renderIcon(name, C.textOnDark, 200);
  }
  const iconTeal = {};
  for (const name of ['cpu', 'target', 'search']) {
    iconTeal[name] = await renderIcon(name, C.teal, 200);
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
    slide.background = { data: darkBg };

    // Large decorative glow circles (top-right)
    slide.addShape('OVAL', {
      x: 6.5, y: -1.5, w: 5, h: 5,
      fill: { type: 'solid', color: C.amber, transparency: 92 },
    });
    slide.addShape('OVAL', {
      x: 7.2, y: -0.8, w: 3.5, h: 3.5,
      fill: { type: 'solid', color: C.amberGlow, transparency: 88 },
    });

    // Small decorative dots
    slide.addShape('OVAL', { x: 1.2, y: 1.0, w: 0.06, h: 0.06, fill: C.amber });
    slide.addShape('OVAL', { x: 1.6, y: 1.3, w: 0.04, h: 0.04, fill: C.amberGlow });
    slide.addShape('OVAL', { x: 8.5, y: 4.2, w: 0.05, h: 0.05, fill: C.amber });

    // Main title
    slide.addText('MemoDeer', {
      x: 0.8, y: 1.3, w: 8.4, h: 1.2,
      fontSize: 56, fontFace: 'Cambria', color: C.textOnDark, bold: true,
      align: 'left', margin: 0,
    });
    slide.addText('知道 AI 学习助手', {
      x: 0.8, y: 2.4, w: 8.4, h: 0.7,
      fontSize: 28, fontFace: 'Calibri', color: C.mutedOnDark,
      align: 'left', margin: 0,
    });

    // Tagline
    slide.addText('上传 · 理解 · 问答 · 出题  —  你的个人 AI 知识库', {
      x: 0.8, y: 3.2, w: 8.4, h: 0.5,
      fontSize: 14, fontFace: 'Calibri', color: C.amber,
      align: 'left', margin: 0,
    });

    // Bottom info
    slide.addText('AI-Powered Personal Knowledge Workspace', {
      x: 0.8, y: 4.5, w: 8.4, h: 0.4,
      fontSize: 11, fontFace: 'Calibri', color: C.mutedOnDark,
      align: 'left', margin: 0,
    });
    slide.addText('2026', {
      x: 8.5, y: 4.5, w: 1.0, h: 0.4,
      fontSize: 11, fontFace: 'Calibri', color: C.mutedOnDark,
      align: 'right', margin: 0,
    });
  }

  // ════════════════════════════════════
  // SLIDE 2: Pain Points & Solution
  // ════════════════════════════════════
  {
    const slide = pres.addSlide();
    slide.background = { data: lightBg };

    // Section title
    slide.addText('痛点与解决方案', {
      x: 0.6, y: 0.35, w: 5, h: 0.6,
      fontSize: 28, fontFace: 'Cambria', color: C.textOnLight, bold: true,
      align: 'left', margin: 0,
    });

    // Subtitle
    slide.addText('传统学习工具的三大困境', {
      x: 0.6, y: 0.85, w: 5, h: 0.35,
      fontSize: 12, fontFace: 'Calibri', color: C.mutedOnLight,
      align: 'left', margin: 0,
    });

    // Three pain point cards — horizontal row
    const cardW = 2.7;
    const cardH = 3.2;
    const cardY = 1.5;
    const gap = 0.25;
    const startX = 0.6;

    const painPoints = [
      {
        title: '知识管理碎片化',
        desc: 'PDF、笔记、教材分散在各处，\n无法集中管理和检索。\n想要修改 AI 处理后的内容？\n传统工具只能看，不能改。',
        icon: 'layers',
        color: C.amber,
        bg: C.amberSurface,
      },
      {
        title: 'AI 问答不可溯源',
        desc: '通用 AI 的回答没有依据，\n不知道信息来自哪里。\n你上传的文档知识，\nAI 无法精准定位回答。',
        icon: 'search',
        color: C.teal,
        bg: C.tealSurface,
      },
      {
        title: '学完无法检验效果',
        desc: '看完资料 ≠ 学会。\n缺少针对性练习和错题追踪，\n不知道薄弱点在哪里，\n无法形成学习闭环。',
        icon: 'target',
        color: C.amberDark,
        bg: 'FFF7ED',
      },
    ];

    painPoints.forEach((pp, i) => {
      const x = startX + i * (cardW + gap);
      addCard(slide, { x, y: cardY, w: cardW, h: cardH, fill: C.white, border: C.cardBorder, radius: 0.12 });

      // X mark for pain point
      slide.addText('✕', {
        x: x + 0.15, y: cardY + 0.15, w: 0.3, h: 0.3,
        fontSize: 14, fontFace: 'Calibri', color: 'EF4444', bold: true, align: 'center', margin: 0,
      });

      slide.addText(pp.title, {
        x: x + 0.2, y: cardY + 0.45, w: cardW - 0.4, h: 0.35,
        fontSize: 13, fontFace: 'Calibri', color: C.textOnLight, bold: true,
        align: 'left', margin: 0,
      });

      slide.addText(pp.desc, {
        x: x + 0.2, y: cardY + 0.9, w: cardW - 0.4, h: 1.8,
        fontSize: 10, fontFace: 'Calibri', color: C.mutedOnLight,
        align: 'left', valign: 'top', margin: 0,
        lineSpacingMultiple: 1.5,
      });

      // Colored bottom stripe on card
      slide.addShape('ROUNDED_RECTANGLE', {
        x: x + 0.15, y: cardY + cardH - 0.55, w: cardW - 0.3, h: 0.28,
        fill: pp.bg, rectRadius: 0.06,
      });
      slide.addText('痛点 ' + (i + 1), {
        x: x + 0.15, y: cardY + cardH - 0.55, w: cardW - 0.3, h: 0.28,
        fontSize: 8, fontFace: 'Calibri', color: pp.color, bold: true,
        align: 'center', valign: 'middle', margin: 0,
      });
    });

    // Bottom: MemoDeer solution
    const solY = 4.85;
    slide.addShape('ROUNDED_RECTANGLE', {
      x: 0.6, y: solY, w: 8.8, h: 0.55,
      fill: C.amberSurface, rectRadius: 0.1,
      line: { color: C.amber, width: 1 },
    });

    slide.addText('MemoDeer 的答案：像 Obsidian 一样编辑知识 + 像 NotebookLM 一样智能问答 + 自动出题巩固  →  学、问、练三合一', {
      x: 0.8, y: solY, w: 8.4, h: 0.55,
      fontSize: 12, fontFace: 'Calibri', color: C.amberDark, bold: true,
      align: 'center', valign: 'middle', margin: 0,
    });
  }

  // ════════════════════════════════════
  // SLIDE 3: System Architecture
  // ════════════════════════════════════
  {
    const slide = pres.addSlide();
    slide.background = { data: darkBg };

    // Title
    slide.addText('系统架构与技术栈', {
      x: 0.6, y: 0.25, w: 5, h: 0.5,
      fontSize: 26, fontFace: 'Cambria', color: C.textOnDark, bold: true,
      align: 'left', margin: 0,
    });
    slide.addText('两大核心 AI 管线', {
      x: 0.6, y: 0.65, w: 5, h: 0.3,
      fontSize: 11, fontFace: 'Calibri', color: C.mutedOnDark,
      align: 'left', margin: 0,
    });

    // === LEFT COLUMN: Q&A Pipeline ===
    const leftX = 0.5;
    const colW = 4.2;
    const colTop = 1.15;

    // Column label
    slide.addShape('ROUNDED_RECTANGLE', {
      x: leftX, y: colTop, w: colW, h: 0.36,
      fill: C.darkSurface, rectRadius: 0.06,
    });
    slide.addText('🔍 AI 智能问答管线 (RAG Q&A)', {
      x: leftX, y: colTop, w: colW, h: 0.36,
      fontSize: 10, fontFace: 'Calibri', color: C.amber, bold: true,
      align: 'center', valign: 'middle', margin: 0,
    });

    const qaSteps = [
      { label: '用户提问', color: C.textOnDark },
      { label: 'Embedding 向量化', sub: 'BGE-small-zh', color: C.teal },
      { label: 'ChromaDB 向量检索', sub: 'Top-8 + 关键词混合', color: C.teal },
      { label: 'RAG 上下文组装', sub: '过滤 + 排序 + 引用标注', color: C.mutedOnDark },
      { label: 'Pro LLM 推理生成', sub: 'DeepSeek-V4-Pro', color: C.amber },
      { label: '流式返回 + 引用', sub: 'SSE 实时输出 [1][2]', color: C.amber },
    ];

    const stepH = 0.38;
    const stepY0 = colTop + 0.52;
    const stepGap = 0.12;

    qaSteps.forEach((s, i) => {
      const y = stepY0 + i * (stepH + stepGap);
      addCard(slide, { x: leftX + 0.1, y, w: colW - 0.2, h: stepH, fill: C.darkSurface, radius: 0.06 });
      slide.addShape('OVAL', { x: leftX + 0.22, y: y + stepH / 2 - 0.04, w: 0.08, h: 0.08, fill: s.color });
      slide.addText(s.label, {
        x: leftX + 0.38, y, w: colW - 0.7, h: stepH,
        fontSize: 9, fontFace: 'Calibri', color: C.textOnDark, bold: true,
        align: 'left', valign: 'middle', margin: 0,
      });
      if (s.sub) {
        slide.addText(s.sub, {
          x: leftX + 1.7, y, w: colW - 2.0, h: stepH,
          fontSize: 7.5, fontFace: 'Calibri', color: C.mutedOnDark,
          align: 'right', valign: 'middle', margin: 0,
        });
      }
      // Arrow between steps
      if (i < qaSteps.length - 1) {
        slide.addShape('LINE', {
          x: leftX + colW / 2, y: y + stepH, w: 0, h: stepGap,
          line: { color: C.mutedOnDark, width: 0.8 },
        });
      }
    });

    // === RIGHT COLUMN: Knowledge Extraction + Quiz ===
    const rightX = 5.3;

    slide.addShape('ROUNDED_RECTANGLE', {
      x: rightX, y: colTop, w: colW, h: 0.36,
      fill: C.darkSurface, rectRadius: 0.06,
    });
    slide.addText('🧠 AI 知识点提取 + 出题管线', {
      x: rightX, y: colTop, w: colW, h: 0.36,
      fontSize: 10, fontFace: 'Calibri', color: C.amber, bold: true,
      align: 'center', valign: 'middle', margin: 0,
    });

    const kpSteps = [
      { label: '文档上传与解析', sub: 'PDF/DOCX/TXT/MD', color: C.textOnDark },
      { label: 'AI 格式化 Markdown', sub: 'Flash LLM · Obsidian 风格', color: C.amber },
      { label: '文本分块', sub: '500字/块 · 50字重叠', color: C.teal },
      { label: '向量化存储', sub: 'ChromaDB 嵌入索引', color: C.teal },
      { label: '知识点提取', sub: 'Flash LLM 结构化 JSON', color: C.amber },
      { label: '自动出题 + 错题本', sub: '选择题/填空题 · 错题追踪', color: C.amber },
    ];

    kpSteps.forEach((s, i) => {
      const y = stepY0 + i * (stepH + stepGap);
      addCard(slide, { x: rightX + 0.1, y, w: colW - 0.2, h: stepH, fill: C.darkSurface, radius: 0.06 });
      slide.addShape('OVAL', { x: rightX + 0.22, y: y + stepH / 2 - 0.04, w: 0.08, h: 0.08, fill: s.color });
      slide.addText(s.label, {
        x: rightX + 0.38, y, w: colW - 0.7, h: stepH,
        fontSize: 9, fontFace: 'Calibri', color: C.textOnDark, bold: true,
        align: 'left', valign: 'middle', margin: 0,
      });
      if (s.sub) {
        slide.addText(s.sub, {
          x: rightX + 1.7, y, w: colW - 2.0, h: stepH,
          fontSize: 7.5, fontFace: 'Calibri', color: C.mutedOnDark,
          align: 'right', valign: 'middle', margin: 0,
        });
      }
      if (i < kpSteps.length - 1) {
        slide.addShape('LINE', {
          x: rightX + colW / 2, y: y + stepH, w: 0, h: stepGap,
          line: { color: C.mutedOnDark, width: 0.8 },
        });
      }
    });

    // === Bottom: Tech Stack Pills ===
    const techY = 4.8;
    slide.addText('技术栈', {
      x: 0.6, y: techY, w: 0.8, h: 0.35,
      fontSize: 9, fontFace: 'Calibri', color: C.mutedOnDark,
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
      { name: 'BGE Emb.', color: C.amber },
    ];

    let pillX = 1.5;
    techs.forEach((t) => {
      const pillW = t.name.length * 0.07 + 0.3;
      addPill(slide, {
        x: pillX, y: techY + 0.02, w: pillW, h: 0.28,
        fill: t.color, text: t.name, fontSize: 7.5, color: C.white,
      });
      pillX += pillW + 0.1;
    });
  }

  // ════════════════════════════════════
  // SLIDE 4: Business Model
  // ════════════════════════════════════
  {
    const slide = pres.addSlide();
    slide.background = { data: lightBg };

    slide.addText('商业模式', {
      x: 0.6, y: 0.3, w: 5, h: 0.55,
      fontSize: 28, fontFace: 'Cambria', color: C.textOnLight, bold: true,
      align: 'left', margin: 0,
    });
    slide.addText('会员制解锁 AI 高级功能 + 云空间扩展', {
      x: 0.6, y: 0.75, w: 5, h: 0.3,
      fontSize: 12, fontFace: 'Calibri', color: C.mutedOnLight,
      align: 'left', margin: 0,
    });

    // Three membership cards
    const mCardW = 2.7;
    const mCardH = 3.3;
    const mCardY = 1.3;
    const mGap = 0.3;
    const mStartX = 0.6;

    const tiers = [
      {
        name: '免费版', price: '¥0', period: '永久',
        desc: '基础功能体验',
        features: [
          '3 个笔记本',
          '每笔记本 5 个文档',
          '每日 10 次对话',
          '基础文档上传与管理',
          '全文语义搜索',
          'Markdown 编辑器',
        ],
        highlight: false,
        color: C.mutedOnLight,
        border: C.cardBorder,
        bg: C.white,
        btnBg: 'F5F5F4',
        btnText: C.mutedOnLight,
      },
      {
        name: '月度会员', price: '¥19.9', period: '/ 月',
        desc: '解锁全部 AI 功能',
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
        color: C.amber,
        border: C.amber,
        bg: C.amberSurface,
        btnBg: C.amber,
        btnText: C.white,
      },
      {
        name: '终身会员', price: '¥299', period: '买断制',
        desc: '一次付费，永久使用',
        features: [
          '月度会员全部功能',
          '永久有效，无需续费',
          '专属身份标识',
          '优先客服支持',
          '未来所有功能更新',
          '适合重度学习用户',
        ],
        highlight: false,
        color: C.amberDark,
        border: C.amberDark,
        bg: C.white,
        btnBg: C.amberDark,
        btnText: C.white,
      },
    ];

    tiers.forEach((t, i) => {
      const x = mStartX + i * (mCardW + mGap);

      // Card background
      slide.addShape('ROUNDED_RECTANGLE', {
        x, y: mCardY, w: mCardW, h: mCardH,
        fill: t.bg, rectRadius: 0.15,
        line: { color: t.border, width: t.highlight ? 2 : 0.8 },
      });

      // "推荐" badge for highlighted tier
      if (t.highlight) {
        slide.addShape('ROUNDED_RECTANGLE', {
          x: x + mCardW / 2 - 0.45, y: mCardY - 0.15, w: 0.9, h: 0.3,
          fill: C.amber, rectRadius: 0.15,
        });
        slide.addText('🔥 推荐', {
          x: x + mCardW / 2 - 0.45, y: mCardY - 0.15, w: 0.9, h: 0.3,
          fontSize: 9, fontFace: 'Calibri', color: C.white, bold: true,
          align: 'center', valign: 'middle', margin: 0,
        });
      }

      // Tier name
      slide.addText(t.name, {
        x: x + 0.25, y: mCardY + 0.2, w: mCardW - 0.5, h: 0.3,
        fontSize: 14, fontFace: 'Calibri', color: t.color, bold: true,
        align: 'left', margin: 0,
      });

      // Price
      slide.addText(t.price, {
        x: x + 0.25, y: mCardY + 0.5, w: mCardW - 1.3, h: 0.55,
        fontSize: 32, fontFace: 'Cambria', color: C.textOnLight, bold: true,
        align: 'left', margin: 0,
      });
      slide.addText(t.period, {
        x: x + mCardW - 0.85, y: mCardY + 0.72, w: 0.6, h: 0.25,
        fontSize: 9, fontFace: 'Calibri', color: C.mutedOnLight,
        align: 'left', margin: 0,
      });

      slide.addText(t.desc, {
        x: x + 0.25, y: mCardY + 1.05, w: mCardW - 0.5, h: 0.2,
        fontSize: 9, fontFace: 'Calibri', color: C.mutedOnLight,
        align: 'left', margin: 0,
      });

      // Divider line
      slide.addShape('LINE', {
        x: x + 0.25, y: mCardY + 1.3, w: mCardW - 0.5, h: 0,
        line: { color: t.border, width: 0.5 },
      });

      // Feature list
      const featureY = mCardY + 1.4;
      t.features.forEach((f, fi) => {
        slide.addText('✓  ' + f, {
          x: x + 0.25, y: featureY + fi * 0.22, w: mCardW - 0.5, h: 0.2,
          fontSize: 7.5, fontFace: 'Calibri', color: C.textOnLight,
          align: 'left', valign: 'middle', margin: 0,
        });
      });
    });

    // === Cloud Storage Upsell Section ===
    const cloudY = 4.85;
    slide.addShape('ROUNDED_RECTANGLE', {
      x: 0.6, y: cloudY, w: 8.8, h: 0.55,
      fill: C.white, rectRadius: 0.1,
      line: { color: C.teal, width: 1 },
    });

    slide.addText('☁️  云空间扩展', {
      x: 0.8, y: cloudY, w: 1.8, h: 0.55,
      fontSize: 12, fontFace: 'Calibri', color: C.teal, bold: true,
      align: 'left', valign: 'middle', margin: 0,
    });
    slide.addText('MemoDeer 本质是云笔记本 — 用户的知识资产持续增长。未来提供云存储套餐，按容量付费，让知识库随身携带、跨设备同步。', {
      x: 2.8, y: cloudY, w: 6.4, h: 0.55,
      fontSize: 10, fontFace: 'Calibri', color: C.mutedOnLight,
      align: 'left', valign: 'middle', margin: 0,
    });
  }

  // ════════════════════════════════════
  // SLIDE 5: Thank You
  // ════════════════════════════════════
  {
    const slide = pres.addSlide();
    slide.background = { data: darkBg };

    // Decorative glow (center)
    slide.addShape('OVAL', {
      x: 2.5, y: 0.5, w: 5, h: 5,
      fill: { type: 'solid', color: C.amber, transparency: 93 },
    });
    slide.addShape('OVAL', {
      x: 3.5, y: 1.3, w: 3, h: 3,
      fill: { type: 'solid', color: C.amberGlow, transparency: 90 },
    });

    // Small decorative dots
    slide.addShape('OVAL', { x: 1.5, y: 1.0, w: 0.05, h: 0.05, fill: C.amber });
    slide.addShape('OVAL', { x: 8.3, y: 1.5, w: 0.04, h: 0.04, fill: C.amberGlow });
    slide.addShape('OVAL', { x: 2.0, y: 4.2, w: 0.06, h: 0.06, fill: C.amber });
    slide.addShape('OVAL', { x: 7.8, y: 4.5, w: 0.05, h: 0.05, fill: C.amberGlow });

    // Thank you text
    slide.addText('感谢聆听', {
      x: 1.5, y: 1.8, w: 7, h: 1.0,
      fontSize: 48, fontFace: 'Cambria', color: C.textOnDark, bold: true,
      align: 'center', valign: 'middle', margin: 0,
    });

    slide.addText('MemoDeer · 知道 AI 学习助手', {
      x: 1.5, y: 2.8, w: 7, h: 0.5,
      fontSize: 18, fontFace: 'Calibri', color: C.amber,
      align: 'center', valign: 'middle', margin: 0,
    });

    slide.addText('让知识管理更智能，让学习更高效', {
      x: 1.5, y: 3.3, w: 7, h: 0.4,
      fontSize: 13, fontFace: 'Calibri', color: C.mutedOnDark,
      align: 'center', valign: 'middle', margin: 0,
    });

    // Bottom
    slide.addText('学 · 问 · 练  三位一体', {
      x: 1.5, y: 4.5, w: 7, h: 0.35,
      fontSize: 11, fontFace: 'Calibri', color: C.mutedOnDark,
      align: 'center', valign: 'middle', margin: 0,
    });
  }

  // ════════════════════════════════════
  // Write & Validate
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
