# MemoDeer（知道AI学习助手）完整产品文档

---

## 一、产品概述

### 1.1 产品定位

MemoDeer（知道AI学习助手）是一套面向中学生与大学生的 AI 学习助手。用户上传知识文档（PDF/DOCX/TXT/MD），系统自动提取结构化知识，并提供基于 RAG 的检索增强问答（含引用标注）、语义搜索和 AI 生成答案——所有答案都基于用户个人知识库。

一句话定位：**上传 · 理解 · 问答 · 出题 — 你的个人 AI 知识库**。

产品本质上是「像 Obsidian 一样编辑知识 + 像 NotebookLM 一样智能问答 + 自动出题巩固」，实现学、问、练三位一体。

### 1.2 目标用户

大学生、考研、考公等独立备考者。典型用户画像：独自学习、缺乏即时反馈和练习素材，以手机/电脑学习场景为主。

### 1.3 核心痛点

1. **知识管理碎片化**：PDF、笔记、教材分散在各处，无法集中管理和检索。传统工具只能看、不能改。
2. **AI 问答不可溯源**：通用 AI 的回答没有依据，不知道信息来自哪里。用户上传的文档知识，AI 无法精准定位回答。
3. **学完无法检验效果**：看完资料不等于学会。缺少针对性练习和错题追踪，不知道薄弱点在哪里，无法形成学习闭环。

---

## 二、功能需求

### 2.1 已实现功能

#### 知识库构建

- 上传 PDF/DOCX/TXT/MD 文档 → AI（DeepSeek V4-Flash）自动格式化为规范 Markdown → 智能分块（500字/块，50字重叠）→ 向量化入库（BGE-small-zh 512维）
- 支持手动创建/编辑 Markdown 笔记
- 文档全文查看：连续 Markdown 渲染，支持引用链接跳转并高亮定位到对应段落
- 笔记管理：文档和笔记的查看、创建、删除（级联清理向量库）

#### 智能问答（两种模式）

- **自动模式（RAG优先）**：系统始终优先从个人知识库检索相关内容，找到时标注引用来源 [1][2]；找不到时自动降级为通用知识回答并注明「非来自笔记」
- **开放模式**：基于通用知识自由回答
- 混合检索：向量相似度 + SQLite LIKE 关键词匹配，去重合并，以 `RAG_DISTANCE_THRESHOLD=0.85` 过滤
- SSE 流式输出，实时响应
- 用户可将回答编辑后保存为笔记

#### GenUI 知识可视化

AI 回答中可生成交互式知识组件，支持五种类型：

- 概念卡片（concept-card）：核心概念的正反面展示
- 关键要点（key-points）：结构化要点列表
- 对比表格（comparison）：维度对比分析
- 步骤指南（steps）：操作步骤的分步展示
- 示例框（example-box）：概念示例说明

#### 算法交互式可视化

当用户提问涉及排序、搜索、图、动态规划、树、字符串匹配等算法时，AI 输出 `algo-viz` JSON 代码块，前端 `AlgoVisualizer` 组件渲染为交互动画，支持播放/暂停/重置/逐步控制。

支持的算法：冒泡/选择/插入/快速/归并/堆/希尔排序、二分/线性搜索、BFS/DFS、Dijkstra、背包 DP 等。

#### 全文搜索

跨所有笔记本全局检索，query → embedding → ChromaDB 搜索 → 结果按笔记本分组展开，含文档名和相关度评分。

#### 文件树管理

VSCode 风格的文件树，递归展开/折叠、内联重命名、拖拽移动、右键操作菜单（重命名/移动/删除），支持搜索过滤。

#### Markdown 编辑器

双模式（预览/编辑）切换，行号同步，Ctrl+S 保存，字数/字符计数。

### 2.2 规划中功能

- **智能出题**：基于知识点一键生成选择题、填空题，配套答案解析，错题本追踪
- **知识卡片**：AI 生成正反面翻转卡片（概念 + 详细解释），支持标签筛选
- **记忆口诀**：AI 将难记知识点编成朗朗上口的韵律口诀，配助记提示
- **学习计划与进度追踪**：AI 根据知识掌握情况制定个性化学习路径
- **知识图谱可视化**：知识点关联关系图谱展示

---

## 三、用户体系设计

### 3.1 三层会员体系

| 层级 | 价格 | 核心权益 |
|------|------|---------|
| **免费版** | ¥0 | 3 个笔记本；每笔记本 5 个文档；每日 10 次对话；基础上传管理；全文语义搜索；Markdown 编辑器 |
| **月度会员** | ¥19.9/月 | 无限笔记本与文档；无限 AI 对话次数；AI 知识点智能提取；AI 记忆卡片生成；AI 口诀助记生成；智能出题 + 错题本；优先体验新功能 |
| **终身会员** | ¥299 买断 | 月度会员全部功能；永久有效无需续费；专属身份标识；优先客服支持；未来所有功能更新 |

月度会员使用 30 天自动续费逻辑（可叠加），系统在每次请求时运行 `check_premium_status()` 自动将过期月度会员降级为免费。

### 3.2 免费用户限制

在 `config.py` 中配置并在 notebooks 路由中强制执行：

- 最多 3 个笔记本
- 每个笔记本最多 5 个文档
- 每日 10 条聊天消息

### 3.3 认证与鉴权

- **认证方式**：JWT（HS256），7 天有效期
- **密码存储**：bcrypt 哈希（passlib）
- **鉴权依赖**：
  - `get_current_user`：解析 JWT，注入当前 `User` 对象，所有数据查询按 `user_id` 过滤
  - `require_premium`：包装 `get_current_user`，免费用户返回 403
- **前端状态**：`authStore`（Zustand + localStorage），存储 JWT token、用户信息、会员状态。登出时自动调用 `queryClient.clear()` 清除 React Query 缓存，防止切换用户时数据闪现。

### 3.4 支付流程（模拟）

三层会员体系：免费 / 月度（¥19.9，30天自动续费） / 终身（¥299，永久）。

支付流程：`POST /api/payment/orders` 创建订单 → `POST /api/payment/orders/{id}/pay` 模拟支付 → 用户升级 + 订单标记已支付。支付订单历史在 `GET /api/payment/orders` 查看。

### 3.5 数据隔离

所有数据查询均按 `user_id` 过滤。10 个 ORM 模型全部关联 User：`User`、`Notebook`、`Folder`、`Document`、`Chunk`、`ChatSession`、`ChatMessage`、`PaymentOrder`、`KnowledgePoint`、`QuizAttempt`。所有主键为 uuid4 十六进制字符串。

---

## 四、系统架构与技术选型

### 4.1 两层架构

| 层 | 技术栈 |
|----|--------|
| **前端** | React 18 + TypeScript + Vite 5 + Tailwind CSS 3 + Zustand + React Query |
| **后端** | Python FastAPI + SQLAlchemy 2（异步）+ SQLite + ChromaDB |

前端通过 Zustand 管理认证/UI 状态，React Query 管理服务端状态（retry 1, staleTime 30s）。Vite 在开发环境代理 `/api` 请求到 `http://localhost:8000`。

### 4.2 后端分层架构

| 层 | 位置 | 说明 |
|----|------|------|
| API 路由 | `api/` | 9 个路由文件：auth、notebooks、documents、folders、chat（SSE）、search、quiz、premium、payment |
| Core | `core/` | database.py（异步引擎 + 自迁移）、models.py（10 个 ORM 模型）、schemas.py（Pydantic 请求/响应） |
| 服务 | `services/` | 6 个单例服务：llm_service、embedding_service、vector_store、rag_service、parser_service、chunking_service |
| 工具 | `utils/exceptions.py` | 自定义 `AppException` 层次结构 |

### 4.3 三层 LLM 模型架构

| 层级 | 属性 | 模型配置 | 温度 | 用途 |
|------|------|---------|------|------|
| Flash | `.flash` | `LLM_FLASH_MODEL`（默认 `deepseek-v4-flash`） | 0.3 | 轻量 NLU：知识提取、文档格式化、出题、知识卡片和口诀。可通过 `use_local_for_flash()` 切换为本地 8B（Ollama） |
| Pro | `.pro` | `LLM_PRO_MODEL`（默认 `deepseek-v4-pro`） | 0.7 | 强推理：RAG 问答含引用、复杂逻辑问题 |
| Local | `.local` | `LLM_LOCAL_MODEL`（默认 `qwen3:8b`） | — | 预留给本地 Ollama 8B 模型。设置 `LLM_LOCAL_BASE_URL=http://localhost:11434/v1` 激活。可替代 Flash 以节省 NLU 任务的 API 费用 |

所有提供者通过 `OpenAICompatibleProvider`（OpenAI SDK）实现 `BaseLLMProvider` 抽象类，支持 DeepSeek API 和本地 Ollama 的统一接口。Flash 和 Pro 模型 ID 可在 `.env` 中独立配置。

> 注意：`deepseek-chat` / `deepseek-reasoner` 已弃用（2026-07-24 停用），新配置中不应使用。

### 4.4 技术栈总览

| 类别 | 技术 | 说明 |
|------|------|------|
| 前端框架 | React 18 + TypeScript | SPA |
| 构建工具 | Vite 5 | 快速 HMR |
| CSS | Tailwind CSS 3 | 自定义设计系统（CSS 变量） |
| 状态管理 | Zustand + React Query | 客户端 + 服务端状态分离 |
| 后端框架 | FastAPI | 异步 Python |
| ORM | SQLAlchemy 2（异步） | aiosqlite |
| 数据库 | SQLite | 嵌入式，零配置 |
| 向量数据库 | ChromaDB | 嵌入式，每笔记本独立 Collection |
| LLM | DeepSeek V4-Pro / V4-Flash | API 调用 |
| Embedding | BAAI/bge-small-zh-v1.5 | 本地 CPU 推理，512 维 |
| 文件解析 | PyMuPDF（PDF）、python-docx（DOCX） | — |
| 认证 | JWT HS256 + bcrypt | 7 天过期 |

### 4.5 关键数据流

#### 文档上传流水线

```
文件上传 → 保存磁盘 → parser_service.extract_text() → _reformat_text_to_markdown()
（Flash LLM，分批处理，~8000字符/批，最大50000字符，Obsidian风格）
→ chunking_service.split_text() → embedding_service.embed() → ChromaDB 添加 + SQLite chunks
→ Flash LLM 提取知识点（结构化JSON）
```

#### 智能问答流水线（自动模式，混合检索）

```
用户提问 → embedding → ChromaDB 向量搜索 top-8
→ SQLite LIKE 关键词搜索（滑动窗口 2–4 字符子串，按匹配长度加权）
→ 合并 + 去重 + 按分数排序 → RAG_DISTANCE_THRESHOLD=0.85 过滤
→ 若找到结果：构建带 [1],[2] 引用的 prompt → Pro LLM 流式回答（source="rag"）→ SSE
→ 若无结果：降级为 Pro LLM 开放知识回答并附免责声明（source="open"）→ SSE
```

#### 文档编辑 → 重新向量化

```
用户编辑 Markdown → PUT /documents/{id}/content → 设置 needs_revectorize=1
→ PendingVectorizeBar 显示计数 → 用户点击"一键向量化"
→ POST /documents/{id}/re-vectorize → 删除旧 chunks + vectors → 重新分块 + 嵌入 → 清除标记
```

### 4.6 模型选型与成本分析

#### 实际落地架构（vs 规划架构）

| 层级 | 规划 | 实际落地 | 差异原因 |
|------|------|---------|---------|
| Embedding | 未单独讨论 | BAAI/bge-small-zh-v1.5（本地 CPU） | 独立于 LLM 的专用向量模型，512 维，~95MB，零成本本地推理 |
| RAG 检索（LLM） | 本地 Qwen3-8B | 暂未部署 | 无 GPU 资源；当前使用 BGE 向量检索替代 |
| 文档格式化 + 知识提取（NLU） | V4-Flash（长文档兜底） | V4-Flash（主力 NLU） | Flash 承担了原计划中 Qwen3-8B 的知识提取任务 |
| 推理生成（问答） | V4-Pro | V4-Pro | 一致 |

#### 为何暂未部署本地 Qwen3-8B

1. **无 GPU 资源**：RTX 4090（24GB）或同等 GPU 未到位，CPU 推理 8B 模型延迟不可接受
2. **BGE 向量模型已满足 RAG 检索需求**：语义搜索和检索由专用 Embedding 模型完成，无需 LLM 参与
3. **V4-Flash API 成本可控**：初期用户量小，Flash API 月费用远低于 GPU 租用费
4. **接口已预留**：`llm_service.local` 已实现 Ollama 兼容接口，`.env` 中设置 `LLM_LOCAL_BASE_URL` 即可激活

#### 成本预估（单用户 / 月，开发测试阶段）

| 场景 | 估算 |
|------|------|
| 月上传文档 | 10–20 篇（平均 5000 字/篇） |
| 月提问次数 | 100–200 次 |
| Flash 调用（格式化 + 知识点提取） | ~80,000 tokens/月 |
| Pro 调用（问答） | ~200,000 tokens/月 |
| **总计 API 费用** | **< 2 元/月**（缓存命中情况下 < 0.5 元） |

#### 规模化成本预估（100 DAU）

| 场景 | RAG 成本 | 推理成本 | GPU 成本 | 总月成本 |
|------|---------|---------|---------|---------|
| 50% 缓存 + 自有 GPU | 7 元 | 257 元 | 0 元 | **264 元** |
| 无缓存 + 自有 GPU | 7 元 | 510 元 | 0 元 | **517 元** |
| 50% 缓存 + 云 GPU | 7 元 | 257 元 | 800 元 | **1,064 元** |

#### 未来迁移路径

```
当前架构                          目标架构
─────────                        ─────────
BGE (embedding)     ──→         BGE (embedding)          [不变]
V4-Flash (NLU)      ──→         Qwen3-8B 本地 (NLU)      [省 API 费]
V4-Flash (长文档)    ──→         V4-Flash (长文档兜底)     [保留]
V4-Pro (推理)       ──→         V4-Pro (推理)            [不变]
```

切换方式：`llm_service.use_local_for_flash()` 即可将 Flash 切换到本地 Ollama 8B。

### 4.7 前端设计系统

#### 路由

- 公开路由：`/login`、`/register`
- 受保护布局（Layout 包装，含抽屉导航 + `<Outlet/>`）：
  - `/`：首页（笔记本列表）
  - `/notebook/:id`：笔记本页（VSCode 风格文件树 + 四选项卡内容）
  - `/notebook/:id/chat/:sid?`：对话页（SSE 流式聊天）
  - `/notebook/:id/quiz`：出题页
  - `/membership`：会员页
  - `/about`：关于页
  - `/profile`：个人资料页
  - `/settings`：设置页
- 独立路由：`/document/:docId/view`：文档查看页（Markdown + 高亮）

#### 组件层级

- **聊天**：`ChatPanel` — 可复用 SSE 流式聊天，含行内引用渲染、GenUI 代码块检测、HTML 沙箱预览、「添加到笔记」按钮
- **文件树**：`FileTree`（可搜索容器）、`FileTreeNode`（递归展开/折叠、内联重命名、拖拽）、`FileContextMenu`（右键操作）
- **编辑器**：`MarkdownEditor` — 双模式预览/编辑，行号同步，Ctrl+S 保存，字数/字符计数
- **通用**：`AlgoVisualizer`（算法交互式可视化）、`GenUI`、`GlobalSearchModal`（Ctrl+K，跨笔记本搜索）、`SelectionAsk`（文本选择 → 询问 AI）、`KnowledgePanel`（卡片 + 口诀 CRUD）、`KnowledgeCards`、`MnemonicsList`、`ObsidianMarkdown`（wikilinks、callout、高亮）、`PendingVectorizeBar`、`PremiumGate`、`Modal`、`PageTransition`、`Skeleton`、`Toast`、`AntlerLogo`
- **布局**：`Layout`、`SideDrawer`、`PageHeader`（统一返回箭头 + 标题 + 滚动阴影）

#### 色彩主题系统

`uiStore` 支持 5 种色彩主题（`blue` / `purple` / `orange` / `green` / `pink`）和 3 种主题模式（`light` / `dark` / `system`），全部持久化到 localStorage。色彩主题通过 `document.documentElement.dataset.theme` 应用；主题模式通过 `dataset.themeMode` 应用。

Tailwind 使用 CSS 变量进行主题化，具有广泛的自定义设计系统：自定义 primary/surface/accent/danger 颜色比例（CSS 自定义属性），字体家族（IBM Plex Sans + Noto Sans SC 用于正文，Crimson Text 用于展示），动画令牌（fade-in、fade-in-up、page-enter、pop-in、toast-in、modal-sheet，含交错延迟），以及 5 种自定义缓动曲线（out、in-out、spring、bounce、smooth）。

---

## 五、Agent 详细设计

### 5.1 设计背景

当前 MemoDeer 的 AI 能力采用**直接调用 LLM API** 的模式（三层模型架构：Flash / Pro / Local），所有业务逻辑硬编码在 `rag_service.py` 等后端服务中。若要将 AI 替换为**智能体（Agent）架构**，需要将每个 AI 能力拆解为独立的 Skill（技能），由智能体框架统一调度。

### 5.2 Skill 清单（10 个）

| # | Skill | 模型 | 状态 | 会员 |
|---|-------|------|------|------|
| 1 | Document Formatter（文档格式化） | Flash | ✅ 已实现 | — |
| 2 | Knowledge Extractor（知识提取） | Pro | ✅ 已实现 | — |
| 3 | RAG Q&A（RAG 问答） | Pro | ✅ 已实现 | — |
| 4 | Open Q&A（开放问答） | Pro | ✅ 已实现 | — |
| 5 | Notebook Summarizer（笔记本总结） | Flash | ✅ 已实现 | — |
| 6 | Quiz Generator（出题） | Pro | 🟡 Mock | 高级 |
| 7 | Knowledge Card Generator（知识卡片） | Pro | 🟡 Mock | 高级 |
| 8 | Mnemonic Generator（记忆口诀） | Pro | 🟡 Mock | 高级 |
| 9 | GenUI Visualizer（可视化生成） | Pro | ✅ 嵌入问答 | — |
| 10 | Semantic Search（语义搜索） | none（embedding） | ✅ 已实现 | — |

### 5.3 各 Skill 详细规格

#### Skill 1：Document Formatter（文档格式化）

- **当前实现**：`rag_service.py:_reformat_text_to_markdown()`
- **模型**：Flash
- **输入**：原始提取文本（PDF/DOCX/TXT/MD 解析后的杂乱文本）
- **输出**：结构化 Markdown（Obsidian 风格：YAML frontmatter、`[[wikilinks]]`、`> [!callout]` 块、`==高亮==`、表格、规范标题）
- **约束**：分批处理（每批 8000 字符），总 50000 字符上限；失败降级为原始文本；不足 50 字符跳过格式化

#### Skill 2：Knowledge Extractor（知识提取）

- **当前实现**：`rag_service.py:extract_knowledge_points()`
- **模型**：Pro
- **输入**：笔记本所有已处理文档的 chunk 合集（最多 30000 字符）
- **输出**：`KnowledgePoint[]`（含 title、content、tags 的结构化 JSON），5–15 个核心知识点，按重要程度排序
- **约束**：每次调用删除旧知识点并全量重建；输出纯 JSON；避免重复

#### Skill 3：RAG Q&A（RAG 问答）

- **当前实现**：`rag_service.py:stream_answer()`
- **模型**：Pro
- **输入**：用户问题 + 检索到的上下文 chunks（Top-8，含文档名和内容）+ 对话历史
- **输出**：SSE 流式逐 token 回答 + 引用标注 [1][2] + 📚 参考文档列表
- **约束**：每个观点必须标注引用；上下文不足时诚实告知「无法确定」；可输出 `genui` 和 `algo-viz` 代码块

#### Skill 4：Open Q&A（开放问答 / 降级）

- **当前实现**：`rag_service.py:stream_answer_open()` + `stream_answer_fallback()`
- **模型**：Pro
- **输入**：用户问题（无上下文），模式标记（manual 用户主动选择 / fallback RAG 无结果自动降级）
- **输出**：SSE 流式回答；降级模式时开头附带 📌 免责声明
- **约束**：降级时自动添加「以下回答来自通用知识，非你的个人笔记，请注意核实」

#### Skill 5：Notebook Summarizer（笔记本总结）

- **当前实现**：`rag_service.py:stream_notebook_summary()`
- **模型**：Flash
- **输入**：笔记本所有已完成文档的全部 chunks（最多 40000 字符）
- **输出**：SSE 流式 ~300 字中文摘要
- **约束**：严格控制在 300 字左右；综合所有文档；自动创建新 ChatSession 作为对话起点

#### Skill 6：Quiz Generator（出题）🟡

- **当前实现**：`quiz.py:generate_quiz()` — V1 返回 mock，LLM 接入待实现
- **模型**：Pro
- **输入**：知识库内容 + 题型选择（选择题/填空题/混合）+ 题目数量（3–10）+ 难度
- **输出**：`QuizQuestion[]`（含题目、选项、正确答案、详细解析）
- **约束**：题目必须基于提供的知识库内容；不能出知识库中不存在的知识点；解析需引用具体来源文档

#### Skill 7：Knowledge Card Generator（知识卡片）🟡

- **当前实现**：`premium.py:generate_premium_content()` — V1 返回 mock
- **模型**：Pro
- **输入**：知识库中的知识点（可复用 Knowledge Extractor 输出）
- **输出**：翻转卡片数组（正面：概念名 + 简短定义；背面：详细解释 + 要点；含标签）
- **存储格式**：`KnowledgePoint.content` 存储为 `**{front}**\n\n{back}` 格式

#### Skill 8：Mnemonic Generator（记忆口诀）🟡

- **当前实现**：`premium.py:generate_premium_content()` — 同卡片 API，V1 返回 mock
- **模型**：Pro
- **输入**：知识库中的知识点
- **输出**：`MnemonicItem[]`（含口诀内容、来源文档、助记提示）
- **约束**：口诀需朗朗上口，有节奏感；与知识库内容严格对应

#### Skill 9：GenUI Visualizer（可视化生成）

- **当前实现**：嵌入 RAG Q&A / Open Q&A 的 system prompt 中，通过 ` ```genui ` 代码块实现
- **模型**：Pro（作为 RAG/Open Q&A 的一部分）
- **输入**：需要可视化的知识点
- **输出**：交互式 HTML 组件（概念卡片 / 关键要点 / 对比表格 / 步骤指南 / 示例框）
- **约束**：每次回答使用 1–3 个可视化组件；HTML 代码自包含；class 限用 card/tag/highlight/step/step-num

#### Skill 10：Semantic Search（语义搜索）

- **当前实现**：`rag_service.py:search_notebook()` / `search_all_notebooks()`
- **模型**：无 LLM（纯 Embedding 检索）
- **输入**：查询文本 + 可选 notebook_id
- **输出**：排序后的相关 chunks（含文档名、分数、来源标记 "vector" / "keyword"）
- **机制**：向量相似度 + SQLite LIKE 关键词匹配，去重合并

### 5.4 Skill 依赖关系

```
                    ┌──────────────────────┐
                    │   Semantic Search    │
                    │   (embedding 检索)    │
                    └──────────┬───────────┘
                               │ 检索结果
                               ▼
┌─────────────────┐   ┌───────────────┐   ┌─────────────────┐
│ Document         │   │  RAG Q&A      │   │  Open Q&A       │
│ Formatter        │   │  (Pro)        │   │  (Pro)          │
│ (Flash)          │   └───────┬───────┘   └────────┬────────┘
└────────┬─────────┘           │                    │
         │                     │ GenUI Visualizer   │
         │                     │ (嵌入在回答中)      │
         │                     └────────┬───────────┘
         ▼                              │
┌─────────────────┐                     │ 结构化知识点
│  Knowledge       │◄────────────────────┘
│  Extractor      │
│  (Pro)          │
└────────┬────────┘
         │ 知识点列表
         ├────────────┐
         ▼            ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────────┐
│ Quiz         │  │ Knowledge   │  │ Mnemonic        │
│ Generator    │  │ Card Gen    │  │ Generator       │
│ (Pro) 🟡     │  │ (Pro) 🟡    │  │ (Pro) 🟡         │
└─────────────┘  └─────────────┘  └─────────────────┘

┌─────────────────┐
│ Notebook         │
│ Summarizer      │
│ (Flash)         │
└─────────────────┘
```

### 5.5 迁移策略：从直调 LLM 到 Agent 架构

#### 当前架构

```
用户请求 → FastAPI Route → 硬编码调用 rag_service.xxx() → LLM API
```

#### Phase 1：Skill Registry（推荐立即实施）

不引入任何 Agent 框架，仅在现有 FastAPI 中新增一层 **Skill Registry**，将每个 AI 能力封装为统一接口的可调用单元。

```
用户请求 → FastAPI Route → SkillRegistry.get("rag-qa").execute(params)
                                   ↓
                             Skill 基类（统一接口）
                             ├── validate_input(schema)
                             ├── execute(**params)
                             └── validate_output(schema)
                                   ↓
                             LLM API
```

核心抽象：

- `SkillConfig`：name、model（"flash" / "pro" / "local" / "none"）、premium（bool）、stream（bool）
- `BaseSkill`：抽象基类，`execute()`（非流式）、`execute_stream()`（流式）
- `SkillRegistry`：注册中心，`register()` / `get()` / `list_all()`

调用方式对比：

```python
# 之前：硬编码调用
async for sse_event in stream_answer(db, notebook_id, session_id, data.message, relevant_chunks):
    yield sse_event

# 之后：通过 Registry 调用
skill = SkillRegistry.get("rag-qa")
async for sse_event in skill.execute_stream(
    question=data.message,
    context_chunks=relevant_chunks,
):
    yield sse_event
```

**优势**：零新依赖，纯 Python 抽象；Route 层不再直接依赖具体函数；为后续 Agent 框架提供统一调用入口；方便 A/B 测试、mock 切换、权限检查。

#### Phase 2：Skill Pipeline（可选）

对于多步骤任务（如 知识点 → 出题 → 批改），编写轻量 Pipeline 编排类，无需 Agent 框架，几十行代码即可。

#### Phase 3：完整 Agent 框架（按需引入）

在 Skill Registry 稳定运行后，引入真正的 Agent 调度层：

```
用户请求 → FastAPI Route → Agent Orchestrator（新增）
                                ↓
                          规划：需要哪些 Skill？按什么顺序？
                                ↓
                          SkillRegistry.get("rag-qa").execute(...)
                          SkillRegistry.get("genui-visualizer").execute(...)
                                ↓
                          汇总、返回
```

Agent 能够**自主决策**调用哪些 Skill、按什么顺序、如何组合。

### 5.6 Skill 按领域分组

| Agent 组 | 包含 Skill | 触发场景 |
|----------|-----------|---------|
| 文档处理 Agent | Document Formatter | 上传、编辑文档 |
| 对话 Agent | RAG Q&A、Open Q&A、GenUI Visualizer、Semantic Search | Chat 页面 |
| 学习工具 Agent | Quiz Generator、Knowledge Card Gen、Mnemonic Gen、Knowledge Extractor | Notebook 高级功能 |
| 摘要 Agent | Notebook Summarizer | 笔记本概览 |

### 5.7 智能体框架选型参考

| 框架 | 优势 | 劣势 |
|------|------|------|
| LangGraph | 状态图编排，适合多步骤 pipeline | 学习曲线较陡 |
| CrewAI | 多 Agent 协作，角色分工清晰 | 社区尚在发展 |
| AutoGen | 微软出品，对话式 Agent 强 | 对话场景强，文档处理偏弱 |
| 自研轻量框架 | 完全控制，无冗余依赖 | 开发维护成本高 |
| Claude Agent SDK | 原生支持 tool use + structured output | 绑定 Anthropic 生态 |

### 5.8 关键注意事项

1. **Embedding 模型不是 LLM**：语义搜索依赖 BGE 向量模型，不需要 LLM 调用，但需集成到 Agent 的 tool 体系中
2. **SSE 流式输出**：所有对话类 Skill（RAG Q&A、Open Q&A、Summarizer）必须支持 SSE，不能等全部完成再返回
3. **降级策略不能丢**：格式化失败降级为原始文本、RAG 无结果降级为开放问答等容错机制必须保留
4. **高级权限控制**：Quiz、Knowledge Card、Mnemonic 需检查 `user.is_premium`
5. **引用溯源**：引用标注 [1][2] 系统是核心功能，Agent 输出必须保持此格式
6. **数据库副作用**：知识提取会删除旧知识点、总结会创建 ChatSession、RAG Q&A 会保存 ChatMessage——需要明确的事务管理
7. **批处理与截断**：文档格式化的 8000 字符分批、各 Skill 的 30000–50000 字符上限，需在 tool 定义中明确约束

---

## 六、配置与运行

### 6.1 后端启动

```bash
cd backend
pip install -r requirements.txt
# 在 .env 文件中设置 DEEPSEEK_API_KEY，然后：
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

启动后可访问 `http://localhost:8000/docs` 查看 API 文档。

### 6.2 前端启动

```bash
cd frontend
npm install
npm run dev       # 开发服务器，监听 0.0.0.0:5173
npm run build     # 类型检查 + 生产构建至 dist/
```

### 6.3 关键环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DEEPSEEK_API_KEY` | "" | DeepSeek API 密钥 |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` | DeepSeek API 基础地址 |
| `LLM_FLASH_MODEL` | `deepseek-v4-flash` | NLU 任务模型 |
| `LLM_PRO_MODEL` | `deepseek-v4-pro` | 推理任务模型 |
| `LLM_LOCAL_BASE_URL` | "" | 本地 Ollama 地址（设为 `http://localhost:11434/v1` 激活） |
| `LLM_LOCAL_MODEL` | `qwen3:8b` | 本地模型名 |
| `EMBEDDING_MODEL` | `BAAI/bge-small-zh-v1.5` | HuggingFace 模型 ID |
| `CHUNK_SIZE` | 500 | 文本分块大小 |
| `CHUNK_OVERLAP` | 50 | 分块重叠 |
| `RETRIEVAL_TOP_K` | 8 | 检索结果数 |
| `MAX_UPLOAD_SIZE` | 10MB | 上传文件上限 |
| `FREE_MAX_NOTEBOOKS` | 3 | 免费用户笔记本上限 |
| `FREE_MAX_DOCUMENTS_PER_NOTEBOOK` | 5 | 免费用户每笔记本文档上限 |
| `FREE_DAILY_CHAT_MESSAGES` | 10 | 免费用户每日对话上限 |
| `HF_ENDPOINT` | `https://hf-mirror.com` | HuggingFace 镜像（首次下载用） |

### 6.4 定价盈亏分析

采用 Freemium + 订阅制模式，分四层定价：

| 层级 | 月费 | 包含额度 | 超出单价 | 目标人群 |
|------|------|----------|----------|----------|
| 免费版 | ¥0 | 30 次/月 | — | 体验用户 |
| 基础版 | ¥9.9 | 200 次/月 | ¥0.1/次 | 日常学习 |
| 专业版 | ¥19.9 | 500 次/月 | ¥0.06/次 | 备考冲刺 |
| VIP 版 | ¥39.9 | 不限次 | — | 高频用户 |

盈亏平衡点（自有 GPU 场景）：**175 个付费用户**（ARPU ¥12，毛利率 95.6%，固定成本 ¥2000/月）。

若免费用户占比 70%，则总用户需约 583 人即可实现盈利。

关键健康指标：

| 指标 | 预估值 | 健康阈值 | 状态 |
|------|--------|----------|------|
| LTV / CAC | 6.0 | > 3 | ✅ 健康 |
| 毛利率 | 95.6% | > 50% | ✅ 优秀 |
| 回收周期 | 1.7 个月 | < 12 | ✅ 健康 |

---


## 附录：关键术语表

| 术语 | 说明 |
|------|------|
| RAG | Retrieval-Augmented Generation，检索增强生成——从知识库检索相关内容后交由 LLM 生成答案 |
| SSE | Server-Sent Events，服务器推送事件——用于流式输出 AI 回答 |
| NLU | Natural Language Understanding，自然语言理解——Flash 模型承担的文档格式化、知识提取等任务 |
| ChromaDB | 嵌入式向量数据库，每笔记本独立 Collection |
| BGE | BAAI General Embedding，智源通用向量模型，512 维 |
| GenUI | Generative UI，AI 生成的交互式知识可视化组件 |
| Ollama | 本地 LLM 部署工具，当前预留接口用于 Qwen3-8B 本地推理 |
| Obsidian | 知识管理工具，其 Markdown 扩展格式（wikilinks、callout）被本项目作为格式化目标 |
