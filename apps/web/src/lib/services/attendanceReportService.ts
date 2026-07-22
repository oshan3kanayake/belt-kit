"use client";

import { auth } from "../firebase";

export type AttendanceReportRequest =
  | { reportType: "month"; month: string }
  | { reportType: "person"; month: string; employeeId: string };

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function getFunctionsBaseUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_FUNCTIONS_BASE_URL?.trim();
  if (configuredUrl) return configuredUrl.replace(/\/$/, "");

  const useEmulator =
    process.env.NEXT_PUBLIC_USE_EMULATOR === "true" ||
    process.env.NEXT_PUBLIC_FUNCTIONS_EMULATOR === "true";

  if (useEmulator) {
    return "http://127.0.0.1:5001/belt-kit/us-central1";
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "belt-kit";
  return `https://us-central1-${projectId}.cloudfunctions.net`;
}

async function readErrorMessage(response: Response) {
  const fallback = `Could not download attendance report (${response.status}).`;
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    const message = (await response.text()).trim();
    return message || fallback;
  }

  try {
    const body = (await response.json()) as {
      error?: string | { message?: string };
      message?: string;
    };
    if (typeof body.error === "string") return body.error;
    return body.error?.message ?? body.message ?? fallback;
  } catch {
    return fallback;
  }
}

async function fetchAttendanceReport(
  url: string,
  forceRefresh: boolean,
): Promise<Response> {
  // Read currentUser for every attempt. Firebase updates this reference through
  // its auth-state listener, so no user or token is cached by this service.
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User is not authenticated");
  }

  const token = await user.getIdToken(forceRefresh);
  return fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
}

function redirectToLogin() {
  if (typeof window === "undefined") return;
  const returnUrl = `${window.location.pathname}${window.location.search}`;
  window.location.assign(`/login?returnUrl=${encodeURIComponent(returnUrl)}`);
}

function getDownloadFilename(header: string | null, request: AttendanceReportRequest) {
  if (header) {
    const encodedMatch = header.match(/filename\*=UTF-8''([^;]+)/i);
    if (encodedMatch?.[1]) {
      try {
        return decodeURIComponent(encodedMatch[1].trim());
      } catch {
        // Fall back to the regular filename form below.
      }
    }

    const filenameMatch = header.match(/filename=(?:"([^"]+)"|([^;]+))/i);
    const filename = filenameMatch?.[1] ?? filenameMatch?.[2];
    if (filename?.trim()) return filename.trim();
  }

  const suffix = request.reportType === "person" ? `-${request.employeeId}` : "";
  return `attendance-${request.month}${suffix}.pdf`;
}

export async function downloadAttendanceReport(
  request: AttendanceReportRequest,
): Promise<void> {
  if (!MONTH_PATTERN.test(request.month)) {
    throw new Error("Select a valid attendance month before downloading.");
  }

  if (request.reportType === "person" && !request.employeeId.trim()) {
    throw new Error("Employee ID is required for a person attendance report.");
  }

  const parameters = new URLSearchParams({
    reportType: request.reportType,
    month: request.month,
  });
  if (request.reportType === "person") {
    parameters.set("employeeId", request.employeeId);
  }

  const url = `${getFunctionsBaseUrl()}/downloadAttendanceReport?${parameters.toString()}`;

  // This is an HTTP function, so the Firebase client SDK does not attach auth
  // automatically. Force-refresh before every download, then retry one 401
  // with another freshly issued token in case the first token was revoked or
  // expired while the request was in flight.
  let response = await fetchAttendanceReport(url, true);

  if (response.status === 401) {
    response = await fetchAttendanceReport(url, true);
    if (response.status === 401) {
      const message = await readErrorMessage(response);
      redirectToLogin();
      throw new Error(message);
    }
  }

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);

  try {
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = getDownloadFilename(
      response.headers.get("content-disposition"),
      request,
    );
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export default { downloadAttendanceReport };
