import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Key, Wifi, Palette, Sun, Moon, Monitor } from 'lucide-react'
import { useUIStore, type ColorTheme, type ThemeMode } from '../store/uiStore'
import { useState } from 'react'

const THEMES: { key: ColorTheme; label: string; color: string }[] = [
  { key: 'blue', label: '天空蓝', color: '#3b82f6' },
  { key: 'purple', label: '罗兰紫', color: '#8b5cf6' },
  { key: 'orange', label: '活力橙', color: '#f97316' },
  { key: 'green', label: '翡翠绿', color: '#22c55e' },
  { key: 'pink', label: '樱花粉', color: '#ec4899' },
]

const MODE_OPTIONS: { key: ThemeMode; label: string; icon: typeof Sun }[] = [
  { key: 'light', label: '亮色', icon: Sun },
  { key: 'dark', label: '暗色', icon: Moon },
  { key: 'system', label: '跟随系统', icon: Monitor },
]

export default function SettingsPage() {
  const navigate = useNavigate()
  const apiBaseUrl = useUIStore((s) => s.apiBaseUrl)
  const setApiBaseUrl = useUIStore((s) => s.setApiBaseUrl)
  const colorTheme = useUIStore((s) => s.colorTheme)
  const setColorTheme = useUIStore((s) => s.setColorTheme)
  const themeMode = useUIStore((s) => s.themeMode)
  const setThemeMode = useUIStore((s) => s.setThemeMode)
  const [url, setUrl] = useState(apiBaseUrl || '')
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setApiBaseUrl(url)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="h-full flex flex-col bg-surface-50">
      <header className="flex items-center gap-3 px-4 py-3 bg-surface-0 border-b border-surface-200">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-surface-100 rounded-lg btn-press">
          <ArrowLeft size={20} className="text-surface-600" />
        </button>
        <h1 className="font-semibold text-lg text-surface-800">设置</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* 外观模式 */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Sun size={18} className="text-primary-500" />
            <h2 className="font-semibold text-sm text-surface-700">外观模式</h2>
          </div>
          <div className="flex gap-2">
            {MODE_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setThemeMode(opt.key)}
                className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all duration-fast ${
                  themeMode === opt.key
                    ? 'bg-primary-50 ring-1 ring-primary-300'
                    : 'bg-surface-50 hover:bg-surface-100'
                }`}
              >
                <opt.icon
                  size={20}
                  className={themeMode === opt.key ? 'text-primary-500' : 'text-surface-400'}
                />
                <span
                  className={`text-xs font-medium ${themeMode === opt.key ? 'text-primary-600' : 'text-surface-500'}`}
                >
                  {opt.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* 主题色系 */}
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <Palette size={18} className="text-primary-500" />
            <h2 className="font-semibold text-sm text-surface-700">主题色系</h2>
          </div>
          <div className="flex gap-3">
            {THEMES.map((t) => (
              <button
                key={t.key}
                onClick={() => setColorTheme(t.key)}
                title={t.label}
                className="flex flex-col items-center gap-1.5 btn-press"
              >
                <div
                  className={`w-10 h-10 rounded-full transition-all duration-200 ${
                    colorTheme === t.key ? 'ring-2 ring-offset-2 ring-offset-surface-0' : ''
                  }`}
                  style={{ backgroundColor: t.color }}
                />
                <span
                  className={`text-[11px] ${colorTheme === t.key ? 'text-primary-500 font-semibold' : 'text-surface-400'}`}
                >
                  {t.label}
                </span>
                {colorTheme === t.key && (
                  <div className="w-1.5 h-1.5 rounded-full bg-primary-500" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 后端地址 */}
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <Wifi size={18} className="text-primary-500" />
            <h2 className="font-semibold text-sm text-surface-700">后端连接</h2>
          </div>
          <p className="text-xs text-surface-400 mb-3">
            手机访问时请填写PC的局域网IP地址，如: http://192.168.1.100:8000
          </p>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="留空使用默认地址"
            className="input-primary"
          />
          <button
            onClick={handleSave}
            className="mt-3 w-full py-2.5 bg-primary-500 text-white text-sm font-medium rounded-xl hover:opacity-90 active:scale-[0.98] transition-all duration-fast flex items-center justify-center gap-2"
          >
            {saved ? '已保存 ✓' : <><Save size={16} /> 保存</>}
          </button>
        </div>

        {/* API Key 配置 */}
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <Key size={18} className="text-accent" />
            <h2 className="font-semibold text-sm text-surface-700">API Key 配置</h2>
          </div>
          <p className="text-xs text-surface-400">
            DeepSeek API Key 需在后端 .env 文件中配置。当前前端无需设置。
          </p>
        </div>

        {/* 关于 */}
        <div className="card">
          <h2 className="font-semibold text-sm text-surface-700 mb-1">关于 MemoDeer</h2>
          <p className="text-xs text-surface-400 whitespace-pre-line">
            知道AI学习助手 v1.0.0{'\n'}
            面向学生群体的AI学习工具{'\n'}
            上传知识点 → 智能检索 → 有据可依的回答
          </p>
        </div>
      </div>
    </div>
  )
}
