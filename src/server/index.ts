import amqp from "amqplib";
import { publishJSON } from "../internal/pubsub/publish";
import { ExchangePerilDirect, PauseKey } from "../internal/routing/routing";
import type { PlayingState } from "../internal/gamelogic/gamestate";
import { printServerHelp, getInput } from "../internal/gamelogic/gamelogic";

async function main() {
  const rabbitConnString = "amqp://guest:guest@localhost:5672/";
  const conn = await amqp.connect(rabbitConnString);
  console.log("Starting Peril server...");
  process.on("SIGINT", () => {
    console.log("Shutting down Peril server...");
    conn.close();
  });

  const ch = await conn.createConfirmChannel();

  printServerHelp();
  mainLoop: while(true) {
    const input = await getInput();
    if (input.length < 1) {
      continue;
    }

    switch(input[0]){
      case "pause":
        publishJSON(ch, ExchangePerilDirect, PauseKey, {IsPaused: true} as PlayingState);
        break;
      case "resume":
        publishJSON(ch, ExchangePerilDirect, PauseKey, {IsPaused: false} as PlayingState);
        break;
      case "quit":
	break mainLoop;
      default:
        console.log("Unknown command, try again");
        break;
    }
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
