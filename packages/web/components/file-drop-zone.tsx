'use client'
import { useRef, useState, type DragEvent, type ChangeEvent } from 'react'
import Image from 'next/image'

interface FileDropZoneProps {
  id?: string
  name: string
  accept: string
  multiple?: boolean
  label: string
  currentFileLabel?: string
  /** The image already on file, shown in place. A picture answers "is the
   *  right one up there?" — which currentFileLabel alone never could — and it
   *  is why the toy editor no longer needs a dialog for the same job. Only for
   *  image dropzones: a PDF or an STL has nothing to show. */
  currentFileUrl?: string | null
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export function FileDropZone({
  id,
  name,
  accept,
  multiple = false,
  label,
  currentFileLabel,
  currentFileUrl,
  onChange,
}: FileDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileLabel, setFileLabel] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (files && files.length > 0) {
      setFileLabel(
        files.length === 1 ? files[0].name : `${files.length} files selected`
      )
      onChange?.(e)
    }
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(true)
  }

  function handleDragLeave() {
    setDragging(false)
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(false)
    const dt = e.dataTransfer
    if (!dt.files.length || !inputRef.current) return

    const input = inputRef.current
    const transfer = new DataTransfer()
    Array.from(dt.files).forEach((f) => transfer.items.add(f))
    input.files = transfer.files
    setFileLabel(
      dt.files.length === 1 ? dt.files[0].name : `${dt.files.length} files selected`
    )
    // Synthesise a change event so parent upload handlers fire on drop too
    if (onChange) {
      onChange({ target: input } as React.ChangeEvent<HTMLInputElement>)
    }
  }

  const displayLabel = fileLabel ?? currentFileLabel ?? null
  // Hidden once a replacement is chosen: the thumbnail would then be showing
  // the photo about to be overwritten, right above its replacement's name.
  const showCurrent = currentFileUrl != null && fileLabel === null

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`dropzone ${dragging ? 'dropzone-active' : ''}`}
    >
      <input
        ref={inputRef}
        id={id}
        type="file"
        name={name}
        accept={accept}
        multiple={multiple}
        onChange={handleChange}
        className="sr-only"
      />
      {showCurrent && (
        <Image
          src={currentFileUrl}
          alt={`${label} currently on file`}
          width={132}
          height={96}
          className="mx-auto mb-3 h-[96px] w-[132px] rounded-md border-2 border-ink object-cover"
        />
      )}
      <p className="mb-3 text-xs text-muted">
        {dragging ? 'Drop file here' : `Drag & drop or choose ${label.toLowerCase()}`}
      </p>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="btn btn-primary btn-sm"
      >
        Choose file
      </button>
      {displayLabel && (
        <p className="mt-3 truncate text-xs font-bold text-mint-deep">{displayLabel}</p>
      )}
    </div>
  )
}
