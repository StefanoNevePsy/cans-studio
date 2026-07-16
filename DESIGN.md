# Design

## System

Clinical product UI with restrained color, native-feeling controls and stable density. The app uses one sans-serif stack, fixed rem sizing and OKLCH color tokens.

## Color

```css
:root {
  --bg: oklch(1 0 0);
  --surface: oklch(0.982 0.004 270);
  --surface-strong: oklch(0.955 0.009 270);
  --ink: oklch(0.18 0.018 270);
  --muted: oklch(0.44 0.018 270);
  --border: oklch(0.89 0.012 270);
  --primary: oklch(0.40 0.15 270);
  --primary-strong: oklch(0.34 0.16 270);
  --accent: oklch(0.61 0.13 185);
  --success: oklch(0.48 0.13 150);
  --warning: oklch(0.68 0.15 72);
  --danger: oklch(0.56 0.18 28);
  --info: oklch(0.52 0.15 250);
}
```

## Typography

System sans stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`. Body text is 1rem. UI labels use 0.8125rem to 0.875rem, headings use a tight fixed scale.

## Layout

Desktop uses a fixed sidebar, top clinical context bar and a three-column work surface where useful. Tablet collapses panels into two columns. Mobile uses stacked sections with sticky primary controls.

## Components

Buttons, segmented controls, tab navigation, compact summary strips, item rows with score buttons, radar/star chart, trend table, patient list, assessment timeline, import/export actions.

## Motion

Subtle 150-220ms state transitions for selection, hover, panel changes and chart updates. No decorative page choreography. Respect `prefers-reduced-motion`.
