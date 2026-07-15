---
"effect": patch
---

Fix three `Fiber` interruption bugs:

- `FiberImpl.evaluate` could re-enter its own `runLoop` when a fiber was interrupted while already mid-loop on the same call stack (e.g. `Fiber.runIn` interrupting a fiber synchronously against an already-closed `Scope`). The reentrant call corrupted the continuation stack and could drop a pending finalizer, leaking an acquired resource such as a stream reader or db handle. `evaluate` now defers reentrant calls onto the scheduler instead of recursing synchronously.
- The reentrant deferral above could itself drop the interrupt: if the fiber's `runLoop` completed to a success exit before the scheduled task ran — while still interruptible and never crossing an interruptibility boundary — `evaluate` committed the success and the deferred interrupt was silently discarded, so a fiber the caller asked to interrupt returned a value instead of an interrupted exit. `evaluate` now honors a pending interrupt before committing a success exit.
- `fiberInterruptAll`/`fiberInterruptAllAs` iterated the `fibers` argument twice: once to call `interruptUnsafe`, once inside `fiberAwaitAll` to await them. A one-shot `Iterable` (e.g. a generator) is exhausted by the first pass, so the await resolved immediately without waiting for finalizers to finish. Both functions now materialize the iterable into an array once and reuse it for both passes.
