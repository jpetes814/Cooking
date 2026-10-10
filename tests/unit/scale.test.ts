import { describe, expect, it } from "vitest";
import { formatAmount, parseIngredient } from "@/lib/model/recipe";
import { canStep, defaultTarget, scaleFactor, scaledIngredients, stepTarget, targetLabel } from "@/lib/model/scale";

const soup = { servings: 4, ingredients: ["2 cups stock", "3 carrots", "1 1/2 tbsp butter", "salt to taste"].map(parseIngredient) };

describe("servings", () => {
  it("scales amounts from the recipe's servings", () => {
    expect(scaleFactor(4, 2)).toBe(0.5);
    expect(scaleFactor(4, 6)).toBe(1.5);
    expect(scaleFactor(null, 2)).toBe(2);
    expect(scaleFactor(4, null)).toBe(1);
    const half = scaledIngredients(soup, 2).map(formatAmount);
    expect(half).toEqual(["1 cup", "1 1/2", "3/4 tbsp", ""]);
    expect(scaledIngredients(soup, 8).map(formatAmount)).toEqual(["4 cups", "6", "3 tbsp", ""]);
  });

  it("leaves 'to taste' and the original alone", () => {
    const out = scaledIngredients(soup, 2);
    expect(out[3]).toBe(soup.ingredients[3]);
    expect(soup.ingredients[0].qty).toBe(2);
  });

  it("steps whole servings from 1 to 50", () => {
    expect(defaultTarget(4)).toBe(4);
    expect(stepTarget(4, -1, 4)).toBe(3);
    expect(stepTarget(1, -1, 4)).toBe(1);
    expect(stepTarget(50, 1, 4)).toBe(50);
    expect(stepTarget(2.5, 1, 2.5)).toBe(3);
    expect(canStep(1, -1, 4)).toBe(false);
  });

  it("steps a multiplier when the recipe doesn't say how many it serves", () => {
    expect(defaultTarget(null)).toBe(1);
    expect(stepTarget(1, 1, null)).toBe(1.5);
    expect(stepTarget(1.5, 1, null)).toBe(2);
    expect(stepTarget(1, -1, null)).toBe(0.5);
    expect(stepTarget(0.25, -1, null)).toBe(0.25);
    expect(stepTarget(10, 1, null)).toBe(10);
    expect(targetLabel(0.5, null)).toBe("½×");
    expect(targetLabel(2, null)).toBe("2×");
    expect(targetLabel(6, 4)).toBe("Serves 6");
  });
});
