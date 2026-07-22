import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Upload, Search, MessageCircle, Brain, FileText, Sparkles, GraduationCap, Layers } from 'lucide-react'

const features = [
  { icon: Upload, title: '文档上传', desc: '支持 PDF、DOCX、TXT、MD，上传后 AI 自动格式化', color: 'text-blue-500', bg: 'bg-blue-50' },
  { icon: Brain, title: '知识提取', desc: 'AI 自动从文档中提取结构化知识点', color: 'text-amber-500', bg: 'bg-amber-50' },
  { icon: MessageCircle, title: '智能问答', desc: '基于你的知识库精准回答，找不到时自动用通用知识补充', color: 'text-green-500', bg: 'bg-green-50' },
  { icon: Search, title: '全局搜索', desc: '跨所有笔记本搜索，快速定位所需知识', color: 'text-purple-500', bg: 'bg-purple-50' },
  { icon: GraduationCap, title: 'AI 出题', desc: '一键生成选择题和填空题，检验学习效果', color: 'text-orange-500', bg: 'bg-orange-50' },
  { icon: Layers, title: '知识卡片', desc: '翻转卡片、记忆口诀，多种方式巩固记忆', color: 'text-pink-500', bg: 'bg-pink-50' },
]

const steps = [
  { step: '01', title: '创建笔记本', desc: '为每个学科或主题创建专属笔记本' },
  { step: '02', title: '上传文档', desc: '将学习资料拖入笔记本，AI 自动处理' },
  { step: '03', title: '开始学习', desc: '提问、出题、浏览知识点，高效掌握' },
]

const techs = ['React 18', 'TypeScript', 'Tailwind CSS', 'FastAPI', 'SQLite', 'ChromaDB', 'DeepSeek V4']

export default function AboutPage() {
  const navigate = useNavigate()

  return (
    <div className="h-full flex flex-col bg-surface-50">
      <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-surface-200">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-surface-100 rounded-lg">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-semibold text-lg">关于 MemoDeer</h1>
      </header>

      <div className="flex-1 overflow-y-auto">
        {/* Hero */}
        <div className="text-center px-6 py-8 bg-gradient-to-b from-primary-50 to-white">
          <div className="w-20 h-20 bg-primary-500 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary-200">
            <Sparkles size={36} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold text-surface-800 mb-1">MemoDeer</h2>
          <p className="text-surface-400 text-sm">知道 AI 学习助手</p>
          <p className="text-surface-400 text-xs mt-2 max-w-xs mx-auto leading-relaxed">
            面向中学生与大学生的智能学习工具，让每次复习都像有辅导老师陪伴
          </p>
        </div>

        {/* Feature Cards */}
        <div className="px-4 py-6">
          <h3 className="text-sm font-semibold text-surface-500 mb-3 text-center">核心功能</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {features.map((f) => (
              <div key={f.title} className={`${f.bg} rounded-xl p-4 text-center hover:scale-[1.02] transition-transform duration-200`}>
                <f.icon size={24} className={`${f.color} mx-auto mb-2`} />
                <p className="text-sm font-medium text-surface-700 mb-0.5">{f.title}</p>
                <p className="text-xs text-surface-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Usage Flow */}
        <div className="px-4 py-6">
          <h3 className="text-sm font-semibold text-surface-500 mb-4 text-center">三步开始</h3>
          <div className="bg-white rounded-2xl border border-surface-200 p-5">
            <div className="flex flex-col sm:flex-row gap-4">
              {steps.map((s, i) => (
                <div key={s.step} className="flex-1 flex sm:flex-col items-center sm:text-center gap-3 sm:gap-2">
                  <span className="w-10 h-10 rounded-xl bg-primary-100 text-primary-600 text-lg font-bold flex items-center justify-center flex-shrink-0">
                    {s.step}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-surface-700">{s.title}</p>
                    <p className="text-xs text-surface-400">{s.desc}</p>
                  </div>
                  {i < steps.length - 1 && (
                    <span className="hidden sm:block text-surface-200 text-lg">→</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tech Stack */}
        <div className="px-4 py-6">
          <h3 className="text-sm font-semibold text-surface-500 mb-3 text-center">技术栈</h3>
          <div className="flex flex-wrap justify-center gap-2">
            {techs.map((t) => (
              <span key={t} className="text-xs px-3 py-1.5 bg-white border border-surface-200 rounded-full text-surface-500 font-medium">
                {t}
              </span>
            ))}
          </div>
        </div>

        <div className="text-center pb-8">
          <p className="text-xs text-surface-300">v1.0.0 · Made with ❤️</p>
        </div>
      </div>
    </div>
  )
}
