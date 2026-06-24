// Validates req.body against a zod schema; replaces it with the parsed value.
export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: 'Please check the form — some fields are invalid.',
      details: result.error.flatten().fieldErrors,
    });
  }
  req.body = result.data;
  next();
};
