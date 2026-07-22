# MemoDeer — 知道AI学习助手

面向中学生与大学生的AI学习助手：上传学习资料，AI 自动整理为结构化笔记，支持混合检索增强问答（向量+关键词）。

## 项目结构

```
知道助手/
├── backend/          # FastAPI 后端（运行在PC）
│   ├── app/
│   │   ├── main.py           # 入口
│   │   ├── config.py         # 配置
│   │   ├── api/              # API 路由
│   │   │   ├── auth.py       # 用户认证
│   │   │   ├── notebooks.py  # 笔记本 + 文件树 + 知识点提取
│   │   │   ├── documents.py  # 文档上传/编辑/移动/向量化
│   │   │   ├── folders.py    # 文件夹管理
│   │   │   ├── chat.py       # SSE流式问答
│   │   │   ├── search.py     # 混合搜索
│   │   │   ├── quiz.py       # 智能出题
│   │   │   └── premium.py    # 会员内容生成
│   │   ├── core/             # 数据库 & 模型
│   │   │   ├── database.py
│   │   │   ├── models.py
│   │   │   └── schemas.py
│   │   ├── services/         # 核心服务
│   │   │   ├── llm_service.py       # LLM调用封装
│   │   │   ├── parser_service.py    # 文档解析
│   │   │   ├── chunking_service.py  # 文本分块
│   │   │   ├── embedding_service.py # 向量化
│   │   │   ├── vector_store.py      # ChromaDB
│   │   │   └── rag_service.py       # RAG管线
│   │   └── utils/
│   ├── data/              # 运行时数据（自动创建）
│   ├── .env               # 环境变量（需配置API Key）
│   └── requirements.txt
│
├── frontend/         # React 前端（运行在手机/浏览器）
│   ├── src/
│   │   ├── pages/          # 页面组件
│   │   │   ├── LoginPage.tsx
│   │   │   ├── RegisterPage.tsx
│   │   │   ├── HomePage.tsx         # 笔记本列表 + 新用户欢迎页
│   │   │   ├── NotebookPage.tsx     # VSCode风格文件树 + Tab（文件/知识点/卡片/口诀）
│   │   │   ├── ChatPage.tsx         # 独立对话页（薄包装）
│   │   │   ├── DocumentViewPage.tsx # 完整文档查看（Markdown渲染+引用高亮）
│   │   │   ├── MembershipPage.tsx   # 会员中心 & 模拟支付
│   │   │   ├── QuizPage.tsx         # AI智能出题练习
│   │   │   └── SettingsPage.tsx
│   │   ├── components/     # 可复用组件
│   │   │   ├── chat/
│   │   │   │   └── ChatPanel.tsx           # 可复用对话面板（SSE流式+引用+HTML渲染）
│   │   │   ├── file-tree/
│   │   │   │   ├── FileTree.tsx            # VSCode风格文件树
│   │   │   │   ├── FileTreeNode.tsx        # 树节点（文件夹/文件）
│   │   │   │   └── FileContextMenu.tsx     # 右键菜单
│   │   │   ├── editor/
│   │   │   │   └── MarkdownEditor.tsx      # 无感预览/编辑切换（行号+Ctrl+S）
│   │   │   ├── common/
│   │   │   │   ├── GenUI.tsx              # AI知识可视化（兼容旧格式）
│   │   │   │   ├── GlobalSearchModal.tsx  # 全局搜索弹窗
│   │   │   │   ├── PremiumGate.tsx       # 会员权限守卫
│   │   │   │   ├── KnowledgeCards.tsx    # 知识卡片（翻转卡片）
│   │   │   │   ├── MnemonicsList.tsx     # 记忆口诀列表
│   │   │   │   └── PendingVectorizeBar.tsx # 待向量化提示栏（一键批量向量化）
│   │   │   └── layout/     # 布局 & 侧拉栏
│   │   ├── api/            # API客户端
│   │   ├── store/          # 状态管理 (Zustand)
│   │   └── styles/         # 样式
│   ├── public/
│   └── package.json
│
└── doc/              # 产品文档
    ├── 产品选题卡.md
    └── AI产品模型选型报告.md
```

## 快速开始

### 1. 后端启动（PC端）

```bash
# 安装依赖
pip install -r requirements.txt

# 配置 DeepSeek API Key
# 编辑 .env 文件，填入你的 API Key:
# DEEPSEEK_API_KEY=sk-xxxxxxxx
#
# 可选：切换模型
# LLM_FLASH_MODEL=deepseek-v4-flash      → 知识点提取（轻量 NLU）
# LLM_PRO_MODEL=deepseek-v4-pro          → 强推理问答（建议用最强模型）
# 注：deepseek-chat / deepseek-reasoner 将于 2026/07/24 弃用

# 启动服务
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

后端启动后访问 http://localhost:8000/docs 查看API文档。

### 2. 前端启动

```bash
# 安装依赖
npm install

# 启动开发服务器
cd frontend
npm run dev
```

**桌面测试**：浏览器访问 http://localhost:5173

**手机测试**：
1. 确保手机和PC在同一WiFi网络
2. 查看PC的局域网IP（Windows: `ipconfig`，找到IPv4地址，如192.168.1.100）
3. 手机浏览器访问 `http://192.168.1.100:5173`
4. 在设置页面配置后端地址为 `http://192.168.1.100:8000`（或使用Vite代理）

### 3. 使用流程

1. **注册/登录** → 创建账号，登录页底部展示核心功能预览
2. **创建笔记本** → 首页点击"创建第一个笔记本"（新用户有功能亮点引导）
3. **上传文档** → 文件树工具栏点击上传 → 支持 PDF/DOCX/TXT/MD → AI 自动格式化为规范 Markdown
4. **管理文件** → 左侧文件树：新建文件夹分类、新建 Markdown 文件、右键重命名/删除/移动
5. **编辑文档** → 点击文件 → 预览模式查看 Markdown 渲染 → 点击"编辑"无感切换到行号编辑器 → Ctrl+S 保存
6. **向量化** → 编辑后文档标记为"待向量化" → 底部栏显示待处理列表 → 一键批量向量化
7. **开始提问** → 点击右下角聊天按钮或 `/notebook/:id/chat` 路由 → AI 优先从知识库检索
8. **混合检索** → 向量相似度 + 关键词匹配双路召回，确保相关文档不被遗漏
9. **智能回答** → 命中知识库 → RAG 回答 + `[1][2]` 内联引用 + 末尾"📚 参考文档"列表；未命中 → 降级通用回答 + "📌 非来自笔记"声明
10. **追溯原文** → 点击正文中的 `[1][2]` 上标或底部的引用标签 → 应用内跳转文档页 → 目标段落高亮定位 → 浏览器后退返回对话
11. **交互式 HTML** → AI 可输出 `html` 代码块（表格、折叠面板、步骤卡片等）→ 沙盒 iframe 安全渲染
12. **知识点提取（会员）** → 笔记本"知识点"Tab → AI 自动提取核心概念
13. **全局搜索** → 首页右上角搜索图标 → 跨笔记本混合搜索 → 按笔记本分组展开
14. **添加到笔记** → 降级回答底部"添加到笔记"按钮 → 编辑内容 → 保存为 Markdown 笔记

## Embedding 模型

项目默认使用 `BAAI/bge-small-zh-v1.5`（~95MB，512 维，本地 CPU 推理）。模型由两个环境变量控制：

```ini
# .env
EMBEDDING_MODEL=BAAI/bge-small-zh-v1.5          # 身份：要加载哪个模型（HuggingFace 模型 ID）
EMBEDDING_LOCAL_DIR=./models/bge-small-zh-v1.5  # 位置：本地缓存目录（相对 backend/；留空 = 自动派生）
```

### 加载顺序（启动时自动选择，见 [embedding_service.py](backend/app/services/embedding_service.py)）

| 优先级 | 来源 | 网络？ |
|---|---|---|
| 1 | `EMBEDDING_LOCAL_DIR` 目录（如 `backend/models/bge-small-zh-v1.5/`） | ❌ 零网络 |
| 2 | HuggingFace 全局缓存 `~/.cache/huggingface/hub/` | ❌ 零网络 |
| 3 | 都没有 → 从 `HF_ENDPOINT` 镜像下载到全局缓存 | ✅ 仅首次 |

### 首次下载到 backend/models/

仓库已自带 [scripts/download_embedding.py](backend/scripts/download_embedding.py) 一键脚本，**走国内镜像、自动选择文件名、幂等**：

```bash
cd backend
python scripts/download_embedding.py
```

行为：
1. 从 `HF_ENDPOINT=https://hf-mirror.com` 下载到 `backend/models/bge-small-zh-v1.5/`
2. 列出每个文件大小
3. 因为 `.env` 里 `EMBEDDING_MODEL` 已经是 `BAAI/bge-small-zh-v1.5`，**不修改 `.env`**

如果想下到自定义位置：

```bash
python scripts/download_embedding.py --target ./models/my-bge
# 改 .env 把 EMBEDDING_LOCAL_DIR 改成 ./models/my-bge
```

### 切换到其他 embedding 模型

> ⚠️ **不同模型的向量维度必须一致**，否则 ChromaDB 里的旧向量全部失效（例：`bge-small-zh`=512 维 vs `bge-large-zh`=1024 维）。切换后需要**清空 ChromaDB 并重新上传所有文档**。

```bash
cd backend
python scripts/download_embedding.py BAAI/bge-large-zh-v1.5
```

脚本会：
1. 下载到 `backend/models/bge-large-zh-v1.5/`
2. 自动更新 `.env`：
   ```
   EMBEDDING_MODEL=BAAI/bge-large-zh-v1.5
   EMBEDDING_LOCAL_DIR=./models/bge-large-zh-v1.5
   ```
3. 下次启动后端即生效

切完模型后清空旧向量：

```bash
rm -rf backend/data/chroma_db
# 或 Windows: Remove-Item -Recurse backend\data\chroma_db
# 然后重新上传文档
```

### 浏览器手动下载（完全断网环境）

1. 访问 https://huggingface.co/BAAI/bge-small-zh-v1.5/tree/main
2. 下载所有文件到 `backend/models/bge-small-zh-v1.5/`
3. 关键文件至少要有：`pytorch_model.bin`（权重）、`config.json`、`tokenizer.json`、`vocab.txt`、`modules.json`、`1_Pooling/config.json`

下载完成后目录结构：

```
backend/models/bge-small-zh-v1.5/
├── pytorch_model.bin       # 95MB 权重（必须）
├── config.json
├── tokenizer.json
├── tokenizer_config.json
├── vocab.txt
├── modules.json
├── 1_Pooling/
│   └── config.json
├── sentence_bert_config.json
├── special_tokens_map.json
└── config_sentence_transformers.json
```

### .gitignore 建议

模型文件太大（~95MB）不应该提交到 git：

```gitignore
# .gitignore（仓库根目录）
backend/models/
```

部署时通过 `scp` / `rsync` / 共享盘 等方式同步过去。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端框架 | React 18 + TypeScript 5 + Vite 5 |
| UI 样式 | Tailwind CSS 3 + Lucide Icons |
| Markdown | react-markdown + 交互式 HTML (iframe 沙盒渲染) + GenUI（兼容旧格式） |
| 状态管理 | Zustand |
| HTTP | Axios + Fetch (SSE 流式) |
| 路由 | React Router v6 |
| 后端框架 | Python FastAPI (async) + Uvicorn |
| ORM | SQLAlchemy 2 (async) + aiosqlite |
| 数据库 | SQLite（用户/笔记/文档/对话） |
| 向量库 | ChromaDB（嵌入式，每笔记本一集合） |
| 向量化 | sentence-transformers (BAAI/bge-small-zh-v1.5) |
| LLM | DeepSeek V4 三层：Flash（文档 AI 格式化）+ Pro（混合检索RAG问答/降级自由问答/知识点提取） |
| 文档解析 | PyMuPDF (PDF) + python-docx (Word) |
| 认证 | JWT (HS256) + bcrypt 密码哈希 |
| 部署 | 前端 Vite 构建 → Nginx / 后端 Uvicorn → Systemd / 局域网手机直连 |

## 功能

- ✅ 用户注册/登录（JWT 认证，数据隔离）
- ✅ 笔记本管理（创建、删除）
- ✅ **VSCode 风格文件树**：文件夹层级、新建文件/文件夹、右键菜单、内联重命名
- ✅ **无感 Markdown 编辑**：预览/编辑同区域切换，行号显示，Ctrl+S 保存
- ✅ 文档上传（PDF/DOCX/TXT/MD → AI 自动格式化为规范 Markdown）
- ✅ **混合检索 RAG**：向量相似度 + 关键词匹配双路召回，自动去重排序
- ✅ **智能问答**：命中知识库 → RAG 回答 + `[1][2]` 内联引用 + 末尾参考文档列表；未命中 → 降级通用回答 + 免责声明
- ✅ **内联引用可点击**：正文中的 `[1]` 上标可点击跳转，应用内导航，可浏览器后退
- ✅ **来源追溯**：悬停引用标签 → 摘要预览；点击 → 文档页目标段落高亮
- ✅ **交互式 HTML 渲染**：AI 输出 `html` 代码块 → 沙盒 iframe 安全渲染（表格、折叠面板、卡片等）
- ✅ **GenUI 可视化**（兼容旧格式）：概念卡片、对比表格、步骤指南、要点列表、示例框
- ✅ **文档全文查看**：Markdown 连续渲染 + 引用高亮滚动定位
- ✅ **全局搜索**：跨所有笔记本混合检索，结果按笔记本分组展开
- ✅ **待向量化队列**：编辑后自动标记，底部栏显示待处理列表，一键批量向量化
- ✅ 对话历史管理
- ✅ 自由问答消息可"添加到笔记"（编辑后保存为 .md）
- ✅ 知识点提取（会员）：Pro LLM 从文档提取结构化知识点
- ✅ 会员中心 & 支付流程（免费/月购/终身三档，模拟支付）
- ✅ AI 智能出题（选择题/填空题/混合，逐题作答+自动批改+解析）
- ✅ 知识卡片（翻转卡片，标签筛选，AI 生成）
- ✅ 记忆口诀（AI 生成朗朗上口的记忆助记内容）
- ✅ 笔记本自动摘要：Flash LLM 生成 ~300 字概要

## 📋 开发待办 / 技术债务

以下功能的前端 UI 已完成，但后端逻辑尚未完善：

| 功能模块 | 前端状态 | 后端状态 | 说明 |
|----------|----------|----------|------|
| 会员支付 | ✅ 已完成 | ⚠️ 模拟支付 | `POST /api/user/upgrade-premium` 直接设置会员标志，真实支付需对接微信/支付宝 |
| 智能出题 | ✅ 已完成 | ✅ Mock 就绪 | `POST /api/notebooks/{id}/quiz/generate` 已返回 mock 题目；需接入 Pro LLM 根据知识库真实出题 |
| 知识卡片 | ✅ 已完成 | ✅ Mock 就绪 | `POST /api/notebooks/{id}/premium/generate` 已返回 mock 卡片；需接入 Pro LLM 生成 |
| 记忆口诀 | ✅ 已完成 | ✅ Mock 就绪 | 同上，与知识卡片共用同一端点 |
| 知识点提取 | ✅ 已完成 | ✅ 已实现 | `POST /api/notebooks/{id}/knowledge-points/extract` 调用 Pro LLM 提取结构化知识点，会员功能 |
| 文档编辑重向量化 | ✅ 已完成 | ✅ 已完成 | `PUT /api/documents/{id}/content` + `POST /api/documents/{id}/re-vectorize` 完整实现；编辑后标记待向量化，支持一键批量向量化 |
| 文件树 & 文件夹管理 | ✅ 已完成 | ✅ 已完成 | NotebookPage VSCode 风格文件树侧栏，Folder CRUD API，新建/编辑/删除 Markdown 文件 |

**后端待补全路线：**
1. 在 `rag_service.py` 中添加 `generate_quiz_questions()` → 调用 Pro LLM 出题（替换 mock）
2. 在 `rag_service.py` 中添加 `generate_knowledge_cards()` / `generate_mnemonics()` → Pro LLM 生成（替换 mock）
3. 真实支付接入 → 替换 `POST /api/user/upgrade-premium` 为真实支付回调

