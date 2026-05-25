'use client'
import { useRef, useState, type DragEvent, type ChangeEvent } from 'react'

interface FileDropZoneProps {
  name: string
  accept: string
  multiple?: boolean
  label: string
  currentFileLabel?: string
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export function FileDropZone({
  name,
  accept,
  multiple = false,
  label,
  currentFileLabel,
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

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-xl p-5 text-center transition-colors ${
        dragging
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-300 bg-gray-50 hover:border-gray-400'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        name={name}
        accept={accept}
        multiple={multiple}
        onChange={handleChange}
        className="sr-only"
      />
      <p className="text-xs text-gray-500 mb-3">
        {dragging ? 'Drop file here' : `Drag & drop or choose ${label.toLowerCase()}`}
      </p>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="bg-[#1e3a5f] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#16304f]"
      >
        Choose file
      </button>
      {displayLabel && (
        <p className="text-xs text-green-700 font-medium mt-3 truncate">{displayLabel}</p>
      )}
    </div>
  )
}
