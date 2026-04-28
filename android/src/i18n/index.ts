import { th } from "./th";
import { tr } from "./tr";

export type Lang = "tr" | "th";
export function getStrings(lang: Lang) {
  return lang === "th" ? th : tr;
}
