export const getModel = () => {
  const raw = process.env.OPENAI_MODEL;
  const model = raw && raw.trim().length > 0 ? raw.trim() : "gpt-4o-mini";
  return model;
};
