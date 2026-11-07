import { describe, expect, it } from "vitest";
import { buildVisualPrompt, isVisualMoment, readVisualPrefs, shouldSuggestVisual } from "@/lib/visual-capture";
const scene="O vento agita seu cabelo junto à janela, enquanto a luz da cidade ilumina o rosto. Ela se aproxima e segura as mãos dele, os olhos marejados pela revelação.";
describe("visual capture suggestions without generation", () => {
  it("generates only an editable preview, preserving source context", () => {
    const prompt=buildVisualPrompt("Christopher",scene,"image");
    expect(prompt).toContain("Christopher");
    expect(prompt).toContain("janela");
    expect(prompt).toContain("não invente");
    expect(buildVisualPrompt("Christopher",scene,"video")).toContain("Clipe");
  });
  it("does not suggest for every chat turn and never without opting in", () => {
    expect(isVisualMoment(scene)).toBe(true);
    expect(shouldSuggestVisual(scene,8,"image","normal")).toBe(true);
    expect(shouldSuggestVisual(scene,9,"image","normal")).toBe(false);
    expect(shouldSuggestVisual(scene,8,"off","normal")).toBe(false);
    expect(shouldSuggestVisual("Oi, tudo bem?",8,"image","normal")).toBe(false);
    expect(shouldSuggestVisual(scene,4,"image","frequent")).toBe(true);
    expect(shouldSuggestVisual(scene,12,"image","rare")).toBe(true);
  });
  it("never treats thoughts alone as a visual scene", () => {
    expect(isVisualMoment("[pensamento]Olhos, chuva, lágrimas, beijo, cidade, dança, luz, sorriso e mãos. Um sonho muito intenso.[/pensamento]")).toBe(false);
  });
  it("has conservative user-specific defaults and handles invalid data", () => {
    expect(readVisualPrefs(null)).toEqual({mode:"image",frequency:"normal"});
    expect(readVisualPrefs("{broken")).toEqual({mode:"image",frequency:"normal"});
    expect(readVisualPrefs('{"mode":"off","frequency":"rare"}')).toEqual({mode:"off",frequency:"rare"});
  });
});
