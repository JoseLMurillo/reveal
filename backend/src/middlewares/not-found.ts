import type { RequestHandler } from "express";

import { AppError } from "../errors/app-error.js";
import { ERROR_CODES } from "../errors/error-codes.js";

export const notFound: RequestHandler = (req, _res, next) => {
  next(new AppError(404, ERROR_CODES.NOT_FOUND, `No existe la ruta ${req.method} ${req.path}.`));
};
