// تعريف المستويات — أسماء وألوان مستوحاة من نظام رتب Blood Strike
// 1-7 توصلها تلقائيًا بالمشاركة (رسائل + رفع ملفات). 8 الملك، محجوز يدويًا فقط.
window.MKRZ_LEVELS = {
  1: { name: "برونزي",  min: 0,     color: "#c98a4e" },
  2: { name: "فضي",     min: 50,    color: "#b8c0cc" },
  3: { name: "ذهبي",    min: 150,   color: "#ffd700" },
  4: { name: "بلاتيني", min: 450,   color: "#6fd8c4" },
  5: { name: "ماسي",    min: 1350,  color: "#4fc3f7" },
  6: { name: "ماستر",   min: 4050,  color: "#a855f7" },
  7: { name: "أسطورة",  min: 12150, color: "#ff5a1a", fire: true },
  8: { name: "الملك",   min: null,  color: "#ffd76a", crown: true, fire: true }
};

const MKRZ_FLAME = '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style="margin-inline-end:3px"><path d="M12 2c1.2 3.3-2.8 4.4-2.8 8.2a2.8 2.8 0 0 0 5.6 0c0-1-.4-1.8-.9-2.3.6 2.7 2.9 3.4 2.9 6.1a5 5 0 0 1-10 0C6.8 8.5 10 7 12 2z"/></svg>';
const MKRZ_CROWN = '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style="margin-inline-end:3px"><path d="M3 17l1.5-9L9 12l3-7 3 7 4.5-4L21 17H3z"/></svg>';

function mkrzLevelBadge(level, points) {
  const lvl = window.MKRZ_LEVELS[level] || window.MKRZ_LEVELS[1];
  const icon = (lvl.crown ? MKRZ_CROWN : "") + (lvl.fire ? MKRZ_FLAME : "");
  const next = window.MKRZ_LEVELS[level + 1];
  const title = (typeof points === "number" && next)
    ? `${points} نقطة — يحتاج ${next.min} لرتبة ${next.name}`
    : "";
  return `<span class="lvl-badge lvl-${level}" ${title ? `title="${title}"` : ""}>${icon}${lvl.name}</span>`;
}
