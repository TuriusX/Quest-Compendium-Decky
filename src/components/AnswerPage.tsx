import { DialogButton, Focusable } from "@decky/ui";
import { useCurrentGame } from "../game";
import { resetConversation, useChat } from "../store";
import { ThemeStyle } from "../theme";
import { AnswerBlocks } from "./AnswerBlocks";
import { PageHeader } from "./Brand";

/** Full-screen reader: the whole conversation for the current game, as a scrolling chat. */
export function AnswerPage() {
  const chat = useChat();
  const game = useCurrentGame();
  const turns = chat.history;
  const lastUserIndex = turns.map((t) => t.role).lastIndexOf("user");

  return (
    <div className="qc-page">
      <ThemeStyle />
      <div className="qc-page-inner">
        <PageHeader title="Conversation" sub={game ? game.name : null} />
        {turns.length === 0 && (
          <div className="qc-note qc-muted" style={{ margin: 8 }}>
            No questions yet. Open the Quick Access menu and ask Quest Compendium something.
          </div>
        )}
        {turns.map((t, i) =>
          t.role === "user" ? (
            <Focusable
              key={i}
              className="qc-q"
              focusClassName="qc-focused"
              noFocusRing
              // Start near the latest question instead of the top of a long conversation.
              autoFocus={i === lastUserIndex}
            >
              {t.text}
            </Focusable>
          ) : (
            <div key={i} className="qc-a">
              <AnswerBlocks text={t.text} chunk={420} />
            </div>
          ),
        )}
        {chat.busy && <div className="qc-note qc-muted" style={{ margin: "16px 8px" }}>Thinking…</div>}
        {turns.length > 0 && (
          <div style={{ marginTop: 20, maxWidth: 320 }}>
            <DialogButton onClick={() => resetConversation(game?.appId ?? null)}>New conversation</DialogButton>
          </div>
        )}
      </div>
    </div>
  );
}
