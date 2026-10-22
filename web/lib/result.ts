export type ActionResult<T = undefined> =
  | {
      ok: true;
      data: T;
      message?: string;
    }
  | {
      ok: false;
      message: string;
      fieldErrors?: Record<string, string[]>;
    };

export function actionError(
  message: string,
  fieldErrors?: Record<string, string[]>
): ActionResult<never> {
  return { ok: false, message, fieldErrors };
}
