# Participant tasks

Give these to the participant **one at a time**, in order, using only
this goal-oriented language. Do not read the category letters aloud —
they're for the facilitator's tracking only. Laura's should already be
open on the first-launch screen when the participant sits down (see
`SESSION_CHECKLIST.md`).

Repository already prepared for this session: the **Flask** web
framework's source code. The participant does not need to type a path —
have it ready to paste, or already filled in, since "where do I find a
repository path" is not itself the thing being tested (unless they ask
you where to get one, in which case that's a real observation — note
it).

---

### A. Orientation / map comprehension

> "Go ahead and analyze this repository, and take a look at what comes
> up. Tell me what you think you're looking at."

*(Watch for: do they understand this is a map of the codebase? Do they
notice the legend/status labels? Do they try clicking before reading
anything?)*

### B. Entity discovery

> "Somewhere in here, Flask has to handle an incoming web request and
> figure out what code should respond to it. See if you can find the
> part of the code responsible for that."

*(This should lead them toward `Flask.full_dispatch_request` or a
neighboring method — there's no single correct click path.)*

### C. Architectural Explanation

> "Once you've picked something that looks relevant, see if Laura's can
> tell you more about it."

*(Watch for: do they find the "Architectural Explanation" button
without help? Do they understand what clicking it will do before they
click it?)*

### D. Interpreting SUPPORTED

> "Take a look at what came back. What do you think this is telling
> you?"

*(Do not explain SUPPORTED yet — this is what the debrief question is
for. Just observe what they say.)*

### E. Interpreting INSUFFICIENT EVIDENCE (if one naturally appears)

> "If you see anything marked differently from the others, what do you
> make of that?"

*(Only ask if an insufficient-evidence claim actually appears in this
session's real response — do not force it, do not manufacture one.)*

### F. Evidence expansion

> "Can you find out exactly why Laura's believes that claim?"

*(Should lead them to expand a claim card and look at its evidence.)*

### G. Open source

> "Can you get from that claim to the actual line of code it's based
> on?"

*(Should lead them to "Open source". Watch whether they understand
they're looking at the real, live source file.)*

### H. Returning to another entity

> "Now go find something else in this codebase and see what Laura's
> says about that one too."

*(Watch how they navigate back — do they use Back, breadcrumbs, or get
lost? Do they re-discover the accessible-table alternative on their
own?)*

### I. Recovery from a harmless navigation mistake

> "If you ever click into the wrong thing, just show me how you'd get
> back to where you meant to be."

*(If they haven't already made a wrong click naturally by this point,
prompt gently: "Try clicking on something you don't think is what you
want, then find your way back.")*

---

## If something goes wrong

If a real error appears (a failed generation, a slow load, anything
unexpected) — do not fix it for them immediately. Say:

> "Just do whatever you'd normally do here."

Then note what they try. Only step in with a Level 2/3 intervention
(see `FACILITATOR_GUIDE.md`) if they're genuinely stuck and frustrated,
not merely puzzled.
