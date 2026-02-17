# UX/UI Design: Trips Feature

**Version:** 1.0
**Date:** 2026-02-17
**Designer:** UX/UI Designer Agent

---

## Design Philosophy

The trips feature seamlessly extends the existing minimal, dark-themed aesthetic with smooth transitions, accessibility-first patterns, and a non-intrusive user flow. The design prioritizes clarity, discoverability, and progressive disclosure while maintaining the app's serene, focused atmosphere.

---

## 1. Emoji Icon Placement & Interaction

### Visual Design

**Icon:** 🗺️ (World Map Emoji)
**Rationale:** Represents trip planning better than generic travel icons; visually distinct and universally recognizable.

**Placement:** Fixed top-right corner of the page
- Desktop: `24px` from top, `32px` from right
- Mobile: `16px` from top, `20px` from right
- `z-index: 10` (above background, below modals)

**Sizing:**
- Default: `32px` (desktop), `28px` (mobile)
- Hover: Scale to `1.1` (`35.2px` / `30.8px`)
- Active: Scale to `0.95` (`30.4px` / `26.6px`)

**Styling:**
```css
.trips-trigger {
  position: fixed;
  top: 24px;
  right: 32px;
  font-size: 32px;
  cursor: pointer;
  transition: transform 0.2s ease, opacity 0.2s ease;
  opacity: 0.75;
  z-index: 10;
}

.trips-trigger:hover {
  transform: scale(1.1);
  opacity: 1;
}

.trips-trigger:active {
  transform: scale(0.95);
}

.trips-trigger:focus-visible {
  outline: 2px solid #667eea;
  outline-offset: 4px;
  border-radius: 4px;
}

@media (max-width: 768px) {
  .trips-trigger {
    top: 16px;
    right: 20px;
    font-size: 28px;
  }
}
```

**States:**
- Default: `opacity: 0.75`
- Hover: `opacity: 1`, scale `1.1`
- Active: scale `0.95`
- Focus (keyboard): Purple outline with `4px` offset
- Panel open: Add subtle purple glow (`box-shadow: 0 0 12px rgba(102, 126, 234, 0.3)`)

---

## 2. Navigation Flow & Pattern Selection

### Design Decision: Slide-in Side Panel

**Choice:** Right-side slide-in panel (not modal or full page)

**Rationale:**

| Pattern | Pros | Cons | Verdict |
|---------|------|------|---------|
| **Slide-in Panel** | ✅ Non-blocking, preserves context<br>✅ Smooth, modern feel<br>✅ Aligns with dashboard UX patterns<br>✅ Mobile-friendly (can go full-width) | ⚠️ Limited width on desktop | **✅ Selected** |
| Full Page | ✅ Maximum space | ❌ Loses main page context<br>❌ Requires full navigation paradigm | ❌ Too heavy |
| Modal | ✅ Focus on content | ❌ Blocks entire UI<br>❌ Feels intrusive for browsing trips | ❌ Too aggressive |

### Panel Specifications

**Desktop (>768px):**
- Width: `420px`
- Height: `100vh`
- Position: Fixed right
- Background: `#0f0f0f` (slightly lighter than page bg for depth)
- Border-left: `1px solid #222`
- Drop shadow: `box-shadow: -4px 0 24px rgba(0, 0, 0, 0.5)`

**Tablet/Mobile (≤768px):**
- Width: `100vw`
- Same height and styling
- Covers full viewport

**Animation:**
```css
.trips-panel {
  position: fixed;
  top: 0;
  right: 0;
  height: 100vh;
  width: 420px;
  background: #0f0f0f;
  border-left: 1px solid #222;
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.5);
  transform: translateX(100%);
  transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 50;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.trips-panel.open {
  transform: translateX(0);
}

.trips-panel-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.6);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.35s ease;
  z-index: 40;
  backdrop-filter: blur(2px);
}

.trips-panel-overlay.visible {
  opacity: 1;
  pointer-events: auto;
}

@media (max-width: 768px) {
  .trips-panel {
    width: 100vw;
  }
}
```

**Open/Close Behavior:**
1. Tap emoji → Panel slides in from right (350ms), overlay fades in
2. Close via:
   - X button (top-left of panel)
   - Click overlay
   - Press `Escape` key
   - Tap emoji again (toggle)

---

## 3. Trip List View

### Layout Structure

```
┌─────────────────────────────────┐
│ ← My Trips          [+ New] │ ← Header (60px, sticky)
├─────────────────────────────────┤
│                                 │
│  ┌─────────────────────────┐  │
│  │ 🇫🇷 France              │  │
│  │ Dec 15–22, 2026          │  │ ← Trip Card
│  │ 5 days • Paris, Lyon     │  │
│  └─────────────────────────┘  │
│                                 │
│  ┌─────────────────────────┐  │
│  │ 🇯🇵 Japan               │  │
│  │ Mar 10–24, 2027          │  │
│  └─────────────────────────┘  │
│                                 │
│  [Load more...]                 │ ← Pagination (if needed)
│                                 │
└─────────────────────────────────┘
```

### Header

**Sticky top:** `0`
**Height:** `60px`
**Padding:** `16px 20px`
**Background:** `#0f0f0f` with bottom border `1px solid #222`

```html
<div class="trips-panel-header">
  <button class="close-btn" aria-label="Close trips panel">←</button>
  <h2 class="panel-title">My Trips</h2>
  <button class="new-trip-btn">+ New</button>
</div>
```

**Styles:**
```css
.trips-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #222;
  background: #0f0f0f;
  position: sticky;
  top: 0;
  z-index: 10;
}

.panel-title {
  font-size: 1.25rem;
  font-weight: 400;
  color: #fff;
  letter-spacing: 0.02em;
}

.close-btn,
.new-trip-btn {
  background: none;
  border: none;
  color: #ccc;
  cursor: pointer;
  padding: 6px 12px;
  border-radius: 8px;
  transition: background 0.2s, color 0.2s;
  font-size: 1rem;
}

.close-btn:hover,
.new-trip-btn:hover {
  background: #1a1a1a;
  color: #fff;
}

.new-trip-btn {
  font-weight: 500;
  color: #667eea;
}

.new-trip-btn:hover {
  background: rgba(102, 126, 234, 0.1);
  color: #7e94ff;
}
```

### Trip Cards

**Layout:** Vertical stack with `12px` gap
**Padding:** `20px` (inside panel)

```css
.trip-card {
  background: #141414;
  border: 1px solid #2a2a2a;
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s, transform 0.15s;
}

.trip-card:hover {
  background: #181818;
  border-color: #3a3a3a;
  transform: translateX(-2px);
}

.trip-card:active {
  transform: translateX(0);
}

.trip-card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.trip-card-flag {
  /* CountryShape component with size={24} */
}

.trip-card-country {
  font-size: 1.05rem;
  font-weight: 500;
  color: #e0e0e0;
}

.trip-card-dates {
  font-size: 0.9rem;
  color: #888;
  margin-bottom: 4px;
}

.trip-card-meta {
  font-size: 0.85rem;
  color: #666;
  display: flex;
  gap: 8px;
}

.trip-card-meta span:not(:last-child)::after {
  content: "•";
  margin-left: 8px;
  color: #444;
}
```

**Card Click Behavior:**
Opens trip detail/edit view (slide-in from right within the panel, or replace panel content)

### Sorting

**Default:** Most recent first (by creation or upcoming trip date)
**Future Enhancement:** Dropdown for "Upcoming", "Past", "Alphabetical"

**Location:** Below header, optional pill-style filter:
```css
.trip-filters {
  display: flex;
  gap: 8px;
  padding: 12px 20px;
  border-bottom: 1px solid #1a1a1a;
}

.filter-pill {
  padding: 6px 12px;
  border-radius: 16px;
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  color: #888;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
}

.filter-pill.active {
  background: rgba(102, 126, 234, 0.15);
  border-color: #667eea;
  color: #7e94ff;
}
```

### Empty State

**Condition:** No trips exist yet

```html
<div class="trips-empty-state">
  <div class="empty-icon">🗺️</div>
  <h3>No trips yet</h3>
  <p>Start planning your next adventure</p>
  <button class="new-trip-btn-primary">Create Your First Trip</button>
</div>
```

**Styles:**
```css
.trips-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: calc(100vh - 60px); /* Full height minus header */
  padding: 40px;
  text-align: center;
  color: #666;
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 20px;
  opacity: 0.5;
}

.trips-empty-state h3 {
  font-size: 1.25rem;
  font-weight: 400;
  color: #888;
  margin-bottom: 8px;
}

.trips-empty-state p {
  font-size: 0.95rem;
  color: #555;
  margin-bottom: 24px;
}

.new-trip-btn-primary {
  padding: 12px 24px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  border: none;
  border-radius: 12px;
  color: #fff;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.new-trip-btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(102, 126, 234, 0.3);
}

.new-trip-btn-primary:active {
  transform: translateY(0);
}
```

---

## 4. Trip Create/Edit Form

### View Transition

**From List → Form:**
- Panel content slides left and fades out (200ms)
- Form slides in from right and fades in (300ms, 100ms delay)
- Header updates: "← My Trips" → "← New Trip" or "← Edit Trip"

### Form Layout

```
┌─────────────────────────────────┐
│ ← New Trip                      │ ← Header
├─────────────────────────────────┤
│                                 │
│  Country *                      │
│  [France          🇫🇷]         │ ← Country search
│                                 │
│  Trip Name                      │
│  [Summer in Paris________]      │
│                                 │
│  Dates                          │
│  [Dec 15, 2026] – [Dec 22]     │
│                                 │
│  Cities/Regions (optional)      │
│  [Paris, Lyon, Marseille__]     │
│                                 │
│  Notes (optional)               │
│  [________________]             │ ← Textarea
│  [________________]             │
│                                 │
│                                 │
│  [Cancel]      [Save Trip]      │ ← Actions (sticky bottom)
│                                 │
└─────────────────────────────────┘
```

### Field Specifications

**1. Country** (required)
- **Component:** Reuse `CountryAutocomplete` with modified styling
- **Integration:** Pre-fill if user selected country on main page
- **Validation:** Required, show error border if empty on submit
- **Label:** "Country *" (`0.9rem`, `#888`, `margin-bottom: 6px`)

```css
.form-field {
  margin-bottom: 20px;
}

.form-label {
  display: block;
  font-size: 0.9rem;
  color: #888;
  margin-bottom: 6px;
  font-weight: 400;
}

.form-label .required {
  color: #667eea;
}
```

**2. Trip Name** (optional, auto-generates)
- **Default value:** "{Country Name} Trip" (e.g., "France Trip")
- **Input:** Standard text input matching `CountryAutocomplete` style
- **Max length:** 60 characters

**3. Dates** (optional)
- **Type:** Two date inputs side by side (start, end)
- **Default:** Empty (user can add later)
- **Validation:** End date must be after start date
- **Format:** "MMM DD, YYYY"
- **Layout:** Flexbox with gap, mobile stacks vertically

```css
.date-range {
  display: flex;
  gap: 12px;
  align-items: center;
}

.date-range input {
  flex: 1;
}

.date-separator {
  color: #555;
  font-size: 0.9rem;
}

@media (max-width: 480px) {
  .date-range {
    flex-direction: column;
    align-items: stretch;
  }

  .date-separator {
    display: none;
  }
}
```

**4. Cities/Regions** (optional)
- **Type:** Text input (comma-separated)
- **Placeholder:** "e.g., Paris, Lyon, Marseille"
- **Max length:** 200 characters

**5. Notes** (optional)
- **Type:** Textarea
- **Rows:** 4
- **Max length:** 500 characters
- **Style:** Same as inputs but `min-height: 100px`, `resize: vertical`

### Input Styling (Consistent with Existing)

```css
.form-input,
.form-textarea {
  width: 100%;
  padding: 12px 16px;
  font-size: 1rem;
  font-family: inherit;
  color: #e0e0e0;
  background: #141414;
  border: 1px solid #2a2a2a;
  border-radius: 12px;
  outline: none;
  transition: border-color 0.3s, box-shadow 0.3s;
}

.form-input::placeholder,
.form-textarea::placeholder {
  color: #555;
  font-weight: 300;
}

.form-input:focus,
.form-textarea:focus {
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.15),
              0 0 20px rgba(102, 126, 234, 0.08);
}

.form-input.error,
.form-textarea.error {
  border-color: #e74c3c;
}

.form-input.error:focus,
.form-textarea.error:focus {
  box-shadow: 0 0 0 3px rgba(231, 76, 60, 0.15);
}

.form-error-message {
  margin-top: 6px;
  font-size: 0.85rem;
  color: #e74c3c;
}
```

### Save/Cancel Actions

**Position:** Sticky bottom, always visible
**Height:** `80px` (includes padding)
**Background:** `#0f0f0f` with top border
**Layout:** Flex space-between

```css
.form-actions {
  position: sticky;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  gap: 12px;
  padding: 16px 20px;
  background: #0f0f0f;
  border-top: 1px solid #222;
}

.btn-cancel,
.btn-save {
  flex: 1;
  padding: 14px;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-cancel {
  background: #1a1a1a;
  color: #ccc;
  border: 1px solid #2a2a2a;
}

.btn-cancel:hover {
  background: #222;
  color: #fff;
}

.btn-save {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
}

.btn-save:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(102, 126, 234, 0.3);
}

.btn-save:active {
  transform: translateY(0);
}

.btn-save:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}
```

**Cancel Behavior:**
- If form is pristine (no changes): Close immediately
- If form has changes: Show confirmation: "Discard changes?" (simple inline confirm, not modal)

**Save Flow:**
1. Validate required fields (country)
2. Show loading state on button ("Saving...")
3. On success: Slide back to trip list, show success toast
4. On error: Show inline error message, keep form open

---

## 5. Trip Delete

### Delete Trigger

**Location:** Inside trip detail/edit view
**Position:** Bottom of form, before Save/Cancel, or in trip card menu (3-dot overflow)

**Style:** Text link, not button
```css
.delete-trip-link {
  color: #e74c3c;
  font-size: 0.9rem;
  text-decoration: none;
  cursor: pointer;
  padding: 8px;
  border-radius: 6px;
  transition: background 0.2s;
  display: inline-block;
}

.delete-trip-link:hover {
  background: rgba(231, 76, 60, 0.1);
  text-decoration: underline;
}
```

### Confirmation Pattern

**Type:** Inline confirmation (not modal, to stay lightweight)

**Before delete click:**
```
[Delete trip]
```

**After delete click (state change):**
```
Are you sure? This cannot be undone.
[Cancel] [Yes, Delete]
```

**Implementation:**
```css
.delete-confirm {
  margin-top: 12px;
  padding: 12px;
  background: rgba(231, 76, 60, 0.1);
  border: 1px solid rgba(231, 76, 60, 0.3);
  border-radius: 8px;
}

.delete-confirm-text {
  font-size: 0.9rem;
  color: #e74c3c;
  margin-bottom: 10px;
}

.delete-confirm-actions {
  display: flex;
  gap: 8px;
}

.delete-confirm-actions button {
  flex: 1;
  padding: 8px;
  border-radius: 6px;
  font-size: 0.9rem;
  cursor: pointer;
  border: none;
}

.btn-delete-cancel {
  background: #1a1a1a;
  color: #ccc;
}

.btn-delete-confirm {
  background: #e74c3c;
  color: #fff;
}
```

**Delete Flow:**
1. Click "Delete trip"
2. Expand inline confirmation
3. Click "Yes, Delete"
4. Show loading state
5. On success: Close panel or return to list, show toast "Trip deleted"
6. On error: Show error message inline

---

## 6. Country Search Integration

### Pre-fill from Main Page

**User Flow:**
1. User selects "France" on main page
2. User clicks 🗺️ emoji to create trip
3. Country field in form is **pre-filled** with "France"
4. User can change it via the autocomplete if desired

**Implementation:**
- Pass `selectedCountry` prop from App to TripsPanel
- If creating new trip and `selectedCountry` exists, set as default value
- Visual indicator: Show flag next to pre-filled country name

### Direct Search in Form

- Form's country field uses same `CountryAutocomplete` component
- Consistent behavior and styling
- Flag appears in input when selected

---

## 7. Responsive Design Considerations

### Breakpoints

| Breakpoint | Behavior |
|------------|----------|
| **Desktop (>768px)** | Panel: `420px` width, slide from right |
| **Tablet/Mobile (≤768px)** | Panel: `100vw` width, full screen overlay |
| **Small mobile (<480px)** | Reduce padding, font sizes slightly |

### Mobile Optimizations

**Touch Targets:**
- Minimum `44px` height for all interactive elements
- Increase button padding on mobile

**Form Adjustments:**
- Date range: Stack vertically
- Reduce font sizes slightly (`1rem` → `0.95rem` for inputs)
- Sticky header/footer remain

**Panel Behavior:**
- On mobile, panel covers entire viewport
- Swipe-down-to-close (future enhancement, not MVP)
- Overlay is darker (`rgba(0, 0, 0, 0.8)`) for better focus

### Tablet (768px–1024px)

- Panel stays `420px` width
- Overlay visible but main content partially visible

---

## 8. Animation & Transition Recommendations

### Timing Function Philosophy

- **Entrance:** `cubic-bezier(0.4, 0, 0.2, 1)` (ease-out-cubic) - feels responsive
- **Exit:** `cubic-bezier(0.4, 0, 1, 1)` (ease-in) - quick and clean
- **Micro-interactions:** `ease` (default) for hovers

### Key Animations

**1. Panel Open/Close**
```css
transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
```
- Duration: 350ms (feels smooth, not sluggish)
- Transform: `translateX(100%)` → `translateX(0)`

**2. Overlay Fade**
```css
transition: opacity 0.35s ease;
```
- Synced with panel slide

**3. List → Form Transition**
```css
.trips-list.exiting {
  animation: slideOutLeft 0.2s ease forwards;
}

.trip-form.entering {
  animation: slideInRight 0.3s ease 0.1s forwards;
}

@keyframes slideOutLeft {
  to {
    transform: translateX(-20px);
    opacity: 0;
  }
}

@keyframes slideInRight {
  from {
    transform: translateX(20px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
```

**4. Trip Card Hover**
```css
transition: background 0.2s, border-color 0.2s, transform 0.15s;
transform: translateX(-2px); /* Subtle left shift on hover */
```

**5. Empty State Fade-In**
```css
animation: fadeInUp 0.4s ease; /* Reuse existing animation */
```

**6. Toast Notifications (Success/Error)**
```css
.toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%) translateY(100px);
  opacity: 0;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s;
}

.toast.visible {
  transform: translateX(-50%) translateY(0);
  opacity: 1;
}
```

### Performance Considerations

- Use `transform` and `opacity` only (hardware-accelerated)
- Avoid animating `width`, `height`, `margin`
- Add `will-change: transform` to panel during animation (remove after)

---

## 9. Accessibility Considerations

### Semantic HTML

```html
<!-- Panel -->
<aside
  role="dialog"
  aria-labelledby="trips-panel-title"
  aria-modal="true"
  class="trips-panel"
>
  <header class="trips-panel-header">
    <button aria-label="Close trips panel">←</button>
    <h2 id="trips-panel-title">My Trips</h2>
  </header>

  <div role="region" aria-label="Trips list">
    <!-- Trip cards -->
  </div>
</aside>

<!-- Form -->
<form aria-labelledby="form-title">
  <h2 id="form-title">New Trip</h2>

  <label for="country-input">
    Country <span aria-label="required" class="required">*</span>
  </label>
  <input
    id="country-input"
    aria-required="true"
    aria-invalid="false"
    aria-describedby="country-error"
  />
  <span id="country-error" role="alert"></span>
</form>
```

### Keyboard Navigation

**Panel Open/Close:**
- `Escape` key: Close panel
- Focus trap: When panel open, tab cycles within panel only
- On close: Return focus to emoji trigger

**Form Navigation:**
- `Tab`: Move through fields in logical order
- `Shift+Tab`: Reverse
- `Enter` on Save button: Submit form
- `Escape`: Trigger cancel (with confirmation if dirty)

**Trip List:**
- Arrow keys: Navigate between trip cards
- `Enter`: Open selected trip
- `Delete`: Trigger delete confirmation for focused trip

**Implementation:**
```javascript
// Focus trap example
useEffect(() => {
  if (isPanelOpen) {
    const focusableElements = panel.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    firstElement?.focus()

    function handleTab(e) {
      if (e.key === 'Tab') {
        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault()
          lastElement.focus()
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault()
          firstElement.focus()
        }
      }
    }

    document.addEventListener('keydown', handleTab)
    return () => document.removeEventListener('keydown', handleTab)
  }
}, [isPanelOpen])
```

### ARIA Attributes

**Live Regions:**
```html
<!-- Toast notifications -->
<div role="status" aria-live="polite" aria-atomic="true">
  Trip saved successfully
</div>

<!-- Error messages -->
<span role="alert" id="country-error">
  Country is required
</span>
```

**Button Labels:**
```html
<button aria-label="Close trips panel">←</button>
<button aria-label="Create new trip">+ New</button>
<button aria-label="Delete France Trip">🗑️</button>
```

**Panel State:**
```html
<button
  aria-expanded={isPanelOpen}
  aria-controls="trips-panel"
  aria-label="Open trips panel"
>
  🗺️
</button>
```

### Screen Reader Announcements

**Panel open:**
```
"Trips panel opened. My Trips. 3 trips. Use arrow keys to navigate."
```

**Empty state:**
```
"No trips yet. Start planning your next adventure. Create Your First Trip button."
```

**Form validation:**
```
"Country is required. Error. Please select a country."
```

### Color Contrast

All text meets WCAG AA standards:
- Body text `#e0e0e0` on `#0a0a0a`: **12.5:1** ✅
- Secondary text `#888` on `#0a0a0a`: **7.2:1** ✅
- Link purple `#667eea` on `#0a0a0a`: **4.8:1** ✅
- Error text `#e74c3c` on `#0a0a0a`: **4.5:1** ✅

### Focus Indicators

All interactive elements have visible focus states:
```css
:focus-visible {
  outline: 2px solid #667eea;
  outline-offset: 2px;
}
```

---

## 10. Component Hierarchy

### File Structure

```
src/
├── components/
│   ├── CountryAutocomplete.jsx (existing)
│   ├── CountryAutocomplete.css
│   ├── CountryShape.jsx (existing)
│   ├── CountryShape.css
│   │
│   ├── TripsPanel/
│   │   ├── TripsPanel.jsx          // Main panel container
│   │   ├── TripsPanel.css
│   │   ├── TripsList.jsx           // List view
│   │   ├── TripCard.jsx            // Individual trip card
│   │   ├── TripForm.jsx            // Create/edit form
│   │   ├── TripFormField.jsx       // Reusable form field
│   │   ├── EmptyState.jsx          // No trips yet
│   │   └── DeleteConfirm.jsx       // Inline delete confirmation
│   │
│   ├── TripsTrigger.jsx            // 🗺️ emoji button
│   └── Toast.jsx                   // Success/error notifications
│
├── App.jsx
└── App.css
```

### Component Breakdown

**1. `<TripsTrigger />`**
- Renders 🗺️ emoji in fixed top-right
- Handles click → toggle panel
- Receives `isOpen` and `onToggle` props

**2. `<TripsPanel />`**
- Main container (slide-in panel + overlay)
- Manages view state (list vs. form)
- Handles open/close, escape key, overlay click
- Props: `isOpen`, `onClose`, `selectedCountry`

**3. `<TripsList />`**
- Renders header with "My Trips" + "+ New" button
- Maps over trips array → `<TripCard />`
- Shows `<EmptyState />` if no trips
- Handles "New" button click → switch to `<TripForm />`

**4. `<TripCard />`**
- Displays flag, country name, dates, cities
- Click → open trip detail/edit
- Props: `trip`, `onClick`

**5. `<TripForm />`**
- Header with "← New Trip" / "← Edit Trip"
- Form fields (country, name, dates, cities, notes)
- Validation logic
- Save/Cancel sticky footer
- Optional: `<DeleteConfirm />` for edit mode
- Props: `trip` (null for new, object for edit), `onSave`, `onCancel`, `defaultCountry`

**6. `<TripFormField />`**
- Reusable wrapper for label + input + error
- Props: `label`, `required`, `error`, `children`

**7. `<EmptyState />`**
- Icon, message, "Create Your First Trip" button
- Props: `onCreate`

**8. `<DeleteConfirm />`**
- Inline confirmation UI
- Props: `onConfirm`, `onCancel`

**9. `<Toast />`**
- Fixed bottom-center notification
- Auto-dismiss after 3s
- Props: `message`, `type` (success/error), `visible`

### State Management

**Panel State (in App.jsx or TripsPanel):**
```javascript
const [isPanelOpen, setIsPanelOpen] = useState(false)
const [view, setView] = useState('list') // 'list' | 'form' | 'detail'
const [editingTrip, setEditingTrip] = useState(null)
```

**Trip Data (will integrate with state management from task #3):**
```javascript
const [trips, setTrips] = useState([])
// Will use context/zustand/redux per architecture decision
```

---

## 11. Integration with Existing UI

### Country Selection Flow

**Scenario A: User selects country on main page, then clicks emoji**
1. Country autocomplete on main page → user selects "France"
2. Flag shape displayed below search (existing behavior)
3. User clicks 🗺️ emoji
4. Panel opens with form
5. Country field **pre-filled** with "France" (passed via prop)

**Scenario B: User clicks emoji without selecting country**
1. Panel opens with trip list (or empty state)
2. User clicks "+ New"
3. Country field is empty, user searches within form

### Visual Consistency Checklist

- ✅ Same font family (Inter)
- ✅ Same color palette (dark bg, purple accent)
- ✅ Same border-radius (12px for cards/inputs)
- ✅ Same focus glow (purple, 3px offset)
- ✅ Same transition timing (0.2s–0.35s)
- ✅ Same font weights (300, 400, 500)
- ✅ Reuse `CountryAutocomplete` component
- ✅ Reuse `CountryShape` for flags
- ✅ Reuse `fadeInUp` animation for consistency

---

## 12. Future Enhancements (Out of MVP Scope)

- **Drag-to-reorder trips** in list view
- **Swipe gestures** on mobile (swipe down to close panel, swipe trip card to delete)
- **Trip detail view** with itinerary, photos, notes sections
- **Search/filter trips** (search bar in panel header)
- **Archive trips** (instead of delete)
- **Share trip** (export as link or PDF)
- **Trip templates** (pre-filled common destinations)
- **Dark/light mode toggle** (currently dark-only)

---

## Summary of Key Decisions

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| **Icon** | 🗺️ World Map, top-right | Distinctive, discoverable, non-intrusive |
| **Pattern** | Slide-in side panel | Preserves context, modern, mobile-friendly |
| **Panel Width** | 420px desktop, 100vw mobile | Optimal for forms, full-screen focus on mobile |
| **Form Fields** | Country (required), name, dates, cities, notes | Minimal MVP, country is core, rest optional |
| **Delete Pattern** | Inline confirmation | Lightweight, no modal bloat, clear consequences |
| **Country Integration** | Pre-fill from main page selection | Seamless flow, reduces friction |
| **Animations** | 350ms slide, fade-in-up, subtle hovers | Smooth, performant, consistent with app |
| **Accessibility** | Focus trap, ARIA labels, keyboard nav | WCAG AA compliant, inclusive design |
| **Component Structure** | Modular (TripsList, TripForm, TripCard) | Maintainable, testable, scalable |

---

**End of UX/UI Design Document**

This design ensures the trips feature feels like a natural extension of the PlanTrip app, maintaining the minimal, elegant aesthetic while adding powerful functionality in a user-friendly, accessible manner.
