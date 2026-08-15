/* @ds-bundle: {"format":4,"namespace":"SyntaxTreeDesignSystem_b1a4e9","components":[{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Callout","sourcePath":"components/core/Callout.jsx"},{"name":"Chip","sourcePath":"components/core/Chip.jsx"},{"name":"Icon","sourcePath":"components/core/Icon.jsx"},{"name":"IconButton","sourcePath":"components/core/IconButton.jsx"},{"name":"Panel","sourcePath":"components/core/Panel.jsx"},{"name":"StatusBadge","sourcePath":"components/core/StatusBadge.jsx"},{"name":"AIInterpretationCard","sourcePath":"components/epistemic/AIInterpretationCard.jsx"},{"name":"ArchitectureTree","sourcePath":"components/epistemic/ArchitectureTree.jsx"},{"name":"ClusterCard","sourcePath":"components/epistemic/ClusterCard.jsx"},{"name":"ProvenanceChip","sourcePath":"components/epistemic/ProvenanceChip.jsx"},{"name":"StatementCard","sourcePath":"components/epistemic/StatementCard.jsx"},{"name":"StructuralRegion","sourcePath":"components/epistemic/StructuralRegion.jsx"},{"name":"ThemeToggle","sourcePath":"components/epistemic/ThemeToggle.jsx"},{"name":"ClaimCard","sourcePath":"components/evidence/ClaimCard.jsx"},{"name":"EvidenceRow","sourcePath":"components/evidence/EvidenceRow.jsx"},{"name":"FileList","sourcePath":"components/evidence/FileList.jsx"},{"name":"ProgressMeter","sourcePath":"components/feedback/ProgressMeter.jsx"},{"name":"PromiseCard","sourcePath":"components/feedback/PromiseCard.jsx"},{"name":"StageRow","sourcePath":"components/feedback/StageRow.jsx"},{"name":"StateCard","sourcePath":"components/feedback/StateCard.jsx"},{"name":"CheckField","sourcePath":"components/forms/CheckField.jsx"},{"name":"PathInput","sourcePath":"components/forms/PathInput.jsx"},{"name":"SegmentedControl","sourcePath":"components/forms/SegmentedControl.jsx"},{"name":"TextInput","sourcePath":"components/forms/TextInput.jsx"},{"name":"LensNode","sourcePath":"components/map/LensNode.jsx"},{"name":"MapLegend","sourcePath":"components/map/MapLegend.jsx"},{"name":"BreadcrumbTrail","sourcePath":"components/navigation/BreadcrumbTrail.jsx"},{"name":"RunPicker","sourcePath":"components/navigation/RunPicker.jsx"},{"name":"TabRail","sourcePath":"components/navigation/TabRail.jsx"}],"sourceHashes":{"components/core/Button.jsx":"27e993c3108b","components/core/Callout.jsx":"416436c20ada","components/core/Chip.jsx":"44cb4dc17d24","components/core/Icon.jsx":"d2e211dfae8a","components/core/IconButton.jsx":"fd790f780fc0","components/core/Panel.jsx":"9e89f14303db","components/core/StatusBadge.jsx":"f9730b77f0cf","components/epistemic/AIInterpretationCard.jsx":"7687171816d4","components/epistemic/ArchitectureTree.jsx":"f48839d9ed7b","components/epistemic/ClusterCard.jsx":"5816241ce868","components/epistemic/ProvenanceChip.jsx":"64c2c7b51ddd","components/epistemic/StatementCard.jsx":"8f3664883c17","components/epistemic/StructuralRegion.jsx":"4bbb443e8676","components/epistemic/ThemeToggle.jsx":"f50ad01c0bcf","components/evidence/ClaimCard.jsx":"6c67e66c8b6f","components/evidence/EvidenceRow.jsx":"7be803202596","components/evidence/FileList.jsx":"7d7255164fca","components/feedback/ProgressMeter.jsx":"df73552725c5","components/feedback/PromiseCard.jsx":"cda50a7f8c74","components/feedback/StageRow.jsx":"05956ef0ead8","components/feedback/StateCard.jsx":"1226b2dd70f5","components/forms/CheckField.jsx":"7d390fbd8943","components/forms/PathInput.jsx":"7cff3513055f","components/forms/SegmentedControl.jsx":"4a63b06f86b8","components/forms/TextInput.jsx":"c5b9f6723dea","components/map/LensNode.jsx":"d414395a6ac7","components/map/MapLegend.jsx":"ca6f18643001","components/navigation/BreadcrumbTrail.jsx":"38cef48e7f70","components/navigation/RunPicker.jsx":"be0ea54b0cae","components/navigation/TabRail.jsx":"040cc8559fa6","ui_kits/lauras-graph/GraphCanvas.jsx":"cf746afea032","ui_kits/lauras-graph/GraphScreens.jsx":"451b0e9836d1","ui_kits/lauras-graph/graph-data.js":"c3b04ba72d5d","ui_kits/lauras-redesign/Explorer.jsx":"e6189f991722","ui_kits/lauras-redesign/Landing.jsx":"525e8c12f7c6","ui_kits/lauras-redesign/Settings.jsx":"32bce6b989bb","ui_kits/lauras-redesign/Shell.jsx":"0dae5679c3c1","ui_kits/lauras-redesign/data.js":"dea35107cc70","ui_kits/lauras-redesign/theme.js":"fe504772214d","ui_kits/syntax-tree/EntryScreen.jsx":"54d4017b0650","ui_kits/syntax-tree/ObservatoryScreen.jsx":"b332dd3aacfd","ui_kits/syntax-tree/data.js":"4d8c371d620a"},"inlinedExternals":[],"unexposedExports":[{"name":"evidenceStatusMeta","sourcePath":"components/core/StatusBadge.jsx"},{"name":"iconGlyphs","sourcePath":"components/core/Icon.jsx"},{"name":"provenanceMeta","sourcePath":"components/epistemic/ProvenanceChip.jsx"}]} */

(() => {

const __ds_ns = (window.SyntaxTreeDesignSystem_b1a4e9 = window.SyntaxTreeDesignSystem_b1a4e9 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const sizes = {
  sm: {
    minHeight: 28,
    padding: '0 10px',
    fontSize: 'var(--text-small)',
    borderRadius: 'var(--radius-md)'
  },
  md: {
    minHeight: 32,
    padding: '0 12px',
    fontSize: 'var(--text-body)',
    borderRadius: 'var(--radius-md)'
  },
  lg: {
    minHeight: 48,
    padding: '0 16px',
    fontSize: 'var(--text-node-title)',
    borderRadius: 'var(--radius-lg)',
    fontWeight: 'var(--weight-button)'
  }
};
const variants = {
  primary: {
    color: 'var(--action-primary-fg)',
    background: 'var(--action-primary-bg)',
    border: '1px solid var(--obs-slate-blue)'
  },
  quiet: {
    color: 'var(--obs-slate-blue)',
    background: 'var(--action-quiet-bg)',
    border: '1px solid color-mix(in srgb, var(--obs-slate-blue) 18%, var(--obs-border))'
  },
  secondary: {
    color: 'var(--obs-ink)',
    background: 'var(--obs-paper)',
    border: '1px solid var(--obs-border)'
  },
  pill: {
    color: 'var(--obs-stone)',
    background: 'transparent',
    border: '1px solid var(--obs-border)',
    borderRadius: 'var(--radius-pill)'
  }
};

/** Text button. `quiet` is the rail/action default; `primary` is the one call to action per screen. */
function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  iconAfter,
  disabled,
  children,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    disabled: disabled,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 'var(--space-3)',
      fontFamily: 'var(--font-sans)',
      lineHeight: 1.2,
      whiteSpace: 'nowrap',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.48 : 1,
      transition: 'transform var(--transition-micro), background var(--transition-micro), border-color var(--transition-micro)',
      ...sizes[size],
      ...variants[variant],
      ...style
    }
  }, rest), icon, children, iconAfter);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Callout.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const tones = {
  warning: {
    color: 'color-mix(in srgb, var(--obs-ink) 76%, var(--obs-clay))',
    background: 'color-mix(in srgb, var(--obs-clay) 7%, var(--obs-paper))',
    borderColor: 'color-mix(in srgb, var(--obs-clay) 18%, var(--obs-border))'
  },
  unsupported: {
    color: 'color-mix(in srgb, var(--obs-ink) 74%, var(--obs-muted-red))',
    background: 'color-mix(in srgb, var(--obs-muted-red) 7%, var(--obs-paper))',
    borderColor: 'color-mix(in srgb, var(--obs-muted-red) 18%, var(--obs-border))'
  },
  success: {
    color: 'color-mix(in srgb, var(--obs-ink) 76%, var(--obs-sage))',
    background: 'color-mix(in srgb, var(--obs-sage) 7%, var(--obs-paper))',
    borderColor: 'color-mix(in srgb, var(--obs-sage) 20%, var(--obs-border))'
  }
};

/** Inline honesty note: what the analysis could not establish, and why. */
function Callout({
  tone = 'warning',
  icon,
  children,
  style,
  ...rest
}) {
  const t = tones[tone];
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 'var(--space-4)',
      padding: '13px 14px',
      borderRadius: 'var(--radius-lg)',
      border: `1px solid ${t.borderColor}`,
      color: t.color,
      background: t.background,
      fontSize: 'var(--text-body-tight)',
      lineHeight: 'var(--leading-normal)',
      ...style
    }
  }, rest), icon, /*#__PURE__*/React.createElement("span", null, children));
}
Object.assign(__ds_scope, { Callout });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Callout.jsx", error: String((e && e.message) || e) }); }

// components/core/Chip.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const tones = {
  clay: {
    color: 'color-mix(in srgb, var(--obs-clay) 72%, var(--obs-ink))',
    background: 'color-mix(in srgb, var(--obs-clay) 10%, transparent)',
    border: '1px solid transparent'
  },
  fact: {
    color: 'var(--text-body)',
    background: 'rgba(255, 255, 255, 0.42)',
    border: '1px solid var(--obs-border)'
  },
  slate: {
    color: 'var(--obs-slate-blue)',
    background: 'color-mix(in srgb, var(--obs-slate-blue) 8%, transparent)',
    border: '1px solid color-mix(in srgb, var(--obs-slate-blue) 24%, var(--obs-border))'
  },
  signal: {
    color: 'var(--chip-signal-fg)',
    background: 'var(--chip-signal-bg)',
    border: '1px solid transparent'
  },
  /** Dashed + unfilled on purpose: a classification score must never look like a verification status. */
  measure: {
    color: 'var(--text-body)',
    background: 'transparent',
    border: '1px dashed var(--obs-border)'
  }
};

/** Small pill for a status word, a fact, a framework signal, or a measurement. */
function Chip({
  tone = 'fact',
  icon,
  children,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 'var(--space-2)',
      minHeight: 24,
      padding: '0 9px',
      borderRadius: 'var(--radius-pill)',
      fontSize: 'var(--text-micro)',
      whiteSpace: 'nowrap',
      ...tones[tone],
      ...style
    }
  }, rest), icon, children);
}
Object.assign(__ds_scope, { Chip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Chip.jsx", error: String((e && e.message) || e) }); }

// components/core/Icon.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Lucide glyphs, vendored. The markup below is copied verbatim from
 * lucide-icons/lucide `icons/` (also kept as files in `assets/icons/`) — no
 * network request, no CDN, works offline and in rasterised captures. Upstream
 * draws lucide at stroke 1.6–1.9; 1.75 is the house value.
 *
 * To add a glyph: copy `icons/<name>.svg` from lucide-icons/lucide, drop it in
 * `assets/icons/`, and paste its inner markup here. Never draw one by hand.
 */
const iconGlyphs = {
  'alert-triangle': '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"></path> <path d="M12 9v4"></path> <path d="M12 17h.01"></path>',
  'arrow-down-to-line': '<path d="M12 17V3"></path> <path d="m6 11 6 6 6-6"></path> <path d="M19 21H5"></path>',
  'arrow-left': '<path d="m12 19-7-7 7-7"></path> <path d="M19 12H5"></path>',
  'arrow-right': '<path d="M5 12h14"></path> <path d="m12 5 7 7-7 7"></path>',
  'arrow-up-right': '<path d="M7 7h10v10"></path> <path d="M7 17 17 7"></path>',
  'book-open': '<path d="M12 5v16"></path> <path d="M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z"></path>',
  'bookmark-plus': '<path d="M12 7v6"></path> <path d="M15 10H9"></path> <path d="M17 3a2 2 0 0 1 2 2v15a1 1 0 0 1-1.496.868l-4.512-2.578a2 2 0 0 0-1.984 0l-4.512 2.578A1 1 0 0 1 5 20V5a2 2 0 0 1 2-2z"></path>',
  'box': '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"></path> <path d="m3.3 7 8.7 5 8.7-5"></path> <path d="M12 22V12"></path>',
  'boxes': '<path d="M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19v-5.5l-5-3-4.03 2.42Z"></path> <path d="m7 16.5-4.74-2.85"></path> <path d="m7 16.5 5-3"></path> <path d="M7 16.5v5.17"></path> <path d="M12 13.5V19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L17 10.5l-5 3Z"></path> <path d="m17 16.5-5-3"></path> <path d="m17 16.5 4.74-2.85"></path> <path d="M17 16.5v5.17"></path> <path d="M7.97 4.42A2 2 0 0 0 7 6.13v4.37l5 3 5-3V6.13a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0l-3 1.8Z"></path> <path d="M12 8 7.26 5.15"></path> <path d="m12 8 4.74-2.85"></path> <path d="M12 13.5V8"></path>',
  'chevron-down': '<path d="m6 9 6 6 6-6"></path>',
  'chevron-right': '<path d="m9 18 6-6-6-6"></path>',
  'chevrons-down-up': '<path d="m7 20 5-5 5 5"></path> <path d="m7 4 5 5 5-5"></path>',
  'chevrons-up-down': '<path d="m7 15 5 5 5-5"></path> <path d="m7 9 5-5 5 5"></path>',
  'circle-alert': '<circle cx="12" cy="12" r="10"></circle> <line x1="12" x2="12" y1="8" y2="12"></line> <line x1="12" x2="12.01" y1="16" y2="16"></line>',
  'circle-check-big': '<path d="M21.801 10A10 10 0 1 1 17 3.335"></path> <path d="m9 11 3 3L22 4"></path>',
  'circle-dot': '<circle cx="12" cy="12" r="10"></circle> <circle cx="12" cy="12" r="1"></circle>',
  'circle-x': '<circle cx="12" cy="12" r="10"></circle> <path d="m15 9-6 6"></path> <path d="m9 9 6 6"></path>',
  'clock': '<circle cx="12" cy="12" r="10"></circle> <path d="M12 6v6l4 2"></path>',
  'code': '<path d="m16 18 6-6-6-6"></path> <path d="m8 6-6 6 6 6"></path>',
  'compass': '<circle cx="12" cy="12" r="10"></circle> <path d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z"></path>',
  'component': '<path d="M15.536 11.293a1 1 0 0 0 0 1.414l2.376 2.377a1 1 0 0 0 1.414 0l2.377-2.377a1 1 0 0 0 0-1.414l-2.377-2.377a1 1 0 0 0-1.414 0z"></path> <path d="M2.297 11.293a1 1 0 0 0 0 1.414l2.377 2.377a1 1 0 0 0 1.414 0l2.377-2.377a1 1 0 0 0 0-1.414L6.088 8.916a1 1 0 0 0-1.414 0z"></path> <path d="M8.916 17.912a1 1 0 0 0 0 1.415l2.377 2.376a1 1 0 0 0 1.414 0l2.377-2.376a1 1 0 0 0 0-1.415l-2.377-2.376a1 1 0 0 0-1.414 0z"></path> <path d="M8.916 4.674a1 1 0 0 0 0 1.414l2.377 2.376a1 1 0 0 0 1.414 0l2.377-2.376a1 1 0 0 0 0-1.414l-2.377-2.377a1 1 0 0 0-1.414 0z"></path>',
  'copy': '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect> <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>',
  'database': '<ellipse cx="12" cy="5" rx="9" ry="3"></ellipse> <path d="M3 5V19A9 3 0 0 0 21 19V5"></path> <path d="M3 12A9 3 0 0 0 21 12"></path>',
  'external-link': '<path d="M15 3h6v6"></path> <path d="M10 14 21 3"></path> <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>',
  'file-code': '<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"></path> <path d="M14 2v5a1 1 0 0 0 1 1h5"></path> <path d="M10 12.5 8 15l2 2.5"></path> <path d="m14 12.5 2 2.5-2 2.5"></path>',
  'file-code-2': '<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"></path> <path d="M14 2v5a1 1 0 0 0 1 1h5"></path> <path d="M10 12.5 8 15l2 2.5"></path> <path d="m14 12.5 2 2.5-2 2.5"></path>',
  'file-text': '<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"></path> <path d="M14 2v5a1 1 0 0 0 1 1h5"></path> <path d="M10 9H8"></path> <path d="M16 13H8"></path> <path d="M16 17H8"></path>',
  'folder-open': '<path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"></path>',
  'folder-search': '<path d="M10.7 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v4.1"></path> <path d="m21 21-1.9-1.9"></path> <circle cx="17" cy="17" r="3"></circle>',
  'folder-tree': '<path d="M20 10a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2.5a1 1 0 0 1-.8-.4l-.9-1.2A1 1 0 0 0 15 3h-2a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1Z"></path> <path d="M20 21a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1h-2.9a1 1 0 0 1-.88-.55l-.42-.85a1 1 0 0 0-.92-.6H13a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1Z"></path> <path d="M3 5a2 2 0 0 0 2 2h3"></path> <path d="M3 3v13a2 2 0 0 0 2 2h3"></path>',
  'git-branch': '<path d="M15 6a9 9 0 0 0-9 9V3"></path> <circle cx="18" cy="6" r="3"></circle> <circle cx="6" cy="18" r="3"></circle>',
  'info': '<circle cx="12" cy="12" r="10"></circle> <path d="M12 16v-4"></path> <path d="M12 8h.01"></path>',
  'list': '<path d="M3 5h.01"></path> <path d="M3 12h.01"></path> <path d="M3 19h.01"></path> <path d="M8 5h13"></path> <path d="M8 12h13"></path> <path d="M8 19h13"></path>',
  'list-tree': '<path d="M8 5h13"></path> <path d="M13 12h8"></path> <path d="M13 19h8"></path> <path d="M3 10a2 2 0 0 0 2 2h3"></path> <path d="M3 5v12a2 2 0 0 0 2 2h3"></path>',
  'loader-circle': '<path d="M21 12a9 9 0 1 1-6.219-8.56"></path>',
  'maximize': '<path d="M8 3H5a2 2 0 0 0-2 2v3"></path> <path d="M21 8V5a2 2 0 0 0-2-2h-3"></path> <path d="M3 16v3a2 2 0 0 0 2 2h3"></path> <path d="M16 21h3a2 2 0 0 0 2-2v-3"></path>',
  'menu': '<path d="M4 5h16"></path> <path d="M4 12h16"></path> <path d="M4 19h16"></path>',
  'message-square-text': '<path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"></path> <path d="M7 11h10"></path> <path d="M7 15h6"></path> <path d="M7 7h8"></path>',
  'minus': '<path d="M5 12h14"></path>',
  'monitor': '<rect width="20" height="14" x="2" y="3" rx="2"></rect> <line x1="8" x2="16" y1="21" y2="21"></line> <line x1="12" x2="12" y1="17" y2="21"></line>',
  'moon': '<path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"></path>',
  'network': '<rect x="16" y="16" width="6" height="6" rx="1"></rect> <rect x="2" y="16" width="6" height="6" rx="1"></rect> <rect x="9" y="2" width="6" height="6" rx="1"></rect> <path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"></path> <path d="M12 12V8"></path>',
  'panel-right': '<rect width="18" height="18" x="3" y="3" rx="2"></rect> <path d="M15 3v18"></path>',
  'plus': '<path d="M5 12h14"></path> <path d="M12 5v14"></path>',
  'refresh-cw': '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path> <path d="M21 3v5h-5"></path> <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path> <path d="M8 16H3v5"></path>',
  'search-code': '<path d="m13 13.5 2-2.5-2-2.5"></path> <path d="m21 21-4.3-4.3"></path> <path d="M9 8.5 7 11l2 2.5"></path> <circle cx="11" cy="11" r="8"></circle>',
  'send': '<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"></path> <path d="m21.854 2.147-10.94 10.939"></path>',
  'settings': '<path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"></path> <circle cx="12" cy="12" r="3"></circle>',
  'shield-check': '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"></path> <path d="m9 12 2 2 4-4"></path>',
  'sparkles': '<path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"></path> <path d="M20 2v4"></path> <path d="M22 4h-4"></path> <circle cx="4" cy="20" r="2"></circle>',
  'sun': '<circle cx="12" cy="12" r="4"></circle> <path d="M12 2v2"></path> <path d="M12 20v2"></path> <path d="m4.93 4.93 1.41 1.41"></path> <path d="m17.66 17.66 1.41 1.41"></path> <path d="M2 12h2"></path> <path d="M20 12h2"></path> <path d="m6.34 17.66-1.41 1.41"></path> <path d="m19.07 4.93-1.41 1.41"></path>',
  'triangle-alert': '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"></path> <path d="M12 9v4"></path> <path d="M12 17h.01"></path>',
  'waypoints': '<path d="m10.586 5.414-5.172 5.172"></path> <path d="m18.586 13.414-5.172 5.172"></path> <path d="M6 12h12"></path> <circle cx="12" cy="20" r="2"></circle> <circle cx="12" cy="4" r="2"></circle> <circle cx="20" cy="12" r="2"></circle> <circle cx="4" cy="12" r="2"></circle>',
  'workflow': '<rect width="8" height="8" x="3" y="3" rx="2"></rect> <path d="M7 11v4a2 2 0 0 0 2 2h4"></path> <rect width="8" height="8" x="13" y="13" rx="2"></rect>',
  'x': '<path d="M18 6 6 18"></path> <path d="m6 6 12 12"></path>'
};
function Icon({
  name,
  size = 16,
  strokeWidth = 1.75,
  style,
  ...rest
}) {
  const glyph = iconGlyphs[name];
  if (glyph === undefined && typeof console !== 'undefined') console.warn('Icon: no vendored glyph named "' + name + '"');
  return /*#__PURE__*/React.createElement("svg", _extends({
    "aria-hidden": "true",
    viewBox: "0 0 24 24",
    width: size,
    height: size,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: {
      display: 'block',
      flex: '0 0 auto',
      ...style
    },
    dangerouslySetInnerHTML: {
      __html: glyph || ''
    }
  }, rest));
}
Object.assign(__ds_scope, { iconGlyphs, Icon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Icon.jsx", error: String((e && e.message) || e) }); }

// components/core/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** 30×30 transparent icon button — top bar, panel headers, close affordances. */
function IconButton({
  icon,
  label,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    "aria-label": label,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 'var(--control-height)',
      height: 'var(--control-height)',
      padding: 0,
      color: 'var(--obs-ink)',
      background: hover ? 'var(--action-tint)' : 'transparent',
      border: `1px solid ${hover ? 'rgba(61, 90, 128, 0.18)' : 'transparent'}`,
      borderRadius: 'var(--radius-md)',
      cursor: 'pointer',
      transition: 'color var(--transition-micro), border-color var(--transition-micro), background var(--transition-micro)',
      ...style
    }
  }, rest), icon);
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/core/Panel.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Paper card: the one container shape in the product. */
function Panel({
  padding = 26,
  translucent = false,
  elevation = 'panel',
  children,
  style,
  ...rest
}) {
  const shadows = {
    none: 'none',
    node: 'var(--shadow-node)',
    card: 'var(--shadow-card)',
    panel: 'var(--shadow-panel)'
  };
  return /*#__PURE__*/React.createElement("section", _extends({
    style: {
      padding,
      color: 'var(--obs-ink)',
      background: translucent ? 'var(--surface-card-translucent)' : 'var(--obs-paper)',
      border: '1px solid var(--obs-border)',
      borderRadius: 'var(--radius-2xl)',
      boxShadow: shadows[elevation],
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Panel });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Panel.jsx", error: String((e && e.message) || e) }); }

// components/core/StatusBadge.jsx
try { (() => {
const evidenceStatusMeta = {
  verified: {
    label: 'Verified',
    description: 'Source-backed evidence is available.'
  },
  partial: {
    label: 'Partial',
    description: 'Some evidence is source-backed and some remains inferred or incomplete.'
  },
  insufficient: {
    label: 'Insufficient',
    description: 'The backend found this area, but source evidence is incomplete.'
  },
  candidate: {
    label: 'Candidate',
    description: 'This area is plausible but not promoted to verified evidence.'
  },
  inferred: {
    label: 'Inferred',
    description: 'This is inferred from structure rather than direct source spans.'
  },
  unsupported: {
    label: 'Unsupported',
    description: 'The available source evidence does not support this claim.'
  },
  stale: {
    label: 'Stale',
    description: 'This evidence may no longer match the current source snapshot.'
  },
  legacy: {
    label: 'Legacy',
    description: 'This area comes from a legacy projection or compatibility path.'
  }
};
const half = 'linear-gradient(90deg, var(--obs-clay) 0 50%, transparent 50% 100%)';
const dot = {
  verified: {
    background: 'var(--status-verified)'
  },
  partial: {
    background: half,
    border: '1px solid var(--obs-clay)'
  },
  insufficient: {
    background: half,
    border: '1px solid var(--obs-clay)'
  },
  candidate: {
    background: 'transparent',
    border: '1.4px solid var(--obs-stone)'
  },
  inferred: {
    background: 'transparent',
    border: '1.4px dashed var(--obs-stone)'
  },
  unsupported: {
    background: 'transparent',
    border: '1.3px solid var(--obs-muted-red)',
    position: 'relative'
  },
  stale: {
    background: 'transparent',
    border: '1.3px solid var(--obs-stone)',
    boxShadow: 'inset 3px 0 0 var(--obs-stone)'
  },
  legacy: {
    background: 'color-mix(in srgb, var(--obs-stone) 65%, transparent)',
    border: '1.3px solid var(--obs-stone)'
  }
};

/** The 9px evidence-status dot. Shape carries the meaning; color never carries it alone. */
function StatusBadge({
  status,
  showLabel = false,
  title
}) {
  const meta = evidenceStatusMeta[status] ?? evidenceStatusMeta.candidate;
  const description = title ?? meta.description;
  return /*#__PURE__*/React.createElement("span", {
    title: description,
    "aria-label": `${meta.label}: ${description}`,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 'var(--space-2)',
      minWidth: 0,
      whiteSpace: 'nowrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-block',
      width: 9,
      height: 9,
      flex: '0 0 9px',
      borderRadius: 'var(--radius-pill)',
      ...dot[status]
    }
  }, status === 'unsupported' && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 3,
      left: 1,
      width: 7,
      height: 1.2,
      background: 'var(--obs-muted-red)',
      transform: 'rotate(-38deg)'
    }
  })), showLabel && /*#__PURE__*/React.createElement("span", null, meta.label));
}
Object.assign(__ds_scope, { evidenceStatusMeta, StatusBadge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/StatusBadge.jsx", error: String((e && e.message) || e) }); }

// components/epistemic/ProvenanceChip.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * The four-way provenance mark. This is the load-bearing epistemic control:
 * every layer gets its own icon, its own word, and its own shape — so the
 * distinction survives dark mode, greyscale and screen readers.
 */
const provenanceMeta = {
  structure: {
    label: 'Structure',
    icon: 'folder-tree',
    description: 'Read directly from the repository. Deterministic.'
  },
  cluster: {
    label: 'Structural cluster',
    icon: 'waypoints',
    description: 'Derived from real import and call relations by a fixed rule. Deterministic and reproducible; another rule could split these differently.'
  },
  ai: {
    label: 'AI interpretation',
    icon: 'sparkles',
    description: 'A model\u2019s reading of a group that was already fixed by analysis. Not verified.'
  },
  verified: {
    label: 'Verified statement',
    icon: 'shield-check',
    description: 'A proposition checked against source evidence by the verifier.'
  },
  evidence: {
    label: 'Source evidence',
    icon: 'file-code-2',
    description: 'An exact file and line range in the repository.'
  }
};
const tones = {
  structure: {
    color: 'var(--text-muted)',
    border: 'var(--structural-container-border)',
    background: 'transparent',
    radius: 'var(--radius-xs)'
  },
  cluster: {
    color: 'var(--structural-cluster-accent)',
    border: 'var(--structural-cluster-border)',
    background: 'var(--structural-cluster-bg)',
    radius: 'var(--radius-xs)'
  },
  ai: {
    color: 'var(--ai-text)',
    border: 'var(--ai-border)',
    background: 'var(--ai-surface)',
    radius: 'var(--radius-pill)'
  },
  verified: {
    color: 'var(--text-secondary)',
    border: 'var(--border-default2)',
    background: 'transparent',
    radius: 'var(--radius-xs)'
  },
  evidence: {
    color: 'var(--text-muted)',
    border: 'var(--border-default2)',
    background: 'transparent',
    radius: 'var(--radius-xs)'
  }
};
function ProvenanceChip({
  kind = 'structure',
  label,
  size = 'md',
  style,
  ...rest
}) {
  const meta = provenanceMeta[kind];
  const tone = tones[kind];
  const small = size === 'sm';
  return /*#__PURE__*/React.createElement("span", _extends({
    title: meta.description,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: small ? 5 : 6,
      minHeight: small ? 19 : 23,
      padding: small ? '0 6px' : '0 8px',
      color: tone.color,
      background: tone.background,
      border: `1px solid ${tone.border}`,
      borderRadius: tone.radius,
      fontSize: small ? 'var(--text-caption)' : 'var(--text-micro)',
      fontWeight: 'var(--weight-label)',
      letterSpacing: 'var(--tracking-label)',
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: meta.icon,
    size: small ? 11 : 12
  }), label ?? meta.label);
}
Object.assign(__ds_scope, { provenanceMeta, ProvenanceChip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/epistemic/ProvenanceChip.jsx", error: String((e && e.message) || e) }); }

// components/epistemic/AIInterpretationCard.jsx
try { (() => {
/**
 * Layer 3. An AI-authored name and description sitting ON TOP of a group whose
 * membership was already fixed deterministically — the neutral identity line is
 * always visible underneath, never replaced.
 */
function AIInterpretationCard({
  state = 'available',
  name,
  description,
  groundTruth,
  onGenerate,
  onRegenerate,
  generatedAt,
  style
}) {
  const frame = {
    position: 'relative',
    padding: '12px 14px 13px',
    background: 'var(--ai-surface)',
    border: '1px solid var(--ai-border)',
    borderRadius: 'var(--radius-2xl)',
    ...style
  };
  return /*#__PURE__*/React.createElement("div", {
    style: frame
  }, /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      position: 'absolute',
      top: 12,
      bottom: 12,
      left: 0,
      width: 3,
      background: 'var(--ai-accent)',
      borderRadius: '0 3px 3px 0'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.ProvenanceChip, {
    kind: "ai",
    size: "sm"
  }), generatedAt && /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-muted)',
      fontSize: 'var(--text-caption)'
    }
  }, generatedAt)), state === 'generated' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("strong", {
    style: {
      display: 'block',
      margin: '9px 0 0',
      color: 'var(--text-primary)',
      fontSize: 'var(--text-node-title-group)',
      fontWeight: 'var(--weight-bold)'
    }
  }, name), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '6px 0 0',
      color: 'var(--text-secondary)',
      fontSize: 'var(--text-body)',
      lineHeight: 'var(--leading-normal)'
    }
  }, description), onRegenerate && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onRegenerate,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      marginTop: 10,
      padding: 0,
      color: 'var(--ai-text)',
      background: 'transparent',
      border: 0,
      cursor: 'pointer',
      fontSize: 'var(--text-small)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "refresh-cw",
    size: 12
  }), "Regenerate")), state === 'available' && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onGenerate,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 7,
      marginTop: 10,
      minHeight: 30,
      padding: '0 11px',
      color: 'var(--ai-text)',
      background: 'transparent',
      border: '1px solid var(--ai-border)',
      borderRadius: 'var(--radius-md)',
      cursor: 'pointer',
      fontSize: 'var(--text-small)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "sparkles",
    size: 13
  }), "Generate AI interpretation"), state === 'generating' && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 7,
      marginTop: 10,
      color: 'var(--ai-text)',
      fontSize: 'var(--text-small)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      animation: 'observatory-spin 900ms linear infinite'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "loader-circle",
    size: 13
  })), "Interpreting this cluster\u2026"), state === 'unavailable' && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '9px 0 0',
      color: 'var(--text-muted)',
      fontSize: 'var(--text-small)',
      lineHeight: 'var(--leading-normal)'
    }
  }, "No model is configured, so no interpretation can be generated. Everything else on this screen works without one."), groundTruth && /*#__PURE__*/React.createElement("p", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      margin: '11px 0 0',
      paddingTop: 10,
      borderTop: '1px dashed var(--ai-border)',
      color: 'var(--text-muted)',
      fontSize: 'var(--text-small)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "waypoints",
    size: 13
  }), groundTruth));
}
Object.assign(__ds_scope, { AIInterpretationCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/epistemic/AIInterpretationCard.jsx", error: String((e && e.message) || e) }); }

// components/epistemic/ArchitectureTree.jsx
try { (() => {
const kindIcon = {
  region: 'folder-tree',
  cluster: 'waypoints',
  residual: 'list',
  module: 'file-code-2',
  symbol: 'code'
};

/**
 * The accessible equivalent of the canvas: a real keyboard tree with an
 * explicit Origin column, so the epistemic layers survive without pixels.
 */
function ArchitectureTree({
  items = [],
  expanded = {},
  onToggle,
  onActivate,
  style
}) {
  const rows = [];
  const walk = (nodes, level) => {
    nodes.forEach(node => {
      const open = expanded[node.id] !== false;
      rows.push({
        node,
        level,
        open
      });
      if (node.children && open) walk(node.children, level + 1);
    });
  };
  walk(items, 1);
  return /*#__PURE__*/React.createElement("div", {
    role: "tree",
    "aria-label": "Repository architecture",
    style: {
      border: '1px solid var(--border-default2)',
      borderRadius: 'var(--radius-lg)',
      background: 'var(--bg-surface)',
      overflow: 'hidden',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1fr) 96px 150px',
      gap: 12,
      padding: '9px 14px',
      background: 'var(--bg-sunken)',
      borderBottom: '1px solid var(--border-default2)',
      color: 'var(--text-muted)',
      fontSize: 'var(--text-micro)',
      fontWeight: 'var(--weight-label)',
      letterSpacing: 'var(--tracking-label)',
      textTransform: 'uppercase'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Name"), /*#__PURE__*/React.createElement("span", null, "Modules"), /*#__PURE__*/React.createElement("span", null, "Origin")), rows.map(({
    node,
    level,
    open
  }) => /*#__PURE__*/React.createElement("div", {
    key: node.id,
    role: "treeitem",
    "aria-level": level,
    "aria-expanded": node.children ? open : undefined,
    tabIndex: 0,
    onClick: () => node.children ? onToggle?.(node.id) : onActivate?.(node),
    onKeyDown: event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        node.children ? onToggle?.(node.id) : onActivate?.(node);
      }
    },
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1fr) 96px 150px',
      gap: 12,
      alignItems: 'center',
      padding: '9px 14px',
      borderTop: '1px solid var(--border-subtle)',
      cursor: 'pointer',
      color: 'var(--text-primary)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      minWidth: 0,
      paddingLeft: (level - 1) * 20
    }
  }, node.children ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      color: 'var(--text-muted)',
      transform: open ? 'none' : 'rotate(-90deg)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevron-down",
    size: 13
  })) : /*#__PURE__*/React.createElement("span", {
    style: {
      width: 13
    }
  }), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: kindIcon[node.kind] ?? 'file-code-2',
    size: 14
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      overflow: 'hidden',
      fontFamily: node.kind === 'region' || node.kind === 'module' ? 'var(--font-mono)' : 'inherit',
      fontSize: 'var(--text-body)',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, node.aiName ? /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--ai-text)'
    }
  }, "AI interpretation: ", node.aiName, " \u2014 ") : null, node.label)), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-muted)',
      fontSize: 'var(--text-small)'
    }
  }, node.moduleCount ?? '—'), /*#__PURE__*/React.createElement(__ds_scope.ProvenanceChip, {
    kind: node.aiName ? 'ai' : node.kind === 'cluster' ? 'cluster' : 'structure',
    size: "sm",
    label: node.kind === 'residual' ? 'Ungrouped' : undefined
  }))));
}
Object.assign(__ds_scope, { ArchitectureTree });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/epistemic/ArchitectureTree.jsx", error: String((e && e.message) || e) }); }

// components/epistemic/ClusterCard.jsx
try { (() => {
/**
 * Layer 2. A relation-derived cluster inside a Layer-1 region — or, with
 * `residual`, the honest "no relation found" bucket, which is deliberately
 * borderless so it can never read as a cluster.
 */
function ClusterCard({
  label,
  memberCount,
  members = [],
  relationCount,
  residual = false,
  selected = false,
  aiSlot,
  onOpenBasis,
  onEnter,
  style
}) {
  const shown = members.slice(0, 5);
  const extra = Math.max(0, memberCount - shown.length);
  return /*#__PURE__*/React.createElement("article", {
    onClick: onEnter,
    style: {
      display: 'grid',
      gap: 10,
      padding: residual ? '11px 13px' : '12px 14px',
      background: residual ? 'transparent' : 'var(--structural-cluster-bg)',
      border: residual ? '1px dashed var(--structural-residual-border)' : `1px solid ${selected ? 'var(--focus-ring)' : 'var(--structural-cluster-border)'}`,
      borderRadius: residual ? 'var(--radius-lg)' : 'var(--radius-sm)',
      boxShadow: selected ? 'var(--shadow-selected)' : 'none',
      cursor: onEnter ? 'pointer' : 'default',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      flexWrap: 'wrap'
    }
  }, !residual && /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--structural-cluster-accent)',
      display: 'inline-flex'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "waypoints",
    size: 15
  })), /*#__PURE__*/React.createElement("strong", {
    style: {
      fontSize: 'var(--text-node-title)',
      fontWeight: 'var(--weight-semibold)',
      color: 'var(--text-primary)'
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-muted)',
      fontSize: 'var(--text-small)',
      whiteSpace: 'nowrap'
    }
  }, memberCount, " modules", !residual && relationCount != null ? ` · ${relationCount} internal relations` : ''), !residual && /*#__PURE__*/React.createElement(__ds_scope.ProvenanceChip, {
    kind: "cluster",
    size: "sm",
    style: {
      marginLeft: 'auto'
    }
  })), aiSlot, /*#__PURE__*/React.createElement("ul", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '4px 10px',
      margin: 0,
      padding: 0,
      listStyle: 'none',
      color: 'var(--text-secondary)',
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-micro)'
    }
  }, shown.map(m => /*#__PURE__*/React.createElement("li", {
    key: m
  }, m)), extra > 0 && /*#__PURE__*/React.createElement("li", {
    style: {
      color: 'var(--text-muted)'
    }
  }, "+", extra, " more")), residual ? /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      color: 'var(--text-muted)',
      fontSize: 'var(--text-small)',
      lineHeight: 'var(--leading-normal)'
    }
  }, "No import or call relation connects these to their siblings, so nothing groups them further. They are listed, not clustered.") : onOpenBasis && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: e => {
      e.stopPropagation();
      onOpenBasis();
    },
    style: {
      justifySelf: 'start',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: 0,
      color: 'var(--action-primary)',
      background: 'transparent',
      border: 0,
      cursor: 'pointer',
      fontSize: 'var(--text-small)'
    }
  }, "Why these modules are grouped", /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevron-right",
    size: 13
  })));
}
Object.assign(__ds_scope, { ClusterCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/epistemic/ClusterCard.jsx", error: String((e && e.message) || e) }); }

// components/epistemic/StatementCard.jsx
try { (() => {
const verdicts = {
  supported: {
    word: 'SUPPORTED',
    status: 'verified',
    caption: 'Checked against source evidence.',
    color: 'var(--verification-supported)',
    bg: 'var(--verification-supported-bg)',
    border: 'color-mix(in srgb, var(--verification-supported) 34%, var(--border-default2))',
    dashed: false
  },
  insufficient_evidence: {
    word: 'INSUFFICIENT EVIDENCE',
    status: 'insufficient',
    caption: 'No source evidence was found either way.',
    color: 'var(--verification-insufficient)',
    bg: 'var(--verification-insufficient-bg)',
    border: 'color-mix(in srgb, var(--verification-insufficient) 34%, var(--border-default2))',
    dashed: true
  },
  contradicted: {
    word: 'CONTRADICTED',
    status: 'unsupported',
    caption: 'Source evidence points the other way.',
    color: 'var(--verification-contradicted)',
    bg: 'var(--verification-contradicted-bg)',
    border: 'color-mix(in srgb, var(--verification-contradicted) 38%, var(--border-default2))',
    dashed: true
  }
};

/** Layer 4. One architectural statement and the verifier's verdict on it. */
function StatementCard({
  statement,
  status = 'supported',
  relation,
  evidenceCount = 0,
  selected = false,
  onOpenEvidence,
  style
}) {
  const v = verdicts[status];
  return /*#__PURE__*/React.createElement("article", {
    style: {
      display: 'grid',
      gap: 10,
      padding: '13px 15px',
      background: v.bg,
      border: `1px ${v.dashed ? 'dashed' : 'solid'} ${selected ? 'var(--focus-ring)' : v.border}`,
      borderLeft: `3px solid ${v.color}`,
      borderRadius: 'var(--radius-lg)',
      boxShadow: selected ? 'var(--shadow-selected)' : 'none',
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      color: v.color,
      fontSize: 'var(--text-micro)',
      fontWeight: 'var(--weight-label)',
      letterSpacing: '0.05em'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.StatusBadge, {
    status: v.status,
    title: v.caption
  }), v.word), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      color: 'var(--text-primary)',
      fontSize: 'var(--text-node-title)',
      lineHeight: 'var(--leading-normal)'
    }
  }, statement), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 12,
      color: 'var(--text-muted)',
      fontSize: 'var(--text-small)'
    }
  }, relation && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-micro)'
    }
  }, relation), /*#__PURE__*/React.createElement("span", null, evidenceCount === 0 ? 'no evidence found' : `${evidenceCount} evidence ${evidenceCount === 1 ? 'item' : 'items'}`), onOpenEvidence && evidenceCount > 0 && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onOpenEvidence,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      marginLeft: 'auto',
      padding: 0,
      color: 'var(--action-primary)',
      background: 'transparent',
      border: 0,
      cursor: 'pointer',
      fontSize: 'var(--text-small)'
    }
  }, "View evidence", /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "arrow-right",
    size: 13
  }))));
}
Object.assign(__ds_scope, { StatementCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/epistemic/StatementCard.jsx", error: String((e && e.message) || e) }); }

// components/epistemic/StructuralRegion.jsx
try { (() => {
/** Layer 1. A real directory, drawn as an enclosing region that contains its children. */
function StructuralRegion({
  path,
  moduleCount,
  depth = 0,
  expanded = true,
  selected = false,
  onToggle,
  onEnter,
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("section", {
    style: {
      background: 'var(--structural-container-bg)',
      border: `1.5px solid ${selected ? 'var(--focus-ring)' : 'var(--structural-container-border)'}`,
      borderRadius: 'var(--radius-2xl)',
      boxShadow: selected ? 'var(--shadow-selected)' : 'none',
      overflow: 'hidden',
      ...style
    }
  }, /*#__PURE__*/React.createElement("header", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-5)',
      padding: depth === 0 ? '12px 14px' : '10px 12px',
      background: 'var(--structural-container-header)',
      borderBottom: expanded ? '1px solid var(--structural-container-border)' : 'none'
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-expanded": expanded,
    onClick: onToggle,
    style: {
      display: 'flex',
      flex: '1 1 auto',
      alignItems: 'center',
      gap: 9,
      minWidth: 0,
      padding: 0,
      color: 'var(--text-primary)',
      background: 'transparent',
      border: 0,
      cursor: 'pointer',
      textAlign: 'left'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      color: 'var(--text-muted)',
      transform: expanded ? 'none' : 'rotate(-90deg)',
      transition: 'transform var(--transition-micro)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevron-down",
    size: 15
  })), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "folder-tree",
    size: 15
  }), /*#__PURE__*/React.createElement("strong", {
    style: {
      overflow: 'hidden',
      fontFamily: 'var(--font-mono)',
      fontSize: depth === 0 ? 'var(--text-node-title-group)' : 'var(--text-node-title)',
      fontWeight: 'var(--weight-semibold)',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, path)), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 'none',
      color: 'var(--text-muted)',
      fontSize: 'var(--text-small)',
      whiteSpace: 'nowrap'
    }
  }, moduleCount, " modules"), /*#__PURE__*/React.createElement(__ds_scope.ProvenanceChip, {
    kind: "structure",
    size: "sm",
    style: {
      flex: 'none'
    }
  }), onEnter && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onEnter,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      padding: '3px 8px',
      color: 'var(--action-primary)',
      background: 'transparent',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-md)',
      cursor: 'pointer',
      fontSize: 'var(--text-micro)',
      whiteSpace: 'nowrap',
      flex: 'none'
    }
  }, "Enter", /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "arrow-right",
    size: 12
  }))), expanded && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 'var(--space-5)',
      padding: depth === 0 ? 14 : 12
    }
  }, children));
}
Object.assign(__ds_scope, { StructuralRegion });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/epistemic/StructuralRegion.jsx", error: String((e && e.message) || e) }); }

// components/epistemic/ThemeToggle.jsx
try { (() => {
const options = [{
  value: 'light',
  icon: 'sun',
  label: 'Light'
}, {
  value: 'dark',
  icon: 'moon',
  label: 'Dark'
}, {
  value: 'system',
  icon: 'monitor',
  label: 'System'
}];

/** Three-way theme control. Compact in the header, full-width in Settings. */
function ThemeToggle({
  value = 'system',
  onChange,
  variant = 'compact',
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    role: "radiogroup",
    "aria-label": "Color theme",
    style: {
      display: 'inline-flex',
      gap: 'var(--space-1)',
      padding: 'var(--space-1)',
      background: 'var(--bg-sunken)',
      border: '1px solid var(--border-default2)',
      borderRadius: variant === 'compact' ? 'var(--radius-pill)' : 'var(--radius-lg)',
      ...style
    }
  }, options.map(option => {
    const active = option.value === value;
    return /*#__PURE__*/React.createElement("button", {
      key: option.value,
      type: "button",
      role: "radio",
      "aria-checked": active,
      "aria-label": option.label,
      title: option.label,
      onClick: () => onChange?.(option.value),
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 26,
        padding: variant === 'compact' ? '0 8px' : '0 12px',
        color: active ? 'var(--action-primary)' : 'var(--text-muted)',
        background: active ? 'var(--bg-surface)' : 'transparent',
        border: 0,
        borderRadius: variant === 'compact' ? 'var(--radius-pill)' : 'var(--radius-md)',
        boxShadow: active ? 'var(--shadow-tab-active)' : 'none',
        cursor: 'pointer',
        fontSize: 'var(--text-small)'
      }
    }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: option.icon,
      size: 14
    }), variant === 'full' && option.label);
  }));
}
Object.assign(__ds_scope, { ThemeToggle });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/epistemic/ThemeToggle.jsx", error: String((e && e.message) || e) }); }

// components/evidence/ClaimCard.jsx
try { (() => {
const badgeCopy = {
  supported: {
    label: 'SUPPORTED',
    caption: 'Backed by source evidence in this run.',
    status: 'verified'
  },
  insufficient_evidence: {
    label: 'INSUFFICIENT EVIDENCE',
    caption: 'No direct evidence found — treat as unproven.',
    status: 'insufficient'
  },
  contradicted: {
    label: 'CONTRADICTED',
    caption: 'Verification found evidence against this.',
    status: 'unsupported'
  }
};
const INSUFFICIENT_EVIDENCE_COPY = "Laura's deterministic analysis could not find direct evidence for this relationship in the current run.";

/** One architectural claim with its verification status and evidence chain. */
function ClaimCard({
  statement,
  supportStatus = 'supported',
  relation = '',
  children,
  defaultExpanded = false,
  style
}) {
  const [expanded, setExpanded] = React.useState(defaultExpanded);
  const copy = badgeCopy[supportStatus] ?? badgeCopy.supported;
  const muted = supportStatus !== 'supported';
  return /*#__PURE__*/React.createElement("li", {
    style: {
      overflow: 'hidden',
      listStyle: 'none',
      background: supportStatus === 'contradicted' ? 'color-mix(in srgb, var(--obs-muted-red) 6%, var(--obs-paper))' : muted ? 'color-mix(in srgb, var(--obs-clay) 5%, var(--obs-paper))' : 'var(--obs-paper)',
      border: '1px solid',
      borderStyle: muted ? 'dashed' : 'solid',
      borderColor: supportStatus === 'contradicted' ? 'color-mix(in srgb, var(--obs-muted-red) 34%, var(--obs-border))' : muted ? 'color-mix(in srgb, var(--obs-clay) 32%, var(--obs-border))' : 'color-mix(in srgb, var(--obs-citrine) 30%, var(--obs-border))',
      borderRadius: 'var(--radius-lg)',
      opacity: muted ? 0.92 : 1,
      ...style
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-expanded": expanded,
    onClick: () => setExpanded(current => !current),
    style: {
      display: 'grid',
      gridTemplateColumns: 'auto 1fr',
      alignItems: 'center',
      gap: '6px 10px',
      width: '100%',
      padding: '12px 14px',
      textAlign: 'left',
      background: 'transparent',
      border: 0,
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      gridRow: 'span 2',
      gap: 'var(--space-1)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Chip, {
    tone: "clay",
    style: muted ? {
      color: 'color-mix(in srgb, var(--obs-clay) 78%, var(--obs-ink))',
      background: 'color-mix(in srgb, var(--obs-clay) 12%, transparent)',
      fontWeight: 600,
      letterSpacing: '0.02em'
    } : {
      fontWeight: 600,
      letterSpacing: '0.02em'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.StatusBadge, {
    status: copy.status,
    title: copy.caption
  }), copy.label), /*#__PURE__*/React.createElement("span", {
    style: {
      maxWidth: 130,
      color: 'var(--obs-stone)',
      fontSize: 'var(--text-caption)',
      lineHeight: 1.3,
      whiteSpace: 'normal'
    }
  }, copy.caption)), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--obs-ink)',
      fontSize: 'var(--text-body)',
      lineHeight: 'var(--leading-normal)'
    }
  }, statement), relation && /*#__PURE__*/React.createElement("span", {
    style: {
      gridColumn: 2,
      color: 'var(--obs-stone)',
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-micro)',
      textTransform: 'uppercase',
      letterSpacing: '0.03em'
    }
  }, relation)), expanded && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 14px 14px',
      borderTop: '1px solid var(--obs-border)'
    }
  }, supportStatus === 'insufficient_evidence' && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '12px 0 0',
      padding: '10px 12px',
      color: 'color-mix(in srgb, var(--obs-ink) 76%, var(--obs-clay))',
      background: 'color-mix(in srgb, var(--obs-clay) 7%, var(--obs-paper))',
      border: '1px solid color-mix(in srgb, var(--obs-clay) 18%, var(--obs-border))',
      borderRadius: 'var(--radius-lg)',
      fontSize: 'var(--text-body-tight)',
      lineHeight: 'var(--leading-normal)'
    }
  }, INSUFFICIENT_EVIDENCE_COPY), children));
}
Object.assign(__ds_scope, { ClaimCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/evidence/ClaimCard.jsx", error: String((e && e.message) || e) }); }

// components/evidence/EvidenceRow.jsx
try { (() => {
/** One source-backed evidence row: file span, why it counts, and a code preview. */
function EvidenceRow({
  filePath,
  startLine,
  endLine,
  reason,
  preview,
  status = 'verified',
  active = false,
  onClick,
  style
}) {
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onClick,
    style: {
      display: 'grid',
      gridTemplateColumns: '14px minmax(0, 1fr)',
      gap: 'var(--space-4)',
      width: '100%',
      padding: '11px 12px',
      textAlign: 'left',
      background: active ? 'rgba(61, 90, 128, 0.055)' : 'rgba(252, 250, 247, 0.62)',
      border: `1px solid ${active ? 'color-mix(in srgb, var(--obs-slate-blue) 40%, var(--obs-border))' : 'var(--obs-border)'}`,
      borderRadius: 'var(--radius-lg)',
      cursor: onClick ? 'pointer' : 'default',
      ...style
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.StatusBadge, {
    status: status
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("strong", {
    style: {
      display: 'block',
      overflow: 'hidden',
      color: 'var(--obs-ink)',
      fontSize: 'var(--text-small)',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, filePath, startLine != null ? `:${startLine}${endLine != null ? `-${endLine}` : ''}` : ''), reason && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      marginTop: 'var(--space-1)',
      color: 'var(--text-body)',
      fontSize: 'var(--text-small)',
      lineHeight: 'var(--leading-normal)'
    }
  }, reason), preview && /*#__PURE__*/React.createElement("p", {
    style: {
      display: '-webkit-box',
      margin: '7px 0 0',
      overflow: 'hidden',
      color: 'var(--obs-stone)',
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-micro)',
      lineHeight: 'var(--leading-normal)',
      WebkitBoxOrient: 'vertical',
      WebkitLineClamp: 3
    }
  }, preview)));
}
Object.assign(__ds_scope, { EvidenceRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/evidence/EvidenceRow.jsx", error: String((e && e.message) || e) }); }

// components/evidence/FileList.jsx
try { (() => {
/** Key-files list: path plus the reason it matters. */
function FileList({
  items = [],
  activeIndex = 0,
  onSelect,
  emptyLabel = 'No key files returned yet.',
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      overflow: 'hidden',
      background: 'rgba(252, 250, 247, 0.72)',
      border: '1px solid var(--obs-border)',
      borderRadius: 'var(--radius-lg)',
      ...style
    }
  }, items.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 14px',
      color: 'var(--obs-stone)',
      fontSize: 'var(--text-small)',
      lineHeight: 'var(--leading-normal)'
    }
  }, emptyLabel) : items.map((item, index) => {
    const active = index === activeIndex;
    return /*#__PURE__*/React.createElement("button", {
      key: item.filePath,
      type: "button",
      onClick: () => onSelect?.(item, index),
      style: {
        display: 'grid',
        gridTemplateColumns: '18px minmax(0, 1fr)',
        gap: 'var(--space-3)',
        width: '100%',
        padding: '12px 14px',
        textAlign: 'left',
        color: active ? 'var(--obs-slate-blue)' : 'color-mix(in srgb, var(--obs-ink) 78%, var(--obs-stone))',
        background: active ? 'rgba(61, 90, 128, 0.055)' : 'transparent',
        border: 0,
        borderTop: index === 0 ? 'none' : '1px solid var(--obs-border)',
        cursor: 'pointer',
        fontSize: 'var(--text-small)'
      }
    }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: "file-text",
      size: 14
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }
    }, item.filePath), /*#__PURE__*/React.createElement("small", {
      style: {
        gridColumn: 2,
        overflow: 'hidden',
        color: 'var(--obs-stone)',
        fontSize: 'var(--text-micro)',
        lineHeight: 'var(--leading-snug)',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }
    }, item.reason));
  }));
}
Object.assign(__ds_scope, { FileList });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/evidence/FileList.jsx", error: String((e && e.message) || e) }); }

// components/feedback/ProgressMeter.jsx
try { (() => {
/** Files-read meter with the current file underneath. */
function ProgressMeter({
  label = 'Reading files',
  value = 0,
  total = 0,
  caption,
  style
}) {
  const percent = total ? Math.min(100, Math.round(value / total * 100)) : 0;
  return /*#__PURE__*/React.createElement("div", {
    style: style
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: 'var(--space-5)',
      color: 'var(--obs-stone)',
      fontSize: 'var(--text-small)'
    }
  }, /*#__PURE__*/React.createElement("span", null, label), /*#__PURE__*/React.createElement("span", null, value, " / ", total)), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 7,
      margin: '8px 0',
      overflow: 'hidden',
      borderRadius: 'var(--radius-pill)',
      background: 'color-mix(in srgb, var(--obs-border) 70%, transparent)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      height: '100%',
      width: `${percent}%`,
      borderRadius: 'inherit',
      background: 'var(--obs-citrine)',
      transition: 'width var(--transition-layout)'
    }
  })), caption && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      overflow: 'hidden',
      color: 'var(--obs-stone)',
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-micro)',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, caption));
}
Object.assign(__ds_scope, { ProgressMeter });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/ProgressMeter.jsx", error: String((e && e.message) || e) }); }

// components/feedback/PromiseCard.jsx
try { (() => {
/** Entry-screen product promise: icon, claim, one supporting line. */
function PromiseCard({
  icon = 'shield-check',
  title,
  text,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: 118,
      padding: 'var(--space-7)',
      border: '1px solid var(--obs-border)',
      borderRadius: 'var(--radius-lg)',
      background: 'color-mix(in srgb, var(--obs-paper) 82%, transparent)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--obs-citrine)',
      display: 'inline-flex'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 17
  })), /*#__PURE__*/React.createElement("strong", {
    style: {
      display: 'block',
      margin: '12px 0 5px',
      fontSize: 'var(--text-body)',
      color: 'var(--obs-ink)'
    }
  }, title), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      color: 'var(--obs-stone)',
      fontSize: 'var(--text-small)',
      lineHeight: 'var(--leading-normal)'
    }
  }, text));
}
Object.assign(__ds_scope, { PromiseCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/PromiseCard.jsx", error: String((e && e.message) || e) }); }

// components/feedback/StageRow.jsx
try { (() => {
const tones = {
  done: {
    color: 'var(--obs-stone)',
    border: 'var(--obs-border)',
    background: 'var(--surface-sunken)',
    icon: 'circle-check-big',
    iconColor: 'var(--stage-done)'
  },
  current: {
    color: 'var(--obs-ink)',
    border: 'color-mix(in srgb, var(--obs-slate-blue) 25%, var(--obs-border))',
    background: 'color-mix(in srgb, var(--obs-slate-blue) 7%, transparent)',
    icon: 'loader-circle',
    iconColor: 'var(--stage-current)'
  },
  waiting: {
    color: 'var(--obs-stone)',
    border: 'var(--obs-border)',
    background: 'var(--surface-sunken)',
    icon: null,
    iconColor: 'var(--obs-stone)'
  },
  failed: {
    color: 'var(--obs-ink)',
    border: 'color-mix(in srgb, #b91c1c 28%, var(--obs-border))',
    background: 'color-mix(in srgb, #b91c1c 7%, transparent)',
    icon: 'circle-x',
    iconColor: 'var(--stage-failed)'
  },
  skipped: {
    color: 'var(--obs-stone)',
    border: 'color-mix(in srgb, #b45309 28%, var(--obs-border))',
    background: 'color-mix(in srgb, #b45309 7%, transparent)',
    icon: 'circle-alert',
    iconColor: 'var(--stage-skipped)'
  }
};

/** One analysis stage, in human language. */
function StageRow({
  state = 'waiting',
  label,
  title,
  style
}) {
  const tone = tones[state] ?? tones.waiting;
  return /*#__PURE__*/React.createElement("div", {
    title: title,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      minWidth: 0,
      padding: 'var(--space-4)',
      border: `1px solid ${tone.border}`,
      borderRadius: 'var(--radius-lg)',
      color: tone.color,
      background: tone.background,
      ...style
    }
  }, tone.icon ? /*#__PURE__*/React.createElement("span", {
    style: {
      color: tone.iconColor,
      display: 'inline-flex',
      flex: 'none',
      animation: state === 'current' ? 'observatory-spin 900ms linear infinite' : 'none'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: tone.icon,
    size: 15
  })) : /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 'none',
      width: 15,
      height: 15,
      border: '1px solid var(--obs-border)',
      borderRadius: '50%'
    }
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      minWidth: 0,
      margin: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      fontSize: 'var(--text-body)'
    }
  }, label));
}
Object.assign(__ds_scope, { StageRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/StageRow.jsx", error: String((e && e.message) || e) }); }

// components/feedback/StateCard.jsx
try { (() => {
/** Centered empty / error / loading state for a whole canvas. */
function StateCard({
  icon = 'search-code',
  title,
  message,
  tone = 'neutral',
  action,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      width: 'min(440px, 100%)',
      padding: 'var(--space-10)',
      color: 'var(--obs-ink)',
      background: 'rgba(252, 250, 247, 0.88)',
      border: '1px solid var(--obs-border)',
      borderRadius: 'var(--radius-2xl)',
      boxShadow: 'var(--shadow-card)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: tone === 'error' ? 'var(--obs-clay)' : 'var(--obs-slate-blue)',
      display: 'inline-flex'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 28
  })), /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: '18px 0 8px',
      fontSize: 'var(--text-rail-title)'
    }
  }, title), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      color: 'var(--text-body)',
      fontSize: 'var(--text-body)',
      lineHeight: 'var(--leading-relaxed)'
    }
  }, message), action);
}
Object.assign(__ds_scope, { StateCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/StateCard.jsx", error: String((e && e.message) || e) }); }

// components/forms/CheckField.jsx
try { (() => {
/** Checkbox with inline sentence label. */
function CheckField({
  checked = false,
  disabled = false,
  onChange,
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-3)',
      color: 'var(--obs-stone)',
      fontSize: 'var(--text-body)',
      opacity: disabled ? 0.6 : 1,
      ...style
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: checked,
    disabled: disabled,
    onChange: event => onChange?.(event.target.checked),
    style: {
      accentColor: 'var(--obs-slate-blue)'
    }
  }), children);
}
Object.assign(__ds_scope, { CheckField });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/CheckField.jsx", error: String((e && e.message) || e) }); }

// components/forms/PathInput.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Repository-path field: leading folder glyph, free text entry, and a Browse escape hatch. */
function PathInput({
  value = '',
  placeholder = 'Enter an absolute local repository path',
  onChange,
  onBrowse,
  browseLabel = 'Browse\u2026',
  style,
  ...rest
}) {
  const [focused, setFocused] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-4)',
      minHeight: 'var(--control-height-lg)',
      padding: '0 14px',
      border: `1px solid ${focused ? 'var(--border-focus)' : 'var(--obs-border)'}`,
      borderRadius: 'var(--radius-lg)',
      background: 'var(--surface-input)',
      boxShadow: focused ? '0 0 0 3px color-mix(in srgb, var(--obs-slate-blue) 12%, transparent)' : 'none',
      transition: 'border-color var(--transition-micro), box-shadow var(--transition-micro)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--obs-stone)',
      display: 'inline-flex'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "folder-open",
    size: 16
  })), /*#__PURE__*/React.createElement("input", _extends({
    value: value,
    placeholder: placeholder,
    onChange: event => onChange?.(event.target.value),
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
    style: {
      width: '100%',
      minWidth: 0,
      border: 0,
      outline: 0,
      background: 'transparent',
      color: 'var(--obs-ink)',
      fontSize: 'var(--text-node-title)'
    }
  }, rest)), onBrowse && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onBrowse,
    style: {
      flex: 'none',
      height: 32,
      padding: '0 12px',
      color: 'var(--obs-ink)',
      background: 'var(--obs-paper)',
      border: '1px solid var(--obs-border)',
      borderRadius: 'var(--radius-md)',
      fontSize: '12.5px',
      cursor: 'pointer'
    }
  }, browseLabel));
}
Object.assign(__ds_scope, { PathInput });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/PathInput.jsx", error: String((e && e.message) || e) }); }

// components/forms/SegmentedControl.jsx
try { (() => {
/** Row of pill segments — the product's only mutually-exclusive selector. */
function SegmentedControl({
  options = [],
  value,
  onChange,
  label,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: style
  }, label && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      marginBottom: 'var(--space-3)',
      color: 'var(--obs-stone)',
      fontSize: 'var(--text-micro)',
      fontWeight: 'var(--weight-label)',
      letterSpacing: 'var(--tracking-label)',
      textTransform: 'uppercase'
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 7
    }
  }, options.map(option => {
    const active = option.value === value;
    return /*#__PURE__*/React.createElement("button", {
      key: option.value,
      type: "button",
      title: option.description,
      onClick: () => onChange?.(option.value),
      style: {
        padding: '7px 10px',
        borderRadius: 'var(--radius-pill)',
        cursor: 'pointer',
        fontSize: 'var(--text-small)',
        color: active ? 'var(--obs-slate-blue)' : 'var(--obs-stone)',
        border: `1px solid ${active ? 'color-mix(in srgb, var(--obs-slate-blue) 38%, var(--obs-border))' : 'var(--obs-border)'}`,
        background: active ? 'color-mix(in srgb, var(--obs-slate-blue) 9%, transparent)' : 'transparent'
      }
    }, option.label);
  })));
}
Object.assign(__ds_scope, { SegmentedControl });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/SegmentedControl.jsx", error: String((e && e.message) || e) }); }

// components/forms/TextInput.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Compact monospace field for ids, models and other machine values. */
function TextInput({
  value = '',
  placeholder,
  onChange,
  mono = true,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("input", _extends({
    value: value,
    placeholder: placeholder,
    onChange: event => onChange?.(event.target.value),
    style: {
      width: '100%',
      minHeight: 38,
      padding: '0 10px',
      color: 'var(--obs-ink)',
      border: '1px solid var(--obs-border)',
      borderRadius: 'var(--radius-lg)',
      background: 'color-mix(in srgb, var(--obs-white) 55%, transparent)',
      fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
      fontSize: 'var(--text-small)',
      outline: 'none',
      ...style
    }
  }, rest));
}
Object.assign(__ds_scope, { TextInput });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/TextInput.jsx", error: String((e && e.message) || e) }); }

// components/map/LensNode.jsx
try { (() => {
const accents = {
  slate: {
    color: 'var(--obs-slate-blue)',
    borderColor: 'color-mix(in srgb, var(--obs-slate-blue) 32%, transparent)'
  },
  citrine: {
    color: 'color-mix(in srgb, var(--obs-citrine) 72%, var(--obs-ink))',
    borderColor: 'color-mix(in srgb, var(--obs-citrine) 40%, transparent)'
  },
  sage: {
    color: 'var(--obs-sage)',
    borderColor: 'color-mix(in srgb, var(--obs-sage) 40%, transparent)'
  },
  clay: {
    color: 'var(--obs-clay)',
    borderColor: 'color-mix(in srgb, var(--obs-clay) 36%, transparent)'
  },
  stone: {
    color: 'var(--obs-stone)',
    borderColor: 'color-mix(in srgb, var(--obs-stone) 42%, transparent)'
  }
};
const clamp = lines => ({
  display: '-webkit-box',
  overflow: 'hidden',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: lines
});

/** A card on the architecture map: one analyzed area, or one repository region. */
function LensNode({
  label,
  kind = 'component',
  description = '',
  status = 'candidate',
  accent = 'slate',
  icon = 'box',
  evidenceCount = 0,
  childrenCount = 0,
  members = [],
  warning = false,
  group = false,
  collapsedContainer = false,
  selected = false,
  canDrilldown = true,
  onClick,
  style
}) {
  const [hover, setHover] = React.useState(false);
  const kindLabel = group ? 'repository section' : kind.replaceAll('_', ' ');
  const extraMembers = Math.max(0, childrenCount - members.slice(0, 5).length);
  const active = selected || hover;
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    "aria-label": `${label}, ${kindLabel}, ${status}, ${collapsedContainer ? 'expand' : canDrilldown ? 'select to explore' : 'select'}`,
    style: {
      display: 'grid',
      gridTemplateColumns: group ? '54px minmax(0, 1fr) 18px' : '46px minmax(0, 1fr) 16px',
      gap: 'var(--space-5)',
      alignItems: 'center',
      width: group ? '100%' : 'var(--node-width)',
      minHeight: group ? 'var(--group-node-min-height)' : 'var(--node-min-height)',
      padding: group ? '18px 20px' : '14px 15px',
      textAlign: 'left',
      color: 'var(--obs-ink)',
      background: group ? 'color-mix(in srgb, var(--obs-stone) 5%, rgba(252, 250, 247, 0.9))' : 'var(--surface-card-translucent)',
      border: group ? '1.5px solid color-mix(in srgb, var(--obs-stone) 46%, var(--obs-border))' : '1px solid color-mix(in srgb, var(--obs-border) 84%, var(--obs-white))',
      borderColor: active ? 'var(--border-strong)' : undefined,
      borderRadius: 'var(--radius-xl)',
      boxShadow: selected ? 'var(--shadow-selected)' : 'var(--shadow-node)',
      transform: hover ? 'var(--hover-lift)' : 'none',
      cursor: 'pointer',
      transition: 'transform var(--transition-micro), border-color var(--transition-micro), box-shadow var(--transition-micro), background var(--transition-micro)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 'var(--node-icon-size)',
      height: 'var(--node-icon-size)',
      borderRadius: 'var(--radius-pill)',
      border: '1px solid',
      ...accents[accent]
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: group ? 30 : 25
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      minWidth: 0,
      flexDirection: 'column',
      gap: 5
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 'var(--space-3)',
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      overflow: 'hidden',
      color: 'var(--obs-stone)',
      fontSize: 'var(--text-caption)',
      fontWeight: 600,
      letterSpacing: 'var(--tracking-label)',
      textOverflow: 'ellipsis',
      textTransform: 'uppercase',
      whiteSpace: 'nowrap'
    }
  }, kindLabel), warning && /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--obs-clay)',
      display: 'inline-flex'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "circle-alert",
    size: 14
  }))), /*#__PURE__*/React.createElement("span", {
    style: {
      overflow: 'hidden',
      fontSize: group ? 'var(--text-node-title-group)' : 'var(--text-node-title)',
      fontWeight: 'var(--weight-bold)',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, label), group ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--obs-ink)',
      fontSize: 'var(--text-small)',
      fontWeight: 600
    }
  }, childrenCount, " module", childrenCount === 1 ? '' : 's'), members.length > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-body)',
      fontSize: 'var(--text-meta)',
      lineHeight: 'var(--leading-snug)',
      ...clamp(2)
    }
  }, "Contains: ", members.slice(0, 5).join(', '), extraMembers > 0 ? `, +${extraMembers} more` : ''), /*#__PURE__*/React.createElement("span", {
    style: {
      color: active ? 'var(--obs-slate-blue)' : 'var(--obs-stone)',
      fontSize: 'var(--text-nano)',
      fontStyle: 'italic'
    }
  }, collapsedContainer ? 'Select to expand' : 'Select to explore')) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-body)',
      fontSize: 'var(--text-small)',
      lineHeight: 'var(--leading-snug)',
      ...clamp(2)
    }
  }, description), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 7,
      minWidth: 0,
      color: 'var(--obs-stone)',
      fontSize: 'var(--text-nano)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.StatusBadge, {
    status: status,
    showLabel: true
  }), evidenceCount > 0 && /*#__PURE__*/React.createElement("span", null, evidenceCount, " evidence"), childrenCount > 0 && /*#__PURE__*/React.createElement("span", null, childrenCount, " areas")))), canDrilldown && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      color: active ? 'var(--obs-slate-blue)' : 'var(--obs-stone)',
      opacity: active ? 1 : 0.7
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: collapsedContainer ? 'chevron-down' : 'chevron-right',
    size: 16
  })));
}
Object.assign(__ds_scope, { LensNode });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/map/LensNode.jsx", error: String((e && e.message) || e) }); }

// components/map/MapLegend.jsx
try { (() => {
const edgeStyles = {
  flow: {
    stroke: 'color-mix(in srgb, var(--obs-slate-blue) 56%, transparent)',
    dash: ''
  },
  inferred: {
    stroke: 'color-mix(in srgb, var(--obs-clay) 48%, transparent)',
    dash: '5 6'
  },
  boundary: {
    stroke: 'color-mix(in srgb, var(--obs-stone) 62%, transparent)',
    dash: '2 5'
  }
};

/** Floating legend for status dots and edge kinds. */
function MapLegend({
  statuses = ['verified', 'partial', 'inferred'],
  edges = ['flow', 'inferred'],
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 'var(--space-8)',
      color: 'var(--obs-ink)',
      fontSize: 'var(--text-small)',
      ...style
    }
  }, statuses.map(status => /*#__PURE__*/React.createElement(__ds_scope.StatusBadge, {
    key: status,
    status: status,
    showLabel: true
  })), edges.map(edge => /*#__PURE__*/React.createElement("span", {
    key: edge,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 7
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "26",
    height: "6",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("line", {
    x1: "0",
    y1: "3",
    x2: "26",
    y2: "3",
    stroke: edgeStyles[edge].stroke,
    strokeWidth: "1.25",
    strokeDasharray: edgeStyles[edge].dash
  })), edge === 'flow' ? 'Direct relation' : edge === 'inferred' ? 'Inferred' : 'Boundary')));
}
Object.assign(__ds_scope, { MapLegend });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/map/MapLegend.jsx", error: String((e && e.message) || e) }); }

// components/navigation/BreadcrumbTrail.jsx
try { (() => {
/** Overview → region → entity → evidence trail in the top bar. */
function BreadcrumbTrail({
  items = [],
  onSelect,
  style
}) {
  return /*#__PURE__*/React.createElement("nav", {
    "aria-label": "Architecture breadcrumb",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-1)',
      minWidth: 0,
      fontSize: 'var(--text-body)',
      color: 'var(--obs-ink)',
      ...style
    }
  }, items.map((item, index) => {
    const isCurrent = index === items.length - 1;
    return /*#__PURE__*/React.createElement("span", {
      key: `${item.id ?? 'root'}-${item.label}-${index}`,
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-1)',
        minWidth: 0,
        whiteSpace: 'nowrap',
        color: isCurrent ? 'var(--obs-ink)' : 'color-mix(in srgb, var(--obs-ink) 70%, var(--obs-stone))'
      }
    }, isCurrent || !onSelect ? /*#__PURE__*/React.createElement("span", {
      title: item.title,
      "aria-current": isCurrent ? 'location' : undefined
    }, item.label) : /*#__PURE__*/React.createElement("button", {
      type: "button",
      title: item.title,
      onClick: () => onSelect(index),
      style: {
        padding: 0,
        color: 'inherit',
        background: 'transparent',
        border: 0,
        cursor: 'pointer'
      }
    }, item.label), !isCurrent && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: "chevron-right",
      size: 13
    }));
  }));
}
Object.assign(__ds_scope, { BreadcrumbTrail });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/BreadcrumbTrail.jsx", error: String((e && e.message) || e) }); }

// components/navigation/RunPicker.jsx
try { (() => {
function abbreviateRunId(runId = '') {
  const hex = runId.startsWith('run:') ? runId.slice(4) : runId;
  return hex.length > 8 ? `${hex.slice(0, 8)}\u2026` : hex;
}

/** Provenance control: which run you are looking at, how fresh it is, and its id. */
function RunPicker({
  runId = '',
  lastScanned = 'active run',
  freshness = 'Live',
  onCopy,
  style
}) {
  const [copied, setCopied] = React.useState(false);
  const button = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    height: 'var(--control-height)',
    padding: '0 10px',
    color: 'var(--obs-ink)',
    background: 'rgba(252, 250, 247, 0.72)',
    border: '1px solid var(--obs-border)',
    borderRadius: 'var(--radius-lg)',
    cursor: 'pointer'
  };
  return /*#__PURE__*/React.createElement("div", {
    "aria-label": "Current analysis run",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-3)',
      fontSize: 'var(--text-small)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    title: `Full run id: ${runId}`,
    style: button
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: 'var(--radius-pill)',
      background: 'var(--obs-citrine)'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--obs-stone)'
    }
  }, lastScanned), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--obs-stone)',
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-nano)',
      opacity: 0.75
    }
  }, abbreviateRunId(runId)), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevron-down",
    size: 13
  })), /*#__PURE__*/React.createElement("button", {
    type: "button",
    style: {
      ...button,
      color: 'var(--obs-stone)',
      background: 'transparent',
      borderColor: 'transparent'
    }
  }, freshness, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevron-down",
    size: 13
  })), /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": "Copy full run id",
    title: runId,
    onClick: () => {
      onCopy?.(runId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    },
    style: {
      position: 'relative',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 26,
      height: 26,
      color: 'var(--obs-stone)',
      background: 'transparent',
      border: '1px solid transparent',
      borderRadius: 'var(--radius-md)',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "copy",
    size: 12
  }), copied && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: '100%',
      right: 0,
      marginTop: 4,
      padding: '2px 6px',
      color: 'var(--obs-white)',
      background: 'var(--obs-ink)',
      borderRadius: 'var(--radius-xs)',
      fontSize: 'var(--text-caption)',
      whiteSpace: 'nowrap'
    }
  }, "Copied")));
}
Object.assign(__ds_scope, { RunPicker });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/RunPicker.jsx", error: String((e && e.message) || e) }); }

// components/navigation/TabRail.jsx
try { (() => {
/** Simple / technical / evidence switch at the top of the voice rail. */
function TabRail({
  tabs = ['simple', 'technical', 'evidence'],
  value,
  onChange,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    role: "tablist",
    "aria-label": "Explanation modes",
    style: {
      display: 'grid',
      gridTemplateColumns: `repeat(${tabs.length}, 1fr)`,
      gap: 'var(--space-1)',
      padding: 'var(--space-1)',
      background: 'rgba(255, 255, 255, 0.38)',
      border: '1px solid var(--obs-border)',
      borderRadius: 'var(--radius-xl)',
      ...style
    }
  }, tabs.map(tab => {
    const active = tab === value;
    return /*#__PURE__*/React.createElement("button", {
      key: tab,
      type: "button",
      role: "tab",
      "aria-selected": active,
      onClick: () => onChange?.(tab),
      style: {
        height: 32,
        border: 0,
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        fontSize: 'var(--text-small)',
        textTransform: 'capitalize',
        color: active ? 'var(--obs-slate-blue)' : 'color-mix(in srgb, var(--obs-ink) 68%, var(--obs-stone))',
        background: active ? 'var(--obs-paper)' : 'transparent',
        boxShadow: active ? 'var(--shadow-tab-active)' : 'none'
      }
    }, tab);
  }));
}
Object.assign(__ds_scope, { TabRail });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/TabRail.jsx", error: String((e && e.message) || e) }); }

// ui_kits/lauras-graph/GraphCanvas.jsx
try { (() => {
const {
  Icon,
  ProvenanceChip,
  StatusBadge
} = window.SyntaxTreeDesignSystem_b1a4e9;

/* ── geometry ──────────────────────────────────────────────────── */

const SIDE = (r, s) => ({
  top: {
    x: r.x + r.w / 2,
    y: r.y
  },
  bottom: {
    x: r.x + r.w / 2,
    y: r.y + r.h
  },
  left: {
    x: r.x,
    y: r.y + r.h / 2
  },
  right: {
    x: r.x + r.w,
    y: r.y + r.h / 2
  }
})[s];

/** Authored route: explicit anchor sides plus one routing channel, so edges
    run in the gutters between containers instead of crossing them. */
function routeVia(a, b, anchor, channel) {
  const s = SIDE(a, anchor.from),
    t = SIDE(b, anchor.to);
  if (channel && channel.x != null) {
    const cx = channel.x;
    return {
      d: `M${s.x},${s.y} L${cx},${s.y} L${cx},${t.y} L${t.x},${t.y}`,
      mid: {
        x: cx,
        y: (s.y + t.y) / 2
      }
    };
  }
  const cy = channel && channel.y != null ? channel.y : (s.y + t.y) / 2;
  return {
    d: `M${s.x},${s.y} L${s.x},${cy} L${t.x},${cy} L${t.x},${t.y}`,
    mid: {
      x: (s.x + t.x) / 2,
      y: cy
    }
  };
}

/** Orthogonal route between two rects, in canvas design units. */
function routeEdge(a, b) {
  const ac = {
    x: a.x + a.w / 2,
    y: a.y + a.h / 2
  };
  const bc = {
    x: b.x + b.w / 2,
    y: b.y + b.h / 2
  };
  const dx = bc.x - ac.x,
    dy = bc.y - ac.y;
  if (Math.abs(dy) >= Math.abs(dx)) {
    const sy = dy > 0 ? a.y + a.h : a.y,
      ty = dy > 0 ? b.y : b.y + b.h;
    const my = sy + (ty - sy) / 2;
    return {
      d: `M${ac.x},${sy} L${ac.x},${my} L${bc.x},${my} L${bc.x},${ty}`,
      mid: {
        x: (ac.x + bc.x) / 2,
        y: my
      },
      tip: {
        x: bc.x,
        y: ty
      }
    };
  }
  const sx = dx > 0 ? a.x + a.w : a.x,
    tx = dx > 0 ? b.x : b.x + b.w;
  const mx = sx + (tx - sx) / 2;
  return {
    d: `M${sx},${ac.y} L${mx},${ac.y} L${mx},${bc.y} L${tx},${bc.y}`,
    mid: {
      x: mx,
      y: (ac.y + bc.y) / 2
    },
    tip: {
      x: tx,
      y: bc.y
    }
  };
}
function EdgeLayer({
  edges,
  rects,
  w,
  h,
  zoom,
  activeIds,
  dimmed,
  showLabels = true
}) {
  const fs = Math.max(11, 11 / zoom);
  return /*#__PURE__*/React.createElement("svg", {
    width: w,
    height: h,
    style: {
      position: 'absolute',
      inset: 0,
      zIndex: 60,
      overflow: 'visible',
      pointerEvents: 'none'
    },
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("defs", null, [['arrow', 'var(--edge-stroke)'], ['arrow-on', 'var(--edge-stroke-active)'], ['arrow-dim', 'var(--edge-stroke-dim)']].map(([id, fill]) => /*#__PURE__*/React.createElement("marker", {
    key: id,
    id: id,
    viewBox: "0 0 10 10",
    refX: "9",
    refY: "5",
    markerWidth: "7",
    markerHeight: "7",
    orient: "auto-start-reverse"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M0,1 L9,5 L0,9 z",
    fill: fill
  })))), edges.map(e => {
    const a = rects[e.from],
      b = rects[e.to];
    if (!a || !b) return null;
    const on = activeIds && (activeIds.includes(e.from) || activeIds.includes(e.to));
    const off = dimmed && !on;
    const r = e.anchor ? routeVia(a, b, e.anchor, e.channel) : routeEdge(a, b);
    const stroke = on ? 'var(--edge-stroke-active)' : off ? 'var(--edge-stroke-dim)' : 'var(--edge-stroke)';
    const label = e.count + ' ' + e.kind;
    const lw = label.length * fs * 0.54 + 14;
    return /*#__PURE__*/React.createElement("g", {
      key: e.id,
      opacity: off ? 0.4 : 1
    }, /*#__PURE__*/React.createElement("path", {
      d: r.d,
      fill: "none",
      stroke: stroke,
      strokeWidth: on ? 2.2 : 1.4,
      strokeLinejoin: "round",
      strokeDasharray: e.kind === 'calls' ? '6 4' : undefined,
      markerEnd: 'url(#' + (on ? 'arrow-on' : off ? 'arrow-dim' : 'arrow') + ')'
    }), showLabels && /*#__PURE__*/React.createElement("g", {
      transform: `translate(${r.mid.x - lw / 2}, ${r.mid.y - fs})`
    }, /*#__PURE__*/React.createElement("rect", {
      width: lw,
      height: fs * 1.85,
      rx: fs,
      fill: "var(--edge-label-bg)",
      stroke: on ? 'var(--edge-stroke-active)' : 'var(--edge-label-border)',
      strokeWidth: "1"
    }), /*#__PURE__*/React.createElement("text", {
      x: lw / 2,
      y: fs * 1.28,
      textAnchor: "middle",
      fontSize: fs,
      fontFamily: "var(--font-sans)",
      fill: on ? 'var(--edge-stroke-active)' : 'var(--text-muted)',
      fontWeight: on ? 640 : 460
    }, label)));
  }));
}

/* ── nodes ─────────────────────────────────────────────────────── */

const KIND = {
  region: {
    bg: 'var(--region-bg)',
    border: 'var(--region-border)',
    bw: 2,
    radius: 14,
    icon: 'folder-tree',
    chip: 'structure'
  },
  subregion: {
    bg: 'var(--bg-surface)',
    border: 'var(--border-default2)',
    bw: 1,
    radius: 10,
    icon: 'folder-tree',
    chip: 'structure'
  },
  cluster: {
    bg: 'var(--structural-cluster-bg)',
    border: 'var(--structural-cluster-border)',
    bw: 1.5,
    radius: 10,
    icon: 'waypoints',
    chip: 'cluster'
  },
  residual: {
    bg: 'transparent',
    border: 'var(--border-default2)',
    bw: 1,
    radius: 10,
    icon: 'circle-dot',
    chip: null
  },
  loose: {
    bg: 'var(--bg-surface)',
    border: 'var(--border-default2)',
    bw: 1,
    radius: 10,
    icon: 'file-code-2',
    chip: 'structure'
  }
};
function ModuleChip({
  name,
  found,
  onOpen
}) {
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: ev => {
      ev.stopPropagation();
      onOpen && onOpen(name);
    },
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      maxWidth: '100%',
      padding: '3px 8px',
      color: found ? 'var(--action-primary)' : 'var(--text-secondary)',
      background: found ? 'var(--action-ghost-hover)' : 'var(--bg-app)',
      border: '1px solid ' + (found ? 'var(--focus-ring)' : 'var(--border-subtle)'),
      borderRadius: 6,
      cursor: 'pointer',
      fontFamily: 'var(--font-mono)',
      fontSize: 11.5,
      lineHeight: 1.5,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, name);
}
function GraphNode({
  node,
  lod,
  zoom,
  selected,
  dimmed,
  aiOn,
  foundModule,
  onSelect,
  onEnter,
  onOpenModule
}) {
  const k = KIND[node.kind] || KIND.subregion;
  const container = node.kind === 'region' || node.kind === 'subregion' && lod !== 'modules' && false;
  const lp = base => Math.round(Math.max(base, base / zoom));
  const isCluster = node.kind === 'cluster';
  const showMembers = lod === 'modules' && node.members && node.kind !== 'region';
  const showAI = isCluster && aiOn && node.ai;
  const headTitle = node.kind === 'region' || node.kind === 'loose' ? node.label : node.label;
  return /*#__PURE__*/React.createElement("div", {
    onClick: ev => {
      ev.stopPropagation();
      onSelect(node.id);
    },
    style: {
      position: 'absolute',
      left: node.rect.x,
      top: node.rect.y,
      width: node.rect.w,
      height: node.rect.h,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      zIndex: 10 + node.depth * 10,
      background: k.bg,
      border: (selected ? 2.5 : k.bw) + 'px solid ' + (selected ? 'var(--focus-ring)' : k.border),
      borderStyle: node.kind === 'residual' ? 'dashed' : 'solid',
      borderRadius: k.radius,
      boxShadow: selected ? 'var(--shadow-selected)' : node.depth > 1 ? 'var(--shadow-node)' : 'none',
      opacity: dimmed ? 0.22 : 1,
      transition: 'opacity 140ms ease, border-color 140ms ease',
      cursor: 'pointer'
    }
  }, showAI && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '5px 10px',
      background: 'var(--ai-surface)',
      borderBottom: '1px solid var(--ai-border)',
      boxShadow: 'inset 3px 0 0 var(--ai-accent)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      flex: 'none',
      color: 'var(--ai-accent)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "sparkles",
    size: lp(13)
  })), /*#__PURE__*/React.createElement("strong", {
    style: {
      flex: '1 1 auto',
      minWidth: 0,
      overflow: 'hidden',
      color: 'var(--ai-text)',
      fontSize: lp(12.5),
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, node.ai.name), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 'none',
      color: 'var(--ai-text)',
      fontSize: lp(9.5),
      fontWeight: 700,
      letterSpacing: '0.06em',
      textTransform: 'uppercase'
    }
  }, "AI interpretation")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      flex: 'none',
      padding: node.kind === 'region' ? '9px 12px' : '7px 10px',
      background: node.kind === 'region' ? 'var(--region-head-bg)' : 'transparent',
      borderBottom: node.kind === 'region' ? '1px solid var(--region-border)' : 'none'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      flex: 'none',
      color: isCluster ? 'var(--structural-cluster-accent)' : node.kind === 'residual' ? 'var(--text-muted)' : 'var(--text-secondary)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: k.icon,
    size: lp(node.kind === 'region' ? 15 : 13)
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: '0 1 auto',
      minWidth: 0,
      overflow: 'hidden',
      color: node.kind === 'residual' ? 'var(--text-muted)' : 'var(--text-primary)',
      fontFamily: isCluster || node.kind === 'residual' ? 'var(--font-sans)' : 'var(--font-mono)',
      fontSize: lp(node.kind === 'region' ? node.depth === 0 ? 16 : 14 : 12.5),
      fontWeight: node.kind === 'region' ? 650 : isCluster ? 600 : 500,
      letterSpacing: node.kind === 'region' && node.depth === 0 ? '0.01em' : 0,
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, headTitle), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 'none',
      marginLeft: 'auto',
      color: 'var(--text-muted)',
      fontSize: lp(11.5),
      whiteSpace: 'nowrap'
    }
  }, node.summary && lod !== 'modules' ? node.summary + ' · ' : '', node.count, " ", node.count === 1 ? 'module' : 'modules', isCluster ? ' · ' + node.relations + ' relations' : ''), selected && /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": 'Enter ' + node.label,
    title: 'Enter ' + node.label,
    onClick: ev => {
      ev.stopPropagation();
      onEnter(node);
    },
    style: {
      display: 'inline-flex',
      flex: 'none',
      alignItems: 'center',
      gap: 5,
      padding: '2px 8px',
      color: 'var(--action-primary)',
      background: 'var(--bg-surface)',
      border: '1px solid var(--focus-ring)',
      borderRadius: 6,
      cursor: 'pointer',
      fontSize: lp(11)
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-right",
    size: lp(12)
  }))), showMembers && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      alignContent: 'flex-start',
      gap: 4,
      minHeight: 0,
      overflow: 'hidden',
      padding: '2px 10px 9px'
    }
  }, node.members.slice(0, node.kind === 'residual' ? 3 : 5).map(m => /*#__PURE__*/React.createElement(ModuleChip, {
    key: m,
    name: m,
    found: foundModule === m,
    onOpen: onOpenModule
  })), node.count > (node.members || []).length && /*#__PURE__*/React.createElement("span", {
    style: {
      alignSelf: 'center',
      color: 'var(--text-muted)',
      fontSize: lp(11)
    }
  }, "+", node.count - node.members.length, " more")), !showMembers && node.kind !== 'region' && lod === 'clusters' && node.members && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      padding: '0 10px 8px',
      overflow: 'hidden',
      color: 'var(--text-muted)',
      fontFamily: 'var(--font-mono)',
      fontSize: lp(11),
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, node.members.slice(0, 2).join('  '), node.count > 2 ? '  +' + (node.count - 2) : ''));
}

/* ── canvas frame: pan, semantic zoom, minimap, controls ───────── */

const LOD_OF = z => z < 0.72 ? 'regions' : z < 0.96 ? 'clusters' : 'modules';
function Minimap({
  nodes,
  w,
  h,
  viewport,
  onJump,
  selected
}) {
  const s = Math.min(148 / w, 100 / h);
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": "Minimap",
    onClick: ev => {
      const b = ev.currentTarget.getBoundingClientRect();
      onJump((ev.clientX - b.left) / s, (ev.clientY - b.top) / s);
    },
    style: {
      position: 'relative',
      width: w * s,
      height: h * s,
      padding: 0,
      background: 'var(--bg-sunken)',
      border: '1px solid var(--border-default2)',
      borderRadius: 8,
      cursor: 'crosshair',
      overflow: 'hidden'
    }
  }, nodes.filter(n => n.depth <= 1 || n.kind === 'cluster').map(n => /*#__PURE__*/React.createElement("span", {
    key: n.id,
    style: {
      position: 'absolute',
      left: n.rect.x * s,
      top: n.rect.y * s,
      width: n.rect.w * s,
      height: n.rect.h * s,
      background: selected === n.id ? 'var(--action-primary)' : n.kind === 'cluster' ? 'var(--structural-cluster-border)' : 'var(--border-default2)',
      border: n.depth === 0 ? '1px solid var(--text-muted)' : 'none',
      borderRadius: 2
    }
  })), viewport && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      left: viewport.x * s,
      top: viewport.y * s,
      width: viewport.w * s,
      height: viewport.h * s,
      border: '1.5px solid var(--action-primary)',
      background: 'var(--action-ghost-hover)',
      borderRadius: 2
    }
  }));
}
function GraphControls({
  zoom,
  onZoom,
  onFit,
  filter,
  onFilter,
  view,
  onView,
  mini,
  onMini
}) {
  const btn = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    color: 'var(--text-primary)',
    background: 'transparent',
    border: 0,
    borderRadius: 6,
    cursor: 'pointer'
  };
  const div = /*#__PURE__*/React.createElement("span", {
    style: {
      width: 1,
      height: 18,
      background: 'var(--border-default2)'
    }
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      padding: 4,
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-default2)',
      borderRadius: 10,
      boxShadow: 'var(--shadow-chrome)'
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    style: btn,
    "aria-label": "Zoom out",
    onClick: () => onZoom(-1)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "minus",
    size: 15
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      minWidth: 38,
      color: 'var(--text-muted)',
      fontSize: 11.5,
      textAlign: 'center',
      fontVariantNumeric: 'tabular-nums'
    }
  }, Math.round(zoom * 100), "%"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    style: btn,
    "aria-label": "Zoom in",
    onClick: () => onZoom(1)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 15
  })), /*#__PURE__*/React.createElement("button", {
    type: "button",
    style: btn,
    "aria-label": "Fit to view",
    onClick: onFit
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "maximize",
    size: 15
  })), div, /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      paddingLeft: 4,
      color: 'var(--text-muted)',
      fontSize: 11.5
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "waypoints",
    size: 14
  }), /*#__PURE__*/React.createElement("select", {
    value: filter,
    onChange: ev => onFilter(ev.target.value),
    "aria-label": "Relation filter",
    style: {
      height: 26,
      padding: '0 4px',
      color: 'var(--text-primary)',
      background: 'var(--bg-app)',
      border: '1px solid var(--border-default2)',
      borderRadius: 6,
      fontSize: 11.5,
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "strong"
  }, "Strongest"), /*#__PURE__*/React.createElement("option", {
    value: "all"
  }, "All relations"), /*#__PURE__*/React.createElement("option", {
    value: "imports"
  }, "Imports"), /*#__PURE__*/React.createElement("option", {
    value: "calls"
  }, "Calls"), /*#__PURE__*/React.createElement("option", {
    value: "inherits"
  }, "Inheritance"), /*#__PURE__*/React.createElement("option", {
    value: "none"
  }, "None"))), div, /*#__PURE__*/React.createElement("div", {
    role: "radiogroup",
    "aria-label": "Architecture view",
    style: {
      display: 'flex',
      gap: 2
    }
  }, [['map', 'network', 'Map'], ['outline', 'list-tree', 'Outline'], ['split', 'panel-right', 'Both']].map(([id, icon, label]) => {
    const on = view === id;
    return /*#__PURE__*/React.createElement("button", {
      key: id,
      type: "button",
      role: "radio",
      "aria-checked": on,
      onClick: () => onView(id),
      style: {
        ...btn,
        width: 'auto',
        gap: 5,
        padding: '0 9px',
        fontSize: 12,
        fontWeight: on ? 620 : 400,
        color: on ? 'var(--text-primary)' : 'var(--text-muted)',
        background: on ? 'var(--bg-sunken)' : 'transparent',
        border: '1px solid ' + (on ? 'var(--border-default2)' : 'transparent')
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: icon,
      size: 14
    }), label);
  })), div, /*#__PURE__*/React.createElement("button", {
    type: "button",
    style: {
      ...btn,
      color: mini ? 'var(--action-primary)' : 'var(--text-muted)'
    },
    "aria-label": "Toggle minimap",
    "aria-pressed": mini,
    onClick: onMini
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "workflow",
    size: 15
  })));
}
Object.assign(window, {
  routeEdge,
  routeVia,
  EdgeLayer,
  GraphNode,
  ModuleChip,
  Minimap,
  GraphControls,
  LOD_OF,
  KIND
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/lauras-graph/GraphCanvas.jsx", error: String((e && e.message) || e) }); }

// ui_kits/lauras-graph/GraphScreens.jsx
try { (() => {
const {
  Icon,
  ProvenanceChip,
  StatusBadge,
  StatementCard,
  Callout,
  Button,
  AIInterpretationCard
} = window.SyntaxTreeDesignSystem_b1a4e9;
const G = window.GraphData;

/* ── the architecture map ──────────────────────────────────────── */

function MapCanvas({
  zoom,
  setZoom,
  filter,
  selected,
  onSelect,
  onEnter,
  aiOn,
  foundModule,
  onOpenModule,
  mini,
  controls,
  scope
}) {
  const scroller = React.useRef(null);
  const [viewport, setViewport] = React.useState(null);
  const lod = LOD_OF(zoom);
  const nodes = scope ? G.nodes.filter(n => n.id === scope || G.ancestorsOf(n.id).includes(scope)) : G.nodes;
  const ids = nodes.map(n => n.id);
  const rects = {};
  nodes.forEach(n => {
    rects[n.id] = n.rect;
  });
  const edges = React.useMemo(() => {
    if (filter === 'none') return [];
    const clusterLevel = e => [e.from, e.to].some(id => G.byId[id] && G.byId[id].kind === 'cluster');
    return G.edges.filter(e => {
      if (!ids.includes(e.from) || !ids.includes(e.to)) return false;
      if (clusterLevel(e) && lod === 'regions') return false;
      const touchesSelection = selected && (e.from === selected || e.to === selected);
      if (touchesSelection) return true;
      if (filter === 'all') return true;
      if (filter === 'strong') return e.count >= 6;
      if (filter === 'inherits') return e.kind === 'inherits';
      return e.kind === filter;
    });
  }, [filter, lod, selected, scope]);
  const measure = React.useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setViewport({
      x: el.scrollLeft / zoom,
      y: el.scrollTop / zoom,
      w: el.clientWidth / zoom,
      h: el.clientHeight / zoom
    });
  }, [zoom]);
  React.useEffect(() => {
    measure();
  }, [measure, lod]);
  const jump = (x, y) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({
      left: x * zoom - el.clientWidth / 2,
      top: y * zoom - el.clientHeight / 2,
      behavior: 'smooth'
    });
  };
  React.useEffect(() => {
    if (!foundModule) return;
    const owner = G.nodes.find(n => (n.members || []).includes(foundModule));
    if (owner) jump(owner.rect.x + owner.rect.w / 2, owner.rect.y + owner.rect.h / 2);
  }, [foundModule]);
  const related = selected ? [selected].concat(edges.filter(e => e.from === selected || e.to === selected).map(e => e.from === selected ? e.to : e.from)) : null;
  const keep = n => !related || related.includes(n.id) || G.ancestorsOf(selected).includes(n.id) || G.ancestorsOf(n.id).includes(selected);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      minWidth: 0,
      minHeight: 0,
      background: 'var(--bg-canvas)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    ref: scroller,
    onScroll: measure,
    onClick: () => onSelect(null),
    style: {
      position: 'absolute',
      inset: 0,
      overflow: 'auto',
      backgroundImage: 'radial-gradient(var(--canvas-dot) 1px, transparent 1px)',
      backgroundSize: 22 * zoom + 'px ' + 22 * zoom + 'px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      width: G.CW * zoom,
      height: G.CH * zoom
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: G.CW,
      height: G.CH,
      transform: 'scale(' + zoom + ')',
      transformOrigin: '0 0'
    }
  }, /*#__PURE__*/React.createElement(EdgeLayer, {
    edges: edges,
    rects: rects,
    w: G.CW,
    h: G.CH,
    zoom: zoom,
    activeIds: selected ? [selected] : null,
    dimmed: !!selected,
    showLabels: lod !== 'regions' || !!selected
  }), nodes.map(n => /*#__PURE__*/React.createElement(GraphNode, {
    key: n.id,
    node: n,
    lod: lod,
    zoom: zoom,
    selected: selected === n.id,
    dimmed: selected ? !keep(n) : false,
    aiOn: aiOn,
    foundModule: foundModule,
    onSelect: onSelect,
    onEnter: onEnter,
    onOpenModule: onOpenModule
  }))))), mini && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 14,
      bottom: 14,
      zIndex: 6,
      padding: 5,
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-default2)',
      borderRadius: 10,
      boxShadow: 'var(--shadow-chrome)'
    }
  }, /*#__PURE__*/React.createElement(Minimap, {
    nodes: nodes,
    w: G.CW,
    h: G.CH,
    viewport: viewport,
    selected: selected,
    onJump: jump
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      right: 14,
      bottom: 14,
      zIndex: 6
    }
  }, controls), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      right: 14,
      top: 12,
      zIndex: 6,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '4px 10px',
      color: 'var(--text-muted)',
      background: 'var(--bg-surface-alpha)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 999,
      fontSize: 11.5,
      whiteSpace: 'nowrap'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "boxes",
    size: 12
  }), lod === 'regions' ? 'Regions' : lod === 'clusters' ? 'Regions + clusters' : 'Regions + clusters + modules'));
}

/* ── group drill-down: members as a graph, not a list ──────────── */

function GroupGraph({
  group,
  aiOn,
  onOpenModule,
  foundModule
}) {
  const members = group.members || [];
  const basis = group.basis || [];
  const W = 900,
    H = 420;
  const cx = W / 2,
    cy = H / 2 + 10,
    rx = 300,
    ry = 132;
  const pos = {};
  members.forEach((m, i) => {
    const a = -Math.PI / 2 + i * 2 * Math.PI / members.length;
    pos[m] = {
      x: cx + rx * Math.cos(a) - 108,
      y: cy + ry * Math.sin(a) - 20,
      w: 216,
      h: 40
    };
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      height: '100%',
      overflow: 'auto',
      padding: '16px 20px 32px',
      background: 'var(--bg-canvas)',
      backgroundImage: 'radial-gradient(var(--canvas-dot) 1px, transparent 1px)',
      backgroundSize: '22px 22px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 10,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement(ProvenanceChip, {
    kind: group.kind === 'cluster' ? 'cluster' : 'structure'
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-muted)',
      fontSize: 12.5
    }
  }, group.count, " modules", group.relations ? ' · ' + group.relations + ' internal relations' : '')), aiOn && group.ai && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      maxWidth: 640,
      marginBottom: 12,
      padding: '8px 12px',
      background: 'var(--ai-surface)',
      border: '1px solid var(--ai-border)',
      borderRadius: 9,
      boxShadow: 'inset 3px 0 0 var(--ai-accent)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      color: 'var(--ai-accent)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "sparkles",
    size: 14
  })), /*#__PURE__*/React.createElement("strong", {
    style: {
      color: 'var(--ai-text)',
      fontSize: 13.5
    }
  }, group.ai.name), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 'none',
      marginLeft: 'auto',
      color: 'var(--ai-text)',
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      whiteSpace: 'nowrap'
    }
  }, "AI interpretation")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      width: W,
      height: H,
      margin: '0 auto',
      background: 'var(--structural-cluster-bg)',
      border: '1.5px solid var(--structural-cluster-border)',
      borderRadius: 14
    }
  }, /*#__PURE__*/React.createElement(EdgeLayer, {
    w: W,
    h: H,
    zoom: 1,
    rects: pos,
    showLabels: true,
    edges: basis.map((b, i) => ({
      id: 'b' + i,
      from: b[0],
      to: b[2],
      kind: b[1],
      count: 1
    }))
  }), members.map(m => /*#__PURE__*/React.createElement("div", {
    key: m,
    style: {
      position: 'absolute',
      left: pos[m].x,
      top: pos[m].y,
      width: pos[m].w,
      height: pos[m].h,
      zIndex: 20
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => onOpenModule(m),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      width: '100%',
      height: '100%',
      padding: '0 10px',
      color: 'var(--text-primary)',
      background: foundModule === m ? 'var(--action-ghost-hover)' : 'var(--bg-surface)',
      border: '1px solid ' + (foundModule === m ? 'var(--focus-ring)' : 'var(--border-default2)'),
      borderRadius: 8,
      boxShadow: 'var(--shadow-node)',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "file-code-2",
    size: 13
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      overflow: 'hidden',
      fontFamily: 'var(--font-mono)',
      fontSize: 11.5,
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, m))))), /*#__PURE__*/React.createElement("p", {
    style: {
      maxWidth: 640,
      margin: '14px auto 0',
      color: 'var(--text-muted)',
      fontSize: 12.5,
      lineHeight: 1.55,
      textAlign: 'center'
    }
  }, "Edges are the real import and call relations between these modules. Relations reaching outside this group appear on the module itself, one level down."));
}

/* ── entity focus: incoming ▸ entity ▸ outgoing ────────────────── */

function EntityGraph({
  entity,
  onOpenStatement
}) {
  const W = 940,
    H = 300;
  const rects = {
    __self: {
      x: W / 2 - 118,
      y: H / 2 - 44,
      w: 236,
      h: 88
    }
  };
  const col = (items, side) => items.forEach((it, i) => {
    const gap = H / (items.length + 1);
    rects[side + it.label] = {
      x: side === 'in' ? 20 : W - 220,
      y: gap * (i + 1) - 22,
      w: 200,
      h: 44
    };
  });
  col(entity.incoming, 'in');
  col(entity.outgoing, 'out');
  const edges = entity.incoming.map((it, i) => ({
    id: 'i' + i,
    from: 'in' + it.label,
    to: '__self',
    kind: it.relation,
    count: 1
  })).concat(entity.outgoing.map((it, i) => ({
    id: 'o' + i,
    from: '__self',
    to: 'out' + it.label,
    kind: it.relation,
    count: 1
  })));
  const node = (it, side) => /*#__PURE__*/React.createElement("div", {
    key: side + it.label,
    style: {
      position: 'absolute',
      left: rects[side + it.label].x,
      top: rects[side + it.label].y,
      width: rects[side + it.label].w,
      height: rects[side + it.label].h,
      zIndex: 20,
      display: 'grid',
      alignContent: 'center',
      gap: 2,
      padding: '0 11px',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-default2)',
      borderRadius: 9,
      boxShadow: 'var(--shadow-node)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      overflow: 'hidden',
      fontFamily: 'var(--font-mono)',
      fontSize: 12,
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, it.label), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-muted)',
      fontSize: 11
    }
  }, it.group));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      overflow: 'auto',
      padding: '14px 20px 40px',
      background: 'var(--bg-canvas)',
      backgroundImage: 'radial-gradient(var(--canvas-dot) 1px, transparent 1px)',
      backgroundSize: '22px 22px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 10,
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      overflow: 'hidden',
      color: 'var(--text-muted)',
      fontSize: 12.5,
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, "in ", entity.ancestry.join('  ›  '))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      width: W,
      height: H,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 0,
      top: 0,
      width: 200,
      color: 'var(--text-muted)',
      fontSize: 10.5,
      fontWeight: 700,
      letterSpacing: '0.06em',
      textTransform: 'uppercase'
    }
  }, "Depended on by"), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      right: 0,
      top: 0,
      width: 200,
      color: 'var(--text-muted)',
      fontSize: 10.5,
      fontWeight: 700,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      textAlign: 'right'
    }
  }, "Depends on"), /*#__PURE__*/React.createElement(EdgeLayer, {
    edges: edges,
    rects: rects,
    w: W,
    h: H,
    zoom: 1,
    showLabels: true
  }), entity.incoming.map(it => node(it, 'in')), entity.outgoing.map(it => node(it, 'out')), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: rects.__self.x,
      top: rects.__self.y,
      width: rects.__self.w,
      height: rects.__self.h,
      zIndex: 21,
      display: 'grid',
      alignContent: 'center',
      gap: 6,
      padding: '0 14px',
      background: 'var(--bg-surface)',
      border: '2.5px solid var(--focus-ring)',
      borderRadius: 12,
      boxShadow: 'var(--shadow-selected)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "file-code-2",
    size: 16
  }), /*#__PURE__*/React.createElement("strong", {
    style: {
      overflow: 'hidden',
      fontFamily: 'var(--font-mono)',
      fontSize: 14,
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, entity.label)), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(ProvenanceChip, {
    kind: "structure",
    size: "sm",
    label: "Module"
  }), /*#__PURE__*/React.createElement(ProvenanceChip, {
    kind: "cluster",
    size: "sm",
    label: "Cluster 1"
  })))), /*#__PURE__*/React.createElement("section", {
    style: {
      maxWidth: 940,
      margin: '18px auto 0'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 10,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: 0,
      fontSize: 14,
      whiteSpace: 'nowrap'
    }
  }, "Architectural statements"), /*#__PURE__*/React.createElement(ProvenanceChip, {
    kind: "verified",
    size: "sm"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
      gap: 10
    }
  }, entity.statements.map(s => /*#__PURE__*/React.createElement(StatementCard, {
    key: s.id,
    statement: entity.label + ' ' + s.statement,
    status: s.status,
    evidenceCount: s.evidence,
    onOpenEvidence: () => onOpenStatement && onOpenStatement(s)
  })))));
}

/* ── 2,000 modules: high-level objects only ────────────────────── */

function LargeRepoMap() {
  const L = G.large;
  const rects = {};
  L.nodes.forEach(n => {
    rects[n.id] = n.rect;
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      overflow: 'auto',
      padding: 20,
      background: 'var(--bg-canvas)',
      backgroundImage: 'radial-gradient(var(--canvas-dot) 1px, transparent 1px)',
      backgroundSize: '22px 22px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 12,
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("strong", {
    style: {
      fontSize: 14
    }
  }, L.total.toLocaleString(), " source modules"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-muted)',
      fontSize: 12.5
    }
  }, "6 top-level regions shown \xB7 everything below is expanded on demand")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      width: L.canvas.w,
      height: L.canvas.h
    }
  }, /*#__PURE__*/React.createElement(EdgeLayer, {
    edges: L.edges,
    rects: rects,
    w: L.canvas.w,
    h: L.canvas.h,
    zoom: 1,
    showLabels: true
  }), L.nodes.map(n => /*#__PURE__*/React.createElement("div", {
    key: n.id,
    style: {
      position: 'absolute',
      left: n.rect.x,
      top: n.rect.y,
      width: n.rect.w,
      height: n.rect.h,
      zIndex: 20,
      display: 'grid',
      gridTemplateRows: 'auto auto 1fr',
      gap: 8,
      padding: 16,
      background: 'var(--region-bg)',
      border: '2px solid var(--region-border)',
      borderRadius: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "folder-tree",
    size: 16
  }), /*#__PURE__*/React.createElement("strong", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 16
    }
  }, n.label), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto',
      color: 'var(--text-muted)',
      fontSize: 12.5
    }
  }, n.count, " modules")), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-muted)',
      fontSize: 12.5
    }
  }, n.nested, " nested regions \xB7 ", n.clusters, " structural clusters"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    style: {
      justifySelf: 'start',
      alignSelf: 'end',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '4px 10px',
      color: 'var(--action-primary)',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-default2)',
      borderRadius: 7,
      cursor: 'pointer',
      fontSize: 12,
      whiteSpace: 'nowrap'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 12
  }), "Expand region")))), /*#__PURE__*/React.createElement("p", {
    style: {
      maxWidth: 720,
      marginTop: 16,
      color: 'var(--text-muted)',
      fontSize: 12.5,
      lineHeight: 1.55
    }
  }, "At this scale the first screen never renders peer module nodes. Regions expand lazily, one level at a time, and the level of detail follows the zoom \u2014 clusters appear before modules do."));
}

/* ── outline: same scope, keyboard-first ───────────────────────── */

function OutlinePane({
  selected,
  onSelect,
  aiOn,
  compactHeader
}) {
  const row = (n, depth) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: n.id
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => onSelect(n.id),
    "aria-current": selected === n.id ? 'true' : undefined,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      width: '100%',
      padding: '6px 10px',
      paddingLeft: 10 + depth * 13,
      textAlign: 'left',
      color: 'var(--text-primary)',
      background: selected === n.id ? 'var(--action-ghost-hover)' : 'transparent',
      border: '1px solid ' + (selected === n.id ? 'var(--focus-ring)' : 'transparent'),
      borderRadius: 7,
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      flex: 'none',
      color: n.kind === 'cluster' ? 'var(--structural-cluster-accent)' : 'var(--text-muted)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: n.kind === 'cluster' ? 'waypoints' : n.kind === 'residual' ? 'circle-dot' : 'folder-tree',
    size: 13
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: '0 1 auto',
      minWidth: 0,
      overflow: 'hidden',
      fontFamily: n.kind === 'cluster' || n.kind === 'residual' ? 'var(--font-sans)' : 'var(--font-mono)',
      fontSize: 12.5,
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, n.label), aiOn && n.ai && /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 'none',
      color: 'var(--ai-text)',
      fontSize: 11
    }
  }, n.ai.name), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 'none',
      marginLeft: 'auto',
      color: 'var(--text-muted)',
      fontSize: 11.5,
      whiteSpace: 'nowrap'
    }
  }, n.count)), (n.children || []).map(c => row(c, depth + 1)));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0,
      height: '100%',
      overflow: 'auto',
      padding: 10,
      background: 'var(--bg-app)'
    }
  }, compactHeader && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '0 0 8px 10px',
      color: 'var(--text-muted)',
      fontSize: 11,
      fontWeight: 680,
      letterSpacing: '0.04em',
      textTransform: 'uppercase'
    }
  }, "Outline \u2014 same scope"), G.outline.map(n => row(n, 0)));
}
Object.assign(window, {
  MapCanvas,
  GroupGraph,
  EntityGraph,
  LargeRepoMap,
  OutlinePane
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/lauras-graph/GraphScreens.jsx", error: String((e && e.message) || e) }); }

// ui_kits/lauras-graph/graph-data.js
try { (() => {
/* Architecture-graph design example.
   Geometry is authored: every node carries an absolute rect in canvas design
   units, so relation edges are computed analytically from the layout rather
   than measured from the DOM. Counts and structure follow the shape of
   topic-similarity-mvp; they are DESIGN EXAMPLE values, labelled as such. */
window.GraphData = function () {
  const CW = 1560,
    CH = 1080;

  /* kind: region | subregion | cluster | residual | loose
     depth drives z-index and border weight. */
  const nodes = [{
    id: 'backend',
    kind: 'region',
    label: 'backend',
    count: 96,
    depth: 0,
    rect: {
      x: 40,
      y: 40,
      w: 1040,
      h: 980
    },
    summary: '5 sections · 5 structural clusters'
  }, {
    id: 'src',
    kind: 'region',
    label: 'backend/src',
    short: 'src',
    count: 90,
    depth: 1,
    parent: 'backend',
    rect: {
      x: 72,
      y: 116,
      w: 976,
      h: 712
    },
    summary: '5 sections'
  }, {
    id: 'controllers',
    kind: 'subregion',
    label: 'controllers',
    path: 'backend/src/controllers',
    count: 31,
    depth: 2,
    parent: 'src',
    rect: {
      x: 104,
      y: 176,
      w: 296,
      h: 116
    },
    members: ['auth.controller.js', 'submission.controller.js', 'admin.controller.js', 'report.controller.js']
  }, {
    id: 'middleware',
    kind: 'subregion',
    label: 'middleware',
    path: 'backend/src/middleware',
    count: 2,
    depth: 2,
    parent: 'src',
    rect: {
      x: 424,
      y: 176,
      w: 232,
      h: 116
    },
    members: ['auth.middleware.js', 'error.middleware.js']
  }, {
    id: 'services',
    kind: 'region',
    label: 'services',
    path: 'backend/src/services',
    count: 50,
    depth: 2,
    parent: 'src',
    rect: {
      x: 104,
      y: 330,
      w: 944,
      h: 372
    },
    summary: '5 structural clusters · 35 ungrouped',
    clustered: true
  }, {
    id: 'c1',
    kind: 'cluster',
    label: 'Cluster 1',
    full: 'Structural cluster 1',
    count: 5,
    relations: 6,
    depth: 3,
    parent: 'services',
    rect: {
      x: 136,
      y: 392,
      w: 292,
      h: 146
    },
    members: ['auth.service.js', 'email.service.js', 'notification.service.js', 'notificationEvent.service.js', 'submission.service.js'],
    ai: {
      name: 'Authentication & Sessions',
      description: 'Credential checks, token validation and the notifications sent when a session or submission changes state.'
    },
    basis: [['auth.service.js', 'imports', 'email.service.js'], ['auth.service.js', 'imports', 'notification.service.js'], ['notification.service.js', 'calls', 'notificationEvent.service.js'], ['submission.service.js', 'imports', 'notification.service.js']]
  }, {
    id: 'c2',
    kind: 'cluster',
    label: 'Cluster 2',
    full: 'Structural cluster 2',
    count: 4,
    relations: 4,
    depth: 3,
    parent: 'services',
    rect: {
      x: 448,
      y: 392,
      w: 276,
      h: 146
    },
    members: ['adminReportExport.service.js', 'adminUser.service.js', 'auditLog.service.js', 'superviseeAssignment.service.js'],
    basis: [['adminUser.service.js', 'imports', 'auditLog.service.js'], ['adminReportExport.service.js', 'imports', 'auditLog.service.js']]
  }, {
    id: 'c3',
    kind: 'cluster',
    label: 'Cluster 3',
    full: 'Structural cluster 3',
    count: 2,
    relations: 1,
    depth: 3,
    parent: 'services',
    rect: {
      x: 744,
      y: 392,
      w: 276,
      h: 146
    },
    members: ['topic.service.js', 'similarity.service.js'],
    basis: [['topic.service.js', 'imports', 'similarity.service.js']]
  }, {
    id: 'c4',
    kind: 'cluster',
    label: 'Cluster 4',
    full: 'Structural cluster 4',
    count: 2,
    relations: 1,
    depth: 3,
    parent: 'services',
    rect: {
      x: 136,
      y: 560,
      w: 276,
      h: 104
    },
    members: ['queue.service.js', 'worker.service.js'],
    basis: [['worker.service.js', 'imports', 'queue.service.js']]
  }, {
    id: 'c5',
    kind: 'cluster',
    label: 'Cluster 5',
    full: 'Structural cluster 5',
    count: 2,
    relations: 1,
    depth: 3,
    parent: 'services',
    rect: {
      x: 432,
      y: 560,
      w: 276,
      h: 104
    },
    members: ['upload.service.js', 'storage.service.js'],
    basis: [['upload.service.js', 'imports', 'storage.service.js']]
  }, {
    id: 'residual',
    kind: 'residual',
    label: 'Ungrouped',
    count: 35,
    depth: 3,
    parent: 'services',
    rect: {
      x: 728,
      y: 560,
      w: 292,
      h: 104
    },
    members: ['contextSimilarity.service.js', 'readiness.service.js', 'cohort.service.js', 'feedback.service.js']
  }, {
    id: 'config',
    kind: 'subregion',
    label: 'config',
    path: 'backend/src/config',
    count: 7,
    depth: 2,
    parent: 'src',
    rect: {
      x: 104,
      y: 724,
      w: 296,
      h: 88
    },
    members: ['auth.config.js', 'db.config.js', 'mail.config.js', 'queue.config.js']
  }, {
    id: 'utils',
    kind: 'subregion',
    label: 'utils',
    path: 'backend/src/utils',
    count: 4,
    depth: 2,
    parent: 'src',
    rect: {
      x: 424,
      y: 724,
      w: 232,
      h: 88
    },
    members: ['logger.js', 'hash.js', 'dates.js', 'ids.js']
  }, {
    id: 'tests',
    kind: 'subregion',
    label: 'tests',
    path: 'backend/tests',
    count: 14,
    depth: 1,
    parent: 'backend',
    rect: {
      x: 72,
      y: 860,
      w: 976,
      h: 120
    },
    members: ['auth.test.js', 'submission.test.js', 'similarity.test.js', 'worker.test.js'],
    summary: 'unit · integration'
  }, {
    id: 'frontend',
    kind: 'region',
    label: 'frontend',
    count: 32,
    depth: 0,
    rect: {
      x: 1120,
      y: 40,
      w: 390,
      h: 340
    },
    summary: '2 sections'
  }, {
    id: 'fe-components',
    kind: 'subregion',
    label: 'components',
    path: 'frontend/src/components',
    count: 21,
    depth: 1,
    parent: 'frontend',
    rect: {
      x: 1152,
      y: 116,
      w: 326,
      h: 96
    },
    members: ['ReviewPanel.jsx', 'TopicList.jsx', 'Uploader.jsx']
  }, {
    id: 'fe-app',
    kind: 'subregion',
    label: 'app',
    path: 'frontend/src/app',
    count: 11,
    depth: 1,
    parent: 'frontend',
    rect: {
      x: 1152,
      y: 232,
      w: 326,
      h: 96
    },
    members: ['routes.jsx', 'api.js', 'store.js']
  }, {
    id: 'root',
    kind: 'loose',
    label: 'Repository root files',
    count: 2,
    depth: 0,
    rect: {
      x: 1120,
      y: 424,
      w: 390,
      h: 92
    },
    members: ['server.js', 'server.test.js']
  }];

  /* Aggregated relations. Every edge is the sum of real member-level
     imports/calls/inheritance between the two groups — never inferred. */
  const edges = [{
    id: 'e1',
    from: 'controllers',
    to: 'services',
    kind: 'imports',
    count: 38
  }, {
    id: 'e2',
    from: 'middleware',
    to: 'services',
    kind: 'imports',
    count: 4,
    anchor: {
      from: 'bottom',
      to: 'top'
    },
    channel: {
      y: 318
    }
  }, {
    id: 'e3',
    from: 'controllers',
    to: 'middleware',
    kind: 'imports',
    count: 6
  }, {
    id: 'e4',
    from: 'services',
    to: 'config',
    kind: 'imports',
    count: 12
  }, {
    id: 'e5',
    from: 'services',
    to: 'utils',
    kind: 'calls',
    count: 9,
    anchor: {
      from: 'bottom',
      to: 'top'
    },
    channel: {
      y: 715
    }
  }, {
    id: 'e6',
    from: 'tests',
    to: 'services',
    kind: 'imports',
    count: 22,
    anchor: {
      from: 'right',
      to: 'right'
    },
    channel: {
      x: 1066
    }
  }, {
    id: 'e7',
    from: 'fe-components',
    to: 'fe-app',
    kind: 'imports',
    count: 14
  }, {
    id: 'e8',
    from: 'root',
    to: 'src',
    kind: 'imports',
    count: 2
  }, {
    id: 'e9',
    from: 'c2',
    to: 'c1',
    kind: 'imports',
    count: 3
  }, {
    id: 'e10',
    from: 'c1',
    to: 'c3',
    kind: 'calls',
    count: 2,
    anchor: {
      from: 'top',
      to: 'top'
    },
    channel: {
      y: 380
    }
  }, {
    id: 'e11',
    from: 'c4',
    to: 'c5',
    kind: 'imports',
    count: 1
  }, {
    id: 'e12',
    from: 'c1',
    to: 'config',
    kind: 'imports',
    count: 4,
    anchor: {
      from: 'left',
      to: 'top'
    },
    channel: {
      x: 120
    }
  }];

  /* Entity focus — one hop in, one hop out. */
  const entity = {
    id: 'auth.service.js',
    label: 'auth.service.js',
    kind: 'module',
    ancestry: ['backend', 'backend/src/services', 'Structural cluster 1'],
    incoming: [{
      label: 'auth.controller.js',
      relation: 'imports',
      group: 'controllers'
    }, {
      label: 'auth.middleware.js',
      relation: 'imports',
      group: 'middleware'
    }, {
      label: 'auth.test.js',
      relation: 'imports',
      group: 'tests'
    }],
    outgoing: [{
      label: 'email.service.js',
      relation: 'imports',
      group: 'Structural cluster 1'
    }, {
      label: 'notification.service.js',
      relation: 'calls',
      group: 'Structural cluster 1'
    }, {
      label: 'auth.config.js',
      relation: 'imports',
      group: 'config'
    }],
    statements: [{
      id: 's1',
      statement: 'calls notification.service.js when a session is created',
      status: 'supported',
      evidence: 3
    }, {
      id: 's2',
      statement: 'imports token verification from auth.config.js',
      status: 'supported',
      evidence: 2
    }, {
      id: 's3',
      statement: 'is reachable from the public HTTP surface',
      status: 'insufficient_evidence',
      evidence: 0
    }, {
      id: 's4',
      statement: 'writes directly to the audit log',
      status: 'contradicted',
      evidence: 1
    }]
  };

  /* Scale case — 2,000 modules. Top level only; everything else is lazy. */
  const large = {
    total: 2014,
    nodes: [{
      id: 'L-frontend',
      label: 'frontend',
      count: 612,
      nested: 34,
      clusters: 11,
      rect: {
        x: 60,
        y: 60,
        w: 420,
        h: 210
      }
    }, {
      id: 'L-backend',
      label: 'backend',
      count: 848,
      nested: 52,
      clusters: 19,
      rect: {
        x: 540,
        y: 60,
        w: 470,
        h: 210
      }
    }, {
      id: 'L-shared',
      label: 'packages/shared',
      count: 214,
      nested: 12,
      clusters: 6,
      rect: {
        x: 1070,
        y: 60,
        w: 380,
        h: 210
      }
    }, {
      id: 'L-worker',
      label: 'services/worker',
      count: 168,
      nested: 9,
      clusters: 4,
      rect: {
        x: 540,
        y: 330,
        w: 470,
        h: 190
      }
    }, {
      id: 'L-infra',
      label: 'infra',
      count: 106,
      nested: 7,
      clusters: 2,
      rect: {
        x: 1070,
        y: 330,
        w: 380,
        h: 190
      }
    }, {
      id: 'L-tests',
      label: 'tests',
      count: 66,
      nested: 4,
      clusters: 1,
      rect: {
        x: 60,
        y: 330,
        w: 420,
        h: 190
      }
    }],
    edges: [{
      id: 'Le1',
      from: 'L-frontend',
      to: 'L-shared',
      kind: 'imports',
      count: 214
    }, {
      id: 'Le2',
      from: 'L-backend',
      to: 'L-shared',
      kind: 'imports',
      count: 331
    }, {
      id: 'Le3',
      from: 'L-backend',
      to: 'L-worker',
      kind: 'calls',
      count: 96
    }, {
      id: 'Le4',
      from: 'L-tests',
      to: 'L-backend',
      kind: 'imports',
      count: 402
    }, {
      id: 'Le5',
      from: 'L-worker',
      to: 'L-infra',
      kind: 'imports',
      count: 48
    }, {
      id: 'Le6',
      from: 'L-frontend',
      to: 'L-backend',
      kind: 'imports',
      count: 27
    }],
    canvas: {
      w: 1510,
      h: 580
    }
  };
  const byId = {};
  nodes.forEach(n => {
    byId[n.id] = n;
  });
  const childrenOf = id => nodes.filter(n => n.parent === id);
  const ancestorsOf = id => {
    const out = [];
    let n = byId[id];
    while (n && n.parent) {
      out.unshift(n.parent);
      n = byId[n.parent];
    }
    return out;
  };

  /* Outline mirrors the map exactly — same nodes, same order, same scope. */
  const outline = (() => {
    const build = parent => childrenOf(parent).map(n => ({
      id: n.id,
      label: n.label,
      kind: n.kind,
      count: n.count,
      relations: n.relations,
      ai: n.ai,
      children: build(n.id)
    }));
    return nodes.filter(n => !n.parent).map(n => ({
      id: n.id,
      label: n.label,
      kind: n.kind,
      count: n.count,
      children: build(n.id)
    }));
  })();
  return {
    CW,
    CH,
    nodes,
    edges,
    byId,
    childrenOf,
    ancestorsOf,
    entity,
    large,
    outline,
    modules: nodes.filter(n => n.members).reduce((a, n) => a.concat(n.members.map(m => ({
      name: m,
      parent: n.id
    }))), [])
  };
}();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/lauras-graph/graph-data.js", error: String((e && e.message) || e) }); }

// ui_kits/lauras-redesign/Explorer.jsx
try { (() => {
const {
  Icon,
  Button,
  IconButton,
  Chip,
  Callout,
  StatusBadge,
  ProvenanceChip,
  AIInterpretationCard,
  StatementCard,
  StructuralRegion,
  ClusterCard,
  ArchitectureTree
} = window.SyntaxTreeDesignSystem_b1a4e9;

/* ── State 1 — Overview ────────────────────────────────────────── */

function Overview({
  state,
  actions
}) {
  const data = window.LaurasData;
  const {
    expanded,
    selected,
    ai
  } = state;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      overflow: 'auto',
      padding: '18px 22px 112px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 14,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      color: 'var(--text-secondary)',
      fontSize: 14
    }
  }, /*#__PURE__*/React.createElement("strong", {
    style: {
      color: 'var(--text-primary)'
    }
  }, data.repo.modules, " source modules"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-muted)'
    }
  }, " \xB7 ", data.repo.regions, " top-level region \xB7 ", data.repo.sections, " repository sections \xB7 ", data.repo.clusters, " structural clusters")), /*#__PURE__*/React.createElement(ExampleNotice, null)), /*#__PURE__*/React.createElement(StructuralRegion, {
    path: "backend",
    moduleCount: 51,
    expanded: expanded.backend !== false,
    onToggle: () => actions.toggle('backend'),
    onEnter: () => actions.enterRegion({
      id: 'backend',
      path: 'backend',
      modules: 51
    })
  }, data.regions.map(region => region.clustered ? /*#__PURE__*/React.createElement(StructuralRegion, {
    key: region.id,
    depth: 1,
    path: region.path,
    moduleCount: region.modules,
    expanded: expanded[region.id] !== false,
    onToggle: () => actions.toggle(region.id),
    onEnter: () => actions.enterRegion(region),
    selected: selected && selected.id === region.id
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '0 0 2px',
      color: 'var(--text-muted)',
      fontSize: 12.5
    }
  }, "50 modules \xB7 5 structural clusters \xB7 24 ungrouped"), data.clusters.slice(0, 2).map(cluster => /*#__PURE__*/React.createElement(ClusterCard, {
    key: cluster.id,
    label: cluster.label,
    memberCount: cluster.modules,
    relationCount: cluster.relations,
    members: cluster.members,
    selected: selected && selected.id === cluster.id,
    onEnter: () => actions.enterCluster(cluster),
    onOpenBasis: () => actions.selectCluster(cluster, 'basis'),
    aiSlot: /*#__PURE__*/React.createElement(AIInterpretationCard, {
      state: ai[cluster.id] || (cluster.ai ? 'available' : 'unavailable'),
      name: cluster.ai && cluster.ai.name,
      description: cluster.ai && cluster.ai.description,
      groundTruth: cluster.label + ' · ' + cluster.modules + ' modules, grouped by ' + cluster.relations + ' real relations',
      generatedAt: ai[cluster.id] === 'generated' ? 'cached from this run' : undefined,
      onGenerate: () => actions.generate(cluster.id),
      onRegenerate: () => actions.generate(cluster.id, true)
    })
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, minmax(0,1fr))',
      gap: 10
    }
  }, data.clusters.slice(2).map(cluster => /*#__PURE__*/React.createElement("button", {
    key: cluster.id,
    type: "button",
    onClick: () => actions.enterCluster(cluster),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '10px 12px',
      color: 'var(--text-primary)',
      textAlign: 'left',
      background: 'var(--structural-cluster-bg)',
      border: '1px solid var(--structural-cluster-border)',
      borderRadius: 6,
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--structural-cluster-accent)',
      display: 'inline-flex'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "waypoints",
    size: 14
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13
    }
  }, cluster.label), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto',
      color: 'var(--text-muted)',
      fontSize: 12
    }
  }, cluster.modules)))), /*#__PURE__*/React.createElement(UngroupedBucket, {
    count: data.residual.modules,
    members: data.residual.members
  })) : /*#__PURE__*/React.createElement(CollapsedRegion, {
    key: region.id,
    region: region,
    expanded: expanded[region.id] === true,
    onToggle: () => actions.toggle(region.id, true),
    onEnter: () => actions.enterRegion(region)
  }))));
}

/** Residual bucket. Collapsed by default, neutral weight — reported, not promoted to a cluster. */
function UngroupedBucket({
  count,
  members
}) {
  const [open, setOpen] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'transparent',
      border: '1px dashed var(--border-default2)',
      borderRadius: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-expanded": open,
    onClick: () => setOpen(!open),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      width: '100%',
      padding: '9px 12px',
      color: 'var(--text-muted)',
      textAlign: 'left',
      background: 'transparent',
      border: 0,
      borderRadius: 8,
      cursor: 'pointer',
      fontSize: 12.5
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      transform: open ? 'none' : 'rotate(-90deg)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-down",
    size: 13
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-secondary)'
    }
  }, "Ungrouped \xB7 ", count, " modules"), /*#__PURE__*/React.createElement("span", {
    style: {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, "no relation to any cluster in this run"), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto',
      flex: 'none',
      color: 'var(--action-primary)'
    }
  }, open ? 'Hide' : 'Show')), open && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 12px 12px 34px'
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '0 0 8px',
      color: 'var(--text-muted)',
      fontSize: 12,
      lineHeight: 1.5,
      maxWidth: 620
    }
  }, "These modules were analysed. Nothing was found connecting them to the modules in any cluster, so they are listed rather than grouped. This is a result, not an error."), /*#__PURE__*/React.createElement("ul", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '4px 14px',
      margin: 0,
      padding: 0,
      listStyle: 'none',
      color: 'var(--text-secondary)',
      fontFamily: 'var(--font-mono)',
      fontSize: 11.5
    }
  }, members.map(m => /*#__PURE__*/React.createElement("li", {
    key: m
  }, m)), count > members.length && /*#__PURE__*/React.createElement("li", {
    style: {
      color: 'var(--text-muted)'
    }
  }, "+", count - members.length, " more"))));
}
function CollapsedRegion({
  region,
  expanded,
  onToggle,
  onEnter
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-default2)',
      borderRadius: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '10px 12px'
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-expanded": expanded,
    onClick: onToggle,
    style: {
      display: 'flex',
      flex: '1 1 auto',
      alignItems: 'center',
      gap: 9,
      minWidth: 0,
      padding: 0,
      color: 'var(--text-primary)',
      background: 'transparent',
      border: 0,
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      color: 'var(--text-muted)',
      transform: expanded ? 'none' : 'rotate(-90deg)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-down",
    size: 14
  })), /*#__PURE__*/React.createElement(Icon, {
    name: "folder-tree",
    size: 14
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      overflow: 'hidden',
      fontFamily: 'var(--font-mono)',
      fontSize: 13,
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, region.path)), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 'none',
      color: 'var(--text-muted)',
      fontSize: 12.5,
      whiteSpace: 'nowrap'
    }
  }, region.modules, " modules"), /*#__PURE__*/React.createElement(ProvenanceChip, {
    kind: "structure",
    size: "sm",
    style: {
      flex: 'none'
    }
  }), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onEnter,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      padding: '3px 8px',
      color: 'var(--action-primary)',
      background: 'transparent',
      border: '1px solid var(--border-subtle)',
      borderRadius: 7,
      cursor: 'pointer',
      fontSize: 11.5,
      flex: 'none',
      whiteSpace: 'nowrap'
    }
  }, "Enter", /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-right",
    size: 12
  }))), expanded && /*#__PURE__*/React.createElement("ul", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '4px 12px',
      margin: 0,
      padding: '0 12px 12px 45px',
      listStyle: 'none',
      color: 'var(--text-secondary)',
      fontFamily: 'var(--font-mono)',
      fontSize: 11.5
    }
  }, (region.members || []).map(m => /*#__PURE__*/React.createElement("li", {
    key: m
  }, m)), region.modules > (region.members || []).length && /*#__PURE__*/React.createElement("li", {
    style: {
      color: 'var(--text-muted)'
    }
  }, "+", region.modules - (region.members || []).length, " more")));
}

/* ── State 2 — Group drill-down ────────────────────────────────── */

function GroupView({
  group,
  onEnterEntity
}) {
  const members = group.members || [];
  const basis = group.basis || [];
  const sections = group.sections || null;
  const clusters = group.clustered ? window.LaurasData.clusters : null;
  const residual = group.clustered ? window.LaurasData.residual : null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      overflow: 'auto',
      padding: '18px 22px 112px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 12,
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement(ProvenanceChip, {
    kind: group.kind === 'cluster' ? 'cluster' : 'structure'
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-muted)',
      fontSize: 13
    }
  }, group.modules, " modules", group.relations != null ? ' · ' + group.relations + ' internal relations' : ''), /*#__PURE__*/React.createElement(ExampleNotice, null)), clusters && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 12,
      padding: 20,
      background: 'var(--structural-container-bg)',
      border: '1.5px solid var(--structural-container-border)',
      borderRadius: 12
    }
  }, clusters.map(cluster => /*#__PURE__*/React.createElement(ClusterCard, {
    key: cluster.id,
    label: cluster.label,
    memberCount: cluster.modules,
    relationCount: cluster.relations,
    members: cluster.members,
    onEnter: () => onEnterEntity({
      ...cluster,
      kind: 'cluster',
      path: cluster.label
    })
  })), /*#__PURE__*/React.createElement(UngroupedBucket, {
    count: residual.modules,
    members: residual.members
  })), !clusters && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
      gap: 16,
      padding: 20,
      background: 'var(--structural-container-bg)',
      border: '1.5px solid var(--structural-container-border)',
      borderRadius: 12
    }
  }, sections && sections.map(section => /*#__PURE__*/React.createElement("button", {
    key: section.id,
    type: "button",
    onClick: () => onEnterEntity(section),
    style: {
      display: 'grid',
      gap: 8,
      padding: 14,
      textAlign: 'left',
      color: 'var(--text-primary)',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-default2)',
      borderRadius: 10,
      boxShadow: 'var(--shadow-node)',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "folder-tree",
    size: 15
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      overflow: 'hidden',
      fontFamily: 'var(--font-mono)',
      fontSize: 12.5,
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, section.path)), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-muted)',
      fontSize: 11.5
    }
  }, section.modules, " modules", section.clustered ? ' · 5 structural clusters' : ''), /*#__PURE__*/React.createElement(ProvenanceChip, {
    kind: "structure",
    size: "sm",
    style: {
      justifySelf: 'start'
    }
  }))), !sections && members.map(member => {
    const out = basis.filter(b => b[0] === member);
    return /*#__PURE__*/React.createElement("button", {
      key: member,
      type: "button",
      onClick: () => onEnterEntity(member),
      style: {
        display: 'grid',
        gap: 8,
        padding: 14,
        textAlign: 'left',
        color: 'var(--text-primary)',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default2)',
        borderRadius: 10,
        boxShadow: 'var(--shadow-node)',
        cursor: 'pointer'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "file-code-2",
      size: 15
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        overflow: 'hidden',
        fontFamily: 'var(--font-mono)',
        fontSize: 12.5,
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }
    }, member)), out.length > 0 ? out.map(b => /*#__PURE__*/React.createElement("span", {
      key: b[2],
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        color: 'var(--text-muted)',
        fontSize: 11.5
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "arrow-right",
      size: 11
    }), /*#__PURE__*/React.createElement("em", {
      style: {
        fontStyle: 'normal',
        color: 'var(--structural-cluster-accent)'
      }
    }, b[1]), /*#__PURE__*/React.createElement("span", {
      style: {
        overflow: 'hidden',
        fontFamily: 'var(--font-mono)',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }
    }, b[2]))) : /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--text-muted)',
        fontSize: 11.5
      }
    }, "no outgoing relation inside this group"));
  })), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '14px 0 0',
      color: 'var(--text-muted)',
      fontSize: 12.5,
      lineHeight: 1.5,
      maxWidth: 640
    }
  }, clusters ? 'These clusters come from real import and call relations between the modules in this section. Files nothing connects are listed, not clustered.' : sections ? 'This region contains sections rather than modules. Open one to see the modules inside it and how they relate.' : 'Only relations between modules that are visible here are drawn. Anything reaching outside this group is shown on the module itself, one level down.'));
}

/* ── State 3 — Entity focus ────────────────────────────────────── */

/** INVARIANT: breadcrumb current entity === centred entity === contextual-panel entity.
    The caller passes one entity object; nothing here reaches for a different one. */
function EntityView({
  entity,
  onOpenStatement,
  selectedStatement
}) {
  const column = (title, items, direction) => /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 10,
      alignContent: 'start'
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: 0,
      color: 'var(--text-muted)',
      fontSize: 11,
      fontWeight: 680,
      letterSpacing: '0.04em',
      textTransform: 'uppercase'
    }
  }, title), items.map(item => /*#__PURE__*/React.createElement("div", {
    key: item.label,
    style: {
      display: 'grid',
      gap: 5,
      padding: '11px 13px',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-default2)',
      borderRadius: 9
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      fontFamily: 'var(--font-mono)',
      fontSize: 12
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "file-code-2",
    size: 13
  }), item.label), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      color: 'var(--text-muted)',
      fontSize: 11.5
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: direction === 'in' ? 'arrow-right' : 'arrow-right',
    size: 11
  }), item.relation, " \xB7 ", item.group))));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      overflow: 'auto',
      padding: '18px 22px 112px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 12,
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-muted)',
      fontSize: 12.5
    }
  }, "in ", entity.ancestry.join('  ›  ')), /*#__PURE__*/React.createElement(ExampleNotice, null)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(180px, 1fr) minmax(240px, 1.2fr) minmax(180px, 1fr)',
      gap: 22,
      alignItems: 'start'
    }
  }, column('Depended on by', entity.dependents, 'in'), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 12,
      padding: 20,
      background: 'var(--bg-surface)',
      border: '1.5px solid var(--focus-ring)',
      borderRadius: 12,
      boxShadow: 'var(--shadow-selected)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "file-code-2",
    size: 18
  }), /*#__PURE__*/React.createElement("strong", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 16
    }
  }, entity.label)), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(ProvenanceChip, {
    kind: "structure",
    size: "sm",
    label: "Module"
  }), /*#__PURE__*/React.createElement(ProvenanceChip, {
    kind: "cluster",
    size: "sm",
    label: "Cluster 1"
  })), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      color: 'var(--text-secondary)',
      fontSize: 13,
      lineHeight: 1.55
    }
  }, entity.dependents.length === 1 ? '1 module depends on this' : entity.dependents.length + ' modules depend on this', "; it depends on ", entity.dependencies.length, ".")), column('Depends on', entity.dependencies, 'out')), /*#__PURE__*/React.createElement("section", {
    style: {
      marginTop: 30
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: '8px 12px',
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: 0,
      fontSize: 15,
      whiteSpace: 'nowrap'
    }
  }, "Architectural statements"), /*#__PURE__*/React.createElement(ProvenanceChip, {
    kind: "verified"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-muted)',
      fontSize: 12.5
    }
  }, entity.statements.length, " statements from this run")), entity.statements.length === 0 && /*#__PURE__*/React.createElement(Callout, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "info",
      size: 14
    }),
    style: {
      maxWidth: 820
    }
  }, "No architectural statements were produced for this module in this run."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 10,
      maxWidth: 820
    }
  }, entity.statements.map(s => /*#__PURE__*/React.createElement(StatementCard, {
    key: s.id,
    statement: s.statement,
    status: s.status,
    relation: s.relation,
    evidenceCount: s.evidenceCount,
    selected: selectedStatement && selectedStatement.id === s.id,
    onOpenEvidence: () => onOpenStatement(s)
  })))));
}

/* ── State 4 — Evidence + source ───────────────────────────────── */

/** INVARIANT: displayed statement === selected evidence === highlighted source.
    The chain is looked up by statement id and the source pane renders the ACTIVE item. */
function EvidenceView({
  statement,
  activeEvidence,
  onSelectEvidence
}) {
  const chain = window.LaurasData.evidenceByStatement[statement.id] || [];
  const src = chain.find(c => c.id === activeEvidence) || chain[0] || null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateRows: 'auto minmax(0, 1fr)',
      height: '100%',
      minHeight: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '16px 22px',
      borderBottom: '1px solid var(--border-subtle)'
    }
  }, /*#__PURE__*/React.createElement(StatementCard, {
    statement: statement.statement,
    status: statement.status,
    relation: statement.relation,
    evidenceCount: statement.evidenceCount,
    style: {
      maxWidth: 860
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(280px, 360px) minmax(0, 1fr)',
      minHeight: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: 0,
      overflow: 'auto',
      padding: '16px 18px',
      borderRight: '1px solid var(--border-subtle)'
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: '0 0 12px',
      color: 'var(--text-muted)',
      fontSize: 11,
      fontWeight: 680,
      letterSpacing: '0.04em',
      textTransform: 'uppercase'
    }
  }, "Evidence chain"), /*#__PURE__*/React.createElement("ol", {
    style: {
      display: 'grid',
      gap: 10,
      margin: 0,
      padding: 0,
      listStyle: 'none'
    }
  }, chain.map((item, index) => {
    const active = activeEvidence === item.id;
    return /*#__PURE__*/React.createElement("li", {
      key: item.id
    }, /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => onSelectEvidence(item.id),
      style: {
        display: 'grid',
        gap: 6,
        width: '100%',
        padding: '11px 12px',
        textAlign: 'left',
        color: 'var(--text-primary)',
        background: active ? 'var(--action-ghost-hover)' : 'var(--bg-surface)',
        border: '1px solid ' + (active ? 'var(--focus-ring)' : 'var(--border-default2)'),
        borderRadius: 9,
        cursor: 'pointer'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'inline-grid',
        placeItems: 'center',
        width: 18,
        height: 18,
        color: 'var(--text-muted)',
        border: '1px solid var(--border-default2)',
        borderRadius: 999,
        fontSize: 10.5
      }
    }, index + 1), /*#__PURE__*/React.createElement(ProvenanceChip, {
      kind: "evidence",
      size: "sm",
      label: item.kind
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        overflow: 'hidden',
        fontFamily: 'var(--font-mono)',
        fontSize: 11.5,
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }
    }, item.filePath.split('/').pop(), ":", item.highlightFrom, item.highlightTo > item.highlightFrom ? '-' + item.highlightTo : ''), /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--text-muted)',
        fontSize: 12,
        lineHeight: 1.45
      }
    }, item.reason)));
  })), statement.status === 'insufficient_evidence' && /*#__PURE__*/React.createElement(Callout, {
    style: {
      marginTop: 14
    },
    icon: /*#__PURE__*/React.createElement(StatusBadge, {
      status: "insufficient"
    })
  }, "Nothing in this run supports or contradicts this statement. It stays listed, unproven, rather than being dropped.")), src ? /*#__PURE__*/React.createElement(SourcePane, {
    src: src
  }) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      placeItems: 'center',
      padding: 40,
      background: 'var(--bg-code)'
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      maxWidth: 340,
      color: 'var(--text-oncode-dim)',
      fontSize: 13,
      lineHeight: 1.6,
      textAlign: 'center'
    }
  }, "No source is shown because no evidence was found for this statement."))));
}
function SourcePane({
  src
}) {
  const counter = src.kind === 'counter-evidence';
  const edge = counter ? 'var(--evidence-counter-highlight-edge)' : 'var(--evidence-highlight-edge)';
  const band = counter ? 'var(--evidence-counter-highlight)' : 'var(--evidence-highlight)';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateRows: 'auto minmax(0,1fr)',
      gridTemplateColumns: 'minmax(0,1fr)',
      minWidth: 0,
      minHeight: 0,
      background: 'var(--bg-code)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      minWidth: 0,
      padding: '10px 16px',
      background: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border-default2)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "file-code-2",
    size: 15
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: '0 1 auto',
      minWidth: 0,
      overflow: 'hidden',
      fontFamily: 'var(--font-mono)',
      fontSize: 12.5,
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, src.path || src.filePath), /*#__PURE__*/React.createElement(Chip, {
    tone: "fact",
    style: {
      flex: 'none',
      fontFamily: 'var(--font-mono)'
    }
  }, src.highlightFrom === src.highlightTo ? 'line ' + src.highlightFrom : 'lines ' + src.highlightFrom + '–' + src.highlightTo), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      marginLeft: 'auto',
      color: 'var(--text-muted)',
      fontSize: 12,
      whiteSpace: 'nowrap',
      flex: 'none'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 'none',
      width: 12,
      height: 12,
      background: band,
      borderLeft: '2px solid ' + edge
    }
  }), counter ? 'counter-evidence' : 'supporting lines')), /*#__PURE__*/React.createElement("pre", {
    style: {
      margin: 0,
      minWidth: 0,
      minHeight: 0,
      overflow: 'auto',
      padding: '14px 0',
      color: 'var(--text-oncode)',
      fontFamily: 'var(--font-mono)',
      fontSize: 12.5,
      lineHeight: 1.7
    }
  }, src.lines.map((line, index) => {
    const number = src.startLine + index;
    const hot = number >= src.highlightFrom && number <= src.highlightTo;
    return /*#__PURE__*/React.createElement("div", {
      key: number,
      style: {
        display: 'grid',
        gridTemplateColumns: '58px minmax(0,1fr)',
        gap: 12,
        padding: '0 16px',
        background: hot ? band : 'transparent',
        boxShadow: hot ? 'inset 3px 0 0 ' + edge : 'none'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--text-oncode-dim)',
        textAlign: 'right'
      }
    }, number), /*#__PURE__*/React.createElement("span", {
      style: {
        whiteSpace: 'pre-wrap'
      }
    }, line || ' '));
  })));
}
Object.assign(window, {
  UngroupedBucket,
  Overview,
  GroupView,
  EntityView,
  EvidenceView,
  SourcePane,
  CollapsedRegion
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/lauras-redesign/Explorer.jsx", error: String((e && e.message) || e) }); }

// ui_kits/lauras-redesign/Landing.jsx
try { (() => {
const {
  Icon,
  Button,
  ThemeToggle,
  ProvenanceChip,
  StageRow,
  ProgressMeter
} = window.SyntaxTreeDesignSystem_b1a4e9;
function Landing({
  theme,
  onTheme,
  onOpenSettings,
  onAnalyse,
  analysing,
  stages,
  progress
}) {
  const data = window.LaurasData;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: '100%',
      background: 'var(--bg-app)',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("header", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      height: 56,
      padding: '0 28px'
    }
  }, /*#__PURE__*/React.createElement(Wordmark, {
    size: 16
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginLeft: 'auto'
    }
  }, /*#__PURE__*/React.createElement(ThemeToggle, {
    value: theme,
    onChange: onTheme
  }), /*#__PURE__*/React.createElement(Button, {
    variant: "pill",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "settings",
      size: 14
    }),
    onClick: onOpenSettings
  }, "Settings"))), /*#__PURE__*/React.createElement("main", {
    style: {
      width: 'min(1080px, calc(100% - 56px))',
      margin: '0 auto',
      padding: '56px 0 72px'
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      maxWidth: 760,
      fontSize: 'clamp(40px, 4.6vw, 60px)',
      lineHeight: 1.0,
      fontWeight: 720,
      letterSpacing: '-0.015em'
    }
  }, "Understand an unfamiliar codebase."), /*#__PURE__*/React.createElement("p", {
    style: {
      maxWidth: 620,
      margin: '20px 0 0',
      color: 'var(--text-secondary)',
      fontSize: 17,
      lineHeight: 1.65
    }
  }, "Laura\u2019s reads a repository on your machine, maps how it is put together, and keeps every architectural statement attached to the exact source that supports it."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 16,
      marginTop: 32
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "lg",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "folder-open",
      size: 17
    }),
    onClick: onAnalyse,
    disabled: analysing
  }, analysing ? 'Analysing…' : 'Browse repository'), /*#__PURE__*/React.createElement("span", {
    style: {
      maxWidth: 340,
      color: 'var(--text-muted)',
      fontSize: 13,
      lineHeight: 1.5
    }
  }, "Source analysis runs entirely without AI. A model is optional, and only ever adds interpretation on top.")), !analysing && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("section", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, minmax(0,1fr))',
      gap: 16,
      marginTop: 52
    }
  }, [['network', 'Architecture', 'See the regions a repository is actually made of, and what contains what.'], ['waypoints', 'Explore', 'Drill from a region into a cluster, into a module, into a single function.'], ['shield-check', 'Verify', 'Follow any architectural statement to the file and lines behind it.']].map(([icon, title, text]) => /*#__PURE__*/React.createElement("div", {
    key: title,
    style: {
      padding: 18,
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-default2)',
      borderRadius: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      color: 'var(--action-primary)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: 18
  })), /*#__PURE__*/React.createElement("strong", {
    style: {
      display: 'block',
      margin: '12px 0 6px',
      fontSize: 15
    }
  }, title), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-secondary)',
      fontSize: 13,
      lineHeight: 1.55
    }
  }, text)))), /*#__PURE__*/React.createElement("section", {
    style: {
      marginTop: 44
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: '0 0 12px',
      color: 'var(--text-muted)',
      fontSize: 11,
      fontWeight: 680,
      letterSpacing: '0.04em',
      textTransform: 'uppercase'
    }
  }, "Recent projects"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 8,
      maxWidth: 640
    }
  }, data.recent.map(r => /*#__PURE__*/React.createElement("button", {
    key: r.path,
    type: "button",
    onClick: onAnalyse,
    style: {
      display: 'grid',
      gridTemplateColumns: 'auto minmax(0,1fr) auto',
      gap: 12,
      alignItems: 'center',
      padding: '12px 14px',
      color: 'var(--text-primary)',
      textAlign: 'left',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-default2)',
      borderRadius: 10,
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "folder-open",
    size: 15
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("strong", {
    style: {
      display: 'block',
      fontSize: 14
    }
  }, r.name), /*#__PURE__*/React.createElement("small", {
    style: {
      color: 'var(--text-muted)',
      fontFamily: 'var(--font-mono)',
      fontSize: 11.5
    }
  }, r.path)), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-muted)',
      fontSize: 12
    }
  }, r.meta))))), /*#__PURE__*/React.createElement("section", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 20,
      marginTop: 44,
      paddingTop: 22,
      borderTop: '1px solid var(--border-subtle)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 260,
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement(ProvenanceChip, {
    kind: "structure"
  }), /*#__PURE__*/React.createElement(ProvenanceChip, {
    kind: "cluster"
  }), /*#__PURE__*/React.createElement(ProvenanceChip, {
    kind: "verified"
  })), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      color: 'var(--text-muted)',
      fontSize: 13,
      lineHeight: 1.55
    }
  }, "Always available. Structure, clustering and evidence verification are deterministic and never call a model.")), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 260,
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement(ProvenanceChip, {
    kind: "ai"
  })), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      color: 'var(--text-muted)',
      fontSize: 13,
      lineHeight: 1.55
    }
  }, "Optional, and always something you ask for. A model can name a group and explain an entity; it never changes what the analysis found.")))), analysing && /*#__PURE__*/React.createElement("section", {
    style: {
      maxWidth: 720,
      marginTop: 44,
      padding: 22,
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-default2)',
      borderRadius: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      fontSize: 18
    }
  }, "Analysing ", data.repo.name), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '5px 0 0',
      color: 'var(--text-muted)',
      fontFamily: 'var(--font-mono)',
      fontSize: 12
    }
  }, data.repo.path)), /*#__PURE__*/React.createElement(ExampleNotice, null)), /*#__PURE__*/React.createElement(ProgressMeter, {
    style: {
      marginTop: 20
    },
    label: "Files read",
    value: progress,
    total: 51,
    caption: "backend/src/services/notification.service.js"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 8,
      marginTop: 18
    }
  }, stages.map(s => /*#__PURE__*/React.createElement(StageRow, {
    key: s.label,
    state: s.state,
    label: s.label
  }))), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '18px 0 0',
      color: 'var(--text-muted)',
      fontSize: 13,
      lineHeight: 1.5
    }
  }, "The architecture opens as soon as structure is grouped. Verification continues in the background and statements appear as they are checked."))));
}
Object.assign(window, {
  Landing
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/lauras-redesign/Landing.jsx", error: String((e && e.message) || e) }); }

// ui_kits/lauras-redesign/Settings.jsx
try { (() => {
const {
  Icon,
  Button,
  Chip,
  Callout,
  ThemeToggle,
  ProvenanceChip,
  SegmentedControl,
  TextInput,
  StatusBadge
} = window.SyntaxTreeDesignSystem_b1a4e9;
function SurfaceRow({
  on,
  title,
  detail,
  pending
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '20px minmax(0,1fr)',
      gap: 11,
      padding: '11px 0',
      borderBottom: '1px solid var(--border-subtle)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      paddingTop: 1,
      color: on ? 'var(--ai-accent)' : 'var(--text-muted)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: on ? 'sparkles' : 'circle-dot',
    size: 15
  })), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("strong", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      fontSize: 13.5
    }
  }, title, pending && /*#__PURE__*/React.createElement(Chip, {
    tone: "fact",
    style: {
      height: 20,
      fontSize: 10.5
    }
  }, "not implemented yet")), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      marginTop: 3,
      color: 'var(--text-muted)',
      fontSize: 12.5,
      lineHeight: 1.5
    }
  }, detail)));
}
function SettingsView({
  theme,
  onTheme
}) {
  const [provider, setProvider] = React.useState('openai');
  const configured = provider !== 'none';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      overflow: 'auto',
      background: 'var(--bg-app)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 'min(860px, calc(100% - 48px))',
      margin: '0 auto',
      padding: '32px 0 64px'
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: '0 0 6px',
      fontSize: 26
    }
  }, "Settings"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      color: 'var(--text-muted)',
      fontSize: 14
    }
  }, "What AI touches, what it never touches, and how Laura\u2019s looks."), /*#__PURE__*/React.createElement("section", {
    style: {
      marginTop: 28,
      padding: 20,
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-default2)',
      borderRadius: 12
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      margin: '0 0 4px',
      fontSize: 17
    }
  }, "Appearance"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '0 0 16px',
      color: 'var(--text-muted)',
      fontSize: 13
    }
  }, "System follows your operating system and keeps following it. An explicit choice is remembered across sessions."), /*#__PURE__*/React.createElement(ThemeToggle, {
    value: theme,
    onChange: onTheme,
    variant: "full"
  })), /*#__PURE__*/React.createElement("section", {
    style: {
      marginTop: 20,
      padding: 20,
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-default2)',
      borderRadius: 12
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      margin: '0 0 4px',
      fontSize: 17
    }
  }, "AI ", /*#__PURE__*/React.createElement(ProvenanceChip, {
    kind: "ai"
  })), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '0 0 18px',
      color: 'var(--text-muted)',
      fontSize: 13,
      lineHeight: 1.55,
      maxWidth: 620
    }
  }, "Laura\u2019s analyses a repository completely without AI. Configuring a provider adds interpretation on the three surfaces listed below \u2014 nothing else changes."), /*#__PURE__*/React.createElement(SegmentedControl, {
    label: "Provider",
    value: provider,
    onChange: setProvider,
    options: [{
      value: 'none',
      label: 'None'
    }, {
      value: 'openai',
      label: 'OpenAI'
    }, {
      value: 'openrouter',
      label: 'OpenRouter'
    }]
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '10px 0 0',
      color: 'var(--text-muted)',
      fontSize: 12.5,
      lineHeight: 1.55,
      maxWidth: 620
    }
  }, "One provider, one key, one place. Every AI surface in Laura\u2019s \u2014 including Doc Studio \u2014 uses what is set here."), configured && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 8,
      maxWidth: 420,
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-muted)',
      fontSize: 11,
      fontWeight: 680,
      letterSpacing: '0.04em',
      textTransform: 'uppercase'
    }
  }, "Model"), /*#__PURE__*/React.createElement(TextInput, {
    placeholder: "leave empty to use the deployment default"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
      gap: 24,
      marginTop: 24
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      margin: '0 0 4px',
      fontSize: 13,
      color: 'var(--ai-text)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "sparkles",
    size: 14
  }), "AI is used for"), /*#__PURE__*/React.createElement(SurfaceRow, {
    on: true,
    title: "Architectural explanation",
    detail: "Per entity, when you open one. The statements it proposes are still verified deterministically."
  }), /*#__PURE__*/React.createElement(SurfaceRow, {
    on: true,
    title: "Architecture group interpretation",
    detail: "An optional name and description for a cluster whose membership is already fixed. Generated only when you click Generate.",
    pending: true
  }), /*#__PURE__*/React.createElement(SurfaceRow, {
    on: true,
    title: "Doc Studio AI content",
    detail: "Written passages in an exported document. Deterministic sections export with no provider configured.",
    pending: true
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      margin: '0 0 4px',
      fontSize: 13,
      color: 'var(--text-secondary)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "shield-check",
    size: 14
  }), "Always deterministic"), /*#__PURE__*/React.createElement(SurfaceRow, {
    title: "Source analysis and symbol extraction",
    detail: "Parsing the repository into modules, classes and functions."
  }), /*#__PURE__*/React.createElement(SurfaceRow, {
    title: "Relation extraction",
    detail: "Imports, calls and inheritance, recovered from source."
  }), /*#__PURE__*/React.createElement(SurfaceRow, {
    title: "Structural grouping and clustering",
    detail: "Which modules belong together. A model never changes membership."
  }), /*#__PURE__*/React.createElement(SurfaceRow, {
    title: "Evidence verification",
    detail: "SUPPORTED / INSUFFICIENT EVIDENCE / CONTRADICTED are produced by the verifier, never by a model."
  }))), /*#__PURE__*/React.createElement(Callout, {
    style: {
      marginTop: 20
    },
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "info",
      size: 15
    })
  }, "With no provider selected, Laura\u2019s still analyses, clusters and verifies in full. Only the three interpretive surfaces above are unavailable.")), /*#__PURE__*/React.createElement("section", {
    style: {
      marginTop: 20,
      padding: 20,
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-default2)',
      borderRadius: 12
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: '0 0 4px',
      fontSize: 17
    }
  }, "Technical details"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '0 0 14px',
      color: 'var(--text-muted)',
      fontSize: 13
    }
  }, "Run identifiers, projection versions and pipeline diagnostics. Hidden from the main product surfaces."), /*#__PURE__*/React.createElement("details", null, /*#__PURE__*/React.createElement("summary", {
    style: {
      cursor: 'pointer',
      color: 'var(--action-primary)',
      fontSize: 13
    }
  }, "Show diagnostics for the current run"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 6,
      marginTop: 12,
      color: 'var(--text-muted)',
      fontFamily: 'var(--font-mono)',
      fontSize: 11.5
    }
  }, /*#__PURE__*/React.createElement("span", null, "run:1f7f34f034dc4674a8f395f29adb58ee"), /*#__PURE__*/React.createElement("span", null, "projection: system-overview-architecture-map-v3"), /*#__PURE__*/React.createElement("span", null, "overview_input_hash: 8c41\u2026f0d2"), /*#__PURE__*/React.createElement("span", null, "ai provider: openai \xB7 model: deployment default"))))));
}
function DocStudioView() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      overflow: 'auto',
      background: 'var(--bg-app)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 'min(860px, calc(100% - 48px))',
      margin: '0 auto',
      padding: '32px 0 64px'
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: '0 0 6px',
      fontSize: 26
    }
  }, "Doc Studio"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '0 0 24px',
      color: 'var(--text-muted)',
      fontSize: 14,
      maxWidth: 620,
      lineHeight: 1.6
    }
  }, "Assemble a document from what you have already explored. Each section keeps the provenance it had in the product \u2014 nothing is flattened into undifferentiated prose."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 12,
      maxWidth: 640
    }
  }, [['structure', 'Repository structure', 'Regions, sections and module counts. Deterministic.'], ['cluster', 'Structural clusters', 'Cluster membership and the relations that justify it. Deterministic.'], ['verified', 'Verified statements', 'Each statement exported with its own verdict and evidence links.'], ['ai', 'AI-interpreted architecture (unverified)', 'Only the interpretations you generated, under their own heading.']].map(([kind, title, detail]) => /*#__PURE__*/React.createElement("label", {
    key: title,
    style: {
      display: 'grid',
      gridTemplateColumns: 'auto minmax(0,1fr) auto',
      gap: 12,
      alignItems: 'center',
      padding: '14px 16px',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-default2)',
      borderRadius: 10,
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    defaultChecked: kind !== 'ai',
    style: {
      accentColor: 'var(--action-primary)'
    }
  }), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("strong", {
    style: {
      display: 'block',
      fontSize: 14
    }
  }, title), /*#__PURE__*/React.createElement("small", {
    style: {
      color: 'var(--text-muted)',
      fontSize: 12.5
    }
  }, detail)), /*#__PURE__*/React.createElement(ProvenanceChip, {
    kind: kind,
    size: "sm"
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 14,
      marginTop: 20
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "arrow-down-to-line",
      size: 15
    })
  }, "Export document"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 7,
      color: 'var(--text-muted)',
      fontSize: 12.5
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      color: 'var(--ai-accent)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "sparkles",
    size: 13
  })), "AI sections use the provider set in Settings \u203A AI. No separate configuration."))));
}
Object.assign(window, {
  SettingsView,
  DocStudioView,
  SurfaceRow
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/lauras-redesign/Settings.jsx", error: String((e && e.message) || e) }); }

// ui_kits/lauras-redesign/Shell.jsx
try { (() => {
const {
  Icon,
  Button,
  IconButton,
  ThemeToggle,
  ProvenanceChip
} = window.SyntaxTreeDesignSystem_b1a4e9;
const DESTINATIONS = [{
  id: 'projects',
  label: 'Projects',
  icon: 'folder-open'
}, {
  id: 'architecture',
  label: 'Architecture',
  icon: 'network'
}, {
  id: 'docs',
  label: 'Doc Studio',
  icon: 'book-open'
}, {
  id: 'settings',
  label: 'Settings',
  icon: 'settings'
}];
function Wordmark({
  size = 15
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      fontSize: size,
      fontWeight: 650,
      letterSpacing: '-0.005em',
      color: 'var(--text-primary)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      color: 'var(--action-primary)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "git-branch",
    size: size + 3
  })), "Laura\u2019s");
}
function TopNav({
  destination,
  onNavigate,
  theme,
  onTheme,
  right,
  compact = false
}) {
  return /*#__PURE__*/React.createElement("header", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: compact ? 12 : 20,
      height: 52,
      padding: '0 18px',
      minWidth: 0,
      background: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border-default2)'
    }
  }, /*#__PURE__*/React.createElement(Wordmark, null), /*#__PURE__*/React.createElement("nav", {
    "aria-label": "Global",
    style: {
      display: 'flex',
      flex: 'none',
      gap: 2
    }
  }, DESTINATIONS.map(d => {
    const active = d.id === destination;
    return /*#__PURE__*/React.createElement("button", {
      key: d.id,
      type: "button",
      onClick: () => onNavigate(d.id),
      "aria-current": active ? 'page' : undefined,
      "aria-label": compact ? d.label : undefined,
      title: compact ? d.label : undefined,
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        height: 32,
        width: compact ? 34 : undefined,
        padding: compact ? 0 : '0 11px',
        color: active ? 'var(--text-primary)' : 'var(--text-muted)',
        background: active ? 'var(--bg-sunken)' : 'transparent',
        border: '1px solid ' + (active ? 'var(--border-default2)' : 'transparent'),
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        fontSize: 13,
        whiteSpace: 'nowrap'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: d.icon,
      size: 14
    }), !compact && d.label);
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flex: '0 1 auto',
      alignItems: 'center',
      gap: 12,
      minWidth: 0,
      marginLeft: 'auto'
    }
  }, !compact && /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0,
      overflow: 'hidden'
    }
  }, right), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 'none'
    }
  }, /*#__PURE__*/React.createElement(ThemeToggle, {
    value: theme,
    onChange: onTheme
  }))));
}

/** One Back, one breadcrumb, one meaning: pop exactly one level. */
function NavBar({
  crumbs,
  onCrumb,
  onBack,
  right,
  compact = false
}) {
  const canBack = crumbs.length > 1;
  const offset = compact && crumbs.length > 2 ? crumbs.length - 2 : 0;
  const shown = crumbs.slice(offset);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      height: 44,
      padding: '0 18px',
      background: 'var(--bg-app)',
      borderBottom: '1px solid var(--border-subtle)'
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onBack,
    disabled: !canBack,
    "aria-label": "Back one level",
    style: {
      display: 'inline-flex',
      flex: 'none',
      alignItems: 'center',
      gap: 6,
      height: 28,
      padding: '0 10px',
      color: canBack ? 'var(--text-primary)' : 'var(--text-muted)',
      background: 'transparent',
      border: '1px solid var(--border-default2)',
      borderRadius: 'var(--radius-md)',
      cursor: canBack ? 'pointer' : 'not-allowed',
      opacity: canBack ? 1 : 0.45,
      fontSize: 13,
      whiteSpace: 'nowrap'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-left",
    size: 14
  }), "Back"), /*#__PURE__*/React.createElement("nav", {
    "aria-label": "Architecture trail",
    style: {
      display: 'flex',
      flex: '1 1 auto',
      alignItems: 'center',
      gap: 4,
      minWidth: 0,
      fontSize: 13
    }
  }, offset > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      flex: 'none',
      color: 'var(--text-muted)'
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => onCrumb(0),
    title: "Overview",
    style: {
      padding: 0,
      color: 'inherit',
      background: 'transparent',
      border: 0,
      cursor: 'pointer',
      fontSize: 13
    }
  }, "\u2026"), /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-right",
    size: 13
  })), shown.map((crumb, i) => {
    const index = i + offset;
    const last = index === crumbs.length - 1;
    return /*#__PURE__*/React.createElement("span", {
      key: crumb.id,
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        minWidth: 0,
        flex: last ? '0 1 auto' : '0 0 auto'
      }
    }, last ? /*#__PURE__*/React.createElement("span", {
      "aria-current": "location",
      style: {
        color: 'var(--text-primary)',
        fontWeight: 600,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        maxWidth: 260
      }
    }, crumb.label) : /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => onCrumb(index),
      style: {
        maxWidth: 200,
        overflow: 'hidden',
        padding: 0,
        color: 'var(--text-muted)',
        background: 'transparent',
        border: 0,
        cursor: 'pointer',
        fontSize: 13,
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }
    }, crumb.label), !last && /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--text-muted)',
        display: 'inline-flex'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "chevron-right",
      size: 13
    })));
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flex: 'none',
      alignItems: 'center',
      gap: 8,
      marginLeft: 'auto',
      whiteSpace: 'nowrap'
    }
  }, right));
}

/** Compact, keyboard-reachable canvas controls. 36px tall, docked, not a bar across the bottom. */
function CanvasControls({
  view,
  onView,
  onZoom,
  onFit
}) {
  const button = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    width: 30,
    height: 30,
    color: 'var(--text-primary)',
    background: 'transparent',
    border: 0,
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer'
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      right: 16,
      bottom: 16,
      zIndex: 5,
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      padding: 3,
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-default2)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-chrome)'
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    style: button,
    "aria-label": "Zoom out",
    onClick: () => onZoom(-1)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "minus",
    size: 15
  })), /*#__PURE__*/React.createElement("button", {
    type: "button",
    style: button,
    "aria-label": "Zoom in",
    onClick: () => onZoom(1)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 15
  })), /*#__PURE__*/React.createElement("button", {
    type: "button",
    style: button,
    "aria-label": "Fit to view",
    onClick: onFit
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "maximize",
    size: 15
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 1,
      height: 18,
      background: 'var(--border-default2)',
      margin: '0 3px'
    }
  }), /*#__PURE__*/React.createElement("div", {
    role: "radiogroup",
    "aria-label": "Architecture view",
    style: {
      display: 'flex',
      gap: 2
    }
  }, [['map', 'network', 'Map'], ['outline', 'list-tree', 'Outline']].map(([id, icon, label]) => {
    const on = view === id;
    return /*#__PURE__*/React.createElement("button", {
      key: id,
      type: "button",
      role: "radio",
      "aria-checked": on,
      onClick: () => onView(id),
      style: {
        ...button,
        width: 'auto',
        padding: '0 10px',
        fontSize: 12.5,
        fontWeight: on ? 620 : 400,
        color: on ? 'var(--text-primary)' : 'var(--text-muted)',
        background: on ? 'var(--bg-sunken)' : 'transparent',
        border: '1px solid ' + (on ? 'var(--border-default2)' : 'transparent')
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: icon,
      size: 15
    }), label);
  })));
}

/** State-aware right panel frame. */
function ContextPanel({
  eyebrow,
  title,
  chip,
  children,
  footer,
  width = 348
}) {
  return /*#__PURE__*/React.createElement("aside", {
    "aria-label": title,
    style: {
      display: 'flex',
      flexDirection: 'column',
      width,
      minWidth: 0,
      background: 'var(--bg-surface)',
      borderLeft: '1px solid var(--border-default2)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '16px 18px',
      borderBottom: '1px solid var(--border-subtle)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginBottom: 7
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-muted)',
      fontSize: 11,
      fontWeight: 680,
      letterSpacing: '0.04em',
      textTransform: 'uppercase'
    }
  }, eyebrow), chip), /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      fontSize: 17,
      lineHeight: 1.25,
      overflowWrap: 'anywhere'
    }
  }, title)), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minHeight: 0,
      overflow: 'auto',
      padding: 18
    }
  }, children), footer && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 18px',
      borderTop: '1px solid var(--border-subtle)'
    }
  }, footer));
}
function PanelSection({
  title,
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("section", {
    style: {
      marginBottom: 22,
      ...style
    }
  }, title && /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: '0 0 10px',
      color: 'var(--text-muted)',
      fontSize: 11,
      fontWeight: 680,
      letterSpacing: '0.04em',
      textTransform: 'uppercase'
    }
  }, title), children);
}
function FactRow({
  label,
  value
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: 12,
      padding: '7px 0',
      borderBottom: '1px solid var(--border-subtle)',
      fontSize: 13
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-muted)'
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-primary)',
      textAlign: 'right'
    }
  }, value));
}
function ExampleNotice() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 7,
      padding: '4px 11px',
      color: 'var(--text-muted)',
      background: 'var(--bg-sunken)',
      border: '1px dashed var(--border-default2)',
      borderRadius: 999,
      fontSize: 11,
      lineHeight: 1.4,
      whiteSpace: 'nowrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      flex: 'none'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "info",
    size: 12
  })), "Design example");
}
Object.assign(window, {
  Wordmark,
  TopNav,
  NavBar,
  CanvasControls,
  ContextPanel,
  PanelSection,
  FactRow,
  ExampleNotice,
  DESTINATIONS
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/lauras-redesign/Shell.jsx", error: String((e && e.message) || e) }); }

// ui_kits/lauras-redesign/data.js
try { (() => {
/* Illustrative content for the design review.
   Structure and cluster figures are taken from the repository's own
   deterministic-capability exercise on topic-similarity-mvp
   (qa-audit/post-p2-architecture-gap-diagnosis/DETERMINISTIC_CAPABILITY.md).
   Statement, evidence and source text are DESIGN EXAMPLES, labelled as such
   in the UI — they are not recovered facts about that repository. */
window.LaurasData = {
  repo: {
    name: 'topic-similarity-mvp',
    path: '~/code/topic-similarity-mvp',
    modules: 51,
    regions: 1,
    sections: 6,
    clusters: 5,
    analysedAt: 'analysed 6 minutes ago'
  },
  recent: [{
    name: 'topic-similarity-mvp',
    path: '~/code/topic-similarity-mvp',
    meta: '51 modules · 6 minutes ago'
  }, {
    name: 'flask',
    path: '~/code/flask',
    meta: '267 modules · yesterday'
  }],
  stages: [{
    state: 'done',
    label: 'Reading source files'
  }, {
    state: 'done',
    label: 'Extracting symbols'
  }, {
    state: 'current',
    label: 'Recovering imports, calls and inheritance'
  }, {
    state: 'waiting',
    label: 'Grouping by structure'
  }, {
    state: 'waiting',
    label: 'Verifying architectural statements'
  }],
  regions: [{
    id: 'root',
    path: 'Repository root files',
    modules: 2,
    members: ['server.js', 'server.test.js']
  }, {
    id: 'config',
    path: 'backend/src/config',
    modules: 7,
    members: ['db.config.js', 'mail.config.js', 'queue.config.js', 'auth.config.js', 'app.config.js']
  }, {
    id: 'controllers',
    path: 'backend/src/controllers',
    modules: 31,
    members: ['auth.controller.js', 'submission.controller.js', 'admin.controller.js', 'report.controller.js', 'user.controller.js']
  }, {
    id: 'middleware',
    path: 'backend/src/middleware',
    modules: 2,
    members: ['auth.middleware.js', 'error.middleware.js']
  }, {
    id: 'services',
    path: 'backend/src/services',
    modules: 50,
    clustered: true
  }, {
    id: 'utils',
    path: 'backend/src/utils',
    modules: 5,
    members: ['logger.js', 'hash.js', 'dates.js', 'ids.js', 'validate.js']
  }],
  clusters: [{
    id: 'c1',
    label: 'Structural cluster 1',
    modules: 5,
    relations: 6,
    members: ['auth.service.js', 'email.service.js', 'notification.service.js', 'notificationEvent.service.js', 'submission.service.js'],
    ai: {
      name: 'Authentication & Sessions',
      description: 'Handles credential checks, token validation and the notifications sent when a session or submission changes state.'
    },
    basis: [['auth.service.js', 'imports', 'email.service.js'], ['auth.service.js', 'imports', 'notification.service.js'], ['notification.service.js', 'calls', 'notificationEvent.service.js'], ['submission.service.js', 'imports', 'notification.service.js']]
  }, {
    id: 'c2',
    label: 'Structural cluster 2',
    modules: 4,
    relations: 4,
    members: ['adminReportExport.service.js', 'adminUser.service.js', 'auditLog.service.js', 'superviseeAssignment.service.js'],
    basis: [['adminUser.service.js', 'imports', 'auditLog.service.js'], ['adminReportExport.service.js', 'imports', 'auditLog.service.js']]
  }, {
    id: 'c3',
    label: 'Structural cluster 3',
    modules: 2,
    relations: 1,
    members: ['topic.service.js', 'similarity.service.js'],
    basis: [['topic.service.js', 'imports', 'similarity.service.js']]
  }, {
    id: 'c4',
    label: 'Structural cluster 4',
    modules: 2,
    relations: 1,
    members: ['queue.service.js', 'worker.service.js'],
    basis: [['worker.service.js', 'imports', 'queue.service.js']]
  }, {
    id: 'c5',
    label: 'Structural cluster 5',
    modules: 2,
    relations: 1,
    members: ['upload.service.js', 'storage.service.js'],
    basis: [['upload.service.js', 'imports', 'storage.service.js']]
  }],
  residual: {
    modules: 24,
    members: ['contextSimilarity.service.js', 'readiness.service.js', 'cohort.service.js', 'feedback.service.js', 'export.service.js']
  },
  entity: {
    id: 'auth.service.js',
    label: 'auth.service.js',
    kind: 'module',
    ancestry: ['backend/src/services', 'Structural cluster 1'],
    dependents: [{
      label: 'auth.controller.js',
      relation: 'imports',
      group: 'src/controllers'
    }, {
      label: 'auth.middleware.js',
      relation: 'imports',
      group: 'src/middleware'
    }],
    dependencies: [{
      label: 'email.service.js',
      relation: 'imports',
      group: 'Structural cluster 1'
    }, {
      label: 'notification.service.js',
      relation: 'imports',
      group: 'Structural cluster 1'
    }, {
      label: 'auth.config.js',
      relation: 'imports',
      group: 'src/config'
    }],
    statements: [{
      id: 's1',
      statement: 'auth.service.js calls notification.service.js when a session is created',
      status: 'supported',
      relation: 'calls · direct_relation',
      evidenceCount: 3
    }, {
      id: 's2',
      statement: 'auth.service.js imports token verification from auth.config.js',
      status: 'supported',
      relation: 'imports · direct_relation',
      evidenceCount: 2
    }, {
      id: 's3',
      statement: 'auth.service.js is reachable from the public HTTP surface',
      status: 'insufficient_evidence',
      relation: 'reachability',
      evidenceCount: 0
    }, {
      id: 's4',
      statement: 'auth.service.js writes directly to the audit log',
      status: 'contradicted',
      relation: 'calls · direct_relation',
      evidenceCount: 1
    }]
  },
  /* Evidence is per-statement. INVARIANT: displayed statement = selected evidence = highlighted source.
     Each evidence item carries its own source window and highlight range; the source pane renders
     the ACTIVE evidence item, never a fixed excerpt. */
  evidenceByStatement: {
    s1: [{
      id: 's1e1',
      kind: 'call site',
      reason: 'js_call_extractor@0.4.1 observed the call',
      filePath: 'backend/src/services/auth.service.js',
      startLine: 112,
      highlightFrom: 119,
      highlightTo: 124,
      lines: ['const { verifyToken } = require("../config/auth.config");', 'const notification = require("./notification.service");', '', 'async function createSession(user, context) {', '  const token = await issueToken(user);', '  await sessionRepo.save({ userId: user.id, token });', '', '  // notify the user that a new session was opened', '  await notification.send({', '    to: user.email,', '    template: "session.created",', '    context: { device: context.device },', '  });', '', '  return token;', '}']
    }, {
      id: 's1e2',
      kind: 'definition',
      reason: 'Resolved definition of the called export',
      filePath: 'backend/src/services/notification.service.js',
      startLine: 40,
      highlightFrom: 43,
      highlightTo: 49,
      lines: ['const mailer = require("./email.service");', 'const events = require("./notificationEvent.service");', '', 'async function send({ to, template, context }) {', '  const body = render(template, context);', '  await mailer.deliver({ to, body });', '  await events.record({ to, template });', '  return true;', '}', '', 'module.exports = { send };']
    }, {
      id: 's1e3',
      kind: 'import',
      reason: 'Import statement that binds the called module',
      filePath: 'backend/src/services/auth.service.js',
      startLine: 111,
      highlightFrom: 113,
      highlightTo: 113,
      lines: ['"use strict";', '', 'const { verifyToken } = require("../config/auth.config");', 'const notification = require("./notification.service");']
    }],
    s2: [{
      id: 's2e1',
      kind: 'import',
      reason: 'js_import_extractor@0.4.1 resolved this require to backend/src/config/auth.config.js',
      filePath: 'backend/src/services/auth.service.js',
      startLine: 110,
      highlightFrom: 112,
      highlightTo: 112,
      lines: ['"use strict";', '', 'const { verifyToken } = require("../config/auth.config");', 'const notification = require("./notification.service");', '', 'async function createSession(user, context) {']
    }, {
      id: 's2e2',
      kind: 'definition',
      reason: 'Resolved definition of the imported binding verifyToken',
      filePath: 'backend/src/config/auth.config.js',
      startLine: 28,
      highlightFrom: 31,
      highlightTo: 36,
      lines: ['const jwt = require("jsonwebtoken");', '', 'const secret = process.env.AUTH_SECRET;', '', 'function verifyToken(token) {', '  return jwt.verify(token, secret);', '}', '', 'module.exports = { verifyToken, secret };']
    }],
    s3: [],
    s4: [{
      id: 's4e1',
      kind: 'counter-evidence',
      reason: 'No call to auditLog.service.js resolves from this module; the write happens in adminUser.service.js',
      filePath: 'backend/src/services/adminUser.service.js',
      startLine: 60,
      highlightFrom: 63,
      highlightTo: 66,
      lines: ['const auditLog = require("./auditLog.service");', '', 'async function deactivate(userId, actor) {', '  await userRepo.deactivate(userId);', '  await auditLog.write({ actor, action: "user.deactivate", userId });', '  return true;', '}']
    }]
  }
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/lauras-redesign/data.js", error: String((e && e.message) || e) }); }

// ui_kits/lauras-redesign/theme.js
try { (() => {
window.LaurasTheme = function () {
  const KEY = 'lauras-theme-preference';
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  function resolve(preference) {
    if (preference === 'system') return media.matches ? 'dark' : 'light';
    return preference;
  }
  function apply(preference) {
    document.documentElement.setAttribute('data-theme', resolve(preference));
  }
  function read() {
    try {
      return localStorage.getItem(KEY) || 'system';
    } catch (e) {
      return 'system';
    }
  }
  function write(preference) {
    try {
      localStorage.setItem(KEY, preference);
    } catch (e) {/* preview sandbox */}
    apply(preference);
  }
  apply(read());
  media.addEventListener('change', () => {
    if (read() === 'system') apply('system');
  });
  return {
    read,
    write,
    apply,
    resolve
  };
}();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/lauras-redesign/theme.js", error: String((e && e.message) || e) }); }

// ui_kits/syntax-tree/EntryScreen.jsx
try { (() => {
const {
  Panel,
  Button,
  IconButton,
  Icon,
  Chip,
  PathInput,
  TextInput,
  SegmentedControl,
  CheckField,
  PromiseCard,
  StageRow,
  ProgressMeter,
  Callout,
  StatusBadge
} = window.SyntaxTreeDesignSystem_b1a4e9;
const label = {
  display: 'block',
  marginBottom: 8,
  color: 'var(--obs-stone)',
  fontSize: 11,
  fontWeight: 680,
  letterSpacing: '0.04em',
  textTransform: 'uppercase'
};
function OrientationPanel({
  orientation,
  compact
}) {
  return /*#__PURE__*/React.createElement("section", {
    "aria-label": "Repository orientation",
    style: {
      marginTop: compact ? 0 : 18,
      padding: 16,
      border: '1px solid var(--obs-border)',
      borderRadius: 8,
      background: 'rgba(255,255,255,0.86)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Chip, {
    tone: "fact",
    style: {
      color: 'var(--orientation-ready)',
      borderColor: 'rgba(4,120,87,.24)'
    },
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "compass",
      size: 13
    })
  }, "Orientation ready"), /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: '7px 0 0',
      fontSize: 17,
      lineHeight: 1.2
    }
  }, orientation.label)), /*#__PURE__*/React.createElement(Chip, {
    tone: "measure"
  }, "86% map confidence")), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '12px 0 0',
      color: 'var(--obs-stone)',
      fontSize: 13,
      lineHeight: 1.55
    }
  }, orientation.summary), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 7,
      marginTop: 12
    }
  }, orientation.frameworks.map(name => /*#__PURE__*/React.createElement(Chip, {
    key: name,
    tone: "signal"
  }, name))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: compact ? '1fr' : 'repeat(2, minmax(0,1fr))',
      gap: 14,
      marginTop: 16
    }
  }, [['Important areas', 'compass', orientation.areas], ['Start reading', 'book-open', orientation.reading]].map(([title, icon, items]) => /*#__PURE__*/React.createElement("div", {
    key: title
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      marginBottom: 8,
      fontSize: 12,
      fontWeight: 700
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: 14
  }), title), items.map(item => /*#__PURE__*/React.createElement("article", {
    key: item.name,
    style: {
      padding: '10px 0',
      borderTop: '1px solid var(--obs-border)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "file-text",
    size: 13
  }), /*#__PURE__*/React.createElement("strong", {
    style: {
      fontSize: 12,
      overflowWrap: 'anywhere'
    }
  }, item.name)), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '5px 0 0',
      color: 'var(--obs-stone)',
      fontSize: 12,
      lineHeight: 1.45
    }
  }, item.detail), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-block',
      marginTop: 6,
      fontSize: 11,
      color: 'var(--obs-stone)'
    }
  }, item.meta)))))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14,
      paddingTop: 12,
      borderTop: '1px solid var(--obs-border)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      marginBottom: 8,
      fontSize: 12,
      fontWeight: 700
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "circle-alert",
    size: 14
  }), "Still investigating"), orientation.unknowns.map(u => /*#__PURE__*/React.createElement("p", {
    key: u.subject,
    style: {
      margin: '5px 0 0',
      color: 'var(--obs-stone)',
      fontSize: 12,
      lineHeight: 1.45
    }
  }, /*#__PURE__*/React.createElement("strong", null, u.subject, ":"), " ", u.reason))));
}
function EntryScreen({
  onComplete
}) {
  const data = window.STData;
  const [path, setPath] = React.useState(data.repoPath);
  const [scanning, setScanning] = React.useState(false);
  const [advanced, setAdvanced] = React.useState(false);
  const [mode, setMode] = React.useState('standard');
  const [budget, setBudget] = React.useState('strict');
  const [scope, setScope] = React.useState('backend');
  const [requireLlm, setRequireLlm] = React.useState(false);
  const [parsed, setParsed] = React.useState(0);
  React.useEffect(() => {
    if (!scanning) return;
    const timer = setInterval(() => setParsed(n => Math.min(1180, n + 96)), 260);
    return () => clearInterval(timer);
  }, [scanning]);
  return /*#__PURE__*/React.createElement("main", {
    style: {
      minHeight: '100%',
      color: 'var(--obs-ink)',
      background: 'var(--obs-canvas)',
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("section", {
    style: {
      position: 'sticky',
      top: 0,
      zIndex: 2,
      height: 48,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      borderBottom: '1px solid color-mix(in srgb, var(--obs-border) 84%, transparent)',
      background: 'color-mix(in srgb, var(--obs-canvas) 94%, transparent)',
      backdropFilter: 'blur(16px)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      fontSize: 14,
      fontWeight: 650
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--obs-slate-blue)',
      display: 'inline-flex'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "git-branch",
    size: 18
  })), "Syntax Tree"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "pill",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "settings",
      size: 15
    })
  }, "Settings"), /*#__PURE__*/React.createElement(Button, {
    variant: "pill",
    iconAfter: /*#__PURE__*/React.createElement(Icon, {
      name: "external-link",
      size: 13
    })
  }, "Open legacy workspace"))), /*#__PURE__*/React.createElement("section", {
    style: {
      width: 'min(1180px, calc(100% - 48px))',
      margin: '0 auto',
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1.02fr) minmax(420px, 0.78fr)',
      alignItems: 'center',
      gap: 56,
      padding: '64px 0'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 640
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 18,
      color: 'var(--obs-slate-blue)',
      fontSize: 13,
      fontWeight: 650
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "sparkles",
    size: 14
  }), "Codebase observatory"), /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontSize: 'clamp(44px, 5vw, 72px)',
      lineHeight: 0.96,
      fontWeight: 720
    }
  }, "What repo do you want to understand?"), /*#__PURE__*/React.createElement("p", {
    style: {
      maxWidth: 610,
      margin: '24px 0 0',
      color: 'var(--text-body)',
      fontSize: 17,
      lineHeight: 1.7
    }
  }, "Syntax Tree scans a repository and turns it into a calm, source-backed architecture map. You can zoom through concepts, inspect flows, ask questions, and open the exact code behind each answer."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, minmax(0,1fr))',
      gap: 12,
      marginTop: 36
    }
  }, /*#__PURE__*/React.createElement(PromiseCard, {
    icon: "shield-check",
    title: "Source-backed",
    text: "Architecture claims stay tied to files, spans, and evidence."
  }), /*#__PURE__*/React.createElement(PromiseCard, {
    icon: "git-branch",
    title: "Meaning first",
    text: "The first screen explains the system shape, not the folder tree."
  }), /*#__PURE__*/React.createElement(PromiseCard, {
    icon: "clock",
    title: "Guided progress",
    text: "Analysis stages use human copy instead of raw pipeline jargon."
  }))), /*#__PURE__*/React.createElement(Panel, {
    "aria-label": "Start repository analysis"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: 18,
      marginBottom: 24
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      fontSize: 22
    }
  }, "Start a scan"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '6px 0 0',
      color: 'var(--obs-stone)',
      fontSize: 13,
      lineHeight: 1.45
    }
  }, "Paste a local repository path. Orientation appears first, then the map opens when deeper analysis is ready.")), /*#__PURE__*/React.createElement(Chip, {
    tone: "slate",
    style: {
      height: 'fit-content'
    }
  }, "API mode")), /*#__PURE__*/React.createElement("span", {
    style: label
  }, "Repository path"), /*#__PURE__*/React.createElement(PathInput, {
    value: path,
    onChange: setPath,
    onBrowse: () => {}
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 11
    }
  }, ['repos/flask', 'repos/tenacity', 'work/documenso'].map(p => /*#__PURE__*/React.createElement(Button, {
    key: p,
    variant: "pill",
    onClick: () => setPath('C:\\' + p.replace('/', '\\'))
  }, p))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16,
      border: '1px solid var(--obs-border)',
      borderRadius: 8,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setAdvanced(o => !o),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      width: '100%',
      padding: '11px 12px',
      color: 'var(--obs-stone)',
      fontSize: 13,
      background: 'transparent',
      border: 0,
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      transform: advanced ? 'none' : 'rotate(-90deg)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-down",
    size: 14
  })), "Advanced analysis settings"), advanced && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 15,
      padding: '14px 12px 16px',
      borderTop: '1px solid var(--obs-border)'
    }
  }, /*#__PURE__*/React.createElement(SegmentedControl, {
    label: "Analysis mode",
    value: mode,
    onChange: setMode,
    options: [{
      value: 'standard',
      label: 'Standard',
      description: 'Falls back honestly when the LLM is unavailable.'
    }, {
      value: 'validation',
      label: 'Validation',
      description: 'Requires live LLM-backed reasoning.'
    }]
  }), /*#__PURE__*/React.createElement(CheckField, {
    checked: mode === 'validation' ? true : requireLlm,
    disabled: mode === 'validation',
    onChange: setRequireLlm
  }, "Require live LLM explanations"), /*#__PURE__*/React.createElement(SegmentedControl, {
    label: "Budget",
    value: budget,
    onChange: setBudget,
    options: [{
      value: 'strict',
      label: 'Strict'
    }, {
      value: 'balanced',
      label: 'Balanced'
    }, {
      value: 'max_quality',
      label: 'Max quality'
    }]
  }), /*#__PURE__*/React.createElement(SegmentedControl, {
    label: "Scope",
    value: scope,
    onChange: setScope,
    options: [{
      value: 'backend',
      label: 'Backend'
    }, {
      value: 'full_repo',
      label: 'Full repo'
    }]
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    style: label
  }, "Model override"), /*#__PURE__*/React.createElement(TextInput, {
    placeholder: "leave empty to use configured default"
  })))), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "lg",
    style: {
      width: '100%',
      marginTop: 18
    },
    disabled: !path.trim() || scanning,
    icon: scanning ? /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'inline-flex',
        animation: 'observatory-spin 900ms linear infinite'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "loader-circle",
      size: 16
    })) : null,
    iconAfter: scanning ? null : /*#__PURE__*/React.createElement(Icon, {
      name: "arrow-right",
      size: 16
    }),
    onClick: () => setScanning(true)
  }, scanning ? 'Starting scan' : 'Build architecture map'), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '14px 0 0',
      color: 'var(--obs-stone)',
      fontSize: 12,
      lineHeight: 1.45,
      textAlign: 'center'
    }
  }, "The first repo orientation appears before the full architecture map. If the backend is offline, this screen will say so directly."))), scanning && /*#__PURE__*/React.createElement(Panel, {
    padding: 22,
    style: {
      width: 'min(920px, calc(100% - 48px))',
      margin: '-34px auto 48px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 18
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      color: 'var(--obs-slate-blue)',
      fontSize: 13,
      fontWeight: 650
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      animation: 'observatory-spin 900ms linear infinite'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "loader-circle",
    size: 14
  })), "Building the architecture map"), /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: '6px 0 0',
      fontSize: 20
    }
  }, "Indexing source evidence")), /*#__PURE__*/React.createElement(Button, {
    variant: "quiet",
    iconAfter: /*#__PURE__*/React.createElement(Icon, {
      name: "arrow-right",
      size: 14
    }),
    onClick: onComplete
  }, "Open the map")), /*#__PURE__*/React.createElement(ProgressMeter, {
    style: {
      marginTop: 18
    },
    value: parsed,
    total: 1180,
    caption: "src/flask/blueprints.py"
  }), /*#__PURE__*/React.createElement(OrientationPanel, {
    orientation: data.orientation,
    compact: true
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, minmax(0,1fr))',
      gap: 9,
      marginTop: 18
    }
  }, data.stages.map(s => /*#__PURE__*/React.createElement(StageRow, {
    key: s.label,
    state: s.state,
    label: s.label,
    title: s.state === 'skipped' ? 'Skipped: no live LLM credential configured.' : undefined
  }))), /*#__PURE__*/React.createElement(Callout, {
    tone: "warning",
    style: {
      marginTop: 18
    },
    icon: /*#__PURE__*/React.createElement(StatusBadge, {
      status: "insufficient"
    })
  }, "Semantic index was skipped: no live LLM credential is configured, so concept naming falls back to deterministic grouping."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 12,
      marginTop: 16,
      paddingTop: 14,
      borderTop: '1px solid var(--obs-border)'
    }
  }, ['Configured model', 'agentic mode', 'No live LLM'].map(t => /*#__PURE__*/React.createElement(Chip, {
    key: t,
    tone: "fact"
  }, t)))));
}
Object.assign(window, {
  EntryScreen,
  OrientationPanel
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/syntax-tree/EntryScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/syntax-tree/ObservatoryScreen.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  Panel,
  Button,
  IconButton,
  Icon,
  Chip,
  StatusBadge,
  Callout,
  BreadcrumbTrail,
  RunPicker,
  TabRail,
  LensNode,
  MapLegend,
  ClaimCard,
  EvidenceRow,
  FileList
} = window.SyntaxTreeDesignSystem_b1a4e9;
const NODE_W = 238,
  NODE_H = 104;
const edgeStroke = {
  flow: 'color-mix(in srgb, var(--obs-slate-blue) 56%, transparent)',
  inferred: 'color-mix(in srgb, var(--obs-clay) 48%, transparent)',
  boundary: 'color-mix(in srgb, var(--obs-stone) 62%, transparent)'
};
const edgeDash = {
  flow: '',
  inferred: '5 6',
  boundary: '2 5'
};
function MapCanvas({
  nodes,
  edges,
  selectedId,
  onSelect
}) {
  const pos = {};
  nodes.forEach(n => {
    pos[n.id] = {
      x: n.x,
      y: n.y
    };
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      height: '100%',
      padding: '26px 34px 112px',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 26,
      left: 34,
      zIndex: 4,
      maxWidth: 'min(840px, calc(100% - 72px))',
      padding: '10px 14px',
      background: 'rgba(252,250,247,0.88)',
      borderRadius: 12,
      pointerEvents: 'none'
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 15,
      lineHeight: 1.55
    }
  }, "Five source-backed areas carry this repository: the application object dispatches requests, blueprints defer registration, and the CLI boots the development server."), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '4px 0 0',
      color: 'var(--obs-stone)',
      fontSize: 12.5
    }
  }, "The map is interactive \u2014 select a card to read its explanation and evidence.")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 118,
      left: 'max(28px, calc(50% - 480px))',
      width: 880,
      height: 300
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "880",
    height: "300",
    style: {
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none'
    }
  }, edges.map(e => {
    const a = pos[e.from],
      b = pos[e.to];
    const x1 = a.x + NODE_W,
      y1 = a.y + NODE_H / 2,
      x2 = b.x,
      y2 = b.y + NODE_H / 2;
    const mid = (x1 + x2) / 2;
    return /*#__PURE__*/React.createElement("path", {
      key: e.from + e.to,
      d: `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`,
      fill: "none",
      stroke: edgeStroke[e.kind],
      strokeWidth: "1.25",
      strokeDasharray: edgeDash[e.kind]
    });
  })), nodes.map(n => /*#__PURE__*/React.createElement("div", {
    key: n.id,
    style: {
      position: 'absolute',
      left: n.x,
      top: n.y
    }
  }, /*#__PURE__*/React.createElement(LensNode, _extends({}, n, {
    selected: n.id === selectedId,
    onClick: () => onSelect(n.id)
  }))))), /*#__PURE__*/React.createElement(MapLegend, {
    style: {
      position: 'absolute',
      left: 34,
      bottom: 104,
      zIndex: 3
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      right: 24,
      bottom: 104,
      zIndex: 3,
      padding: '5px 10px',
      color: 'var(--obs-stone)',
      background: 'rgba(252,250,247,0.92)',
      border: '1px solid var(--obs-border)',
      borderRadius: 999,
      fontSize: 12
    }
  }, "5 areas \xB7 54 evidence rows"));
}
function QuestionDock({
  contextLabel,
  suggestions,
  onAsk
}) {
  const [draft, setDraft] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const submit = () => {
    if (!draft.trim()) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onAsk(draft);
      setDraft('');
    }, 900);
  };
  return /*#__PURE__*/React.createElement("form", {
    onSubmit: e => {
      e.preventDefault();
      submit();
    },
    "aria-label": "Ask architecture question",
    style: {
      position: 'absolute',
      right: 28,
      bottom: 26,
      left: 28,
      zIndex: 8,
      display: 'grid',
      gridTemplateColumns: '28px minmax(170px,1fr) auto auto 42px',
      gap: 14,
      alignItems: 'center',
      maxWidth: 780,
      minHeight: 64,
      padding: '12px 14px 12px 18px',
      color: 'var(--obs-stone)',
      background: 'rgba(252,250,247,0.9)',
      border: `1px solid ${loading ? 'color-mix(in srgb, var(--obs-slate-blue) 26%, var(--obs-border))' : 'color-mix(in srgb, var(--obs-border) 80%, var(--obs-white))'}`,
      borderRadius: 16,
      boxShadow: 'var(--shadow-dock)',
      backdropFilter: 'blur(18px)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "sparkles",
    size: 20
  }), /*#__PURE__*/React.createElement("textarea", {
    rows: 1,
    value: draft,
    placeholder: `Ask anything about ${contextLabel}...`,
    onChange: e => setDraft(e.target.value),
    onKeyDown: e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submit();
      }
    },
    style: {
      width: '100%',
      maxHeight: 76,
      resize: 'none',
      color: 'var(--obs-ink)',
      background: 'transparent',
      border: 0,
      outline: 'none',
      fontFamily: 'inherit',
      fontSize: 14,
      lineHeight: 1.35
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, suggestions.map(s => /*#__PURE__*/React.createElement("button", {
    key: s,
    type: "button",
    onClick: () => setDraft(s),
    style: {
      color: 'var(--obs-slate-blue)',
      background: 'transparent',
      border: 0,
      cursor: 'pointer',
      fontSize: 13,
      fontStyle: 'italic',
      whiteSpace: 'nowrap'
    }
  }, s))), /*#__PURE__*/React.createElement("kbd", {
    style: {
      padding: '3px 7px',
      color: 'var(--obs-stone)',
      background: 'rgba(255,255,255,0.5)',
      border: '1px solid var(--obs-border)',
      borderRadius: 6,
      fontFamily: 'var(--font-mono)',
      fontSize: 11
    }
  }, "Ctrl J"), /*#__PURE__*/React.createElement("button", {
    type: "submit",
    "aria-label": "Submit question",
    disabled: loading,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 42,
      height: 42,
      color: 'var(--obs-white)',
      background: 'var(--obs-slate-blue)',
      border: 0,
      borderRadius: 999,
      cursor: loading ? 'wait' : 'pointer',
      opacity: loading ? 0.72 : 1
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "send",
    size: 18
  })), loading && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      left: 58,
      bottom: -21,
      color: 'var(--obs-slate-blue)',
      fontSize: 12
    }
  }, "Building a source-backed lens\u2026"));
}
function VoiceRail({
  node,
  tab,
  onTab,
  onOpenProof,
  onClose,
  activeEvidence
}) {
  const h3 = {
    margin: 0,
    fontSize: 13,
    fontWeight: 700
  };
  const section = {
    marginTop: 28
  };
  return /*#__PURE__*/React.createElement("aside", {
    "aria-label": `${node.label} explanation`,
    style: {
      height: '100%',
      padding: 24,
      overflow: 'auto',
      background: 'rgba(252,250,247,0.76)',
      backdropFilter: 'blur(18px)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginBottom: 22
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      fontSize: 18,
      fontWeight: 700
    }
  }, node.label), /*#__PURE__*/React.createElement(Chip, {
    tone: "clay"
  }, /*#__PURE__*/React.createElement(StatusBadge, {
    status: node.status
  }), node.status)), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      color: 'var(--text-body)',
      fontSize: 13,
      lineHeight: 1.55
    }
  }, node.summary), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement(Chip, {
    tone: "fact"
  }, node.kind), /*#__PURE__*/React.createElement(Chip, {
    tone: "measure",
    title: "How confident Laura's structural analysis is that this area was correctly identified and classified."
  }, node.status === 'candidate' ? 'map confidence not available' : '84% map confidence'), /*#__PURE__*/React.createElement(Chip, {
    tone: "fact"
  }, node.evidenceCount, " evidence"), /*#__PURE__*/React.createElement(Chip, {
    tone: "fact"
  }, node.childrenCount, " child areas"), /*#__PURE__*/React.createElement(Chip, {
    tone: "fact"
  }, "cached explanation")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "quiet",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "arrow-up-right",
      size: 14
    })
  }, "Zoom into this area"), /*#__PURE__*/React.createElement(Button, {
    variant: "quiet",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "message-square-text",
      size: 14
    })
  }, "Ask about this"), /*#__PURE__*/React.createElement(Button, {
    variant: "quiet",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "copy",
      size: 14
    })
  }, "Copy node link"), /*#__PURE__*/React.createElement(Button, {
    variant: "quiet",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "sparkles",
      size: 14
    })
  }, "Architectural Explanation"), /*#__PURE__*/React.createElement(Button, {
    variant: "quiet",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "bookmark-plus",
      size: 14
    })
  }, "Save Lens"))), /*#__PURE__*/React.createElement(IconButton, {
    label: "Close explanation",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "x",
      size: 17
    }),
    onClick: onClose
  })), node.status !== 'verified' && /*#__PURE__*/React.createElement(Callout, {
    style: {
      margin: '24px 0 28px'
    },
    icon: /*#__PURE__*/React.createElement(StatusBadge, {
      status: node.status
    })
  }, node.status === 'inferred' ? 'Relations here are inferred from structure; the loader is chosen at render time, so no extractor observed a span.' : 'Some evidence for this area is source-backed and some remains inferred or incomplete.'), /*#__PURE__*/React.createElement(TabRail, {
    value: tab,
    onChange: onTab,
    style: {
      marginTop: 24
    }
  }), tab === 'simple' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("section", {
    style: section
  }, /*#__PURE__*/React.createElement("h3", {
    style: h3
  }, "Simple explanation"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '10px 0 0',
      color: 'var(--text-body)',
      fontSize: 13,
      lineHeight: 1.55
    }
  }, node.simple)), /*#__PURE__*/React.createElement("section", {
    style: section
  }, /*#__PURE__*/React.createElement("h3", {
    style: h3
  }, "Main responsibilities"), /*#__PURE__*/React.createElement("ul", {
    style: {
      display: 'grid',
      gap: 10,
      padding: 0,
      margin: '14px 0 0'
    }
  }, node.claims.map(c => /*#__PURE__*/React.createElement(ClaimCard, {
    key: c.statement,
    statement: c.statement,
    supportStatus: c.supportStatus,
    relation: c.relation
  }, c.evidence && /*#__PURE__*/React.createElement(EvidenceRow, _extends({}, c.evidence, {
    status: "verified",
    onClick: () => onOpenProof(c.evidence),
    style: {
      marginTop: 12
    }
  })))))), /*#__PURE__*/React.createElement("section", {
    style: section
  }, /*#__PURE__*/React.createElement("h3", {
    style: h3
  }, "Useful questions"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 10,
      marginTop: 12
    }
  }, ['What calls this?', 'Where does a request enter?', 'What is not proven here?'].map(q => /*#__PURE__*/React.createElement(Button, {
    key: q,
    variant: "secondary",
    style: {
      minHeight: 32,
      padding: '7px 11px'
    }
  }, q))))), tab === 'technical' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("section", {
    style: section
  }, /*#__PURE__*/React.createElement("h3", {
    style: h3
  }, "Technical explanation"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '10px 0 0',
      color: 'var(--text-body)',
      fontSize: 13,
      lineHeight: 1.55
    }
  }, node.technical)), /*#__PURE__*/React.createElement("section", {
    style: section
  }, /*#__PURE__*/React.createElement("h3", {
    style: h3
  }, "Gaps"), /*#__PURE__*/React.createElement("ul", {
    style: {
      display: 'grid',
      gap: 10,
      padding: 0,
      margin: '12px 0 0',
      listStyle: 'none'
    }
  }, ['Runtime-registered relations are not statically observable in this run.', 'No live LLM was used, so no narrative beyond deterministic structure.'].map(g => /*#__PURE__*/React.createElement("li", {
    key: g,
    style: {
      paddingLeft: 12,
      color: 'color-mix(in srgb, var(--obs-ink) 72%, var(--obs-clay))',
      borderLeft: '2px solid color-mix(in srgb, var(--obs-clay) 38%, transparent)',
      fontSize: 13,
      lineHeight: 1.45
    }
  }, g))))), tab === 'evidence' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("section", {
    style: section
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: h3
  }, "Key files (", node.files.length, ")"), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    style: {
      minHeight: 28
    }
  }, "View all files")), /*#__PURE__*/React.createElement(FileList, {
    style: {
      marginTop: 12
    },
    items: node.files,
    onSelect: item => onOpenProof({
      filePath: item.filePath,
      reason: item.reason,
      startLine: 1,
      preview: ''
    })
  })), /*#__PURE__*/React.createElement("section", {
    style: section
  }, /*#__PURE__*/React.createElement("h3", {
    style: h3
  }, "Evidence rows"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 10,
      marginTop: 12
    }
  }, node.evidence.map(e => /*#__PURE__*/React.createElement(EvidenceRow, _extends({
    key: e.filePath + e.startLine
  }, e, {
    active: activeEvidence && activeEvidence.filePath === e.filePath && activeEvidence.startLine === e.startLine,
    onClick: e.status === 'verified' ? () => onOpenProof(e) : undefined
  })))))));
}
function CodeCompanion({
  selection,
  expanded,
  onToggle,
  onClose
}) {
  const lines = (selection.preview || '# no navigable source region for this evidence').split('\n');
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      right: 18,
      bottom: 16,
      left: 18,
      zIndex: 6,
      display: 'flex',
      flexDirection: 'column',
      height: expanded ? 'min(72vh, 720px)' : 'min(42vh, 430px)',
      overflow: 'hidden',
      background: 'rgba(252,250,247,0.96)',
      border: '1px solid color-mix(in srgb, var(--obs-border) 82%, var(--obs-white))',
      borderRadius: 14,
      boxShadow: 'var(--shadow-companion)',
      backdropFilter: 'blur(18px)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 14,
      minHeight: 46,
      padding: '8px 10px 8px 14px',
      borderBottom: '1px solid var(--obs-border)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      minWidth: 0,
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "file-code-2",
    size: 15
  }), /*#__PURE__*/React.createElement("strong", {
    style: {
      overflow: 'hidden',
      fontSize: 13,
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, selection.filePath), /*#__PURE__*/React.createElement(Chip, {
    tone: "fact",
    style: {
      fontFamily: 'var(--font-mono)',
      height: 22
    }
  }, selection.startLine, "-", selection.endLine ?? selection.startLine)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(IconButton, {
    label: expanded ? 'Collapse' : 'Expand',
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: expanded ? 'chevrons-down-up' : 'chevrons-up-down',
      size: 15
    }),
    onClick: onToggle
  }), /*#__PURE__*/React.createElement(IconButton, {
    label: "Close source",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "x",
      size: 15
    }),
    onClick: onClose
  }))), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      padding: '10px 14px',
      color: 'var(--obs-stone)',
      fontSize: 12,
      borderBottom: '1px solid var(--obs-border)'
    }
  }, selection.reason), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflow: 'auto',
      padding: 18,
      color: '#ECEAF0',
      background: 'var(--surface-code)',
      fontFamily: 'var(--font-mono)',
      fontSize: 12,
      lineHeight: 1.65,
      whiteSpace: 'pre'
    }
  }, lines.map((line, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'grid',
      gridTemplateColumns: '44px 1fr',
      background: i === 0 ? 'rgba(201,162,39,0.14)' : 'transparent'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: '#AAA7B2'
    }
  }, (selection.startLine ?? 1) + i), /*#__PURE__*/React.createElement("span", null, line)))));
}
function ObservatoryScreen({
  onRestart
}) {
  const data = window.STData;
  const [selectedId, setSelectedId] = React.useState('app');
  const [tab, setTab] = React.useState('simple');
  const [proof, setProof] = React.useState(null);
  const [expanded, setExpanded] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const node = data.nodes.find(n => n.id === selectedId);
  const crumbs = [{
    id: null,
    label: 'Overview'
  }, {
    id: 'pkg',
    label: 'src/flask'
  }];
  if (node) crumbs.push({
    id: node.id,
    label: node.label
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      height: '100%',
      color: 'var(--obs-ink)',
      background: 'var(--canvas-wash), var(--obs-canvas)',
      fontFamily: 'var(--font-sans)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("header", {
    style: {
      position: 'relative',
      zIndex: 40,
      display: 'grid',
      gridTemplateColumns: '1fr auto 1fr',
      alignItems: 'center',
      height: 48,
      padding: '0 18px',
      background: 'rgba(252,250,247,0.86)',
      borderBottom: '1px solid var(--obs-border)',
      backdropFilter: 'blur(18px)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      display: 'inline-flex'
    }
  }, /*#__PURE__*/React.createElement(IconButton, {
    label: "Open navigation",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "menu",
      size: 18
    }),
    onClick: () => setMenuOpen(o => !o)
  }), menuOpen && /*#__PURE__*/React.createElement("div", {
    role: "menu",
    style: {
      position: 'absolute',
      zIndex: 30,
      top: 'calc(100% + 8px)',
      left: 0,
      display: 'grid',
      gap: 4,
      width: 260,
      padding: 6,
      background: 'var(--obs-white)',
      border: '1px solid var(--obs-border)',
      borderRadius: 8,
      boxShadow: 'var(--shadow-menu)'
    }
  }, [['book-open', 'Repository documentation', 'Browse components and source', () => setMenuOpen(false)], ['folder-search', 'Analyze another repository', 'Clear this session and start again', onRestart], ['settings', 'Settings', 'Configure architectural explanations', () => setMenuOpen(false)]].map(([icon, title, sub, action]) => /*#__PURE__*/React.createElement("button", {
    key: title,
    type: "button",
    onClick: action,
    style: {
      display: 'grid',
      gridTemplateColumns: 'auto minmax(0,1fr)',
      gap: 9,
      alignItems: 'start',
      padding: 9,
      color: 'var(--obs-ink)',
      textAlign: 'left',
      background: 'transparent',
      border: '1px solid transparent',
      borderRadius: 6,
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: 15
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'grid',
      gap: 3
    }
  }, /*#__PURE__*/React.createElement("strong", {
    style: {
      fontSize: 13
    }
  }, title), /*#__PURE__*/React.createElement("small", {
    style: {
      color: 'var(--obs-stone)',
      fontSize: 11
    }
  }, sub)))))), /*#__PURE__*/React.createElement(BreadcrumbTrail, {
    items: crumbs,
    onSelect: i => {
      if (i < 2) setSelectedId(null);
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 650
    }
  }, data.repoTitle), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(RunPicker, {
    runId: data.runId,
    lastScanned: "scanned 4m ago",
    freshness: "Live"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1fr) 360px',
      height: 'calc(100% - 48px)',
      minHeight: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      minWidth: 0,
      overflow: 'hidden',
      borderRight: '1px solid var(--obs-border)'
    }
  }, /*#__PURE__*/React.createElement(MapCanvas, {
    nodes: data.nodes,
    edges: data.edges,
    selectedId: selectedId,
    onSelect: setSelectedId
  }), proof ? /*#__PURE__*/React.createElement(CodeCompanion, {
    selection: proof,
    expanded: expanded,
    onToggle: () => setExpanded(e => !e),
    onClose: () => {
      setProof(null);
      setExpanded(false);
    }
  }) : /*#__PURE__*/React.createElement(QuestionDock, {
    contextLabel: node ? node.label : data.repoTitle,
    suggestions: data.suggestions,
    onAsk: () => {
      setSelectedId('app');
      setTab('technical');
    }
  })), node ? /*#__PURE__*/React.createElement(VoiceRail, {
    node: node,
    tab: tab,
    onTab: setTab,
    activeEvidence: proof,
    onOpenProof: sel => {
      setProof(sel);
      setExpanded(false);
    },
    onClose: () => setSelectedId(null)
  }) : /*#__PURE__*/React.createElement("aside", {
    style: {
      height: '100%',
      padding: 24,
      overflow: 'auto',
      background: 'rgba(252,250,247,0.76)',
      backdropFilter: 'blur(18px)'
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      color: 'var(--obs-stone)',
      fontSize: 13,
      lineHeight: 1.5
    }
  }, "Select an architecture area to see the cached explanation, its source evidence, and what the backend still cannot prove."), /*#__PURE__*/React.createElement(OrientationPanel, {
    orientation: data.orientation,
    compact: true
  }))));
}
Object.assign(window, {
  ObservatoryScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/syntax-tree/ObservatoryScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/syntax-tree/data.js
try { (() => {
window.STData = {
  repoPath: 'C:\\repos\\flask',
  repoTitle: 'flask',
  runId: 'run:1f7f34f034dc4674a8f395f29adb58ee',
  stages: [{
    state: 'done',
    label: 'Orienting repository'
  }, {
    state: 'done',
    label: 'Reading source files'
  }, {
    state: 'done',
    label: 'Building the code graph'
  }, {
    state: 'current',
    label: 'Indexing source evidence'
  }, {
    state: 'waiting',
    label: 'Tracing flows and frontend bridges'
  }, {
    state: 'skipped',
    label: 'Building semantic index'
  }],
  orientation: {
    label: 'Python web framework with a src layout',
    summary: 'One installable package under src/flask, a CLI entry point, and a large test suite. Blueprint and app-factory patterns dominate the public surface.',
    frameworks: ['Flask', 'Click', 'Jinja2', 'Werkzeug'],
    areas: [{
      name: 'src/flask/app.py',
      detail: 'The Flask application object and request dispatch.',
      meta: '92% map confidence — verified'
    }, {
      name: 'src/flask/blueprints.py',
      detail: 'Blueprint registration and deferred setup.',
      meta: '78% map confidence — partial'
    }],
    reading: [{
      name: 'src/flask/__init__.py',
      detail: 'Public export surface — read first.',
      meta: '88% map confidence'
    }, {
      name: 'src/flask/cli.py',
      detail: 'Entry point for the flask command.',
      meta: '71% map confidence'
    }],
    unknowns: [{
      subject: 'Async dispatch',
      reason: 'No extractor-observed spans for the asgi bridge in this run.'
    }]
  },
  nodes: [{
    id: 'app',
    label: 'app',
    kind: 'component',
    icon: 'network',
    accent: 'slate',
    status: 'verified',
    description: 'The Flask object: config, routing, request and error dispatch.',
    evidenceCount: 24,
    childrenCount: 8,
    x: 0,
    y: 0,
    summary: 'The Flask application object owns configuration, the URL map, and the request/response lifecycle. Everything a request touches enters through here.',
    simple: 'This is the front door. A request arrives, the app matches it to a view function, runs it, and turns the result into a response.',
    technical: 'Flask.wsgi_app builds a RequestContext, pushes it, dispatches via url_map, and finalizes through make_response. Error handling and teardown callbacks are registered on the app instance.',
    claims: [{
      statement: 'Flask.wsgi_app dispatches through Flask.full_dispatch_request',
      supportStatus: 'supported',
      relation: 'direct relation: calls',
      evidence: {
        filePath: 'src/flask/app.py',
        startLine: 1478,
        endLine: 1512,
        reason: 'python_call_extractor@0.3.0 observed this call',
        preview: 'def wsgi_app(self, environ, start_response):\n    ctx = self.request_context(environ)'
      }
    }, {
      statement: 'Flask instances emit signals to third-party receivers',
      supportStatus: 'insufficient_evidence',
      relation: 'inferred relation: publishes'
    }],
    files: [{
      filePath: 'src/flask/app.py',
      reason: 'Primary file returned by the architecture map.'
    }, {
      filePath: 'src/flask/ctx.py',
      reason: 'Owns the request/app context pushed per dispatch.'
    }, {
      filePath: 'src/flask/wrappers.py',
      reason: 'Request and Response subclasses used here.'
    }],
    evidence: [{
      filePath: 'src/flask/app.py',
      startLine: 1478,
      endLine: 1512,
      reason: 'python_call_extractor@0.3.0 observed this call',
      preview: 'ctx = self.request_context(environ)',
      status: 'verified'
    }, {
      filePath: 'src/flask/ctx.py',
      startLine: 340,
      endLine: 372,
      reason: 'python_inheritance_extractor@0.2.1 resolved RequestContext',
      preview: 'class RequestContext:',
      status: 'verified'
    }, {
      filePath: 'src/flask/signals.py',
      startLine: 12,
      endLine: 20,
      reason: 'No extractor-observed span for the receiver side',
      status: 'insufficient'
    }]
  }, {
    id: 'blueprints',
    label: 'blueprints',
    kind: 'class',
    icon: 'component',
    accent: 'citrine',
    status: 'partial',
    description: 'Deferred registration of routes, error handlers and templates.',
    evidenceCount: 11,
    childrenCount: 4,
    x: 320,
    y: 0,
    warning: true,
    summary: 'Blueprints record setup work and replay it against an app at register time, which is why some relationships only exist after registration.',
    simple: 'A blueprint is a bundle of routes you attach to an app later. Nothing happens until you register it.',
    technical: 'Blueprint.record queues deferred functions; Blueprint.register replays them with a BlueprintSetupState. Relations created during replay are not statically observable, so several claims stay unproven.',
    claims: [{
      statement: 'Blueprint.register replays deferred setup functions',
      supportStatus: 'supported',
      relation: 'direct relation: calls',
      evidence: {
        filePath: 'src/flask/blueprints.py',
        startLine: 208,
        endLine: 240,
        reason: 'python_call_extractor@0.3.0 observed this call',
        preview: 'for deferred in self.deferred_functions:\n    deferred(state)'
      }
    }, {
      statement: 'Blueprint routes reach Flask.add_url_rule',
      supportStatus: 'insufficient_evidence',
      relation: 'inferred relation: calls'
    }],
    files: [{
      filePath: 'src/flask/blueprints.py',
      reason: 'Primary file returned by the architecture map.'
    }, {
      filePath: 'src/flask/sansio/blueprints.py',
      reason: 'Holds the sansio base the runtime class extends.'
    }],
    evidence: [{
      filePath: 'src/flask/blueprints.py',
      startLine: 208,
      endLine: 240,
      reason: 'python_call_extractor@0.3.0 observed this call',
      preview: 'for deferred in self.deferred_functions:',
      status: 'verified'
    }, {
      filePath: 'src/flask/sansio/blueprints.py',
      startLine: 96,
      endLine: 118,
      reason: 'Deferred target resolved at runtime only',
      status: 'inferred'
    }]
  }, {
    id: 'cli',
    label: 'cli',
    kind: 'module',
    icon: 'file-code-2',
    accent: 'sage',
    status: 'verified',
    description: 'The flask command: app discovery, run and shell commands.',
    evidenceCount: 9,
    childrenCount: 3,
    x: 640,
    y: 0,
    summary: 'Click-based command group that locates an application factory and boots the development server.',
    simple: 'This is what runs when you type "flask run" in a terminal.',
    technical: 'ScriptInfo.load_app resolves FLASK_APP, then the run command hands the WSGI callable to werkzeug.serving.run_simple.',
    claims: [{
      statement: 'ScriptInfo.load_app imports the configured application module',
      supportStatus: 'supported',
      relation: 'direct relation: imports',
      evidence: {
        filePath: 'src/flask/cli.py',
        startLine: 260,
        endLine: 296,
        reason: 'python_call_extractor@0.3.0 observed this import',
        preview: 'app = find_best_app(module)'
      }
    }],
    files: [{
      filePath: 'src/flask/cli.py',
      reason: 'Primary file returned by the architecture map.'
    }],
    evidence: [{
      filePath: 'src/flask/cli.py',
      startLine: 260,
      endLine: 296,
      reason: 'python_call_extractor@0.3.0 observed this import',
      preview: 'app = find_best_app(module)',
      status: 'verified'
    }]
  }, {
    id: 'templating',
    label: 'templating',
    kind: 'module',
    icon: 'boxes',
    accent: 'clay',
    status: 'inferred',
    description: 'Jinja environment wiring and template lookup across blueprints.',
    evidenceCount: 4,
    childrenCount: 2,
    x: 160,
    y: 168,
    summary: 'Builds the Jinja environment and resolves template names across the app and its blueprints.',
    simple: 'Finds the HTML template a view asked for and renders it.',
    technical: 'DispatchingJinjaLoader walks app and blueprint loaders in order; resolution happens at render time, so most relations here are inferred rather than observed.',
    claims: [{
      statement: 'render_template resolves through DispatchingJinjaLoader',
      supportStatus: 'insufficient_evidence',
      relation: 'inferred relation: calls'
    }],
    files: [{
      filePath: 'src/flask/templating.py',
      reason: 'Primary file returned by the architecture map.'
    }],
    evidence: [{
      filePath: 'src/flask/templating.py',
      startLine: 44,
      endLine: 78,
      reason: 'Loader chosen dynamically; no static span',
      status: 'inferred'
    }]
  }, {
    id: 'sessions',
    label: 'sessions',
    kind: 'class',
    icon: 'database',
    accent: 'stone',
    status: 'candidate',
    description: 'Secure cookie session interface and lifecycle hooks.',
    evidenceCount: 6,
    childrenCount: 2,
    x: 480,
    y: 168,
    summary: 'SecureCookieSessionInterface serializes the session into a signed cookie on response.',
    simple: 'Remembers a little signed data about the visitor between requests.',
    technical: 'open_session deserializes the signed cookie; save_session writes it back during response finalization.',
    claims: [{
      statement: 'save_session writes the signed cookie during finalize',
      supportStatus: 'supported',
      relation: 'direct relation: calls',
      evidence: {
        filePath: 'src/flask/sessions.py',
        startLine: 330,
        endLine: 358,
        reason: 'python_call_extractor@0.3.0 observed this call',
        preview: 'response.set_cookie(name, val, **conditional_cookie_kwargs)'
      }
    }],
    files: [{
      filePath: 'src/flask/sessions.py',
      reason: 'Primary file returned by the architecture map.'
    }],
    evidence: [{
      filePath: 'src/flask/sessions.py',
      startLine: 330,
      endLine: 358,
      reason: 'python_call_extractor@0.3.0 observed this call',
      preview: 'response.set_cookie(name, val)',
      status: 'verified'
    }]
  }],
  edges: [{
    from: 'app',
    to: 'blueprints',
    kind: 'flow'
  }, {
    from: 'blueprints',
    to: 'cli',
    kind: 'boundary'
  }, {
    from: 'app',
    to: 'templating',
    kind: 'inferred'
  }, {
    from: 'app',
    to: 'sessions',
    kind: 'flow'
  }],
  suggestions: ['How does a request reach a view?', 'What runs at startup?']
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/syntax-tree/data.js", error: String((e && e.message) || e) }); }

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Callout = __ds_scope.Callout;

__ds_ns.Chip = __ds_scope.Chip;

__ds_ns.Icon = __ds_scope.Icon;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Panel = __ds_scope.Panel;

__ds_ns.StatusBadge = __ds_scope.StatusBadge;

__ds_ns.AIInterpretationCard = __ds_scope.AIInterpretationCard;

__ds_ns.ArchitectureTree = __ds_scope.ArchitectureTree;

__ds_ns.ClusterCard = __ds_scope.ClusterCard;

__ds_ns.ProvenanceChip = __ds_scope.ProvenanceChip;

__ds_ns.StatementCard = __ds_scope.StatementCard;

__ds_ns.StructuralRegion = __ds_scope.StructuralRegion;

__ds_ns.ThemeToggle = __ds_scope.ThemeToggle;

__ds_ns.ClaimCard = __ds_scope.ClaimCard;

__ds_ns.EvidenceRow = __ds_scope.EvidenceRow;

__ds_ns.FileList = __ds_scope.FileList;

__ds_ns.ProgressMeter = __ds_scope.ProgressMeter;

__ds_ns.PromiseCard = __ds_scope.PromiseCard;

__ds_ns.StageRow = __ds_scope.StageRow;

__ds_ns.StateCard = __ds_scope.StateCard;

__ds_ns.CheckField = __ds_scope.CheckField;

__ds_ns.PathInput = __ds_scope.PathInput;

__ds_ns.SegmentedControl = __ds_scope.SegmentedControl;

__ds_ns.TextInput = __ds_scope.TextInput;

__ds_ns.LensNode = __ds_scope.LensNode;

__ds_ns.MapLegend = __ds_scope.MapLegend;

__ds_ns.BreadcrumbTrail = __ds_scope.BreadcrumbTrail;

__ds_ns.RunPicker = __ds_scope.RunPicker;

__ds_ns.TabRail = __ds_scope.TabRail;

})();
