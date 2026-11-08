import type { ReactNode } from 'react'

type ModalProps = {
  open: boolean
  title?: string
  children: ReactNode
  onClose: () => void
}

export function Modal({
  open,
  title,
  children,
  onClose,
}: ModalProps) {
  if (!open) {
    return null
  }

  return (
    <div
      className="media-viewer upload-dialog"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="media-viewer-content glass upload-modal-content"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <button
          type="button"
          className="media-viewer-close"
          onClick={onClose}
          aria-label="Fermer"
        >
          ×
        </button>

        {title && <h2>{title}</h2>}

        {children}
      </div>
    </div>
  )
}
