import assert from "node:assert/strict";
import test from "node:test";

import { toFriendlyEvaluationErrorMessage } from "@/lib/engine-errors";

test("maps parse failures to friendly expression errors", () => {
  assert.match(
    toFriendlyEvaluationErrorMessage(
      "bad expression, please check expression syntax",
      "yaml",
      "yq",
    ),
    /expression could not be parsed/i,
  );
});

test("maps internal engine failures to a generic message", () => {
  assert.equal(
    toFriendlyEvaluationErrorMessage(
      "an internal error occurred",
      "json",
      "yq",
    ),
    "An internal error occurred.",
  );
});

test("maps yaml parse failures to an input-specific message", () => {
  assert.match(
    toFriendlyEvaluationErrorMessage(
      "yaml: did not find expected key",
      "yaml",
      "yq",
    ),
    /yaml input could not be parsed/i,
  );
});

test("maps dasel selector parse failures to friendly selector errors", () => {
  assert.match(
    toFriendlyEvaluationErrorMessage('invalid input text "["', "yaml", "dasel"),
    /selector could not be parsed/i,
  );
});
