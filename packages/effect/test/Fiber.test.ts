import { assert, describe, it } from "@effect/vitest";
import { Effect, Exit, Fiber, Scope } from "effect";

describe("Effect", () => {
  it("Fiber is a fiber", async () => {
    const result = Effect.runFork(Effect.succeed(1));
    assert.isTrue(Fiber.isFiber(result));
  });

  describe("interruptAll", () => {
    it.live("awaits fibers passed as a one-shot iterable", () =>
      Effect.gen(function* () {
        let cleaned = false;
        const fiber = yield* Effect.never.pipe(
          Effect.onInterrupt(() =>
            Effect.sleep(10).pipe(
              Effect.andThen(
                Effect.sync(() => {
                  cleaned = true;
                }),
              ),
            ),
          ),
          Effect.forkChild({ startImmediately: true }),
        );
        yield* Fiber.interruptAll(
          (function* () {
            yield fiber;
          })(),
        );
        assert.isTrue(cleaned);
      }),
    );
  });

  describe("interruptAllAs", () => {
    it.live("awaits fibers passed as a one-shot iterable", () =>
      Effect.gen(function* () {
        let cleaned = false;
        const fiber = yield* Effect.never.pipe(
          Effect.onInterrupt(() =>
            Effect.sleep(10).pipe(
              Effect.andThen(
                Effect.sync(() => {
                  cleaned = true;
                }),
              ),
            ),
          ),
          Effect.forkChild({ startImmediately: true }),
        );
        yield* Fiber.interruptAllAs(
          (function* () {
            yield fiber;
          })(),
          0,
        );
        assert.isTrue(cleaned);
      }),
    );
  });

  it.effect(
    "does not drop a pending finalizer when a fiber synchronously interrupts itself while mid-runLoop",
    () =>
      Effect.gen(function* () {
        let released = false;
        const closedScope = yield* Scope.make();
        yield* Scope.close(closedScope, Exit.void);

        const child = yield* Effect.gen(function* () {
          const self = Fiber.getCurrent()!;
          yield* Effect.acquireRelease(
            Effect.sync(() => {
              Fiber.runIn(self, closedScope);
              return "resource";
            }),
            () =>
              Effect.sync(() => {
                released = true;
              }),
            { interruptible: true },
          );
        }).pipe(Effect.scoped, Effect.forkChild({ startImmediately: true }));

        yield* Fiber.await(child);
        assert.isTrue(released);
      }),
  );

  it.effect(
    "delivers a synchronous self-interrupt instead of completing to success",
    () =>
      Effect.gen(function* () {
        const closedScope = yield* Scope.make();
        yield* Scope.close(closedScope, Exit.void);

        const child = yield* Effect.gen(function* () {
          const self = Fiber.getCurrent()!;
          Fiber.runIn(self, closedScope);
          return 42;
        }).pipe(Effect.forkChild({ startImmediately: true }));

        const exit = yield* Fiber.await(child);
        assert.isTrue(Exit.hasInterrupts(exit));
      }),
  );
});
