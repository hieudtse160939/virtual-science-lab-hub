import type { Locale } from "../config";
import en from "./en";
import vi, { type Dictionary } from "./vi";

const dictionaries: Record<Locale, Dictionary> = { vi, en };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export type { Dictionary };
