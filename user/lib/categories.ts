export function formatCategoryName(category?: string | null): string {
  if (!category || !category.trim()) return 'Digital'
  return category.trim()
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
  'Video': 'fa-video',
  'Editing': 'fa-scissors',
  'Pendidikan': 'fa-graduation-cap',
  'Education': 'fa-graduation-cap',
  'AI': 'fa-robot',
  'Social Media': 'fa-share-nodes',
  'Voucher': 'fa-ticket',
}

export function getCategoryIcon(category: string): string {
  return categoryIcons[category] || 'fa-shapes'
}
