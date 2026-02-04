# Design System - Immersive Bento

Sistema di design per interfacce premium dark-mode con estetica "Immersive Bento".

## Filosofia

**Immersive Bento** = Dark Glassmorphism + Bento Grid + Premium Motion

Caratteristiche chiave:
- Sfondo ultra-scuro (#0a0a0a) con profondita tramite glass layers
- Layout Bento Grid asimmetrico con card di dimensioni variabili
- Entry animations su scroll, hover states su elementi interattivi
- Glow effects per accent e focus states

---

## Semantic Tokens

### Colori Base

| Token | Valore | Uso |
|-------|--------|-----|
| `--bg-void` | #0a0a0a | Background principale |
| `--bg-surface` | #0f0f0f | Card background |
| `--bg-elevated` | #1a1a1a | Elementi sopraelevati |
| `--bg-muted` | #262626 | Input, disabled |

### Colori Accent

| Token | Valore | Uso |
|-------|--------|-----|
| `--accent-primary` | #0ea5e9 | CTA, links, focus |
| `--accent-secondary` | #a855f7 | Elementi secondari |
| `--accent-glow` | rgba(14,165,233,0.3) | Glow effects |

### Spacing

| Token | Valore | Uso |
|-------|--------|-----|
| `--gap-bento` | 1.5rem (24px) | Gap griglia Bento |
| `--padding-card` | 1.5rem (24px) | Padding interno card |
| `--radius-card` | 1.5rem (24px) | Border radius card |

### Tailwind Mapping

```tsx
// In globals.css o tailwind.config.ts
:root {
  --background: 0 0% 4%;      /* #0a0a0a */
  --card: 0 0% 6%;            /* #0f0f0f */
  --muted: 0 0% 10%;          /* #1a1a1a */
  --primary: 199 89% 48%;     /* #0ea5e9 */
  --secondary: 270 60% 60%;   /* #a855f7 */
}
```

---

## Layout Bento Grid

### Pattern Base

```tsx
// Grid 12 colonne con gap Bento
<div className="grid grid-cols-12 gap-6">
  <div className="col-span-8">Large Card</div>
  <div className="col-span-4">Small Card</div>
  <div className="col-span-4">Small Card</div>
  <div className="col-span-4">Small Card</div>
  <div className="col-span-4">Small Card</div>
</div>
```

### Dimensioni Card

| Size | Span | Esempio |
|------|------|---------|
| 1x1 | `col-span-4` | Stat, icona |
| 2x1 | `col-span-8` | Feature highlight |
| 1x2 | `col-span-4 row-span-2` | Vertical card |
| 2x2 | `col-span-8 row-span-2` | Hero card |

### Responsive

```tsx
<div className="grid grid-cols-4 md:grid-cols-8 lg:grid-cols-12 gap-4 md:gap-6">
  <div className="col-span-4 lg:col-span-8">{/* Responsive card */}</div>
</div>
```

---

## Glassmorphism

### Livelli

| Livello | Tailwind | Uso |
|---------|----------|-----|
| Subtle | `bg-white/5 backdrop-blur-sm border-white/5` | Background elements |
| Medium | `bg-white/10 backdrop-blur-md border-white/10` | Card standard |
| Strong | `bg-white/15 backdrop-blur-xl border-white/20` | Modali, overlay |

### Utility Classes (globals.css)

```css
.glass {
  @apply backdrop-blur-md bg-white/5 border border-white/10;
}

.glass-card {
  @apply backdrop-blur-lg bg-white/5 border border-white/10
         rounded-xl shadow-xl;
}

.glass-button {
  @apply backdrop-blur-sm bg-white/10 border border-white/20
         hover:bg-white/15 transition-all;
}
```

### Pattern Card Completo

```tsx
<div className="
  relative overflow-hidden rounded-3xl
  bg-white/5 backdrop-blur-md
  border border-white/10
  p-6
  transition-all duration-300
  hover:bg-white/10 hover:border-white/20
  hover:shadow-[0_0_30px_rgba(14,165,233,0.15)]
">
  {children}
</div>
```

---

## Typography

### Scale

| Elemento | Classes | Uso |
|----------|---------|-----|
| H1 Hero | `text-5xl md:text-7xl font-bold tracking-tighter` | Titolo principale |
| H2 Section | `text-3xl md:text-5xl font-bold tracking-tight` | Titoli sezione |
| H3 Card | `text-xl md:text-2xl font-semibold` | Titoli card |
| Body | `text-base text-zinc-400 leading-relaxed` | Testo paragrafo |
| Small | `text-sm text-zinc-500` | Caption, meta |

### Gradient Text

```tsx
<h1 className="
  bg-clip-text text-transparent
  bg-gradient-to-r from-white via-zinc-300 to-zinc-500
">
  Heading Gradient
</h1>

// Variante colorata
<span className="
  bg-clip-text text-transparent
  bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400
">
  Accent Gradient
</span>
```

---

## Motion System

### Entry Animations

| Pattern | Initial | Animate | Timing |
|---------|---------|---------|--------|
| fadeInUp | `opacity: 0, y: 30` | `opacity: 1, y: 0` | 0.5s easeOut |
| fadeInScale | `opacity: 0, scale: 0.95` | `opacity: 1, scale: 1` | 0.4s easeOut |
| slideInLeft | `opacity: 0, x: -50` | `opacity: 1, x: 0` | 0.5s easeOut |

### Implementazione

```tsx
// Variants file
export const fadeInUp: Variants = {
  initial: { opacity: 0, y: 30 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" }
  },
};

export const staggerContainer: Variants = {
  animate: {
    transition: { staggerChildren: 0.1, delayChildren: 0.1 }
  },
};

// Uso
<motion.section
  variants={staggerContainer}
  initial="initial"
  whileInView="animate"
  viewport={{ once: true, margin: "-100px" }}
>
  <motion.div variants={fadeInUp}>Item 1</motion.div>
  <motion.div variants={fadeInUp}>Item 2</motion.div>
</motion.section>
```

### Hover States

```tsx
// Scale + Glow
<motion.div
  whileHover={{
    scale: 1.02,
    boxShadow: "0 0 30px rgba(14,165,233,0.3)"
  }}
  transition={{ duration: 0.2 }}
>
  Interactive Card
</motion.div>

// Tailwind equivalent
<div className="
  transition-all duration-200
  hover:scale-[1.02]
  hover:shadow-[0_0_30px_rgba(14,165,233,0.3)]
">
```

### Spring Transitions

```tsx
// Per elementi interattivi (bottoni, toggle)
const springTransition = {
  type: "spring",
  stiffness: 400,
  damping: 17,
};

<motion.button whileTap={{ scale: 0.95 }} transition={springTransition}>
  Click me
</motion.button>
```

---

## Component Patterns

### Hero Section

```tsx
<section className="relative min-h-screen flex items-center justify-center overflow-hidden">
  {/* Background Orbs */}
  <div className="absolute inset-0 -z-10">
    <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl animate-float" />
    <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl animate-float-slow" />
  </div>

  {/* Content */}
  <div className="container text-center">
    <motion.h1
      variants={fadeInUp}
      className="text-5xl md:text-7xl font-bold tracking-tighter"
    >
      Hero Title
    </motion.h1>
  </div>
</section>
```

### Bento Card

```tsx
<motion.div
  variants={fadeInUp}
  whileHover={{ scale: 1.02 }}
  className="
    group relative overflow-hidden
    rounded-3xl p-6
    bg-white/5 backdrop-blur-md
    border border-white/10
    transition-all duration-300
    hover:bg-white/10 hover:border-white/20
  "
>
  {/* Icon con glow */}
  <div className="
    w-12 h-12 rounded-xl mb-4
    bg-gradient-to-br from-cyan-500 to-purple-500
    flex items-center justify-center
    group-hover:shadow-[0_0_20px_rgba(14,165,233,0.5)]
    transition-shadow duration-300
  ">
    <Icon className="w-6 h-6 text-white" />
  </div>

  <h3 className="text-xl font-semibold mb-2">Card Title</h3>
  <p className="text-zinc-400">Card description text.</p>
</motion.div>
```

### Glow Button

```tsx
<button className="
  relative px-6 py-3 rounded-xl
  bg-gradient-to-r from-cyan-500 to-purple-500
  text-white font-medium
  transition-all duration-300
  hover:shadow-[0_0_30px_rgba(14,165,233,0.5)]
  active:scale-95
">
  Get Started
</button>
```

### Background Orbs

```tsx
// Componente riutilizzabile
export function BackgroundOrbs() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      <div className="
        absolute -top-40 -right-40
        w-80 h-80
        bg-cyan-500/30
        rounded-full
        blur-3xl
        animate-float
      " />
      <div className="
        absolute -bottom-40 -left-40
        w-96 h-96
        bg-purple-500/20
        rounded-full
        blur-3xl
        animate-float-slow
        animation-delay-200
      " />
    </div>
  );
}
```

### Animazioni Tailwind (globals.css)

```css
@keyframes float {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(20px, -20px) scale(1.05); }
}

@keyframes float-slow {
  0%, 100% { transform: translate(0, 0); }
  50% { transform: translate(-30px, 30px); }
}

.animate-float { animation: float 20s ease-in-out infinite; }
.animate-float-slow { animation: float-slow 25s ease-in-out infinite; }
```

---

## Checklist Nuovo Progetto

```markdown
### Setup Base
- [ ] Dark mode come default (class="dark" su html)
- [ ] CSS variables in globals.css
- [ ] Tailwind config con colori semantic

### Layout
- [ ] Container max-width 1400px
- [ ] Gap bento: gap-6 (24px)
- [ ] Padding sezioni: py-20 md:py-32

### Animazioni
- [ ] Lenis smooth scroll attivo
- [ ] Entry animations su ogni sezione (stagger)
- [ ] Hover states su card e bottoni
- [ ] useReducedMotion check

### Glass Effects
- [ ] Card con backdrop-blur
- [ ] Border white/10
- [ ] Hover glow su elementi interattivi

### Background
- [ ] Gradient orbs animati
- [ ] Pattern grid/dot opzionale
- [ ] 3D Spline/R3F se budget permette

### Performance
- [ ] dynamic() su componenti 3D
- [ ] next/image per tutte le immagini
- [ ] Font optimization con next/font
```

---

## Quick Copy-Paste

### CSS Variables Minime

```css
:root {
  --background: 0 0% 4%;
  --foreground: 0 0% 98%;
  --card: 0 0% 6%;
  --muted: 0 0% 10%;
  --primary: 199 89% 48%;
  --radius: 0.75rem;
}
```

### Tailwind Glass Utilities

```css
@layer utilities {
  .glass { @apply backdrop-blur-md bg-white/5 border border-white/10; }
  .glass-card { @apply glass rounded-xl shadow-xl; }
  .glow-primary { box-shadow: 0 0 20px hsl(var(--primary) / 0.3); }
}
```

### Motion Variants Base

```tsx
export const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export const staggerContainer = {
  animate: { transition: { staggerChildren: 0.1 } },
};
```
