import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

interface PageTransitionProps {
  children: React.ReactNode
}

export default function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation()
  const [displayChildren, setDisplayChildren] = useState(children)
  const [transitionStage, setTransitionStage] = useState<'enter' | 'exit'>('enter')
  const prevPath = useRef(location.pathname)

  useEffect(() => {
    if (location.pathname !== prevPath.current) {
      setTransitionStage('exit')
      const timer = setTimeout(() => {
        prevPath.current = location.pathname
        setDisplayChildren(children)
        setTransitionStage('enter')
      }, 150)
      return () => clearTimeout(timer)
    } else {
      setDisplayChildren(children)
    }
  }, [location.pathname, children])

  return (
    <div className={`h-full ${transitionStage === 'enter' ? 'page-enter' : 'page-exit'}`}>
      {displayChildren}
    </div>
  )
}
