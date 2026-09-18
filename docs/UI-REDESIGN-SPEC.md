# UI Redesign Specification: Green Theme Polish

## STRICT CONSTRAINTS

### What NOT to change:
- **Backend**: No API, database, auth, CORS, env vars, deployment config changes
- **API Layer**: No request/response format changes, no data flow modifications
- **Libraries**: Do NOT replace Mapbox, routing, state management, Chart.js, or React Map GL
- **Logic**: Keep all existing business logic, state management, and data handling
- **Data**: Do NOT invent metrics, forecasts, targets, or scientific data
- **Scope**: Frontend/UI styling and component structure ONLY

### What CAN change:
- CSS variables, colors, spacing, typography
- Component JSX structure for layout improvements
- CSS class names and styling rules
- Responsive grid layouts
- Visual hierarchy and presentation

---

## PHASE 1: Visual Foundation

### 1.1 Theme Token Refinement (`frontend/src/styles.css`)

**Current state**: Green theme exists but uses white backgrounds in light mode

**Target**: Establish proper light green backgrounds, NO white surfaces

#### Light Mode Updates:
```css
:root {
  --page: #e8f4ed;              /* Light green page (currently #edf5ef) */
  --surface: #f0f9f3;            /* Light green surface (currently #ffffff - WHITE!) */
  --surface-muted: #e3f2e8;      /* Slightly darker green (currently #f4faf5) */
  --surface-raised: #ddeee4;     /* Raised surface green (currently #e8f2eb) */
  --text: #0d2419;               /* Deep green text (currently #17352a) */
  --muted: #4a6455;              /* Muted green text (currently #5c7467) */
  --border: #c2dccb;             /* Light green border (currently #cfe1d4) */
  --border-strong: #8bb89d;      /* Strong border (currently #9fc6ad) */
  --primary: #087f5b;            /* Keep primary green */
  --primary-strong: #056044;     /* Keep strong primary */
  --primary-soft: #cee8db;       /* Softer primary bg (currently #d9f0e1) */
}
```

#### Dark Mode Updates:
```css
:root[data-theme="dark"] {
  --page: #06140e;               /* Deeper dark green (currently #081a14) */
  --surface: #0c1f15;            /* Dark green surface (currently #10291f) */
  --surface-muted: #081a11;      /* Darker muted (currently #0c2119) */
  --surface-raised: #11382a;     /* Raised dark green (currently #173a2c) */
  --text: #e3f5eb;               /* Light text (currently #e7f7ed) */
  --muted: #89a998;              /* Muted text (currently #9ab8a8) */
  --border: #1f4432;             /* Dark border (currently #28523f) */
  --border-strong: #2d7556;      /* Strong dark border (currently #3d8060) */
  --primary: #3fb881;            /* Brighter primary (currently #55c98b) */
  --primary-strong: #6dd09d;     /* Stronger bright (currently #8ce2ae) */
  --primary-soft: #14332a;       /* Soft dark primary (currently #183e2d) */
}
```

### 1.2 Remove Shadows/Gradients
Replace current shadow token:
```css
:root {
  --shadow: none; /* Remove shadow completely */
}
:root[data-theme="dark"] {
  --shadow: none; /* Remove dark shadow */
}
```

Update `.card` class:
```css
.card {
  box-shadow: none; /* Remove shadow */
  border: 1px solid var(--border-strong); /* Use stronger border */
}
```

### 1.3 Reduce Border Radius (Restrained Design)
Global updates:
```css
.card {
  border-radius: 8px; /* From 18px */
}

button {
  border-radius: 6px; /* From 10px */
}

input, textarea, select {
  border-radius: 6px; /* From 10px */
}

.project-list li, .site-list li {
  border-radius: 6px; /* From 12px */
}

.entry-mode {
  border-radius: 8px; /* From 12px */
}

.entry-mode button {
  border-radius: 5px; /* From 9px */
}

.map-wrap {
  border-radius: 8px; /* From 14px */
}

.analytics-card {
  border-radius: 12px 0 0 12px; /* From 22px */
}
```

### 1.4 Typography Hierarchy Enhancement

Update heading styles:
```css
h1 {
  font-size: 1.75rem;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.2;
}

h2 {
  font-size: 1.1rem;
  font-weight: 600;
  letter-spacing: -0.015em;
  line-height: 1.3;
}

h3 {
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.4;
}
```

### 1.5 Navbar Redesign

**Target**: Compact, sticky, subtle blur, solid/translucent green background, thin border

Current structure in `main.tsx`:
```tsx
<header>
  <h1>Darukaa.Earth</h1>
  <div className="header-actions">
    {/* logout button */}
  </div>
</header>
```

New CSS for header:
```css
.dashboard-layout > header {
  position: sticky;
  top: 0;
  z-index: 15;
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.85rem 1.2rem;
  margin: -1rem -1.2rem 1rem -1.2rem; /* Extend to edges */
  background: color-mix(in srgb, var(--surface) 85%, transparent);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
}

.dashboard-layout > header h1 {
  font-size: 1.35rem;
  font-weight: 700;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}
```

Update JSX in `main.tsx` (around line 1450+):
```tsx
<header>
  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
    <h1>Darukaa.Earth</h1>
    {selectedProject && (
      <span style={{ 
        color: 'var(--muted)', 
        fontSize: '0.9rem',
        fontWeight: 500 
      }}>
        / {selectedProject.name}
      </span>
    )}
  </div>
  <div className="header-actions">
    {/* existing logout button */}
  </div>
</header>
```

### 1.6 Project Summary Strip

**New Component**: Add project analytics summary below header

Insert after header in `main.tsx` Dashboard component:

```tsx
{projectAnalytics && (
  <section className="project-summary-strip">
    <div className="summary-stat">
      <strong>{projectAnalytics.total_area_hectares.toFixed(1)}</strong>
      <span>Total area (ha)</span>
    </div>
    <div className="summary-stat">
      <strong>
        {projectAnalytics.total_latest_carbon_tonnes_co2e !== null
          ? projectAnalytics.total_latest_carbon_tonnes_co2e.toFixed(1)
          : '—'}
      </strong>
      <span>Latest carbon (tCO₂e)</span>
    </div>
    <div className="summary-stat">
      <strong>
        {projectAnalytics.average_latest_biodiversity_score !== null
          ? projectAnalytics.average_latest_biodiversity_score.toFixed(2)
          : '—'}
      </strong>
      <span>Avg biodiversity</span>
    </div>
    <div className="summary-stat">
      <strong>{projectAnalytics.sites_with_metrics}</strong>
      <span>Sites with data</span>
    </div>
  </section>
)}
```

New CSS:
```css
.project-summary-strip {
  grid-column: 1 / -1;
  display: flex;
  gap: 1.5rem;
  padding: 1rem 1.2rem;
  background: var(--surface-raised);
  border: 1px solid var(--border-strong);
  border-radius: 8px;
}

.summary-stat {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.summary-stat strong {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--primary-strong);
  line-height: 1;
}

.summary-stat span {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

@media (max-width: 700px) {
  .project-summary-strip {
    grid-template-columns: repeat(2, 1fr);
    display: grid;
    gap: 1rem;
  }
}
```

### 1.7 Polish Project Form/List

Update project card styling:
```css
.project-create-card h2,
.projects-card h2 {
  margin-bottom: 0.85rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--border);
}

.project-list {
  margin: 0.85rem 0 0;
}

.project-item {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.project-item h3 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text);
  margin: 0;
}

.project-item p {
  font-size: 0.85rem;
  color: var(--muted);
  margin: 0;
}
```

### 1.8 Polish Map Container

Update map wrap styling:
```css
.map-wrap {
  position: relative;
  margin-top: 1rem;
  height: clamp(430px, 52vw, 650px);
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid var(--border-strong);
  background: var(--surface-raised);
}

.draw-toolbar {
  position: absolute;
  top: 1rem;
  right: 1rem;
  z-index: 3;
  display: flex;
  gap: 0.5rem;
}

.draw-toolbar .mode-button,
.draw-toolbar .mode-active {
  padding: 0.55rem 0.8rem;
  box-shadow: none;
  border: 1px solid var(--border-strong);
}
```

---

## PHASE 2: High-Impact UI Components

### 2.1 Redesigned Site Cards

**Target**: Cleaner cards with name, area, carbon, biodiversity, selection state, analytics CTA, sparkline

Update site list item structure in `main.tsx` (around line 1600+):

Current structure:
```tsx
<li key={site.id} className={/* selected class */}>
  <button onClick={/* select */} className="site-item">
    <strong>{site.name}</strong>
    <span>{site.area_hectares.toFixed(2)} ha</span>
    {/* sparkline */}
    <span className="site-analytics-cta">View analytics →</span>
  </button>
</li>
```

New structure:
```tsx
<li key={site.id} className={selectedSiteId === site.id ? "selected-site-card" : ""}>
  <button onClick={/* select */} className="site-card-button">
    <div className="site-card-header">
      <h3>{site.name}</h3>
      <span className="site-card-area">{site.area_hectares.toFixed(2)} ha</span>
    </div>
    
    <div className="site-card-metrics">
      <div className="site-card-metric">
        <span className="metric-label">Carbon</span>
        <span className="metric-value">
          {analytics?.latest_carbon_tonnes_co2e !== null 
            ? `${analytics.latest_carbon_tonnes_co2e.toFixed(1)} t` 
            : '—'}
        </span>
      </div>
      <div className="site-card-metric">
        <span className="metric-label">Biodiversity</span>
        <span className="metric-value">
          {analytics?.latest_biodiversity_score !== null 
            ? analytics.latest_biodiversity_score.toFixed(2) 
            : '—'}
        </span>
      </div>
    </div>

    {carbonHistory && carbonHistory.length > 0 && (
      <div className="site-trend">
        <Sparkline values={carbonHistory} />
      </div>
    )}

    <div className="site-card-cta">
      <span className="site-analytics-cta">View analytics →</span>
    </div>
  </button>
</li>
```

New CSS for site cards:
```css
.site-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
  margin: 1rem 0 0;
  padding: 0;
  list-style: none;
}

.site-list li {
  border: 2px solid var(--border);
  border-radius: 8px;
  padding: 0;
  background: var(--surface-muted);
  transition: all 180ms ease;
}

.site-list li:hover {
  border-color: var(--primary);
  background: var(--surface);
  transform: translateY(-2px);
}

.selected-site-card {
  border-color: var(--primary-strong) !important;
  background: var(--primary-soft) !important;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 20%, transparent);
}

.site-card-button {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  text-align: left;
  background: transparent;
  color: inherit;
  border: none;
}

.site-card-button:hover {
  background: transparent;
  border: none;
  transform: none;
}

.site-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.5rem;
}

.site-card-header h3 {
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--text);
  margin: 0;
  flex: 1;
}

.site-card-area {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--primary-strong);
  padding: 0.25rem 0.5rem;
  background: var(--primary-soft);
  border-radius: 4px;
  white-space: nowrap;
}

.site-card-metrics {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.site-card-metric {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.metric-label {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.metric-value {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--primary-strong);
}

.site-card-cta {
  display: flex;
  align-items: center;
  padding-top: 0.5rem;
  border-top: 1px solid var(--border);
}

.site-analytics-cta {
  color: var(--primary);
  font-size: 0.85rem;
  font-weight: 600;
  transition: all 160ms ease;
}

.site-card-button:hover .site-analytics-cta {
  color: var(--primary-strong);
  transform: translateX(3px);
}

@media (max-width: 1200px) {
  .site-list {
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  }
}

@media (max-width: 700px) {
  .site-list {
    grid-template-columns: 1fr;
  }
}
```

### 2.2 Responsive Layout Enhancement

Update dashboard grid:
```css
.dashboard-layout {
  position: relative;
  width: min(100%, 1480px);
  margin: 0 auto;
  display: grid;
  grid-template-columns: minmax(280px, 0.75fr) minmax(0, 2fr);
  grid-template-rows: auto auto auto 1fr;
  align-content: start;
  gap: 1.2rem;
  padding: 1.5rem clamp(1rem, 3vw, 2rem);
}

@media (max-width: 1024px) {
  .dashboard-layout {
    grid-template-columns: minmax(250px, 1fr) minmax(0, 1.5fr);
  }
}

@media (max-width: 700px) {
  .dashboard-layout {
    grid-template-columns: 1fr;
  }
}
```

### 2.3 Analytics Drawer Redesign

Update analytics drawer styling:
```css
.analytics-card {
  position: fixed;
  z-index: 20;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(850px, 100vw);
  max-width: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 2rem;
  background: var(--surface);
  border-left: 2px solid var(--border-strong);
  border-radius: 0;
  transform: translateX(105%);
  transition: transform 250ms cubic-bezier(0.4, 0, 0.2, 1);
}

.analytics-card.analytics-open {
  transform: translateX(0);
}

.analytics-heading {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.analytics-heading h2 {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
}
```

### 2.4 KPI Layout Improvement

Update KPI grid:
```css
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-top: 1.5rem;
}

.kpi-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1.25rem;
  border: 2px solid var(--border);
  border-radius: 8px;
  background: var(--surface-raised);
  transition: all 180ms ease;
}

.kpi-card:hover {
  border-color: var(--primary);
  background: var(--surface);
}

.kpi-label {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.kpi-card strong {
  font-size: clamp(1.75rem, 4vw, 2.5rem);
  font-weight: 700;
  color: var(--primary-strong);
  line-height: 1.1;
}

.kpi-card em {
  font-size: 0.8rem;
  font-weight: 600;
  font-style: normal;
  line-height: 1.4;
  margin-top: 0.25rem;
}

@media (max-width: 560px) {
  .kpi-grid {
    grid-template-columns: 1fr;
  }
}
```

### 2.5 Status Row Enhancement

```css
.status-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1.2rem;
  margin-top: 1.5rem;
  padding: 1rem;
  background: var(--surface-muted);
  border: 1px solid var(--border);
  border-radius: 8px;
}

.status-message {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--muted);
}

.status-dot {
  display: inline-block;
  width: 0.65rem;
  height: 0.65rem;
  border-radius: 50%;
  box-shadow: 0 0 0 2px color-mix(in srgb, currentColor 20%, transparent);
}
```

### 2.6 Chart Toolbar Enhancement

```css
.chart-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin-top: 1.5rem;
  padding: 0.75rem 1rem;
  background: var(--surface-raised);
  border: 1px solid var(--border);
  border-radius: 8px;
}

.chart-toolbar span {
  margin-right: 0.5rem;
  color: var(--text);
  font-size: 0.85rem;
  font-weight: 600;
}

.range-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin-top: 1rem;
  padding: 0.75rem 1rem;
  background: var(--surface-raised);
  border: 1px solid var(--border);
  border-radius: 8px;
}

.range-toolbar span {
  margin-right: 0.5rem;
  color: var(--text);
  font-size: 0.85rem;
  font-weight: 600;
}
```

---

## Implementation Order

### Phase 1 Steps:
1. Update theme tokens in `:root` and `:root[data-theme="dark"]`
2. Remove shadows from all components
3. Reduce all border-radius values
4. Update typography scale
5. Implement sticky navbar with blur
6. Add project summary strip component
7. Polish project form/list styling
8. Polish map container styling

### Phase 2 Steps:
1. Redesign site card component structure (JSX + CSS)
2. Update responsive grid layouts
3. Redesign analytics drawer styling
4. Improve KPI card layout
5. Enhance status row styling
6. Polish chart toolbar styling

---

## Testing Checklist

After each phase:
- [ ] Run `npm run dev` - ensure app starts
- [ ] Test light/dark theme toggle
- [ ] Test responsive breakpoints (desktop, tablet, mobile)
- [ ] Test project creation and selection
- [ ] Test site selection and analytics drawer
- [ ] Verify map still works (no Mapbox changes)
- [ ] Verify all API calls still work (no backend changes)
- [ ] Run `npm run quality` - ensure no errors
- [ ] Verify no backend files modified: `git status | grep backend/`

---

## Files to Modify

### Phase 1:
- `frontend/src/styles.css` (theme tokens, global styles)
- `frontend/src/main.tsx` (navbar JSX, project summary strip)

### Phase 2:
- `frontend/src/main.tsx` (site card JSX structure, analytics drawer)
- `frontend/src/styles.css` (site cards, responsive grids, KPI styling)

### Files to NEVER modify:
- Any `backend/` files
- `.env`, `.env.example`
- `database/` files
- `docs/DEPLOYMENT.md`
- Any API or database logic

---

## Color Reference

### Light Mode Palette:
- **Page**: `#e8f4ed` (light green)
- **Surface**: `#f0f9f3` (NO white!)
- **Text**: `#0d2419` (deep green)
- **Primary**: `#087f5b` (forest green)
- **Primary Strong**: `#056044` (dark forest)
- **Muted**: `#4a6455` (muted green text)

### Dark Mode Palette:
- **Page**: `#06140e` (deep dark green)
- **Surface**: `#0c1f15` (dark green surface)
- **Text**: `#e3f5eb` (light green text)
- **Primary**: `#3fb881` (bright green)
- **Primary Strong**: `#6dd09d` (brighter green)
- **Muted**: `#89a998` (muted light green)

---

## Design Principles

1. **No gradients** - solid colors only
2. **No shadows** - rely on borders and layering
3. **Restrained radius** - 4-8px maximum
4. **Green everywhere** - eliminate white in light mode
5. **Strong typography** - clear hierarchy, readable sizes
6. **Solid borders** - 1-2px borders for definition
7. **Consistent spacing** - use 0.5rem increments
8. **Subtle animations** - 160-250ms transitions

---

## Success Criteria

### Visual:
- ✓ NO white backgrounds in light mode
- ✓ NO shadows anywhere
- ✓ NO large border radius (>12px)
- ✓ Green theme applied consistently
- ✓ Clean, professional appearance

### Functional:
- ✓ All existing features work unchanged
- ✓ Responsive on all screen sizes
- ✓ Light/dark mode both polished
- ✓ No console errors
- ✓ Quality checks pass

### Safety:
- ✓ NO backend files modified
- ✓ NO API changes
- ✓ NO env var changes
- ✓ Build succeeds
- ✓ Tests pass
