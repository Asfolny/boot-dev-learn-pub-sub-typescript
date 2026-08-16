export enum SimpleQueueType {
  Durable,
  Transient,
}

export enum Acktype {
  Ack,
  NackRequeue,
  NackDiscard,
}

export async function declareAndBind(
  conn: amqp.ChannelModel,
  exchange: string,
  queueName: string,
  key: string,
  queueType: SimpleQueueType,
): Promise<[Channel, amqp.Replies.AssertQueue]> {
  const chan = await conn.createChannel();
  const queue = await chan.assertQueue(
    queueName,
    {durable: queueType === SimpleQueueType.Durable, autoDelete: queueType === SimpleQueueType.Transient, exclusive: queueType === SimpleQueueType.Transient, arguments: {"x-dead-letter-exchange": "peril_dlx"}}
  );
  await chan.bindQueue(queueName, exchange, key);
  return [chan, queue];
}

export async function subscribeJSON<T>(
  conn: amqp.ChannelModel,
  exchange: string,
  queueName: string,
  key: string,
  queueType: SimpleQueueType,
  handler: (data: T) => Acktype,
): Promise<void> {
  const [chan, queue] = await declareAndBind(conn, exchange, queueName, key, queueType);
  await chan.consume(queueName, (msg: amqp.ConsumeMessage | null) => {
    if (msg === null) return null;
    const parsed = JSON.parse(msg.content.toString("utf-8"));
    const acking = handler(parsed);
    switch (acking) {
      case Acktype.Ack:
        chan.ack(msg);
        break;
      case Acktype.NackRequeue:
        chan.nack(msg, false, true);
        break;
      case Acktype.NackDiscard:
        chan.nack(msg, false, false);
        break;
    }
  });
}
