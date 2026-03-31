import { describe, it, expect } from "vitest";
import { FRAMEWORK_MAP, getMapping, applyMapping, composeTaskPrompt } from "../../scripts/execute-plan/framework-map.js";
import { CANONICAL_TASK_TYPES } from "../../scripts/execute-plan/types.js";
import type { CanonicalTask } from "../../scripts/execute-plan/types.js";

function makeTask(overrides: Partial<CanonicalTask> = {}): CanonicalTask {
  return {
    id: "task-1",
    phase: "default",
    type: "implement",
    title: "Build API",
    desc: "Implement the REST API",
    dependsOn: [],
    acceptance: ["Tests pass", "Endpoints respond"],
    files: { create: ["src/api.ts"], modify: ["src/index.ts"] },
    steps: ["Write tests", "Implement handlers"],
    priority: "normal",
    parallelizable: true,
    ...overrides,
  };
}

describe("FRAMEWORK_MAP", () => {
  it("has an entry for every canonical task type", () => {
    for (const type of CANONICAL_TASK_TYPES) {
      expect(FRAMEWORK_MAP[type]).toBeDefined();
      expect(FRAMEWORK_MAP[type].sparcRole).toBeTruthy();
      expect(FRAMEWORK_MAP[type].rufloAgent).toBeTruthy();
      expect(FRAMEWORK_MAP[type].skills.length).toBeGreaterThan(0);
      expect(FRAMEWORK_MAP[type].timeoutSec).toBeGreaterThan(0);
      expect(typeof FRAMEWORK_MAP[type].retries).toBe("number");
      expect(FRAMEWORK_MAP[type].promptTemplate).toBeTruthy();
    }
  });

  it("maps design to architect role", () => {
    expect(FRAMEWORK_MAP.design.sparcRole).toBe("architect");
    expect(FRAMEWORK_MAP.design.rufloAgent).toBe("architect");
  });

  it("maps implement to coder role", () => {
    expect(FRAMEWORK_MAP.implement.sparcRole).toBe("coder");
    expect(FRAMEWORK_MAP.implement.rufloAgent).toBe("coder");
  });

  it("maps debug to debugger role", () => {
    expect(FRAMEWORK_MAP.debug.sparcRole).toBe("debugger");
    expect(FRAMEWORK_MAP.debug.rufloAgent).toBe("debugger");
  });
});

describe("getMapping", () => {
  it("returns mapping for valid type", () => {
    const entry = getMapping("implement");
    expect(entry.sparcRole).toBe("coder");
  });

  it("throws for invalid type", () => {
    expect(() => getMapping("deploy" as any)).toThrow("No framework mapping");
  });
});

describe("applyMapping", () => {
  it("merges task with mapping entry", () => {
    const task = makeTask({ type: "implement" });
    const mapped = applyMapping(task, 0);

    expect(mapped.id).toBe("task-1");
    expect(mapped.sparcRole).toBe("coder");
    expect(mapped.rufloAgent).toBe("coder");
    expect(mapped.skills).toContain("test-driven-development");
    expect(mapped.timeoutSec).toBe(1800);
    expect(mapped.retries).toBe(1);
    expect(mapped.concurrencyLevel).toBe(0);
  });

  it("preserves original task fields", () => {
    const task = makeTask({ id: "custom-id", phase: "phase-1" });
    const mapped = applyMapping(task, 2);

    expect(mapped.id).toBe("custom-id");
    expect(mapped.phase).toBe("phase-1");
    expect(mapped.title).toBe("Build API");
  });
});

describe("composeTaskPrompt", () => {
  it("includes role, task, files, steps, acceptance, and skills", () => {
    const task = makeTask({ type: "implement" });
    const mapped = applyMapping(task, 0);
    const prompt = composeTaskPrompt(mapped);

    expect(prompt).toContain("## Role");
    expect(prompt).toContain("SPARC Coder");
    expect(prompt).toContain("## Task");
    expect(prompt).toContain("Build API");
    expect(prompt).toContain("## Files");
    expect(prompt).toContain("src/api.ts");
    expect(prompt).toContain("## Steps");
    expect(prompt).toContain("Write tests");
    expect(prompt).toContain("## Acceptance Criteria");
    expect(prompt).toContain("Tests pass");
    expect(prompt).toContain("## Skills to Use");
    expect(prompt).toContain("test-driven-development");
  });

  it("omits empty sections", () => {
    const task = makeTask({
      files: { create: [], modify: [] },
      steps: [],
      acceptance: [],
      skills: [] as any,
    });
    const mapped = applyMapping(task, 0);
    const prompt = composeTaskPrompt(mapped);

    expect(prompt).not.toContain("## Files");
    expect(prompt).not.toContain("## Steps");
    expect(prompt).not.toContain("## Acceptance Criteria");
  });
});
