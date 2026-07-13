import { describe, expect, it } from "vitest";
import {
  applyBehaviorEvent,
  createBehaviorEvent,
  createColdStartProfile,
  deriveAdaptiveParameters,
} from "../lib/learningProfile";

describe("implicit learning profile", () => {
  it("uses neutral cold-start parameters without learning-style labels", () => {
    const profile = createColdStartProfile(1);
    expect(profile.eventCount).toBe(0);
    expect(profile.parameters).toMatchObject({
      confidence: 0,
      ragTopK: 4,
      chunkSizeWords: 500,
      theoryPracticeRatio: 0.5,
    });
  });

  it("updates retrieval evidence gradually and within safe bounds", () => {
    let profile = createColdStartProfile(1);
    for (let index = 0; index < 40; index += 1) {
      profile = applyBehaviorEvent(
        profile,
        createBehaviorEvent(
          {
            kind: "task_review",
            surface: "tasks",
            channel: "retrieval",
            quality: 0.2,
            errorType: "conceptual",
          },
          index + 2,
        ),
      );
    }

    expect(profile.parameters.confidence).toBe(1);
    expect(profile.parameters.ragTopK).toBeGreaterThanOrEqual(4);
    expect(profile.parameters.retrievalIntervalMultiplier).toBeGreaterThanOrEqual(
      0.6,
    );
    expect(profile.parameters.retrievalIntervalMultiplier).toBeLessThanOrEqual(
      1.6,
    );
    expect(profile.errorPatterns.conceptual.count).toBe(40);
  });

  it("lengthens review intervals only as retrieval success rises", () => {
    const low = createColdStartProfile();
    low.eventCount = 40;
    low.stats.retrievalSuccess = { mean: 0.25, samples: 40 };
    const high = createColdStartProfile();
    high.eventCount = 40;
    high.stats.retrievalSuccess = { mean: 0.9, samples: 40 };

    expect(deriveAdaptiveParameters(high).retrievalIntervalMultiplier).toBeGreaterThan(
      deriveAdaptiveParameters(low).retrievalIntervalMultiplier,
    );
  });

  it("clips and buckets privacy-sensitive precision", () => {
    const event = createBehaviorEvent(
      {
        kind: "focus_session",
        surface: "dashboard",
        channel: "text",
        durationSeconds: 187,
        quality: 5,
      },
      new Date(2026, 0, 1, 13).getTime(),
    );
    expect(event.durationSeconds).toBe(300);
    expect(event.quality).toBe(1);
    expect(event.hourOfDay).toBe(13);
    expect(event).not.toHaveProperty("content");
  });
});
