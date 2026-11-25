#!/usr/bin/env python3
"""Claude Code Stop hook: if a turn's prose is mainly English, ask for a Japanese rewrite.

Vendored from https://github.com/minorun365/claude-code-japanese-guard (commit
4434ef4, Apache-2.0; see japanese-guard.LICENSE and japanese-guard.NOTICE).
Modified for this repository: developer comments and docstrings are in English,
and JSON responses are ASCII-escaped so that a non-UTF-8 stdout (for example
CP1252 on Windows) cannot fail. The Japanese messages sent to Claude are
unchanged.

Three kinds of text are checked:
1. The turn's final answer: the prose Claude wrote after its last tool call
   (all prose when the turn called no tool).
2. The desktop app's "next step" box (wrap_up tool): recap, ask and button
   text. When the box replaces the final answer little prose remains, so 1
   alone would let it pass.
3. Progress reports between tool calls that are long enough to read: multi-line
   reports with at least MIN_LATIN_MID Latin letters, or one-line reports with
   at least MIN_LATIN_MID_LONG. A one-line preamble before a tool call is shown
   small and is not checked; asking to rewrite it would add a second reply after
   the Japanese final answer. Progress reports can also be recorded as thinking
   blocks (thinkingDisplay "updates").
The same check stops wrap_up as a PreToolUse hook, before an English box is
shown. The final answer is also read from the hook input last_assistant_message,
so a late transcript write is not missed; that field holds only the last reply,
so the transcript is checked as well.
Code blocks, inline code, URLs, e-mail addresses and Markdown links are not
counted: showing English commands or drafts in code blocks is legitimate.
A final answer that is only a JSON value (code fences allowed) is not checked,
because a script reads it and a rewrite would break the JSON.
JAPANESE_GUARD_DISABLE=1 turns the hook off (for claude -p output nobody reads).

A turn is sent back at most once (stop_hook_active passes it), so a second
English reply ends the turn instead of looping.

Standalone check: python3 japanese-guard.py --check <transcript.jsonl>
"""

import json
import os
import re
import sys
import time

# Prose with fewer Latin letters is not judged (short replies such as "OK").
MIN_LATIN = int(os.environ.get("JAPANESE_GUARD_MIN_LATIN", "25"))
# Multi-line progress reports between tool calls are judged from this many letters.
MIN_LATIN_MID = int(os.environ.get("JAPANESE_GUARD_MIN_LATIN_MID", "60"))
# One-line progress reports are judged only as long paragraphs of this many letters.
MIN_LATIN_MID_LONG = int(os.environ.get("JAPANESE_GUARD_MIN_LATIN_MID_LONG", "250"))
# Prose is mainly English when Latin letters exceed this multiple of Japanese characters.
RATIO = float(os.environ.get("JAPANESE_GUARD_RATIO", "3"))
# Longest wait (seconds) for the final answer to reach the transcript.
WAIT_SECONDS = float(os.environ.get("JAPANESE_GUARD_WAIT", "3"))
# "1" turns the hook off (claude -p output that nobody reads).
DISABLED = os.environ.get("JAPANESE_GUARD_DISABLE") == "1"

JA = re.compile(r"[ぁ-んァ-ヶ一-龥]")
LATIN = re.compile(r"[A-Za-z]")
IGNORE = [
    re.compile(r"```.*?```", re.S),
    re.compile(r"`[^`\n]*`"),
    re.compile(r"\[[^\]]*\]\([^)]*\)"),
    re.compile(r"https?://\S+"),
    re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+"),
]

REASON = (
    "このターンの本文に、英語で書いた箇所があります。\n"
    "{quoted}\n"
    "ユーザーは日本語での応答を求めています。上に挙げた英語の箇所だけを、日本語に書き直して出してください。"
    "日本語で書けていた部分は、すでにユーザーに届いているので再掲しないこと。"
    "言い訳や原因の説明は書かず、以降の応答もすべて日本語で書くこと。"
)

WRAP_UP_REASON = (
    "次の一手の箱（recap・ask・ボタンの文言）が英語です。ユーザーは日本語での応答を求めています。"
    "すべて日本語で書き直して、もう一度呼んでください。"
)


def is_english(text, min_latin=MIN_LATIN):
    for pattern in IGNORE:
        text = pattern.sub("", text)
    latin = len(LATIN.findall(text))
    ja = len(JA.findall(text))
    return latin >= min_latin and latin > ja * RATIO


def looks_like_json(text):
    """True when the final answer is a JSON value (surrounding code fences allowed)."""
    t = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip())
    if not t or t[0] not in "[{":
        return False
    try:
        json.loads(t)
        return True
    except ValueError:
        return False


def is_mid_report_english(text):
    """Judge a progress report: skip one-line preambles, check multi-line or long ones."""
    lines = [line for line in text.strip().splitlines() if line.strip()]
    if len(lines) >= 2:
        return is_english(text, MIN_LATIN_MID)
    return is_english(text, MIN_LATIN_MID_LONG)


def is_wrap_up(name):
    """Whether the tool shows the desktop "next step" box (an MCP tool, so prefixed)."""
    return (name or "").endswith("wrap_up")


def wrap_up_text(tool_input):
    """Join the text shown in the next-step box (recap, ask and button labels)."""
    tool_input = tool_input or {}
    parts = [tool_input.get("recap") or "", tool_input.get("ask") or ""]
    actions = tool_input.get("actions")
    if isinstance(actions, str):
        try:
            actions = json.loads(actions)
        except ValueError:
            actions = []
    for action in actions or []:
        if isinstance(action, dict):
            parts += [action.get("label") or "", action.get("message") or ""]
    return "\n".join(p for p in parts if p)


def head(text, label=""):
    return label + text.strip().splitlines()[0][:80]


def is_user_turn(entry):
    """Whether the entry is a user-typed message (not a tool result or meta entry)."""
    if entry.get("type") != "user" or entry.get("isMeta"):
        return False
    content = entry.get("message", {}).get("content")
    if isinstance(content, str):
        return True
    if isinstance(content, list):
        return not any(isinstance(c, dict) and c.get("type") == "tool_result" for c in content)
    return False


def read_entries(transcript_path):
    entries = []
    with open(transcript_path, encoding="utf-8", errors="ignore") as f:
        for line in f:
            try:
                entries.append(json.loads(line))
            except ValueError:
                continue
    return entries


def turn_ended_in_text(entries):
    """Whether this turn's latest assistant entry ends with prose."""
    for entry in reversed(entries):
        if is_user_turn(entry):
            return False
        if entry.get("type") == "assistant":
            content = entry.get("message", {}).get("content") or []
            last = next((c for c in reversed(content) if isinstance(c, dict)), None)
            return bool(last) and last.get("type") == "text"
        if entry.get("type") == "user":  # A tool result last: the final answer is not written yet.
            return False
    return False


def wait_for_final(transcript_path, timeout=WAIT_SECONDS):
    """The Stop hook can run before the final answer reaches the transcript; read
    at once, an English answer would pass unseen. Wait until it appears. A turn
    that called no tool already ends with prose, so it does not wait."""
    deadline = time.time() + timeout
    entries = read_entries(transcript_path)
    while not turn_ended_in_text(entries) and time.time() < deadline:
        time.sleep(0.1)
        entries = read_entries(transcript_path)
    return entries


def english_passages(transcript_path, entries=None):
    if entries is None:
        entries = read_entries(transcript_path)
    start = 0
    for i, entry in enumerate(entries):
        if is_user_turn(entry):
            start = i + 1
    # Final answer = prose after the last tool call; restart collecting at each tool call.
    final = []
    hits = []
    for entry in entries[start:]:
        if entry.get("type") != "assistant":
            continue
        for block in entry.get("message", {}).get("content") or []:
            if not isinstance(block, dict):
                continue
            if block.get("type") == "tool_use":
                # Prose that did not become the final answer is a progress report; check long ones.
                hits += [head(t, "（途中の報告）") for t in final if is_mid_report_english(t)]
                final = []
                if is_wrap_up(block.get("name")):
                    text = wrap_up_text(block.get("input"))
                    if is_english(text):
                        hits.append(head(text, "（次の一手の箱）"))
            elif block.get("type") == "text":
                final.append(block.get("text", ""))
            elif block.get("type") == "thinking" and entry.get("thinkingDisplay") == "updates":
                # With thinkingDisplay "updates", non-empty thinking is shown as a progress report.
                text = block.get("thinking") or ""
                if text.strip() and is_mid_report_english(text):
                    hits.append(head(text, "（途中の報告）"))
    hits += [head(text) for text in final if is_english(text)]
    return hits


def main():
    if len(sys.argv) == 3 and sys.argv[1] == "--check":
        hits = english_passages(sys.argv[2])
        print("\n".join(hits) if hits else "英語主体の本文はありません")
        return
    if DISABLED:
        return
    data = json.load(sys.stdin)
    if data.get("hook_event_name") == "PreToolUse":
        if is_wrap_up(data.get("tool_name")) and is_english(wrap_up_text(data.get("tool_input"))):
            print(json.dumps({"hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny",
                "permissionDecisionReason": WRAP_UP_REASON,
            }}))  # ASCII escapes: safe on any stdout encoding.
        return
    if data.get("stop_hook_active"):
        return
    # A JSON-only final answer is script output: a rewrite request would add prose
    # and the result would no longer parse as JSON.
    if looks_like_json(data.get("last_assistant_message") or ""):
        return
    # The final answer is also in the hook input last_assistant_message: it can be
    # judged without waiting for the transcript. It holds only the last reply, so
    # the earlier part of a split reply is checked in the transcript (upstream issue #1).
    message = data.get("last_assistant_message") or ""
    message_en = bool(message) and is_english(message)
    path = data.get("transcript_path")
    hits = []
    if path:
        try:
            hits = english_passages(path, read_entries(path) if message_en else wait_for_final(path))
        except OSError:
            pass
    if message_en:
        first = head(message)
        if first not in hits:
            hits.append(first)
    if hits:
        quoted = "\n".join("- " + h for h in hits[:5])
        print(json.dumps({"decision": "block", "reason": REASON.format(quoted=quoted)}))


if __name__ == "__main__":
    main()
