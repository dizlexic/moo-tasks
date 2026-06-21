export const iconMap: Record<string, string> = {
  book: 'mdi:book',
  help: 'mdi:help-circle',
  zap: 'mdi:flash',
  star: 'mdi:star',
  bug: 'mdi:bug',
  tag: 'mdi:tag',
  check: 'mdi:check',
  clock: 'mdi:clock',
  flag: 'mdi:flag',
  rocket: 'mdi:rocket',
  x: 'mdi:close',
  plus: 'mdi:plus',
  minus: 'mdi:minus',
  select: 'mdi:cursor-default',
  update: 'mdi:refresh',
}

export const getIcon = (iconName: string) => {
  return iconMap[iconName.trim()] || `mdi:${iconName.trim()}`
}
