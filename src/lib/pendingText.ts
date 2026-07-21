/**
 * sessionStorage key used to hand a passage off from /history's
 * "リーダーで開く" action to the reader view on `/`. Written once by
 * HistoryView, read (and cleared) once by GlossaiApp on mount — kept in one
 * place so the two call sites can't drift on the literal string.
 */
export const PENDING_TEXT_KEY = "glossai:pendingText";
