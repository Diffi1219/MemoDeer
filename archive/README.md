# MemoDeer 项目改动归档

## 日期
2026-07-22

## 改动概览

| # | 功能 | 说明 |
|---|------|------|
| 1 | 搜索文件 | 改为前端本地精准字符匹配（按文件名） |
| 2 | 搜索知识卡片 | 标签改为"模糊检索/检索"，保留语义搜索 |
| 3 | 色系切换 | CSS变量方案，5色系（天空蓝/罗兰紫/活力橙/翡翠绿/樱花粉），设置页选择 |
| 4 | 出题数量 | 范围从 3-10 改为 0-10（0=不限制） |
| 5 | RAG问答 | 距离阈值 1.0→0.65，向量库显式指定cosine距离 |
| 6 | 全局搜索 | 改为跨笔记本混合搜索（向量+关键词+阈值过滤） |
| 7 | 中文关键词 | 滑动窗口分词（2/3/4字），加权计分 |
| 8 | 历史会话 | 修复点击历史记录无法跳转的问题 |

## 文件清单

### 前端 (8 files)
- `frontend/src/App.tsx` — 色系初始化 useEffect
- `frontend/src/pages/NotebookPage.tsx` — 模糊检索 + 出题0-10
- `frontend/src/pages/SettingsPage.tsx` — 主题色系选择器
- `frontend/src/pages/ChatPage.tsx` — 历史会话跳转修复
- `frontend/src/components/file-tree/FileTree.tsx` — 文件搜索前端本地匹配
- `frontend/src/components/chat/ChatPanel.tsx` — 聊天面板 sessionId 支持
- `frontend/src/store/uiStore.ts` — colorTheme 状态
- `frontend/src/styles/global.css` — CSS变量 + 5色系定义
- `frontend/tailwind.config.js` — primary 色系改为 CSS变量

### 后端 (2 files)
- `backend/app/services/rag_service.py` — 阈值0.65 + 滑动窗口 + 混合搜索
- `backend/app/services/vector_store.py` — 显式cosine距离

### 配置 (1 file)
- `.claude/launch.json` — 预览服务器配置

## 使用方式

老师收到后，把 changes/ 目录下的文件覆盖到项目对应位置即可。

或者用 diff.patch：
```
git apply diff.patch
```
