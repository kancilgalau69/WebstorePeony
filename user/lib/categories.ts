export function formatCategoryName(category?: string | null): string {
  if (!category || !category.trim()) return 'Digital'
  const trimmed = category.trim()
  // Capitalize first letter of each word for uniformity (e.g. "short drama" -> "Short Drama")
  return trimmed.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ')
}

const categoryIcons: Record<string, string> = {
  'Streaming': 'fa-tv',
  'Musik': 'fa-music',
  'Music': 'fa-music',
  'Desain': 'fa-palette',
  'Design': 'fa-palette',
  'Produktivitas': 'fa-briefcase',
  'Productivity': 'fa-briefcase',
  'VPN': 'fa-shield-halved',
  'Penyimpanan': 'fa-cloud',
  'Storage': 'fa-cloud',
  'Gaming': 'fa-gamepad',
  'Game': 'fa-gamepad',
  'Topup': 'fa-coins',
  'Top Up': 'fa-coins',
  'Video': 'fa-video',
  'Editing': 'fa-scissors',
  'Pendidikan': 'fa-graduation-cap',
  'Education': 'fa-graduation-cap',
  'Ai': 'fa-robot',
  'AI': 'fa-robot',
  'Social Media': 'fa-share-nodes',
  'Voucher': 'fa-ticket',
  'Short Drama': 'fa-clapperboard',
  'Drama': 'fa-clapperboard',
}

export function getCategoryIcon(category: string): string {
  return categoryIcons[category] || 'fa-shapes'
}
