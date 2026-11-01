// Conversation helpers: the turn type, saving the chat in the browser, and the
// context (previous question + plan) sent with a follow-up question.
import type { AskOk, AskFail } from "@/app/api/ask/route";

export interface Turn {
  id: number;
  question: string;
  status: "loading" | "done";
  viaAi: boolean;
  /** sent with the previous question's plan as context */
  followUp?: boolean;
  reply?: AskOk | AskFail;
}

export interface ChatContextBody {
  question: string;
  plan: {
    dataset_id: string;
    item_ids: string[];
    operation: NonNullable<AskOk["plan"]>["operation"];
    year_from: number | null;
    year_to: number | null;
    extreme: "max" | "min" | null;
  };
}

/** The latest answered question that has a plan, so "and for women?" can build on it. */
export function chatContext(turns: Turn[]): ChatContextBody | undefined {
  for (let i = turns.length - 1; i >= 0; i--) {
    const r = turns[i].reply;
    if (turns[i].status !== "done" || !r) continue;
    if (!r.ok || !r.plan) return undefined; // the last answer failed: start fresh
    const p = r.plan;
    return {
      question: turns[i].question.slice(0, 300),
      plan: { dataset_id: p.dataset_id, item_ids: p.item_ids.slice(0, 12), operation: p.operation, year_from: p.year_from, year_to: p.year_to, extreme: p.extreme },
    };
  }
  return undefined;
}

const KEY = "datadanis-chat-v1";
const MAX_SAVED = 30;

/** Keeps the conversation after a page reload (this browser only; nothing is sent anywhere). */
export function saveChat(turns: Turn[]) {
  try {
    const done = turns.filter((x) => x.status === "done").slice(-MAX_SAVED);
    if (done.length) localStorage.setItem(KEY, JSON.stringify(done));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage full or blocked: the chat just isn't saved */
  }
}

export function loadChat(): Turn[] {
  try {
    const raw = localStorage.getItem(KEY);
    const xs = raw ? (JSON.parse(raw) as Turn[]) : [];
    return Array.isArray(xs) ? xs.filter((x) => x && typeof x.id === "number" && x.status === "done" && x.reply) : [];
  } catch {
    return [];
  }
}
