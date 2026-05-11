type Tag = { id: string; name: string; color: string }

export function TagBadge({ tag, onRemove }: { tag: Tag; onRemove?: () => void }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{
        backgroundColor: `${tag.color}20`,
        color: tag.color,
        border: `1px solid ${tag.color}40`,
      }}
    >
      {tag.name}
      {onRemove && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove() }}
          className="ml-0.5 rounded-full opacity-60 hover:opacity-100 transition-opacity"
          aria-label={`Retirer ${tag.name}`}
        >
          ×
        </button>
      )}
    </span>
  )
}
