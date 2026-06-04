---
name: figma-handoff
description: "Builds and audits a complete developer handoff in any Figma file for any feature or component. Covers state documentation, annotations, interaction flows, responsive breakpoints, motion specs, and Code Connect linking. Use when: adding a new handoff section, auditing an existing handoff for missing states, documenting a feature's behavior in Figma, or syncing code changes back to design. Does NOT build product screens — for that use figma-generate-design."
compatibility: Requires Figma MCP server (use_figma, get_design_context, get_metadata, get_screenshot, search_design_system)
metadata:
  mcp-server: figma
---

# Figma Handoff

Builds a complete, developer-ready Figma handoff section for any feature or component — all states, annotations, interaction flows, motion specs, and code links.

**MANDATORY**: Load `figma-use` skill (via Skill tool: `skill: "figma-use"`) before every `use_figma` call. It contains critical Plugin API rules, font loading gotchas, and layout pitfalls.

**Always pass `skillNames: "figma-handoff"` when calling `use_figma` as part of this skill.**

---

## When to Use

- User says "hand off", "handoff", "document for dev", or "add states to Figma"
- User shares a Figma URL pointing to a handoff / dev handoff page
- User asks to audit a Figma file for missing component states
- User wants to add motion specs, responsive specs, or interaction flows to Figma
- User asks to "update the handoff" after code changes
- User requests Code Connect linking between Figma and source code

## When NOT to Use

- Building production screens or layouts (use `figma-generate-design`)
- Creating new reusable components or design tokens (use `figma-use` directly)
- Writing Code Connect `.figma.ts` template files (use `figma-code-connect`)
- Purely reading/inspecting a Figma file without writing to it

---

## RULE #1 — Always Use Real Components, Never Draw Fake Ones

**This is the most important rule in this skill.**

Before drawing any frame, rectangle, or text to represent a UI element — first check if a real Figma component exists for it. Using fake drawn elements when real components exist is always wrong. It wastes time, looks wrong, and misrepresents the design system.

The workflow is:
1. **Inspect first** — find what components exist in the file
2. **Clone or instantiate** the real component
3. **Modify the instance** — relabel text nodes, swap variants, hide/show children
4. **Only draw custom frames** for annotation overlays and callout badges — never for UI elements

**What this means in practice:**
- Tab bars → use the real `Tab-Bar` ComponentSet, pick the right `Tab-Numbers=N` variant
- Toolbars → use the real `Toolbar` ComponentSet, pick `Scanning page=Scan` or `=View`
- Layer panels → use the real `layer panel` ComponentSet
- Dropdowns, buttons, sliders → find them in the design system, don't draw boxes

---

## RULE #2 — Component Inspection Before Any Write

Before touching any component in Figma, run a full inspection call to understand:
- The main component ID and key
- The ComponentSet name and all variant names
- The exact children structure (what's inside the instance)
- Which text nodes are editable (their exact node IDs and current `characters`)
- Which children can be `visible = false/true`

**Inspection script — run this FIRST for any component you're working with:**

```js
const uiPage = figma.root.children.find(p => p.name === "PAGE_NAME");
await figma.setCurrentPageAsync(uiPage);

const node = await figma.getNodeByIdAsync("NODE_ID");

// Get main component + all variants in the ComponentSet
function getCompInfo(inst) {
  if (!inst || inst.type !== "INSTANCE") return null;
  const mc = inst.mainComponent;
  if (!mc) return null;
  const parent = mc.parent;
  return {
    id: mc.id, key: mc.key, name: mc.name,
    setName: parent ? parent.name : null,
    setId: parent ? parent.id : null,
    variants: (parent && parent.type === "COMPONENT_SET")
      ? parent.children.map(c => ({ id: c.id, key: c.key, name: c.name }))
      : []
  };
}

// Flatten all descendants with type + text content
function flatChildren(node, depth = 0) {
  if (depth > 5) return [];
  const r = [{
    depth, id: node.id, name: node.name, type: node.type,
    chars: node.type === "TEXT" ? node.characters : null,
    visible: node.visible !== false,
    w: Math.round(node.width), h: Math.round(node.height),
    mainCompName: node.type === "INSTANCE" && node.mainComponent ? node.mainComponent.name : null,
  }];
  if ("children" in node) for (const c of node.children) r.push(...flatChildren(c, depth + 1));
  return r;
}

return {
  id: node.id, name: node.name, type: node.type,
  compInfo: getCompInfo(node),
  children: flatChildren(node).slice(0, 80),
};
```

Run this inspection, read the output carefully, then plan your writes. Never guess node IDs.

---

## RULE #3 — You Cannot appendChild Inside an Instance

**This throws: `"Cannot move node. New parent is an instance or is inside of an instance"`**

When a component only has N slots but you need N+1 items (e.g. 3-layer panel for 4 dentures layers):
- Create a **second full instance** of the component
- **Hide the children you don't need** on the second instance (`node.visible = false`)
- Hide the duplicate header/nav bar on the second instance
- Relabel just the one item you do need

**Pattern for "more items than slots":**
```js
// Instance 1: fills slots 1-3
const inst1 = comp.createInstance();
// ... relabel slots 1-3 ...
screen.appendChild(inst1);

// Instance 2: only slot 1 visible, header hidden
const inst2 = comp.createInstance();
const header = inst2.children.find(c => c.name === "Header-Frame-Name");
if (header) header.visible = false;
const buttons = inst2.findAll(n => n.type === "INSTANCE" && n.name === "Row-Component-Name");
if (buttons[1]) buttons[1].visible = false; // hide slot 2
if (buttons[2]) buttons[2].visible = false; // hide slot 3
// relabel buttons[0] to item 4
screen.appendChild(inst2);
inst2.y = inst1.y + inst1.height + 4; // position directly below
```

---

## RULE #4 — Relabeling Text Inside Instances

Text nodes inside instances ARE editable. Find them by `characters` content or by known node ID path.

**Always do this in two passes — swap variant first, then relabel:**

```js
// Step 1: swap to correct variant (if needed)
try { tabInstance.swapComponent(targetVariantComponent); } catch(e) {}

// Step 2: find and relabel text — AFTER swap (swap resets characters)
const textNodes = instance.findAllWithCriteria({ types: ["TEXT"] });
for (const tn of textNodes) {
  // Skip pure numeric text (slider values like "0", "100")
  if (tn.characters && tn.characters.length > 2 && isNaN(Number(tn.characters))) {
    try {
      await figma.loadFontAsync(tn.fontName);
      tn.characters = "New Label";
      break;
    } catch(e) {}
  }
}
```

**If you know the exact node ID** (from an inspection call), use it directly — it's faster and more reliable:
```js
const labelNode = await figma.getNodeByIdAsync("I40:2887;983:87407;999:105710;999:105254");
await figma.loadFontAsync(labelNode.fontName);
labelNode.characters = "Reference scan";
```

---

## RULE #5 — Component State Mapping

When a component has multiple states, always use `swapComponent()` to pick the correct variant — don't try to fake states by changing colors.

**Pattern for state-aware component placement:**
```js
// Map your logical state to the component variant
const STATE_VARIANTS = {
  "before-scan-unselected": await figma.getNodeByIdAsync("COMP_ID_1"),
  "after-scan-selected":    await figma.getNodeByIdAsync("COMP_ID_2"),
  "after-scan-unselected":  await figma.getNodeByIdAsync("COMP_ID_3"),
  "disabled":               await figma.getNodeByIdAsync("COMP_ID_4"),
};

// Apply the right variant to each instance
for (let i = 0; i < instances.length; i++) {
  const state = getStateForItem(i); // your logic
  const variantComp = STATE_VARIANTS[state];
  try { instances[i].swapComponent(variantComp); } catch(e) {}
  // relabel after swap
  const texts = instances[i].findAllWithCriteria({ types: ["TEXT"] });
  for (const t of texts) { /* ... */ }
}
```

**Common variant name patterns to look for:**
- `State=Before Scan` / `State=After Scan` — scan state
- `Selected=Yes` / `Selected=No` — active/inactive tab
- `Expand=On` / `Expand=Off` — collapsed/expanded panel
- `Arch=Upper` / `Arch=Lower` / `Arch=Both` — jaw view
- `Scanning page=Scan` / `Scanning page=View` — toolbar context
- `Tab-Numbers=1..4` — number of tabs shown

---

## RULE #6 — Building Screen Flows: Clone, Don't Create From Scratch

For interaction flows showing real UI screens, always **clone source screens** rather than building from scratch.

**Pattern:**
```js
// 1. Clone the source screen
const src = await figma.getNodeByIdAsync("SOURCE_SCREEN_ID");
const clone = src.clone();
clone.name = "Step N — Description";
clone.x = X_POSITION;
clone.y = Y_POSITION;
flowContainer.appendChild(clone);

// 2. Replace components inside the clone with correct variant/state
//    - find Tab-Bar instance → remove it → create correct variant instance
//    - find Toolbar instance → remove it → create correct variant instance
//    - etc.

// 3. Add annotation overlay (dark frame with text) — this IS custom-drawn
const ann = figma.createFrame();
ann.name = "annotation";
ann.x = 1400; ann.y = 160;
// ... annotation content ...
clone.appendChild(ann);

// 4. Add callout badges pointing to specific UI areas
const callout = figma.createFrame();
callout.x = 0; callout.y = 76; // overlaid on tab bar
callout.resize(400, 40);
callout.fills = [{ type: "SOLID", color: { r: 0.2, g: 0.55, b: 0.85 } }];
callout.cornerRadius = 6;
clone.appendChild(callout);
```

**What to replace in each cloned screen:**
1. **Tab-Bar instance** — remove old, create new from correct `Tab-Numbers=N` variant, relabel tab text nodes
2. **Toolbar instance** — remove old, create new from correct `Scanning page=Scan/View` variant, hide tools as needed
3. **Layer panel instance** — remove old, create new from correct `Expand=On, Arch=Both` variant, relabel layer names
4. **Fix any stale text** (e.g. header title "Wellness scan" → "Dentures")

**Component replacement pattern:**
```js
async function replaceComponent(screen, componentName, newComp, x, y) {
  const old = screen.children.find(c => c.name === componentName);
  if (old) old.remove();
  const inst = newComp.createInstance();
  inst.name = componentName;
  inst.x = x; inst.y = y;
  screen.appendChild(inst);
  return inst;
}
```

---

## Step 1: Pre-Flight — Inspect the File

Before writing anything:

```js
const uiPage = figma.root.children.find(p => p.name === "TARGET_PAGE");
await figma.setCurrentPageAsync(uiPage);

// List all top-level nodes + their positions
const nodes = uiPage.children.map(n => ({
  id: n.id, name: n.name, type: n.type,
  x: Math.round(n.x), y: Math.round(n.y),
  w: Math.round(n.width), h: Math.round(n.height)
}));

// Find all ComponentSets on the page — these are your real components
figma.skipInvisibleInstanceChildren = true;
const compSets = uiPage.findAllWithCriteria({ types: ["COMPONENT_SET"] }).map(cs => ({
  id: cs.id, name: cs.name,
  variants: cs.children.map(c => ({ id: c.id, name: c.name, key: c.key }))
}));

// Next available X position
let maxX = 0;
for (const n of uiPage.children) maxX = Math.max(maxX, n.x + n.width);

return { nodes, compSets, nextX: Math.round(maxX) + 200 };
```

Use `get_screenshot` on any node to visually understand what already exists.

---

## Step 2: Read the Code

Before touching Figma, read the source files:

1. Find source file(s) — search by component name or feature keyword
2. Read the props/types interface — every prop is a potential state to document
3. Read enum/union types — each value = one card or screen
4. Note conditional renders — `workflow === 'dentures'`, `isDentures`, `hideCopilot`, etc.
5. Note non-obvious behavior: state machines, restrictions, hidden elements

**These are your handoff items:**
- Every `if (condition)` that hides a UI element → annotate it
- Every prop that changes a component's appearance → show it as a state card
- Every `type === 'treatment'` check → document which layer types trigger it
- Every `swapComponent` / variant switch in code → mirror it with the real Figma component variant

---

## Step 3: Plan What to Document

For each feature, decide which section types are needed:

| Section | When to use | Contents |
|---|---|---|
| **Component States** | Any interactive component | All variants: default, hover, active, disabled, loading, error, selected |
| **Conditional Visibility** | When code hides/shows tools or elements | Show the element, its condition, and what triggers hide/show |
| **Interaction Flow** | Multi-step features, wizards, scan flows | Cloned screens in sequence with real components in correct states |
| **Layer / Tab States** | Tab bars, layer panels, multi-step tabs | One card per tab state (Before Scan, After Scan, Selected, Disabled) |
| **Restrictions Table** | Rules that differ per context | Table: context → allowed/blocked → code condition |
| **Requirements Matrix** | Spec-driven features | Table: requirement → implementation → file location |
| **Motion Spec** | Animated transitions | Before/after frames with duration, easing, properties |

---

## Step 4: Create the Handoff Wrapper

One outer frame on the page. Use FIXED sizing (not HUG) since it sits directly on the canvas (not inside another auto-layout):

```js
const uiPage = figma.root.children.find(p => p.name === "PAGE_NAME");
await figma.setCurrentPageAsync(uiPage);

await figma.loadFontAsync({ family: "Inter", style: "Bold" });
await figma.loadFontAsync({ family: "Inter", style: "Regular" });

const wrapper = figma.createFrame();
wrapper.name = "HANDOFF — Feature Name";
wrapper.x = NEXT_X; // from Step 1
wrapper.y = 0;
wrapper.resize(2600, 200); // fixed width, height grows as sections are added
wrapper.layoutMode = "VERTICAL";
wrapper.primaryAxisSizingMode = "AUTO"; // vertical HUG
wrapper.counterAxisSizingMode = "FIXED"; // fixed width
wrapper.primaryAxisAlignItems = "MIN";
wrapper.counterAxisAlignItems = "MIN";
wrapper.itemSpacing = 80;
wrapper.paddingTop = 60; wrapper.paddingBottom = 80;
wrapper.paddingLeft = 60; wrapper.paddingRight = 60;
wrapper.fills = [{ type: "SOLID", color: { r: 0.96, g: 0.97, b: 0.99 } }];
uiPage.appendChild(wrapper);
wrapper.placeholder = true; // shimmer while building

// Title — append FIRST, then set FILL
const title = figma.createText();
title.fontName = { family: "Inter", style: "Bold" };
title.fontSize = 32;
title.characters = "Feature Name — Developer Handoff";
title.fills = [{ type: "SOLID", color: { r: 0.05, g: 0.1, b: 0.2 } }];
wrapper.appendChild(title);
title.layoutSizingHorizontal = "FILL";
title.textAutoResize = "HEIGHT";

return { wrapperId: wrapper.id };
```

---

## Step 5: Build Sections

Each section is a FIXED-width frame inside the wrapper. Never use HUG on text children of FIXED frames — use `resize()` instead and set `textAutoResize = "HEIGHT"`.

**Text node pattern (works reliably inside FIXED-width frames):**
```js
function makeText(parent, txt, fontStyle, size, color, x, y, width) {
  const t = figma.createText();
  t.fontName = { family: "Inter", style: fontStyle };
  t.fontSize = size;
  t.characters = txt;
  t.fills = [{ type: "SOLID", color }];
  t.x = x; t.y = y;
  t.resize(width, 20); // fixed width first
  t.textAutoResize = "HEIGHT"; // then let height grow
  t.lineHeight = { value: Math.round(size * 1.5), unit: "PIXELS" };
  parent.appendChild(t);
  return t;
}
```

**Section frame pattern:**
```js
const sec = figma.createFrame();
sec.name = "01 — Section Title";
sec.resize(2480, 200); // fixed width matching wrapper inner width
sec.layoutMode = "VERTICAL";
sec.primaryAxisSizingMode = "AUTO"; // HUG vertical
sec.counterAxisSizingMode = "FIXED";
sec.itemSpacing = 24;
sec.paddingTop = 40; sec.paddingBottom = 40;
sec.paddingLeft = 40; sec.paddingRight = 40;
sec.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
sec.cornerRadius = 12;
sec.effects = [{ type: "DROP_SHADOW", color: { r: 0, g: 0, b: 0, a: 0.06 }, offset: { x: 0, y: 2 }, radius: 12, spread: 0, visible: true, blendMode: "NORMAL" }];
wrapper.appendChild(sec);
// Add title and content...
```

---

## Step 6: Component State Cards

For each component with multiple states, show each state using the **real Figma component variant** — not a drawing.

**Full pattern:**
```js
// 1. Find all variants of the component
const compSet = await figma.getNodeByIdAsync("COMPONENT_SET_ID");
const variants = compSet.children; // array of Component nodes

// 2. For each state, create an instance of the correct variant
for (const variantComp of variants) {
  const inst = variantComp.createInstance();
  
  // 3. If the variant has text to update, do it
  const texts = inst.findAllWithCriteria({ types: ["TEXT"] });
  for (const t of texts) {
    if (t.characters === "Placeholder" || t.name === "Label") {
      await figma.loadFontAsync(t.fontName);
      t.characters = "Actual label text";
    }
  }

  // 4. Build a card: label + instance + annotation
  const card = figma.createFrame();
  card.name = variantComp.name;
  card.x = cardX; card.y = 0;
  card.resize(CARD_WIDTH, 100);
  card.layoutMode = "VERTICAL";
  card.primaryAxisSizingMode = "AUTO";
  card.counterAxisSizingMode = "FIXED";
  card.itemSpacing = 12;
  card.paddingTop = card.paddingBottom = 16;
  card.paddingLeft = card.paddingRight = 16;
  card.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  card.cornerRadius = 8;
  card.strokeWeight = 1.5;
  card.strokes = [{ type: "SOLID", color: { r: 0.85, g: 0.88, b: 0.95 } }];
  rowFrame.appendChild(card);

  // State label
  makeText(card, variantComp.name, "Semi Bold", 12, { r: 0.1, g: 0.1, b: 0.2 }, 0, 0, CARD_WIDTH - 32);
  
  // Real component instance
  card.appendChild(inst);
  
  // Annotation: what this state means + code condition
  makeText(card, "Trigger: ...\nCode: condition === value", "Regular", 11, { r: 0.4, g: 0.4, b: 0.5 }, 0, 0, CARD_WIDTH - 32);
}
```

---

## Step 7: Conditional Visibility Documentation

For any element that is conditionally hidden in code, document it with:
1. The element shown in its visible state (real component instance)
2. The condition that hides it
3. A "HIDDEN" state card showing what it looks like when removed (empty space or grayed out)

**Color coding for visibility:**
- ✅ Green background `{ r: 0.94, g: 0.98, b: 0.94 }` — element shown
- 🚫 Red background `{ r: 1, g: 0.93, b: 0.93 }` — element hidden
- Border color matches: shown = `{ r: 0.2, g: 0.65, b: 0.3 }`, hidden = `{ r: 0.8, g: 0.2, b: 0.2 }`

**Annotation format for hidden elements:**
```
HIDDEN — [condition that hides it]
Spec: "[exact spec requirement text]"
Code: [file.tsx — exact variable/condition name]
```

---

## Step 8: Interaction Flow Screens

For multi-step flows, build a horizontal sequence of cloned real screens.

**Full flow pattern:**

```js
// 1. Create the flow container
const flowContainer = figma.createFrame();
flowContainer.name = "FLOW — Feature Name (N Screens)";
flowContainer.x = X_POS; flowContainer.y = Y_POS;
flowContainer.resize(N * (1920 + 100) + 120, 1420);
flowContainer.fills = [{ type: "SOLID", color: { r: 0.93, g: 0.95, b: 0.99 } }];
flowContainer.cornerRadius = 16;
uiPage.appendChild(flowContainer);

// 2. For each step, clone the appropriate source screen
const SCREEN_W = 1920;
const GAP = 100;
const SCREEN_Y = 216; // below step label
const LABEL_Y = 160;

for (let i = 0; i < steps.length; i++) {
  const x = 60 + i * (SCREEN_W + GAP);
  
  // Clone
  const src = steps[i].isViewScreen ? viewSrc : scanSrc;
  const clone = src.clone();
  clone.name = steps[i].label;
  clone.x = x; clone.y = SCREEN_Y;
  flowContainer.appendChild(clone);

  // Step label banner (colored)
  const labelFrame = figma.createFrame();
  labelFrame.x = x; labelFrame.y = LABEL_Y;
  labelFrame.resize(SCREEN_W, 48);
  labelFrame.fills = [{ type: "SOLID", color: steps[i].color }];
  labelFrame.cornerRadius = 8;
  flowContainer.appendChild(labelFrame);
  makeText(labelFrame, `STEP ${i+1} · ${steps[i].shortLabel}`, "Bold", 17, { r: 1, g: 1, b: 1 }, 20, 12, SCREEN_W - 40);

  // Arrow
  if (i < steps.length - 1) {
    const arrowF = figma.createFrame();
    arrowF.x = x + SCREEN_W + 10; arrowF.y = SCREEN_Y + 500;
    arrowF.resize(80, 48);
    arrowF.fills = [{ type: "SOLID", color: { r: 0.82, g: 0.86, b: 0.94 } }];
    arrowF.cornerRadius = 24;
    flowContainer.appendChild(arrowF);
    makeText(arrowF, "→", "Bold", 26, { r: 0.3, g: 0.35, b: 0.5 }, 20, 6, 50);
  }

  // Replace components on the clone
  await replaceTabBar(clone, steps[i].tabVariantId, steps[i].tabLabels, steps[i].activeTabIdx, steps[i].scannedIdxs);
  await replaceToolbar(clone, steps[i].toolbarComp, steps[i].toolbarX, steps[i].toolbarY);
  
  // Add annotation overlay
  const ann = figma.createFrame();
  ann.x = 1380; ann.y = 160;
  ann.resize(520, 400);
  ann.fills = [{ type: "SOLID", color: { r: 0.05, g: 0.1, b: 0.25 }, opacity: 0.9 }];
  ann.cornerRadius = 10;
  clone.appendChild(ann);
  makeText(ann, `STEP ${i+1} — ${steps[i].label}`, "Semi Bold", 13, { r: 0.6, g: 0.85, b: 1 }, 16, 16, 480);
  makeText(ann, steps[i].annotationText, "Regular", 11, { r: 0.82, g: 0.88, b: 0.97 }, 16, 42, 480);
}
```

---

## Step 9: Requirements Traceability Table

For spec-driven features, always add a requirements matrix. This maps each spec requirement to the code implementation:

```js
const reqs = [
  { priority: "P1", requirement: "Requirement text from spec", status: "✅", codeLocation: "file.tsx — exact variable/condition" },
  // ...
];

// Table header row
const headerRow = figma.createFrame();
headerRow.resize(2400, 44);
// ... dark background, white text labels ...

// One row per requirement
for (const req of reqs) {
  const row = figma.createFrame();
  row.resize(2400, 48);
  // Priority (60px) | Requirement (700px) | Status (60px) | Code Location (1580px)
  makeText(row, req.priority, "Bold", 12, priorityColor, 0, 12, 60);
  makeText(row, req.requirement, "Regular", 12, darkText, 60, 12, 700);
  makeText(row, req.status, "Regular", 14, greenText, 760, 12, 60);
  makeText(row, req.codeLocation, "Regular", 11, blueText, 820, 12, 1580);
}
```

---

## Step 10: Annotation Overlays

Two types of annotation overlays to add on top of cloned screens:

**1. Annotation panel** (dark blue, top-right of screen) — explains the step:
```js
const annPanel = figma.createFrame();
annPanel.name = "annotation";
annPanel.x = 1380; annPanel.y = 160; // top-right area of a 1920-wide screen
annPanel.resize(520, 400);
annPanel.fills = [{ type: "SOLID", color: { r: 0.05, g: 0.1, b: 0.25 }, opacity: 0.9 }];
annPanel.cornerRadius = 10;
screen.appendChild(annPanel);
// Lines: [text, isBold]
for (const [text, bold] of lines) {
  makeText(annPanel, text, bold ? "Semi Bold" : "Regular",
    bold ? 13 : 11, bold ? { r: 0.6, g: 0.85, b: 1 } : { r: 0.82, g: 0.88, b: 0.97 },
    16, currentY, 480);
}
```

**2. Callout badge** (colored strip at top of screen) — points to a specific element:
```js
const callout = figma.createFrame();
callout.name = "callout";
callout.x = 0; callout.y = 76; // overlaid on the tab bar area
callout.resize(440, 40);
callout.fills = [{ type: "SOLID", color: { r: 0.2, g: 0.55, b: 0.85 } }];
callout.cornerRadius = 6;
screen.appendChild(callout);
makeText(callout, "↑  Explanation of what changed here", "Semi Bold", 13, { r: 1, g: 1, b: 1 }, 10, 10, 416);
```

**3. Highlight overlay** (colored translucent rect over a specific UI zone):
```js
const highlight = figma.createFrame();
highlight.name = "highlight-zone";
highlight.x = ZONE_X; highlight.y = ZONE_Y;
highlight.resize(ZONE_W, ZONE_H);
highlight.fills = [{ type: "SOLID", color: { r: 0.9, g: 0.1, b: 0.1 }, opacity: 0.18 }];
highlight.strokeWeight = 2;
highlight.strokes = [{ type: "SOLID", color: { r: 0.85, g: 0.1, b: 0.1 } }];
highlight.cornerRadius = 6;
screen.appendChild(highlight);
```

---

## Step 11: Validate Visually

After each section, call `screenshot()` on the wrapper or section:

```js
const screenshot = await sec.screenshot({ scale: 0.25 });
return { secId: sec.id, screenshot };
```

Check:
- [ ] All real component instances render correctly — not placeholder frames
- [ ] Tab labels match the expected text for each state
- [ ] Component variants show the correct state (Before Scan vs After Scan, etc.)
- [ ] Annotation text is readable (light on dark)
- [ ] Callout badges align with what they're pointing to
- [ ] Hidden elements are actually hidden (not just transparent)
- [ ] No overlapping with existing canvas content

---

## Step 12: Code Connect

After the section is visually complete:

```js
send_code_connect_mappings({
  fileKey: "FILE_KEY",
  nodeId: "WRAPPER_NODE_ID",
  mappings: [
    {
      nodeId: "CARD_NODE_ID",
      componentName: "ComponentName — State Name",
      source: "src/components/ComponentName.tsx",
      label: "React"
    }
  ]
})
```

---

## Common Failures & Fixes

| Failure | Root Cause | Fix |
|---------|-----------|-----|
| Custom-drawn tab bar instead of real component | Skipped inspection phase | Always inspect first: find the ComponentSet, list variants, clone the right one |
| `Cannot move node — new parent is an instance` | Tried to appendChild inside an instance | Create a second instance, hide unused slots, relabel what you need |
| Text relabeling had no effect | Forgot to `await figma.loadFontAsync()` before changing `characters` | Load font → await → then mutate |
| Wrong tab state shown (all look the same) | Didn't swap variants — all tabs use default variant | Use `swapComponent(variantNode)` to apply Before Scan / After Scan / Selected state |
| `getNodeByIdAsync` returns null | Wrong page context | `await figma.setCurrentPageAsync(targetPage)` at the start of every call |
| `layoutSizingHorizontal = "FILL"` throws | Node not yet inside an auto-layout parent | `parent.appendChild(child)` FIRST, then set FILL |
| Text overflows its container | `textAutoResize` not set | Always set `t.resize(width, 20)` then `t.textAutoResize = "HEIGHT"` |
| Sections overlap existing content | Didn't check canvas bounds | Query `maxX` of all page children before placing; add 200px gap |
| Component shows wrong variant after relabel | Relabeled BEFORE swapping — swap resets text | Always: swap → then relabel |
| `importComponentByKeyAsync` fails | Component is local (not from external library) | Use `figma.getNodeByIdAsync(nodeId)` to get local components directly |

---

## Reference Files

- `references/state-checklist.md` — every state every component type must document
- `references/annotation-guide.md` — what to annotate, how to phrase it, examples
- `references/handoff-page-map.md` — tracking table for section positions across files
