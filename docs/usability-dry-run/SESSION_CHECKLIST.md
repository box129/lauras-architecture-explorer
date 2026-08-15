# Session checklist

Follow in order. Nothing here requires the participant to see a
terminal, an IDE, or a file path.

## Before the participant arrives

1. [ ] From `C:\Users\LENOVO T14\Development\lauras-product-end-user-acceptance`,
       run `.\doctor.ps1`. Confirm `Result: READY`.
2. [ ] If Laura's isn't already running, run `.\start-lauras.ps1`. Note
       the exact Frontend URL it prints (it may not be the default port).
3. [ ] Open that URL in the browser window the participant will use.
       Reload once (F5) so the session starts from a clean first-launch
       state, not a leftover run from your own testing.
4. [ ] Open **Settings** and confirm: **Enabled** is checked, **Provider**
       is `OpenAI`, **Model** is `gpt-5.4-mini`, and the API Key field
       shows the masked placeholder (a key is already saved). Click
       **Test connection** and confirm it reports success.
       - **The API key is process-memory-only and is cleared by any
         backend restart** (including an automatic dev-server reload).
         If Settings shows **Enabled unchecked** / **Provider: Disabled**
         / no masked key, the key needs to be re-entered and **Save**
         clicked before the participant begins — this is normal,
         documented behavior, not a bug (see
         `docs/OPENAI_CONFIGURATION.md`, "Credential handling").
5. [ ] Close Settings. Confirm the "What repo do you want to understand?"
       first-launch screen is what's on screen (not a half-configured
       Settings dialog, not an error state).
6. [ ] Have `PARTICIPANT_TASKS.md` and this session's copy of
       `OBSERVATION_SHEET.md` ready (printed or in a second window you
       control, never on the participant's screen).
7. [ ] If recording: start screen recording now, **before** anything
       with the participant begins, so Settings (already closed, key
       already masked) is never mid-edit on camera. Confirm the API key
       has never been visible unmasked in any window you're capturing.
8. [ ] Confirm you are not recording anything containing the API key,
       any other credential, or unrelated personal information.

## During the session

9. [ ] Read the think-aloud framing from `FACILITATOR_GUIDE.md` to the
       participant before task A.
10. [ ] Walk through tasks A–I from `PARTICIPANT_TASKS.md` in order,
        using only goal-oriented language.
11. [ ] Record every Level 2/3 intervention on `OBSERVATION_SHEET.md` as
        it happens (see `FACILITATOR_GUIDE.md` for the level
        definitions).
12. [ ] Do not deliberately induce a provider/network failure. If one
        happens naturally, let the participant react to it and note
        what they did — do not explain it away for them.

## After the tasks

13. [ ] Ask the debrief questions from `DEBRIEF_QUESTIONS.md`.
14. [ ] Stop the recording.
15. [ ] Save the recording and your notes to a location that is not the
        product repository (never commit participant recordings or
        notes into `qa-audit/` or any git-tracked path — this kit
        describes the protocol, not participant data).
16. [ ] Thank the participant. Do not promise the feature will be
        changed based on one session — this is exploratory, non-scored
        input.

## After the participant leaves

17. [ ] `.\stop-lauras.ps1` if you're done for the day.
18. [ ] Write a short internal summary of blockers found (separate from
        this kit) before your next session, so repeat sessions aren't
        needed to rediscover the same issue.
