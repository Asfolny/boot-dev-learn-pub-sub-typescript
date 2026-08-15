import amqp from "amqplib";
import { declareAndBind, SimpleQueueType } from "../internal/pubsub/consume";
import { ExchangePerilDirect, PauseKey } from "../internal/routing/routing";
import type { PlayingState } from "../internal/gamelogic/gamestate";
import { GameState } from "../internal/gamelogic/gamestate";
import { clientWelcome, getInput, commandStatus, printClientHelp, printQuit } from "../internal/gamelogic/gamelogic";
import { commandSpawn } from "../internal/gamelogic/spawn";
import { commandMove } from "../internal/gamelogic/move";

async function main() {
  const rabbitConnString = "amqp://guest:guest@localhost:5672/";
  const conn = await amqp.connect(rabbitConnString);
  process.on("SIGINT", () => {
    console.log("Shutting down connection to rabbitmq");
    conn.close();
  });

  const username = await clientWelcome();
  const [channel, queue] = await declareAndBind(conn, ExchangePerilDirect, `pause.${username}`, PauseKey, SimpleQueueType.Transient)
  const state = new GameState(username);

  mainLoop: while(true) {
    const input = await getInput();
    if (input.length < 1) {
      continue;
    }

    switch (input[0]) {
      case "spawn":
        try {
          commandSpawn(state, input);
        } catch(err) {
          console.error(err);
	}
	break;
      case "move":
        try {
          commandMove(state, input);
        } catch(err) {
          console.error(err);
	}
	break;
      case "status":
        await commandStatus(state);
        break;
      case "help":
        printClientHelp();
        break;
      case "quit":
        printQuit();
        break mainLoop;
      default:
        console.log("Unknown command, try again...");
        continue;
    }
  }
  conn.close();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
