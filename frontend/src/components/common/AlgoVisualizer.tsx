import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Play, Pause, RotateCcw, SkipForward, Gauge } from 'lucide-react'

// ── 类型定义 ──

export interface AlgoVizStep {
  type: 'compare' | 'swap' | 'sorted' | 'pivot' | 'done'
  i?: number
  j?: number
  desc: string
  value?: number       // 归并排序等场景用到
}

export interface AlgoVizData {
  algorithm: string
  array: number[]
  steps: AlgoVizStep[]
}

// 算法名中文映射
const ALGO_NAMES: Record<string, string> = {
  'bubble-sort': '冒泡排序',
  'selection-sort': '选择排序',
  'insertion-sort': '插入排序',
  'quick-sort': '快速排序',
  'merge-sort': '归并排序',
  'heap-sort': '堆排序',
  'shell-sort': '希尔排序',
  'binary-search': '二分查找',
  'linear-search': '线性查找',
  'bfs': 'BFS 广度优先搜索',
  'dfs': 'DFS 深度优先搜索',
  'dijkstra': 'Dijkstra 最短路径',
  'knapsack': '背包问题 DP',
}

// ── 工具函数 ──

/** 应用所有 step 到初始数组，得到当前 step 后的数组状态 */
function applySteps(steps: AlgoVizStep[], initialArray: number[], upToIndex: number): number[] {
  const arr = [...initialArray]
  for (let s = 0; s <= upToIndex; s++) {
    const step = steps[s]
    if (step.type === 'swap' && step.i !== undefined && step.j !== undefined) {
      const tmp = arr[step.i]
      arr[step.i] = arr[step.j]
      arr[step.j] = tmp
    }
  }
  return arr
}

/** 根据 step 类型获取柱子的颜色 class */
function getBarColor(
  step: AlgoVizStep | null,
  barIndex: number,
  sortedIndices: Set<number>,
): string {
  if (sortedIndices.has(barIndex)) {
    return 'bg-green-500 dark:bg-green-400'
  }
  if (!step) return 'bg-primary-500 dark:bg-primary-400'

  const { type, i, j } = step

  if (type === 'compare') {
    if (barIndex === i || barIndex === j) return 'bg-warning-500 dark:bg-warning-400 animate-pulse'
  }
  if (type === 'swap') {
    if (barIndex === i || barIndex === j) return 'bg-red-500 dark:bg-red-400'
  }
  if (type === 'pivot' && barIndex === i) {
    return 'bg-purple-500 dark:bg-purple-400'
  }
  return 'bg-primary-500 dark:bg-primary-400'
}

/** 获取柱子的过渡动画 class */
function getBarTransitionClass(stepType: string, barIndex: number, i?: number, j?: number): string {
  if (stepType === 'swap' && (barIndex === i || barIndex === j)) {
    return 'transition-all duration-400'
  }
  return 'transition-colors duration-300'
}

// ── 主组件 ──

export default function AlgoVisualizer({ data }: { data: AlgoVizData }) {
  const { algorithm, array: initialArray, steps } = data
  const algoName = ALGO_NAMES[algorithm] || algorithm

  // ── 状态 ──
  const [currentStep, setCurrentStep] = useState(-1)  // -1 = 初始状态
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState<'fast' | 'medium' | 'slow'>('medium')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const speedMs = { fast: 200, medium: 500, slow: 1000 }[speed]

  // 当前数组状态（增量应用步骤）
  const displayArray = useMemo(
    () => (currentStep >= 0 ? applySteps(steps, initialArray, currentStep) : [...initialArray]),
    [currentStep, steps, initialArray],
  )

  // 已完成的 index 集合
  const sortedIndices = useMemo(() => {
    const set = new Set<number>()
    for (let s = 0; s <= currentStep && s < steps.length; s++) {
      if (steps[s].type === 'sorted' && steps[s].i !== undefined) {
        set.add(steps[s].i!)
      }
    }
    return set
  }, [currentStep, steps])

  const currentStepData: AlgoVizStep | null =
    currentStep >= 0 && currentStep < steps.length ? steps[currentStep] : null

  const isDone = currentStep >= steps.length - 1 && steps.length > 0
  const maxVal = Math.max(...initialArray)

  // ── 动画循环 ──
  const stopPlaying = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setIsPlaying(false)
  }, [])

  const advance = useCallback(() => {
    setCurrentStep((prev) => {
      const next = prev + 1
      if (next >= steps.length) {
        stopPlaying()
        return prev
      }
      return next
    })
  }, [steps.length, stopPlaying])

  useEffect(() => {
    if (isPlaying && !isDone) {
      timerRef.current = setInterval(() => advance(), speedMs)
      return () => {
        if (timerRef.current) clearInterval(timerRef.current)
      }
    }
    if (isDone) stopPlaying()
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isPlaying, isDone, speedMs, advance, stopPlaying])

  // ── 控制 ──
  const handlePlay = () => {
    if (isDone) {
      setCurrentStep(-1)
      // 等 reset 后再 play
      setTimeout(() => setIsPlaying(true), 50)
      return
    }
    setIsPlaying(true)
  }

  const handlePause = () => stopPlaying()

  const handleReset = () => {
    stopPlaying()
    setCurrentStep(-1)
  }

  const handleStep = () => {
    stopPlaying()
    advance()
  }

  const handleSpeedToggle = () => {
    const order: Array<'fast' | 'medium' | 'slow'> = ['slow', 'medium', 'fast']
    const idx = order.indexOf(speed)
    setSpeed(order[(idx + 1) % 3])
  }

  // ── 生成柱状图 ──
  const barChart = useMemo(() => {
    return displayArray.map((value, idx) => (
      <div
        key={idx}
        className="flex flex-col items-center gap-1 min-w-[28px] flex-1"
      >
        {/* 柱子 */}
        <div className="relative w-full flex items-end justify-center" style={{ height: 160 }}>
          <div
            className={`w-full max-w-[40px] mx-auto rounded-t-lg ${getBarColor(
              currentStepData,
              idx,
              sortedIndices,
            )} ${getBarTransitionClass(
              currentStepData?.type || '',
              idx,
              currentStepData?.i,
              currentStepData?.j,
            )}`}
            style={{ height: `${Math.max((value / maxVal) * 150, 12)}px` }}
          >
            {/* 比较/交换指示器 */}
            {currentStepData?.type === 'compare' &&
              (currentStepData.i === idx || currentStepData.j === idx) && (
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-warning-600 dark:text-warning-400 whitespace-nowrap">
                  {currentStepData.i === currentStepData.j
                    ? '当前'
                    : currentStepData.i === idx
                      ? '← 比较'
                      : '比较 →'}
                </div>
              )}
            {currentStepData?.type === 'swap' &&
              (currentStepData.i === idx || currentStepData.j === idx) && (
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-red-600 dark:text-red-400 whitespace-nowrap">
                  {currentStepData.i === idx ? '↔ 交换' : '交换 ↔'}
                </div>
              )}
          </div>
        </div>
        {/* 数值标签 */}
        <span
          className={`text-xs font-mono font-semibold transition-colors duration-300 ${
            sortedIndices.has(idx)
              ? 'text-green-600 dark:text-green-400'
              : currentStepData?.type === 'compare' &&
                  (currentStepData.i === idx || currentStepData.j === idx)
                ? 'text-warning-600 dark:text-warning-400'
                : 'text-surface-600 dark:text-surface-400'
          }`}
        >
          {value}
        </span>
      </div>
    ))
  }, [displayArray, currentStepData, sortedIndices, maxVal])

  return (
    <div className="algo-visualizer border border-surface-200 dark:border-surface-700 rounded-2xl overflow-hidden my-3 shadow-sm bg-surface-0 dark:bg-surface-900">
      {/* ── 头部 ── */}
      <div className="px-4 py-3 border-b border-surface-200 dark:border-surface-700 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">🧮</span>
          <span className="font-semibold text-sm text-surface-800 dark:text-surface-200">
            {algoName} 可视化
          </span>
          <span className="text-xs text-surface-400 bg-surface-100 dark:bg-surface-800 px-2 py-0.5 rounded-full">
            {steps.length} 步
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {/* 速度切换 */}
          <button
            onClick={handleSpeedToggle}
            className="algo-btn group relative"
            title={`速度：${speed === 'fast' ? '快' : speed === 'medium' ? '中' : '慢'}`}
          >
            <Gauge size={14} />
            <span className="ml-1 text-xs">
              {speed === 'fast' ? '快' : speed === 'medium' ? '中' : '慢'}
            </span>
          </button>
        </div>
      </div>

      {/* ── 可视化区域 ── */}
      <div className="px-4 pt-5 pb-3">
        {/* Bar chart */}
        <div className="flex items-end gap-1 justify-center" style={{ minHeight: 180 }}>
          {barChart}
        </div>

        {/* 图例 */}
        <div className="flex items-center gap-4 justify-center mt-3 flex-wrap text-[11px] text-surface-500">
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-primary-500 dark:bg-primary-400 inline-block" />
            默认
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-warning-500 dark:bg-warning-400 inline-block" />
            比较中
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-red-500 dark:bg-red-400 inline-block" />
            交换中
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-green-500 dark:bg-green-400 inline-block" />
            已完成
          </span>
        </div>
      </div>

      {/* ── 控制栏 ── */}
      <div className="px-4 py-3 border-t border-surface-200 dark:border-surface-700 flex items-center gap-2 flex-wrap justify-center">
        <button
          onClick={isPlaying ? handlePause : handlePlay}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
            isPlaying
              ? 'bg-warning-50 text-warning-700 border border-warning-200 hover:bg-warning-100 dark:bg-warning-900/20 dark:text-warning-400 dark:border-warning-700'
              : isDone
                ? 'bg-surface-100 text-surface-400 border border-surface-200 dark:bg-surface-800 dark:text-surface-500 cursor-not-allowed'
                : 'bg-primary-500 text-white border border-primary-500 hover:bg-primary-600 shadow-sm'
          }`}
          disabled={isDone}
        >
          {isPlaying ? <Pause size={15} /> : <Play size={15} />}
          {isPlaying ? '暂停' : isDone ? '已完成' : '开始'}
        </button>

        <button
          onClick={handleStep}
          disabled={isPlaying || isDone}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
            isPlaying || isDone
              ? 'bg-surface-100 text-surface-400 border border-surface-200 cursor-not-allowed dark:bg-surface-800 dark:text-surface-500'
              : 'bg-surface-100 text-surface-700 border border-surface-200 hover:bg-surface-200 dark:bg-surface-800 dark:text-surface-300 dark:hover:bg-surface-700'
          }`}
        >
          <SkipForward size={15} />
          单步
        </button>

        <button
          onClick={handleReset}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-surface-100 text-surface-700 border border-surface-200 hover:bg-surface-200 transition-all duration-200 dark:bg-surface-800 dark:text-surface-300 dark:hover:bg-surface-700"
        >
          <RotateCcw size={15} />
          重置
        </button>
      </div>

      {/* ── 步骤说明 ── */}
      <div className="px-4 py-3 border-t border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800/50">
        <div className="flex items-start gap-2 text-sm">
          <span className="text-surface-400 mt-0.5 flex-shrink-0">💡</span>
          <div className="min-w-0">
            {currentStepData ? (
              <>
                <span className="text-surface-500 text-xs mr-2">
                  ({currentStep + 1}/{steps.length})
                </span>
                <span className="text-surface-700 dark:text-surface-300">
                  {currentStepData.desc}
                </span>
              </>
            ) : (
              <span className="text-surface-400">
                {currentStep === -1
                  ? '初始状态 — 点击「开始」或「单步」查看执行过程'
                  : '排序已完成 🎉'}
              </span>
            )}
          </div>
        </div>

        {/* 数组状态 */}
        <div className="mt-2 flex items-center gap-1 flex-wrap">
          <span className="text-xs text-surface-400 mr-1">数组：</span>
          <code className="text-xs bg-surface-100 dark:bg-surface-800 px-2 py-0.5 rounded font-mono text-surface-600 dark:text-surface-400">
            [{displayArray.join(', ')}]
          </code>
        </div>

        {/* 进度条 */}
        <div className="mt-2 w-full bg-surface-200 dark:bg-surface-700 rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full bg-primary-500 rounded-full transition-all duration-300"
            style={{ width: `${steps.length > 0 ? ((currentStep + 1) / steps.length) * 100 : 0}%` }}
          />
        </div>
      </div>
    </div>
  )
}
