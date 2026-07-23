/** 极简鹿角 SVG — 流畅曲线勾勒鹿角，灵感来源于瑞幸咖啡的品牌线条美学 */
export default function AntlerLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* 左鹿角 — 主茎从底部中心蜿蜒向上、向外弯曲 */}
      <path d="M20 30 Q18 22 10 16 Q5 12 2 6" />
      {/* 左第一分支 — 从主茎中部向外分叉 */}
      <path d="M14 18 Q10 12 4 10" />
      {/* 左第二分支 — 靠近顶端的小分叉 */}
      <path d="M8 13 Q5 9 1 10" />
      {/* 右鹿角 — 对称弯曲 */}
      <path d="M20 30 Q22 22 30 16 Q35 12 38 6" />
      {/* 右第一分支 */}
      <path d="M26 18 Q30 12 36 10" />
      {/* 右第二分支 */}
      <path d="M32 13 Q35 9 39 10" />
    </svg>
  )
}
