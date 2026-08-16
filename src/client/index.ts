import amqp from "amqplib";
import { declareAndBind, SimpleQueueType, subscribeJSON } from "../internal/pubsub/consume";
import { publishJSON } from "../internal/pubsub/publish";
import { ExchangePerilDirect, ExchangePerilTopic, PauseKey, ArmyMovesPrefix, WarRecognitionsPrefix } from "../internal/routing/routing";
import type { PlayingState } from "../internal/gamelogic/gamestate";
import { GameState } from "../internal/gamelogic/gamestate";
import { clientWelcome, getInput, commandStatus, printClientHelp, printQuit } from "../internal/gamelogic/gamelogic";
import { commandSpawn } from "../internal/gamelogic/spawn";
import { commandMove } from "../internal/gamelogic/move";
import { handlerPause, handlerMove, handlerWar } from "./handlers";

async function main() {
  const rabbitConnString = "amqp://guest:guest@localhost:5672/";
  const conn = await amqp.connect(rabbitConnString);
  process.on("SIGINT", () => {
    console.log("Shutting down connection to rabbitmq");
    conn.close();
  });

  const username = await clientWelcome();
  const state = new GameState(username);
  const ch = await conn.createConfirmChannel();
  await subscribeJSON(conn, ExchangePerilDirect, `${PauseKey}.${username}`, PauseKey, SimpleQueueType.Transient, handlerPause(state));
  await subscribeJSON(conn, ExchangePerilTopic, `${ArmyMovesPrefix}.${username}`, `${ArmyMovesPrefix}.*`, SimpleQueueType.Transient, handlerMove(state, ch));
  await subscribeJSON(conn, ExchangePerilTopic, `${WarRecognitionsPrefix}`, `${WarRecognitionsPrefix}.*`, SimpleQueueType.Durable, handlerWar(state));

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
          const move = commandMove(state, input);
	  publishJSON(ch, ExchangePerilTopic, `${ArmyMovesPrefix}.${username}`, move);
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
