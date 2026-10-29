export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(
  path: string,
  token?: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`/api${path}`, { ...options, headers });
  const data = await response.json();
  if (!response.ok) {
    const detail = data.error?.details
      ?.map(
        (d: { field: string; message: string }) => `${d.field}: ${d.message}`,
      )
      .join(" ");
    throw new ApiError(
      response.status,
      [data.error?.message ?? "Request failed.", detail]
        .filter(Boolean)
        .join(" "),
    );
  }
  return data as T;
}

export function errorMessage(error: unknown) {
  if (error instanceof TypeError)
    return "Cannot reach the API. Check that the backend is running and try again.";
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}
