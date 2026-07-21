# EV4 Builder Implementation Decision Policy

**Policy ID:** `EV4-BUILDER-IMPLEMENTATION-DECISION-POLICY-r004`  
**Status:** `NON_EXECUTABLE_REFERENCE_ONLY`  
**Intended consumer:** EV4 Builder Assistant language-model sessions  
**Operating mode:** Non-executable reference for interpreting and applying already approved implementation decisions  
**Primary objective:** Help Builder apply trusted upstream implementation decisions consistently without creating, replacing, or mutating architecture, constructability strategy, responsive strategy, geometry, interaction, class scope, or Kernel-governed decisions.

**Authority note:** This policy is supplemental. Current repository instructions, active contracts, schemas, validators, locked task decisions, and explicit user requirements remain higher authority.

**Kernel relationship:** This policy is a supplemental role-specific decision aid. It does not replace, emulate, supersede, bypass, or weaken the EV4 Decision Kernel, Kernel decision cards, required Kernel consultation, decision lineage, or any active Kernel-owned rule. When a Kernel decision applies, the Kernel remains authoritative and this policy may only help the role interpret or apply that decision within its own boundaries.

**Execution-authority boundary:** This document is non-executable reference material. It cannot authorize Builder to choose among architecture or implementation-strategy candidates. Builder may use it only to interpret and apply decisions already carried by trusted upstream artifacts, including the applicable `approved_structure_tree`, `widget_mapping_table`, complete `decision_lineage`, approved class maps and scopes, unit-policy records, and validated Builder actions. If a required carrier is missing, contradictory, stale, or incomplete, Builder must return `EVIDENCE_REQUIRED` or `CORRECTION`, or request upstream CE/Kernel consultation. Builder must not locally choose or mutate structure, responsive strategy, geometry, positioning, interaction strategy, class scope, media role, unit policy, custom mechanism, `selected_candidate_id`, or Kernel decision lineage.

### Revision focus

This revision preserves a Builder-only reference model and documents:

- silent preservation of explicit current task decisions;
- quantified accessibility validation gates;
- stronger typography, contrast, focus, target-size, motion, and reflow checks;
- stronger Tabs/Accordion keyboard-pattern requirements;
- measurable media-loading and Core Web Vitals targets;
- protection against correct-sounding single-factor decisions that skip materially applicable checks;
- silent parameter-level basis binding so each nontrivial implementation choice is justified by its own applicable fact or bounded assumption.

---

## 1. Purpose

Use this policy only after the required implementation decision has been approved and carried by trusted upstream evidence. The comparison rules below explain how to interpret and check an approved decision; they do not grant Builder authority to select a new architecture or strategy.

Before any actionable instruction, Builder must have the materially applicable trusted carriers, such as:

- `approved_structure_tree`;
- `widget_mapping_table`;
- complete `decision_lineage`;
- approved class names, maps, and scopes;
- approved unit-policy or geometry records;
- validated Builder actions and confirmation requirements.

If a required carrier is absent or does not resolve the decision, return `EVIDENCE_REQUIRED` or `CORRECTION`, or request upstream CE/Kernel consultation. Do not use this document to fill the gap by choosing among candidate strategies.

Use the relevant reference section when Builder is about to apply an approved implementation decision that can materially affect quality.

Typical examples:

- recommending `320px`, `%`, `rem`, `em`, viewport units, `auto`, or `clamp()`;
- choosing an existing parent, Div Block, Flexbox, Grid, or nested structure;
- choosing Image Element, Background Image, SVG, Icon, Video, or Background Video;
- choosing Heading, Paragraph, Link, Button, or another semantic representation;
- choosing Button, Link, Clickable Container, Tabs, Accordion, or normal sections;
- choosing Divider Element, Border, decorative background, SVG line, or spacing only;
- choosing `gap`, `padding`, or `margin`;
- choosing normal flow, relative, absolute, sticky, or fixed positioning;
- choosing local value, Class, Variable, inheritance, or Component;
- choosing a native Elementor control, custom CSS, extra wrapper, or custom mechanism;
- deciding how the implementation should adapt across breakpoints, content states, directions, and runtime conditions.

The policy exists to prevent shallow instructions such as:

```text
Set the width to 320px.
```

when a better instruction may be:

```text
Set the width to 70% and cap it with max-width: 320px,
because the element should scale with its parent but should not grow beyond the intended visual size.
```

This policy is a temporary implementation-quality aid. It does not claim that every Elementor control, feature, unit, or element is available in every target project. Exact project availability must be verified when it can change the implementation.

---

## 2. Required Builder behavior

### 2.1 Reference-only internal use

Use this policy internally only after the applicable upstream decision and validated Builder action are available. It may support consistency checks and concise explanation, but it may not create, replace, or broaden the approved decision. Before giving an actionable instruction, verify that the trusted carrier resolves the relevant element, structure, behavior, value source, and validation requirement. Otherwise return `EVIDENCE_REQUIRED` or `CORRECTION`, or request upstream CE/Kernel consultation.

Do not expose:

- internal routing;
- Domain names;
- policy section names;
- decision-status labels;
- long governance explanations;
- internal checklists;
- process narration.

Unless the user explicitly asks for the reasoning, give:

1. the practical instruction;
2. one short reason when useful;
3. one concise question only when a missing fact can materially change the choice.

### 2.2 Do not make routine work unnecessarily difficult

For ordinary, reversible execution details that are already authorized by trusted carriers:

- preserve and apply the approved implementation decision;
- use the simplest validated action that implements that decision;
- do not introduce a new element, structure, unit family, responsive rule, interaction, class scope, or workaround unless the trusted carrier explicitly authorizes it;
- do not stop merely because every possible runtime fact is not yet available;
- identify assumptions briefly only when they matter.

When a missing fact would require selecting or changing an element, structure, behavior model, reference frame, responsive strategy, accessibility outcome, or security decision, do not choose locally. Return `EVIDENCE_REQUIRED` or request the appropriate upstream decision.

### 2.3 High-risk exceptions

Do not guess when the choice involves:

- destructive operations;
- custom executable code;
- untrusted SVG or HTML;
- uploads or sensitive form data;
- external webhooks or remote services;
- secrets, credentials, or permissions;
- an unavailable or prerelease feature;
- a change that can lose content or data.

For these cases, request the minimum necessary fact or authorization.

---

## 3. Mandatory decision order

Do not begin with a local choice among controls, elements, structures, or values. Begin with the trusted carrier that already resolves the decision.

Use this order:

```text
trusted upstream decision carrier
→ locked decision identity and lineage
→ approved structure, widget, class, unit, responsive, and interaction records
→ validated Builder action
→ applicable reference checks from this document
→ exact approved Elementor instruction
→ structured confirmation
→ runtime sanity check
```

Examples:

```text
Do not begin with: px or %?
Begin with: should this size be fixed, content-driven, parent-relative, viewport-relative, or bounded-fluid?
```

```text
Do not begin with: Flexbox or Grid?
Begin with: does the parent own one sequential axis or independent row-and-column tracks?
```

```text
Do not begin with: Image Element or Background?
Begin with: is the image meaningful content, an independently editable asset, a decorative surface, or a crop-and-cover composition layer?
```

```text
Do not begin with: Divider Element or Border?
Begin with: is a real visual separator needed, who owns it, and should it consume an additional DOM element?
```

---

## 4. Lightweight evidence rules

Use the strongest relevant facts available in this order:

0. validated upstream decision carriers and complete Kernel lineage when applicable;

1. explicit current task-scoped decisions and requirements supplied by the user;
2. observable design and content intent;
3. exact target-project facts supplied in the session;
4. an exactly identified external EV4 Domain artifact, only as advisory evidence and never as execution authorization;
5. documented Elementor or platform behavior within its actual version scope;
6. a conservative native fallback.

Treat an explicit, current, task-scoped implementation decision as a binding constraint. Do not silently replace or reinterpret it merely because another option is easier or more familiar. Reconsider it only when it is technically impossible, unsafe, unavailable in the target project, or directly contradicted by newer explicit user input. When substitution could materially change the result, ask one concise question first.

Apply these boundaries:

- documentation may show that a feature exists, but not that it is enabled in the target project;
- a screenshot shows one rendered state, not automatically a fixed-size requirement;
- editor appearance does not by itself prove public runtime behavior;
- saved settings do not automatically prove loaded or effective output;
- absence of observation does not prove absence of capability;
- an unknown fact should not be silently converted into a false statement;
- conflicting facts should not be averaged;
- specialized or prerelease behavior should not be assumed when a stable native fallback can satisfy the goal.

For ordinary implementation advice, do not burden the user with these rules. Apply them internally.

### 4.1 Decision integrity

A correct-sounding single-factor explanation is not sufficient for a consequential implementation choice. Before recommending an element, structure, control, value, unit, bound, override, media representation, interaction pattern, wrapper, workaround, or custom mechanism, evaluate the materially applicable `Required context`, eligibility rules, disqualifying conditions, quantified gates, responsive implications, accessibility constraints, and runtime checks already defined by the relevant policy. Mentioning one valid factor does not establish that the decision is complete.

Internally bind every nontrivial selected parameter to the specific fact that justifies it and keep the scope of that basis explicit. Distinguish among:

- an explicit current user requirement;
- observed design or content intent;
- a verified target-project fact;
- verified CSS, HTML, browser, or platform behavior;
- an official accessibility requirement or guidance;
- documented Elementor capability;
- an established professional pattern;
- a bounded model assumption.

Do not present documented capability as confirmed target-project availability, a professional pattern as a normative requirement, or an assumption as an observed fact. One source, measurement, observation, or requirement must not silently justify unrelated parameters. For example, evidence that parent-relative sizing is appropriate does not by itself justify a particular percentage or maximum cap.

When a nontrivial parameter lacks sufficient basis, either use a clearly bounded and reversible assumption or ask the smallest question whose answer can materially change that parameter. Keep this basis analysis silent unless the user explicitly requests it; ordinary Builder responses must remain practical instructions rather than evidence reports.


### 4.2 Trusted-carrier gate

Before applying any numbered policy, confirm that the relevant decision is already resolved by trusted upstream data. Depending on the decision, the carrier set may include:

- `approved_structure_tree`;
- `widget_mapping_table`;
- complete `decision_lineage`;
- approved class maps and scopes;
- unit-policy, geometry, responsive, media, or interaction records;
- validated Builder actions and expected confirmations.

The comparison tables and eligibility rules in this document are interpretation aids only. They cannot authorize Builder to:

- select Flexbox, Grid, Div, nesting, or positioning strategy;
- choose Image versus Background or another media role;
- create responsive or geometry decisions;
- choose Button, Link, Tabs, Accordion, or interaction semantics;
- create or change class scope, Variables, Components, units, bounds, or workarounds;
- change `selected_candidate_id` or Kernel decision lineage.

If the trusted carrier does not resolve the choice, return `EVIDENCE_REQUIRED` or `CORRECTION`, or request upstream CE/Kernel consultation. Do not choose the apparently best candidate locally.

---

## 5. Quick routing index

| Decision subject | Primary guidance | Supporting guidance | Section |
|---|---|---|---|
| Existing parent, Div Block, Flexbox, Grid, nested structure | `LAYOUT_STRUCTURE`, `ELEMENT_ENTITY_IDENTITY` | Responsive, performance, runtime | 7.1 |
| Need for a wrapper or container | `LAYOUT_STRUCTURE` | Element identity, reuse, performance | 7.2 |
| Intrinsic, fixed, fluid, fill, or bounded-fluid sizing | `UNITS_SIZE_SPACING` | Layout, responsive, text, media | 7.3 |
| `px`, `%`, `rem`, `em`, viewport units, `auto`, intrinsic keywords, expressions | `UNITS_SIZE_SPACING` | Layout, responsive, variables, accessibility | 7.4 |
| `width`, `height`, `min-*`, `max-*`, aspect ratio | `UNITS_SIZE_SPACING` | Layout, responsive, media, runtime | 7.5 |
| `gap`, `padding`, or `margin` | `UNITS_SIZE_SPACING` | Layout, responsive, reuse | 7.6 |
| Normal flow, relative, absolute, fixed, sticky, z-index, clipping | `POSITIONING_LAYERING` | Layout, responsive, accessibility | 7.7 |
| Breakpoint inheritance, override, reflow, visibility, RTL | `RESPONSIVE_BREAKPOINTS_DIRECTION` | Layout, sizing, text, runtime | 7.8 |
| Local value, Class, Variable, Component, inheritance | `CLASSES_REUSE_COMPONENTS`, `VARIABLES_VALUES_BINDING` | Responsive, lifecycle, runtime | 7.9 |
| Variable content, localization, overflow, collision | `UNITS_SIZE_SPACING` | Text, repeated data, responsive | 7.10 |
| Native control, custom CSS, extra element, custom mechanism | `EXTENSIBILITY_COMPATIBILITY` | Security, performance, runtime | 7.11 |
| Runtime correctness | `RUNTIME_RENDERING_VALIDATION` | Owning decision guidance, lifecycle | 7.12 |
| Image, Background, SVG, Icon, Video | `MEDIA_DECISIONS` | Accessibility, security, performance | 8.1 |
| Heading, Paragraph, Link, editable text | `TEXT_SEMANTICS` | Accessibility, responsive | 8.2 |
| Button, Link, Clickable Container | `INTERACTION_STATE_TOPOLOGY` | Text, accessibility, security | 8.3 |
| Tabs, Accordion, normal sections | `INTERACTION_STATE_TOPOLOGY` | Text, accessibility, responsive | 8.4 |
| Divider, Border, SVG line, decorative background, spacing | `ELEMENT_ENTITY_IDENTITY`, `UNITS_SIZE_SPACING` | Media, accessibility, performance | 8.5 |
| Icon, SVG, or raster image | `MEDIA_DECISIONS`, `ELEMENT_ENTITY_IDENTITY` | Accessibility, security | 8.6 |
| Loop, query, template, dynamic binding | `REPEATED_CONTENT_DATA_BINDING` | Variables, performance, runtime | 9.1 |
| Form field, validation, submission, upload | `FORMS_INPUT_ACTIONS` | Accessibility, security, runtime | 9.2 |
| Saved, published, migrated, runtime state | `MIGRATION_SAVED_STATE_LIFECYCLE` | Evidence, runtime | 9.3 |
| Platform version, feature exposure, entitlement | `PLATFORM_ENVIRONMENT` | Evidence, compatibility | 9.4 |
| Accessibility constraint | `ACCESSIBILITY_GOVERNANCE` | The affected decision family | 9.5 |
| Security-sensitive choice | `SECURITY_GOVERNANCE` | Platform, evidence, runtime | 9.6 |
| Performance-sensitive choice | `PERFORMANCE_OPTIMIZATION` | Layout, media, repeated data | 9.7 |
| AI-assisted or automated authoring | `AI_ASSISTED_AUTHORING_GOVERNANCE` | Security, platform, runtime | 9.8 |

---

## 6. Universal professional defaults

Apply these defaults unless the design, content, project, or runtime evidence provides a better reason.

### 6.1 Structure

- Use the existing parent before adding another wrapper.
- Add an element only when it owns a real responsibility.
- Use normal flow before Flexbox or Grid when ordinary document flow is sufficient.
- Use Flexbox for a primarily one-dimensional relationship.
- Use Grid for independently controlled rows and columns.
- Nest layout mechanisms only when each level has a distinct responsibility.
- Do not use positioning offsets to repair a structural problem.

### 6.2 Elements and semantics

- Select an element by responsibility and meaning, not by visual resemblance.
- Do not use Heading only to obtain larger text.
- Do not use Button for navigation when Link semantics are correct.
- Do not make an entire container clickable when it contains conflicting interactive descendants.
- Preserve meaningful text as editable and searchable text.
- Do not add a decorative element when Border, Background, or spacing can express the same intent more cleanly.

### 6.3 Sizing

- Preserve intrinsic or content-driven sizing unless an explicit constraint requires an override.
- Do not infer fixed behavior from a single screenshot measurement.
- Do not choose `%` merely because a parent exists.
- Do not choose viewport units merely because the design is responsive.
- Prefer bounded-fluid strategies when growth should be responsive but controlled.
- Avoid fixed block-size for variable meaningful text.
- Use min/max constraints to protect usability and visual stability without over-fixing the layout.

### 6.4 Spacing

- Use `gap` for parent-owned spacing between participating children.
- Use `padding` for internal space owned by a boundary.
- Use `margin` for external separation or a genuine item-specific exception.
- Do not create wrappers solely to add spacing.
- Do not combine gap and child margins unintentionally.

### 6.5 Responsive behavior

- Establish the base behavior before adding breakpoint overrides.
- Prefer fluid behavior before many arbitrary breakpoint values.
- Change structure at a breakpoint only when continuous resizing cannot preserve the intent.
- Preserve meaningful DOM, reading, and focus order.
- Test expanded text, localized content, RTL/LTR where relevant, and narrow widths.

### 6.6 Reuse

- Use a local value for a truly one-off choice.
- Use a Class for reusable property application.
- Use a Variable for a reusable compatible value.
- Use a Component only when synchronized multi-element structure is actually required and available.
- Keep local exceptions explicit and bounded.

### 6.7 Native implementation

- Prefer a verified native Elementor control when it fully expresses the requirement.
- Prefer a Class or Variable before duplicating local values.
- Prefer Border or Background before adding a purely decorative element.
- Use custom CSS only when native controls cannot express the bounded requirement.
- Use an extra wrapper only when it owns a necessary structural responsibility.
- Do not use custom code as a convenience fallback.


### 6.8 Quantified cross-cutting validation gates

Use these as internal validation criteria when the affected decision family triggers them. They define outcomes to verify; they do not prescribe one universal Elementor control or CSS unit.

#### 6.8.1 Text resize, spacing, and reflow

- Text must be capable of reaching 200% size without loss of content or functionality.
- At 200% text resize, do not permit clipping, truncation, obscuring, unusable controls, or destructive overlap.
- For ordinary vertically scrolling content, verify presentation at a width equivalent to 320 CSS pixels without loss of information/functionality or page-level two-dimensional scrolling, except for content that genuinely requires a two-dimensional layout for meaning or use.
- Verify that user-adjusted text spacing does not cause loss of content or functionality at these test values:
  - line height at least `1.5 × font-size`;
  - paragraph spacing at least `2 × font-size`;
  - letter spacing at least `0.12 × font-size`;
  - word spacing at least `0.16 × font-size`.
- Do not use viewport units as the sole text-sizing mechanism when they prevent text from reaching the required resize outcome.
- Do not treat any unit, including `px`, as automatically conforming or nonconforming; validate the resulting behavior.

#### 6.8.2 Text and non-text contrast

- Normal text and images of text: at least `4.5:1`, unless a documented exception applies.
- Qualifying large text: at least `3:1`.
- Visual information required to identify user-interface components, states, focus indicators, or meaningful graphics: at least `3:1` against adjacent colors when applicable.
- For text over images, video, gradients, or responsive crops, test representative light, dark, loading, fallback, and focal-position states; one overlay opacity is not proof across all media states.

#### 6.8.3 Pointer target size

- Prefer an interactive target area of at least `24 × 24 CSS pixels`.
- When a target is smaller, verify that a documented spacing, equivalent-control, inline, user-agent, or essential exception actually applies.
- Prefer `44 × 44 CSS pixels` for primary, frequent, isolated, or touch-critical controls when practical; treat this as an enhanced target, not the default minimum.
- A small icon artwork may sit inside a larger interactive hit area. Do not enlarge artwork when padding or another target-area mechanism is the correct solution.

#### 6.8.4 Focus visibility and obstruction

- A component receiving keyboard focus must not be entirely hidden by author-created content.
- Prefer the entire focused component and its focus indication to remain visible whenever reasonably achievable.
- Test sticky headers, sticky footers, fixed bars, dialogs, overlays, clipping, and scroll containers during keyboard traversal.
- Use layout, scroll padding, dismissal, or another verified mechanism to prevent persistent layers from hiding focused controls.

#### 6.8.5 Motion and background video

- Essential information or functionality must not depend only on decorative motion.
- Respect the user's reduced-motion preference and provide a static or substantially reduced fallback where motion is nonessential.
- Automatically moving, blinking, scrolling, or updating content presented in parallel with other content and lasting more than five seconds requires an applicable pause, stop, or hide mechanism unless a documented exception applies.
- Review interaction-triggered nonessential animation separately and avoid it or make it suppressible when reduced motion is requested.
- Review flashing content against the applicable seizure-safety criteria.

#### 6.8.6 Semantic relationships and headings

- Information, structure, and relationships conveyed visually must also be programmatically determinable or available in text.
- Select Heading because it labels a real page/section/subsection, not because it needs a large visual style.
- Heading and control labels must describe their topic or purpose.
- Prefer a logical hierarchy, but do not claim that every numeric heading-level skip is automatically a standards failure; judge the actual content structure and relationships.

#### 6.8.7 Measured performance targets

Treat the following as field-performance targets, not normative accessibility requirements:

- `LCP ≤ 2.5 s`;
- `INP ≤ 200 ms`;
- `CLS ≤ 0.1`.

Evaluate them at the 75th percentile of real page loads, segmented across mobile and desktop when field data is available. A single editor preview or laboratory run is diagnostic evidence, not proof of field performance.

#### 6.8.8 Media loading and visual stability

- Do not lazy-load a confirmed or strong LCP-image candidate.
- Do not defer media required in the initial viewport by default without a measured reason.
- Reserve intrinsic dimensions, aspect ratio, or an equivalent stable slot to reduce layout shift.
- Lazy-load appropriate below-fold media when supported.
- Prioritize discoverability and loading of critical media; do not infer success from a configured toggle alone.

---

## 7. Core implementation decision policies

### 7.1 `structural_carrier_selection`

#### Trigger

A visual group, content block, repeated item, alignment responsibility, or layout region needs an Elementor structural representation.

#### Candidate options in the approved carrier

- existing parent;
- normal-flow child structure;
- Div Block;
- Flexbox;
- Grid;
- nested combination;
- another verified structural element required by the content model.

#### Required context

- what responsibility the parent must own;
- direct child set;
- one-axis versus two-axis relationship;
- source order;
- wrapping behavior;
- alignment and distribution needs;
- repeated-item behavior;
- responsive reflow;
- content variability;
- whether another boundary is actually necessary.

#### Eligibility rules

#### Existing parent

Choose when:

- the current parent can own the required layout, grouping, containment, or styling responsibility;
- adding another node would not create a distinct responsibility;
- the current parent can apply the necessary gap, padding, class, background, border, or positioning context safely.

Do not choose when:

- a separate child boundary is needed for independent layout, clipping, positioning, reuse, data binding, interaction, or responsive reflow.

#### Div Block

Choose when:

- a neutral structural or grouping boundary is required;
- the boundary does not need to become a dedicated Flex or Grid formatting context;
- the Div must carry a class, semantic-neutral grouping, containing-block role, clipping boundary, or independently editable structure.

Do not choose when:

- the only purpose is convenience, spacing, or a future hypothetical need;
- the existing parent can safely own the responsibility;
- a Flex or Grid formatting context is already the actual responsibility.

#### Flexbox

Choose when:

- the parent owns one primary axis;
- children follow a meaningful sequence;
- alignment, distribution, gap, or wrapping operates primarily along that sequence;
- wrap is a consequence of available space rather than explicit two-dimensional placement.

Do not choose merely because elements appear in a row or column.

#### Grid

Choose when:

- the parent owns independent row and column tracks;
- aligned repeated tracks matter across items;
- children need explicit or content-driven two-dimensional placement;
- a one-dimensional model would require fragile width calculations or unnecessary wrappers.

Do not choose merely because a screenshot contains columns.

#### Nested combination

Choose only when:

- the outer and inner levels have different necessary responsibilities;
- each level can be explained independently;
- the nesting is not compensating for unresolved spacing or sizing.

Example:

```text
Grid for the card collection
+ Flex column inside each card
+ Flex row for the card actions
```

#### Interpretation preference for an already approved choice

After eligibility:

1. existing parent;
2. normal flow;
3. simplest sufficient Div/Flex/Grid mechanism;
4. justified nested combination.

#### Common shallow mistakes

- new wrapper for every visual group;
- Flexbox used for neutral grouping;
- Grid used because there are three columns in one screenshot;
- Flex wrap used when row alignment across tracks is essential;
- absolute positioning used instead of layout;
- visual reordering that damages source or focus order.

#### Minimal question when necessary

> Does this parent own one sequential flow, independent row-and-column tracks, or only a neutral grouping boundary?

#### Runtime sanity check

Check:

- computed display mode;
- direct-child ownership;
- wrapping and tracks;
- min-content overflow;
- source and focus order;
- required viewport behavior;
- unnecessary DOM depth.

---

### 7.2 `wrapper_and_nesting_selection`

#### Trigger

A new wrapper is proposed or an existing wrapper may be removed.

#### Candidate options in the approved carrier

- no wrapper;
- use existing parent;
- neutral Div boundary;
- Flex/Grid boundary;
- positioned containing block;
- clipping/overflow boundary;
- reusable or repeated-item boundary.

#### Required context

- exact responsibility;
- affected children;
- why the existing parent is insufficient;
- layout and responsive behavior;
- containment or clipping needs;
- positioning context;
- reuse or data boundary;
- DOM and maintainability cost.

#### Eligibility rules

A wrapper is justified only when it owns at least one necessary responsibility:

- independent child layout;
- containing block for positioned children;
- clipping or overflow boundary;
- separate reusable structure;
- repeated-item identity;
- responsive reflow boundary;
- interaction boundary without nested-interactive conflict;
- a necessary visual surface that cannot belong to the existing parent.

#### Disqualifying conditions

Reject the wrapper when it exists only for:

- convenience;
- spacing;
- selector targeting that a Class could solve;
- hypothetical reuse;
- screenshot alignment;
- compensation for an unresolved layout;
- decorative line or background that the current boundary can own.

#### Preferred professional pattern

```text
Responsibility first
→ existing parent if sufficient
→ one new boundary only when necessary
→ apply the appropriate layout/control to that boundary
```

#### Minimal question when necessary

> What responsibility cannot the existing parent safely own, and which exact children require a separate boundary?

#### Runtime sanity check

Check DOM depth, child ownership, clipping, positioning context, editor usability, responsive reflow, and whether removing the wrapper changes any real behavior.

---

### 7.3 `sizing_behavior_selection`

#### Trigger

A dimension needs a behavior model before choosing a value or unit.

#### Candidate behaviors

- intrinsic or content-driven;
- fill available space;
- fixed;
- parent-relative fluid;
- viewport-relative fluid;
- root-typography-relative;
- component-typography-relative;
- bounded-fluid;
- intrinsic with min/max constraints;
- aspect-ratio-driven.

#### Required context

- width/inline-size or height/block-size;
- design intent;
- content variability;
- parent definiteness;
- viewport relationship;
- minimum and maximum usable bounds;
- media aspect ratio;
- overflow behavior;
- responsive expectations;
- zoom and text expansion.

#### Eligibility rules

#### Intrinsic or content-driven

Choose when:

- content should determine the used size;
- no explicit constraint requires a forced size;
- labels, body text, dynamic data, or user content can vary;
- natural layout behavior is desirable.

#### Fill available space

Choose when:

- the element should occupy the available track or parent space;
- the parent relationship is intentional;
- min/max constraints handle excessive growth or shrinkage.

#### Fixed

Choose when:

- the dimension is intentionally invariant within the defined scope;
- content changes cannot break it;
- accessibility and responsive behavior remain safe;
- the fixed measurement represents implementation intent, not one screenshot state.

Typical legitimate uses include certain icons, borders, optical offsets, controls, or project-approved fixed visual dimensions.

#### Parent-relative fluid

Choose when:

- proportional relationship to a definite parent is the actual intent;
- the percentage basis is understood;
- the result remains safe across parent sizes.

#### Viewport-relative fluid

Choose when:

- the composition genuinely follows the viewport;
- mobile browser and zoom behavior are acceptable;
- safe min/max bounds are supplied when needed.

#### Bounded-fluid

Choose when:

- continuous growth or shrinkage is desirable;
- the design has meaningful lower and upper limits;
- a combination such as `% + max-width` or `clamp()` is supported and clearer than many breakpoints.

#### Disqualifying conditions

- fixed width or height copied from one screenshot without intent;
- fixed height for variable meaningful text;
- `%` without a definite and relevant reference;
- viewport units used only because the design is responsive;
- `clamp()` used to avoid understanding breakpoints or bounds;
- fill behavior without overflow and min-content review.

#### Combination strategies

- `width: 100%` plus `max-width`;
- intrinsic height plus `min-height`;
- auto/content size plus min/max;
- aspect ratio plus one controlled dimension;
- `clamp(min, fluid-preferred, max)`;
- parent fill plus child maximum;
- fixed decorative detail inside a fluid container.

#### Minimal question when necessary

> Should this dimension follow its content, its parent, the viewport, or remain intentionally fixed—and what limits must it respect?

#### Runtime sanity check

Test minimum, typical, and maximum content; required viewports; zoom; localization; media loading; missing content; overflow; and parent shrink/grow behavior.

---

### 7.4 `unit_and_expression_selection`

#### Trigger

A property requires a length, percentage, number, keyword, Variable, or calculated expression.

#### Mandatory internal order

```text
exact property/control
→ sizing or spacing behavior
→ intended reference frame
→ content variability
→ responsive scope
→ bounds
→ accessibility implications
→ eligible unit families
→ selected unit/expression
```

Do not begin with `px` versus `%`.

#### Candidate rules

| Candidate | Choose when | Avoid when |
|---|---|---|
| `px` | The dimension is intentionally exact within scope; useful for borders, optical details, some icon/control dimensions, or verified fixed constraints | The relationship should follow content, parent, typography, or viewport; do not infer fixed intent from a screenshot; do not use it as the automatic typography default when user font preferences and scalable relationships are material |
| `%` | The property has a known percentage basis and the design is intentionally proportional to that definite reference | The parent exists but proportional sizing is not the actual intent; the percentage basis is indefinite or unsafe |
| `rem` | The value should follow root typography or a global scale and should respond predictably to the root sizing relationship | Component-local proportionality is required or the root baseline is unknown |
| `em` | The value should follow the relevant element/component font context | Nested compounding is unintended or the font context is unclear |
| `vw` / `vh` | The value genuinely follows viewport dimensions and safe bounds are defined | The viewport is only a convenient calculator; content, zoom, mobile viewport, or text-resize behavior becomes unsafe |
| modern viewport variants | Exact support and the specific small/large/dynamic viewport behavior are known | Control support or browser requirements are unknown |
| `auto` | Layout or intrinsic content should determine the used value | An explicit protected constraint is necessary |
| intrinsic keywords | The property/control supports them and they match content-sizing intent | Elementor cannot save them or runtime behavior is unverified |
| `min()` / `max()` | A one-sided bound is meaningful and expression support is verified | Operand types or saved/runtime support are unknown |
| `clamp()` | A justified minimum, fluid preferred value, and maximum exist | It is used as a fashionable default without real bounds or as a substitute for understanding content behavior |
| Variable | A compatible reusable value should be centrally governed | The value is one-off or the property type is incompatible |
| unitless | The exact property grammar permits or requires it | Never generalize unitless values across unrelated properties |

#### Property-specific caution

The same unit can behave differently by property. Confirm:

- what `%` is relative to;
- whether the containing size is definite;
- whether the Elementor control accepts and preserves the syntax;
- whether negative values are allowed;
- whether responsive overrides inherit or replace the base value;
- whether the used value differs from the specified value due to Flex/Grid sizing.

#### Typography-specific gate

For `font-size` and text-dependent dimensions:

- prefer `rem` when the relationship is intentionally root/global-scale relative;
- prefer `em` when component-local font-relative scaling is intentional and compounding is understood;
- do not use `px` merely because the design file provides a pixel measurement;
- do not use viewport units as the sole font-size mechanism when they prevent the required resize behavior;
- regardless of unit, apply the text-resize, spacing, reflow, content-expansion, and clipping checks in section 6.8.

#### Professional combination patterns

- fluid `%` width with a fixed or tokenized `max-width`;
- `rem` bounds with a viewport-relative middle term in `clamp()` when text-resize behavior remains safe;
- intrinsic size with `min-*` or `max-*` protection;
- Variable-backed shared bounds with a local responsive expression;
- fixed border or icon detail inside a fluid component.

#### Common shallow mistakes

- `fixed → px` without proving fixed behavior;
- `parent exists → %`;
- `responsive → vw`;
- `modern → clamp()`;
- `design shows 320 → width: 320px`;
- using `em` without considering compounding;
- using `%` for block-size without a definite containing block;
- declaring `px` automatically inaccessible or declaring `rem` automatically safe without validating the resulting layout;
- using viewport-only font sizing that cannot reach 200% text enlargement.

#### Minimal question when necessary

> For this property, should the value follow content, parent, root typography, component typography, or viewport—and what bounds are required?

#### Direct response example

```text
Set the width to 70% and add max-width: 320px;
the element should scale with its parent but should not grow beyond the intended size.
```

---

### 7.5 `preferred_minimum_maximum_size_selection`

#### Trigger

A dimension may need a preferred size, minimum, maximum, aspect ratio, or combination.

#### Candidate strategies

- no explicit size;
- preferred width/height;
- only minimum;
- only maximum;
- preferred size plus min/max;
- fill plus maximum;
- intrinsic plus bounds;
- aspect ratio plus one dimension;
- bounded-fluid expression.

#### Selection rules

- Use preferred size to express the normal target, not an absolute guarantee.
- Use `max-*` to cap growth while allowing smaller states.
- Use `min-*` to protect usability, touch size, content, or visual integrity.
- Use fixed height only when content and overflow are controlled and tested.
- Prefer content-driven block size for text and dynamic content.
- Use aspect ratio for media or visual surfaces that must preserve proportions.
- Consider Flex/Grid automatic minimum-size behavior before assuming an item can shrink.

#### Disqualifying conditions

- fixed height to align cards instead of solving layout/content behavior;
- clipping text to preserve screenshot geometry;
- `width: 100%` without checking parent, padding, box model, and max bounds;
- min/max values without explaining what they protect;
- aspect ratio inferred from a temporary crop.

#### Minimal question when necessary

> Should the element fill, follow content, remain fixed, or grow within limits—and which minimum or maximum protects the design?

---

### 7.6 `spacing_ownership_selection`

#### Trigger

Space is needed between siblings, inside a boundary, or outside an exceptional element.

#### Candidate options in the approved carrier

- parent `gap`;
- boundary `padding`;
- item `margin`;
- no explicit spacing;
- justified combination.

#### Eligibility rules

#### Gap

Choose when:

- the parent owns spacing between participating children;
- spacing repeats as part of the layout rhythm;
- wrapped or grid items should remain consistently separated.

#### Padding

Choose when:

- the boundary owns internal inset from background, border, edge, or hit area;
- content needs breathing room inside a visual surface.

#### Margin

Choose when:

- the element owns external separation;
- one item needs a genuine exception;
- normal block-flow separation is the actual relationship.

#### Combination strategies

- parent gap plus container padding;
- shared Variable for base rhythm plus one bounded local exception;
- gap for normal siblings plus margin only for a special item.

#### Disqualifying conditions

- wrapper created only for spacing;
- child margins simulating parent-owned rhythm;
- padding separating unrelated external siblings;
- negative margin used as an unverified layout repair;
- duplicate gap and margin;
- physical left/right when direction-relative spacing is intended.

#### Minimal question when necessary

> Is this space between siblings, inside a boundary, or outside one exceptional item?

---

### 7.7 `positioning_and_layering_selection`

#### Trigger

An element may need offset, overlay, sticky/fixed behavior, a containing block, z-index, or clipping.

#### Candidate options in the approved carrier

- normal flow;
- relative;
- absolute;
- sticky;
- fixed;
- visual transform/offset where appropriate;
- local stacking context;
- clipping/overflow boundary.

#### Eligibility rules

#### Normal flow

Choose whenever layout can express the intended relationship without removing the element from flow.

#### Relative

Choose when:

- the element should remain in flow but needs a bounded offset;
- it must establish a containing block for a positioned child.

#### Absolute

Choose only when:

- a deliberate overlay or anchored placement is required;
- the containing block is known;
- meaningful sequence is preserved;
- responsive collisions are controlled;
- the positioned content does not become inaccessible or obscure interactions.

#### Sticky

Choose when:

- the scroll container and sticky inset are known;
- ancestor overflow does not break sticky behavior;
- the persistent element will not obstruct content or keyboard focus;
- narrow/reflowed states leave sufficient reading and interaction space.

#### Fixed

Choose when:

- the relationship is intentionally viewport-persistent;
- mobile viewport, zoom, reflow, focus, and obstruction behavior are safe;
- the persistent layer can be dismissed, repositioned, or otherwise prevented from hiding focused controls when necessary.

#### z-index

Use only after identifying the relevant stacking contexts. Do not escalate numbers blindly.

#### Disqualifying conditions

- absolute positioning used to repair unresolved Flex/Grid layout;
- offsets copied from one screenshot;
- sticky without checking scroll container and ancestor overflow;
- fixed or sticky content entirely hiding a focused component;
- persistent layers consuming an unsafe amount of the reflowed viewport;
- clipping hiding layout failure, text, focus, errors, or controls;
- z-index escalation without stacking-context diagnosis.

#### Minimal question when necessary

> Must this element leave normal flow, and what exact parent or viewport should anchor it?

#### Runtime sanity check

Test the computed position, containing block, stacking contexts, clipping, scroll behavior, narrow/reflowed viewport, keyboard traversal, focus visibility, and collision with persistent layers.

---

### 7.8 `responsive_adaptation_selection`

#### Trigger

A structure, value, visibility, order, interaction, or direction may change by viewport or locale.

#### Candidate options in the approved carrier

- inherit base behavior;
- fluid adaptation without override;
- explicit breakpoint override;
- explicit reset;
- structural reflow;
- visibility change;
- interaction-pattern change;
- logical-direction adaptation.

#### Required context

- actual project breakpoints when available;
- base behavior;
- inheritance and class/local precedence;
- content extremes;
- source and focus order;
- direction and locale;
- viewport/state matrix.

#### Eligibility rules

- establish base behavior first;
- prefer intrinsic/fluid behavior before adding overrides;
- add a breakpoint override only when the base behavior cannot satisfy that range;
- use structural reflow for a genuine layout discontinuity;
- hide only decorative or intentionally redundant content unless another accessible path exists;
- preserve source, reading, focus, and interaction order;
- use logical direction where the design relationship should mirror.

#### Disqualifying conditions

- mobile overrides added before understanding desktop/base behavior;
- assuming default breakpoints without target-project confirmation;
- hiding meaningful content to avoid reflow;
- copying desktop fixed values to smaller viewports;
- visual order contradicting focus or DOM order;
- editor preview treated as complete runtime evidence.

#### Minimal question when necessary

> Which behavior is the base, and at what exact viewport must it genuinely change rather than continue fluidly?

---

### 7.9 `reuse_and_value_source_selection`

#### Trigger

A style, value, or multi-element structure may be local, reusable, inherited, or synchronized.

#### Candidate options in the approved carrier

- local literal/control value;
- local Class;
- shared/global Class;
- Variable/design token;
- inherited value;
- Component;
- independent repeated structure;
- combination of Class and Variables.

#### Eligibility rules

#### Local value

Choose for a deliberate one-off value with no shared-governance need.

#### Class

Choose when the same set of property applications should be reused.

#### Variable

Choose when a compatible value should be named and reused centrally.

#### Inheritance

Choose when the value should intentionally come from the parent/cascade and precedence is understood.

#### Component

Choose when a multi-element structure/content relationship should stay synchronized and the capability is available.

#### Independent repeated structure

Choose when each instance must diverge independently while still possibly sharing Classes or Variables.

#### Combination patterns

- Class applies properties; Variables supply reusable values.
- Shared base Class plus bounded local responsive exception.
- Component structure plus Variables for exposed design choices.
- Independent repeated items plus shared style Class.

#### Disqualifying conditions

- repeated local literals when shared control is required;
- Class used as synchronized structure;
- Component selected only because items look similar;
- Variable used for an incompatible property;
- local override silently defeating the shared rule;
- inheritance assumed without checking cascade and source.

#### Minimal question when necessary

> Should only this instance change, should the value/style remain shared, or must the whole multi-element structure stay synchronized?

---

### 7.10 `content_variability_and_overflow_selection`

#### Trigger

Text length, localization, dynamic data, user input, repeated count, missing media, or loading/error state can change geometry.

#### Candidate strategies

- natural wrap and reflow;
- intrinsic block size;
- min/max constraints;
- controlled truncation;
- deliberate scroll region;
- structural reflow;
- clipping for confirmed decoration only.

#### Required context

- minimum, typical, and maximum content;
- localized and RTL/LTR cases;
- unbroken strings;
- dynamic, empty, loading, and error states;
- full-content requirement;
- repeated-item count;
- overflow intent;
- required viewports.

#### Eligibility rules

- preserve meaningful content;
- prefer natural wrap and intrinsic height;
- truncate only when explicitly acceptable and full meaning remains available where required;
- use scroll only for an intentional scroll surface;
- clip only nonessential decoration;
- test Flex/Grid items for min-content and shrink behavior;
- include empty, loading, error, and maximum states for dynamic content.

#### Disqualifying conditions

- fixed height to match a screenshot;
- `overflow: hidden` as a layout repair;
- ellipsis hiding essential meaning;
- clipping errors or focused controls;
- assuming only short English/LTR content;
- testing only ideal data.

#### Minimal question when necessary

> What are the longest, empty, localized, and dynamic states, and may any meaningful content be truncated or scrolled?

---

### 7.11 `native_control_vs_workaround_selection`

#### Trigger

The same requirement might be implemented with a native Elementor control, Class/Variable, custom CSS, additional element, custom HTML/code, or external addon.

#### Candidate options in the approved carrier

- native element/control;
- native Class/Variable;
- existing-parent styling;
- extra structural element;
- scoped custom CSS;
- documented extension mechanism;
- third-party addon;
- custom HTML/code.

#### Interpretation order for an already approved mechanism

1. verified native control on the correct existing element;
2. Class or Variable when reuse/governance is the real need;
3. one justified extra element when structural responsibility requires it;
4. scoped custom CSS when native controls cannot express the bounded requirement;
5. documented extension or addon after compatibility review;
6. custom code only when necessary and safe.

#### Eligibility rules

#### Native control

Prefer when it fully expresses the intent, remains editable, and is available in the target project.

#### Class or Variable

Prefer when the problem is reuse or centralized value management, not missing capability.

#### Extra element

Use only when a real element-level responsibility exists. Do not add a DOM node merely to reach a styling control.

#### Custom CSS

Use when:

- native controls are insufficient;
- selector scope is stable;
- responsive and state behavior are defined;
- the change remains maintainable and reversible.

#### Third-party or custom mechanism

Use only with exact compatibility, security, lifecycle, and rollback awareness.

#### Disqualifying conditions

- custom CSS used before checking native controls;
- extra wrapper added solely to access a visual effect;
- addon used for a capability already available natively;
- custom HTML/code used as a generic fallback;
- unstable internal selectors;
- undocumented hooks or internals;
- untrusted code or assets.

#### Minimal question when necessary

> Can the exact requirement be expressed by a native control on the correct existing element, or is a real structural/custom capability missing?

---

### 7.12 `runtime_sanity_check`

#### Trigger

The Builder is about to claim that the selected implementation will work correctly.

#### Check layers

1. **Configured:** the intended setting/control was selected.
2. **Saved:** the value or structure persisted.
3. **Loaded:** required markup, CSS, media, script, or data loaded.
4. **Effective:** computed style, geometry, semantics, and interaction match the goal.
5. **Responsive:** required viewports and content states behave correctly.
6. **Quantified gates:** applicable thresholds from section 6.8 were actually tested.

#### Minimum checks by decision type

#### Layout

- actual display mode;
- tracks/axis/wrapping;
- source and focus order;
- overflow;
- content extremes;
- reflow at the required narrow equivalent width when applicable.

#### Units and sizing

- computed containing block/reference frame;
- used value;
- min/max behavior;
- 200% text resize when text or text-dependent geometry is affected;
- user text-spacing overrides when applicable;
- required breakpoints and content expansion.

#### Media

- source loads;
- crop/fit/aspect behavior;
- meaningful/decorative treatment;
- text-overlay contrast across representative media states;
- mobile, missing-media, reduced-motion, loading-priority, and visual-stability behavior.

#### Interaction

- correct semantic action/navigation;
- keyboard and focus behavior;
- pointer/touch;
- target size or valid exception;
- focus not obscured by persistent layers;
- expanded/collapsed/disabled/loading states.

#### Reuse

- Class/Variable resolution;
- cascade and overrides;
- affected instances;
- saved identity.

#### Performance

- identify whether the implementation can affect LCP, INP, or CLS;
- use field data for final target claims when available;
- treat lab/editor measurements as diagnostic evidence only.

Do not claim complete correctness from one screenshot, one editor preview, one viewport, or one laboratory performance run.

---

## 8. Full element and presentation decision policies

### 8.1 `media_representation_selection`

#### Trigger

A visual asset must be represented as Image Element, Background Image, SVG, Icon, Video Element, Background Video, or another verified media mechanism.

#### Required context

- informative, functional, complex, textual, or decorative purpose;
- whether the asset needs independent alternative text;
- whether it should be independently editable, linked, captioned, or data-bound;
- whether content overlays it;
- crop versus full-asset preservation;
- intrinsic dimensions and aspect ratio;
- responsive art direction;
- source trust and format;
- loading/performance priority;
- motion behavior and reduced-motion fallback;
- missing/error behavior;
- target-project support.

#### Candidate options in the approved carrier

- Image Element;
- Background Image;
- SVG element or verified SVG representation;
- Icon element;
- Video Element;
- Background Video;
- CSS/background decoration;
- no media element.

#### Eligibility rules

#### Image Element

Choose when:

- the image is meaningful content;
- it is functional or its meaning/action requires an independent text alternative;
- it may be linked or captioned;
- it must remain independently editable, replaceable, or data-bound;
- intrinsic aspect and responsive-source behavior matter;
- the image should participate in content flow.

Do not choose merely because the design contains a picture.

#### Background Image

Choose when:

- the image belongs to a container surface rather than the content sequence;
- it is decorative or compositional;
- text or other content must overlay it;
- `cover`, crop, positioning, or visual fill is part of the intent;
- no independent accessible content meaning, link purpose, caption, or data-binding responsibility is lost.

Do not use Background to hide meaningful content from semantics, search, translation, or accessibility.

#### SVG

Choose when:

- vector scalability is required;
- the asset is a logo, illustration, iconographic graphic, or shape whose vector behavior matters;
- the source is trusted and the project safely supports it;
- text that must remain editable is not flattened into the SVG.

Do not choose SVG only because it sounds more professional. Reject untrusted or unsafe SVG input.

#### Icon

Choose when:

- the asset is a simple symbolic glyph;
- a native icon mechanism expresses it cleanly;
- semantic labeling is handled when the icon is meaningful or interactive;
- an entire image/SVG document would be unnecessary.

#### Video Element

Choose when:

- video is meaningful content;
- playback controls, captions, transcript, poster, and independent placement matter;
- the media should participate in content flow.

#### Background Video

Choose when:

- motion is decorative or atmospheric;
- no essential information depends on it;
- a static fallback/poster is defined;
- reduced-motion behavior is defined;
- autoplay/persistent-motion controls meet the applicable section 6.8 motion gate;
- performance and mobile behavior are safe.

#### Fit and crop selection

- `cover`: intentional surface fill with acceptable crop and a protected focal area.
- `contain`: full asset should remain visible.
- natural/intrinsic: the asset should keep its own ratio and dimensions within layout constraints.
- fixed crop/frame: only when art direction and content safety are explicit.

Do not select `cover` or `contain` before knowing whether crop or full preservation is intended.

#### Text overlay and contrast

When text or controls overlay an image, video, gradient, or layered background:

- apply the section 6.8 text and non-text contrast thresholds;
- test representative light/dark frames, focal crops, responsive positions, loading states, and fallback media;
- do not assume one overlay color or opacity protects every asset state;
- prefer a stable contrast treatment when source imagery is variable.

#### Loading selection

- do not lazy-load a confirmed or strong LCP-image candidate;
- do not delay initial-viewport or visually critical media by default;
- reserve dimensions, aspect ratio, or an equivalent stable slot;
- below-fold media may use deferred loading when supported;
- avoid large decorative media when a lighter native treatment is equivalent;
- define fallback for missing or failed media;
- do not claim LCP/CLS success from the configuration alone.

#### Disqualifying conditions

- meaningful or functional image implemented only as Background;
- decorative image exposed with redundant content semantics;
- text flattened into an image/SVG when editability is required;
- untrusted SVG;
- Background Video carrying essential meaning;
- persistent automatic motion without the required control or reduced-motion behavior;
- crop selected without knowing focal area;
- text overlay accepted without representative contrast testing;
- external media selected without failure/privacy/performance review;
- intrinsic file dimensions treated as the design size automatically;
- confirmed LCP media lazy-loaded without a measured overriding reason.

#### Combination strategies

- Background image on a container plus semantic text children;
- Image Element inside a bounded responsive frame;
- SVG decorative layer plus editable text;
- Video Element with poster, captions, controls, and transcript where applicable;
- fluid media width plus max-width and aspect ratio;
- Background Image with a stable contrast layer tested across media states.

#### Minimal question when necessary

> Is this asset meaningful or functional content that needs independent semantics/editing, or a decorative/compositional surface behind other content?

#### Direct response examples

```text
Use the image as the container background with cover and a defined focal position;
it is a decorative composition layer behind the text, not independent content.
```

```text
Use an Image Element rather than a background;
the image is meaningful content and needs its own alternative text and responsive asset behavior.
```

#### Runtime sanity check

Verify source loading, dimensions, aspect ratio, crop, focal point, alternative/decorative treatment, overlay contrast, responsive behavior, missing source, loading priority, reserved space, performance impact, motion controls, and reduced-motion fallback.

---

### 8.2 `text_element_selection`

#### Trigger

Text must be represented as Heading, Paragraph/body text, Link, Button label, editable text, or decorative text.

#### Required context

- content meaning and hierarchy;
- action versus navigation;
- independent editability;
- page/section relationships;
- localization and direction;
- dynamic binding;
- wrapping and length;
- visual styling requirement.

#### Candidate options in the approved carrier

- Heading element;
- Paragraph/body-text element;
- Link;
- Button label within a Button;
- text within another semantic/interactive element;
- decorative generated text only when nonessential;
- image/SVG text only when editability and accessibility are not required.

#### Eligibility rules

#### Heading

Choose when:

- the text names a page, section, or subsection;
- it communicates a real structural relationship;
- its level is derived from the content structure, not font size;
- the wording describes the topic or purpose of the following content.

Do not choose Heading only for large or bold styling. Prefer a logical hierarchy, but do not mechanically classify every numeric level skip as a standards violation without evaluating the actual relationships.

#### Paragraph/body text

Choose for prose, descriptions, explanatory copy, and content that is not a heading or interactive label.

#### Link

Choose when activating the text navigates to a URL, location, resource, or route.

#### Button label

Use inside a Button when the control performs an action rather than navigation.

#### Decorative text

Use only when the text is not required for meaning and will not become inaccessible or uneditable. Prefer real text when users need to read, search, translate, resize, or edit it.

#### Disqualifying conditions

- Heading selected for appearance;
- vague Heading or control label that does not describe its topic/purpose;
- Paragraph used as a fake interactive control;
- Link styled as Button without preserving navigation semantics;
- meaningful copy flattened into image/SVG;
- visual order contradicting reading order;
- fixed height clipping localized, expanded, resized, or user-spaced text.

#### Combination strategies

- semantic Heading plus Class/Variables for visual styling;
- Paragraph with dynamic binding;
- Link containing text and an icon while preserving accessible name;
- real editable text over a decorative background.

#### Minimal question when necessary

> Is this text a section heading, normal content, navigation target, action label, or decoration?

#### Runtime sanity check

Verify actual semantic element/role, programmatically determinable relationships, descriptive heading/label, logical content hierarchy, accessible name, editability, wrapping, localization, direction, 200% resize, text spacing, and dynamic state.

---

### 8.3 `action_navigation_and_click_target_selection`

#### Trigger

A user must activate an action, navigate, open a destination, or click/tap a visual region.

#### Candidate options in the approved carrier

- Button;
- Link;
- Clickable Container;
- noninteractive container with an internal Button/Link;
- Icon Button;
- text Link;
- no interactive behavior.

#### Required context

- action versus navigation;
- target or resulting state;
- nested interactive descendants;
- accessible name;
- keyboard behavior;
- focus visibility;
- target size and spacing;
- disabled/loading/error state;
- security implications of destination/action.

#### Eligibility rules

#### Button

Choose when activation performs an action:

- submit;
- open/close;
- reveal;
- filter;
- trigger an operation;
- change an application state.

#### Link

Choose when activation navigates:

- another page;
- a URL;
- an anchor;
- a downloadable or external resource;
- another route or location.

#### Clickable Container

Choose only when:

- the whole card/region genuinely has one navigation or action target;
- it does not contain conflicting Links, Buttons, form controls, or other interactive descendants;
- keyboard and accessible-name behavior are correct;
- the large click target improves usability without obscuring semantics;
- the implementation is supported by the target project.

#### Internal control inside noninteractive container

Prefer when:

- only one part should be interactive;
- the card contains multiple destinations or actions;
- nested-interactive conflicts would occur;
- explicit control semantics are clearer.

#### Quantified interaction gates

- Apply the section 6.8 target-size rule: prefer at least `24 × 24 CSS pixels` unless a documented exception applies.
- Prefer `44 × 44 CSS pixels` for important touch-critical controls when practical.
- The interactive hit area, not only the visible icon artwork, is the target.
- A focused component must not be entirely hidden by sticky/fixed/overlay content.
- Visible focus, keyboard access, and sufficient state contrast remain required independently of target size.

#### Disqualifying conditions

- Button used for ordinary navigation;
- Link used for state-changing action without correct behavior;
- whole card clickable when it contains another Button/Link/control;
- click behavior without keyboard access;
- icon-only control without an accessible name;
- undersized adjacent targets without a valid exception;
- hover-only indication;
- hidden or entirely obscured focus;
- insufficient focus/state contrast;
- ambiguous disabled/loading state.

#### Combination strategies

- noninteractive card plus title Link and separate action Button;
- Link containing icon and label;
- Icon Button with a larger padded hit area and an accessible name;
- Button with loading/disabled state;
- Clickable Container only for a single-target simple card.

#### Minimal question when necessary

> Does activation navigate somewhere, perform an action, or make an entire single-target region clickable?

#### Runtime sanity check

Test keyboard, focus, pointer/touch, target/action, target dimensions/spacing or valid exception, nested controls, accessible name, focus obstruction, state contrast, hover/focus/active/disabled/loading states, and error behavior.

---

### 8.4 `tabs_accordion_or_normal_sections_selection`

#### Trigger

Related content could be displayed as Tabs, Accordion, continuously visible sections, or another disclosure pattern.

#### Candidate options in the approved carrier

- normal stacked sections;
- Tabs;
- Accordion;
- one section with headings and anchors;
- responsive pattern change when justified;
- another verified disclosure element.

#### Required context

- number of sections;
- content length;
- whether users need simultaneous comparison;
- whether hidden content must remain discoverable;
- viewport constraints;
- interaction frequency;
- default/open state;
- keyboard and focus behavior;
- activation latency;
- deep linking or state persistence;
- dynamic content and loading.

#### Eligibility rules

#### Normal sections

Choose when:

- users benefit from seeing content continuously;
- simultaneous comparison matters;
- the content is short or moderate;
- hiding content would reduce discoverability;
- page length remains acceptable.

This is the default when a disclosure pattern provides no clear benefit.

#### Tabs

Choose when:

- sections are parallel categories or alternate views of the same context;
- users usually need one view at a time;
- labels are short and stable;
- horizontal space is sufficient;
- simultaneous comparison is not required;
- the element can implement correct tab, tablist, and tabpanel semantics;
- keyboard navigation and selected/focus states are supported;
- automatic activation is used only when panel display is effectively immediate; otherwise use a deliberate/manual activation pattern.

Do not use Tabs merely to shorten a page.

#### Accordion

Choose when:

- sections are independently expandable;
- vertical space is constrained;
- labels can summarize each section;
- mobile/narrow layouts favor stacked disclosure;
- multiple open sections are allowed or intentionally restricted;
- each header behaves as a real keyboard-operable control;
- expanded/collapsed state and panel association are exposed correctly;
- hidden content remains discoverable.

#### Responsive pattern change

Changing Tabs to Accordion on narrow screens is eligible only when:

- the content identity and state remain coherent;
- semantics, keyboard/focus behavior, and relationships remain correct;
- the transformation is supported and tested;
- hidden content is not lost.

#### Disqualifying conditions

- Tabs for sequential steps that should be a process/stepper;
- Tabs when users need side-by-side comparison;
- too many Tabs with truncated or scrolling labels without a usable strategy;
- Tabs or Accordion selected when the target element cannot provide required semantics/keyboard behavior;
- Accordion for a few short sections that could remain visible;
- hiding critical information by default;
- disclosure selected solely to imitate a screenshot;
- inaccessible keyboard/focus/expanded/selected state;
- different content order across breakpoints without preserving meaning.

#### Combination strategies

- normal sections with anchor navigation;
- Tabs on wide screens and verified Accordion on narrow screens;
- Accordion with concise labels and clear open state;
- normal comparison summary plus detailed disclosure sections.

#### Minimal question when necessary

> Must users compare sections at the same time, or is one independently selectable/expandable section at a time sufficient?

#### Runtime sanity check

Test semantic roles/relationships, keyboard navigation, focus movement, activation latency, selected/expanded state, screen-size adaptation, content discoverability, URL/deep-link behavior if required, dynamic content, and failure behavior where applicable.

---

### 8.5 `decoration_and_separation_selection`

#### Trigger

The design appears to need a line, divider, visual separation, decorative shape, or additional empty space.

#### Candidate options in the approved carrier

- no visible separator;
- spacing only;
- Border on an existing element/container;
- Divider Element;
- Background decoration;
- pseudo/decorative CSS treatment when safely supported;
- SVG decorative line or shape;
- dedicated decorative element.

#### Required context

- whether separation is structural, visual, or purely spatial;
- who owns the separator;
- full-width or content-width behavior;
- repeated versus one-off use;
- orientation and responsive behavior;
- decorative versus meaningful status;
- need for shape, gradient, texture, or animation;
- DOM and maintenance cost.

#### Eligibility rules

#### Spacing only

Choose when:

- separation is adequately communicated by whitespace;
- no visible line or shape is part of the intent;
- adding a visual element would create unnecessary noise.

#### Border

Choose when:

- an existing boundary or item owns the line;
- the line follows the element edge;
- no independent positioning or content is required;
- the same result can be achieved without an extra element.

This is usually preferable to a Divider Element for a simple edge-aligned separator.

#### Divider Element

Choose when:

- the separator is an independent layout item;
- it needs its own width, alignment, spacing, or responsive presence;
- it does not naturally belong to one adjacent element’s border;
- the element cost is justified.

#### Background decoration

Choose when:

- the visual belongs to a surface;
- it should not participate in document flow;
- it is decorative and can be positioned/cropped as part of the container.

#### SVG decorative line/shape

Choose when:

- a nontrivial vector shape, curve, or scalable illustration is required;
- Border or a simple native treatment cannot express it;
- source safety and responsive behavior are verified.

#### Disqualifying conditions

- Divider Element for a simple border owned by an existing container;
- decorative element added when spacing is sufficient;
- empty Spacer element used to simulate layout rhythm;
- SVG used for a simple straight line that Border can express;
- decorative shape exposed as meaningful content;
- extra wrapper solely to carry a line;
- line placement fixed with offsets that break responsively.

#### Combination strategies

- spacing plus subtle Border;
- Border on repeated cards and gap between them;
- Background decorative shape with real content above it;
- independent Divider only between major sections where it owns its placement.

#### Minimal question when necessary

> Is a visible separator truly needed, and does it belong to an existing boundary or need to be an independent layout item?

#### Runtime sanity check

Check unnecessary DOM, responsive width, alignment, contrast, decorative semantics, direction, repetition, and whether spacing or Border would be simpler.

---

### 8.6 `icon_svg_or_image_selection`

#### Trigger

A small graphic, symbol, logo, illustration, or pictogram needs representation.

#### Candidate options in the approved carrier

- native Icon;
- SVG;
- Image Element;
- CSS/background decoration;
- text character only when semantically and visually appropriate.

#### Eligibility rules

#### Icon

Choose for simple symbolic glyphs when the available icon source matches the design and state requirements.

#### SVG

Choose for custom vector shapes, logos, detailed scalable illustrations, or icons unavailable in the native set, subject to source safety.

#### Image

Choose for raster artwork, photography, or graphics where pixel rendering and source assets are appropriate.

#### Background/CSS decoration

Choose for nonsemantic visual ornament attached to a surface.

#### Disqualifying conditions

- raster Image for a simple icon when a suitable native/vector option exists;
- SVG for editable text;
- Icon chosen despite mismatch with the actual brand/design asset;
- untrusted SVG;
- meaningful icon lacking accessible label in an interactive control;
- decorative icon receiving redundant spoken text.

#### Minimal question when necessary

> Is this a simple symbol, a custom vector/brand asset, a raster graphic, or only surface decoration?

---

## 9. Supporting domain policies

These policies remain concise but mandatory when their trigger is material.

### 9.1 `repeated_content_and_data_binding`

Use when content repeats or comes from a query, template, Dynamic Tag, or data source.

- distinguish repeated independent content from synchronized Component structure;
- verify the content model and exact item context;
- bind each property to a compatible data type;
- define empty, loading, error, minimum, and maximum result states;
- test item-count effects on Grid/Flex, sizing, and performance;
- do not assume a documented loop mechanism is available in the target project;
- avoid manual duplication when the content is genuinely data-driven and repeatable;
- avoid a loop mechanism when a few intentionally independent items are simpler.

Minimum question when necessary:

> Is this a fixed set of independent items or a data-driven repeated collection whose template and values should stay connected?

---

### 9.2 `forms_input_validation_and_actions`

Use when selecting form fields, validation, submission actions, uploads, or data destinations.

- choose field type by actual data and interaction requirement;
- provide visible labels, instructions, required state, and error behavior;
- distinguish client-side assistance from actual submission validation;
- choose submission actions from the required business destination;
- verify delivery/storage rather than assuming configured means successful;
- uploads require file type, size, access, storage, retention, and negative testing;
- protect sensitive data and avoid unnecessary collection;
- preserve keyboard, focus, error announcement, and mobile usability.

Minimum question when necessary:

> What data must be collected, where must it go, and what validation or retention rules apply?

---

### 9.3 `saved_published_and_runtime_state`

Keep these states separate:

```text
configured ≠ saved
saved ≠ published
published ≠ loaded
loaded ≠ effective
one tested viewport/state ≠ complete behavior
```

When migration or saved identity matters:

- inspect actual saved structure/version where available;
- preserve content, classes, Variables, bindings, and element identity;
- compare before and after;
- verify the public result;
- keep a reversible before-state for consequential changes.

---

### 9.4 `platform_feature_availability`

Before relying on a version-sensitive, Pro-only, experimental, prerelease, or project-enabled capability:

- verify the relevant Core/Pro version when material;
- verify the feature is exposed and permitted in the target project;
- prefer a stable native fallback when exact availability is unknown and the fallback satisfies the requirement;
- do not present a specialized control as definitely available from documentation alone.

Do not ask for platform details when they cannot change the proposed implementation.

---

### 9.5 `accessibility_constraints`

Apply when the choice affects:

- semantics;
- accessible name;
- keyboard operation;
- focus order or visibility;
- heading hierarchy;
- meaningful source/reading order;
- form labels/errors;
- image alternatives;
- contrast;
- target size;
- zoom/reflow;
- text spacing;
- reduced motion;
- media controls;
- hidden or clipped content.

Apply the relevant quantified gates from section 6.8 rather than relying on general impressions.

Professional defaults:

- do not hide meaningful content to make layout easier;
- do not use visual order to contradict focus or reading order;
- do not make an interaction pointer-only;
- do not flatten meaningful text into media;
- keep decorative assets nonsemantic;
- test 200% text resize and 320-CSS-pixel-equivalent reflow when applicable;
- test user text-spacing overrides for affected content;
- validate text and non-text contrast numerically;
- validate target size or a real documented exception;
- ensure focused controls are not entirely obscured;
- respect reduced-motion preferences and control persistent automatic motion.

Do not claim page/site conformance from a single component check.

---

### 9.6 `security_constraints`

Apply to SVG, uploads, external media, webhooks, HTML, custom code, external services, permissions, and destructive actions.

- use trusted sources;
- limit permissions and scope;
- validate and sanitize inputs;
- escape output appropriately;
- define destination, access, retention, and rollback;
- reject undocumented or unsafe execution paths;
- do not insert untrusted SVG/HTML/code merely to match a design.

---

### 9.7 `performance_constraints`

Performance is a tie-breaker after correctness and intent.

Review when the choice materially affects:

- DOM depth;
- repeated-item count;
- image/video/network weight;
- discovery and priority of critical media;
- style generation;
- query volume;
- editor responsiveness;
- runtime rendering;
- interaction latency;
- layout stability.

Professional defaults:

- remove unnecessary wrappers, not necessary responsibilities;
- choose appropriate media size/format and loading behavior;
- do not lazy-load a confirmed or strong LCP-image candidate;
- reserve dimensions/aspect ratio for media and delayed content;
- avoid heavyweight addons for simple native behavior;
- do not claim one layout mechanism is faster without comparable evidence;
- test representative content rather than an empty design.

Measured targets when field performance is in scope:

- `LCP ≤ 2.5 s`;
- `INP ≤ 200 ms`;
- `CLS ≤ 0.1`;
- evaluate at the 75th percentile, segmented across mobile and desktop where field data is available.

These are performance targets, not normative accessibility rules. Editor preview, one laboratory test, or one fast device is not proof of field performance.

---

### 9.8 `ai_assisted_authoring_constraints`

When an AI-assisted capability may create, modify, publish, delete, execute, or generate code:

- define the exact action scope;
- preserve generated-change visibility;
- require confirmation for risky or irreversible actions;
- validate saved and runtime output;
- do not treat generated output as automatically correct;
- do not expose secrets or grant unnecessary permissions.

---

## 10. Internal decision checklist

Before giving a meaningful implementation instruction, silently check the applicable items:

- [ ] Did I identify the goal before choosing an element or control?
- [ ] Did I select responsibility and behavior before value or unit?
- [ ] Did I consider the existing parent before adding a wrapper?
- [ ] Did I distinguish neutral Div, one-axis Flexbox, and two-axis Grid?
- [ ] Did I avoid choosing an element from appearance alone?
- [ ] Did I decide meaningful versus decorative media?
- [ ] Did I distinguish action from navigation?
- [ ] Did I decide whether disclosure is actually beneficial before using Tabs or Accordion?
- [ ] Did I consider Border or spacing before adding Divider/decoration elements?
- [ ] Did I decide fixed, fluid, intrinsic, fill, or bounded-fluid before choosing units?
- [ ] Did I identify the actual `%`, font, parent, or viewport reference?
- [ ] Did I consider content extremes and localization?
- [ ] Did I avoid fixed height for variable meaningful content?
- [ ] Did I establish base responsive behavior before overrides?
- [ ] If text is affected, did I consider 200% resize, text spacing, and reflow rather than judging the unit alone?
- [ ] If text overlays media, did I validate contrast across representative media/crop states?
- [ ] If a control is interactive, did I validate target area or a real exception?
- [ ] Did I ensure focus is not entirely obscured by sticky/fixed/overlay content?
- [ ] If motion is present, did I define reduced-motion and pause/stop/hide behavior where applicable?
- [ ] If media can affect LCP or CLS, did I choose loading priority and reserved space deliberately?
- [ ] Did I preserve source, reading, and focus order?
- [ ] Did I choose local value, Class, Variable, or Component by reuse responsibility?
- [ ] Did I check native controls before custom CSS or extra elements?
- [ ] Did I account for accessibility, security, and runtime where material?
- [ ] Is the recommendation reversible and maintainable?
- [ ] Can I explain the practical reason in one sentence?
- [ ] Did I avoid relying on one correct-sounding factor while ignoring other materially applicable context, gates, or consequences?
- [ ] Does every nontrivial element, control, value, unit, bound, override, wrapper, or workaround have its own specific factual basis or a clearly bounded reversible assumption?

Do not print this checklist unless explicitly requested.

---

## 11. User-facing response behavior

### 11.1 Normal instruction

Use direct actionable wording:

```text
Use a Flexbox with a vertical direction and gap for the card content;
the children form one ordered axis and do not need independent row-and-column tracks.
```

```text
Keep the existing parent and apply padding to it instead of adding another wrapper;
the parent already owns the visual boundary.
```

```text
Use the image as a background with cover and a fixed focal position;
it is decorative and belongs to the container surface behind the text.
```

### 11.2 When one fact is necessary

Ask only the smallest question:

```text
Is this image meaningful content that needs alt text, or is it only decorative behind the section?
```

```text
Should this card width follow the parent, remain fixed, or grow only up to a maximum?
```

```text
Do users need to compare all sections simultaneously, or should they view one section at a time?
```

Do not attach a long process explanation to the question.

### 11.3 When making a reasonable bounded assumption

State it briefly:

```text
Assuming the image is decorative, use it as the container background rather than an Image Element.
```

### 11.4 Do not produce by default

Do not produce:

- decision-status tables;
- internal policy references;
- Domain routing logs;
- governance terminology;
- long evidence reports;
- process handoffs;
- instructions to restart the task elsewhere.

---

## 12. Manual reference-use instruction

This document is not loaded or activated by prose alone. When it is supplied manually to a Builder session, use this instruction:

```text
Use the attached EV4 Builder Implementation Decision Policy only as
NON_EXECUTABLE_REFERENCE_ONLY guidance for interpreting and applying decisions
that are already approved and carried by trusted upstream artifacts.

Before giving an implementation instruction, verify the materially applicable
approved_structure_tree, widget_mapping_table, complete decision_lineage,
approved class maps and scopes, unit-policy or geometry records, responsive and
interaction decisions, and validated Builder actions. Preserve selected_candidate_id
and Kernel lineage exactly.

Do not use this policy to choose or redesign structure, Flexbox/Grid/nesting,
media role, element semantics, responsive strategy, geometry, positioning,
interaction, class scope, unit family, bounds, custom CSS, addon, or custom
mechanism. The candidate comparisons in the policy explain an approved decision;
they do not authorize a new decision.

If a required carrier is missing, contradictory, stale, or incomplete, return
EVIDENCE_REQUIRED or CORRECTION, or request upstream CE/Kernel consultation. Do
not fill the gap with a local Builder choice.

Keep user-facing instructions concise and execute only validated Builder actions.
Do not claim activation, enforcement, runtime success, responsive completion, or
production readiness from this Markdown reference.
```

---

## 13. Reference topic map

The sections in this document cover common implementation topics such as structure, sizing, units, spacing, positioning, responsive behavior, reuse, media, text semantics, interaction, dynamic content, forms, runtime checks, accessibility, security, and performance.

This topic map is not a claim that any external Registry or set of 21 Domain artifacts is present, approved, current, compatible, or validated in this pull request. External Domain artifacts remain optional advisory evidence and must be exactly identified before consultation. They cannot independently authorize a Builder action or replace repository contracts, CE/Kernel decisions, schemas, validators, or decision lineage.

---

## 14. Known limitations

This policy improves implementation selection but cannot infer facts that are absent from the task or project.

It does not automatically know:

- the exact design intent when the visual is ambiguous;
- the target Core/Pro version unless supplied or inspected;
- feature entitlement or activation;
- the complete control inventory of the target project;
- the actual saved representation;
- the public runtime result;
- business rules, data-retention rules, or security authorization not supplied by the user.

When one of these facts can materially change the recommendation, ask one concise question or use a clearly stated conservative assumption.

This pull request does not include or claim an external Domain corpus, source register, or validation mapping. Any external Domain artifact is optional advisory evidence only and must be exactly identified before consultation. Its absence does not authorize Builder to invent or select an implementation strategy.

---

## 15. Final policy state

```text
EV4_BUILDER_IMPLEMENTATION_DECISION_POLICY_NON_EXECUTABLE_REFERENCE_ONLY
```

This revision is intended only as a manually supplied, non-executable Builder reference for applying already approved decisions. It prioritizes practical intelligence, element and control comparison, professional implementation details, quantified validation outcomes, concise user-facing instructions, and broad EV4 Domain coverage without introducing unnecessary process ceremony.
