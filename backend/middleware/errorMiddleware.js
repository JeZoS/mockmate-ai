const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

const errorHandler = (err, req, res, next) => {
  console.error("Error:", err.message);
  const statusCode =
    res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;
  let message = err.message;
  if (err?.name === "CastError" && err?.kind === "ObjectId") {
    message = "No resource found with the given Id";
  }

  res.status(statusCode).json({
    message,
    errorStack: process.env.NODE_ENV === "development" ? err.stack : null,
  });
};

module.exports = { notFound, errorHandler };
