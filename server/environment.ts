export const isConfiguredValue = (value: string | undefined): value is string => {
  const normalized = value?.trim();
  return Boolean(
    normalized && normalized !== "..." && !normalized.startsWith("your_"),
  );
};
