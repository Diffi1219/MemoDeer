# MemoDeer AI 能力 → 智能体 Skill 迁移设计

> 文档版本：v1.0 | 日期：2026-07-20

## 1. 现状总览

当前 MemoDeer 的 AI 能力采用**直接调用 LLM API** 的模式（三层模型架构：Flash / Pro / Local），所有业务逻辑硬编码在 `rag_service.py` 等后端服务中。

如果要将 AI 替换为**智能体（Agent）架构**，需要把每个 AI 能力拆解为独立的 Skill（技能），由智能体框架统一调度。

---

## 2. 当前 AI 能力清单 & 对应 Skill

### Skill 1：文档格式化（Document Formatter）

| 维度 | 详情 |
|------|------|
| **当前实现** | `rag_service.py:_reformat_text_to_markdown()` |
| **调用链** | 文档上传 API → `process_document()` → `_reformat_text_to_markdown()` |
| **使用模型** | Flash（`deepseek-v4-flash`），可切换本地 8B |
| **输入** | 原始提取文本（PDF/DOCX/TXT/MD 解析后的杂乱文本） |
| **输出** | 结构化 Markdown（含标题层级、列表、表格、粗体关键词、代码块） |
| **特点** | 分批处理（每批 8000 字符），总 50000 字符上限；失败降级为原始文本 |
| **触发场景** | 每次上传文档、编辑文档后重新处理 |

**智能体 Skill 定义：**

```yaml
skill: document-formatter
model: flash
description: >
  将原始提取文本转换为规范 Markdown。根据内容结构智能添加标题层级、
  格式化列表/表格、标记关键词、修正 OCR 错误。
input:
  raw_text: string          # 原始文本（最多 50000 字符）
  context:                  # 可选上下文
    filename: string        # 原始文件名
    file_type: string       # pdf / docx / txt / md
output:
  formatted_markdown: string
constraints:
  - 不超过 50000 字符
  - 保留所有原始信息不丢失
  - 中文输出
```

---

### Skill 2：知识提取（Knowledge Extractor）

| 维度 | 详情 |
|------|------|
| **当前实现** | `rag_service.py:extract_knowledge_points()` |
| **调用链** | NotebookPage 知识点 Tab → `POST /notebooks/{id}/premium/generate` 间接调用（计划中）；当前 V1 返回 mock |
| **使用模型** | Pro（`deepseek-v4-pro`） |
| **输入** | 笔记本所有已处理文档的 chunk 合集（最多 30000 字符） |
| **输出** | `KnowledgePoint[]`：含 title、content、tags 的结构化 JSON |
| **特点** | 每次调用会**删除旧知识点并全量重建** |
| **触发场景** | 用户点击"知识点"Tab / 生成知识卡片时 |

**智能体 Skill 定义：**

```yaml
skill: knowledge-extractor
model: pro
description: >
  从学习资料中提取 5-15 个核心知识点，每个包含标题、详细解释和标签。
  按重要程度排序，覆盖主要概念、公式、定义。
input:
  documents:                # 文档内容列表
    - source_name: string
      content: string
  max_points: number        # 默认 15
output:
  knowledge_points:
    - title: string         # ≤10 字
      content: string       # 50-200 字
      tags: string[]        # 2-4 个标签
constraints:
  - 输出纯 JSON 数组
  - 按重要程度降序
  - 避免重复知识点
```

---

### Skill 3：RAG 问答（RAG Q&A）

| 维度 | 详情 |
|------|------|
| **当前实现** | `rag_service.py:stream_answer()` |
| **调用链** | Chat API → `retrieve_context()` → `stream_answer()` |
| **使用模型** | Pro（`deepseek-v4-pro`） |
| **输入** | 用户问题 + 检索到的上下文 chunks（Top-8，含文档名和内容） |
| **输出** | SSE 流式：逐 token 回答 + 引用标注 [1][2] + 📚参考文档列表 |
| **特点** | 引用强制标注，支持 GenUI 交互式 HTML（概念卡片/对比表/步骤等） |
| **触发场景** | 每次用户在 Chat 中提问（自动模式首选路径） |

**智能体 Skill 定义：**

```yaml
skill: rag-qa
model: pro
description: >
  基于提供的文档上下文回答用户问题。严格依据上下文，不编造内容。
  每个观点标注引用来源，末尾列出参考文档。可用交互式 HTML 增强呈现。
input:
  question: string
  context_chunks:
    - index: number         # 引用编号 [1], [2]...
      document_name: string
      content: string
      score: number         # 相关度评分
  chat_history:             # 可选，多轮对话上下文
    - role: string
      content: string
output:
  stream: true              # SSE 流式输出
  events:
    - token: string         # 逐 token
    - citations: []         # 引用元数据
    - done: true
constraints:
  - 每个观点必须标注引用
  - 上下文不足时诚实告知"无法确定"
  - 回答末尾输出 📚 参考文档
  - 可用 ```html 代码块输出交互式组件（card/table/steps）
```

---

### Skill 4：开放问答（Open Q&A / Fallback）

| 维度 | 详情 |
|------|------|
| **当前实现** | `rag_service.py:stream_answer_open()` + `stream_answer_fallback()` |
| **调用链** | Chat API：用户手动选"开放模式" / RAG 无结果自动降级 |
| **使用模型** | Pro |
| **输入** | 用户问题（无上下文） |
| **输出** | SSE 流式回答 + 声明提示（RAG 降级时加免责声明） |
| **特点** | 降级时回答开头自动加"📌 以下回答来自通用知识，非你的个人笔记，请注意核实" |
| **触发场景** | 用户手动选自由问答模式 / RAG 检索无相关结果 |

**智能体 Skill 定义：**

```yaml
skill: open-qa
model: pro
description: >
  基于通用知识自由回答用户问题。适合笔记本中没有相关内容的场景。
  在回答开头声明来源为通用知识。
input:
  question: string
  mode: "manual" | "fallback"   # manual=用户主动选择, fallback=RAG无结果自动降级
output:
  stream: true
  events:
    - token: string
    - done: true
constraints:
  - fallback 模式时回答开头加 📌 声明
  - 可用 ```html 输出交互式组件
  - 超出知识范围时诚实告知
```

---

### Skill 5：笔记本总结（Notebook Summarizer）

| 维度 | 详情 |
|------|------|
| **当前实现** | `rag_service.py:stream_notebook_summary()` |
| **调用链** | `POST /notebooks/{id}/summarize` |
| **使用模型** | Flash |
| **输入** | 笔记本所有已完成文档的全部 chunks（最多 40000 字符） |
| **输出** | SSE 流式 ~300 字中文摘要 |
| **特点** | 自动创建新 ChatSession，摘要可作为对话起点继续提问 |
| **触发场景** | 用户在笔记本中点击"生成摘要"按钮 |

**智能体 Skill 定义：**

```yaml
skill: notebook-summarizer
model: flash
description: >
  综合笔记本中所有文档内容，生成约 300 字的中文摘要。
  概括主题和知识点，突出重要概念。
input:
  notebook_title: string
  documents:
    - filename: string
      content: string        # 全量 chunk 拼接
output:
  stream: true
  summary: string            # ~300 字
constraints:
  - 严格控制在 300 字左右
  - 综合所有文档，不遗漏主题
  - 直接输出摘要，不加前缀
```

---

### Skill 6：智能出题（Quiz Generator）🟡 高级会员

| 维度 | 详情 |
|------|------|
| **当前实现** | `quiz.py:generate_quiz()` — **V1 返回 mock 数据，Pro LLM 接入待实现** |
| **调用链** | QuizPage → `POST /notebooks/{id}/quiz/generate` |
| **使用模型** | Pro（计划中） |
| **输入** | 笔记本知识库内容 + 题型选择（选择题/填空题/混合）+ 题目数量（3-10） |
| **输出** | `QuizQuestion[]`：含题目、选项、正确答案、详细解析 |
| **特点** | 需高级会员，前端有 mock 降级 |
| **触发场景** | NotebookPage 点击"出题" → QuizPage |

**智能体 Skill 定义：**

```yaml
skill: quiz-generator
model: pro
premium: true               # 需高级会员
description: >
  基于知识库内容生成针对性练习题。支持选择题、填空题、混合模式。
  每道题配有正确答案和详细解析。
input:
  documents:                # 知识库内容（最多 30000 字符）
    - source_name: string
      content: string
  question_type: "choice" | "fill" | "mixed"
  count: number             # 3-10
  difficulty: "easy" | "medium" | "hard"   # 可选，默认 medium
output:
  questions:
    - id: string
      type: "choice" | "fill"
      question: string
      options: string[] | null    # 选择题 4 个选项
      answer: string              # 正确答案
      explanation: string         # 详细解析
constraints:
  - 题目必须基于提供的知识库内容
  - 不能出知识库中不存在的知识点
  - 解析需引用具体来源文档
  - 输出 JSON 格式
```

---

### Skill 7：知识卡片生成（Knowledge Card Generator）🟡 高级会员

| 维度 | 详情 |
|------|------|
| **当前实现** | `premium.py:generate_premium_content()` — **V1 返回 mock 数据，Pro LLM 接入待实现** |
| **调用链** | NotebookPage 卡片Tab → `POST /notebooks/{id}/premium/generate` |
| **使用模型** | Pro（计划中） |
| **输入** | 笔记本知识库内容 |
| **输出** | `KnowledgeCardItem[]`：正面（概念名+简短定义）+ 背面（详细解释+要点）含标签 |
| **特点** | 翻转卡片互动，支持标签筛选，需高级会员 |
| **触发场景** | NotebookPage "卡片"Tab |

**智能体 Skill 定义：**

```yaml
skill: knowledge-card-generator
model: pro
premium: true
description: >
  从知识库中提取核心概念，生成正反面翻转卡片。
  正面：概念名称和简短定义。背面：详细解释、要点、应用场景。
input:
  knowledge_points:         # 可复用 knowledge-extractor 的输出
    - title: string
      content: string
      tags: string[]
  count: number             # 期望卡片数量
output:
  cards:
    - id: string
      title: string         # 概念名
      front: string         # 正面：简短定义（1-2句）
      back: string          # 背面：详细解释和要点
      tags: string[]        # 分类标签
constraints:
  - 基于知识库真实内容，不编造
  - 正面简洁，背面详细
  - 输出 JSON 格式
```

---

### Skill 8：记忆口诀生成（Mnemonic Generator）🟡 高级会员

| 维度 | 详情 |
|------|------|
| **当前实现** | `premium.py:generate_premium_content()` — **同卡片 API，V1 返回 mock** |
| **调用链** | NotebookPage 口诀Tab → `POST /notebooks/{id}/premium/generate` |
| **使用模型** | Pro（计划中） |
| **输入** | 笔记本知识库内容 |
| **输出** | `MnemonicItem[]`：含口诀内容、来源文档、助记提示 |
| **特点** | 朗朗上口的韵律口诀，需高级会员 |
| **触发场景** | NotebookPage "口诀"Tab |

**智能体 Skill 定义：**

```yaml
skill: mnemonic-generator
model: pro
premium: true
description: >
  将难记的知识点编成朗朗上口的记忆口诀（韵律、排比、联想）。
  每条口诀配助记提示，帮助理解口诀的逻辑。
input:
  knowledge_points:         # 可复用 knowledge-extractor 的输出
    - title: string
      content: string
  count: number
output:
  mnemonics:
    - id: string
      title: string
      content: string       # 口诀正文
      source_doc: string    # 知识点来源
      tip: string           # 助记提示
constraints:
  - 口诀需朗朗上口，有节奏感
  - 与知识库内容严格对应
  - 每条配助记提示
```

---

### Skill 9：GenUI 可视化生成（GenUI Visualizer）🆕

| 维度 | 详情 |
|------|------|
| **当前实现** | 隐含在 RAG Q&A / Open Q&A 的 system prompt 中，通过 ` ```html ` 代码块实现 |
| **调用链** | ChatPage `react-markdown` 解析 LLM 输出的 ` ```html ` 块 → 渲染为交互式卡片 |
| **使用模型** | Pro（作为 RAG/Open Q&A 的一部分） |
| **输入** | 需要可视化的知识点 |
| **输出** | 交互式 HTML 组件（概念卡片/对比表格/步骤指南/示例框） |
| **特点** | 只在 Chat 回答中生效，DocumentViewPage 不渲染 |

**智能体 Skill 定义：**

```yaml
skill: genui-visualizer
model: pro
description: >
  将复杂知识点转化为交互式 HTML 可视化组件。
  支持：概念卡片、关键要点、对比表格、步骤指南、示例框。
input:
  concept:
    type: "concept-card" | "key-points" | "comparison" | "steps" | "example-box"
    title: string
    data: object             # 根据 type 不同而变化
output:
  html: string              # 带 class 的 HTML 片段（card/tag/highlight/step/table）
  genui_json?: object       # 可选：结构化数据供 GenUI 组件直接渲染
constraints:
  - 每次回答使用 1-3 个可视化组件
  - HTML 代码自包含，不依赖外部 CSS
  - class 限用 card/tag/highlight/step/step-num
```

---

### Skill 10：语义搜索编排（Semantic Search Orchestrator）🆕

| 维度 | 详情 |
|------|------|
| **当前实现** | `rag_service.py:search_notebook()` / `search_all_notebooks()` — 混合搜索（向量 + 关键词） |
| **调用链** | Notebook 内搜索 / 全局搜索 |
| **使用模型** | Embedding 模型（`BAAI/bge-small-zh-v1.5`），非生成式 LLM |
| **输入** | 查询文本 |
| **输出** | 排序后的相关 chunks（含文档名、分数、来源标记） |
| **特点** | 混合检索：向量相似度 + SQLite LIKE 关键词匹配，去重合并 |

**智能体 Skill 定义：**

```yaml
skill: semantic-search
model: none                  # 纯检索，无需 LLM
description: >
  混合语义搜索：embedding 向量相似度 + 关键词精确匹配。
  跨笔记本全局搜索，结果按相关度排序并去重。
input:
  query: string
  notebook_id?: string       # 可选，不传则全局搜索
  top_k: number              # 默认 8
output:
  results:
    - chunk_id: string
      document_name: string
      content: string        # 截取前 500 字符
      score: number          # 0-1，越高越相关
      source: "vector" | "keyword"
      notebook_id: string
      notebook_title: string
```

---

## 3. Skill 依赖关系图

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

🟡 = 高级会员功能
```

## 4. 关键问题：没有 Agent 框架，Skill 怎么被调用？

当前架构是最简单的 **Route → Service → LLM** 直调模式：

```
用户请求 → FastAPI Route → 硬编码调用 rag_service.xxx() → LLM API
```

要让这些 Skill 真正"活"起来，需要一个**调度层**。有两种做法：

### 方案 A：轻量 Skill Registry（推荐先做）

不引入任何 Agent 框架，只在现有 FastAPI 中加一层 **Skill Registry**，
把每个 AI 能力封装为统一接口的可调用单元。

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

**代码草稿：**

```python
# backend/app/services/skill_registry.py

from abc import ABC, abstractmethod
from typing import Any, AsyncIterator
from pydantic import BaseModel

class SkillConfig(BaseModel):
    name: str
    model: str              # "flash" | "pro" | "local" | "none"
    premium: bool = False
    stream: bool = False

class BaseSkill(ABC):
    """所有 Skill 的基类 — 统一接口，让 Route 和未来的 Agent 都能调用"""
    config: SkillConfig

    @abstractmethod
    async def execute(self, **kwargs) -> Any:
        """非流式执行，返回完整结果"""
        ...

    async def execute_stream(self, **kwargs) -> AsyncIterator[str]:
        """流式执行（默认抛 NotImplemented，流式 Skill 自行覆盖）"""
        raise NotImplementedError(f"{self.config.name} 不支持流式")

# ─── 具体 Skill 实现 ───────────────────────────────────

class DocumentFormatterSkill(BaseSkill):
    config = SkillConfig(name="document-formatter", model="flash")

    async def execute(self, *, raw_text: str, filename: str = "", file_type: str = "") -> str:
        if len(raw_text.strip()) < 50:
            return raw_text
        # 复用现有 _reformat_text_to_markdown 逻辑
        ...

class RAGQASkill(BaseSkill):
    config = SkillConfig(name="rag-qa", model="pro", stream=True)

    async def execute_stream(self, *, question: str, context_chunks: list, chat_history: list = None) -> AsyncIterator[str]:
        # 复用现有 stream_answer 逻辑
        ...

class QuizGeneratorSkill(BaseSkill):
    config = SkillConfig(name="quiz-generator", model="pro", premium=True)

    async def execute(self, *, documents: list, question_type: str = "mixed", count: int = 5) -> list:
        # 替代 quiz.py 中的 mock 数据
        ...

# ─── 注册中心 ──────────────────────────────────────────

class SkillRegistry:
    _skills: dict[str, BaseSkill] = {}

    @classmethod
    def register(cls, skill: BaseSkill):
        cls._skills[skill.config.name] = skill

    @classmethod
    def get(cls, name: str) -> BaseSkill:
        if name not in cls._skills:
            raise KeyError(f"未知 Skill: {name}")
        return cls._skills[name]

    @classmethod
    def list_all(cls) -> list[str]:
        return list(cls._skills.keys())

# 启动时注册所有 Skill
SkillRegistry.register(DocumentFormatterSkill())
SkillRegistry.register(RAGQASkill())
SkillRegistry.register(QuizGeneratorSkill())
# ... 其他 7 个
```

**Route 层调用方式变为：**

```python
# chat.py — 之前 vs 之后

# ❌ 之前：硬编码调用
async for sse_event in stream_answer(db, notebook_id, session_id, data.message, relevant_chunks):
    yield sse_event

# ✅ 之后：通过 Registry 调用
skill = SkillRegistry.get("rag-qa")
async for sse_event in skill.execute_stream(
    question=data.message,
    context_chunks=relevant_chunks,
):
    yield sse_event
```

**优势：**
- 零新依赖，纯 Python 抽象
- Route 层不再直接依赖具体函数，只依赖 Skill 名
- 未来换上 Agent 框架时，Agent 直接调 `SkillRegistry.get()` 即可
- 方便做 A/B 测试、mock 切换、权限检查

---

### 方案 B：引入 Agent 框架（后续演进）

在 Skill Registry 稳定运行后，再引入真正的 Agent 调度层：

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

这时 Agent 的核心价值才真正体现——它不再只是"一对一"调用 Skill，
而是能**自主决策**调用哪些 Skill、什么顺序、怎么组合。

**但前提是 Skill 已经标准化**（方案 A 已做好），否则 Agent 调不了。

---

### 推荐落地节奏

```
第 1 步（现在就能做）  →  方案 A：Skill Registry
                         把 10 个 Skill 全部封装为 BaseSkill 子类
                         Route 层改为通过 Registry 调用
                         收益：代码解耦、统一接口、方便测试

第 2 步（选做）        →  引入简单编排
                         对话场景：RAG QA + GenUI Visualizer 串联
                         学习场景：Knowledge Extractor → Quiz/Card/Mnemonic 串联
                         可以用一个轻量 Pipeline 类实现

第 3 步（未来）        →  方案 B：完整 Agent 框架
                         引入 LangGraph / 自研 Agent Loop
                         Agent 自主决策调用链，而非硬编码
```

---

## 5. 智能体架构建议

### 5.1 Skill 分组（按领域）

| Agent 组 | 包含 Skill | 触发场景 |
|----------|-----------|---------|
| **文档处理 Agent** | Document Formatter | 上传、编辑文档 |
| **对话 Agent** | RAG Q&A, Open Q&A, GenUI Visualizer, Semantic Search | Chat 页面 |
| **学习工具 Agent** | Quiz Generator, Knowledge Card Gen, Mnemonic Gen, Knowledge Extractor | Notebook 会员功能 |
| **摘要 Agent** | Notebook Summarizer | 笔记本概览 |

### 5.2 智能体框架选型考量

| 框架 | 优势 | 劣势 |
|------|------|------|
| **LangGraph** | 状态图编排，适合多步骤 pipeline | 学习曲线较陡 |
| **CrewAI** | 多 Agent 协作，角色分工清晰 | 社区尚在发展 |
| **AutoGen** | 微软出品，对话式 Agent 强 | 适合对话场景，文档处理偏弱 |
| **自研轻量框架** | 完全控制，无冗余依赖 | 开发维护成本高 |
| **Claude Agent SDK** | 原生支持 tool use + structured output | 绑定 Anthropic 生态 |

### 5.3 迁移路径建议

```
Phase 1: Skill Registry（本周可做）
  ├── 定义 BaseSkill 抽象类
  ├── 把 10 个 AI 能力改写为 Skill 子类
  ├── Route 层通过 SkillRegistry.get() 调用
  └── 现有功能零影响，纯重构

Phase 2: Skill Pipeline（可选）
  ├── 对于多步骤任务（如：知识点→出题→批改），写简单 Pipeline 编排
  ├── 不需要 Agent 框架，几十行代码就够
  └── 对话场景：RAG QA + GenUI 串联

Phase 3: Agent 框架（按需）
  ├── 引入 Agent 框架（推荐 LangGraph）
  ├── Agent 自主决策 Skill 调用链
  ├── 多 Agent 协作：RAG Q&A Agent ↔ GenUI Agent ↔ Search Agent
  └── 灰度切换（先切 Flash 任务，再切 Pro 任务）
```

## 6. 关键注意事项

1. **Embedding 模型不是 LLM**：语义搜索依赖 `BAAI/bge-small-zh-v1.5` embedding 模型，不需要 LLM 调用，但需要集成到 Agent 的 tool 体系中。

2. **SSE 流式输出**：所有对话类 Skill（RAG Q&A、Open Q&A、Summarizer）必须支持 SSE 流式输出，不能等 Agent 全部完成再返回。

3. **降级策略不能丢**：Document Formatter 失败时降级为原始文本，RAG 无结果时降级为 Open Q&A，这些容错机制在 Agent 架构中必须保留。

4. **会员权限控制**：Quiz Generator、Knowledge Card Generator、Mnemonic Generator 需检查 `user.is_premium`。

5. **引用溯源**：RAG Q&A 的引用标注 [1][2] 系统是核心功能，Agent 输出必须保持这个格式。

6. **数据库副作用**：Knowledge Extractor 会删除旧知识点、Summarizer 会创建 ChatSession、RAG Q&A 会保存 ChatMessage——这些副作用在 Agent 框架中需要明确的事务管理。

7. **批处理 & 截断**：Document Formatter 的 8000 字符分批、各 Skill 的 30000-50000 字符上限，需要在 Agent 的 tool 定义中明确约束。

---

## 附录：当前 LLM 调用速查表

| # | 能力 | 文件:行 | 模型 | 流式 | 状态 |
|---|------|---------|------|------|------|
| 1 | 文档格式化 | `rag_service.py:124-151` | Flash | ❌ | ✅ 已实现 |
| 2 | 知识提取 | `rag_service.py:940-1049` | Pro | ❌ | ✅ 已实现 |
| 3 | RAG 问答 | `rag_service.py:372-410` | Pro | ✅ SSE | ✅ 已实现 |
| 4 | 开放问答 | `rag_service.py:413-460` | Pro | ✅ SSE | ✅ 已实现 |
| 5 | Fallback 问答 | `rag_service.py:588-627` | Pro | ✅ SSE | ✅ 已实现 |
| 6 | 笔记本摘要 | `rag_service.py:463-549` | Flash | ✅ SSE | ✅ 已实现 |
| 7 | 智能出题 | `quiz.py:40-85` | Pro | ❌ | 🟡 Mock |
| 8 | 知识卡片 | `premium.py:38-92` | Pro | ❌ | 🟡 Mock |
| 9 | 记忆口诀 | `premium.py:38-92` | Pro | ❌ | 🟡 Mock |
| 10 | GenUI 可视化 | `rag_service.py:327-363` (prompt) | Pro | 嵌入问答 | ✅ 已实现 |
