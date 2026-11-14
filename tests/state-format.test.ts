import { describe, expect, it } from "vitest";
import { formatHoursMinutes, formatNumber } from "@/lib/format";
import { DEFAULT_SELECTION, parseSelection, selectionReducer, serializeSelection } from "@/lib/state/selection";

describe("estado global y URL", () => {
  it("por defecto no hay criterio elegido (se elige antes de ver ganador)", () => {
    expect(DEFAULT_SELECTION.criterion).toBeNull();
  });

  it("serializar y parsear es una ida y vuelta exacta", () => {
    const sel = { focusSite: "B", windowId: "W2", heightM: 10, variant: "published_0004", criterion: "max_joint_hours", timeIndex: 1234 } as const;
    const { selection, rejected } = parseSelection(serializeSelection(sel));
    expect(rejected).toEqual([]);
    expect(selection).toEqual(sel);
  });

  it("rechaza valores no calculados y conserva los por defecto", () => {
    const { selection, rejected } = parseSelection("w=W3&h=5&v=published_0099&c=score&t=99999&s=C");
    expect(selection).toEqual(DEFAULT_SELECTION);
    expect(rejected).toHaveLength(6);
  });

  it("no acepta alturas con formato numérico laxo", () => {
    expect(parseSelection("h=2.0").rejected).toEqual(["h=2.0"]);
    expect(parseSelection("h=02").selection.heightM).toBe(2); // entero válido
  });

  it("cambiar de ventana reinicia el índice temporal; el resto se conserva", () => {
    const s1 = selectionReducer({ ...DEFAULT_SELECTION, timeIndex: 500, heightM: 2 }, { type: "setWindow", value: "W2" });
    expect(s1).toMatchObject({ windowId: "W2", timeIndex: 0, heightM: 2 });
  });

  it("el índice temporal se limita a 0..4319", () => {
    expect(selectionReducer(DEFAULT_SELECTION, { type: "setTimeIndex", value: 10_000 }).timeIndex).toBe(4319);
    expect(selectionReducer(DEFAULT_SELECTION, { type: "setTimeIndex", value: -3 }).timeIndex).toBe(0);
  });
});

describe("formato de etiquetas", () => {
  it("horas en h/min sin alterar la decisión", () => {
    expect(formatHoursMinutes(38.666666666666664)).toBe("38 h 40 min");
    expect(formatHoursMinutes(528.6666666666666)).toBe("528 h 40 min");
    expect(formatHoursMinutes(0)).toBe("0 h");
    expect(formatHoursMinutes(null)).toBe("—");
  });
  it("-0 se muestra como 0 y los ausentes como guion, nunca como 0", () => {
    expect(formatNumber(-0, 1)).toBe("0,0");
    expect(formatNumber(undefined)).toBe("—");
    expect(formatNumber(Number.NaN)).toBe("—");
  });
});
