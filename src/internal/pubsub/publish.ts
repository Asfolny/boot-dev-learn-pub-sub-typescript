export async function publishJSON<T>(
  chan: ConfirmChannel,
  exchange: string,
  routingKey: string,
  value: T,
): Promise<void> {
  const payload = Buffer.from(JSON.stringify(value));
  chan.publish(exchange, routingKey, payload, {contentType: "application/json"});
}

