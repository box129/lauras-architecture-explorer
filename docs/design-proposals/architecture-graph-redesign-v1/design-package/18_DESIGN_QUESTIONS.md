# 18. Design questions, answered

**A. Will a first-time developer know what to do?**
Yes. One 48px action — *Browse repository* — one sentence saying what the
product does, and the AI question answered before it is asked. Nothing else on
the screen competes.

**B. Does the Overview communicate architecture rather than inventory?**
Yes, structurally. Containment is drawn as enclosure; the summary counts
regions, sections and clusters rather than files; and the two things a
directory listing cannot say — which modules actually depend on each other, and
which nothing connects — are visible at the top level. What it will not do is
invent domain names to *feel* architectural.

**C. Can users see containment without reading paths?**
Yes. A region is a box containing boxes, with a header bar, a tint step per
level and a chevron. The path is a fact inside the header, not the mechanism.

**D. Can users distinguish the four kinds of fact without reading methodology?**
Yes, and that is the redesign's spine. Four channels — shape, icon, word,
colour — carry each layer, and the two dangerous ones are made structurally
incompatible: the AI card cannot hold a verdict and the statement card cannot
hold an AI sentence.

**E. Does enabling AI now have an understandable place?**
Yes. Settings names the two surfaces AI touches and the four it never does,
side by side. In the product, AI appears in exactly one slot, always as an
explicit button, always above a ground-truth line that stays true.

**F. Does dark mode preserve the hierarchy and the distinctions?**
Yes. Dark is a warm-charcoal re-derivation, not an inversion; shadows change
character, accents lighten rather than saturate, iris stays outside the status
hues, and the evidence highlight keeps a solid edge. The Theme specimen cards
show light and dark side by side for exactly this check.

**G. Does the right panel help with the current task?**
Yes. Four states, four contents, always about what is on screen. Repo-wide
orientation is retained but demoted to a collapsed section at the one state
where it is relevant.

**H. Is the accessible view a real alternative?**
Yes. It is a keyboard tree reached from the same control cluster as zoom, in
the same canvas area, with an Origin column that carries the epistemic layer
non-visually. It is a way to read the architecture, not a debug dump.

**I. Is there enough canvas at 1366×768?**
Yes — roughly 150px of vertical space returned by replacing the bottom bar with
a floating control cluster, plus a 320px panel that can be dismissed entirely.

**J. Does it feel like a product for understanding software architecture?**
That is the one question a reviewer has to answer, not me. What I can say is
that the product now leads with structure, relations and evidence rather than
with a file list, and that its most distinctive claim — every statement walks
down to a line of source — is now a screen rather than a buried overlay.

---

# Recommended design direction

**Epistemic transparency as the organising principle**: one shell, one Back,
one breadcrumb; an Overview built from enclosure rather than enumeration; and
five kinds of fact that are impossible to confuse because they differ in shape,
icon, word and colour at once. AI is present, useful, and unmistakably marked —
never the thing holding the product up.

## Status

**READY FOR VISUAL APPROVAL**

Ready in the sense that the direction is coherent, tokenised and buildable, and
the whole journey exists as a working prototype rather than a slide. Three
things should be settled during review, none of which changes the direction:

1. **The residual bucket's prominence.** Twenty-four ungrouped files is honest
   and also the largest object on the services screen. It may want to be
   collapsed by default.
2. **Iris as the AI accent.** It is deliberately outside the palette. Confirm
   it reads as "different kind of thing" rather than "different brand".
3. **Statement density at Entity Focus.** Four statements fit; forty would not.
   A grouping or filter rule is needed before real repositories land.

No production implementation should start before that review.
