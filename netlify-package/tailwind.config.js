/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        // ----- Sentient Media palette -----
        paper:        '#ECECEC',
        'paper-2':    '#FFFFFF',
        'paper-3':    '#F6F6F6',
        rule:         '#D4D4D4',
        'rule-strong':'#000000',
        ink:          '#000000',
        'ink-2':      '#2A2A2A',
        'ink-3':      '#666666',
        'ink-4':      '#9A9A9A',

        // Editorial accent = Sentient brand orange family.
        editorial:        '#FF5C00',
        'editorial-soft': '#E84400',
        'editorial-tint': '#FFE4D3',
        highlight:        '#FF9900',
        'highlight-tint': '#FFEED1',

        orange:  '#FF5C00',
        amber:   '#E84400',
        sun:     '#FF9900',
        sand:    '#FFBA60',
        rust:    '#531402',
        success: '#0DA440',

        // Sequential concern scale (light grey -> deep rust).
        'concern-0': '#F6F6F6',
        'concern-1': '#FDE0C8',
        'concern-2': '#FFBA60',
        'concern-3': '#FF9900',
        'concern-4': '#E84400',
        'concern-5': '#531402',

        // ----- Species palette (matches Sentient survey app's CAFO map) -----
        'sp-swine':   '#ff5c00',
        'sp-beef':    '#531402',
        'sp-dairy':   '#a0451c',
        'sp-chicken': '#ff9900',
        'sp-turkey':  '#ffba60',
        'sp-sheep':   '#2d6f7c',
        'sp-other':   '#666666'
      },
      fontFamily: {
        serif: ['Fraunces', '"Source Serif 4"', 'Georgia', 'Times New Roman', 'serif'],
        sans:  ['Onest', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif']
      },
      maxWidth: {
        'col-narrow': '560px',
        'col-read':   '680px',
        'col-wide':   '1100px',
        'col-full':   '1200px'
      },
      spacing: {
        '7.5': '30px', '13': '52px', '15': '60px',
        '18': '72px', '22': '88px', '26': '104px', '30': '120px'
      },
      borderRadius: { md: '6px' },
      transitionDuration: { sentient: '250ms' }
    }
  },
  plugins: []
};
