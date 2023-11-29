export function compareClientAndServerDates(
  clientUpdatedAt: Date | null | undefined,
  serverUpdatedAt: Date | null | undefined,
) {
  const isUpToDate =
    (!clientUpdatedAt && !serverUpdatedAt) ||
    clientUpdatedAt?.getTime() === serverUpdatedAt?.getTime();

  if (isUpToDate) {
    return 'upToDate';
  }

  if (
    (clientUpdatedAt && serverUpdatedAt && clientUpdatedAt > serverUpdatedAt) ||
    (clientUpdatedAt && !serverUpdatedAt)
  ) {
    return 'outdatedOnServer';
  }

  if (
    (clientUpdatedAt && serverUpdatedAt && clientUpdatedAt < serverUpdatedAt) ||
    (serverUpdatedAt && !clientUpdatedAt)
  ) {
    return 'outdatedOnClient';
  }

  return 'upToDate';
}
