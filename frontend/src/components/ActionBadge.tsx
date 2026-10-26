interface ActionBadgeProps {
  action: string
  size?: 'sm' | 'md'
}

export function ActionBadge({ action, size = 'sm' }: ActionBadgeProps) {
  const norm = action.toLowerCase()

  const styles: Record<string, { bg: string; text: string; border: string; dot: string }> = {
    allow: {
      bg: 'bg-[#EDF7F1]',
      text: 'text-[#1D603F]',
      border: 'border-[#A2D5AB]',
      dot: 'bg-[#39AEA9]',
    },
    redact: {
      bg: 'bg-[#FEF9EE]',
      text: 'text-[#8F5E0A]',
      border: 'border-[#E8CD90]',
      dot: 'bg-[#D99B26]',
    },
    block: {
      bg: 'bg-[#FDF2F1]',
      text: 'text-[#A82525]',
      border: 'border-[#F3B9B2]',
      dot: 'bg-[#C24134]',
    },
    restrict: {
      bg: 'bg-[#F0F5F6]',
      text: 'text-[#3E5C62]',
      border: 'border-[#98BAC0]',
      dot: 'bg-[#557B83]',
    },
  }

  const s = styles[norm] ?? {
    bg: 'bg-[#F6F8F6]',
    text: 'text-[#557B83]',
    border: 'border-[#D8E2DC]',
    dot: 'bg-[#557B83]',
  }

  const sizeClasses =
    size === 'md'
      ? 'px-3 py-1 text-xs gap-1.5'
      : 'px-2 py-0.5 text-[10px] gap-1'

  return (
    <span
      className={`inline-flex items-center rounded-md border font-mono font-bold uppercase tracking-wider ${s.bg} ${s.text} ${s.border} ${sizeClasses}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {action}
    </span>
  )
}
