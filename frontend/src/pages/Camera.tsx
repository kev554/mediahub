import { useEffect, useRef, useState } from 'react'
import {
  Camera as CameraIcon,
  CircleStop,
  Grid2X2,
  FlipHorizontal,
  LockKeyhole,
  RefreshCw,
  Video,
  X,
} from 'lucide-react'

import { getGroups } from '../services/groups'
import { uploadMediaResumable } from '../services/media'
import { getUserPreferences } from '../services/users'
import type { Group } from '../types/group'
import { t } from '../lib/i18n'
import type { SelfieSegmentation } from '@mediapipe/selfie_segmentation'

type CameraProps = {
  onUploaded: () => void
  onExit: () => void
}

type FacingMode = 'environment' | 'user'
type FilterName = 'none' | 'warm' | 'mono' | 'vivid' | 'cool' | 'vintage' | 'beauty' | 'glow'
type CaptureMode = 'photo' | 'video' | 'photo-blur' | 'video-blur'
type RecordingFormat = 'webm' | 'mp4'
type PhotoFormat = 'image/jpeg' | 'image/webp' | 'image/png'
type PhotoComposition = 'standard' | 'portrait'
type VideoLook = 'standard' | 'cinematic'
type CameraRange = { min: number; max: number; step: number }
type CameraControlRanges = {
  zoom: CameraRange | null
  exposureCompensation: CameraRange | null
}
type FaceMask = 'none' | 'glasses' | 'cat' | 'crown'
type FaceLandmark = { x: number; y: number; z: number }
type FaceMeshResults = { multiFaceLandmarks?: FaceLandmark[][] }
type FaceMeshInstance = {
  setOptions: (options: Record<string, number | boolean>) => void
  onResults: (callback: (results: FaceMeshResults) => void) => void
  initialize: () => Promise<void>
  send: (input: { image: HTMLVideoElement }) => Promise<void>
  close: () => Promise<void>
}
type FaceMeshConstructor = new (options: {
  locateFile: (file: string) => string
}) => FaceMeshInstance

const isMobileDevice =
  /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const selfieSegmentationVersion = '0.1.1675465747'
const faceMeshVersion = '0.4.1633559619'

declare global {
  interface Window {
    SelfieSegmentation?: typeof SelfieSegmentation
    FaceMesh?: FaceMeshConstructor
  }
}

let selfieSegmentationScript: Promise<typeof SelfieSegmentation> | null = null
let faceMeshScript: Promise<FaceMeshConstructor> | null = null

function loadSelfieSegmentation(): Promise<typeof SelfieSegmentation> {
  if (window.SelfieSegmentation) {
    return Promise.resolve(window.SelfieSegmentation)
  }

  if (!selfieSegmentationScript) {
    selfieSegmentationScript = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@${selfieSegmentationVersion}/selfie_segmentation.js`
      script.async = true
      script.onload = () => {
        if (window.SelfieSegmentation) {
          resolve(window.SelfieSegmentation)
        } else {
          selfieSegmentationScript = null
          reject(new Error('MediaPipe segmentation constructor was not registered.'))
        }
      }
      script.onerror = () => {
        selfieSegmentationScript = null
        reject(new Error('MediaPipe segmentation script could not be loaded.'))
      }
      document.head.appendChild(script)
    })
  }

  return selfieSegmentationScript
}

function loadFaceMesh(): Promise<FaceMeshConstructor> {
  if (window.FaceMesh) return Promise.resolve(window.FaceMesh)

  if (!faceMeshScript) {
    faceMeshScript = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@${faceMeshVersion}/face_mesh.js`
      script.async = true
      script.onload = () => {
        if (window.FaceMesh) {
          resolve(window.FaceMesh)
        } else {
          faceMeshScript = null
          reject(new Error('MediaPipe face mesh constructor was not registered.'))
        }
      }
      script.onerror = () => {
        faceMeshScript = null
        reject(new Error('MediaPipe face mesh script could not be loaded.'))
      }
      document.head.appendChild(script)
    })
  }
  return faceMeshScript
}

function drawFaceMask(
  context: CanvasRenderingContext2D,
  mask: Exclude<FaceMask, 'none'>,
  landmarks: FaceLandmark[],
  width: number,
  height: number,
  sourceWidth: number,
  sourceHeight: number,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  mirror: boolean,
) {
  const toCanvas = (index: number) => {
    const landmark = landmarks[index]
    let x = ((landmark.x * sourceWidth - sx) / sw) * width
    if (mirror) x = width - x
    return {
      x,
      y: ((landmark.y * sourceHeight - sy) / sh) * height,
    }
  }
  const leftEye = {
    x: (toCanvas(33).x + toCanvas(133).x) / 2,
    y: (toCanvas(33).y + toCanvas(133).y) / 2,
  }
  const rightEye = {
    x: (toCanvas(362).x + toCanvas(263).x) / 2,
    y: (toCanvas(362).y + toCanvas(263).y) / 2,
  }
  const centerX = (leftEye.x + rightEye.x) / 2
  const centerY = (leftEye.y + rightEye.y) / 2
  const eyeDistance = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y)
  if (eyeDistance < 8) return

  const angle = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x)
  const forehead = toCanvas(10)
  const foreheadY =
    -(forehead.x - centerX) * Math.sin(angle) +
    (forehead.y - centerY) * Math.cos(angle)

  context.save()
  context.translate(centerX, centerY)
  context.rotate(angle)
  context.lineJoin = 'round'
  context.lineCap = 'round'

  if (mask === 'glasses') {
    const lensWidth = eyeDistance * 0.44
    const lensHeight = eyeDistance * 0.3
    const lensX = eyeDistance * 0.275
    context.fillStyle = 'rgba(24, 31, 42, 0.5)'
    context.strokeStyle = '#f6d58a'
    context.lineWidth = Math.max(2, eyeDistance * 0.035)
    for (const sign of [-1, 1]) {
      const x = sign * lensX
      context.beginPath()
      context.roundRect(x - lensWidth / 2, -lensHeight / 2, lensWidth, lensHeight, lensHeight * 0.28)
      context.fill()
      context.stroke()
    }
    context.beginPath()
    context.moveTo(-eyeDistance * 0.055, 0)
    context.quadraticCurveTo(0, -eyeDistance * 0.09, eyeDistance * 0.055, 0)
    context.stroke()
  } else if (mask === 'cat') {
    const baseY = foreheadY + eyeDistance * 0.15
    for (const sign of [-1, 1]) {
      const center = sign * eyeDistance * 0.39
      context.beginPath()
      context.moveTo(center - eyeDistance * 0.3, baseY)
      context.lineTo(center - eyeDistance * 0.2, baseY - eyeDistance * 0.66)
      context.quadraticCurveTo(center, baseY - eyeDistance * 0.77, center + eyeDistance * 0.3, baseY)
      context.closePath()
      context.fillStyle = '#31243b'
      context.strokeStyle = '#f4a8cc'
      context.lineWidth = Math.max(2, eyeDistance * 0.045)
      context.fill()
      context.stroke()
      context.beginPath()
      context.moveTo(center - eyeDistance * 0.13, baseY - eyeDistance * 0.08)
      context.lineTo(center - eyeDistance * 0.1, baseY - eyeDistance * 0.49)
      context.lineTo(center + eyeDistance * 0.15, baseY - eyeDistance * 0.08)
      context.closePath()
      context.fillStyle = '#f29bc4'
      context.fill()
    }
  } else {
    const baseY = foreheadY + eyeDistance * 0.12
    const crownWidth = eyeDistance * 1.25
    const crownHeight = eyeDistance * 0.47
    context.beginPath()
    context.moveTo(-crownWidth / 2, baseY)
    context.lineTo(-crownWidth / 2, baseY - crownHeight * 0.68)
    context.lineTo(-crownWidth * 0.23, baseY - crownHeight * 0.43)
    context.lineTo(0, baseY - crownHeight)
    context.lineTo(crownWidth * 0.23, baseY - crownHeight * 0.43)
    context.lineTo(crownWidth / 2, baseY - crownHeight * 0.68)
    context.lineTo(crownWidth / 2, baseY)
    context.closePath()
    context.fillStyle = '#e6b94f'
    context.strokeStyle = '#fff0b8'
    context.lineWidth = Math.max(2, eyeDistance * 0.04)
    context.fill()
    context.stroke()
    for (const sign of [-1, 0, 1]) {
      context.beginPath()
      context.arc(sign * crownWidth * 0.29, baseY - crownHeight * 0.35, eyeDistance * 0.045, 0, Math.PI * 2)
      context.fillStyle = '#fff5ce'
      context.fill()
    }
  }
  context.restore()
}

const filters: Record<FilterName, string> = {
  none: 'none',
  warm: 'sepia(0.2) saturate(1.2)',
  mono: 'grayscale(1)',
  vivid: 'saturate(1.55) contrast(1.08)',
  cool: 'saturate(1.08) hue-rotate(12deg) brightness(1.03)',
  vintage: 'sepia(0.38) contrast(0.92) saturate(0.82)',
  beauty: 'brightness(1.08) saturate(1.12) contrast(0.94)',
  glow: 'brightness(1.12) saturate(1.18) contrast(0.9)',
}

const filterLabels: Record<FilterName, [string, string]> = {
  none: ['Naturel', 'Natural'],
  warm: ['Chaleureux', 'Warm'],
  mono: ['Noir et blanc', 'Black and white'],
  vivid: ['Vif', 'Vivid'],
  cool: ['Frais', 'Cool'],
  vintage: ['Vintage', 'Vintage'],
  beauty: ['Beauté douce', 'Soft beauty'],
  glow: ['Éclat', 'Glow'],
}

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop())
}

function cameraErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      return t(
        'L’accès à la caméra ou au micro a été refusé. Autorise-les dans les réglages du navigateur.',
        'Camera or microphone access was denied. Allow access in your browser settings.',
      )
    }
    if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      return t('Aucune caméra compatible n’a été trouvée.', 'No compatible camera was found.')
    }
    if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
      return t(
        'La caméra est utilisée par une autre application.',
        'The camera is being used by another application.',
      )
    }
  }
  return error instanceof Error
    ? error.message
    : t('Impossible d’activer la caméra.', 'Unable to start the camera.')
}

function supportedRecordingType(format: RecordingFormat): string {
  if (typeof MediaRecorder === 'undefined') return ''

  const candidates = format === 'mp4'
    ? ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4']
    : ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
}

export function Camera({ onUploaded, onExit }: CameraProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rearVideoRef = useRef<HTMLVideoElement>(null)
  const frontVideoRef = useRef<HTMLVideoElement>(null)
  const foregroundCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const rearStreamRef = useRef<MediaStream | null>(null)
  const frontStreamRef = useRef<MediaStream | null>(null)
  const segmentationRef = useRef<SelfieSegmentation | null>(null)
  const faceMeshRef = useRef<FaceMeshInstance | null>(null)
  const faceLandmarksRef = useRef<FaceLandmark[] | null>(null)
  const faceDetectedRef = useRef(false)
  const faceMeshBusyRef = useRef(false)
  const faceMeshFailedRef = useRef(false)
  const segmentationMaskRef = useRef<HTMLCanvasElement | null>(null)
  const segmentationBusyRef = useRef(false)
  const segmentationFailedRef = useRef(false)
  const animationRef = useRef<number | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])
  const timerIntervalRef = useRef<number | null>(null)
  const timerRemainingRef = useRef(0)
  const mountedRef = useRef(true)

  const [cameraActive, setCameraActive] = useState(false)
  const [dualCamera, setDualCamera] = useState(false)
  const [facingMode, setFacingMode] = useState<FacingMode>('environment')
  const [filter, setFilter] = useState<FilterName>('none')
  const [faceMask, setFaceMask] = useState<FaceMask>('none')
  const [faceMaskReady, setFaceMaskReady] = useState(false)
  const [faceDetected, setFaceDetected] = useState(false)
  const [faceMaskUnavailable, setFaceMaskUnavailable] = useState(false)
  const [quality, setQuality] = useState<'720' | '1080'>('1080')
  const [captureMode, setCaptureMode] = useState<CaptureMode>('photo')
  const [mirror, setMirror] = useState(true)
  const [frameRate, setFrameRate] = useState<24 | 30 | 60>(30)
  const [recordingFormat, setRecordingFormat] = useState<RecordingFormat>('webm')
  const [photoFormat, setPhotoFormat] = useState<PhotoFormat>('image/jpeg')
  const [photoQuality, setPhotoQuality] = useState<'standard' | 'high'>('high')
  const [photoComposition, setPhotoComposition] = useState<PhotoComposition>('standard')
  const [videoLook, setVideoLook] = useState<VideoLook>('standard')
  const [blurLoading, setBlurLoading] = useState(false)
  const [blurReady, setBlurReady] = useState(false)
  const [blurMaskReady, setBlurMaskReady] = useState(false)
  const [blurIntensity, setBlurIntensity] = useState(18)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [timerSeconds, setTimerSeconds] = useState<0 | 3 | 5 | 10>(0)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [cameraControlRanges, setCameraControlRanges] = useState<CameraControlRanges>({
    zoom: null,
    exposureCompensation: null,
  })
  const [zoom, setZoom] = useState(1)
  const [exposureCompensation, setExposureCompensation] = useState(0)
  const [recording, setRecording] = useState(false)
  const [groups, setGroups] = useState<Group[]>([])
  const [visibility, setVisibility] = useState<'private' | 'group'>('private')
  const [groupId, setGroupId] = useState<number | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const isBlurCapture = captureMode === 'photo-blur' || captureMode === 'video-blur'
  const isPhotoCapture = captureMode === 'photo' || captureMode === 'photo-blur'
  const isVideoCapture = !isPhotoCapture

  useEffect(() => {
    mountedRef.current = true
    void getGroups()
      .then(setGroups)
      .catch((cause: unknown) => {
        setError(
          cause instanceof Error
            ? cause.message
            : t('Impossible de charger les groupes.', 'Could not load groups.'),
        )
      })

    void getUserPreferences()
      .then((preferences) => setVisibility(preferences.default_visibility))
      .catch(() => {
        setMessage(t(
          'Les médias resteront privés par défaut.',
          'Media will remain private by default.',
        ))
      })

    return () => {
      mountedRef.current = false
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current)
      }
      if (recorderRef.current?.state === 'recording') {
        recorderRef.current.ondataavailable = null
        recorderRef.current.onstop = null
        recorderRef.current.stop()
      }
      if (timerIntervalRef.current !== null) {
        window.clearInterval(timerIntervalRef.current)
      }
      stopStream(rearStreamRef.current)
      stopStream(frontStreamRef.current)
      void segmentationRef.current?.close()
      segmentationRef.current = null
      void faceMeshRef.current?.close()
      faceMeshRef.current = null
      faceLandmarksRef.current = null
      rearStreamRef.current = null
      frontStreamRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!cameraActive || !isBlurCapture || segmentationRef.current) return

    let cancelled = false
    let segmenter: SelfieSegmentation | null = null
    setBlurLoading(true)
    setBlurReady(false)
    setBlurMaskReady(false)
    setError('')

    void (async () => {
      try {
        const SelfieSegmentation = await loadSelfieSegmentation()
        segmenter = new SelfieSegmentation({
          locateFile: (file) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@${selfieSegmentationVersion}/${file}`,
        })
        segmenter.setOptions({ modelSelection: 1 })
        segmenter.onResults((results) => {
          const firstMask = segmentationMaskRef.current === null
          const mask =
            segmentationMaskRef.current ?? document.createElement('canvas')
          segmentationMaskRef.current = mask
          mask.width = results.segmentationMask.width
          mask.height = results.segmentationMask.height
          const context = mask.getContext('2d')
          if (context) {
            context.drawImage(results.segmentationMask, 0, 0)
            if (firstMask && mountedRef.current) setBlurMaskReady(true)
          }
        })
        await segmenter.initialize()
        if (cancelled) {
          await segmenter.close()
          return
        }
        segmentationRef.current = segmenter
        setBlurReady(true)
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error
            ? t(`Impossible de charger le modèle de flou : ${cause.message}`, `Could not load blur model: ${cause.message}`)
            : t('Impossible de charger le modèle de flou.', 'Could not load the blur model.'))
        }
      } finally {
        if (!cancelled) setBlurLoading(false)
      }
    })()

    return () => {
      cancelled = true
      if (segmenter && segmentationRef.current === segmenter) {
        segmentationRef.current = null
        void segmenter.close()
      }
      segmentationMaskRef.current = null
      setBlurMaskReady(false)
      segmentationFailedRef.current = false
      segmentationBusyRef.current = false
      setBlurReady(false)
    }
  }, [cameraActive, isBlurCapture])

  useEffect(() => {
    if (!cameraActive || faceMask === 'none') {
      faceMeshRef.current = null
      faceLandmarksRef.current = null
      faceDetectedRef.current = false
      return
    }

    let cancelled = false
    let detector: FaceMeshInstance | null = null
    faceMeshFailedRef.current = false
    faceMeshBusyRef.current = false
    faceLandmarksRef.current = null
    faceDetectedRef.current = false

    void (async () => {
      try {
        const FaceMesh = await loadFaceMesh()
        detector = new FaceMesh({
          locateFile: (file) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@${faceMeshVersion}/${file}`,
        })
        detector.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        })
        detector.onResults((results) => {
          const landmarks = results.multiFaceLandmarks?.[0] ?? null
          faceLandmarksRef.current = landmarks
          const detected = landmarks !== null
          if (faceDetectedRef.current !== detected) {
            faceDetectedRef.current = detected
            if (mountedRef.current) setFaceDetected(detected)
          }
        })
        await detector.initialize()
        if (cancelled) {
          await detector.close()
          return
        }
        faceMeshRef.current = detector
        setFaceMaskReady(true)
      } catch (cause) {
        if (!cancelled) {
          setFaceMaskUnavailable(true)
          setError(cause instanceof Error
            ? t(`Impossible de charger le suivi du visage : ${cause.message}`, `Could not load face tracking: ${cause.message}`)
            : t('Impossible de charger le suivi du visage.', 'Could not load face tracking.'))
        }
      }
    })()

    return () => {
      cancelled = true
      if (detector && faceMeshRef.current === detector) {
        faceMeshRef.current = null
        void detector.close()
      }
      faceLandmarksRef.current = null
      faceDetectedRef.current = false
      faceMeshBusyRef.current = false
    }
  }, [cameraActive, faceMask])

  useEffect(() => {
    if (!cameraActive) return

    let frameId = 0
    let lastSegmentationAt = 0
    let lastFaceMeshAt = 0
    const renderFrame = () => {
      const canvas = canvasRef.current
      const context = canvas?.getContext('2d')
      const rearVideo = rearVideoRef.current
      const frontVideo = frontVideoRef.current

      if (canvas && context) {
        const primaryVideo = rearStreamRef.current ? rearVideo : frontVideo
        const sourceWidth = primaryVideo?.videoWidth || 1280
        const sourceHeight = primaryVideo?.videoHeight || 720
        const composition =
          isPhotoCapture && photoComposition === 'portrait'
            ? 'portrait'
            : isVideoCapture && videoLook === 'cinematic'
              ? 'cinematic'
              : 'standard'
        const width = composition === 'portrait'
          ? 960
          : composition === 'cinematic'
            ? 1920
            : sourceWidth
        const height = composition === 'portrait'
          ? 1280
          : composition === 'cinematic'
            ? 804
            : sourceHeight
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width
          canvas.height = height
        }

        context.fillStyle = '#090909'
        context.fillRect(0, 0, width, height)
        context.filter = videoLook === 'cinematic' && isVideoCapture
          ? `${filters[filter]} contrast(1.08) saturate(0.9)`
          : filters[filter]

        if (primaryVideo && primaryVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          const sourceAspect = sourceWidth / sourceHeight
          const targetAspect = width / height
          let sx = 0
          let sy = 0
          let sw = sourceWidth
          let sh = sourceHeight
          if (sourceAspect > targetAspect) {
            sw = sourceHeight * targetAspect
            sx = (sourceWidth - sw) / 2
          } else {
            sh = sourceWidth / targetAspect
            sy = (sourceHeight - sh) / 2
          }

          const drawPrimary = (
            targetContext: CanvasRenderingContext2D,
            source: CanvasImageSource,
          ) => {
            if (mirror) {
              targetContext.save()
              targetContext.translate(width, 0)
              targetContext.scale(-1, 1)
              targetContext.drawImage(source, sx, sy, sw, sh, 0, 0, width, height)
              targetContext.restore()
            } else {
              targetContext.drawImage(source, sx, sy, sw, sh, 0, 0, width, height)
            }
          }

          if (isBlurCapture) {
            context.save()
            context.filter = `blur(${blurIntensity}px)`
            drawPrimary(context, primaryVideo)
            context.restore()

            const mask = segmentationMaskRef.current
            if (mask) {
              const foreground =
                foregroundCanvasRef.current ?? document.createElement('canvas')
              foregroundCanvasRef.current = foreground
              foreground.width = width
              foreground.height = height
              const foregroundContext = foreground.getContext('2d')
              if (foregroundContext) {
                foregroundContext.clearRect(0, 0, width, height)
                foregroundContext.filter = filters[filter]
                drawPrimary(foregroundContext, primaryVideo)
                foregroundContext.globalCompositeOperation = 'destination-in'
                foregroundContext.filter = 'none'
                if (mirror) {
                  foregroundContext.save()
                  foregroundContext.translate(width, 0)
                  foregroundContext.scale(-1, 1)
                  foregroundContext.drawImage(mask, sx, sy, sw, sh, 0, 0, width, height)
                  foregroundContext.restore()
                } else {
                  foregroundContext.drawImage(mask, sx, sy, sw, sh, 0, 0, width, height)
                }
                foregroundContext.globalCompositeOperation = 'source-over'
                context.filter = 'none'
                context.drawImage(foreground, 0, 0)
              }
            }
          } else {
            drawPrimary(context, primaryVideo)
          }

          const now = performance.now()
          if (faceMask !== 'none') {
            const landmarks = faceLandmarksRef.current
            if (landmarks && faceMaskReady) {
              drawFaceMask(
                context,
                faceMask,
                landmarks,
                width,
                height,
                sourceWidth,
                sourceHeight,
                sx,
                sy,
                sw,
                sh,
                mirror,
              )
            }

            const faceMesh = faceMeshRef.current
            if (
              faceMaskReady &&
              faceMesh &&
              !faceMeshBusyRef.current &&
              !faceMeshFailedRef.current &&
              now - lastFaceMeshAt >= 90
            ) {
              faceMeshBusyRef.current = true
              lastFaceMeshAt = now
              void faceMesh.send({ image: primaryVideo })
                .catch((cause: unknown) => {
                  faceMeshFailedRef.current = true
                  setError(cause instanceof Error
                    ? t(`Le suivi du visage a échoué : ${cause.message}`, `Face tracking failed: ${cause.message}`)
                    : t('Le suivi du visage a échoué.', 'Face tracking failed.'))
                })
                .finally(() => {
                  faceMeshBusyRef.current = false
                })
            }
          }

          const segmenter = segmentationRef.current
          if (
            isBlurCapture &&
            blurReady &&
            segmenter &&
            !segmentationBusyRef.current &&
            !segmentationFailedRef.current &&
            now - lastSegmentationAt >= 70
          ) {
            segmentationBusyRef.current = true
            lastSegmentationAt = now
            void segmenter.send({ image: primaryVideo })
              .catch((cause: unknown) => {
                segmentationFailedRef.current = true
                setError(cause instanceof Error
                  ? t(`Le traitement du flou a échoué : ${cause.message}`, `Blur processing failed: ${cause.message}`)
                  : t('Le traitement du flou a échoué.', 'Blur processing failed.'))
              })
              .finally(() => {
                segmentationBusyRef.current = false
              })
          }
        }

        if (
          rearStreamRef.current &&
          frontStreamRef.current &&
          frontVideo &&
          frontVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
        ) {
          const insetWidth = Math.round(width * 0.29)
          const insetHeight = Math.round(insetWidth * (frontVideo.videoHeight / frontVideo.videoWidth || 1))
          const insetX = width - insetWidth - Math.round(width * 0.035)
          const insetY = height - insetHeight - Math.round(height * 0.04)
          const radius = Math.max(12, Math.round(width * 0.018))
          context.save()
          context.beginPath()
          context.roundRect(insetX, insetY, insetWidth, insetHeight, radius)
          context.clip()
          if (mirror) {
            context.translate(insetX + insetWidth, 0)
            context.scale(-1, 1)
            context.drawImage(frontVideo, 0, insetY, insetWidth, insetHeight)
          } else {
            context.drawImage(frontVideo, insetX, insetY, insetWidth, insetHeight)
          }
          context.restore()
          context.filter = 'none'
          context.lineWidth = Math.max(3, Math.round(width * 0.004))
          context.strokeStyle = 'rgba(255,255,255,0.92)'
          context.beginPath()
          context.roundRect(insetX, insetY, insetWidth, insetHeight, radius)
          context.stroke()
        }
        context.filter = 'none'
      }
      frameId = requestAnimationFrame(renderFrame)
      animationRef.current = frameId
    }

    frameId = requestAnimationFrame(renderFrame)
    animationRef.current = frameId
    return () => cancelAnimationFrame(frameId)
  }, [blurIntensity, blurReady, cameraActive, captureMode, faceMask, faceMaskReady, filter, isBlurCapture, isPhotoCapture, isVideoCapture, mirror, photoComposition, videoLook])

  const connectVideo = async (
    video: HTMLVideoElement | null,
    stream: MediaStream,
  ) => {
    if (!video) return
    video.srcObject = stream
    await video.play()
  }

  const startCamera = async (mode = facingMode, requestDual = dualCamera) => {
    const useDualCamera = requestDual && isMobileDevice
    setError('')
    setMessage('')
    setFaceMaskUnavailable(false)
    setFaceMaskReady(false)
    faceDetectedRef.current = false
    setFaceDetected(false)
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(t(
        'La caméra nécessite un navigateur récent et une connexion sécurisée (HTTPS).',
        'Camera access requires a recent browser and a secure connection (HTTPS).',
      ))
      return
    }

    try {
      const videoConstraints: MediaTrackConstraints = {
        facingMode: useDualCamera ? 'environment' : mode,
        width: { ideal: quality === '1080' ? 1920 : 1280 },
        height: { ideal: quality === '1080' ? 1080 : 720 },
        frameRate: { ideal: frameRate },
      }
      let primaryStream: MediaStream
      try {
        primaryStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: videoConstraints,
        })
      } catch {
        primaryStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: videoConstraints,
        })
      }
      const primaryUsesRearVideo = useDualCamera || mode === 'environment'
      rearStreamRef.current = primaryUsesRearVideo ? primaryStream : null
      frontStreamRef.current = primaryUsesRearVideo ? null : primaryStream
      const videoTrack = primaryStream.getVideoTracks()[0]
      const capabilities = videoTrack?.getCapabilities() as
        | (MediaTrackCapabilities & {
            zoom?: CameraRange
            exposureCompensation?: CameraRange
          })
        | undefined
      const zoomRange = capabilities?.zoom && capabilities.zoom.max > capabilities.zoom.min
        ? capabilities.zoom
        : null
      const exposureRange =
        capabilities?.exposureCompensation &&
        capabilities.exposureCompensation.max > capabilities.exposureCompensation.min
          ? capabilities.exposureCompensation
          : null
      setCameraControlRanges({
        zoom: zoomRange,
        exposureCompensation: exposureRange,
      })
      if (zoomRange) setZoom(Math.max(zoomRange.min, Math.min(zoomRange.max, 1)))
      else setZoom(1)
      if (exposureRange) {
        setExposureCompensation(Math.max(
          exposureRange.min,
          Math.min(exposureRange.max, 0),
        ))
      } else {
        setExposureCompensation(0)
      }
      await connectVideo(
        primaryUsesRearVideo ? rearVideoRef.current : frontVideoRef.current,
        primaryStream,
      )

      if (useDualCamera) {
        try {
          const selfieStream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              facingMode: 'user',
              width: { ideal: 720 },
              height: { ideal: 1280 },
            },
          })
          frontStreamRef.current = selfieStream
          await connectVideo(frontVideoRef.current, selfieStream)
          setMessage(t(
            'Double caméra activée : la caméra avant apparaît en incrustation.',
            'Dual camera is on: the front camera appears in picture-in-picture.',
          ))
        } catch {
          setDualCamera(false)
          setMessage(t(
            'La double caméra n’est pas prise en charge par cet appareil. La caméra arrière reste active.',
            'Dual camera is not supported on this device. The rear camera is still active.',
          ))
        }
      }

      setFacingMode(mode)
      setCameraActive(true)
    } catch (cause) {
      stopStream(rearStreamRef.current)
      stopStream(frontStreamRef.current)
      rearStreamRef.current = null
      frontStreamRef.current = null
      setError(cameraErrorMessage(cause))
    }
  }

  const stopCamera = () => {
    if (timerIntervalRef.current !== null) {
      window.clearInterval(timerIntervalRef.current)
      timerIntervalRef.current = null
    }
    timerRemainingRef.current = 0
    setCountdown(null)
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
    stopStream(rearStreamRef.current)
    stopStream(frontStreamRef.current)
    rearStreamRef.current = null
    frontStreamRef.current = null
    if (rearVideoRef.current) rearVideoRef.current.srcObject = null
    if (frontVideoRef.current) frontVideoRef.current.srcObject = null
    setCameraActive(false)
    setRecording(false)
    setFaceMaskReady(false)
    faceDetectedRef.current = false
    setFaceDetected(false)
    setCameraControlRanges({ zoom: null, exposureCompensation: null })
  }

  const switchCamera = async () => {
    const nextMode = dualCamera
      ? 'environment'
      : facingMode === 'environment'
        ? 'user'
        : 'environment'
    setDualCamera(false)
    stopCamera()
    setFacingMode(nextMode)
    await new Promise((resolve) => window.setTimeout(resolve, 150))
    await startCamera(nextMode, false)
  }

  const capturePhoto = () => {
    if (faceMask !== 'none' && (!faceMaskReady || !faceDetected)) {
      setError(faceMaskReady
        ? t('Place ton visage dans le cadre avant de capturer.', 'Position your face in the frame before capturing.')
        : t('Le masque est encore en cours de préparation ou indisponible.', 'The mask is still preparing or unavailable.'))
      return
    }
    if (isBlurCapture && (!blurReady || !blurMaskReady || !segmentationMaskRef.current)) {
      setError(t('Le flou d’arrière-plan est encore en cours de préparation.', 'Background blur is still preparing.'))
      return
    }
    const canvas = canvasRef.current
    if (!canvas || canvas.width === 0 || canvas.height === 0) {
      setError(t('La caméra n’est pas encore prête.', 'The camera is not ready yet.'))
      return
    }
    const format = photoFormat
    const outputWidth = photoQuality === 'high'
      ? Math.min(canvas.width, 1920)
      : Math.min(canvas.width, 1280)
    const outputHeight = Math.round(canvas.height * (outputWidth / canvas.width))
    const outputCanvas = document.createElement('canvas')
    outputCanvas.width = outputWidth
    outputCanvas.height = outputHeight
    const context = outputCanvas.getContext('2d')
    if (!context) {
      setError(t('Impossible de créer la photo.', 'Could not create the photo.'))
      return
    }
    context.drawImage(canvas, 0, 0, outputWidth, outputHeight)
    const extensions: Record<PhotoFormat, string> = {
      'image/jpeg': 'jpg',
      'image/webp': 'webp',
      'image/png': 'png',
    }
    outputCanvas.toBlob((blob) => {
      if (!blob) {
        setError(t('Impossible de créer la photo.', 'Could not create the photo.'))
        return
      }
      const actualFormat = (blob.type in extensions ? blob.type : 'image/png') as PhotoFormat
      setPendingFile(new File([blob], `mediahub-${Date.now()}.${extensions[actualFormat]}`, {
        type: blob.type,
        lastModified: Date.now(),
      }))
      setMessage(t('Photo prête à être enregistrée dans MediaHub.', 'Photo is ready to save to MediaHub.'))
    }, format, photoQuality === 'high' ? 0.96 : 0.84)
  }

  const startRecording = () => {
    if (faceMask !== 'none' && (!faceMaskReady || !faceDetected)) {
      setError(faceMaskReady
        ? t('Place ton visage dans le cadre avant de filmer.', 'Position your face in the frame before recording.')
        : t('Le masque est encore en cours de préparation ou indisponible.', 'The mask is still preparing or unavailable.'))
      return
    }
    if (isBlurCapture && (!blurReady || !blurMaskReady || !segmentationMaskRef.current)) {
      setError(t('Le flou d’arrière-plan est encore en cours de préparation.', 'Background blur is still preparing.'))
      return
    }
    const canvas = canvasRef.current
    if (!canvas || typeof MediaRecorder === 'undefined' || !canvas.captureStream) {
      setError(t(
        'L’enregistrement vidéo n’est pas pris en charge par ce navigateur.',
        'Video recording is not supported by this browser.',
      ))
      return
    }
    const mediaType = supportedRecordingType(recordingFormat)
    if (!mediaType) {
      setError(t(
        `Le format ${recordingFormat.toUpperCase()} n’est pas pris en charge par ce navigateur.`,
        `${recordingFormat.toUpperCase()} format is not supported by this browser.`,
      ))
      return
    }

    const outputStream = canvas.captureStream(videoLook === 'cinematic' ? 24 : frameRate)
    const audioStream = rearStreamRef.current ?? frontStreamRef.current
    audioStream?.getAudioTracks().forEach((track) => outputStream.addTrack(track.clone()))
    const recorder = new MediaRecorder(outputStream, {
      mimeType: mediaType,
      videoBitsPerSecond: quality === '1080' ? 6_000_000 : 3_000_000,
    })
    recordedChunksRef.current = []
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) recordedChunksRef.current.push(event.data)
    }
    recorder.onerror = () => {
      setError(t('Une erreur a interrompu l’enregistrement.', 'An error interrupted the recording.'))
      setRecording(false)
      outputStream.getTracks().forEach((track) => track.stop())
    }
    recorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: mediaType })
      outputStream.getTracks().forEach((track) => track.stop())
      if (blob.size > 0 && mountedRef.current) {
        const extension = recordingFormat
        setPendingFile(new File([blob], `mediahub-${Date.now()}.${extension}`, {
          type: mediaType.split(';')[0],
          lastModified: Date.now(),
        }))
        setMessage(t('Vidéo prête à être enregistrée dans MediaHub.', 'Video is ready to save to MediaHub.'))
      }
      setRecording(false)
    }
    recorderRef.current = recorder
    recorder.start(1000)
    setRecording(true)
    setError('')
    setMessage(t('Enregistrement en cours…', 'Recording…'))
  }

  const capture = () => {
    if (isPhotoCapture) {
      if (timerSeconds > 0) {
        if (timerIntervalRef.current !== null) {
          window.clearInterval(timerIntervalRef.current)
        }
        timerRemainingRef.current = timerSeconds
        setCountdown(timerSeconds)
        timerIntervalRef.current = window.setInterval(() => {
          timerRemainingRef.current -= 1
          if (timerRemainingRef.current <= 0) {
            if (timerIntervalRef.current !== null) {
              window.clearInterval(timerIntervalRef.current)
              timerIntervalRef.current = null
            }
            setCountdown(null)
            capturePhoto()
          } else {
            setCountdown(timerRemainingRef.current)
          }
        }, 1000)
        return
      }
      capturePhoto()
    } else if (recording) {
      stopRecording()
    } else {
      startRecording()
    }
  }

  const applyCameraControl = async (
    control: 'zoom' | 'exposureCompensation',
    value: number,
  ) => {
    const stream = rearStreamRef.current ?? frontStreamRef.current
    const track = stream?.getVideoTracks()[0]
    if (!track) {
      setError(t('La caméra n’est pas disponible pour ce réglage.', 'Camera is unavailable for this setting.'))
      return
    }

    try {
      await track.applyConstraints({
        advanced: [{ [control]: value }],
      } as MediaTrackConstraints)
      if (control === 'zoom') setZoom(value)
      else setExposureCompensation(value)
      setError('')
    } catch (cause) {
      setError(cause instanceof Error
        ? t(`Ce réglage n’est pas pris en charge : ${cause.message}`, `This setting is not supported: ${cause.message}`)
        : t('Ce réglage n’est pas pris en charge par la caméra.', 'This camera does not support this setting.'))
    }
  }

  const cancelCountdown = () => {
    if (timerIntervalRef.current !== null) {
      window.clearInterval(timerIntervalRef.current)
      timerIntervalRef.current = null
    }
    timerRemainingRef.current = 0
    setCountdown(null)
  }

  const stopRecording = () => {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop()
    }
  }

  const uploadCapture = async () => {
    if (!pendingFile) return
    if (visibility === 'group' && groupId === null) {
      setError(t('Sélectionne un groupe pour partager ce média.', 'Select a group to share this media.'))
      return
    }
    setUploading(true)
    setError('')
    try {
      await uploadMediaResumable(pendingFile, visibility, groupId ?? undefined)
      setPendingFile(null)
      setMessage(t('Média enregistré avec succès dans MediaHub.', 'Media saved to MediaHub successfully.'))
      onUploaded()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('Impossible d’enregistrer le média.', 'Could not save the media.'))
    } finally {
      setUploading(false)
    }
  }

  const cameraCanvasMode =
    isPhotoCapture && photoComposition === 'portrait'
      ? 'portrait'
      : isVideoCapture && videoLook === 'cinematic'
        ? 'cinematic'
        : 'standard'
  const faceMaskLoading =
    faceMask !== 'none' && cameraActive && !faceMaskReady && !faceMaskUnavailable
  const switchCameraLabel = dualCamera || facingMode === 'user'
    ? t('Passer à la caméra arrière', 'Switch to rear camera')
    : t('Passer à la caméra avant', 'Switch to front camera')

  return (
    <div className="camera-page">
      <header className="camera-topbar">
        <button type="button" className="camera-overlay-button" onClick={onExit} aria-label={t('Quitter la caméra', 'Exit camera')}>
          <X size={21} aria-hidden="true" />
        </button>
        {cameraActive && (
          <button
            type="button"
            className="camera-overlay-button camera-topbar-flip"
            onClick={() => void switchCamera()}
            disabled={recording}
            aria-label={switchCameraLabel}
            title={switchCameraLabel}
          >
            <RefreshCw size={19} aria-hidden="true" />
          </button>
        )}
      </header>

      <div className="camera-preview">
        <video ref={rearVideoRef} className="camera-source-video" muted playsInline />
        <video ref={frontVideoRef} className="camera-source-video" muted playsInline />
        {cameraActive ? (
          <canvas ref={canvasRef} className={`camera-canvas camera-canvas-${cameraCanvasMode}`} aria-label={t('Aperçu de la caméra', 'Camera preview')} />
        ) : (
          <div className="camera-placeholder">
            <CameraIcon size={48} strokeWidth={1.3} aria-hidden="true" />
            <strong>{t('Ta caméra, ton espace', 'Your camera, your space')}</strong>
            <span>{t('Les médias capturés restent privés jusqu’à ce que tu choisisses de les partager.', 'Captured media stays private unless you choose to share it.')}</span>
          </div>
        )}
        {recording && <span className="camera-recording-indicator">{t('EN DIRECT', 'RECORDING')}</span>}
        {countdown !== null && (
          <div className="camera-countdown" aria-live="assertive">
            <strong>{countdown}</strong>
            <button type="button" className="camera-overlay-button" onClick={cancelCountdown}>
              {t('Annuler', 'Cancel')}
            </button>
          </div>
        )}
      </div>

      <div className="camera-overlay-controls">
        {cameraActive ? (
          <div className="camera-bottom-toolbar">
            {settingsOpen && (
              <section className="camera-settings-panel" aria-label={t('Réglages de capture', 'Capture settings')}>
                <header>
                  <strong>{t('Réglages de capture', 'Capture settings')}</strong>
                  <button type="button" className="camera-settings-close" onClick={() => setSettingsOpen(false)} aria-label={t('Fermer les réglages', 'Close settings')}>×</button>
                </header>
                <div className="camera-settings-section">
                  <span>{t('MASQUES EN RÉALITÉ AUGMENTÉE', 'AUGMENTED REALITY MASKS')}</span>
                  <label className="camera-mask-select">
                    <span>{t('Masque', 'Mask')}</span>
                    <select
                      value={faceMask}
                      onChange={(event) => {
                        setFaceMaskUnavailable(false)
                        setFaceMaskReady(false)
                        faceDetectedRef.current = false
                        setFaceDetected(false)
                        setError('')
                        setFaceMask(event.target.value as FaceMask)
                      }}
                      disabled={recording}
                    >
                      <option value="none">{t('Aucun', 'None')}</option>
                      <option value="glasses">{t('Lunettes dorées', 'Golden glasses')}</option>
                      <option value="cat">{t('Oreilles de chat', 'Cat ears')}</option>
                      <option value="crown">{t('Couronne', 'Crown')}</option>
                    </select>
                    <small aria-live="polite">
                      {faceMaskLoading
                        ? t('Chargement du suivi du visage…', 'Loading face tracking…')
                        : faceMask !== 'none' && faceMaskReady
                          ? faceDetected
                            ? t('Visage détecté — masque actif.', 'Face detected — mask is active.')
                            : t('Place ton visage dans le cadre.', 'Position your face in the frame.')
                          : faceMask !== 'none'
                            ? t('Le suivi du visage est indisponible.', 'Face tracking is unavailable.')
                            : t('Les masques fonctionnent avec la caméra avant ou arrière.', 'Masks work with the front or rear camera.')}
                    </small>
                  </label>
                </div>
                <div className="camera-settings-section">
                  <span>{t('FILTRES', 'FILTERS')}</span>
                  <div className="camera-filter-grid">
                    {(Object.keys(filters) as FilterName[]).map((name) => (
                      <button
                        key={name}
                        type="button"
                        className={`camera-filter-option ${filter === name ? 'is-selected' : ''}`}
                        onClick={() => setFilter(name)}
                        aria-pressed={filter === name}
                      >
                        <span className={`camera-filter-swatch filter-${name}`} />
                        {t(filterLabels[name][0], filterLabels[name][1])}
                      </button>
                    ))}
                  </div>
                </div>
                {isBlurCapture && (
                  <label className="camera-blur-intensity">
                    <span>
                      {t('Intensité du flou', 'Blur intensity')}
                      <strong>{blurIntensity}px</strong>
                    </span>
                    <input
                      type="range"
                      min="4"
                      max="32"
                      step="1"
                      value={blurIntensity}
                      onChange={(event) => setBlurIntensity(Number(event.target.value))}
                      aria-label={t('Intensité du flou d’arrière-plan', 'Background blur intensity')}
                    />
                    <small>{t('De léger à prononcé', 'From subtle to strong')}</small>
                  </label>
                )}
                <div className="camera-range-controls">
                  <span>{t('ZOOM ET EXPOSITION', 'ZOOM & EXPOSURE')}</span>
                  {cameraControlRanges.zoom ? (
                    <label className="camera-control-slider">
                      <span>
                        {t('Zoom', 'Zoom')}
                        <strong>{zoom.toFixed(1)}×</strong>
                      </span>
                      <input
                        type="range"
                        min={cameraControlRanges.zoom.min}
                        max={cameraControlRanges.zoom.max}
                        step={cameraControlRanges.zoom.step || 0.1}
                        value={zoom}
                        onChange={(event) => void applyCameraControl('zoom', Number(event.target.value))}
                        aria-label={t('Zoom caméra', 'Camera zoom')}
                      />
                    </label>
                  ) : (
                    <small>{t('Le zoom matériel n’est pas disponible sur cette caméra.', 'Hardware zoom is not available on this camera.')}</small>
                  )}
                  {cameraControlRanges.exposureCompensation ? (
                    <label className="camera-control-slider">
                      <span>
                        {t('Exposition', 'Exposure')}
                        <strong>{exposureCompensation > 0 ? '+' : ''}{exposureCompensation.toFixed(1)}</strong>
                      </span>
                      <input
                        type="range"
                        min={cameraControlRanges.exposureCompensation.min}
                        max={cameraControlRanges.exposureCompensation.max}
                        step={cameraControlRanges.exposureCompensation.step || 0.1}
                        value={exposureCompensation}
                        onChange={(event) => void applyCameraControl('exposureCompensation', Number(event.target.value))}
                        aria-label={t('Compensation d’exposition', 'Exposure compensation')}
                      />
                    </label>
                  ) : (
                    <small>{t('Le réglage d’exposition n’est pas disponible sur cette caméra.', 'Exposure control is not available on this camera.')}</small>
                  )}
                </div>
                <div className="camera-settings-toggles">
                  <button type="button" className="camera-setting-toggle" onClick={() => setMirror((value) => !value)} aria-pressed={mirror}>
                    <FlipHorizontal size={17} aria-hidden="true" />
                    {t('Mode miroir', 'Mirror mode')}
                    <span>{mirror ? t('Activé', 'On') : t('Désactivé', 'Off')}</span>
                  </button>
                  {!dualCamera && !isMobileDevice && (
                    <button type="button" className="camera-setting-toggle" onClick={() => void switchCamera()} disabled={recording}>
                      <CameraIcon size={17} aria-hidden="true" />
                      {t('Changer de caméra', 'Flip camera')}
                    </button>
                  )}
                  {isMobileDevice && (
                    <label className="camera-setting-toggle">
                      <span>{t('Double caméra', 'Dual camera')}</span>
                      <input type="checkbox" checked={dualCamera} onChange={(event) => {
                        setDualCamera(event.target.checked)
                        stopCamera()
                        window.setTimeout(() => void startCamera(facingMode, event.target.checked), 0)
                      }} disabled={recording} />
                    </label>
                  )}
                </div>
                <div className="camera-settings-grid">
                  {isPhotoCapture ? (
                    <>
                      <label>{t('Qualité photo', 'Photo quality')}
                        <select value={photoQuality} onChange={(event) => setPhotoQuality(event.target.value as 'standard' | 'high')}>
                          <option value="standard">{t('Standard', 'Standard')}</option>
                          <option value="high">{t('Élevée', 'High')}</option>
                        </select>
                      </label>
                      <label>{t('Format photo', 'Photo format')}
                        <select value={photoFormat} onChange={(event) => setPhotoFormat(event.target.value as PhotoFormat)}>
                          <option value="image/jpeg">JPEG</option>
                          <option value="image/webp">WebP</option>
                          <option value="image/png">PNG</option>
                        </select>
                      </label>
                      <label>{t('Cadrage photo', 'Photo framing')}
                        <select value={photoComposition} onChange={(event) => setPhotoComposition(event.target.value as PhotoComposition)}>
                          <option value="standard">{t('Standard', 'Standard')}</option>
                          <option value="portrait">{t('Portrait 3:4', 'Portrait 3:4')}</option>
                        </select>
                      </label>
                      <label>{t('Retardateur', 'Timer')}
                        <select
                          value={timerSeconds}
                          onChange={(event) => setTimerSeconds(Number(event.target.value) as 0 | 3 | 5 | 10)}
                          disabled={countdown !== null}
                        >
                          <option value={0}>{t('Désactivé', 'Off')}</option>
                          <option value={3}>3 {t('secondes', 'seconds')}</option>
                          <option value={5}>5 {t('secondes', 'seconds')}</option>
                          <option value={10}>10 {t('secondes', 'seconds')}</option>
                        </select>
                      </label>
                    </>
                  ) : (
                    <>
                      <label>{t('Qualité vidéo', 'Video quality')}
                        <select value={quality} onChange={(event) => setQuality(event.target.value as '720' | '1080')} disabled={recording}>
                          <option value="720">720p</option>
                          <option value="1080">1080p</option>
                        </select>
                      </label>
                      <label>{t('Format vidéo', 'Video format')}
                        <select value={recordingFormat} onChange={(event) => setRecordingFormat(event.target.value as RecordingFormat)} disabled={recording}>
                          <option value="webm">{t('WebM (compatible)', 'WebM (compatible)')}</option>
                          <option value="mp4" disabled={!supportedRecordingType('mp4')}>{t('MP4 (si disponible)', 'MP4 (if available)')}</option>
                        </select>
                      </label>
                      <label>{t('Images par seconde', 'Frames per second')}
                        <select value={videoLook === 'cinematic' ? 24 : frameRate} onChange={(event) => setFrameRate(Number(event.target.value) as 24 | 30 | 60)} disabled={recording || videoLook === 'cinematic'}>
                          <option value={24}>24 FPS</option>
                          <option value={30}>30 FPS</option>
                          <option value={60}>60 FPS</option>
                        </select>
                      </label>
                      <label>{t('Style vidéo', 'Video look')}
                        <select value={videoLook} onChange={(event) => setVideoLook(event.target.value as VideoLook)}>
                          <option value="standard">{t('Standard', 'Standard')}</option>
                          <option value="cinematic">{t('Cinématique 2.39:1 · 24 FPS', 'Cinematic 2.39:1 · 24 FPS')}</option>
                        </select>
                      </label>
                    </>
                  )}
                </div>
              </section>
            )}

            <div className="camera-capture-actions">
              <div className="camera-mode-switch" role="group" aria-label={t('Mode de capture', 'Capture mode')}>
                <button type="button" className={captureMode === 'photo' ? 'is-selected' : ''} onClick={() => setCaptureMode('photo')} disabled={recording || countdown !== null}>
                  {t('Photo', 'Photo')}
                </button>
                <button type="button" className={captureMode === 'video' ? 'is-selected' : ''} onClick={() => setCaptureMode('video')} disabled={recording || countdown !== null}>
                  {t('Vidéo', 'Video')}
                </button>
                <button type="button" className={captureMode === 'photo-blur' ? 'is-selected' : ''} onClick={() => setCaptureMode('photo-blur')} disabled={recording || countdown !== null}>
                  {t('Photo floue', 'Photo blur')}
                </button>
                <button type="button" className={captureMode === 'video-blur' ? 'is-selected' : ''} onClick={() => setCaptureMode('video-blur')} disabled={recording || countdown !== null}>
                  {t('Vidéo floue', 'Video blur')}
                </button>
              </div>
              <button
                type="button"
                className={recording ? 'camera-record-button is-recording' : `camera-record-button ${isPhotoCapture ? 'is-photo' : ''}`}
                onClick={capture}
                disabled={countdown !== null || (faceMask !== 'none' && (!faceMaskReady || !faceDetected || faceMaskLoading)) || (isBlurCapture && (blurLoading || !blurReady || !blurMaskReady))}
                aria-label={recording ? t('Arrêter l’enregistrement', 'Stop recording') : isPhotoCapture ? t('Prendre une photo', 'Take photo') : t('Démarrer la vidéo', 'Start video')}
              >
                {recording ? <CircleStop size={22} aria-hidden="true" /> : isPhotoCapture ? <CameraIcon size={22} aria-hidden="true" /> : <Video size={22} aria-hidden="true" />}
                <span>{recording ? t('Arrêter', 'Stop') : blurLoading || faceMaskLoading ? t('Chargement…', 'Loading…') : isPhotoCapture ? t('Photo', 'Photo') : t('Vidéo', 'Video')}</span>
              </button>
              <button
                type="button"
                className={`camera-settings-button ${settingsOpen ? 'is-open' : ''}`}
                onClick={() => setSettingsOpen((open) => !open)}
                aria-label={t('Filtres et réglages', 'Filters and settings')}
                aria-expanded={settingsOpen}
              >
                <Grid2X2 size={22} aria-hidden="true" />
              </button>
            </div>
          </div>
        ) : (
          <div className="camera-start-controls">
            {isMobileDevice && (
              <label className="camera-dual-toggle">
                <input
                  type="checkbox"
                  checked={dualCamera}
                  onChange={(event) => setDualCamera(event.target.checked)}
                />
                <span>{t('Double caméra avec incrustation selfie', 'Dual camera with selfie picture-in-picture')}</span>
              </label>
            )}
            <button type="button" className="camera-record-button camera-start-button" onClick={() => void startCamera()}>
              <CameraIcon size={18} aria-hidden="true" />
              {t('Activer la caméra', 'Start camera')}
            </button>
          </div>
        )}
      </div>

      {pendingFile && (
        <div className="camera-save-backdrop">
          <section className="camera-save-panel glass">
            <div className="camera-save-heading">
              <div>
                <strong>{pendingFile.name}</strong>
                <span className="text-secondary">
                  {(pendingFile.size / (1024 * 1024)).toFixed(1)} MB
                </span>
              </div>
              <LockKeyhole size={18} aria-label={t('Privé par défaut', 'Private by default')} />
            </div>
            <div className="camera-save-options">
              <label>
                {t('Enregistrer comme', 'Save as')}
                <select
                  value={visibility}
                  onChange={(event) => {
                    setVisibility(event.target.value as 'private' | 'group')
                    setGroupId(null)
                  }}
                  disabled={uploading}
                >
                  <option value="private">{t('Privé', 'Private')}</option>
                  <option value="group">{t('Partager avec un groupe', 'Share with a group')}</option>
                </select>
              </label>
              {visibility === 'group' && (
                <label>
                  {t('Groupe', 'Group')}
                  <select
                    value={groupId ?? ''}
                    onChange={(event) => setGroupId(event.target.value ? Number(event.target.value) : null)}
                    disabled={uploading}
                  >
                    <option value="">{t('Sélectionner un groupe', 'Select a group')}</option>
                    {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                  </select>
                </label>
              )}
            </div>
            <div className="camera-save-actions">
              <button type="button" className="glass-button" onClick={() => setPendingFile(null)} disabled={uploading}>
                {t('Supprimer', 'Discard')}
              </button>
              <button type="button" className="accent-button" onClick={() => void uploadCapture()} disabled={uploading}>
                {uploading ? t('Enregistrement…', 'Saving…') : t('Enregistrer dans MediaHub', 'Save to MediaHub')}
              </button>
            </div>
          </section>
        </div>
      )}

      {(error || message || blurLoading) && (
        <div className={`camera-toast ${error ? 'is-error' : ''}`} role={error ? 'alert' : 'status'}>
          {error || (blurLoading
            ? t('Téléchargement et préparation du flou d’arrière-plan…', 'Downloading and preparing background blur…')
            : message)}
        </div>
      )}
      {!window.isSecureContext && (
        <span className="camera-secure-context">
          {t('HTTPS requis pour utiliser la caméra.', 'HTTPS required to use the camera.')}
        </span>
      )}
    </div>
  )
}
