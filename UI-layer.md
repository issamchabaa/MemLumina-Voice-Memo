# UI Layer Specification: MemLumina Capture

This document defines the user interface for the MemLumina Voice Memo Companion. It serves as a master prompt for the UI implementation and a reference for design consistency.

## 1. Visual Identity (Obsidian Vaporwave)

- **Base Theme**: Deep Black / Slate (#131314).
- **Accents**: 
  - **Luminous Cyan (#00DBE7)**: Primary actions, active recording, connectivity.
  - **Soft Violet (#EBB2FF)**: Intelligence, processing states, ledger integration.
- **Glassmorphism**: Backdrop blur (XL), subtle white borders (8% opacity), "glass-stroke" effect on cards.
- **Typography**: 'Outfit' for headers, 'Inter' for body.
- **Atmosphere**: Technical, precise, "digital cockpit".

## 2. Component Architecture

### A. The Recorder (Primary View)
- **Timer**: Large, center-aligned mono-spaced timer (`tabular-nums`).
- **Visualizer**: A multi-layered glowing ring that pulses with audio input levels.
- **Record Button**: Large circular button.
  - *Idle*: Hollow Cyan ring with Mic icon.
  - *Recording*: Filled pulsing Cyan ring with Square icon.
- **Status Indicator**: Small LED-style pulsing dot (Green: Connected, Red: Offline).

### B. Transcript & Review Panel
- **Glassmorphic Card**: Appears after recording stops.
- **Scrolling Text**: Auto-scrolling transcript text with a fade-to-transparent mask at the top/bottom.
- **Mode Selector**: Segmented control or horizontal pill-list for "Capture Mode":
  - `Idea` | `Instruction` | `Reminder` | `Decision` | `Correction` | `Project Note`.
- **Primary Action**: "Send to MemLumina" button with a glowing Cyan/Violet gradient.

### C. Status & Queue (Secondary View)
- **Processing HUD**: A list showing the lifecycle of recent memos:
  - `Transcribing...` (Pulsing Violet)
  - `Integrated into Ledger` (Checkmark)
  - `Action Items Extracted` (Brief summary badge)

## 3. Interaction Model

1. **Tap to Record**: Immediate start, timer begins, visualizer pulses.
2. **Stop**: Instant transition to Review Panel. Audio is uploaded in the background.
3. **Review**: User can tweak the text or change the Capture Mode.
4. **Send**: Triggers the CLS ingestion. Button shows a "beaming" animation.
5. **Success**: Subtle haptic-style visual pulse and return to idle state with a "Memo Sent" toast.

## 4. Master Prompt for Stitch (UI Generation)

> Create a high-fidelity, futuristic React UI for a voice memo app called "MemLumina Capture". 
> The aesthetic is "Obsidian Vaporwave" with a deep black (#131314) background.
> Use Luminous Cyan (#00DBE7) for primary actions and Soft Violet (#EBB2FF) for secondary/intelligence states.
> 
> Key Elements:
> 1. A central, large mono-spaced timer (00:00).
> 2. A circular recording button with a glowing Cyan ring that pulses.
> 3. A glassmorphic card for transcript review that uses backdrop-blur and a subtle stroke.
> 4. A horizontal selector for "Capture Mode" pills (Idea, Instruction, Decision, etc.).
> 5. A "Send to MemLumina" button with a sleek gradient and shadow.
> 
> Use Lucide-React icons and ensure the layout is mobile-optimized (PWA). The UI should feel like a "digital cockpit"—technical, clean, and responsive.
