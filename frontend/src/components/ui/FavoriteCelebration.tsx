import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CSSProperties } from 'react'
import { Heart } from 'lucide-react'

type FloatingHeart = {
  id: number
  left: number
  size: number
  delay: number
  duration: number
  drift: number
  rotation: number
}

type FavoriteCelebrationProps = {
  portalToBody?: boolean
}

export function FavoriteCelebration({
  portalToBody = true,
}: FavoriteCelebrationProps) {
  const [hearts, setHearts] = useState<FloatingHeart[]>([])
  const nextId = useRef(0)
  const timers = useRef<number[]>([])

  useEffect(() => {
    function handleFavoriteAdded() {
      const burst = Array.from({ length: 42 }, () => {
        const id = nextId.current++
        return {
          id,
          left: Math.random() * 100,
          size: 18 + Math.random() * 34,
          delay: Math.random() * 900,
          duration: 1800 + Math.random() * 1500,
          drift: (Math.random() - 0.5) * 180,
          rotation: (Math.random() - 0.5) * 70,
        }
      })

      setHearts((current) => [...current, ...burst])
      const timer = window.setTimeout(() => {
        const burstIds = new Set(burst.map((heart) => heart.id))
        setHearts((current) =>
          current.filter((heart) => !burstIds.has(heart.id)),
        )
        timers.current = timers.current.filter((id) => id !== timer)
      }, 3600)
      timers.current.push(timer)
    }

    window.addEventListener('mediahub:favorite-added', handleFavoriteAdded)
    return () => {
      window.removeEventListener('mediahub:favorite-added', handleFavoriteAdded)
      timers.current.forEach(window.clearTimeout)
    }
  }, [])

  if (hearts.length === 0) {
    return null
  }

  const celebration = (
    <div className="favorite-celebration" aria-hidden="true">
      {hearts.map((heart) => {
        const style = {
          '--heart-left': `${heart.left}%`,
          '--heart-size': `${heart.size}px`,
          '--heart-delay': `${heart.delay}ms`,
          '--heart-duration': `${heart.duration}ms`,
          '--heart-drift': `${heart.drift}px`,
          '--heart-rotation': `${heart.rotation}deg`,
        } as CSSProperties

        return (
          <Heart
            key={heart.id}
            className="favorite-celebration-heart"
            style={style}
            fill="currentColor"
            strokeWidth={1.4}
          />
        )
      })}
    </div>
  )

  return portalToBody
    ? createPortal(celebration, document.body)
    : celebration
}
