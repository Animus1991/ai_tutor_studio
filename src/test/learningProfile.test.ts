import { describe, expect, it } from "vitest";
import {
  applyBehaviorEvent,
  applyOverrides,
  createBehaviorEvent,
  createColdStartProfile,
  deriveAdaptiveParameters,
  deriveDomainKey,
  deriveDomainParameters,
  explainLearningProfile,
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
    expect(profile.errorPatterns["task:misconception"].count).toBe(40);
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

  it("keeps per-domain evidence separate without storing course titles", () => {
    const mathematics = deriveDomainKey("Advanced Mathematics");
    const history = deriveDomainKey("European History");
    expect(mathematics).not.toBe(history);
    expect(mathematics).not.toContain("mathematics");

    let profile = createColdStartProfile();
    for (let index = 0; index < 8; index += 1) {
      profile = applyBehaviorEvent(
        profile,
        createBehaviorEvent({
          kind: "task_review",
          surface: "tasks",
          channel: "retrieval",
          domainKey: mathematics,
          quality: 0.1,
          questionKind: "apply",
          errorType: "conceptual",
        }),
      );
    }
    expect(profile.domains[mathematics].eventCount).toBe(8);
    expect(profile.domains[history]).toBeUndefined();
    expect(deriveDomainParameters(profile, mathematics).ragTopK).toBeGreaterThanOrEqual(
      profile.parameters.ragTopK,
    );
  });

  it("tracks response-time variance and bounded fatigue", () => {
    let profile = createColdStartProfile();
    for (const responseTimeMs of [2_000, 2_250, 2_000, 20_000]) {
      profile = applyBehaviorEvent(
        profile,
        createBehaviorEvent({
          kind: "agent_turn",
          surface: "agent",
          channel: "text",
          responseTimeMs,
        }),
      );
    }
    expect(profile.responseTime.samples).toBe(4);
    expect(profile.responseTime.variance).toBeGreaterThan(0);
    expect(profile.fatigueIndex).toBeGreaterThanOrEqual(0);
    expect(profile.fatigueIndex).toBeLessThanOrEqual(1);
  });

  it("applies explicit bounded overrides and explains their evidence", () => {
    const profile = createColdStartProfile();
    profile.userOverrides = {
      chunkSizeWords: 2_000,
      retrievalIntervalMultiplier: 0.1,
      feedbackDensity: "detailed",
    };
    profile.parameters = applyOverrides(
      profile.parameters,
      profile.userOverrides,
    );
    expect(profile.parameters.chunkSizeWords).toBe(800);
    expect(profile.parameters.retrievalIntervalMultiplier).toBe(0.6);
    const explanation = explainLearningProfile(profile);
    expect(explanation.activeOverrides).toContain("chunkSizeWords");
    expect(explanation.privacyNote).toContain("not note text");
  });
});
