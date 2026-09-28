export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function percent(value, total) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
}

export function categoryLabel(category) {
  return category === 'essential' ? 'Обязательная покупка' : 'Желаемая покупка';
}

export function themeLabel(theme) {
  return {
    budget: 'Планирование бюджета',
    savings: 'Накопления',
    purchases: 'Семейный бюджет',
    household: 'Бытовые нужды',
    utilities: 'Коммунальные расходы'
  }[theme] || theme;
}

export function statusIcon(condition) {
  return condition ? '✅' : '○';
}
