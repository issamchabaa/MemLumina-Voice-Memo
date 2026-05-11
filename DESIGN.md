# Design System Strategy: MemLumina Capture (Lumina)

## 1. Overview & Creative North Star
**Creative North Star: The Digital Cockpit**

MemLumina Capture is a high-fidelity, futuristic interface designed for power users. The aesthetic is "Obsidian Vaporwave"—deep black surfaces (#131314) energized by luminous Cyan (#00DBE7) and Soft Violet (#EBB2FF) accents. The goal is to provide a "cockpit" feel that conveys speed, technical precision, and immersive focus.

---

## 2. Color Palette (Tailwind Custom Tokens)
- **Base Surface**: #131314 (Deep Slate Black)
- **Primary (Luminous Cyan)**: #00DBE7 (Used for active recording, primary signals)
- **Secondary (Soft Violet)**: #EBB2FF (Used for intelligence and processing states)
- **Tertiary (Deep Violet)**: #E3D4FF
- **Surface Container**: #1C1B1C to #353436 (Subtle tonal shifts)

---

## 3. Typography
- **Display & Headlines**: 'Outfit' (Bold, geometric, futuristic)
- **Body & Technical Labels**: 'Inter' (Clean, high-legibility)
- **Visual Hierarchy**: High contrast between large tabular-num timers and small, uppercase technical metadata.

---

## 4. Visual Language & Aesthetics
- **Glassmorphism**: Backdrop blur (XL) with a subtle white border (8% opacity) to create a "glass-stroke" effect.
- **Neon Pulses**: Subtle glowing rings around active elements (Cyan/Violet).
- **Gradients**: Top-light gradients and ambient background glows to add depth to the dark canvas.
- **Transitions**: Smooth 200ms-500ms transitions for all interactive states.

---

## 5. Key UI Components
- **The Recorder**: A central circular button with a multi-layered glowing ring visualizer.
- **Transcript Panel**: A glassmorphic card with a "fade-to-transparent" mask for scrolling text.
- **Navigation**: A blurred bottom bar for mobile-first PWA access and a technical side drawer.
- **Badges**: Small "Connected" status indicators with pulsing LED-style signals.
