import type { GameState, PlayingState } from "../internal/gamelogic/gamestate";
import type { ArmyMove } from "../internal/gamelogic/gamedata";
import { handlePause } from "../internal/gamelogic/pause";
import { handleMove, MoveOutcome } from "../internal/gamelogic/move";
import { handleWar, WarOutcome } from "../internal/gamelogic/war";
import { Acktype } from "../internal/pubsub/consume";
import { publishJSON } from "../internal/pubsub/publish";
import { ExchangePerilTopic, WarRecognitionsPrefix } from "../internal/routing/routing";

export function handlerPause(gs: GameState): (ps: PlayingState) => Acktype {
  return (ps: PlayingState) => {
    handlePause(gs, ps);
    process.stdout.write("> ");
    return Acktype.Ack;
  }
}

export function handlerMove(gs: GameState, ch: ConfirmChannel): (m: ArmyMove) => Acktype {
  return (m: ArmyMove) => {
    const outcome = handleMove(gs, m);
    process.stdout.write("> ");
    if (outcome === MoveOutcome.Safe) {
      return Acktype.Ack;
    }

    if (outcome === MoveOutcome.MakeWar) {
      const rw: RecognitionOfWar = {
        attacker: m.player,
	defender: gs.getPlayerSnap(),
      };
      publishJSON(ch, ExchangePerilTopic, `${WarRecognitionsPrefix}.${gs.getUsername()}`, rw);
      return Acktype.NackRequeue;
    }

    // Either unknown/invalid or the SamePlayer type
    return Acktype.NackDiscard;
  }
}

export function handlerWar(gs: GameState): (rw: RecognitionOfWar) => Acktype {
  return (rw: RecognitionOfWar) => {
    const outcome = handleWar(gs, rw);
    process.stdout.write("> ");
    switch (outcome) {
      case WarOutcome.OpponentWon:
      case WarOutcome.YouWon:
      case WarOutcome.Draw:
        return Acktype.Ack;
      case WarOutcome.NotInvolved:
        return Acktype.NackRequeue;
      case WarOutcome.NoUnits:
      default:
        return Acktype.NackDiscard;
    }
  }
}
