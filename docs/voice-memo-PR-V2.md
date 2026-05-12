Product Position for MemLumina Voice Memo
1. Capture must be fast and reliable
The voice memo app exists to let the user capture something quickly, often under urgency. Anything that slows down or complicates that action should be removed.

The app must make the recording state unmistakably clear in the UI:

whether recording has started;
whether the microphone is actively picking up sound;
whether anything is failing during capture.
That feedback is essential. The user must never be uncertain about whether a memo is actually being recorded.

Capture must not depend on network quality or server availability. Recording should always be staged and stored locally on the device first. Upload can happen later when connectivity allows. Reliable local capture is a core requirement.

2. Memo pre-tagging should be removed
Pre-tagging memos as idea, fix, reminder, and similar categories adds friction at exactly the wrong moment.

A quickly captured voice memo can contain several semantic elements at once, such as an idea, a reminder, and a correction. Asking the user to classify it before capture creates unnecessary burden and may introduce confusion rather than clarity.

Semantic interpretation belongs to the CLS pipeline, especially the ClerkJob worker. The voice memo app should not participate in sorting or interpreting memo meaning.

For that reason, memo pre-tagging should be dropped from the main flow.

3. History is essential, but it should stay operational
The user should be able to see all memos currently moving through the pipeline, with clear statuses such as:

recorded
uploaded
ingested
processed
acknowledged or accessed
History is valuable because it gives confidence and supports a few key recovery actions, such as retrying an upload or resubmitting something that failed.

However, once a memo has safely reached the server, it should gradually stop being the concern of the voice memo app. This app is not a long-term memory browser and not a CLS management interface.

Displaying transcripts may still be useful, especially for recent memos, but that should remain a lightweight supporting feature rather than the main purpose of the app.

4. Status indicators are important
Backend connection status is useful information for the user.

It gives confidence when the system is healthy and provides an early warning when it is not. If the user sees that the server is unreachable before starting a memo, they can decide whether to rely on deferred upload or capture the information elsewhere as a fallback.

Even if the app cannot fix connection issues, it should report them clearly. Honest status visibility is part of making the tool trustworthy.

5. Product boundary
This app should not be responsible for:

sorting memo meaning;
verifying semantic interpretation;
reviewing CLS outputs;
acting as an interface to the CLS itself.
It is a memo capture app.

Its job is to:

capture reliably;
preserve the memo safely;
transmit it when possible;
show enough lifecycle state to keep the user informed.
At some point in the process, to be defined by product policy, a memo should cease to appear in the app’s active surface. Once its handoff role is complete, the memo app should step back.






